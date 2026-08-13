import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DiscoverySuccess } from "../src/local/switchport/models";
import { formatSwitchportDiscovery } from "../src/local/switchport/presentation";

const base: DiscoverySuccess = {
  status: "success",
  adapter: {
    id: "capture",
    name: "Ethernet",
    description: "Realtek PCIe GbE Family Controller",
    guid: "realtek",
    status: "up",
    mac_address: "04-BF-1B-DA-CE-C0",
    link_speed: "1 Gbps",
    kind: "ethernet",
    is_up: true,
    confidence: 100,
    reason: "Ethernet adapter is up",
  },
  protocols: ["CDP", "LLDP"],
  switch_name: "8c1e80725126",
  switch_port: "gi1",
  management_address: "192.168.1.2",
  platform: "Cisco CBS250-8T-D (PID:CBS250-8T-D)-VSD",
  software_version: "3.5.3.2",
  capabilities_raw: "0x00000029",
  captured_at: "2026-08-13T07:00:00-04:00",
  lldp: {
    source_mac: "8c:1e:80:72:51:27",
    captured_at: "2026-08-13T07:00:00-04:00",
    switch_name: "sean-switch",
    port_id: "8c:1e:80:72:51:27",
  },
  cdp: null,
  additional_advertisements: [],
  correlation: "confident",
  capture_source: "local-windows",
  capture_engine: "Scapy/Npcap",
};

describe("switchport presentation", () => {
  it("formats the correlated lab result", () => {
    const output = formatSwitchportDiscovery(base);
    assert.match(output, /Adapter:\s+Realtek PCIe GbE Family Controller/);
    assert.match(output, /Protocols:\s+CDP, LLDP/);
    assert.match(output, /Switch Port:\s+gi1/);
    assert.match(output, /Management IP:\s+192\.168\.1\.2/);
    assert.match(output, /LLDP System:\s+sean-switch/);
    assert.match(output, /Capture Source:\s+Local Windows NIC/);
  });

  it("omits empty optional LLDP fields", () => {
    const output = formatSwitchportDiscovery({ ...base, protocols: ["CDP"], lldp: null });
    assert.doesNotMatch(output, /LLDP System:/);
  });

  it("formats LLDP-only output", () => {
    const output = formatSwitchportDiscovery({
      ...base,
      protocols: ["LLDP"],
      switch_name: "sean-switch",
      switch_port: "8c:1e:80:72:51:27",
      management_address: null,
      platform: null,
      software_version: null,
      capabilities_raw: null,
    });
    assert.match(output, /Protocols:\s+LLDP/);
    assert.doesNotMatch(output, /Management IP:/);
  });
});
