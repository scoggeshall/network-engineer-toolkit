import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DnsValidationError, normalizeDnsQuery } from "../src/local/dns/query";

describe("normalizeDnsQuery", () => {
  it("trims a valid hostname", () => {
    assert.equal(normalizeDnsQuery("  router.example.test  "), "router.example.test");
  });

  it("accepts IPv4 and IPv6 addresses", () => {
    assert.equal(normalizeDnsQuery("192.0.2.10"), "192.0.2.10");
    assert.equal(normalizeDnsQuery("2001:db8::10"), "2001:db8::10");
  });

  for (const query of ["", "bad host", "https://example.test", "bad\u0000host", "a".repeat(254)]) {
    it(`rejects an invalid query: ${JSON.stringify(query)}`, () => {
      assert.throws(() => normalizeDnsQuery(query), DnsValidationError);
    });
  }
});
