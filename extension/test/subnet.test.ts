import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeSubnet,
  SubnetValidationError,
} from "../src/local/subnet";

describe("analyzeSubnet", () => {
  it("analyzes a standard /24 while preserving the host address", () => {
    const result = analyzeSubnet("192.168.1.10/24");

    assert.equal(result.address, "192.168.1.10");
    assert.equal(result.networkAddress, "192.168.1.0");
    assert.equal(result.broadcastAddress, "192.168.1.255");
    assert.equal(result.subnetMask, "255.255.255.0");
    assert.equal(result.wildcardMask, "0.0.0.255");
    assert.equal(result.firstUsable, "192.168.1.1");
    assert.equal(result.lastUsable, "192.168.1.254");
    assert.equal(result.totalAddresses, 256);
    assert.equal(result.usableHosts, 254);
  });

  it("analyzes the design example /27", () => {
    const result = analyzeSubnet("10.40.52.17/27");

    assert.equal(result.address, "10.40.52.17");
    assert.equal(result.prefixLength, 27);
    assert.equal(result.networkAddress, "10.40.52.0");
    assert.equal(result.broadcastAddress, "10.40.52.31");
    assert.equal(result.subnetMask, "255.255.255.224");
    assert.equal(result.wildcardMask, "0.0.0.31");
    assert.equal(result.firstUsable, "10.40.52.1");
    assert.equal(result.lastUsable, "10.40.52.30");
    assert.equal(result.totalAddresses, 32);
    assert.equal(result.usableHosts, 30);
  });

  it("analyzes a conventional /30", () => {
    const result = analyzeSubnet("10.0.0.5/30");

    assert.equal(result.networkAddress, "10.0.0.4");
    assert.equal(result.broadcastAddress, "10.0.0.7");
    assert.equal(result.firstUsable, "10.0.0.5");
    assert.equal(result.lastUsable, "10.0.0.6");
    assert.equal(result.totalAddresses, 4);
    assert.equal(result.usableHosts, 2);
  });

  it("uses point-to-point semantics for /31", () => {
    const result = analyzeSubnet("192.168.1.0/31");

    assert.equal(result.networkAddress, "192.168.1.0");
    assert.equal(result.broadcastBoundary, "192.168.1.1");
    assert.equal(result.broadcastAddress, null);
    assert.equal(result.broadcastDescription, "N/A (/31 point-to-point)");
    assert.equal(result.firstUsable, "192.168.1.0");
    assert.equal(result.lastUsable, "192.168.1.1");
    assert.equal(result.totalAddresses, 2);
    assert.equal(result.usableHosts, 2);
  });

  it("uses host-route semantics for /32", () => {
    const result = analyzeSubnet("192.0.2.10/32");

    assert.equal(result.networkAddress, "192.0.2.10");
    assert.equal(result.broadcastBoundary, "192.0.2.10");
    assert.equal(result.broadcastAddress, null);
    assert.equal(result.broadcastDescription, "N/A (/32 host route)");
    assert.equal(result.firstUsable, "192.0.2.10");
    assert.equal(result.lastUsable, "192.0.2.10");
    assert.equal(result.totalAddresses, 1);
    assert.equal(result.usableHosts, 1);
  });

  it("handles the complete IPv4 address space for /0", () => {
    const result = analyzeSubnet("0.0.0.0/0");

    assert.equal(result.networkAddress, "0.0.0.0");
    assert.equal(result.broadcastAddress, "255.255.255.255");
    assert.equal(result.subnetMask, "0.0.0.0");
    assert.equal(result.wildcardMask, "255.255.255.255");
    assert.equal(result.firstUsable, "0.0.0.1");
    assert.equal(result.lastUsable, "255.255.255.254");
    assert.equal(result.totalAddresses, 4_294_967_296);
    assert.equal(result.usableHosts, 4_294_967_294);
  });

  it("normalizes a non-zero host to full-space /0 boundaries", () => {
    const result = analyzeSubnet("203.0.113.45/0");

    assert.equal(result.address, "203.0.113.45");
    assert.equal(result.networkAddress, "0.0.0.0");
    assert.equal(result.broadcastAddress, "255.255.255.255");
  });

  it("treats a bare IPv4 address as /32", () => {
    const bare = analyzeSubnet(" 192.0.2.10 ");
    const explicit = analyzeSubnet("192.0.2.10/32");

    assert.equal(bare.input, "192.0.2.10");
    assert.equal(bare.prefixLength, 32);
    assert.deepEqual(
      { ...bare, input: explicit.input },
      explicit,
    );
  });

  it("handles IPv4 values with the high bit set", () => {
    const result = analyzeSubnet("200.10.20.30/24");

    assert.equal(result.address, "200.10.20.30");
    assert.equal(result.networkAddress, "200.10.20.0");
    assert.equal(result.broadcastAddress, "200.10.20.255");
    assert.equal(result.firstUsable, "200.10.20.1");
    assert.equal(result.lastUsable, "200.10.20.254");
  });

  const invalidInputs = [
    "999.1.1.1",
    "300.1.1.1/24",
    "10.1.1",
    "10.1.1/24",
    "10.1.1.1/33",
    "10.1.1.1/-1",
    "10.1.1.1/foo",
    "2001:db8::1/64",
  ];

  for (const input of invalidInputs) {
    it(`rejects invalid IPv4 input: ${input}`, () => {
      assert.throws(
        () => analyzeSubnet(input),
        (error: unknown) =>
          error instanceof SubnetValidationError &&
          error.message === `Invalid IPv4 address or CIDR: ${input}`,
      );
    });
  }
});
