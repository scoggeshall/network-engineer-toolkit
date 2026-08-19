import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildScannerHelperArguments,
  disposeActiveScannerHelpers,
  parseScannerJson,
  runScannerHelper,
} from "../src/local/scanner/helperClient";

const directRoute = {
  mode: "direct",
  interface: "\\Device\\NPF_{ETHERNET}",
  source_address: "192.168.137.20",
  gateway: null,
};

const device = {
  ip: "192.168.137.2",
  hostname: "cbs250-lab01",
  mac_address: "8c:1e:80:72:51:26",
  vendor: null,
  discovery_methods: ["arp"],
  latency_ms: 1.4,
};

function success(devices: object[] = [device], route: object = directRoute): object {
  return {
    status: "success",
    subnet: "192.168.137.0/24",
    host_count: devices.length,
    route,
    devices,
    duration_ms: 2150.5,
    discovery_source: "local-windows",
    discovery_engine: "Scapy/Npcap",
  };
}

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

describe("network scanner helper contract", () => {
  it("passes only the fixed scan operation and validated subnet argument", () => {
    const arguments_ = buildScannerHelperArguments(
      { executable: "py", prefixArguments: ["-3"] },
      "main.py",
      "192.168.137.0/24",
    );
    assert.deepEqual(arguments_.slice(0, 4), ["-3", "main.py", "scan-network", "--subnet"]);
    assert.equal(arguments_[4], "192.168.137.0/24");
  });

  it("parses an empty scan result", () => {
    const parsed = parseScannerJson(JSON.stringify(success([])));
    assert.equal(parsed.status, "success");
    if (parsed.status === "success") {
      assert.deepEqual(parsed.devices, []);
    }
  });

  it("parses one device with optional identity fields", () => {
    const parsed = parseScannerJson(JSON.stringify(success()));
    assert.equal(parsed.status, "success");
    if (parsed.status === "success") {
      assert.equal(parsed.devices[0].hostname, "cbs250-lab01");
      assert.equal(parsed.devices[0].mac_address, "8c:1e:80:72:51:26");
    }
  });

  it("parses multiple devices with missing hostname and MAC", () => {
    const second = {
      ip: "192.168.137.10",
      hostname: null,
      mac_address: null,
      vendor: null,
      discovery_methods: ["icmp"],
      latency_ms: null,
    };
    const parsed = parseScannerJson(JSON.stringify(success([device, second])));
    assert.equal(parsed.status, "success");
    if (parsed.status === "success") {
      assert.equal(parsed.devices.length, 2);
      assert.equal(parsed.devices[1].hostname, null);
      assert.equal(parsed.devices[1].mac_address, null);
    }
  });

  it("rejects malformed and structurally invalid output", () => {
    assert.throws(() => parseScannerJson("not-json"), /malformed JSON/);
    assert.throws(() => parseScannerJson(JSON.stringify({ status: "success" })), /invalid scan data/);
  });

  it("rejects a routed result that claims a remote MAC", () => {
    const routed = {
      mode: "routed",
      interface: "Wi-Fi",
      source_address: "192.168.1.146",
      gateway: "192.168.1.254",
    };
    assert.throws(() => parseScannerJson(JSON.stringify(success([device], routed))), /invalid device data/);
  });
});

describe("network scanner child lifecycle", () => {
  const base = {
    runtime: { executable: "python", prefixArguments: [] },
    helperPath: "main.py",
    subnet: "192.168.137.0/24",
  };

  it("returns structured stdout and removes the closed child from active ownership", async () => {
    let child: FakeChild | undefined;
    const output = JSON.stringify(success([]));
    const result = await runScannerHelper({
      ...base,
      spawnProcess: fakeSpawn((process) => {
        child = process;
        process.stdout.write(output);
        process.emit("close", 0);
      }),
    });
    assert.equal(result, output);
    disposeActiveScannerHelpers();
    assert.equal(child?.killed, false);
  });

  it("bounds runtime and kills its exact child before rejecting", async () => {
    let child: FakeChild | undefined;
    await assert.rejects(
      runScannerHelper({
        ...base,
        maximumRuntimeMs: 10,
        spawnProcess: fakeSpawn((process) => {
          child = process;
        }),
      }),
      /30-second limit/,
    );
    assert.equal(child?.killed, true);
  });

  it("cancels and kills its exact child before rejecting", async () => {
    let listener: (() => void) | undefined;
    let child: FakeChild | undefined;
    const result = runScannerHelper({
      ...base,
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
    await assert.rejects(result, /cancelled/);
    assert.equal(child?.killed, true);
  });
});
