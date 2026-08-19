import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";

import { PythonRuntime } from "../switchport/helperClient";
import {
  ScannerDevice,
  ScannerFailure,
  ScannerResponse,
  ScannerRoute,
  ScannerSuccess,
} from "./models";

const MAX_STDOUT_BYTES = 512 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
export const SCANNER_MAXIMUM_RUNTIME_MS = 30_000;
export const SCANNER_ARP_TIMEOUT_SECONDS = 2;
export const SCANNER_ICMP_TIMEOUT_SECONDS = 2;
export const SCANNER_DNS_WORKERS = 16;
const activeChildren = new Set<ChildProcessWithoutNullStreams>();

export interface CancellationLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export class ScannerHelperError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScannerHelperError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIpv4(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) {
      return false;
    }
    return Number(part) <= 255;
  });
}

function parseFailure(value: Record<string, unknown>): ScannerFailure | undefined {
  if (
    !["unavailable", "error", "timeout", "cancelled"].includes(String(value.status)) ||
    typeof value.message !== "string"
  ) {
    return undefined;
  }
  if (value.error_code !== undefined && typeof value.error_code !== "string") {
    return undefined;
  }
  return value as unknown as ScannerFailure;
}

function parseRoute(value: unknown): ScannerRoute | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    (value.mode !== "direct" && value.mode !== "routed") ||
    typeof value.interface !== "string" ||
    value.interface.length === 0 ||
    !isIpv4(value.source_address)
  ) {
    return undefined;
  }
  if (value.mode === "direct" && value.gateway !== null) {
    return undefined;
  }
  if (value.mode === "routed" && !isIpv4(value.gateway)) {
    return undefined;
  }
  return value as unknown as ScannerRoute;
}

function parseDevice(value: unknown, route: ScannerRoute): ScannerDevice | undefined {
  if (!isRecord(value) || !isIpv4(value.ip)) {
    return undefined;
  }
  if (!(value.hostname === null || (typeof value.hostname === "string" && value.hostname.length > 0))) {
    return undefined;
  }
  if (!(value.vendor === null || (typeof value.vendor === "string" && value.vendor.length > 0))) {
    return undefined;
  }
  if (
    !(value.mac_address === null ||
      (typeof value.mac_address === "string" && /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(value.mac_address)))
  ) {
    return undefined;
  }
  if (
    !Array.isArray(value.discovery_methods) ||
    value.discovery_methods.length === 0 ||
    !value.discovery_methods.every((method) => ["arp", "icmp", "local-interface"].includes(String(method)))
  ) {
    return undefined;
  }
  if (
    !(value.latency_ms === null ||
      (typeof value.latency_ms === "number" && Number.isFinite(value.latency_ms) && value.latency_ms >= 0))
  ) {
    return undefined;
  }
  if (route.mode === "routed" && value.mac_address !== null) {
    return undefined;
  }
  if (route.mode === "routed" && value.discovery_methods.includes("arp")) {
    return undefined;
  }
  return value as unknown as ScannerDevice;
}

export function parseScannerJson(text: string): ScannerResponse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ScannerHelperError("malformed_json", "The network scanner helper returned malformed JSON.");
  }
  if (!isRecord(value)) {
    throw new ScannerHelperError("invalid_response", "The network scanner helper returned an invalid response.");
  }
  const failure = parseFailure(value);
  if (failure) {
    return failure;
  }
  const route = parseRoute(value.route);
  if (
    value.status !== "success" ||
    typeof value.subnet !== "string" ||
    !Number.isInteger(value.host_count) ||
    Number(value.host_count) < 0 ||
    !route ||
    !Array.isArray(value.devices) ||
    typeof value.duration_ms !== "number" ||
    !Number.isFinite(value.duration_ms) ||
    value.duration_ms < 0 ||
    value.discovery_source !== "local-windows" ||
    value.discovery_engine !== "Scapy/Npcap"
  ) {
    throw new ScannerHelperError("invalid_response", "The network scanner helper returned invalid scan data.");
  }
  const devices = value.devices.map((device) => parseDevice(device, route));
  if (devices.some((device) => device === undefined) || value.host_count !== devices.length) {
    throw new ScannerHelperError("invalid_response", "The network scanner helper returned invalid device data.");
  }
  return { ...value, route, devices: devices as ScannerDevice[] } as unknown as ScannerSuccess;
}

