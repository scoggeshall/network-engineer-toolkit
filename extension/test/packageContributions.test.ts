import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const extensionRoot = path.resolve(__dirname, "..", "..");

interface ExtensionManifest {
  version: string;
  icon: string;
  contributes: {
    commands: Array<{ command: string; title: string; icon?: string }>;
    viewsContainers: {
      activitybar: Array<{ id: string; title: string; icon: string }>;
    };
    views: {
      networkEngineerToolkit: Array<{ id: string; name: string; icon?: string }>;
    };
    viewsWelcome: Array<{ view: string; contents: string }>;
    menus: {
      "view/title": Array<{ command: string; when: string; group: string }>;
    };
  };
}

function loadManifest(): ExtensionManifest {
  const raw = readFileSync(path.join(extensionRoot, "package.json"), "utf8");
  return JSON.parse(raw) as ExtensionManifest;
}

describe("package contributions", () => {
  const manifest = loadManifest();

  it("keeps the marketplace icon as the color Py Scout PNG", () => {
    assert.equal(manifest.icon, "assets/pyscout.png");
    assert.equal(manifest.version, "0.2.0");
  });

  it("contributes one Activity Bar view container", () => {
    const containers = manifest.contributes.viewsContainers.activitybar;
    assert.equal(containers.length, 1);
    assert.deepEqual(containers[0], {
      id: "networkEngineerToolkit",
      title: "Network Engineer Toolkit",
      icon: "assets/pyscout-activity.svg",
    });
  });

  it("contributes Tools and the structured Network Scanner view", () => {
    const views = manifest.contributes.views.networkEngineerToolkit;
    assert.equal(views.length, 2);
    assert.equal(views[0].id, "networkEngineerToolkit.tools");
    assert.equal(views[0].name, "Tools");
    assert.equal(views[0].icon, "assets/pyscout-activity.svg");
    assert.deepEqual(views[1], {
      id: "networkEngineerToolkit.scanner",
      name: "Network Scanner",
    });
  });

  it("uses viewsWelcome buttons that invoke existing commands", () => {
    const welcome = manifest.contributes.viewsWelcome;
    assert.equal(welcome.length, 2);
    const toolsWelcome = welcome.find((entry) => entry.view === "networkEngineerToolkit.tools");
    assert.ok(toolsWelcome);

    const contents = toolsWelcome.contents;
    assert.match(contents, /^NETWORK ENGINEER TOOLKIT/m);
    assert.match(contents, /^Network Tools$/m);
    assert.match(
      contents,
      /\[Analyze IP\/Subnet\]\(command:networkEngineerToolkit\.analyzeSubnet\)/,
    );
    assert.match(
      contents,
      /\[DNS Lookup\]\(command:networkEngineerToolkit\.dnsLookup\)/,
    );
    assert.match(
      contents,
      /\[Discover Switchport\]\(command:networkEngineerToolkit\.discoverSwitchport\)/,
    );
    assert.doesNotMatch(contents, /\bv\d+\.\d+\.\d+\b/);

    const commandIds = manifest.contributes.commands.map((entry) => entry.command);
    assert.deepEqual(
      new Set(commandIds),
      new Set([
        "networkEngineerToolkit.analyzeSubnet",
        "networkEngineerToolkit.dnsLookup",
        "networkEngineerToolkit.discoverSwitchport",
        "networkEngineerToolkit.scanNetwork",
        "networkEngineerToolkit.clearScanResults",
      ]),
    );
    assert.equal(commandIds.length, 5);

    const toolsViewSource = readFileSync(
      path.join(extensionRoot, "src", "views", "toolsView.ts"),
      "utf8",
    );
    assert.match(toolsViewSource, /registerTreeDataProvider/);
    assert.match(toolsViewSource, /getChildren\(\): never\[\] \{\s*return \[\];\s*\}/);
    assert.doesNotMatch(toolsViewSource, /command:/);
  });

  it("offers scanner actions while keeping scanner results in a Tree View", () => {
    const welcome = manifest.contributes.viewsWelcome.find(
      (entry) => entry.view === "networkEngineerToolkit.scanner",
    );
    assert.ok(welcome);
    assert.match(welcome.contents, /\[Scan Network\]\(command:networkEngineerToolkit\.scanNetwork\)/);

    const titleCommands = manifest.contributes.menus["view/title"];
    assert.deepEqual(titleCommands.map((entry) => entry.command), [
      "networkEngineerToolkit.scanNetwork",
      "networkEngineerToolkit.clearScanResults",
    ]);
    assert.ok(titleCommands.every((entry) => entry.when === "view == networkEngineerToolkit.scanner"));

    const scannerViewSource = readFileSync(
      path.join(extensionRoot, "src", "views", "networkScannerView.ts"),
      "utf8",
    );
    assert.match(scannerViewSource, /implements vscode\.TreeDataProvider/);
    assert.doesNotMatch(scannerViewSource, /Webview/);
  });

  it("ships a 24x24 monochrome Activity Bar SVG instead of the color PNG", () => {
    const iconPath = path.join(extensionRoot, "assets", "pyscout-activity.svg");
    assert.equal(existsSync(iconPath), true);

    const svg = readFileSync(iconPath, "utf8");
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /width="24"/);
    assert.match(svg, /height="24"/);
    assert.doesNotMatch(svg, /pyscout\.png/);
    assert.doesNotMatch(svg, /#[Ff]{2}[Dd]{2}00|#FFD700|#FFC107|#2196[Ff]{2}|#1[Ee]3[Aa]8[Aa]|rgb\(/i);
  });
});
