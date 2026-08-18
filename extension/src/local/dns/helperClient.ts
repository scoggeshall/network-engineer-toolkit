import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";

import { DnsLookupFailure, DnsLookupResponse, DnsLookupSuccess } from "./models";

const MAX_STDOUT_BYTES = 256 * 1024;
const MAX_STDERR_BYTES = 32 * 1024;
const MAXIMUM_RUNTIME_MS = 10_000;
const activeChildren = new Set<ChildProcessWithoutNullStreams>();

export interface CancellationLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export class DnsHelperError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DnsHelperError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseFailure(value: Record<string, unknown>): DnsLookupFailure | undefined {
  if (
    !["error", "unavailable", "timeout", "cancelled"].includes(String(value.status)) ||
    typeof value.message !== "string"
  ) {
    return undefined;
  }
  if (value.error_code !== undefined && typeof value.error_code !== "string") {
    return undefined;
  }
  return value as unknown as DnsLookupFailure;
}

export function parseDnsLookupJson(text: string): DnsLookupResponse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DnsHelperError("malformed_json", "The local DNS helper returned malformed JSON.");
  }
  if (!isRecord(value)) {
    throw new DnsHelperError("invalid_response", "The local DNS helper returned an invalid response.");
  }

  const failure = parseFailure(value);
  if (failure !== undefined) {
    return failure;
  }
  if (
    value.status !== "success" ||
    typeof value.query !== "string" ||
    (value.lookup_type !== "forward" && value.lookup_type !== "reverse") ||
    !isStringArray(value.addresses) ||
    value.addresses.length === 0 ||
    !(value.hostname === null || typeof value.hostname === "string") ||
    !isStringArray(value.aliases) ||
    value.execution_source !== "local-windows" ||
    (value.lookup_type === "reverse" && !value.hostname)
  ) {
    throw new DnsHelperError("invalid_response", "The local DNS helper returned invalid lookup data.");
  }
  return value as unknown as DnsLookupSuccess;
}

export function buildDnsHelperArguments(helperPath: string, query: string): string[] {
  return [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-File",
    helperPath,
    "-Query",
    query,
  ];
}

export interface RunDnsHelperOptions {
  helperPath: string;
  query: string;
  cancellation?: CancellationLike;
  maximumRuntimeMs?: number;
  spawnProcess?: typeof spawn;
}

export async function runDnsHelper(options: RunDnsHelperOptions): Promise<string> {
  if (options.cancellation?.isCancellationRequested) {
    throw new DnsHelperError("cancelled", "DNS lookup was cancelled.");
  }

  return new Promise<string>((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = (options.spawnProcess ?? spawn)(
        "powershell.exe",
        buildDnsHelperArguments(options.helperPath, options.query),
        {
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ) as unknown as ChildProcessWithoutNullStreams;
    } catch (error) {
      reject(
        new DnsHelperError(
          "helper_start_failed",
          `Unable to start the local DNS helper: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      return;
    }

    activeChildren.add(child);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let stderr = "";
    let settled = false;
    let terminationError: DnsHelperError | undefined;
    let timer: NodeJS.Timeout | undefined;
    let cancellationSubscription: { dispose(): void } | undefined;

    const cleanup = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      cancellationSubscription?.dispose();
      activeChildren.delete(child);
    };
    const finish = (error?: DnsHelperError): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      error === undefined ? resolve(stdout.trim()) : reject(error);
    };
    const requestTermination = (error: DnsHelperError): void => {
      if (terminationError !== undefined || settled) {
        return;
      }
      terminationError = error;
      child.kill();
    };
    timer = setTimeout(() => {
      requestTermination(
        new DnsHelperError("helper_timeout", "The local DNS lookup exceeded its time limit."),
      );
    }, options.maximumRuntimeMs ?? MAXIMUM_RUNTIME_MS);
    cancellationSubscription = options.cancellation?.onCancellationRequested(() => {
      requestTermination(new DnsHelperError("cancelled", "DNS lookup was cancelled."));
    });
    if (options.cancellation?.isCancellationRequested) {
      requestTermination(new DnsHelperError("cancelled", "DNS lookup was cancelled."));
    }

    child.stdout.on("data", (chunk: string) => {
      if (terminationError !== undefined || settled) {
        return;
      }
      stdout += chunk;
      if (Buffer.byteLength(stdout) > MAX_STDOUT_BYTES) {
        requestTermination(
          new DnsHelperError("helper_output_limit", "The local DNS helper returned too much data."),
        );
      }
    });
    child.stderr.on("data", (chunk: string) => {
      if (terminationError === undefined && !settled && Buffer.byteLength(stderr) < MAX_STDERR_BYTES) {
        stderr += chunk;
      }
    });
    child.on("error", (error) =>
      finish(
        terminationError ??
          new DnsHelperError("helper_start_failed", `Unable to start the local DNS helper: ${error.message}`),
      ),
    );
    child.on("close", (code) => {
      if (terminationError !== undefined) {
        finish(terminationError);
      } else if (!stdout.trim()) {
        const diagnostic = stderr.trim();
        finish(
          new DnsHelperError(
            "helper_failed",
            `The local DNS helper exited without JSON${code ? ` (code ${code})` : ""}.${diagnostic ? ` ${diagnostic}` : ""}`,
          ),
        );
      } else {
        finish();
      }
    });
  });
}

export async function lookupDns(
  helperPath: string,
  query: string,
  cancellation?: CancellationLike,
  spawnProcess?: typeof spawn,
): Promise<DnsLookupResponse> {
  return parseDnsLookupJson(
    await runDnsHelper({ helperPath, query, cancellation, spawnProcess }),
  );
}

export function disposeActiveDnsHelpers(): void {
  for (const child of activeChildren) {
    child.kill();
  }
}
