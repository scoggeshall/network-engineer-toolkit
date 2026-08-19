export type ScannerDiscoveryMethod = "arp" | "icmp" | "local-interface";

export interface ScannerRoute {
  mode: "direct" | "routed";
  interface: string;
  source_address: string;
  gateway: string | null;
}

export interface ScannerDevice {
  ip: string;
  hostname: string | null;
  mac_address: string | null;
  vendor: string | null;
  discovery_methods: ScannerDiscoveryMethod[];
  latency_ms: number | null;
}

export interface ScannerSuccess {
  status: "success";
  subnet: string;
  host_count: number;
  route: ScannerRoute;
  devices: ScannerDevice[];
  duration_ms: number;
  discovery_source: "local-windows";
  discovery_engine: "Scapy/Npcap";
}

export interface ScannerFailure {
  status: "unavailable" | "error" | "timeout" | "cancelled";
  error_code?: string;
  message: string;
}

export type ScannerResponse = ScannerSuccess | ScannerFailure;
