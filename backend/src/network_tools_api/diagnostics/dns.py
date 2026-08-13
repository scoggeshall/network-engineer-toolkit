"""DNS lookup domain logic backed by the host system resolver."""

from __future__ import annotations

import ipaddress
import re
import socket
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal

MAX_DNS_QUERY_LENGTH = 253
_HOST_LABEL = re.compile(r"^[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$")


class InvalidDnsQuery(ValueError):
    """Raised when a DNS query is not a reasonable hostname or IP address."""


class DnsLookupFailed(Exception):
    """Raised when the system resolver cannot produce a DNS result."""


@dataclass(frozen=True, slots=True)
class DnsLookupResult:
    """Structured result returned by a system-resolver lookup."""

    query: str
    lookup_type: Literal["forward", "reverse"]
    addresses: tuple[str, ...]
    hostname: str | None
    aliases: tuple[str, ...]
    executed_by: str


def resolve_dns(query: str) -> DnsLookupResult:
    """Resolve a hostname or reverse-resolve an IP on the current host."""
    clean_query = _validate_query(query)

    try:
        parsed_ip = ipaddress.ip_address(clean_query)
    except ValueError:
        return _forward_lookup(clean_query)

    return _reverse_lookup(str(parsed_ip))


def _validate_query(query: str) -> str:
    clean_query = query.strip()
    if not clean_query:
        raise InvalidDnsQuery("Enter a hostname or IP address.")
    if len(clean_query) > MAX_DNS_QUERY_LENGTH:
        raise InvalidDnsQuery("DNS query is too long.")
    if any(
        character.isspace() or unicodedata.category(character) == "Cc"
        for character in clean_query
    ):
        raise InvalidDnsQuery(
            "DNS query must not contain whitespace or control characters."
        )

    try:
        ipaddress.ip_address(clean_query)
        return clean_query
    except ValueError:
        pass

    if any(character in clean_query for character in "/\\:?#@[]"):
        raise InvalidDnsQuery("Enter a valid hostname or IP address.")

    hostname = clean_query.removesuffix(".")
    if not hostname:
        raise InvalidDnsQuery("Enter a valid hostname or IP address.")

    try:
        ascii_hostname = hostname.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise InvalidDnsQuery("Enter a valid hostname or IP address.") from exc

    if any(not _HOST_LABEL.fullmatch(label) for label in ascii_hostname.split(".")):
        raise InvalidDnsQuery("Enter a valid hostname or IP address.")
    return clean_query


def _forward_lookup(hostname: str) -> DnsLookupResult:
    try:
        records = socket.getaddrinfo(hostname, None)
    except OSError as exc:
        raise DnsLookupFailed(f"DNS lookup failed for {hostname}.") from exc

    addresses = _sorted_addresses(record[4][0] for record in records)
    if not addresses:
        raise DnsLookupFailed(f"DNS lookup returned no addresses for {hostname}.")

    return DnsLookupResult(
        query=hostname,
        lookup_type="forward",
        addresses=addresses,
        hostname=None,
        aliases=(),
        executed_by=socket.gethostname(),
    )


def _reverse_lookup(ip_address: str) -> DnsLookupResult:
    try:
        hostname, aliases, addresses = socket.gethostbyaddr(ip_address)
    except OSError as exc:
        raise DnsLookupFailed(f"Reverse DNS lookup failed for {ip_address}.") from exc

    return DnsLookupResult(
        query=ip_address,
        lookup_type="reverse",
        addresses=_sorted_addresses(addresses),
        hostname=hostname,
        aliases=tuple(sorted(set(aliases))),
        executed_by=socket.gethostname(),
    )


def _sorted_addresses(addresses: Iterable[str]) -> tuple[str, ...]:
    unique_addresses = set(addresses)
    return tuple(
        sorted(
            unique_addresses,
            key=lambda address: (
                ipaddress.ip_address(address).version,
                int(ipaddress.ip_address(address)),
            ),
        )
    )


__all__ = ["DnsLookupFailed", "DnsLookupResult", "InvalidDnsQuery", "resolve_dns"]
