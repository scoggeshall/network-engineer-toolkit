import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_SCAN_HOSTS,
  normalizeScanSubnet,
  ScannerValidationError,
} from "../src/local/scanner/subnet";

describe("normalizeScanSubnet", () => {
  it("normalizes a supported /24 to its network boundary", () => {
    assert.deepEqual(normalizeScanSubnet(" 192.168.137.20/24 "), {
      cidr: "192.168.137.0/24",
      hostCount: 254,
    });
  });

  it("requires explicit CIDR notation", () => {
    assert.throws(
      () => normalizeScanSubnet("192.168.137.20"),
      (error: unknown) => error instanceof ScannerValidationError && /CIDR notation/.test(error.message),
    );
  });

  it("rejects a subnet above the host limit without truncating it", () => {
    assert.equal(MAX_SCAN_HOSTS, 254);
    assert.throws(() => normalizeScanSubnet("10.0.0.0/8"), /at most 254 hosts/);
  });

  it("preserves /31 and /32 host semantics", () => {
    assert.equal(normalizeScanSubnet("192.0.2.0/31").hostCount, 2);
    assert.equal(normalizeScanSubnet("192.0.2.8/32").hostCount, 1);
  });
});
