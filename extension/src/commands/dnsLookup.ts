import * as vscode from "vscode";

import {
  BackendClient,
  BackendConfigurationError,
  BackendHttpError,
  BackendTimeoutError,
  BackendUnavailableError,
  MalformedBackendResponseError,
} from "../remote/backendClient";
import { formatDnsLookup } from "../remote/dnsPresentation";

const COMMAND_ID = "networkEngineerToolkit.remoteDnsLookup";

export function registerRemoteDnsLookupCommand(
  outputChannel: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(COMMAND_ID, async () => {
    const selectedText = getSelectedText();
    const input = selectedText ?? (await promptForDnsQuery());
    if (input === undefined) {
      return;
    }

    const query = input.trim();
    if (query.length === 0) {
      await vscode.window.showErrorMessage("Enter a hostname or IP address.");
      return;
    }

    try {
      const backendUrl = vscode.workspace
        .getConfiguration("networkEngineerToolkit")
        .get<string>("backendUrl", "");
      const result = await new BackendClient(backendUrl).lookupDns(query);

      outputChannel.clear();
      outputChannel.appendLine(formatDnsLookup(result));
      outputChannel.show(true);
    } catch (error: unknown) {
      await vscode.window.showErrorMessage(toUserMessage(error));
    }
  });
}

function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return undefined;
  }

  const text = editor.document.getText(editor.selection).trim();
  return text.length > 0 ? text : undefined;
}

async function promptForDnsQuery(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: "Hostname or IP address to resolve from the lab server",
    placeHolder: "example.com",
    ignoreFocusOut: true,
  });
}

function toUserMessage(error: unknown): string {
  if (error instanceof BackendConfigurationError) {
    return error.message;
  }
  if (error instanceof BackendUnavailableError) {
    return (
      "Unable to reach the Network Engineer Toolkit backend. " +
      "Check networkEngineerToolkit.backendUrl and confirm the lab server is running."
    );
  }
  if (error instanceof BackendTimeoutError) {
    return "The Network Engineer Toolkit backend request timed out.";
  }
  if (error instanceof MalformedBackendResponseError) {
    return error.message;
  }
  if (error instanceof BackendHttpError) {
    if (error.status === 400) {
      return `Invalid DNS query: ${error.message}`;
    }
    if (error.status === 404) {
      return `DNS resolution failed on the lab server: ${error.message}`;
    }
    if (error.status === 504) {
      return "DNS resolution timed out on the lab server.";
    }
    return `Lab server request failed: ${error.message}`;
  }
  return "Remote DNS lookup failed unexpectedly.";
}
