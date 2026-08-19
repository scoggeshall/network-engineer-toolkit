import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ScannerSuccess } from "../src/local/scanner/models";
import { buildScannerTree, ScannerResultsStore } from "../src/local/scanner/treeModel";

function result(subnet: string, devices: ScannerSuccess["devices"]): ScannerSuccess {
  return {
    status: "success",
    subnet,
    host_count: devices.length,
    route: {
      mode: "direct",
      interface: "Ethernet 2",
      source_address: "192.168.137.20",
      gateway: null,
    },
    devices,
    duration_ms: 2000,
    discovery_source: "local-windows",
    discovery_engine: "Scapy/Npcap",
  };
}

describe("scanner Tree View model", () => {
  it("builds the subnet, device count, devices, and only available details", () => {
    const tree = buildScannerTree(result("192.168.137.0/24", [
      {
        ip: "192.168.137.2",
        hostname: "cbs250-lab01",
        mac_address: "8c:1e:80:72:51:26",
        vendor: null,
        discovery_methods: ["arp"],
        latency_ms: 1.2,
      },
      {
        ip: "192.168.137.10",
        hostname: null,
        mac_address: null,
        vendor: null,
        discovery_methods: ["icmp"],
        latency_ms: null,
      },
    ]));
    assert.equal(tree[0].label, "192.168.137.0/24");
    assert.equal(tree[0].children[0].label, "Devices (2)");
    const devices = tree[0].children[0].children;
    assert.equal(devices[0].description, "cbs250-lab01");
    assert.deepEqual(devices[0].children.map((item) => item.label), [
      "Hostname: cbs250-lab01",
      "MAC Address: 8c:1e:80:72:51:26",
      "Discovery: ARP",
      "Latency: 1.2 ms",
    ]);
    assert.equal(devices[1].description, undefined);
    assert.deepEqual(devices[1].children.map((item) => item.label), ["Discovery: ICMP"]);
  });

  it("replaces old scan state and clears results", () => {
    const store = new ScannerResultsStore();
    store.replace(result("192.168.1.0/24", []));
    assert.equal(store.getTree()[0].label, "192.168.1.0/24");
    store.replace(result("192.168.137.0/24", []));
    assert.equal(store.getTree()[0].label, "192.168.137.0/24");
    assert.equal(store.getTree().length, 1);
    store.clear();
    assert.deepEqual(store.getTree(), []);
  });
});
