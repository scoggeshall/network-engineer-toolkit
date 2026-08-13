# Codex Project Notes

Use the Windows/local `network-engineer-toolkit` Codex project as the single primary
control plane for this repository:

- Windows repository: `C:\scripts\network-engineer-toolkit`
- Ubuntu access: SSH host `lab01`
- Ubuntu repository: `/home/scoggeshall/projects/network-engineer-toolkit`

Edit Windows-owned files locally and develop `backend/` on Ubuntu through SSH. Do
not use Codex host handoff or a parallel Ubuntu Codex conversation for normal
project development.

The authoritative workflow, ownership, Git, safety, and engineering rules are in
[`../AGENTS.md`](../AGENTS.md). Product and cross-host architecture are in
[`../docs/architecture.md`](../docs/architecture.md). Keep this file concise so
policy does not drift.

Do not store credentials, tokens, machine-specific secrets, or user-specific
configuration in this directory.
