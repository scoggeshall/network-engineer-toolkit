# Network Engineer Toolkit for VS Code

Local network engineering tools for Visual Studio Code.

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
