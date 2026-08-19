from __future__ import annotations

import ipaddress
import sys
import unittest
from pathlib import Path


SCANNER_ROOT = Path(__file__).resolve().parents[1] / "scanner"
sys.path.insert(0, str(SCANNER_ROOT))

from discovery import MAX_SCAN_HOSTS, determine_route, parse_network, scan_network  # noqa: E402
from models import Device, HelperError  # noqa: E402


class NetworkValidationTests(unittest.TestCase):
    def test_normalizes_supported_cidr(self) -> None:
        self.assertEqual(str(parse_network("192.168.137.20/24")), "192.168.137.0/24")
        self.assertEqual(MAX_SCAN_HOSTS, 254)

    def test_rejects_missing_cidr(self) -> None:
        with self.assertRaisesRegex(HelperError, "CIDR notation"):
            parse_network("192.168.137.20")

    def test_rejects_subnet_above_maximum_without_enumerating_it(self) -> None:
        with self.assertRaisesRegex(HelperError, "at most 254 hosts"):
            parse_network("10.0.0.0/8")


class RouteSemanticsTests(unittest.TestCase):
    def test_identifies_direct_layer_two_route(self) -> None:
        route = determine_route(
            ipaddress.ip_network("192.168.137.0/24"),
            route_lookup=lambda _target: ("Ethernet 2", "192.168.137.20", "0.0.0.0"),
        )
        self.assertEqual(route.mode, "direct")
        self.assertIsNone(route.gateway)

    def test_identifies_routed_target(self) -> None:
        route = determine_route(
            ipaddress.ip_network("203.0.113.0/24"),
            route_lookup=lambda _target: ("Wi-Fi", "192.168.1.146", "192.168.1.254"),
        )
        self.assertEqual(route.mode, "routed")
        self.assertEqual(route.gateway, "192.168.1.254")


class DiscoveryStrategyTests(unittest.TestCase):
    def test_direct_scan_uses_arp_and_tolerates_missing_dns(self) -> None:
        calls: list[str] = []

        def arp(network, route, timeout):
            calls.append(f"arp:{route.mode}:{timeout}")
            return [
                Device(
                    ip="192.168.137.2",
                    mac_address="8c:1e:80:72:51:26",
                    discovery_methods=("arp",),
                    latency_ms=1.5,
                )
            ]

        result = scan_network(
            "192.168.137.0/24",
            route_lookup=lambda _target: ("Ethernet 2", "192.168.137.20", "0.0.0.0"),
            arp_discovery=arp,
            icmp_discovery=lambda *_args: self.fail("ICMP must not run for direct-L2 scans"),
            resolver=lambda _ip: None,
            clock=iter((1.0, 1.1)).__next__,
        )
        self.assertEqual(calls, ["arp:direct:2.0"])
        self.assertEqual(result.devices[0].mac_address, "8c:1e:80:72:51:26")
        self.assertIsNone(result.devices[0].hostname)

    def test_routed_scan_uses_icmp_and_removes_gateway_like_mac(self) -> None:
        def icmp(_network, _route, _timeout):
            return [
                Device(
                    ip="203.0.113.9",
                    mac_address="40:48:6e:ee:32:61",
                    discovery_methods=("icmp",),
                )
            ]

        result = scan_network(
            "203.0.113.0/24",
            route_lookup=lambda _target: ("Wi-Fi", "192.168.1.146", "192.168.1.254"),
            arp_discovery=lambda *_args: self.fail("ARP must not run for routed scans"),
            icmp_discovery=icmp,
            resolver=lambda _ip: "remote.example",
            clock=iter((1.0, 1.2)).__next__,
        )
        self.assertEqual(result.route.mode, "routed")
        self.assertIsNone(result.devices[0].mac_address)
        self.assertEqual(result.devices[0].hostname, "remote.example")

    def test_empty_scan_is_successful(self) -> None:
        result = scan_network(
            "192.168.137.0/24",
            route_lookup=lambda _target: ("Ethernet 2", "192.168.137.20", "0.0.0.0"),
            arp_discovery=lambda *_args: [],
            resolver=lambda _ip: None,
            clock=iter((1.0, 1.0)).__next__,
        )
        self.assertEqual(result.devices, ())

    def test_multiple_results_are_sorted_and_enriched_independently(self) -> None:
        result = scan_network(
            "192.168.137.0/24",
            route_lookup=lambda _target: ("Ethernet 2", "192.168.137.20", "0.0.0.0"),
            arp_discovery=lambda *_args: [
                Device(ip="192.168.137.20", discovery_methods=("arp",)),
                Device(ip="192.168.137.2", discovery_methods=("arp",)),
            ],
            resolver=lambda ip: "switch.example" if ip.endswith(".2") else None,
            clock=iter((1.0, 1.1)).__next__,
        )
        self.assertEqual([device.ip for device in result.devices], ["192.168.137.2", "192.168.137.20"])
        self.assertEqual(result.devices[0].hostname, "switch.example")
        self.assertIsNone(result.devices[1].hostname)


if __name__ == "__main__":
    unittest.main()
