import { ChildProcessWithoutNullStreams, execFile, spawn } from "node:child_process";

import {
  AdapterListResponse,
  CaptureAdapter,
  DiscoveryResponse,
  DiscoverySuccess,
  HelperFailure,
} from "./models";

const MAX_STDOUT_BYTES = 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const activeChildren = new Set<ChildProcessWithoutNullStreams>();

export interface PythonRuntime {
  executable: string;
  prefixArguments: string[];
}

export interface CancellationLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export class HelperClientError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HelperClientError";
  }
}

export type PythonProbe = (executable: string, arguments_: string[]) => Promise<void>;

const defaultProbe: PythonProbe = async (executable, arguments_) =>
  new Promise<void>((resolve, reject) => {
    execFile(
      executable,
      arguments_,
      { windowsHide: true, timeout: 5_000, maxBuffer: 32 * 1024 },
      (error) => (error ? reject(error) : resolve()),
    );
  });

export async function resolvePythonRuntime(
  configuredPath?: string,
  probe: PythonProbe = defaultProbe,
): Promise<PythonRuntime> {
  const configured = configuredPath?.trim();
  if (configured) {
    try {
      await probe(configured, ["--version"]);
      return { executable: configured, prefixArguments: [] };
    } catch {
      throw new HelperClientError(
        "python_missing",
        `The configured Python executable is unavailable: ${configured}`,
      );
    }
  }

  for (const candidate of [
    { executable: "py", prefixArguments: ["-3"] },
    { executable: "python", prefixArguments: [] },
  ]) {
    try {
      await probe(candidate.executable, [...candidate.prefixArguments, "--version"]);
      return candidate;
    } catch {
      // Continue to the next supported development runtime command.
    }
  }
  throw new HelperClientError(
    "python_missing",
    "Python is not available. Install Python 3 or configure networkEngineerToolkit.pythonPath.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseAdapter(value: unknown): CaptureAdapter | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    !isString(value.id) ||
    !isString(value.name) ||
    !isString(value.description) ||
    !isString(value.guid) ||
    !isString(value.status) ||
    !isString(value.mac_address) ||
    !isString(value.link_speed) ||
    !["ethernet", "wifi", "other"].includes(String(value.kind)) ||
    !(typeof value.is_up === "boolean" || value.is_up === null) ||
    typeof value.confidence !== "number" ||
    !isString(value.reason)
  ) {
    return undefined;
  }
  return value as unknown as CaptureAdapter;
}

function parseFailure(value: Record<string, unknown>): HelperFailure | undefined {
  if (
    !["unavailable", "timeout", "error", "cancelled"].includes(String(value.status)) ||
    !isString(value.message)
  ) {
    return undefined;
  }
  if (value.error_code !== undefined && !isString(value.error_code)) {
    return undefined;
  }
  return value as unknown as HelperFailure;
}

export function parseAdapterListJson(text: string): AdapterListResponse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HelperClientError("malformed_json", "The switchport helper returned malformed JSON.");
  }
  if (!isRecord(value)) {
    throw new HelperClientError("invalid_response", "The switchport helper returned an invalid response.");
  }
  const failure = parseFailure(value);
  if (failure) {
    return failure;
  }
  if (value.status !== "success" || !Array.isArray(value.adapters)) {
    throw new HelperClientError("invalid_response", "The switchport helper returned an invalid adapter list.");
  }
  const adapters = value.adapters.map(parseAdapter);
  if (adapters.some((adapter) => adapter === undefined)) {
    throw new HelperClientError("invalid_response", "The switchport helper returned invalid adapter data.");
  }
  return { status: "success", adapters: adapters as CaptureAdapter[] };
}

export function parseDiscoveryJson(text: string): DiscoveryResponse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HelperClientError("malformed_json", "The switchport helper returned malformed JSON.");
  }
  if (!isRecord(value)) {
    throw new HelperClientError("invalid_response", "The switchport helper returned an invalid response.");
  }
  const failure = parseFailure(value);
  if (failure) {
    return failure;
  }
  const adapter = parseAdapter(value.adapter);
  if (
    value.status !== "success" ||
    !adapter ||
    !Array.isArray(value.protocols) ||
    !value.protocols.every((item) => item === "LLDP" || item === "CDP") ||
    !isString(value.captured_at) ||
    value.capture_source !== "local-windows" ||
    value.capture_engine !== "Scapy/Npcap"
  ) {
    throw new HelperClientError("invalid_response", "The switchport helper returned invalid discovery data.");
  }
  return value as unknown as DiscoverySuccess;
}

