# Codex Project Notes

Use the Windows/local `network-engineer-toolkit` project and repository at
`C:\scripts\network-engineer-toolkit` for all development and testing. Toolkit
runtime and development are local-only; do not use an Ubuntu clone or cross-host
workflow for this repository.

The authoritative workflow, architecture, safety, Git, VS Code isolation, and
engineering rules are in [`../AGENTS.md`](../AGENTS.md). Product architecture is
summarized in [`../docs/architecture.md`](../docs/architecture.md). Keep this file
concise so policy does not drift.

Do not store credentials, tokens, machine-specific secrets, or user-specific
configuration in this directory.
