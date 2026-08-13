from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from adapters import list_adapters, resolve_adapter
from capture import DEFAULT_GRACE_SECONDS, DEFAULT_TIMEOUT_SECONDS, capture_advertisements
from correlate import normalize_result
from models import HelperError


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Network Engineer Toolkit switchport helper")
    subparsers = parser.add_subparsers(dest="operation", required=True)
    subparsers.add_parser("list-adapters")
    discover = subparsers.add_parser("discover-switchport")
    discover.add_argument("--adapter", required=True)
    discover.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS, choices=range(1, 61))
    discover.add_argument("--grace", type=int, default=DEFAULT_GRACE_SECONDS, choices=range(0, 31))
    return parser


def run(arguments: list[str] | None = None) -> dict[str, Any]:
    options = _parser().parse_args(arguments)
    if options.operation == "list-adapters":
        return {"status": "success", "adapters": [item.to_dict() for item in list_adapters()]}
    adapter = resolve_adapter(options.adapter)
    advertisements = capture_advertisements(
        adapter,
        timeout_seconds=options.timeout,
        grace_seconds=options.grace,
    )
    return normalize_result(adapter, advertisements)


def main() -> int:
    try:
        result = run()
    except HelperError as exc:
        result = {"status": exc.status, "error_code": exc.error_code, "message": str(exc)}
    except SystemExit:
        raise
    except Exception:
        result = {
            "status": "error",
            "error_code": "helper_failed",
            "message": "Switchport discovery helper failed unexpectedly.",
        }
    print(json.dumps(result, separators=(",", ":")))
    return 0 if result.get("status") in {"success", "timeout", "cancelled"} else 2


if __name__ == "__main__":
    sys.exit(main())