export function buildScannerHelperArguments(
  runtime: PythonRuntime,
  helperPath: string,
  subnet: string,
): string[] {
  return [
    ...runtime.prefixArguments,
    helperPath,
    "scan-network",
    "--subnet",
    subnet,
    "--arp-timeout",
    String(SCANNER_ARP_TIMEOUT_SECONDS),
    "--icmp-timeout",
    String(SCANNER_ICMP_TIMEOUT_SECONDS),
    "--dns-workers",
    String(SCANNER_DNS_WORKERS),
  ];
}

export interface RunScannerHelperOptions {
  runtime: PythonRuntime;
  helperPath: string;
  subnet: string;
  cancellation?: CancellationLike;
  maximumRuntimeMs?: number;
  spawnProcess?: typeof spawn;
}

export async function runScannerHelper(options: RunScannerHelperOptions): Promise<string> {
  if (options.cancellation?.isCancellationRequested) {
    throw new ScannerHelperError("cancelled", "Network scan was cancelled.");
  }

  return new Promise<string>((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = (options.spawnProcess ?? spawn)(
        options.runtime.executable,
        buildScannerHelperArguments(options.runtime, options.helperPath, options.subnet),
        { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
      ) as unknown as ChildProcessWithoutNullStreams;
    } catch (error) {
      reject(
        new ScannerHelperError(
          "helper_start_failed",
          `Unable to start the network scanner helper: ${error instanceof Error ? error.message : String(error)}`,
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
    let terminationError: ScannerHelperError | undefined;
    let cancellationSubscription: { dispose(): void } | undefined;

    const cleanup = (): void => {
      clearTimeout(timer);
      cancellationSubscription?.dispose();
      activeChildren.delete(child);
    };
    const finish = (error?: ScannerHelperError): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      error ? reject(error) : resolve(stdout.trim());
    };
    const terminate = (error: ScannerHelperError): void => {
      terminationError ??= error;
      child.kill();
    };
    const timer = setTimeout(
      () => terminate(new ScannerHelperError("helper_timeout", "The network scan exceeded its 30-second limit.")),
      options.maximumRuntimeMs ?? SCANNER_MAXIMUM_RUNTIME_MS,
    );
    cancellationSubscription = options.cancellation?.onCancellationRequested(() =>
      terminate(new ScannerHelperError("cancelled", "Network scan was cancelled.")),
    );

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > MAX_STDOUT_BYTES) {
        terminate(new ScannerHelperError("helper_output_limit", "The network scanner helper returned too much data."));
      }
    });
    child.stderr.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr) < MAX_STDERR_BYTES) {
        stderr += chunk;
      }
    });
    child.on("error", (error) =>
      terminate(new ScannerHelperError("helper_start_failed", `Unable to start the network scanner helper: ${error.message}`)),
    );
    child.on("close", (code) => {
      if (terminationError) {
        finish(terminationError);
      } else if (!stdout.trim()) {
        finish(
          new ScannerHelperError(
            "helper_failed",
            `The network scanner helper exited without JSON${code ? ` (code ${code})` : ""}.${stderr.trim() ? ` ${stderr.trim()}` : ""}`,
          ),
        );
      } else {
        finish();
      }
    });
  });
}

export async function scanNetwork(
  runtime: PythonRuntime,
  helperPath: string,
  subnet: string,
  cancellation?: CancellationLike,
  spawnProcess?: typeof spawn,
): Promise<ScannerResponse> {
  return parseScannerJson(
    await runScannerHelper({ runtime, helperPath, subnet, cancellation, spawnProcess }),
  );
}

export function disposeActiveScannerHelpers(): void {
  for (const child of activeChildren) {
    child.kill();
  }
  activeChildren.clear();
}