export function buildHelperArguments(
  runtime: PythonRuntime,
  helperPath: string,
  operation: "list-adapters" | "discover-switchport",
  options?: { adapterId: string; timeoutSeconds: number; graceSeconds: number },
): string[] {
  if (operation === "list-adapters") {
    return [...runtime.prefixArguments, helperPath, "list-adapters"];
  }
  if (!options) {
    throw new HelperClientError("invalid_operation", "Discovery options are required.");
  }
  return [
    ...runtime.prefixArguments,
    helperPath,
    "discover-switchport",
    "--adapter",
    options.adapterId,
    "--timeout",
    String(options.timeoutSeconds),
    "--grace",
    String(options.graceSeconds),
  ];
}

export interface RunOptions {
  runtime: PythonRuntime;
  helperPath: string;
  operation: "list-adapters" | "discover-switchport";
  discovery?: { adapterId: string; timeoutSeconds: number; graceSeconds: number };
  cancellation?: CancellationLike;
  maximumRuntimeMs: number;
  spawnProcess?: typeof spawn;
}

export async function runHelper(options: RunOptions): Promise<string> {
  if (options.cancellation?.isCancellationRequested) {
    throw new HelperClientError("cancelled", "Switchport discovery was cancelled.");
  }
  const arguments_ = buildHelperArguments(
    options.runtime,
    options.helperPath,
    options.operation,
    options.discovery,
  );
  return new Promise<string>((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = (options.spawnProcess ?? spawn)(options.runtime.executable, arguments_, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      }) as unknown as ChildProcessWithoutNullStreams;
    } catch (error) {
      reject(
        new HelperClientError(
          "helper_start_failed",
          `Unable to start the switchport helper: ${error instanceof Error ? error.message : String(error)}`,
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
    let cancelled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      cancellationSubscription?.dispose();
      activeChildren.delete(child);
    };
    const finish = (error?: HelperClientError): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      error ? reject(error) : resolve(stdout.trim());
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new HelperClientError("helper_timeout", "The switchport helper exceeded its time limit."));
    }, options.maximumRuntimeMs);
    const cancellationSubscription = options.cancellation?.onCancellationRequested(() => {
      cancelled = true;
      child.kill();
    });

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > MAX_STDOUT_BYTES) {
        child.kill();
        finish(new HelperClientError("helper_output_limit", "The switchport helper returned too much data."));
      }
    });
    child.stderr.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr) < MAX_STDERR_BYTES) {
        stderr += chunk;
      }
    });
    child.on("error", (error) =>
      finish(new HelperClientError("helper_start_failed", `Unable to start the switchport helper: ${error.message}`)),
    );
    child.on("close", (code) => {
      if (cancelled) {
        finish(new HelperClientError("cancelled", "Switchport discovery was cancelled."));
      } else if (!stdout.trim()) {
        finish(
          new HelperClientError(
            "helper_failed",
            `The switchport helper exited without JSON${code ? ` (code ${code})` : ""}.${stderr.trim() ? ` ${stderr.trim()}` : ""}`,
          ),
        );
      } else {
        finish();
      }
    });
  });
}

export async function listAdapters(
  runtime: PythonRuntime,
  helperPath: string,
  spawnProcess?: typeof spawn,
): Promise<AdapterListResponse> {
  return parseAdapterListJson(
    await runHelper({
      runtime,
      helperPath,
      operation: "list-adapters",
      maximumRuntimeMs: 15_000,
      spawnProcess,
    }),
  );
}

export async function discoverSwitchport(
  runtime: PythonRuntime,
  helperPath: string,
  adapterId: string,
  cancellation?: CancellationLike,
  spawnProcess?: typeof spawn,
): Promise<DiscoveryResponse> {
  const timeoutSeconds = 45;
  const graceSeconds = 12;
  return parseDiscoveryJson(
    await runHelper({
      runtime,
      helperPath,
      operation: "discover-switchport",
      discovery: { adapterId, timeoutSeconds, graceSeconds },
      cancellation,
      maximumRuntimeMs: (timeoutSeconds + 10) * 1000,
      spawnProcess,
    }),
  );
}

export function disposeActiveHelpers(): void {
  for (const child of activeChildren) {
    child.kill();
  }
  activeChildren.clear();
}
