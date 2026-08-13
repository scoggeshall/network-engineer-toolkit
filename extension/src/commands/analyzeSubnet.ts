import * as vscode from "vscode";

import {
  analyzeSubnet,
  SubnetAnalysis,
  SubnetValidationError,
} from "../local/subnet";

const COMMAND_ID = "networkEngineerToolkit.analyzeSubnet";

export function registerAnalyzeSubnetCommand(
  outputChannel: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(COMMAND_ID, async () => {
    const selectedText = getSelectedText();
    let input = selectedText;

    if (input === undefined || !isValidSubnetInput(input)) {
      input = await promptForSubnet(input);
    }

    if (input === undefined) {
      return;
    }

    try {
      const analysis = analyzeSubnet(input);
      outputChannel.clear();
      outputChannel.appendLine(formatSubnetAnalysis(analysis));
      outputChannel.show(true);
    } catch (error: unknown) {
      const message =
        error instanceof SubnetValidationError
          ? error.message
          : "Unable to analyze the IPv4 subnet.";
      await vscode.window.showErrorMessage(message);
    }
  });
}

export function formatSubnetAnalysis(analysis: SubnetAnalysis): string {
  const broadcast =
    analysis.broadcastAddress ??
    analysis.broadcastDescription ??
    "N/A";

  return [
    "Subnet Analysis",
    "────────────────────────────────",
    "",
    formatLine("Input", analysis.input),
    formatLine("IP Address", analysis.address),
    formatLine("Prefix Length", `/${analysis.prefixLength}`),
    formatLine("Subnet Mask", analysis.subnetMask),
    formatLine("Wildcard Mask", analysis.wildcardMask),
    formatLine("Network Address", analysis.networkAddress),
    formatLine("Broadcast Address", broadcast),
    formatLine("First Usable", analysis.firstUsable),
    formatLine("Last Usable", analysis.lastUsable),
    formatLine("Total Addresses", analysis.totalAddresses.toString()),
    formatLine("Usable Hosts", analysis.usableHosts.toString()),
  ].join("\n");
}

function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.selection.isEmpty) {
    return undefined;
  }

  const text = editor.document.getText(editor.selection).trim();
  return text.length > 0 ? text : undefined;
}

async function promptForSubnet(initialValue?: string): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: "IPv4 address or CIDR",
    placeHolder: "10.40.52.17/27",
    value: initialValue,
    ignoreFocusOut: true,
    validateInput: (value) => validationMessage(value),
  });
}

function isValidSubnetInput(input: string): boolean {
  return validationMessage(input) === undefined;
}

function validationMessage(input: string): string | undefined {
  try {
    analyzeSubnet(input);
    return undefined;
  } catch (error: unknown) {
    return error instanceof SubnetValidationError
      ? error.message
      : "Unable to validate the IPv4 subnet.";
  }
}

function formatLine(label: string, value: string): string {
  return `${`${label}:`.padEnd(19)}${value}`;
}
