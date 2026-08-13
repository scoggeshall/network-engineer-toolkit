# Repository Instructions

Follow [`../AGENTS.md`](../AGENTS.md) as the authoritative repository policy and
[`../docs/architecture.md`](../docs/architecture.md) for product and cross-host
architecture.

Use the Windows clone as the primary control environment. Edit `extension/`,
documentation, GitHub metadata, and repository-level files on Windows; develop
`backend/` on Ubuntu through SSH host `lab01`. Do not independently edit the same
files on both hosts or use parallel Codex conversations for the two clones.

Keep changes small and testable. Preserve explicit network vantage points,
structured errors, sensitive-data handling, allowlisted read-only diagnostics, and
the prohibition on arbitrary shell or raw SSH exposure through the application.
Do not add premature infrastructure or implementation beyond the active request.
