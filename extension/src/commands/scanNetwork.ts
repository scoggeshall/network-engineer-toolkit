import * as vscode from "vscode";

import { scanNetwork, ScannerHelperError } from "../local/scanner/helperClient";
import { ScannerFailure, ScannerSuccess } from "../local/scanner/models";
import { normalizeScanSubnet } from "../local/scanner/subnet";
import { resolvePythonRuntime } from "../local/switchport/helperClient";
import { NetworkScannerTreeDataProvider } from "../views/networkScannerView";

function failureMessage(failure: ScannerFailure): string {
  return failure.message || "Network scan failed.";
}

function validateSubnetInput(value: string): string | undefined {
  try {
    normalizeScanSubnet(value);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Enter a valid IPv4 subnet in CIDR notation.";
  }
}

function appendScanSummary(outputChannel: vscode.OutputChannel, result: ScannerSuccess): void {
  outputChannel.appendLine(`Network Scan — ${result.subnet}`);
  outputChannel.appendLine(`Discovery: ${result.route.mode === "direct" ? "Direct-L2 ARP" : "Routed ICMP"}`);
  outputChannel.appendLine(`Devices: ${result.devices.length}`);
  for (const device of result.devices) {
    const identity = [device.hostname, device.mac_address].filter(Boolean).join(" — ");
    outputChannel.appendLine(`  ${device.ip}${identity ? ` — ${identity}` : ""}`);
  }
  outputChannel.appendLine("");
}

function showError(error: unknown): void {
  if (error instanceof ScannerHelperError && error.code === "cancelled") {
    void vscode.window.showInformationMessage(error.message);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(message);
}

export function registerScannerCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  provider: NetworkScannerTreeDataProvider,
): vscode.Disposable {
  const scan = vscode.commands.registerCommand("networkEngineerToolkit.scanNetwork", async () => {
    try {
      if (process.platform !== "win32") {
        throw new ScannerHelperError(
          "unsupported_platform",
          "Network Scanner currently runs from the local Windows workstation only.",
        );
      }
      const input = await vscode.window.showInputBox({
        title: "Network Scanner",
        prompt: "IPv4 subnet in CIDR notation",
        placeHolder: "192.168.1.0/24",
        ignoreFocusOut: true,
        validateInput: validateSubnetInput,
      });
      if (input === undefined) {
        return;
      }
      const target = normalizeScanSubnet(input);
      const configuredPython = vscode.workspace
        .getConfiguration("networkEngineerToolkit")
        .get<string>("pythonPath");
      const runtime = await resolvePythonRuntime(configuredPython);
      const helperPath = context.asAbsolutePath("helper/scanner/main.py");
      const response = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Scanning ${target.cidr}...`,
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ message: "Discovering hosts and resolving identities" });
          return scanNetwork(runtime, helperPath, target.cidr, token);
        },
      );
      if (response.status !== "success") {
        if (response.status === "cancelled") {
          void vscode.window.showInformationMessage(failureMessage(response));
        } else {
          void vscode.window.showErrorMessage(failureMessage(response));
        }
        return;
      }
      provider.replace(response);
      appendScanSummary(outputChannel, response);
      void vscode.window.showInformationMessage(
        `Discovered ${response.devices.length} device${response.devices.length === 1 ? "" : "s"} on ${response.subnet}.`,
      );
    } catch (error) {
      showError(error);
    }
  });

  const clear = vscode.commands.registerCommand("networkEngineerToolkit.clearScanResults", () => {
    provider.clear();
    void vscode.window.showInformationMessage("Network Scanner results cleared.");
  });

  return vscode.Disposable.from(scan, clear);
}

export { validateSubnetInput };
