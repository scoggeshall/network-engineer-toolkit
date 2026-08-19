# Architecture

## Architectural invariant

Network Engineer Toolkit is a local-first VS Code extension. All Toolkit runtime
execution occurs on the local Windows workstation.

```text
                    Network Engineer Toolkit
                           VS Code
                              |
                              v
                         TypeScript
                     UI / orchestration
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
         TypeScript       PowerShell        Python
         local logic      Windows APIs      networking
              |               |               |
              +---------------+---------------+
                              |
                              v
                       Local workstation
```

The Toolkit does not require or provide FastAPI, Flask, an Ubuntu execution tier,
a remote diagnostics service, a persistent local service, a localhost HTTP API,
or a Toolkit-specific client/server architecture.

Remote routers, switches, servers, controllers, DNS servers, SNMP agents, SSH
destinations, REST APIs, and network services may still be targets or data
sources. They are not Toolkit execution backends. The UI must state the true
vantage point of any diagnostic or observation.

## Product ownership

TypeScript owns the product experience. It registers VS Code commands and views,
collects input, validates requests, manages progress and cancellation, selects
bounded capabilities, validates structured results, and presents output. Local
helpers do not own product workflows or become independently operated programs.

The extension contributes one Activity Bar view container, **Network Engineer
Toolkit**, with a **Tools** view. That view uses Welcome content whose buttons
invoke the existing Command Palette commands. It does not use Tree View items as
fake buttons. Tree Views remain reserved for later tools such as Scanner and Path
Monitor.

The active repository boundary is:

```text
extension/
  src/                 TypeScript product and orchestration code
  helper/dns/          bounded local PowerShell capability
  helper/switchport/   bounded local Python capability
  test/                TypeScript contract and product-logic tests
  helper/test/         Python helper tests
docs/                  architecture and development documentation
```

## Language decision model

### TypeScript

Use TypeScript for VS Code APIs, Command Palette commands, Quick Picks, Activity
Bar views, Welcome content, Tree Views, justified webviews, extension settings,
progress and cancellation, typed models, validation, result presentation,
clipboard and file integration, simple calculations, lightweight parsing, pure
local application logic, and orchestration of bounded helpers.

**Network Tools: Analyze IP/Subnet** is the current reference for pure TypeScript
local logic.

### PowerShell

Use PowerShell when Windows already exposes the capability cleanly. Typical
capabilities include `Get-NetAdapter`, `Get-NetIPConfiguration`,
`Get-NetNeighbor`, `Get-NetRoute`, `Get-NetTCPConnection`, `Resolve-DnsName`,
`Test-NetConnection`, Windows services, registry data, event logs, and Windows
networking state.

PowerShell should emit structured JSON. TypeScript must not scrape formatted table
output. **Network Tools: DNS Lookup** is the current reference: TypeScript validates
and orchestrates a one-shot script, which calls `Resolve-DnsName`, writes a typed
result, and exits.

### Python

Use Python when networking or protocol libraries materially improve correctness
or implementation quality. Typical uses include Scapy/Npcap, LLDP/CDP, packet and
protocol decoding, configuration parsing, vendor APIs, network scanning, and
concurrent network operations.

**Network Tools: Discover Switchport** is the current reference. The extension
owns the workflow while a bounded Python helper performs local packet capture and
returns structured data.

## Helper execution model

```text
TypeScript operation
        |
        v
allowlisted local helper
        |
        +-- validated argument array; shell disabled
        +-- stdout: structured result
        +-- stderr: bounded diagnostics
        +-- timeout and output limits
        +-- cancellation
        +-- exact child-process ownership
        |
        v
helper exits
```

PowerShell and Python helpers are not services or independent applications. They
normally spawn, perform one bounded operation, return a structured result, and
exit. A future long-running feature such as Path Monitor may own a child process
or stream for the active operation, but the child lifetime must end with
cancellation, teardown, or extension disposal. It must not become a daemon or
local HTTP service.

## Trust boundaries

User input, network targets, device responses, helper output, configurations,
reports, and packet captures are untrusted. TypeScript validates input before
execution and validates helper output before use. Helpers also validate their
inputs at the capability boundary.

Executables and operations are allowlisted. Arguments are passed as arrays with
shell interpretation disabled. Runtime and output are bounded, failures are
sanitized for users, and exact child processes are terminated on timeout,
cancellation, or disposal. The extension must never expose general shell execution
or raw SSH as a product capability.

Sensitive data must not be committed or logged casually. Credentials belong in
platform credential stores or VS Code SecretStorage. Packet captures and generated
reports remain local and ignored by source control unless an explicit workflow
safely handles them.

## Development and validation

Development is local-first on Windows. TypeScript, PowerShell, Python, tests,
builds, and packaging run locally. GUI testing uses only the existing
`Network Engineer Toolkit Dev` VS Code profile and must not modify the user's
normal profile or global environment.

No Ubuntu host, cross-host synchronization, remote deployment, CI service, or
hosted build is part of the Toolkit architecture. Authoritative safety and
validation rules are maintained in [AGENTS.md](../AGENTS.md).
