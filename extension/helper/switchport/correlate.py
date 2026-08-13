from __future__ import annotations

from typing import Any

from models import CaptureAdapter, DiscoveryAdvertisement


def _identity(value: str | None) -> str:
    return "".join(character for character in (value or "").lower() if character in "0123456789abcdef")


def advertisements_match(left: DiscoveryAdvertisement, right: DiscoveryAdvertisement) -> bool:
    if left.protocol == right.protocol:
        return False
    if left.source_mac and right.source_mac:
        return _identity(left.source_mac) == _identity(right.source_mac)
    if (
        left.management_address
        and right.management_address
        and left.management_address.lower() == right.management_address.lower()
    ):
        return True
    left_chassis = _identity(left.chassis_id)
    right_chassis = _identity(right.chassis_id)
    left_name = _identity(left.switch_name)
    right_name = _identity(right.switch_name)
    return bool(
        (left_chassis and left_chassis in {right_chassis, right_name})
        or (right_chassis and right_chassis == left_name)
    )


def advertisement_score(item: DiscoveryAdvertisement) -> int:
    return sum(
        score
        for value, score in (
            (item.switch_port, 10),
            (item.management_address, 8),
            (item.switch_name, 6),
            (item.platform, 4),
            (item.software_version, 3),
            (item.capabilities_raw, 2),
            (item.port_description, 1),
        )
        if value
    )


def _evidence(item: DiscoveryAdvertisement) -> dict[str, Any]:
    data = item.to_dict()
    data.pop("protocol", None)
    return data


def normalize_result(
    adapter: CaptureAdapter,
    advertisements: list[DiscoveryAdvertisement],
) -> dict[str, Any]:
    ranked = sorted(
        advertisements,
        key=lambda item: (-advertisement_score(item), item.protocol, item.captured_at),
    )
    primary = ranked[0]
    correlated = [
        item for item in advertisements if item is primary or advertisements_match(primary, item)
    ]
    correlated_ranked = sorted(
        correlated,
        key=lambda item: (-advertisement_score(item), item.protocol, item.captured_at),
    )

    def first(field: str) -> str | None:
        return next((getattr(item, field) for item in correlated_ranked if getattr(item, field)), None)

    lldp = next((item for item in correlated_ranked if item.protocol == "LLDP"), None)
    cdp = next((item for item in correlated_ranked if item.protocol == "CDP"), None)
    additional = [item.to_dict() for item in advertisements if item not in correlated]
    result: dict[str, Any] = {
        "status": "success",
        "adapter": adapter.to_dict(),
        "protocols": [protocol for protocol in ("CDP", "LLDP") if any(item.protocol == protocol for item in correlated)],
        "switch_name": first("switch_name"),
        "switch_port": first("switch_port"),
        "management_address": first("management_address"),
        "platform": first("platform"),
        "software_version": first("software_version"),
        "capabilities_raw": first("capabilities_raw"),
        "captured_at": max(item.captured_at for item in correlated),
        "lldp": _evidence(lldp) if lldp else None,
        "cdp": _evidence(cdp) if cdp else None,
        "additional_advertisements": additional,
        "correlation": "confident" if len({item.protocol for item in correlated}) > 1 else "single-protocol",
        "capture_source": "local-windows",
        "capture_engine": "Scapy/Npcap",
    }
    return result
