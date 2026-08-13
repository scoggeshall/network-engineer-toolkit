import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BackendClient,
  BackendConfigurationError,
  BackendHttpError,
  BackendTimeoutError,
  BackendUnavailableError,
  FetchImplementation,
  MalformedBackendResponseError,
  normalizeBackendUrl,
} from "../src/remote/backendClient";

const forwardResponse = {
  query: "example.test",
  lookup_type: "forward" as const,
  addresses: ["192.0.2.10", "2001:db8::10"],
  hostname: null,
  aliases: [],
  executed_by: "ubuntu-test",
};

describe("BackendClient", () => {
  it("normalizes trailing slashes", () => {
    assert.equal(
      normalizeBackendUrl("  http://lab.example:8000///  "),
      "http://lab.example:8000",
    );
  });

  it("rejects a missing backend URL", () => {
    assert.throws(
      () => normalizeBackendUrl("   "),
      (error: unknown) =>
        error instanceof BackendConfigurationError &&
        error.message.includes("backend URL is not configured"),
    );
  });

  it("uses the DNS endpoint and URL-encodes the query", async () => {
    let requestedUrl = "";
    const fetchImplementation: FetchImplementation = async (input) => {
      requestedUrl = input;
      return jsonResponse(200, forwardResponse);
    };

    await new BackendClient("http://lab.example:8000/", {
      fetchImplementation,
    }).lookupDns("router name&site");

    const parsed = new URL(requestedUrl);
    assert.equal(parsed.pathname, "/api/v1/dns/lookup");
    assert.equal(parsed.searchParams.get("query"), "router name&site");
    assert.match(requestedUrl, /query=router\+name%26site/);
  });

  it("parses a forward response and preserves executed_by", async () => {
    const client = clientReturning(forwardResponse);

    const result = await client.lookupDns("example.test");

    assert.deepEqual(result, forwardResponse);
    assert.equal(result.executed_by, "ubuntu-test");
  });

  it("parses a reverse response", async () => {
    const response = {
      query: "192.0.2.10",
      lookup_type: "reverse" as const,
      addresses: ["192.0.2.10"],
      hostname: "router.example.test",
      aliases: ["router"],
      executed_by: "ubuntu-test",
    };

    assert.deepEqual(
      await clientReturning(response).lookupDns("192.0.2.10"),
      response,
    );
  });

  it("returns structured non-2xx errors", async () => {
    const client = clientWithFetch(async () =>
      jsonResponse(404, {
        detail: { code: "lookup_failed", message: "No DNS result." },
      }),
    );

    await assert.rejects(
      () => client.lookupDns("missing.test"),
      (error: unknown) =>
        error instanceof BackendHttpError &&
        error.status === 404 &&
        error.code === "lookup_failed" &&
        error.message === "No DNS result.",
    );
  });

  it("reports an unreachable backend", async () => {
    const client = clientWithFetch(async () => {
      throw new TypeError("connect failed");
    });

    await assert.rejects(
      () => client.lookupDns("example.test"),
      BackendUnavailableError,
    );
  });

  it("aborts and reports a client timeout", async () => {
    const fetchImplementation: FetchImplementation = async (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const client = new BackendClient("http://lab.example:8000", {
      fetchImplementation,
      timeoutMs: 1,
    });

    await assert.rejects(
      () => client.lookupDns("example.test"),
      BackendTimeoutError,
    );
  });

  it("keeps the timeout active while reading the response body", async () => {
    const fetchImplementation: FetchImplementation = async (_input, init) => ({
      ok: true,
      status: 200,
      json: async () =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });
    const client = new BackendClient("http://lab.example:8000", {
      fetchImplementation,
      timeoutMs: 1,
    });

    await assert.rejects(
      () => client.lookupDns("example.test"),
      BackendTimeoutError,
    );
  });

  it("rejects malformed successful responses", async () => {
    const client = clientReturning({
      query: "example.test",
      addresses: ["192.0.2.10"],
      executed_by: "ubuntu-test",
    });

    await assert.rejects(
      () => client.lookupDns("example.test"),
      MalformedBackendResponseError,
    );
  });

  it("rejects non-JSON successful responses", async () => {
    const client = clientWithFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("invalid JSON");
      },
    }));

    await assert.rejects(
      () => client.lookupDns("example.test"),
      MalformedBackendResponseError,
    );
  });
});

function clientReturning(body: unknown): BackendClient {
  return clientWithFetch(async () => jsonResponse(200, body));
}

function clientWithFetch(fetchImplementation: FetchImplementation): BackendClient {
  return new BackendClient("http://lab.example:8000", { fetchImplementation });
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
