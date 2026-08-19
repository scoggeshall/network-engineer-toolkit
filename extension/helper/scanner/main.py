from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from discovery import (
    DEFAULT_ARP_TIMEOUT_SECONDS,
    DEFAULT_DNS_WORKERS,
    DEFAULT_ICMP_TIMEOUT_SECONDS,
    scan_network,
)
from models import HelperError


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Network Engineer Toolkit scanner helper")
    subparsers = parser.add_subparsers(dest="operation", required=True)
    scan = subparsers.add_parser("scan-network")
    scan.add_argument("--subnet", required=True)
    scan.add_argument(
        "--arp-timeout",
        type=float,
        default=DEFAULT_ARP_TIMEOUT_SECONDS,
        choices=(1.0, 2.0, 3.0),
    )
    scan.add_argument(
        "--icmp-timeout",
        type=float,
        default=DEFAULT_ICMP_TIMEOUT_SECONDS,
        choices=(1.0, 2.0, 3.0),
    )
    scan.add_argument(
        "--dns-workers",
        type=int,
        default=DEFAULT_DNS_WORKERS,
        choices=range(1, 17),
    )
    return parser


def run(arguments: list[str] | None = None) -> dict[str, Any]:
    options = _parser().parse_args(arguments)
    result = scan_network(
        options.subnet,
        arp_timeout_seconds=options.arp_timeout,
        icmp_timeout_seconds=options.icmp_timeout,
        dns_workers=options.dns_workers,
    )
    return result.to_dict()


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
            "message": "Network scanner helper failed unexpectedly.",
        }
    print(json.dumps(result, separators=(",", ":")))
    return 0 if result.get("status") in {"success", "timeout", "cancelled"} else 2


if __name__ == "__main__":
    sys.exit(main())
