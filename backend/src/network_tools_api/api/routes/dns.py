"""Remote DNS lookup API route."""

from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from network_tools_api.diagnostics.dns import (
    DnsLookupFailed,
    DnsLookupResult,
    InvalidDnsQuery,
    resolve_dns,
)

DNS_LOOKUP_TIMEOUT_SECONDS = 5.0

router = APIRouter()


class DnsLookupResponse(BaseModel):
    """Typed DNS lookup response exposed by the API."""

    query: str
    lookup_type: Literal["forward", "reverse"]
    addresses: list[str]
    hostname: str | None
    aliases: list[str]
    executed_by: str


@router.get("/dns/lookup", response_model=DnsLookupResponse, tags=["dns"])
async def get_dns_lookup(query: str = Query(...)) -> DnsLookupResponse:
    """Run a bounded DNS lookup through this host's system resolver."""
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(resolve_dns, query),
            timeout=DNS_LOOKUP_TIMEOUT_SECONDS,
        )
    except InvalidDnsQuery as exc:
        raise _api_error(400, "invalid_query", str(exc)) from exc
    except DnsLookupFailed as exc:
        raise _api_error(404, "lookup_failed", str(exc)) from exc
    except TimeoutError as exc:
        raise _api_error(504, "lookup_timeout", "DNS lookup timed out.") from exc
    except Exception as exc:
        raise _api_error(
            500, "internal_error", "DNS lookup failed unexpectedly."
        ) from exc

    return _to_response(result)


def _to_response(result: DnsLookupResult) -> DnsLookupResponse:
    return DnsLookupResponse(
        query=result.query,
        lookup_type=result.lookup_type,
        addresses=list(result.addresses),
        hostname=result.hostname,
        aliases=list(result.aliases),
        executed_by=result.executed_by,
    )


def _api_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )
