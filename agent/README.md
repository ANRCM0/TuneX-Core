# Go Agent Development

The Go 1.26.3 module implements the current ADP/3 Agent, enrollment, mTLS sessions,
protected RuntimeJournal/high-water, authorized execution and independent native
platform adapters. Direct TCP/UDP and TLS 1.3 Relay use the existing execution
registry; multihop remains explicitly opt-in. Restart requires online authority
before restoring execution.

Source boundaries and extension contracts are documented in
[Agent source map](../docs/architecture/foundation-agent-source-closure-v1.md),
[execution host](../docs/architecture/agent-execution-host-v1.md) and
[native default bindings](../docs/architecture/agent-native-default-bindings-v1.md).
Current evidence and independent remaining gates are in
[project status](../docs/development/progress.md).

## Development Checks

Run authorized static checks from the repository root:

```sh
node scripts/run-go.mjs build ./...
node scripts/run-go.mjs vet ./...
```

On Windows, set GOARCH=amd64 in the process environment. Functional/network/race
and platform behavior tests run in Actions on their actual source revision.

Protocol types and embedded schemas are synchronized from the root contract
tooling; see [contracts](../packages/contracts/README.md). Historical ADP/2
inspection is an explicit offline parser and never grants execution.

## Safety And Native Inputs

Preserve the original Runner, Guard, authority and authenticated Journal owners,
strict deadlines, exact identity and failure ordering. Native time, credential,
HTTP, JSON and platform differences belong to their named adapters.

Authenticated readonly Journal inspection must stop before enrollment, instance
lock or Runner creation. The observation responder is a separate bounded command
and has its own deployment/release evidence requirements. Developer invariants:
[upgrade/recovery](../docs/development/upgrade-recovery-development.md),
[clock authority](../docs/development/system-time.md) and
[execution faults](../docs/development/authorization-faults.md).
