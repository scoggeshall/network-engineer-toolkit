import { DiscoverySuccess } from "./models";

function row(label: string, value: string | null | undefined): string | undefined {
  return value ? `${label.padEnd(17)}${value}` : undefined;
}

export function formatSwitchportDiscovery(result: DiscoverySuccess): string {
  const lines = [
    "Switchport Discovery",
    "────────────────────────────────",
    "",
    row("Adapter:", result.adapter.description || result.adapter.name),
    row("Protocols:", result.protocols.join(", ")),
    row("Captured:", result.captured_at),
    "",
    row("Switch:", result.switch_name),
    row("Switch Port:", result.switch_port),
    row("Management IP:", result.management_address),
    "",
    row("Platform:", result.platform),
    row("Software:", result.software_version),
    row("Capabilities:", result.capabilities_raw),
    "",
    row("LLDP System:", result.lldp?.switch_name),
    row("LLDP Port ID:", result.lldp?.port_id),
    row("LLDP Port Desc:", result.lldp?.port_description),
    "",
    row("Capture Source:", "Local Windows NIC"),
  ];
  return lines.filter((line): line is string => line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
}
