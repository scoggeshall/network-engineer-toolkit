# Repository Instructions

Follow [`../AGENTS.md`](../AGENTS.md) as the authoritative repository policy and
[`../docs/architecture.md`](../docs/architecture.md) for product architecture.

Network Engineer Toolkit is a local-first Windows VS Code extension. TypeScript
owns the product experience and may orchestrate bounded, one-shot PowerShell or
Python helpers. Do not add a server, daemon, localhost API, remote execution tier,
or Toolkit-specific client/server architecture.

Keep changes small and locally testable. Preserve structured helper boundaries,
validated argument arrays, explicit diagnostic vantage points, practical errors,
sensitive-data handling, and the prohibition on arbitrary shell or raw SSH
exposure. Do not modify the user's normal VS Code profile or environment. Do not
create GitHub Actions workflows or rely on hosted CI, builds, tests, or packaging.
