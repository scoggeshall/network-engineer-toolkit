import * as vscode from "vscode";

import { registerAnalyzeSubnetCommand } from "./commands/analyzeSubnet";
import { registerDiscoverSwitchportCommand } from "./commands/discoverSwitchport";
import { registerDnsLookupCommand } from "./commands/dnsLookup";
import { disposeActiveDnsHelpers } from "./local/dns/helperClient";
import { disposeActiveHelpers } from "./local/switchport/helperClient";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(
    "Network Engineer Toolkit",
  );

  context.subscriptions.push(
    outputChannel,
    registerAnalyzeSubnetCommand(outputChannel),
    registerDiscoverSwitchportCommand(context, outputChannel),
    registerDnsLookupCommand(context, outputChannel),
    { dispose: disposeActiveDnsHelpers },
    { dispose: disposeActiveHelpers },
  );
}

export function deactivate(): void {
  // VS Code disposes registered resources through the extension context.
}
