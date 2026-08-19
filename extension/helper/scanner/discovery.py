from __future__ import annotations

import ipaddress
import socket
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from typing import Callable, Iterable

from models import Device, HelperError, RouteInfo, ScanResult


MAX_SCAN_HOSTS = 254
DEFAULT_ARP_TIMEOUT_SECONDS = 2.0
DEFAULT_ICMP_TIMEOUT_SECONDS = 2.0
DEFAULT_DNS_WORKERS = 16

RouteLookup = Callable[[str], tuple[object, str, str]]
DiscoveryFunction = Callable[[ipaddress.IPv4Network, RouteInfo, float], Iterable[Device]]
HostnameResolver = Callable[[str], str | None]


def parse_network(value: str) -> ipaddress.IPv4Network:
    try:
        network = ipaddress.ip_network(value.strip(), strict=False)
    except ValueError as exc:
        raise HelperError("invalid_subnet", "Enter a valid IPv4 subnet in CIDR notation.") from exc
    if not isinstance(network, ipaddress.IPv4Network) or "/" not in value:
        raise HelperError("invalid_subnet", "Enter a valid IPv4 subnet in CIDR notation.")
    host_count = network.num_addresses if network.prefixlen >= 31 else network.num_addresses - 2
    if host_count > MAX_SCAN_HOSTS:
        raise HelperError(
            "subnet_too_large",
            f"Network Scanner supports at most {MAX_SCAN_HOSTS} hosts (/24 or smaller).",
        )
    return network


def determine_route(
    network: ipaddress.IPv4Network,
    *,
    route_lookup: RouteLookup | None = None,
) -> RouteInfo:
    if route_lookup is None:
        try:
            from scapy.all import conf
        except ImportError as exc:
            raise HelperError("scapy_missing", "Scapy is not available.", status="unavailable") from exc
        route_lookup = conf.route.route

    probe_address = str(next(network.hosts(), network.network_address))
    try:
        interface_value, source_address, gateway = route_lookup(probe_address)
        source = ipaddress.ip_address(source_address)
        gateway_address = ipaddress.ip_address(gateway)
    except (TypeError, ValueError, OSError) as exc:
        raise HelperError("route_unavailable", "No usable local route was found for this subnet.") from exc
    if not isinstance(source, ipaddress.IPv4Address) or source.is_unspecified:
        raise HelperError("route_unavailable", "No usable local IPv4 route was found for this subnet.")

    interface = str(getattr(interface_value, "network_name", "") or interface_value).strip()
    if not interface:
        raise HelperError("route_unavailable", "No usable local interface was found for this subnet.")
    direct = gateway_address.is_unspecified and source in network
    return RouteInfo(
        mode="direct" if direct else "routed",
        interface=interface,
        source_address=str(source),
        gateway=None if direct else str(gateway_address),
    )


def _latency_ms(sent: object, received: object) -> float | None:
    sent_time = getattr(sent, "sent_time", None)
    received_time = getattr(received, "time", None)
    if sent_time is None or received_time is None:
        return None
    try:
        return round(max(0.0, (float(received_time) - float(sent_time)) * 1000), 1)
    except (TypeError, ValueError):
        return None


def discover_arp(
    network: ipaddress.IPv4Network,
    route: RouteInfo,
    timeout_seconds: float,
) -> list[Device]:
    try:
        from scapy.all import ARP, Ether, srp
    except ImportError as exc:
        raise HelperError("scapy_missing", "Scapy is not available.", status="unavailable") from exc
    try:
        answered, _unanswered = srp(
            Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=str(network)),
            iface=route.interface,
            timeout=timeout_seconds,
            retry=0,
            verbose=False,
        )
    except Exception as exc:
        raise HelperError(
            "arp_unavailable",
            "ARP discovery could not start. Verify that Npcap is installed and the adapter is usable.",
            status="unavailable",
        ) from exc

    devices: dict[str, Device] = {}
    for sent, received in answered:
        ip = str(getattr(received, "psrc", "")).strip()
        mac = str(getattr(received, "hwsrc", "")).strip().lower().replace("-", ":")
        try:
            address = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if not isinstance(address, ipaddress.IPv4Address) or address not in network:
            continue
        devices[ip] = Device(
            ip=ip,
            mac_address=mac or None,
            discovery_methods=("arp",),
            latency_ms=_latency_ms(sent, received),
        )
    return sorted(devices.values(), key=lambda device: ipaddress.ip_address(device.ip))


