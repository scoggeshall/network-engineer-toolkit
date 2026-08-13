"""Health API route."""

import socket
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from network_tools_api import __version__

router = APIRouter()


class HealthResponse(BaseModel):
    """Response returned by the service health endpoint."""

    status: Literal["ok"]
    service: str
    version: str
    executed_by: str


@router.get("/health", response_model=HealthResponse, tags=["health"])
def get_health() -> HealthResponse:
    """Report service health and the host providing the response."""
    return HealthResponse(
        status="ok",
        service="network-tools-api",
        version=__version__,
        executed_by=socket.gethostname(),
    )
