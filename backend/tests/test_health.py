"""Tests for the health API route."""

from fastapi.testclient import TestClient

from network_tools_api import __version__
from network_tools_api.main import app

client = TestClient(app)


def test_health_returns_service_status(monkeypatch) -> None:
    """The health response identifies the service and executing host."""
    monkeypatch.setattr(
        "network_tools_api.api.routes.health.socket.gethostname",
        lambda: "test-host",
    )

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "network-tools-api",
        "version": __version__,
        "executed_by": "test-host",
    }
