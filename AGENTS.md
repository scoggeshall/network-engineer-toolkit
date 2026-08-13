# Repository Agent Guide

## Authority and Scope

This file is the authoritative development and engineering policy for the
`network-engineer-toolkit` repository. Supporting documents should summarize or
link to this policy instead of maintaining independent copies of it.

This repository contains a planned hybrid network-engineering toolkit:

- `extension/`: a TypeScript VS Code extension for local tools and user interaction.
- `backend/`: a Python service for remote diagnostics, parsing, packet-capture
  analysis, and possible future integrations.
- `docs/`: architecture, contracts, development notes, and deployment documentation.

## Cross-Host Development Model

- Primary Codex control environment: **Windows**.
- Primary Windows repository: `C:\scripts\network-engineer-toolkit`.
- Ubuntu SSH host: `lab01` (hostname `ubuntu-lab01`).
- Ubuntu repository: `/home/scoggeshall/projects/network-engineer-toolkit`.
- GitHub repository: `scoggeshall/network-engineer-toolkit`.
- Use one primary Codex conversation: the Windows/local
  `network-engineer-toolkit` project. The Windows Codex project is the control
  plane and may directly use SSH to develop, execute, and test on Ubuntu.
- Normal project development does not use Codex host handoff, a second Codex
  conversation aimed at the Ubuntu clone, or parallel Windows and Ubuntu agents
  working independently on the same project.
- A separate `ubuntu-lab01 / lab` Codex project may remain for unrelated Linux
  administration and experiments. It is not a second development agent for this
  repository. A dedicated remote Codex project for this repository is unnecessary.
- Keep complete Git clones on both hosts. The ownership split governs where files
  are edited; it does not physically split the repository.
- Do not delete either clone, expose the Ubuntu clone through a network share, or
  replace Git synchronization with SMB, NFS, or similar filesystem sharing.

Intended Codex sidebar organization:

```text
Projects
├── network-engineer-toolkit
│   └── Windows/local project (primary for this repository)
├── ubuntu-lab01 / lab
│   └── Optional general Ubuntu project, not a second toolkit agent
├── pdf-processing-toolkit
│   └── Separate project
└── Tools
    └── Separate project
```

If a dedicated remote toolkit entry exists in the sidebar, it may be removed
manually without deleting the Ubuntu Git clone.

## Editing Ownership

Windows is authoritative for normal development of:

- `extension/`
- `docs/`
- `.github/`
- `.codex/`
- `AGENTS.md`, `README.md`, `.gitignore`, and other repository-level files

Windows is the normal environment for TypeScript, npm, VS Code Extension Host
testing, local Windows diagnostics, PowerShell integration tests, and client-side
API tests. The Windows copy of `backend/` is normally a synchronized secondary
copy.

Ubuntu is authoritative for normal development of:

- `backend/`

Ubuntu is the normal environment for Python, `uv`, FastAPI, pytest, Ruff, Docker,
Linux diagnostics, packet-capture and server-side functionality, backend runtime
tests, and future backend services. Ubuntu copies of Windows-owned paths are
normally synchronized secondary copies.

Never independently modify the same file on both hosts. Do not develop backend
files on Windows while Ubuntu has uncommitted backend work, and do not develop
Windows-owned files on Ubuntu while Windows owns them.

## Starting Cross-Host Work

Before work involving both hosts:

1. Determine the current branch on each host.
2. Inspect both working trees for expected and unexpected changes.
3. Confirm both clones use the expected GitHub origin.
4. Identify which host owns every file in scope.
5. Stop before synchronization if either tree has unexpected modifications.

Windows checks:

```powershell
git status --short --branch
git branch --show-current
git remote -v
```

Ubuntu checks from Windows:

```powershell
ssh lab01 'bash -lc "
cd ~/projects/network-engineer-toolkit &&
git status --short --branch &&
git branch --show-current &&
git remote -v
"'
```

Use `bash -lc` when remote commands depend on Ubuntu's configured login-shell
`PATH`. When making nontrivial remote edits, use controlled file writes or
patch-like operations instead of fragile substitutions or deeply nested quoting.
Inspect `git status` and `git diff` after remote edits.

## Development and Synchronization Loop

Intermediate edit/test iterations do not require Git commits. Git is not a
transport for every experiment, and unfinished work should not be shuttled between
hosts through throwaway commits.

