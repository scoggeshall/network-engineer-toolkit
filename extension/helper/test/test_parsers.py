from __future__ import annotations

import sys
import unittest
from pathlib import Path

HELPER = Path(__file__).resolve().parents[1] / "switchport"
sys.path.insert(0, str(HELPER))

from cdp import parse_cdp_frame  # noqa: E402
from ethernet import parse_ethernet_frame  # noqa: E402
from lldp import parse_lldp_frame  # noqa: E402
from fixtures import (  # noqa: E402
    LAB_CDP_FRAME,
    LAB_LLDP_FRAME,
    cdp_frame,
    cdp_tlv,
    lldp_frame,
    lldp_tlv,
)


CAPTURED_AT = "2026-08-13T07:00:00-04:00"


class EthernetTests(unittest.TestCase):
    def test_normal_ethernet(self) -> None:
        parsed = parse_ethernet_frame(LAB_LLDP_FRAME)
        self.assertEqual(parsed.type_or_length, 0x88CC)
        self.assertEqual(parsed.source, "8c:1e:80:72:51:27")

    def test_vlan_ethernet(self) -> None:
        tagged = LAB_LLDP_FRAME[:12] + bytes.fromhex("8100006488cc") + LAB_LLDP_FRAME[14:]
        self.assertEqual(parse_ethernet_frame(tagged).type_or_length, 0x88CC)

    def test_short_ethernet(self) -> None:
        self.assertIsNone(parse_ethernet_frame(b"\x00" * 13))


class LldpTests(unittest.TestCase):
    def test_observed_lab_frame(self) -> None:
        parsed = parse_lldp_frame(LAB_LLDP_FRAME, captured_at=CAPTURED_AT)
        self.assertEqual(parsed.switch_name, "sean-switch")
        self.assertEqual(parsed.port_id, "8c:1e:80:72:51:27")
        self.assertIsNone(parsed.management_address)

    def test_mac_port_id(self) -> None:
        frame = lldp_frame(lldp_tlv(2, b"\x03\x00\x11\x22\x33\x44\x55"))
        self.assertEqual(parse_lldp_frame(frame, captured_at=CAPTURED_AT).port_id, "00:11:22:33:44:55")

    def test_interface_name_port_id(self) -> None:
        frame = lldp_frame(lldp_tlv(2, b"\x05GigabitEthernet1/0/7"))
        self.assertEqual(parse_lldp_frame(frame, captured_at=CAPTURED_AT).port_id, "GigabitEthernet1/0/7")

    def test_port_description_is_preferred(self) -> None:
        frame = lldp_frame(lldp_tlv(2, b"\x05local-7"), lldp_tlv(4, b"Gi1/0/7"))
        self.assertEqual(parse_lldp_frame(frame, captured_at=CAPTURED_AT).switch_port, "Gi1/0/7")

    def test_management_ipv4(self) -> None:
        frame = lldp_frame(lldp_tlv(2, b"\x05Gi1"), lldp_tlv(8, b"\x05\x01\xc0\xa8\x01\x02"))
        self.assertEqual(parse_lldp_frame(frame, captured_at=CAPTURED_AT).management_address, "192.168.1.2")

    def test_unknown_tlv_is_skipped(self) -> None:
        frame = lldp_frame(lldp_tlv(2, b"\x05Gi1"), lldp_tlv(120, b"unknown"))
        self.assertEqual(parse_lldp_frame(frame, captured_at=CAPTURED_AT).port_id, "Gi1")

    def test_malformed_tlv_preserves_prior_fields(self) -> None:
        frame = lldp_frame(lldp_tlv(2, b"\x05Gi1"))[:-2] + bytes.fromhex("0bff")
        self.assertEqual(parse_lldp_frame(frame, captured_at=CAPTURED_AT).port_id, "Gi1")

    def test_truncated_packet(self) -> None:
        self.assertIsNone(parse_lldp_frame(LAB_LLDP_FRAME[:16], captured_at=CAPTURED_AT))

    def test_not_lldp(self) -> None:
        self.assertIsNone(parse_lldp_frame(LAB_CDP_FRAME, captured_at=CAPTURED_AT))


class CdpTests(unittest.TestCase):
    def test_observed_lab_frame(self) -> None:
        parsed = parse_cdp_frame(LAB_CDP_FRAME, captured_at=CAPTURED_AT)
        self.assertEqual(parsed.switch_name, "8c1e80725126")
        self.assertEqual(parsed.port_id, "gi1")
        self.assertEqual(parsed.management_address, "192.168.1.2")
        self.assertIn("Cisco CBS250-8T-D", parsed.platform)
        self.assertEqual(parsed.software_version, "3.5.3.2")
        self.assertEqual(parsed.capabilities_raw, "0x00000029")

    def test_unknown_tlv_is_skipped(self) -> None:
        frame = cdp_frame(cdp_tlv(0xFFFF, b"unknown"), cdp_tlv(1, b"switch"))
        self.assertEqual(parse_cdp_frame(frame, captured_at=CAPTURED_AT).switch_name, "switch")

    def test_malformed_tlv_preserves_prior_fields(self) -> None:
        frame = cdp_frame(cdp_tlv(1, b"switch")) + bytes.fromhex("00030002")
        self.assertEqual(parse_cdp_frame(frame, captured_at=CAPTURED_AT).switch_name, "switch")

    def test_truncated_packet(self) -> None:
        self.assertIsNone(parse_cdp_frame(LAB_CDP_FRAME[:20], captured_at=CAPTURED_AT))

    def test_not_cdp(self) -> None:
        self.assertIsNone(parse_cdp_frame(LAB_LLDP_FRAME, captured_at=CAPTURED_AT))


if __name__ == "__main__":
    unittest.main()
