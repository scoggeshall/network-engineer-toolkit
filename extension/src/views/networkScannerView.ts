import * as vscode from "vscode";

import { ScannerSuccess } from "../local/scanner/models";
import { ScannerResultsStore, ScannerTreeNode } from "../local/scanner/treeModel";

export const NETWORK_SCANNER_VIEW_ID = "networkEngineerToolkit.scanner";

export class NetworkScannerTreeDataProvider implements vscode.TreeDataProvider<ScannerTreeNode> {
  private readonly changed = new vscode.EventEmitter<ScannerTreeNode | undefined | void>();
  private readonly store = new ScannerResultsStore();

  public readonly onDidChangeTreeData = this.changed.event;

  public replace(result: ScannerSuccess): void {
    this.store.replace(result);
    this.changed.fire();
  }

  public clear(): void {
    this.store.clear();
    this.changed.fire();
  }

  public getTreeItem(element: ScannerTreeNode): vscode.TreeItem {
    const collapsibleState = element.children.length > 0
      ? element.kind === "device"
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(element.label, collapsibleState);
    item.description = element.description;
    item.contextValue = `networkScanner.${element.kind}`;
    item.iconPath = new vscode.ThemeIcon(
      element.kind === "subnet"
        ? "globe"
        : element.kind === "devices"
          ? "server-process"
          : element.kind === "device"
            ? "device-desktop"
            : "symbol-field",
    );
    return item;
  }

  public getChildren(element?: ScannerTreeNode): ScannerTreeNode[] {
    return element ? element.children : this.store.getTree();
  }

  public dispose(): void {
    this.changed.dispose();
  }
}
