import * as vscode from "vscode";

export const TOOLS_VIEW_ID = "networkEngineerToolkit.tools";

// Keep the tree empty so viewsWelcome buttons are shown. Later tools can
// replace this provider with a real tree.
export function registerToolsView(): vscode.Disposable {
  return vscode.window.registerTreeDataProvider(TOOLS_VIEW_ID, {
    getTreeItem(element: never): vscode.TreeItem {
      return element;
    },
    getChildren(): never[] {
      return [];
    },
  });
}
