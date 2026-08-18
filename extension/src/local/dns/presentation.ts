import { DnsLookupSuccess } from "./models";

export function formatDnsLookup(result: DnsLookupSuccess): string {
  const lines = [
    "Local DNS Lookup",
    "────────────────────────────────",
    "",
    formatLine("Query", result.query),
    formatLine(
      "Lookup Type",
      result.lookup_type === "forward" ? "Forward" : "Reverse",
    ),
    formatLine("Execution", "Local Windows workstation"),
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
