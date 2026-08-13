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

## DNS lookup from the lab server

Set `networkEngineerToolkit.backendUrl` to the base URL of the running Ubuntu
backend, then run **Network Tools: DNS Lookup from Lab Server**. The command accepts
a hostname, IPv4 address, or IPv6 address and shows the resolver host in the
**Network Engineer Toolkit** Output Channel.

Selected non-empty editor text is used as the query. Otherwise the command prompts
for a value. DNS resolution always occurs through the configured backend; the
extension does not fall back to local DNS resolution.
