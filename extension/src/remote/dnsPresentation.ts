import { DnsLookupResponse } from "./backendClient";

export function formatDnsLookup(result: DnsLookupResponse): string {
  const lines = [
    "Remote DNS Lookup",
    "────────────────────────────────",
    "",
    formatLine("Query", result.query),
    formatLine(
      "Lookup Type",
      result.lookup_type === "forward" ? "Forward" : "Reverse",
    ),
    formatLine("Executed By", result.executed_by),
  ];

  if (result.lookup_type === "reverse") {
    lines.push(formatLine("Hostname", result.hostname ?? "N/A"));
    lines.push("", "Aliases:");
    lines.push(...formatValues(result.aliases));
  }

  lines.push("", "Addresses:");
  lines.push(...formatValues(result.addresses));
  return lines.join("\n");
}

function formatValues(values: readonly string[]): string[] {
  return values.length > 0 ? values.map((value) => `  ${value}`) : ["  (none)"];
}

function formatLine(label: string, value: string): string {
  return `${`${label}:`.padEnd(14)}${value}`;
}
