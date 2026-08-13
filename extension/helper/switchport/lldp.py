from __future__ import annotations

import ipaddress

from ethernet import format_mac, parse_ethernet_frame
from models import DiscoveryAdvertisement


LLDP_ETHERTYPE = 0x88CC


def _decode_text(value: bytes) -> str | None:
    decoded = value.decode("utf-8", errors="replace").strip("\x00 \t\r\n")
    return decoded or None


def _decode_identifier(subtype: int, value: bytes) -> str | None:
    if subtype == 3 and len(value) == 6:  # Port MAC address.
        return format_mac(value)
    if subtype == 4 and len(value) == 6:  # Chassis MAC address.
        return format_mac(value)
    if subtype == 4 and len(value) in {5, 17}:  # Network address identifier.
        try:
            return str(ipaddress.ip_address(value[1:]))
        except ValueError:
            return None
    return _decode_text(value)


def _parse_management_address(value: bytes) -> str | None:
    if len(value) < 2:
        return None
    address_string_length = value[0]
    if address_string_length < 2 or 1 + address_string_length > len(value):
        return None
    subtype = value[1]
    address = value[2 : 1 + address_string_length]
    if subtype not in {1, 2}:
        return None
    try:
        return str(ipaddress.ip_address(address))
    except ValueError:
        return None


def parse_lldp_frame(
    frame: bytes,
    *,
    captured_at: str,
) -> DiscoveryAdvertisement | None:
    ethernet = parse_ethernet_frame(frame)
    if ethernet is None or ethernet.type_or_length != LLDP_ETHERTYPE:
        return None

    offset = 0
    chassis_id: str | None = None
    port_id: str | None = None
    port_description: str | None = None
    system_name: str | None = None
    system_description: str | None = None
    management_address: str | None = None
    capabilities_raw: str | None = None

    while offset + 2 <= len(ethernet.payload):
        header = int.from_bytes(ethernet.payload[offset : offset + 2], "big")
        offset += 2
        tlv_type = header >> 9
        tlv_length = header & 0x01FF
        if offset + tlv_length > len(ethernet.payload):
            break
        value = ethernet.payload[offset : offset + tlv_length]
        offset += tlv_length

        if tlv_type == 0:
            break
        if tlv_type == 1 and len(value) >= 2:
            chassis_id = _decode_identifier(value[0], value[1:])
        elif tlv_type == 2 and len(value) >= 2:
            port_id = _decode_identifier(value[0], value[1:])
        elif tlv_type == 4:
            port_description = _decode_text(value)
        elif tlv_type == 5:
            system_name = _decode_text(value)
        elif tlv_type == 6:
            system_description = _decode_text(value)
        elif tlv_type == 7 and len(value) >= 4:
            capabilities_raw = f"0x{int.from_bytes(value[2:4], 'big'):04x}"
        elif tlv_type == 8 and management_address is None:
            management_address = _parse_management_address(value)

    if not any((chassis_id, port_id, port_description, system_name)):
        return None
    return DiscoveryAdvertisement(
        protocol="LLDP",
        source_mac=ethernet.source,
        captured_at=captured_at,
        switch_name=system_name or chassis_id,
        switch_port=port_description or port_id,
        management_address=management_address,
        chassis_id=chassis_id,
        port_id=port_id,
        port_description=port_description,
        system_description=system_description,
        capabilities_raw=capabilities_raw,
    )
