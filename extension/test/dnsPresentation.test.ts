import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDnsLookup } from "../src/remote/dnsPresentation";

describe("formatDnsLookup", () => {
  it("formats a forward result with its remote execution host", () => {
    const output = formatDnsLookup({
      query: "example.test",
      lookup_type: "forward",
      addresses: ["192.0.2.10", "2001:db8::10"],
      hostname: null,
      aliases: [],
      executed_by: "ubuntu-test",
    });

    assert.equal(
      output,
      [
        "Remote DNS Lookup",
        "────────────────────────────────",
        "",
        "Query:        example.test",
        "Lookup Type:  Forward",
        "Executed By:  ubuntu-test",
        "",
        "Addresses:",
        "  192.0.2.10",
        "  2001:db8::10",
      ].join("\n"),
    );
  });

  it("formats a reverse result with hostname, aliases, and addresses", () => {
    const output = formatDnsLookup({
      query: "192.0.2.10",
      lookup_type: "reverse",
      addresses: ["192.0.2.10"],
      hostname: "router.example.test",
      aliases: ["router"],
      executed_by: "ubuntu-test",
    });

    assert.match(output, /Lookup Type:  Reverse/);
    assert.match(output, /Executed By:  ubuntu-test/);
    assert.match(output, /Hostname:     router\.example\.test/);
    assert.match(output, /Aliases:\n  router/);
    assert.match(output, /Addresses:\n  192\.0\.2\.10/);
  });
});
