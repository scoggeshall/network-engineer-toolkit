import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDnsHelperArguments,
  disposeActiveDnsHelpers,
  DnsHelperError,
  parseDnsLookupJson,
  runDnsHelper,
} from "../src/local/dns/helperClient";

const success = {
  status: "success",
  query: "example.test",
  lookup_type: "forward",
  addresses: ["192.0.2.10", "2001:db8::10"],
  hostname: null,
  aliases: [],
  execution_source: "local-windows",
};

class FakeChild extends EventEmitter {
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public killed = false;
  public killCalls = 0;

  public constructor(private readonly closeOnKill = true) {
    super();
  }

  public kill(): boolean {
    this.killCalls += 1;
    if (this.killed) {
      return false;
    }
    this.killed = true;
    if (this.closeOnKill) {
      setImmediate(() => this.emit("close", null));
    }
    return true;
  }
}

function fakeSpawn(
  setup: (child: FakeChild, executable: string, arguments_: readonly string[]) => void,
  closeOnKill = true,
): typeof import("node:child_process").spawn {
  return ((executable: string, arguments_: readonly string[]) => {
    const child = new FakeChild(closeOnKill);
    setImmediate(() => setup(child, executable, arguments_));
    return child;
  }) as unknown as typeof import("node:child_process").spawn;
}

describe("local DNS helper contract", () => {
  it("passes the query as one opaque argument without a shell", () => {
    const query = "router; Write-Output unsafe";
    const arguments_ = buildDnsHelperArguments("C:\\toolkit\\dns\\main.ps1", query);
    assert.deepEqual(arguments_, [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-File",
      "C:\\toolkit\\dns\\main.ps1",
      "-Query",
      query,
    ]);
  });

  it("parses a local forward result", () => {
    assert.deepEqual(parseDnsLookupJson(JSON.stringify(success)), success);
  });

  it("parses a structured lookup failure", () => {
    assert.deepEqual(
      parseDnsLookupJson(
        JSON.stringify({ status: "error", error_code: "lookup_failed", message: "No result." }),
      ),
      { status: "error", error_code: "lookup_failed", message: "No result." },
    );
  });

  it("rejects malformed and structurally invalid output", () => {
    assert.throws(() => parseDnsLookupJson("not-json"), /malformed JSON/);
    assert.throws(
      () => parseDnsLookupJson(JSON.stringify({ status: "success" })),
      /invalid lookup data/,
    );
  });
});

describe("local DNS helper lifecycle", () => {
  const base = { helperPath: "main.ps1", query: "example.test" };

  it("returns structured JSON even when the helper uses a non-zero exit", async () => {
    const output = JSON.stringify({ status: "error", message: "No result." });
    assert.equal(
      await runDnsHelper({
        ...base,
        spawnProcess: fakeSpawn((child) => {
          child.stdout.write(output);
          child.emit("close", 2);
        }),
      }),
      output,
    );
  });

  it("retains timeout ownership until the exact child closes", async () => {
    let child: FakeChild | undefined;
    let settlementCount = 0;
    const promise = runDnsHelper({
      ...base,
      maximumRuntimeMs: 10,
      spawnProcess: fakeSpawn((process) => {
        child = process;
      }, false),
    });
    const outcome = promise.then(
      (value) => {
        settlementCount += 1;
        return { value, error: undefined };
      },
      (error: unknown) => {
        settlementCount += 1;
        return { value: undefined, error };
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.ok(child);
    assert.equal(child?.killed, true);
    assert.equal(child?.killCalls, 1);
    assert.equal(settlementCount, 0);

    disposeActiveDnsHelpers();
    assert.equal(child?.killCalls, 2);
    disposeActiveDnsHelpers();
    assert.equal(child?.killCalls, 3);

    child?.stdout.write(`${JSON.stringify(success)}\nlate output`);
    child?.stderr.write("late diagnostic");
    child?.emit("close", null);

    const result = await outcome;
    assert.equal(result.value, undefined);
    assert.ok(result.error instanceof DnsHelperError);
    assert.equal(result.error.code, "helper_timeout");
    assert.equal(settlementCount, 1);

    child?.emit("close", null);
    disposeActiveDnsHelpers();
    assert.equal(child?.killCalls, 3);
    assert.equal(settlementCount, 1);
  });

  it("cancels and kills its exact child", async () => {
    let listener: (() => void) | undefined;
    let child: FakeChild | undefined;
    const promise = runDnsHelper({
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
    await assert.rejects(
      promise,
      (error: unknown) => error instanceof DnsHelperError && error.code === "cancelled",
    );
    assert.equal(child?.killed, true);
  });
});
