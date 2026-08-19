# Network Engineer Toolkit for VS Code

Local network engineering tools for Visual Studio Code on Windows.

Open the **Network Engineer Toolkit** icon on the Activity Bar, then run a tool
from the **Tools** view. The same commands are also available from the Command
Palette.

## Analyze an IPv4 subnet

Run **Network Tools: Analyze IP/Subnet** from the Command Palette. Enter an IPv4
address with an optional CIDR prefix, such as `10.40.52.17/27`. A bare address is
treated as a `/32` host route.

If the active editor has selected text, a valid selection is analyzed directly.
An invalid selection opens the input box with that text ready to correct. Results
are shown in the **Network Engineer Toolkit** Output Channel. The subnet engine is
pure TypeScript.

## DNS lookup

Run **Network Tools: DNS Lookup**. Enter or select a hostname, IPv4 address, or IPv6
address. TypeScript validates the query and invokes a bounded one-shot PowerShell
helper that uses the local workstation's `Resolve-DnsName` capability, returns
structured JSON, and exits. The operation supports cancellation and a timeout; it
does not call a Toolkit server or start a persistent process.

## Discover a connected switchport

Run **Network Tools: Discover Switchport**, then explicitly select the local
Windows adapter connected to the switch. The command passively listens for LLDP
and CDP advertisements and shows the best correlated switch identity, port, and
management details in the **Network Engineer Toolkit** Output Channel. It sends no
discovery traffic and does not require Internet access.

Local capture requires Python 3, Scapy, and the Npcap Windows capture driver.
Wireshark and TShark are not used or required. The optional
`networkEngineerToolkit.pythonPath` setting selects Python; otherwise the extension
tries `py -3` and then `python`.

Python, Scapy, and Npcap are not bundled in v0.1.x. Npcap remains an explicit
prerequisite; no redistribution or installer assumptions are made.

## Scan an IPv4 network

Open **Network Scanner** in the Toolkit sidebar and select **Scan Network**, or run
**Network Tools: Scan Network** from the Command Palette. Enter an IPv4 subnet in
CIDR notation. The first scanner milestone supports at most 254 usable hosts
(`/24` or a smaller host range); larger requests are rejected rather than
truncated.

The bounded one-shot Python helper uses ARP for a directly connected Layer-2
subnet and reports MAC addresses only from those ARP responses. Routed targets use
ICMP discovery and never inherit the next-hop router's MAC address. PTR lookup can
add a hostname, but DNS failure does not remove a discovered device. Results stay
in the native **Network Scanner** Tree View until another scan or **Clear Results**.

Network scanning requires Python 3, Scapy, and Npcap. It does not perform port,
service, operating-system, or vulnerability scanning.

## Requirements

- Windows
- Visual Studio Code 1.85.0 or newer
- Windows PowerShell for local DNS lookups
- Python 3, Scapy, and Npcap for Switchport Discovery and Network Scanner

Wireshark, TShark, Ubuntu, and a Toolkit backend are not required. The extension
runs locally and does not start or contact a Toolkit server.

## Build an installable VSIX

From the `extension` directory:

```powershell
npm install
npm run package
```

The package command performs a clean production TypeScript compile and writes
`dist/network-engineer-toolkit-0.1.1.vsix`. The production package includes the
compiled extension and its PowerShell and Python helper source, but excludes test
code and development artifacts.

## Install v0.1.1

In VS Code, open **Extensions**, choose **Views and More Actions...**, select
**Install from VSIX...**, and choose `network-engineer-toolkit-0.1.1.vsix`.

For an isolated named profile, use the profile-specific CLI form:

```powershell
code --profile "Network Engineer Toolkit Dev" --install-extension `
  .\dist\network-engineer-toolkit-0.1.1.vsix
```

This repository uses the existing `Network Engineer Toolkit Dev` profile for
installed-extension testing. Do not install development builds into a normal or
default VS Code profile.

## Development

Run local checks from this directory:

```powershell
npm install
npm test
python -m unittest discover -s helper/test -v
python -m unittest discover -s helper/test_scanner -v
powershell.exe -NoLogo -NoProfile -NonInteractive `
  -File helper/dns/main.ps1 -Query example.com
```

GUI testing is restricted to the existing `Network Engineer Toolkit Dev` VS Code
profile. Do not modify the normal/default profile or global VS Code environment.
