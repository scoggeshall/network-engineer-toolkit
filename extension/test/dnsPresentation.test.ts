import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDnsLookup } from "../src/local/dns/presentation";

describe("formatDnsLookup", () => {
  it("makes the local Windows vantage point explicit", () => {
    const output = formatDnsLookup({
      status: "success",
      query: "example.test",
      lookup_type: "forward",
      addresses: ["192.0.2.10", "2001:db8::10"],
      hostname: null,
      aliases: [],
      execution_source: "local-windows",
    });

    assert.match(output, /^Local DNS Lookup/m);
    assert.match(output, /Execution:\s+Local Windows workstation/);
    assert.match(output, /Addresses:\n  192\.0\.2\.10\n  2001:db8::10/);
  });

  it("formats a reverse result with hostname, aliases, and addresses", () => {
    const output = formatDnsLookup({
      status: "success",
      query: "192.0.2.10",
      lookup_type: "reverse",
      addresses: ["192.0.2.10"],
      hostname: "router.example.test",
      aliases: ["router"],
      execution_source: "local-windows",
    });

    assert.match(output, /Lookup Type:  Reverse/);
    assert.match(output, /Hostname:     router\.example\.test/);
    assert.match(output, /Aliases:\n  router/);
    assert.match(output, /Addresses:\n  192\.0\.2\.10/);
  });
});
