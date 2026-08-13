from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

HELPER = Path(__file__).resolve().parents[1] / "switchport"
sys.path.insert(0, str(HELPER))

from adapters import build_adapters, list_adapters, rank_adapter, resolve_adapter  # noqa: E402
from models import HelperError  # noqa: E402


SCAPY_INTERFACES = [
    {"network_name": r"\Device\NPF_{11111111-1111-1111-1111-111111111111}", "name": "Ethernet", "guid": "{11111111-1111-1111-1111-111111111111}"},
    {"network_name": r"\Device\NPF_{22222222-2222-2222-2222-222222222222}", "name": "Wi-Fi", "guid": "{22222222-2222-2222-2222-222222222222}"},
    {"network_name": r"\Device\NPF_Loopback", "name": "Loopback", "description": "Software Loopback"},
    {"network_name": r"\Device\NPF_{33333333-3333-3333-3333-333333333333}", "name": "vEthernet", "description": "Hyper-V Virtual Ethernet Adapter"},
]
WINDOWS_INTERFACES = [
    {"Name": "Ethernet", "InterfaceDescription": "Realtek PCIe GbE Family Controller", "InterfaceGuid": "{11111111-1111-1111-1111-111111111111}", "Status": "Up", "MacAddress": "00-11-22-33-44-55", "LinkSpeed": "1 Gbps"},
    {"Name": "Wi-Fi", "InterfaceDescription": "Wireless Adapter", "InterfaceGuid": "{22222222-2222-2222-2222-222222222222}", "Status": "Up", "LinkSpeed": "400 Mbps"},
]


class AdapterTests(unittest.TestCase):
    def test_realtek_up_ethernet_is_first(self) -> None:
        adapters = build_adapters(SCAPY_INTERFACES, WINDOWS_INTERFACES)
        self.assertEqual(adapters[0].description, "Realtek PCIe GbE Family Controller")
        self.assertEqual(adapters[0].confidence, 100)

    def test_no_internet_inputs_affect_ranking(self) -> None:
        self.assertEqual(rank_adapter("ethernet", True), (100, "Ethernet adapter is up"))

    def test_up_ethernet_beats_up_wifi(self) -> None:
        self.assertGreater(rank_adapter("ethernet", True)[0], rank_adapter("wifi", True)[0])

    def test_loopback_and_virtual_are_excluded(self) -> None:
        self.assertEqual([item.name for item in build_adapters(SCAPY_INTERFACES, WINDOWS_INTERFACES)], ["Ethernet", "Wi-Fi"])

    def test_resolve_by_capture_id(self) -> None:
        adapters = build_adapters(SCAPY_INTERFACES, WINDOWS_INTERFACES)
        self.assertEqual(resolve_adapter(adapters[0].id, adapters).name, "Ethernet")

    def test_unknown_adapter_is_controlled(self) -> None:
        with self.assertRaisesRegex(HelperError, "unavailable"):
            resolve_adapter("missing", build_adapters(SCAPY_INTERFACES, WINDOWS_INTERFACES))

    def test_missing_scapy_is_controlled(self) -> None:
        original_import = __import__

        def missing_scapy(name: str, *args: object, **kwargs: object) -> object:
            if name == "scapy.all":
                raise ImportError("missing")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=missing_scapy):
            with self.assertRaisesRegex(HelperError, "Scapy is not available"):
                list_adapters(windows_interfaces=[])


if __name__ == "__main__":
    unittest.main()
