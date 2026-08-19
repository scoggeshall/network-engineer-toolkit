import { ScannerDevice, ScannerSuccess } from "./models";

export type ScannerTreeNodeKind = "subnet" | "devices" | "device" | "detail";

export interface ScannerTreeNode {
  kind: ScannerTreeNodeKind;
  label: string;
  description?: string;
  children: ScannerTreeNode[];
}

function deviceDetails(device: ScannerDevice): ScannerTreeNode[] {
  const details: ScannerTreeNode[] = [];
  if (device.hostname) {
    details.push({ kind: "detail", label: `Hostname: ${device.hostname}`, children: [] });
  }
  if (device.mac_address) {
    details.push({ kind: "detail", label: `MAC Address: ${device.mac_address}`, children: [] });
  }
  if (device.vendor) {
    details.push({ kind: "detail", label: `Vendor: ${device.vendor}`, children: [] });
  }
  details.push({
    kind: "detail",
    label: `Discovery: ${device.discovery_methods.map((method) => method.toUpperCase()).join(", ")}`,
    children: [],
  });
  if (device.latency_ms !== null) {
    details.push({ kind: "detail", label: `Latency: ${device.latency_ms.toFixed(1)} ms`, children: [] });
  }
  return details;
}

export function buildScannerTree(result: ScannerSuccess): ScannerTreeNode[] {
  const devices = result.devices.map((device): ScannerTreeNode => ({
    kind: "device",
    label: device.ip,
    description: device.hostname ?? undefined,
    children: deviceDetails(device),
  }));
  return [{
    kind: "subnet",
    label: result.subnet,
    children: [{ kind: "devices", label: `Devices (${devices.length})`, children: devices }],
  }];
}

export class ScannerResultsStore {
  private result: ScannerSuccess | undefined;

  public replace(result: ScannerSuccess): void {
    this.result = result;
  }

  public clear(): void {
    this.result = undefined;
  }

  public getResult(): ScannerSuccess | undefined {
    return this.result;
  }

  public getTree(): ScannerTreeNode[] {
    return this.result ? buildScannerTree(this.result) : [];
  }
}
