import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHelperArguments,
  HelperClientError,
  parseAdapterListJson,
  parseDiscoveryJson,
  resolvePythonRuntime,
  runHelper,
} from "../src/local/switchport/helperClient";

const adapter = {
  id: "\\Device\\NPF_{REALTEK}",
  name: "Ethernet",
  description: "Realtek PCIe GbE Family Controller",
  guid: "realtek",
  status: "up",
  mac_address: "04-BF-1B-DA-CE-C0",
  link_speed: "1 Gbps",
  kind: "ethernet",
  is_up: true,
  confidence: 100,
  reason: "Ethernet adapter is up",
};

const success = {
  status: "success",
  adapter,
  protocols: ["CDP", "LLDP"],
  switch_name: "device",
  switch_port: "gi1",
  management_address: "192.168.1.2",
  captured_at: "2026-08-13T07:00:00-04:00",
  lldp: null,
  cdp: null,
  additional_advertisements: [],
  correlation: "confident",
  capture_source: "local-windows",
  capture_engine: "Scapy/Npcap",
};

class FakeChild extends EventEmitter {
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public killed = false;

  public kill(): boolean {
    if (this.killed) {
      return false;
    }
    this.killed = true;
    setImmediate(() => this.emit("close", null));
    return true;
  }
}

function fakeSpawn(
  setup: (child: FakeChild, executable: string, arguments_: readonly string[]) => void,
): typeof import("node:child_process").spawn {
  return ((executable: string, arguments_: readonly string[]) => {
    const child = new FakeChild();
    setImmediate(() => setup(child, executable, arguments_));
    return child;
  }) as unknown as typeof import("node:child_process").spawn;
}

describe("switchport helper contract", () => {
  it("builds only the fixed list-adapters operation", () => {
    assert.deepEqual(
      buildHelperArguments({ executable: "py", prefixArguments: ["-3"] }, "main.py", "list-adapters"),
      ["-3", "main.py", "list-adapters"],
    );
  });

  it("passes an opaque adapter ID as one argument", () => {
    const args = buildHelperArguments(
      { executable: "python", prefixArguments: [] },
      "main.py",
      "discover-switchport",
      { adapterId: adapter.id, timeoutSeconds: 45, graceSeconds: 12 },
    );
    assert.equal(args[args.indexOf("--adapter") + 1], adapter.id);
  });

  it("parses adapter JSON", () => {
    const parsed = parseAdapterListJson(JSON.stringify({ status: "success", adapters: [adapter] }));
    assert.equal(parsed.status, "success");
    if (parsed.status === "success") {
      assert.equal(parsed.adapters[0].description, "Realtek PCIe GbE Family Controller");
    }
  });

  it("parses discovery success JSON", () => {
    const parsed = parseDiscoveryJson(JSON.stringify(success));
    assert.equal(parsed.status, "success");
    if (parsed.status === "success") {
      assert.equal(parsed.switch_port, "gi1");
    }
  });

  it("parses structured unavailable JSON", () => {
    assert.deepEqual(
      parseDiscoveryJson(
        JSON.stringify({ status: "unavailable", error_code: "scapy_missing", message: "Scapy is not available." }),
      ),
      { status: "unavailable", error_code: "scapy_missing", message: "Scapy is not available." },
    );
  });

  it("rejects malformed JSON", () => {
    assert.throws(() => parseDiscoveryJson("not-json"), /malformed JSON/);
  });

  it("rejects structurally invalid success JSON", () => {
    assert.throws(() => parseDiscoveryJson(JSON.stringify({ status: "success" })), /invalid discovery data/);
  });
});

describe("Python runtime discovery", () => {
  it("uses a configured Python executable first", async () => {
    const calls: string[] = [];
    const runtime = await resolvePythonRuntime("C:\\Python\\python.exe", async (executable) => {
      calls.push(executable);
    });
    assert.equal(runtime.executable, "C:\\Python\\python.exe");
    assert.deepEqual(calls, ["C:\\Python\\python.exe"]);
  });

  it("falls back from py to python", async () => {
    const runtime = await resolvePythonRuntime(undefined, async (executable) => {
      if (executable === "py") {
        throw new Error("missing");
      }
    });
    assert.equal(runtime.executable, "python");
  });

  it("reports missing Python", async () => {
    await assert.rejects(
      resolvePythonRuntime(undefined, async () => {
        throw new Error("missing");
      }),
      (error: unknown) => error instanceof HelperClientError && error.code === "python_missing",
    );
  });
});

describe("helper child lifecycle", () => {
  const base = {
    runtime: { executable: "python", prefixArguments: [] },
    helperPath: "main.py",
    operation: "list-adapters" as const,
  };

  it("returns helper stdout even when a structured error uses non-zero exit", async () => {
    const output = JSON.stringify({ status: "unavailable", message: "Scapy missing" });
    const result = await runHelper({
      ...base,
      maximumRuntimeMs: 100,
      spawnProcess: fakeSpawn((child) => {
        child.stdout.write(output);
        child.emit("close", 2);
      }),
    });
    assert.equal(result, output);
  });

  it("reports non-zero exit without JSON", async () => {
    await assert.rejects(
      runHelper({
        ...base,
        maximumRuntimeMs: 100,
        spawnProcess: fakeSpawn((child) => {
          child.stderr.write("failed");
          child.emit("close", 2);
        }),
      }),
      /exited without JSON/,
    );
  });

  it("bounds helper runtime and kills its exact child", async () => {
    let child: FakeChild | undefined;
    await assert.rejects(
      runHelper({
        ...base,
        maximumRuntimeMs: 10,
        spawnProcess: fakeSpawn((process) => {
          child = process;
        }),
      }),
      /exceeded its time limit/,
    );
    assert.equal(child?.killed, true);
  });

  it("cancels and kills its exact child", async () => {
    let listener: (() => void) | undefined;
    let child: FakeChild | undefined;
    const promise = runHelper({
      ...base,
      maximumRuntimeMs: 100,
      cancellation: {
        isCancellationRequested: false,
        onCancellationRequested(callback) {
          listener = callback;
          return { dispose() {} };
        },
      },
      spawnProcess: fakeSpawn((process) => {
        child = process;
        listener?.();
      }),
    });
    await assert.rejects(promise, /cancelled/);
    assert.equal(child?.killed, true);
  });
});
