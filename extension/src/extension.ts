import * as vscode from "vscode";

import { registerAnalyzeSubnetCommand } from "./commands/analyzeSubnet";
import { registerDiscoverSwitchportCommand } from "./commands/discoverSwitchport";
import { registerDnsLookupCommand } from "./commands/dnsLookup";
import { registerScannerCommands } from "./commands/scanNetwork";
import { disposeActiveDnsHelpers } from "./local/dns/helperClient";
import { disposeActiveScannerHelpers } from "./local/scanner/helperClient";
import { disposeActiveHelpers } from "./local/switchport/helperClient";
import { NetworkScannerTreeDataProvider, NETWORK_SCANNER_VIEW_ID } from "./views/networkScannerView";
import { registerToolsView } from "./views/toolsView";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(
    "Network Engineer Toolkit",
  );
  const scannerProvider = new NetworkScannerTreeDataProvider();

  context.subscriptions.push(
    outputChannel,
    registerToolsView(),
    scannerProvider,
    vscode.window.registerTreeDataProvider(NETWORK_SCANNER_VIEW_ID, scannerProvider),
    registerAnalyzeSubnetCommand(outputChannel),
    registerDiscoverSwitchportCommand(context, outputChannel),
    registerDnsLookupCommand(context, outputChannel),
    registerScannerCommands(context, outputChannel, scannerProvider),
    { dispose: disposeActiveDnsHelpers },
    { dispose: disposeActiveScannerHelpers },
    { dispose: disposeActiveHelpers },
  );
}

export function deactivate(): void {
  // VS Code disposes registered resources through the extension context.
}
