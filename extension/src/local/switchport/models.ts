export interface CaptureAdapter {
  id: string;
  name: string;
  description: string;
  guid: string;
  status: string;
  mac_address: string;
  link_speed: string;
  kind: "ethernet" | "wifi" | "other";
  is_up: boolean | null;
  confidence: number;
  reason: string;
}

export interface ProtocolEvidence {
  source_mac: string;
  captured_at: string;
  switch_name?: string;
  switch_port?: string;
  management_address?: string;
  chassis_id?: string;
  port_id?: string;
  port_description?: string;
  system_description?: string;
  platform?: string;
  software_version?: string;
  capabilities_raw?: string;
}

export interface DiscoverySuccess {
  status: "success";
  adapter: CaptureAdapter;
  protocols: Array<"CDP" | "LLDP">;
  switch_name?: string | null;
  switch_port?: string | null;
  management_address?: string | null;
  platform?: string | null;
  software_version?: string | null;
  capabilities_raw?: string | null;
  captured_at: string;
  lldp?: ProtocolEvidence | null;
  cdp?: ProtocolEvidence | null;
  additional_advertisements: ProtocolEvidence[];
  correlation: "confident" | "single-protocol";
  capture_source: "local-windows";
  capture_engine: "Scapy/Npcap";
}

export interface HelperFailure {
  status: "unavailable" | "timeout" | "error" | "cancelled";
  error_code?: string;
  message: string;
}

export interface AdapterListSuccess {
  status: "success";
  adapters: CaptureAdapter[];
}

export type DiscoveryResponse = DiscoverySuccess | HelperFailure;
export type AdapterListResponse = AdapterListSuccess | HelperFailure;