At a coherent checkpoint, review the changes, run relevant tests, then commit and
push only when the user or active task authorizes it. Prefer a normal feature branch
for implementation work and stage only the relevant files. GitHub is authoritative
for completed and synchronized project state; working directories may differ during
active development.

To synchronize Ubuntu-completed backend work after an authorized commit and push,
first confirm the Windows clone has no conflicting uncommitted work, then use
`git pull --ff-only` on Windows. To synchronize Windows-completed work, first
confirm Ubuntu has no conflicting uncommitted work, then use `git pull --ff-only`
on Ubuntu.

Never force-reset a working tree, use `git clean -fd`, discard uncommitted work,
force-push, overwrite remote files, or force branches into alignment unless the
user explicitly authorizes the exact operation.

### Ownership Transfer

When a file or directory must change authoritative hosts:

1. Stop editing it on the current authoritative host.
2. Review and test its current work.
3. Commit and push the coherent checkpoint when authorized.
4. Verify the destination clone is clean for the affected files.
5. Synchronize with `git pull --ff-only`.
6. Continue editing only on the new authoritative host.

## Remote Backend Development

The Windows Codex conversation may SSH to Ubuntu to inspect, create, edit, search,
and test `backend/`; run Python and `uv`; run pytest and Ruff; inspect Git state;
and, when a later implementation task requires it, start temporary development
services, run Docker, or execute Linux/network diagnostic tools.

Example validation commands (only after the backend toolchain exists):

```powershell
ssh lab01 'bash -lc "
cd ~/projects/network-engineer-toolkit/backend &&
uv sync &&
uv run pytest &&
uv run ruff check .
"'
```

Do not assume a package name, service command, port, or endpoint exists before it
is implemented and documented.

## Cross-Machine Integration and Vantage Point

The intended application path is a Windows client communicating over the LAN with
the Ubuntu backend. Once later implementation work provides an API, validate both
the Ubuntu backend and the real Windows-to-Ubuntu client path.

Always identify the network vantage point of diagnostics. A test executed on
Ubuntu must never be reported as a Windows result. SSH used internally by Codex for
development is a trusted development mechanism; it does not authorize exposing raw
SSH or arbitrary shell execution through the application API.

## Engineering and Security Rules

- Prefer small, reviewable, testable changes within the requested component.
- Keep extension and backend components separate with an explicit, versioned API
  contract between them.
- Return structured JSON responses and clear, practical errors at API boundaries.
- Do not expose arbitrary shell execution or raw SSH through the application API.
- Diagnostic execution must be read-only, allowlisted, validated, bounded by
  timeouts and output limits, and separated from transport code.
- Treat network targets, configurations, command output, reports, and packet
  captures as potentially sensitive.
- Do not commit secrets, credentials, private keys, tokens, packet captures,
  generated reports, or local environment files. Use environment variables,
  platform credential stores, keyrings, or established local configuration.
- Do not alter SSH authentication, sudo policy, or public SSH exposure as part of
  ordinary application development.
- Keep the backend LAN-only initially. Do not prematurely add HTTPS,
  authentication, Docker complexity, databases, queues, MCP integration, or other
  infrastructure before a concrete implementation need exists.
- Keep parsers and backend logic in `backend/` until demonstrated reuse justifies
  extracting a package.
- Preserve cross-platform compatibility for code intended to run on both systems.
- Do not add telemetry or transmit user data unless explicitly documented and
  approved.
- Update documentation when changing architecture, contracts, setup, trust
  boundaries, or operator workflows.

### Backend Expectations

- Use Python with type annotations and clear module boundaries.
- Keep transport/API code separate from diagnostics, parsing, packet analysis, and
  domain logic.
- Validate all external input and add focused tests for parsers, validation, error
  handling, and command construction.

### Extension Expectations

- Use TypeScript with strict type checking.
- Keep VS Code integration separate from local utilities and backend client code.
- Use VS Code configuration and secret-storage APIs appropriately.
- Make remote operations explicit and handle unavailable backends gracefully.

## Validation and Future CI

Run each component's checks locally in its authoritative environment. Until a
toolchain exists, review documentation, run `git diff --check`, and ensure no
sensitive or generated artifacts were added.

Do not implement CI unless explicitly requested. Future CI should independently
validate the Windows/TypeScript extension and Ubuntu/Python backend so the standard
is local developer/agent testing plus independent CI verification. Do not create
workflow files, enable GitHub Actions, or call GitHub Actions permissions APIs as
part of ordinary work.

Do not commit or push unless the user explicitly requests it or the active task
explicitly authorizes it.
