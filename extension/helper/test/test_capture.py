from __future__ import annotations

import sys
import unittest
from pathlib import Path
from threading import Event

HELPER = Path(__file__).resolve().parents[1] / "switchport"
sys.path.insert(0, str(HELPER))

from capture import CAPTURE_FILTER, capture_advertisements  # noqa: E402
from models import CaptureAdapter, HelperError  # noqa: E402
from fixtures import LAB_CDP_FRAME, LAB_LLDP_FRAME  # noqa: E402


ADAPTER = CaptureAdapter(id="capture", name="Ethernet", is_up=True)


class FakePacket:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.time = 1786619158.0

    def __bytes__(self) -> bytes:
        return self.data


class Clock:
    def __init__(self) -> None:
        self.value = 0.0

    def __call__(self) -> float:
        self.value += 0.25
        return self.value


class CaptureTests(unittest.TestCase):
    def test_both_protocols_stop_successfully(self) -> None:
        calls = 0

        def sniff(**options: object) -> None:
            nonlocal calls
            self.assertEqual(options["filter"], CAPTURE_FILTER)
            packet = FakePacket(LAB_LLDP_FRAME if calls == 0 else LAB_CDP_FRAME)
            calls += 1
            options["prn"](packet)

        result = capture_advertisements(ADAPTER, sniff_function=sniff, monotonic=Clock())
        self.assertEqual({item.protocol for item in result}, {"LLDP", "CDP"})

    def test_one_protocol_returns_after_grace(self) -> None:
        sent = False

        def sniff(**options: object) -> None:
            nonlocal sent
            if not sent:
                sent = True
                options["prn"](FakePacket(LAB_LLDP_FRAME))

        result = capture_advertisements(ADAPTER, grace_seconds=1, sniff_function=sniff, monotonic=Clock())
        self.assertEqual([item.protocol for item in result], ["LLDP"])

    def test_timeout(self) -> None:
        with self.assertRaisesRegex(HelperError, "No LLDP/CDP"):
            capture_advertisements(ADAPTER, timeout_seconds=1, sniff_function=lambda **_options: None, monotonic=Clock())

    def test_cancellation(self) -> None:
        event = Event()

        def sniff(**_options: object) -> None:
            event.set()

        with self.assertRaisesRegex(HelperError, "cancelled"):
            capture_advertisements(ADAPTER, cancel_event=event, sniff_function=sniff, monotonic=Clock())

    def test_npcap_error(self) -> None:
        def sniff(**_options: object) -> None:
            raise RuntimeError("Npcap is not installed")

        with self.assertRaisesRegex(HelperError, "Npcap is required"):
            capture_advertisements(ADAPTER, sniff_function=sniff)

    def test_permission_error(self) -> None:
        def sniff(**_options: object) -> None:
            raise PermissionError("Access is denied")

        with self.assertRaisesRegex(HelperError, "permission"):
            capture_advertisements(ADAPTER, sniff_function=sniff)

    def test_down_adapter(self) -> None:
        with self.assertRaisesRegex(HelperError, "down"):
            capture_advertisements(CaptureAdapter(id="down", name="Ethernet", is_up=False))


if __name__ == "__main__":
    unittest.main()