def discover_icmp(
    network: ipaddress.IPv4Network,
    route: RouteInfo,
    timeout_seconds: float,
) -> list[Device]:
    try:
        from scapy.all import ICMP, IP, sr
    except ImportError as exc:
        raise HelperError("scapy_missing", "Scapy is not available.", status="unavailable") from exc
    targets = [str(address) for address in network.hosts()]
    if not targets:
        return []
    try:
        answered, _unanswered = sr(
            IP(dst=targets) / ICMP(),
            timeout=timeout_seconds,
            retry=0,
            inter=0.005,
            verbose=False,
        )
    except Exception as exc:
        raise HelperError(
            "icmp_unavailable",
            "ICMP discovery could not start. Verify that Npcap is installed and the route is usable.",
            status="unavailable",
        ) from exc

    devices: dict[str, Device] = {}
    for sent, received in answered:
        ip = str(getattr(received, "src", "")).strip()
        try:
            address = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if not isinstance(address, ipaddress.IPv4Address) or address not in network:
            continue
        devices[ip] = Device(
            ip=ip,
            mac_address=None,
            discovery_methods=("icmp",),
            latency_ms=_latency_ms(sent, received),
        )
    return sorted(devices.values(), key=lambda device: ipaddress.ip_address(device.ip))


def resolve_hostname(ip: str) -> str | None:
    try:
        hostname, _aliases, _addresses = socket.gethostbyaddr(ip)
    except (OSError, socket.error):
        return None
    value = hostname.rstrip(".").strip()
    return value or None


def enrich_hostnames(
    devices: Iterable[Device],
    *,
    resolver: HostnameResolver = resolve_hostname,
    workers: int = DEFAULT_DNS_WORKERS,
) -> list[Device]:
    values = list(devices)
    if not values:
        return []

    def safely_resolve(device: Device) -> Device:
        try:
            hostname = resolver(device.ip)
        except Exception:
            hostname = None
        return replace(device, hostname=hostname)

    with ThreadPoolExecutor(max_workers=min(max(1, workers), len(values))) as executor:
        return list(executor.map(safely_resolve, values))


def scan_network(
    subnet: str,
    *,
    arp_timeout_seconds: float = DEFAULT_ARP_TIMEOUT_SECONDS,
    icmp_timeout_seconds: float = DEFAULT_ICMP_TIMEOUT_SECONDS,
    dns_workers: int = DEFAULT_DNS_WORKERS,
    route_lookup: RouteLookup | None = None,
    arp_discovery: DiscoveryFunction = discover_arp,
    icmp_discovery: DiscoveryFunction = discover_icmp,
    resolver: HostnameResolver = resolve_hostname,
    clock: Callable[[], float] = time.perf_counter,
) -> ScanResult:
    started = clock()
    network = parse_network(subnet)
    route = determine_route(network, route_lookup=route_lookup)
    if route.mode == "direct":
        devices = list(arp_discovery(network, route, arp_timeout_seconds))
    else:
        devices = list(icmp_discovery(network, route, icmp_timeout_seconds))
        devices = [replace(device, mac_address=None) for device in devices]
    devices = enrich_hostnames(devices, resolver=resolver, workers=dns_workers)
    devices.sort(key=lambda device: ipaddress.ip_address(device.ip))
    return ScanResult(
        subnet=str(network),
        route=route,
        devices=tuple(devices),
        duration_ms=round(max(0.0, (clock() - started) * 1000), 1),
    )
