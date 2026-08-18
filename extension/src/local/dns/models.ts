export interface DnsLookupSuccess {
  status: "success";
  query: string;
  lookup_type: "forward" | "reverse";
  addresses: string[];
  hostname: string | null;
  aliases: string[];
  execution_source: "local-windows";
}

export interface DnsLookupFailure {
  status: "error" | "unavailable" | "timeout" | "cancelled";
  error_code?: string;
  message: string;
}

export type DnsLookupResponse = DnsLookupSuccess | DnsLookupFailure;
