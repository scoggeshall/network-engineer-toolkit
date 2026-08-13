const DEFAULT_TIMEOUT_MS = 5_000;

export interface DnsLookupResponse {
  query: string;
  lookup_type: "forward" | "reverse";
  addresses: string[];
  hostname: string | null;
  aliases: string[];
  executed_by: string;
}

export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchImplementation = (
  input: string,
  init: { signal: AbortSignal },
) => Promise<HttpResponse>;

export interface BackendClientOptions {
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
}

export class BackendConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BackendConfigurationError";
  }
}

export class BackendUnavailableError extends Error {
  public constructor() {
    super("Unable to reach the Network Engineer Toolkit backend.");
    this.name = "BackendUnavailableError";
  }
}

export class BackendTimeoutError extends Error {
  public constructor() {
    super("The Network Engineer Toolkit backend request timed out.");
    this.name = "BackendTimeoutError";
  }
}

export class BackendHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "BackendHttpError";
  }
}

export class MalformedBackendResponseError extends Error {
  public constructor() {
    super("The Network Engineer Toolkit backend returned an invalid response.");
    this.name = "MalformedBackendResponseError";
  }
}

export class BackendClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly timeoutMs: number;

  public constructor(baseUrl: string, options: BackendClientOptions = {}) {
    this.baseUrl = normalizeBackendUrl(baseUrl);
    this.fetchImplementation =
      options.fetchImplementation ??
      ((input, init) => fetch(input, init) as Promise<HttpResponse>);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public async lookupDns(query: string): Promise<DnsLookupResponse> {
    const url = new URL(`${this.baseUrl}/api/v1/dns/lookup`);
    url.searchParams.set("query", query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let response: HttpResponse;
      try {
        response = await this.fetchImplementation(url.toString(), {
          signal: controller.signal,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          throw new BackendTimeoutError();
        }
        throw new BackendUnavailableError();
      }

      if (!response.ok) {
        throw await toHttpError(response, controller.signal);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (controller.signal.aborted) {
          throw new BackendTimeoutError();
        }
        throw new MalformedBackendResponseError();
      }

      if (!isDnsLookupResponse(body)) {
        throw new MalformedBackendResponseError();
      }
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function normalizeBackendUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BackendConfigurationError(
      "Network Engineer Toolkit backend URL is not configured. " +
        "Set networkEngineerToolkit.backendUrl before using remote tools.",
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BackendConfigurationError(
      "Network Engineer Toolkit backend URL is invalid.",
    );
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new BackendConfigurationError(
      "Network Engineer Toolkit backend URL must be an HTTP or HTTPS base URL.",
    );
  }

  return url.toString().replace(/\/+$/, "");
}

async function toHttpError(
  response: HttpResponse,
  signal: AbortSignal,
): Promise<BackendHttpError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (signal.aborted) {
      throw new BackendTimeoutError();
    }
    body = undefined;
  }

  const detail = getRecord(body)?.detail;
  const detailRecord = getRecord(detail);
  const code = typeof detailRecord?.code === "string" ? detailRecord.code : undefined;
  const message =
    typeof detailRecord?.message === "string"
      ? detailRecord.message
      : `Backend request failed with HTTP ${response.status}.`;
  return new BackendHttpError(response.status, code, message);
}

function isDnsLookupResponse(value: unknown): value is DnsLookupResponse {
  const body = getRecord(value);
  if (body === undefined) {
    return false;
  }

  const lookupType = body.lookup_type;
  const addresses = body.addresses;
  const aliases = body.aliases;
  const hostname = body.hostname;

  return (
    typeof body.query === "string" &&
    (lookupType === "forward" || lookupType === "reverse") &&
    Array.isArray(addresses) &&
    addresses.length > 0 &&
    addresses.every((address) => typeof address === "string") &&
    (hostname === null || typeof hostname === "string") &&
    Array.isArray(aliases) &&
    aliases.every((alias) => typeof alias === "string") &&
    typeof body.executed_by === "string" &&
    body.executed_by.length > 0 &&
    (lookupType !== "reverse" || (typeof hostname === "string" && hostname.length > 0))
  );
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
