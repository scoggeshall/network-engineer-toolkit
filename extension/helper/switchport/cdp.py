from __future__ import annotations

import ipaddress

from ethernet import parse_ethernet_frame
from models import DiscoveryAdvertisement


CDP_DESTINATION = "01:00:0c:cc:cc:cc"
CDP_SNAP_HEADER = bytes.fromhex("aaaa0300000c2000")


def _decode_text(value: bytes) -> str | None:
    decoded = value.decode("utf-8", errors="replace").strip("\x00 \t\r\n")
    return decoded or None


def _parse_addresses(value: bytes) -> str | None:
    if len(value) < 4:
        return None
    count = int.from_bytes(value[0:4], "big")
    offset = 4
    for _ in range(min(count, 64)):
        if offset + 2 > len(value):
            return None
        protocol_type = value[offset]
        protocol_length = value[offset + 1]
        offset += 2
        if offset + protocol_length + 2 > len(value):
            return None
        protocol = value[offset : offset + protocol_length]
        offset += protocol_length
        address_length = int.from_bytes(value[offset : offset + 2], "big")
        offset += 2
        if offset + address_length > len(value):
            return None
        address = value[offset : offset + address_length]
        offset += address_length
        is_ipv4 = (protocol_type == 1 and protocol == b"\xcc") or (
            protocol_type == 2 and protocol.endswith(b"\x08\x00")
        )
        if is_ipv4 and address_length == 4:
            try:
                return str(ipaddress.ip_address(address))
            except ValueError:
                continue
    return None


def parse_cdp_frame(
    frame: bytes,
    *,
    captured_at: str,
) -> DiscoveryAdvertisement | None:
    ethernet = parse_ethernet_frame(frame)
    if (
        ethernet is None
        or ethernet.destination != CDP_DESTINATION
        or ethernet.type_or_length > 1500
        or len(ethernet.payload) < len(CDP_SNAP_HEADER) + 4
        or ethernet.payload[: len(CDP_SNAP_HEADER)] != CDP_SNAP_HEADER
    ):
        return None

    payload = ethernet.payload[len(CDP_SNAP_HEADER) + 4 :]
    offset = 0
    device_id: str | None = None
    port_id: str | None = None
    management_address: str | None = None
    platform: str | None = None
    software_version: str | None = None
    capabilities_raw: str | None = None

    while offset + 4 <= len(payload):
        tlv_type = int.from_bytes(payload[offset : offset + 2], "big")
        tlv_length = int.from_bytes(payload[offset + 2 : offset + 4], "big")
        if tlv_length < 4 or offset + tlv_length > len(payload):
            break
        value = payload[offset + 4 : offset + tlv_length]
        offset += tlv_length
        if tlv_type == 0x0001:
            device_id = _decode_text(value)
        elif tlv_type == 0x0002:
            management_address = _parse_addresses(value)
        elif tlv_type == 0x0003:
            port_id = _decode_text(value)
        elif tlv_type == 0x0004 and len(value) >= 4:
            capabilities_raw = f"0x{int.from_bytes(value[:4], 'big'):08x}"
        elif tlv_type == 0x0005:
            software_version = _decode_text(value)
        elif tlv_type == 0x0006:
            platform = _decode_text(value)

    if not any((device_id, port_id, platform)):
        return None
    return DiscoveryAdvertisement(
        protocol="CDP",
        source_mac=ethernet.source,
        captured_at=captured_at,
        switch_name=device_id,
        switch_port=port_id,
        management_address=management_address,
        port_id=port_id,
        platform=platform,
        software_version=software_version,
        capabilities_raw=capabilities_raw,
    )
