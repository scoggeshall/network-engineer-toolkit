from __future__ import annotations

from dataclasses import dataclass


VLAN_ETHERTYPES = {0x8100, 0x88A8, 0x9100}


@dataclass(frozen=True, slots=True)
class EthernetFrame:
    destination: str
    source: str
    type_or_length: int
    payload: bytes


def format_mac(value: bytes) -> str:
    return ":".join(f"{octet:02x}" for octet in value)


def parse_ethernet_frame(frame: bytes) -> EthernetFrame | None:
    if len(frame) < 14:
        return None

    offset = 12
    type_or_length = int.from_bytes(frame[offset : offset + 2], "big")
    offset += 2
    while type_or_length in VLAN_ETHERTYPES:
        if offset + 4 > len(frame):
            return None
        offset += 2  # VLAN tag control information.
        type_or_length = int.from_bytes(frame[offset : offset + 2], "big")
        offset += 2

    return EthernetFrame(
        destination=format_mac(frame[0:6]),
        source=format_mac(frame[6:12]),
        type_or_length=type_or_length,
        payload=frame[offset:],
    )
