import { isIP } from "node:net";
import { domainToASCII } from "node:url";

const MAX_DNS_QUERY_LENGTH = 253;
const HOST_LABEL = /^[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/;

export class DnsValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DnsValidationError";
  }
}

export function normalizeDnsQuery(value: string): string {
  const query = value.trim();
  if (query.length === 0) {
    throw new DnsValidationError("Enter a hostname or IP address.");
  }
  if (query.length > MAX_DNS_QUERY_LENGTH) {
    throw new DnsValidationError("DNS query is too long.");
  }
  if (/[\s\u0000-\u001f\u007f]/u.test(query)) {
    throw new DnsValidationError(
      "DNS query must not contain whitespace or control characters.",
    );
  }
  if (isIP(query) !== 0) {
    return query;
  }
  if (/[\/\\:?#@\[\]]/u.test(query)) {
    throw new DnsValidationError("Enter a valid hostname or IP address.");
  }

  const hostname = query.endsWith(".") ? query.slice(0, -1) : query;
  const asciiHostname = domainToASCII(hostname);
  if (
    asciiHostname.length === 0 ||
    asciiHostname.split(".").some((label) => !HOST_LABEL.test(label))
  ) {
    throw new DnsValidationError("Enter a valid hostname or IP address.");
  }
  return query;
}
