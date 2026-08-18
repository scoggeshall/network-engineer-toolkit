# Network Engineer Toolkit

Network Engineer Toolkit is a local-first VS Code extension for Windows network
engineering workflows. TypeScript owns the product experience and orchestrates
bounded local PowerShell or Python helpers when Windows APIs or protocol libraries
are the better implementation fit.

Current tools:

- **Network Tools: Analyze IP/Subnet** — pure TypeScript IPv4 subnet analysis.
- **Network Tools: DNS Lookup** — local Windows DNS resolution through a one-shot
  PowerShell helper using `Resolve-DnsName`.
- **Network Tools: Discover Switchport** — passive local LLDP/CDP capture through
  a one-shot Python/Scapy helper and Npcap.

The Toolkit does not run a server, daemon, localhost API, or remote execution
tier. Network devices and services can be tool targets or data sources, but all
Toolkit runtime execution is owned by the local VS Code operation.

See [docs/architecture.md](docs/architecture.md) for the architecture and
[AGENTS.md](AGENTS.md) for authoritative development policy.
