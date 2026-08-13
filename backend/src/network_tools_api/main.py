"""FastAPI application bootstrap."""

from fastapi import FastAPI

from network_tools_api import __version__
from network_tools_api.api.routes.health import router as health_router

app = FastAPI(
    title="Network Tools API",
    version=__version__,
)

app.include_router(health_router, prefix="/api/v1")
