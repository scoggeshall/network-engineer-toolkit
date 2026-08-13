from __future__ import annotations

import time
from datetime import datetime
from threading import Event
from typing import Any, Callable

from cdp import parse_cdp_frame
from lldp import parse_lldp_frame
from models import CaptureAdapter, DiscoveryAdvertisement, HelperError


CAPTURE_FILTER = "ether proto 0x88cc or ether dst 01:00:0c:cc:cc:cc"
DEFAULT_TIMEOUT_SECONDS = 45
DEFAULT_GRACE_SECONDS = 12


def _timestamp(packet: object) -> str:
    value = float(getattr(packet, "time", time.time()))
    return datetime.fromtimestamp(value).astimezone().isoformat(timespec="seconds")


def _capture_error(exc: Exception) -> HelperError:
    message = " ".join(str(exc).split())
    lowered = message.lower()
    if any(word in lowered for word in ("npcap", "winpcap", "packet.dll", "pcap")):
        return HelperError(
            "npcap_missing",
            "Npcap is required for Switchport Discovery on Windows.",
            status="unavailable",
        )
    if any(word in lowered for word in ("permission", "access is denied", "not permitted")):
        return HelperError("capture_permission", "Packet capture permission was denied.")
    return HelperError("capture_failed", f"Packet capture failed: {message or 'unknown error'}")


def capture_advertisements(
    adapter: CaptureAdapter,
    *,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    grace_seconds: int = DEFAULT_GRACE_SECONDS,
    cancel_event: Event | None = None,
    sniff_function: Callable[..., Any] | None = None,
    monotonic: Callable[[], float] = time.monotonic,
) -> list[DiscoveryAdvertisement]:
    if adapter.is_up is False:
        raise HelperError("adapter_down", f"The selected adapter ({adapter.name}) is down.")
    if cancel_event is not None and cancel_event.is_set():
        raise HelperError("cancelled", "Switchport discovery was cancelled.", status="cancelled")
    if sniff_function is None:
        try:
            from scapy.all import sniff
        except ImportError as exc:
            raise HelperError("scapy_missing", "Scapy is not available.", status="unavailable") from exc
        sniff_function = sniff

    advertisements: list[DiscoveryAdvertisement] = []
    deadline = monotonic() + max(1, timeout_seconds)
    grace_deadline: float | None = None

    def handle_packet(packet: object) -> None:
        try:
            frame = bytes(packet)
            captured_at = _timestamp(packet)
            parsed = parse_lldp_frame(frame, captured_at=captured_at)
            if parsed is None:
                parsed = parse_cdp_frame(frame, captured_at=captured_at)
            if parsed is not None:
                advertisements.append(parsed)
        except (TypeError, ValueError, OverflowError):
            return

    try:
        while True:
            now = monotonic()
            protocols = {item.protocol for item in advertisements}
            if len(protocols) == 2:
                break
            if cancel_event is not None and cancel_event.is_set():
                raise HelperError("cancelled", "Switchport discovery was cancelled.", status="cancelled")
            if advertisements and grace_deadline is None:
                grace_deadline = now + max(0, grace_seconds)
            effective_deadline = min(deadline, grace_deadline) if grace_deadline is not None else deadline
            remaining = effective_deadline - now
            if remaining <= 0:
                break
            sniff_function(
                iface=adapter.id,
                filter=CAPTURE_FILTER,
                prn=handle_packet,
                store=False,
                timeout=min(1.0, remaining),
                stop_filter=lambda _packet: len({item.protocol for item in advertisements}) == 2,
            )
    except HelperError:
        raise
    except Exception as exc:
        raise _capture_error(exc) from exc

    if not advertisements:
        raise HelperError("timeout", "No LLDP/CDP advertisement was received.", status="timeout")
    return advertisements
