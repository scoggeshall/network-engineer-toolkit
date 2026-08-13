from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal


Protocol = Literal["LLDP", "CDP"]


class HelperError(RuntimeError):
    def __init__(self, error_code: str, message: str, *, status: str = "error") -> None:
        super().__init__(message)
        self.error_code = error_code
        self.status = status


@dataclass(frozen=True, slots=True)
class CaptureAdapter:
    id: str
    name: str
    description: str = ""
    guid: str = ""
    status: str = "unknown"
    mac_address: str = ""
    link_speed: str = ""
    kind: Literal["ethernet", "wifi", "other"] = "other"
    is_up: bool | None = None
    confidence: int = 0
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class DiscoveryAdvertisement:
    protocol: Protocol
    source_mac: str
    captured_at: str
    switch_name: str | None = None
    switch_port: str | None = None
    management_address: str | None = None
    chassis_id: str | None = None
    port_id: str | None = None
    port_description: str | None = None
    system_description: str | None = None
    platform: str | None = None
    software_version: str | None = None
    capabilities_raw: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {key: value for key, value in asdict(self).items() if value is not None}
