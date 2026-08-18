import * as vscode from "vscode";

import { DnsHelperError, lookupDns } from "../local/dns/helperClient";
import { formatDnsLookup } from "../local/dns/presentation";
import { DnsValidationError, resolveDnsCommandQuery } from "../local/dns/query";

const COMMAND_ID = "networkEngineerToolkit.dnsLookup";

export function registerDnsLookupCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(COMMAND_ID, async () => {
    try {
      const query = await resolveDnsCommandQuery(getSelectedText(), promptForDnsQuery);
      if (query === undefined) {
        return;
      }
      if (process.platform !== "win32") {
        throw new DnsHelperError(
          "unsupported_platform",
          "DNS Lookup currently uses Resolve-DnsName on the local Windows workstation.",
        );
      }
      const helperPath = context.asAbsolutePath("helper/dns/main.ps1");
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Resolving ${query} locally...`,
          cancellable: true,
        },
        async (_progress, token) => lookupDns(helperPath, query, token),
      );
      if (result.status !== "success") {
        await vscode.window.showErrorMessage(result.message);
        return;
      }

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
    prompt: "Hostname or IP address to resolve on this Windows workstation",
    placeHolder: "example.com",
    ignoreFocusOut: true,
  });
}

function toUserMessage(error: unknown): string {
  if (error instanceof DnsValidationError || error instanceof DnsHelperError) {
    return error.message;
  }
  return "Local DNS lookup failed unexpectedly.";
}
