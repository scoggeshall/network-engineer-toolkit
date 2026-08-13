from __future__ import annotations

import json
import re
import subprocess
from typing import Any

from models import CaptureAdapter, HelperError


EXCLUDED_WORDS = (
    "loopback",
    "bluetooth",
    "miniport",
    "wi-fi direct",
    "local area connection*",
    "hyper-v",
    "vethernet",
    "vmware",
    "virtualbox",
    "teredo",
    "isatap",
)
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def _clean_guid(value: object) -> str:
    match = re.search(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        str(value or ""),
        re.IGNORECASE,
    )
    return match.group(0).lower() if match else ""


def _windows_adapters() -> list[dict[str, Any]]:
    script = (
        "Get-NetAdapter | "
        "Select-Object Name,InterfaceDescription,InterfaceGuid,Status,MacAddress,LinkSpeed | "
        "ConvertTo-Json -Compress"
    )
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
            creationflags=CREATE_NO_WINDOW,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return []
    if result.returncode != 0 or not result.stdout.strip():
        return []
    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else [parsed]


def _kind(name: str, description: str) -> str:
    text = f"{name} {description}".lower()
    if any(word in text for word in ("wi-fi", "wifi", "wireless")):
        return "wifi"
    if any(word in text for word in ("ethernet", "gbe", "gigabit", "realtek", "dell giga")):
        return "ethernet"
    return "other"


def rank_adapter(kind: str, is_up: bool | None) -> tuple[int, str]:
    if kind == "ethernet" and is_up is True:
        return 100, "Ethernet adapter is up"
    if kind == "ethernet":
        return 75, "Physical Ethernet adapter"
    if kind == "other" and is_up is True:
        return 50, "Physical adapter is up"
    if kind == "wifi" and is_up is True:
        return 40, "Wi-Fi adapter is up"
    return 25, "Wi-Fi adapter" if kind == "wifi" else "Capture adapter"


def build_adapters(
    scapy_interfaces: list[dict[str, Any]],
    windows_interfaces: list[dict[str, Any]],
) -> list[CaptureAdapter]:
    adapters: list[CaptureAdapter] = []
    for interface in scapy_interfaces:
        capture_id = str(interface.get("network_name") or interface.get("id") or "").strip()
        if not capture_id:
            continue
        capture_guid = _clean_guid(interface.get("guid") or capture_id)
        metadata = next(
            (
                item
                for item in windows_interfaces
                if _clean_guid(item.get("InterfaceGuid")) == capture_guid
                or str(item.get("Name", "")).lower()
                == str(interface.get("name", "")).lower()
            ),
            {},
        )
        name = str(metadata.get("Name") or interface.get("name") or capture_id).strip()
        description = str(
            metadata.get("InterfaceDescription") or interface.get("description") or ""
        ).strip()
        combined = f"{capture_id} {name} {description}".lower()
        if any(word in combined for word in EXCLUDED_WORDS):
            continue
        status = str(metadata.get("Status") or "unknown").strip().lower()
        is_up = True if status == "up" else False if status in {"down", "disconnected"} else None
        kind = _kind(name, description)
        confidence, reason = rank_adapter(kind, is_up)
        adapters.append(
            CaptureAdapter(
                id=capture_id,
                name=name,
                description=description,
                guid=capture_guid,
                status=status,
                mac_address=str(metadata.get("MacAddress") or interface.get("mac") or ""),
                link_speed=str(metadata.get("LinkSpeed") or ""),
                kind=kind,  # type: ignore[arg-type]
                is_up=is_up,
                confidence=confidence,
                reason=reason,
            )
        )
    return sorted(adapters, key=lambda item: (-item.confidence, item.name.lower()))


def list_adapters(
    *,
    scapy_interfaces: list[dict[str, Any]] | None = None,
    windows_interfaces: list[dict[str, Any]] | None = None,
) -> list[CaptureAdapter]:
    if scapy_interfaces is None:
        try:
            from scapy.all import conf
        except ImportError as exc:
            raise HelperError("scapy_missing", "Scapy is not available.", status="unavailable") from exc
        scapy_interfaces = [
            {
                "id": str(key),
                "network_name": str(getattr(value, "network_name", "") or key),
                "name": str(getattr(value, "name", "")),
                "description": str(getattr(value, "description", "")),
                "guid": str(getattr(value, "guid", "")),
                "mac": str(getattr(value, "mac", "")),
            }
            for key, value in conf.ifaces.data.items()
        ]
    adapters = build_adapters(
        scapy_interfaces,
        windows_interfaces if windows_interfaces is not None else _windows_adapters(),
    )
    if not adapters:
        raise HelperError("adapter_unavailable", "No usable local capture adapters were found.")
    return adapters


def resolve_adapter(adapter_id: str, adapters: list[CaptureAdapter] | None = None) -> CaptureAdapter:
    value = adapter_id.strip().lower()
    if not value:
        raise HelperError("adapter_required", "A capture adapter must be selected.")
    for adapter in adapters if adapters is not None else list_adapters():
        if value in {adapter.id.lower(), adapter.name.lower(), adapter.guid.lower()}:
            return adapter
    raise HelperError("adapter_unavailable", "The selected capture adapter is unavailable.")
