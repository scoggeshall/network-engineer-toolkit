# Repository Agent Guide

## Authority and Scope

This file is the authoritative development and engineering policy for the
`network-engineer-toolkit` repository. Supporting documents should summarize or
link to this policy instead of maintaining independent copies.

Network Engineer Toolkit is a local-first VS Code extension for Windows. All
Toolkit runtime execution occurs on the local workstation. The repository's
active product components are:

- `extension/`: TypeScript product code plus bounded PowerShell and Python helpers.
- `docs/`: architecture and development documentation.

The Toolkit has no FastAPI or Flask backend, Ubuntu execution tier, remote
diagnostics service, persistent local service, localhost HTTP API, or
Toolkit-specific client/server architecture. Do not reintroduce one.

Remote routers, switches, servers, controllers, DNS servers, SNMP agents, SSH
destinations, REST APIs, and other network services may be targets or data sources
for individual tools. They are not Toolkit execution backends.

## Local Runtime Architecture

TypeScript owns the product experience: VS Code APIs, commands, views, settings,
progress and cancellation, typed models, validation, orchestration, and result
presentation. Prefer TypeScript for simple calculations, lightweight parsing, and
pure local application logic.

Use PowerShell when Windows exposes a capability cleanly, including
`Get-NetAdapter`, `Get-NetIPConfiguration`, `Get-NetNeighbor`, `Get-NetRoute`,
`Get-NetTCPConnection`, `Resolve-DnsName`, `Test-NetConnection`, Windows services,
the registry, event logs, and other Windows networking state. Return structured
objects as JSON; do not parse formatted console tables.

Use Python when networking or protocol libraries materially improve the feature,
including Scapy/Npcap, LLDP/CDP, packet and protocol decoding, configuration
parsing, vendor APIs, scanners, and concurrent network operations.

PowerShell and Python helpers are implementation details of the extension. They
must not become persistent services, independent applications, daemons, or HTTP
servers.

## Helper Execution Contract

Local helpers normally follow a spawn, bounded operation, structured result, and
exit lifecycle. TypeScript must retain exact ownership of every child process.

- Invoke only an allowlisted executable and helper operation.
- Pass validated values as argument-array elements with shell execution disabled.
- Use stdout only for the documented structured result, normally JSON.
- Use stderr for bounded diagnostics.
- Enforce runtime and output limits.
- Support cancellation when an operation can wait.
- Terminate the exact owned child on cancellation, timeout, extension disposal,
  or operation teardown.
- Validate helper output before presenting or using it.

Long-running features such as a future path monitor may use an explicitly owned
child process or stream, but its lifetime must remain bound to the active VS Code
operation. A long-running feature does not authorize a persistent service.

## Development Environment

The authoritative development environment is the Windows repository at
`C:\scripts\network-engineer-toolkit`. Develop and test all Toolkit components
locally on Windows. Do not use or modify an Ubuntu clone for Toolkit development.

Run TypeScript, PowerShell, Python, packaging, and other checks locally. Do not
introduce CI/CD, hosted runners, cloud build systems, or cloud secret dependencies
unless explicitly requested. Never enable GitHub Actions, call GitHub Actions
permissions APIs, or create workflow files.

### VS Code isolation

Do not modify the user's normal/default VS Code environment, including settings,
profiles, extensions, terminal profiles, keybindings, snippets, themes, workspace
trust, Python configuration, Git configuration, or Remote SSH configuration.
User-owned files under `%APPDATA%\Code\User\` and `%USERPROFILE%\.vscode\` are
read-only unless an explicit task authorizes a specific change.

The existing `Network Engineer Toolkit Dev` profile is the only profile authorized
for GUI and Extension Development Host testing. Do not create, recreate, delete,
reset, rename, import into, overwrite, or make it the default profile. Do not
change unrelated settings in it. Inspect local VS Code CLI help before using any
profile option. If a required setting is missing, report it and stop before
changing the profile.

Do not add `.vscode/settings.json` values to work around profile isolation.
Repository debug and task configuration is acceptable only when it is
profile-neutral, useful to project development, and does not reconfigure the
user's environment.

## Git and Repository Safety

The GitHub repository `scoggeshall/network-engineer-toolkit` is intentionally
private. Local authenticated Git is authoritative for access checks. Do not change
repository visibility or repair credentials, PATs, SSH keys, Git transport,
GitHub CLI authentication, or Git Credential Manager configuration unless
explicitly authorized. If authenticated fetch or push fails, report the exact
error and stop.

Before repository work, inspect branch, status, origin, and recent history. Stop
if unexpected changes overlap the task. Preserve user changes and never use
`git reset --hard`, `git clean -fd`, force push, or other destructive alignment
operations unless the user explicitly authorizes the exact action.

Do not commit or push unless the user explicitly requests it or the active task
explicitly authorizes it. Stage only relevant files.

## Engineering and Security Rules

- Prefer small, reviewable, locally testable changes within the requested scope.
- Keep VS Code integration separate from local utilities and helper orchestration.
- Validate all external input and structured helper output.
- Give clear, practical errors instead of silent failures.
- Make each diagnostic's local or remote target vantage point explicit.
- Do not expose arbitrary shell execution or raw SSH through the extension.
- Keep diagnostic operations allowlisted, validated, read-only where possible,
  and bounded by timeouts and output limits.
- Treat targets, configurations, command output, reports, and packet captures as
  potentially sensitive.
- Do not commit secrets, credentials, private keys, tokens, packet captures,
  generated reports, or local environment files. Use environment variables,
  Windows Credential Manager, keyring, VS Code SecretStorage, or existing local
  configuration patterns.
- Do not alter SSH authentication, sudo policy, firewall policy, or public service
  exposure as part of ordinary development.
- Do not add telemetry or transmit user data unless explicitly documented and
  approved.
- Preserve cross-platform compatibility for pure code where practical, while
  reporting Windows-only capability requirements clearly.
- Update documentation when changing architecture, setup, trust boundaries,
  helper contracts, or operator workflows.

## Component Expectations

### TypeScript extension

- Use strict TypeScript and typed boundaries.
- Keep commands thin and separate presentation, validation, and capability code.
- Use VS Code configuration and SecretStorage appropriately.
- Handle missing local prerequisites gracefully.

### PowerShell helpers

- Use `-NoProfile` and non-interactive execution.
- Prefer native Windows cmdlets and structured JSON.
- Avoid global state changes, profile edits, and formatted-table parsing.
- Sanitize user-facing errors and keep diagnostic detail bounded.

### Python helpers

- Use type annotations and clear module boundaries.
- Keep dependencies and platform prerequisites explicit.
- Add focused tests for validation, parsing, errors, and command construction.
- Keep helpers bounded and one-shot unless an active operation explicitly owns a
  longer-lived child.

## Validation

Run relevant checks locally in the Windows environment. The current extension
baseline is:

```powershell
cd extension
npm install
npm test
python -m unittest discover -s helper/test -v
```

Also exercise changed PowerShell helpers directly with safe representative input.
Use the existing dedicated VS Code development profile only when GUI validation
is genuinely needed. Finish with `git diff --check`, an architecture-invariant
search, and a review of `git status` and `git diff`.
