import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DnsValidationError,
  normalizeDnsQuery,
  resolveDnsCommandQuery,
} from "../src/local/dns/query";

describe("normalizeDnsQuery", () => {
  it("trims a valid hostname", () => {
    assert.equal(normalizeDnsQuery("  router.example.test  "), "router.example.test");
  });

  it("accepts IPv4 and IPv6 addresses", () => {
    assert.equal(normalizeDnsQuery("192.0.2.10"), "192.0.2.10");
    assert.equal(normalizeDnsQuery("2001:db8::10"), "2001:db8::10");
  });

  for (const query of [
    "",
    "bad host",
    "https://example.test",
    "10.150.76.1/24",
    "bad\u0000host",
    "a".repeat(254),
  ]) {
    it(`rejects an invalid query: ${JSON.stringify(query)}`, () => {
      assert.throws(() => normalizeDnsQuery(query), DnsValidationError);
    });
  }
});

describe("resolveDnsCommandQuery", () => {
  for (const selection of [
    "google.com",
    "8.8.8.8",
    "2001:4860:4860::8888",
  ]) {
    it(`uses a valid selection directly: ${selection}`, async () => {
      let prompted = false;
      const query = await resolveDnsCommandQuery(selection, async () => {
        prompted = true;
        return "example.com";
      });

      assert.equal(query, selection);
      assert.equal(prompted, false);
    });
  }

  for (const selection of [
    "10.150.76.1/24",
    "some random sentence selected in an editor",
    "first line\nsecond line",
    "a".repeat(254),
    "   \t ",
    "bad..hostname",
  ]) {
    it(`prompts instead of rejecting an unsuitable selection: ${JSON.stringify(selection)}`, async () => {
      let promptCount = 0;
      const query = await resolveDnsCommandQuery(selection, async () => {
        promptCount += 1;
        return "example.com";
      });

      assert.equal(query, "example.com");
      assert.equal(promptCount, 1);
    });
  }

  it("keeps consecutive invocations independent", async () => {
    const inputs = ["google.com", "example.com", "8.8.8.8"];
    const queries: string[] = [];

    for (const input of inputs) {
      const query = await resolveDnsCommandQuery(undefined, async () => input);
      if (query === undefined) {
        assert.fail("Expected a normalized DNS query.");
      }
      queries.push(query);
    }

    assert.deepEqual(queries, inputs);
  });

  it("still rejects an invalid query explicitly submitted through the prompt", async () => {
    await assert.rejects(
      resolveDnsCommandQuery("10.150.76.1/24", async () => "10.150.76.1/24"),
      DnsValidationError,
    );
  });
});
