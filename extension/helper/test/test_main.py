from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

HELPER = Path(__file__).resolve().parents[1] / "switchport"
sys.path.insert(0, str(HELPER))

import main  # noqa: E402
from models import CaptureAdapter, HelperError  # noqa: E402


class MainContractTests(unittest.TestCase):
    @patch("main.list_adapters")
    def test_list_adapters_contract(self, mocked: object) -> None:
        mocked.return_value = [CaptureAdapter(id="capture", name="Ethernet")]
        result = main.run(["list-adapters"])
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["adapters"][0]["id"], "capture")

    def test_error_contract_has_no_traceback(self) -> None:
        error = HelperError("scapy_missing", "Scapy is not available.", status="unavailable")
        result = {"status": error.status, "error_code": error.error_code, "message": str(error)}
        self.assertEqual(json.loads(json.dumps(result))["error_code"], "scapy_missing")
        self.assertNotIn("Traceback", result["message"])

    def test_cli_emits_one_json_document(self) -> None:
        result = subprocess.run(
            [sys.executable, str(HELPER / "main.py"), "list-adapters"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        self.assertEqual(json.loads(result.stdout)["status"], "success")


if __name__ == "__main__":
    unittest.main()
