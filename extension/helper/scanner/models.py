from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal


DiscoveryMethod = Literal["arp", "icmp", "local-interface"]


class HelperError(RuntimeError):
    def __init__(self, error_code: str, message: str, *, status: str = "error") -> None:
        super().__init__(message)
        self.error_code = error_code
        self.status = status


@dataclass(frozen=True, slots=True)
class RouteInfo:
    mode: Literal["direct", "routed"]
    interface: str
    source_address: str
    gateway: str | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class Device:
    ip: str
    hostname: str | None = None
    mac_address: str | None = None
    vendor: str | None = None
    discovery_methods: tuple[DiscoveryMethod, ...] = ()
    latency_ms: float | None = None

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["discovery_methods"] = list(self.discovery_methods)
        return value


@dataclass(frozen=True, slots=True)
class ScanResult:
    subnet: str
    route: RouteInfo
    devices: tuple[Device, ...]
    duration_ms: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": "success",
            "subnet": self.subnet,
            "host_count": len(self.devices),
            "route": self.route.to_dict(),
            "devices": [device.to_dict() for device in self.devices],
            "duration_ms": self.duration_ms,
            "discovery_source": "local-windows",
            "discovery_engine": "Scapy/Npcap",
        }
