# Network Engineer Toolkit for VS Code

Local network engineering tools for Visual Studio Code on Windows.

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

During development, local capture requires Python 3, Scapy, and the Npcap Windows
capture driver. Wireshark and TShark are not used or required. The optional
`networkEngineerToolkit.pythonPath` setting selects Python; otherwise the extension
tries `py -3` and then `python`.

Future packaging may ship the helper and Python/Scapy runtime as a self-contained
executable. That packaging is not implemented. Npcap remains an explicit
prerequisite; no redistribution or installer assumptions are made.

## Development

Run local checks from this directory:

```powershell
npm install
npm test
python -m unittest discover -s helper/test -v
powershell.exe -NoLogo -NoProfile -NonInteractive `
  -File helper/dns/main.ps1 -Query example.com
```

GUI testing is restricted to the existing `Network Engineer Toolkit Dev` VS Code
profile. Do not modify the normal/default profile or global VS Code environment.
