import * as vscode from "vscode";

import {
  discoverSwitchport,
  HelperClientError,
  listAdapters,
  resolvePythonRuntime,
} from "../local/switchport/helperClient";
import { CaptureAdapter, HelperFailure } from "../local/switchport/models";
import { formatSwitchportDiscovery } from "../local/switchport/presentation";

interface AdapterPick extends vscode.QuickPickItem {
  adapter: CaptureAdapter;
}

function adapterPick(adapter: CaptureAdapter): AdapterPick {
  return {
    label: adapter.name,
    description: adapter.description,
    detail: `${adapter.status || "unknown"} — ${adapter.kind}${adapter.link_speed ? ` — ${adapter.link_speed}` : ""} — ${adapter.reason}`,
    adapter,
  };
}

function failureMessage(failure: HelperFailure): string {
  return failure.message || "Switchport discovery failed.";
}

function showError(error: unknown): void {
  if (error instanceof HelperClientError && error.code === "cancelled") {
    void vscode.window.showInformationMessage(error.message);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(message);
}

export function registerDiscoverSwitchportCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand("networkEngineerToolkit.discoverSwitchport", async () => {
    try {
      if (process.platform !== "win32") {
        throw new HelperClientError(
          "unsupported_platform",
          "Switchport Discovery currently captures on local Windows adapters only.",
        );
      }
      const configuredPython = vscode.workspace
        .getConfiguration("networkEngineerToolkit")
        .get<string>("pythonPath");
      const runtime = await resolvePythonRuntime(configuredPython);
      const helperPath = context.asAbsolutePath("helper/switchport/main.py");
      const adapterResponse = await listAdapters(runtime, helperPath);
      if (adapterResponse.status !== "success") {
        throw new HelperClientError(
          adapterResponse.error_code ?? adapterResponse.status,
          failureMessage(adapterResponse),
        );
      }
      const usableAdapters = adapterResponse.adapters.filter((adapter) => adapter.is_up !== false);
      if (usableAdapters.length === 0) {
        throw new HelperClientError("adapter_unavailable", "No usable local capture adapters were found.");
      }
      const selected = await vscode.window.showQuickPick(usableAdapters.map(adapterPick), {
        title: "Discover Switchport — Capture Adapter",
        placeHolder: "Select the local Windows adapter connected to the switch",
        matchOnDescription: true,
        matchOnDetail: true,
        ignoreFocusOut: true,
      });
      if (!selected) {
        return;
      }
      const response = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Listening for LLDP/CDP on ${selected.label}...`,
          cancellable: true,
        },
        async (_progress, token) =>
          discoverSwitchport(runtime, helperPath, selected.adapter.id, token),
      );
      if (response.status !== "success") {
        if (response.status === "cancelled") {
          void vscode.window.showInformationMessage(response.message);
        } else {
          void vscode.window.showErrorMessage(failureMessage(response));
        }
        return;
      }
      outputChannel.appendLine(formatSwitchportDiscovery(response));
      outputChannel.appendLine("");
      outputChannel.show(true);
      void vscode.window.showInformationMessage(
        response.switch_port
          ? `Connected to ${response.switch_name ?? "switch"} on ${response.switch_port}.`
          : `Discovered ${response.switch_name ?? "a switch"}; no port identifier was advertised.`,
      );
    } catch (error) {
      showError(error);
    }
  });
}
