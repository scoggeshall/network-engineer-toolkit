from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCANNER_ROOT = Path(__file__).resolve().parents[1] / "scanner"
sys.path.insert(0, str(SCANNER_ROOT))

from models import Device, RouteInfo, ScanResult  # noqa: E402


class ScannerModelTests(unittest.TestCase):
    def test_serializes_optional_fields_without_fabricating_values(self) -> None:
        result = ScanResult(
            subnet="192.168.137.0/24",
            route=RouteInfo(
                mode="direct",
                interface="Ethernet 2",
                source_address="192.168.137.20",
                gateway=None,
            ),
            devices=(Device(ip="192.168.137.50", discovery_methods=("arp",)),),
            duration_ms=12.5,
        ).to_dict()
        device = result["devices"][0]
        self.assertIsNone(device["hostname"])
        self.assertIsNone(device["mac_address"])
        self.assertIsNone(device["vendor"])
        self.assertEqual(device["discovery_methods"], ["arp"])
        self.assertEqual(result["host_count"], 1)


if __name__ == "__main__":
    unittest.main()
