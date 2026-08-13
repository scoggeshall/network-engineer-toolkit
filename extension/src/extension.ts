import * as vscode from "vscode";

import { registerAnalyzeSubnetCommand } from "./commands/analyzeSubnet";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(
    "Network Engineer Toolkit",
  );

  context.subscriptions.push(
    outputChannel,
    registerAnalyzeSubnetCommand(outputChannel),
  );
}

export function deactivate(): void {
  // VS Code disposes registered resources through the extension context.
}
