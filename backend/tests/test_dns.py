"""Tests for DNS domain logic and its HTTP API."""

from __future__ import annotations

import socket
import time

import pytest
from fastapi.testclient import TestClient

from network_tools_api.api.routes import dns as dns_route
from network_tools_api.diagnostics.dns import (
    DnsLookupFailed,
    InvalidDnsQuery,
    resolve_dns,
)
from network_tools_api.main import app

client = TestClient(app)


def test_forward_lookup_trims_deduplicates_and_orders(monkeypatch) -> None:
    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.getaddrinfo",
        lambda _query, _port: [
            (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2001:db8::2", 0, 0, 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.20", 0)),
            (socket.AF_INET, socket.SOCK_DGRAM, 17, "", ("192.0.2.10", 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.20", 0)),
        ],
    )
    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.gethostname",
        lambda: "resolver-host",
    )

    result = resolve_dns("  server01  ")

    assert result.query == "server01"
    assert result.lookup_type == "forward"
    assert result.addresses == ("192.0.2.10", "192.0.2.20", "2001:db8::2")
    assert result.hostname is None
    assert result.aliases == ()
    assert result.executed_by == "resolver-host"


@pytest.mark.parametrize(
    ("query", "canonical"),
    [("192.0.2.5", "192.0.2.5"), ("2001:0db8::5", "2001:db8::5")],
)
def test_reverse_lookup_classifies_ipv4_and_ipv6(monkeypatch, query, canonical) -> None:
    calls: list[str] = []

    def fake_gethostbyaddr(address: str):
        calls.append(address)
        return ("router.example.test", ["router"], [canonical, canonical])

    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.gethostbyaddr",
        fake_gethostbyaddr,
    )
    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.gethostname",
        lambda: "resolver-host",
    )

    result = resolve_dns(query)

    assert calls == [canonical]
    assert result.lookup_type == "reverse"
    assert result.hostname == "router.example.test"
    assert result.aliases == ("router",)
    assert result.addresses == (canonical,)


@pytest.mark.parametrize(
    "query",
    ["", "   ", "bad host", "https://example.com", "bad\x00host"],
)
def test_invalid_query_is_rejected(query) -> None:
    with pytest.raises(InvalidDnsQuery):
        resolve_dns(query)


def test_unreasonably_long_query_is_rejected() -> None:
    with pytest.raises(InvalidDnsQuery):
        resolve_dns("a" * 254)


def test_resolver_failure_is_sanitized(monkeypatch) -> None:
    def fail_lookup(_query, _port):
        raise socket.gaierror("sensitive resolver detail")

    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.getaddrinfo",
        fail_lookup,
    )

    with pytest.raises(
        DnsLookupFailed,
        match=r"DNS lookup failed for missing\.test\.",
    ) as exc:
        resolve_dns("missing.test")

    assert "sensitive" not in str(exc.value)


def test_http_success_returns_typed_response(monkeypatch) -> None:
    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.getaddrinfo",
        lambda _query, _port: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.25", 0))
        ],
    )
    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.gethostname",
        lambda: "ubuntu-test",
    )

    response = client.get("/api/v1/dns/lookup", params={"query": "example.test"})

    assert response.status_code == 200
    assert response.json() == {
        "query": "example.test",
        "lookup_type": "forward",
        "addresses": ["192.0.2.25"],
        "hostname": None,
        "aliases": [],
        "executed_by": "ubuntu-test",
    }


def test_http_invalid_query_returns_400() -> None:
    response = client.get("/api/v1/dns/lookup", params={"query": "   "})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_query"


def test_http_lookup_failure_returns_404(monkeypatch) -> None:
    def fail_lookup(_query, _port):
        raise socket.gaierror("not found")

    monkeypatch.setattr(
        "network_tools_api.diagnostics.dns.socket.getaddrinfo",
        fail_lookup,
    )

    response = client.get("/api/v1/dns/lookup", params={"query": "missing.test"})

    assert response.status_code == 404
    assert response.json() == {
        "detail": {
            "code": "lookup_failed",
            "message": "DNS lookup failed for missing.test.",
        }
    }


def test_http_lookup_timeout_returns_504(monkeypatch) -> None:
    def slow_lookup(_query: str):
        time.sleep(0.05)

    monkeypatch.setattr(dns_route, "resolve_dns", slow_lookup)
    monkeypatch.setattr(dns_route, "DNS_LOOKUP_TIMEOUT_SECONDS", 0.001)

    response = client.get("/api/v1/dns/lookup", params={"query": "example.test"})

    assert response.status_code == 504
    assert response.json() == {
        "detail": {
            "code": "lookup_timeout",
            "message": "DNS lookup timed out.",
        }
    }
