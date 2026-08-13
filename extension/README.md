# Network Engineer Toolkit for VS Code

Local and remote network engineering tools for Visual Studio Code.

## Analyze an IPv4 subnet

Run **Network Tools: Analyze IP/Subnet** from the Command Palette. Enter an IPv4
address with an optional CIDR prefix, such as `10.40.52.17/27`. A bare address is
treated as a `/32` host route.

If the active editor has selected text, a valid selection is analyzed directly.
An invalid selection opens the input box with that text ready to correct. Results
are shown in the **Network Engineer Toolkit** Output Channel.

## Development

```powershell
npm install
npm run compile
npm test
```

The subnet engine is pure TypeScript and has no backend or network dependency.

## Discover a connected switchport

Run **Network Tools: Discover Switchport**, then explicitly select the local
Windows adapter connected to the switch. The command passively listens for LLDP
and CDP advertisements and shows the best correlated switch identity, port, and
management details in the **Network Engineer Toolkit** Output Channel. It sends no
discovery traffic and does not require Internet access or the Ubuntu backend.

For this development milestone, local capture requires Python 3, Scapy, and the
Npcap Windows capture driver. Wireshark and TShark are not used or required. The
optional `networkEngineerToolkit.pythonPath` setting selects Python; otherwise the
extension tries `py -3` and then `python`.

Future packaging is intended to ship the helper and Python/Scapy runtime as a
self-contained executable. That packaging is not implemented yet. Npcap remains
an explicit prerequisite; no redistribution or installer assumptions are made.

## DNS lookup from the lab server

Set `networkEngineerToolkit.backendUrl` to the base URL of the running Ubuntu
backend, then run **Network Tools: DNS Lookup from Lab Server**. The command accepts
a hostname, IPv4 address, or IPv6 address and shows the resolver host in the
**Network Engineer Toolkit** Output Channel.

Selected non-empty editor text is used as the query. Otherwise the command prompts
for a value. DNS resolution always occurs through the configured backend; the
extension does not fall back to local DNS resolution.
