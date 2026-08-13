# Network Tools Backend

LAN-only FastAPI backend hosted on Ubuntu.

The initial milestone exposes one endpoint:

```text
GET /api/v1/health
```

## Requirements

- Python 3.12 or newer
- `uv`

## Setup and checks

Run all backend commands from this directory on the Ubuntu host:

```bash
uv sync
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

## Development server

```bash
uv run uvicorn network_tools_api.main:app \
    --app-dir src \
    --host 0.0.0.0 \
    --port 8000
```

The `0.0.0.0` binding is for development on the trusted LAN only. It does not
authorize public Internet exposure.

Check the endpoint locally with:

```bash
curl http://127.0.0.1:8000/api/v1/health
```
