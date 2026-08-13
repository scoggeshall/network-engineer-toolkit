from __future__ import annotations

import sys
import unittest
from pathlib import Path

HELPER = Path(__file__).resolve().parents[1] / "switchport"
sys.path.insert(0, str(HELPER))

from correlate import advertisements_match, normalize_result  # noqa: E402
from models import CaptureAdapter, DiscoveryAdvertisement  # noqa: E402


ADAPTER = CaptureAdapter(id="capture", name="Ethernet", description="Realtek", is_up=True)


def advertisement(protocol: str, **values: object) -> DiscoveryAdvertisement:
    defaults = {"protocol": protocol, "source_mac": "00:11:22:33:44:55", "captured_at": "2026-08-13T07:00:00-04:00"}
    defaults.update(values)
    return DiscoveryAdvertisement(**defaults)


class CorrelationTests(unittest.TestCase):
    def test_same_source_mac_correlates_different_names(self) -> None:
        lldp = advertisement("LLDP", switch_name="sean-switch")
        cdp = advertisement("CDP", switch_name="8c1e80725126")
        self.assertTrue(advertisements_match(lldp, cdp))

    def test_different_source_macs_do_not_correlate(self) -> None:
        lldp = advertisement("LLDP")
        cdp = advertisement("CDP", source_mac="66:77:88:99:aa:bb")
        self.assertFalse(advertisements_match(lldp, cdp))

    def test_management_address_fallback(self) -> None:
        lldp = advertisement("LLDP", source_mac="", management_address="10.0.0.1")
        cdp = advertisement("CDP", source_mac="", management_address="10.0.0.1")
        self.assertTrue(advertisements_match(lldp, cdp))

    def test_rich_cdp_merges_partial_lldp(self) -> None:
        lldp = advertisement("LLDP", switch_name="sean-switch", port_id="00:11:22:33:44:56")
        cdp = advertisement("CDP", switch_name="device", switch_port="gi1", management_address="192.168.1.2", platform="CBS250", software_version="3.5.3.2")
        result = normalize_result(ADAPTER, [lldp, cdp])
        self.assertEqual(result["switch_port"], "gi1")
        self.assertEqual(result["lldp"]["switch_name"], "sean-switch")

    def test_rich_lldp_beats_partial_cdp(self) -> None:
        lldp = advertisement("LLDP", switch_name="switch", switch_port="Gi7", management_address="10.0.0.7", system_description="rich")
        cdp = advertisement("CDP", switch_name="device")
        result = normalize_result(ADAPTER, [lldp, cdp])
        self.assertEqual(result["switch_port"], "Gi7")
        self.assertEqual(result["management_address"], "10.0.0.7")

    def test_lldp_only(self) -> None:
        result = normalize_result(ADAPTER, [advertisement("LLDP", switch_port="Gi1")])
        self.assertEqual(result["protocols"], ["LLDP"])

    def test_cdp_only(self) -> None:
        result = normalize_result(ADAPTER, [advertisement("CDP", switch_port="Gi1")])
        self.assertEqual(result["protocols"], ["CDP"])

    def test_uncertain_advertisement_remains_additional(self) -> None:
        lldp = advertisement("LLDP", switch_port="Gi1")
        cdp = advertisement("CDP", source_mac="66:77:88:99:aa:bb", switch_port="Gi2")
        result = normalize_result(ADAPTER, [lldp, cdp])
        self.assertEqual(len(result["additional_advertisements"]), 1)
        self.assertEqual(result["correlation"], "single-protocol")


if __name__ == "__main__":
    unittest.main()
