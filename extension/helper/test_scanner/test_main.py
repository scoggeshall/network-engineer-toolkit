from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


SCANNER_ROOT = Path(__file__).resolve().parents[1] / "scanner"
sys.path.insert(0, str(SCANNER_ROOT))

import main  # noqa: E402
from models import RouteInfo, ScanResult  # noqa: E402


class ScannerMainTests(unittest.TestCase):
    def test_runs_only_allowlisted_scan_operation(self) -> None:
        result = ScanResult(
            subnet="192.168.137.0/24",
            route=RouteInfo(
                mode="direct",
                interface="Ethernet 2",
                source_address="192.168.137.20",
                gateway=None,
            ),
            devices=(),
            duration_ms=10.0,
        )
        with patch.object(main, "scan_network", return_value=result) as scan:
            response = main.run([
                "scan-network",
                "--subnet",
                "192.168.137.0/24",
                "--arp-timeout",
                "2",
                "--icmp-timeout",
                "2",
                "--dns-workers",
                "16",
            ])
        self.assertEqual(response["status"], "success")
        scan.assert_called_once_with(
            "192.168.137.0/24",
            arp_timeout_seconds=2.0,
            icmp_timeout_seconds=2.0,
            dns_workers=16,
        )

    def test_rejects_unknown_operations(self) -> None:
        with self.assertRaises(SystemExit):
            main.run(["port-scan"])


if __name__ == "__main__":
    unittest.main()
