# Architecture

## Status

This document describes the planned product architecture and the cross-host
development architecture. The backend and VS Code extension have not yet been
implemented. Repository-wide development and engineering policy is authoritative
in [`../AGENTS.md`](../AGENTS.md).

## System Context

The Network Engineer Toolkit is planned as two independently testable components:

1. A TypeScript VS Code extension running on Windows provides commands, views,
   local network utilities, and the user-facing workflow.
2. A Python backend running on Ubuntu provides controlled remote diagnostics,
   vendor configuration parsing, packet-capture analysis, and a possible future
   integration boundary for MCP.

The extension should remain useful for local-only tasks when the backend is
unavailable. Server-dependent features must fail clearly without affecting local
features. Ordinary API requests and responses should use a versioned contract and
structured JSON.

## Cross-Host Development Architecture

The Windows/local Codex project at
`C:\scripts\network-engineer-toolkit` is the single primary control plane. From
that conversation, Codex uses native Windows operations for `extension/`, `docs/`,
`.github/`, `.codex/`, and repository-level files, and SSH through `lab01` for
backend development in `/home/scoggeshall/projects/network-engineer-toolkit` on
`ubuntu-lab01`.

```text
                         CODEX
                           |
                 Windows Codex project
                           |
              C:\scripts\network-engineer-toolkit
                           |
             +-------------+-------------+
             |                           |
             v                           v
      Windows filesystem                SSH lab01
             |                           |
             v                           v
        extension/                  ubuntu-lab01
        docs/                            |
        .github/                         v
        .codex/                     backend/
        AGENTS.md                   Python / uv
        root files                  pytest / Ruff
                                    Linux tools
```

Both hosts retain complete clones. Editing ownership, rather than repository
contents, distinguishes them. Do not independently edit the same files on both
hosts. Normal development does not use Codex host handoff or parallel Codex
conversations aimed at the two clones.

An optional `ubuntu-lab01 / lab` Codex project may be used for unrelated Linux
administration, experiments, Docker testing, Ansible, or troubleshooting. It is
not a second independent development agent for this project. The Ubuntu clone
remains necessary for backend development, Linux execution, cross-machine tests,
and future deployment even if a remote project entry is removed from the sidebar.

## Completed-State Synchronization

Active working trees may differ during edit/test iterations; intermediate edits do
not require commits. At a coherent, authorized checkpoint, work is reviewed,
tested, committed, and pushed. GitHub (`scoggeshall/network-engineer-toolkit`) is
the authoritative completed state, and the other clone is updated only after its
working tree is checked for conflicts, using `git pull --ff-only`.

The complete branch, safety, synchronization, and ownership-transfer rules live in
[`../AGENTS.md`](../AGENTS.md).

## Product Component Boundaries

### VS Code extension

Planned responsibilities:

- Register commands and views.
- Run safe local subnet, address, and diagnostic utilities.
- Collect explicit user input and render structured results.
- Call the backend through a versioned client interface.
- Store preferences and secrets using appropriate VS Code facilities.

The extension must not contain credentials in source or logs and must not construct
arbitrary server-side shell commands.

### Python backend

Planned responsibilities:

- Expose versioned application endpoints when implemented.
- Validate diagnostic requests.
- Run an allowlisted set of read-only diagnostics with bounded arguments, timeouts,
  and output limits.
- Parse supported vendor configuration formats.
- Analyze uploaded packet captures within explicit size and resource limits.
- Return stable, structured JSON results and errors.
- Preserve a possible future adapter boundary for MCP without coupling domain logic
  to transport code.

The API layer should delegate to domain services. Diagnostics, parsers, packet
analysis, and backend logic stay inside `backend/` until real reuse justifies
package extraction.

## Trust Boundaries

User input, network targets, uploaded configurations, packet captures, backend
responses, and subprocess output are untrusted. The backend must never provide an
arbitrary shell-execution API or expose raw SSH. Diagnostic programs and arguments
must be allowlisted, validated, and bounded. Sensitive values must not enter source
control or logs.

The backend is initially LAN-only. HTTPS, application authentication, Docker,
databases, queues, MCP, and similar complexity should be introduced only when a
specific later requirement justifies them. Codex using SSH internally for remote
development is a separate trust boundary and does not imply application-level SSH
functionality.

## Cross-Machine Validation

The eventual integration path is:

```text
Windows extension or client
            |
            | HTTP over the home LAN
            v
       ubuntu-lab01
            |
            v
       backend API
```

After an endpoint and service command actually exist, backend checks run on Ubuntu
and client checks run from Windows. Reports must identify the diagnostic vantage
point; Ubuntu output cannot be represented as a Windows test result.

## Future Independent Verification

CI is not part of the current workflow-establishment task. Future CI should verify
the TypeScript/extension and Python/backend components independently:

```text
local developer/agent tests
             +
independent CI verification
             |
       +-----+-----+
       |           |
       v           v
TypeScript      Python
extension       backend
```

The local authoritative host remains responsible for component-specific edit/test
loops; CI provides independent completed-state verification rather than replacing
local testing.

## Evolution

Later implementation should proceed through small, testable capabilities with an
explicit API contract and clear errors. Do not create empty scaffolding or begin
health endpoints, diagnostics, parsers, packet analysis, deployment, or MCP merely
because those capabilities appear in this proposed architecture.
