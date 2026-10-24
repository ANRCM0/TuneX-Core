# Control Development

Control uses TypeScript, Hono and MySQL to expose product commands/queries and
publish authorized ADP/3 state to independent Go Agents. Current source includes
Direct TCP/UDP, TLS 1.3 Relay, default-off multihop, owner-managed path/ingress
metadata, diagnostics, telemetry and Probe workflows.

## Source Boundaries

| Source | Responsibility |
| --- | --- |
| src/kernel | L0 pure runtime publication decisions |
| src/framework | L1 public ports, Runtime coordination and lifecycle |
| src/compatibility and src/infrastructure | L2 native formats, platform, wire and storage |
| src/modules/*-owner | L3 product commands and read models through public contracts |
| src/main.ts, src/server.ts and explicit command roots | Composition of the declared implementations |

Existing compatibility constructors/forwarders remain explicit entries with
documented consumers and removal conditions. They do not grant access to private
implementations or authorize reverse source dependencies.

Use [development setup](../../docs/development/getting-started.md),
[public integration](../../docs/architecture/framework-integration-v1.md),
[Control source map](../../docs/architecture/foundation-control-source-closure-v1.md)
and [candidate versions](../../docs/architecture/foundation-candidate-index-v1.md).

## Persistence And Authority

Product owners share the supplied transaction where atomicity is required.
Idempotency, intent/history, resources and Operation remain in their original
acceptance path. Preserve one Runtime ledger, original credential/authorization
owners, persistence-before-publication and recovery quarantine. No module writes
another owner's tables outside a public same-transaction contract.

## Verification

Authorized local checks cover types, boundaries and generated asset parity.
Real MySQL, mTLS, lifecycle, browser, fault and recovery evidence runs in Actions.
Current saved source, passing checks and pending acceptance are recorded in
[project status](../../docs/maintenance.md) and
[verification](../../docs/testing/verification-status.md).
