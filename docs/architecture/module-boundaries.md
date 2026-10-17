# Module Boundaries & Interaction Rules v1

**Accepted for implementation.** Tiny Core works only when runtime and product modules obey explicit ownership boundaries.

## 1. Allowed dependency graph

```text
Web / CLI / Open API
        |
      API (Hono)
        |
  Application Modules ----- Core (pure)
        |                    ^
        |                    | pure input/results only
        v                    |
  Repository / Queue / Runtime Ports
        |
 Adapters: MySQL, Redis, Agent HTTP
        |
  Runtime Controller --> per-Node Snapshots
        |
      Go Agent --> Forward Engine / Transport Drivers
```

Core imports only other Core primitives or dependency-free validation helpers. Modules can invoke Core but **Core may not import Modules**. Importing Core does not authorize writes to another module's data.

## 2. Module ownership

| Module | Owns authoritative state | Exposes to others |
| --- | --- | --- |
| Identity / Workspace | user, scope, role, grants | authorization/check grants |
| Nodes | node identity, enrollment, credential, capabilities facts | getAuthorizedNodeCapabilities |
| Forwarding | Forward intent, CAS revision, CRUD | create/update/disable/delete/get Forward |
| Runtime | Operation, Deployment, Assignment, snapshots, leases, port reservations, tombstones | requestDeploy, observeDeployment, getRuntimeStatus |
| Transport | immutable profile revisions, driver/cipher capabilities, Link pools | resolveProfile, validateRequirements |
| Routing (optional) | route policy and candidate calculation | proposeResolvedPath |
| Metering (optional) | durable, deduplicated traffic usage | usage facts with unit/period/provenance |
| Billing (optional) | plans, invoice, financial rules | billing status and constraints |
| Observability (optional) | metrics aggregation, alerts, drill-down | health/diagnostic read model |

Application API orchestrates a use case and is not a database super-user. Runtime alone owns the Operation ledger; Forwarding invokes its transaction-aware acceptance command and does not own a second ledger. Owner-owned commands may share one UnitOfWork/transaction handle in the same MySQL database. The coordinator never bypasses those interfaces to write another module's tables. See [Control API / Operation](../spec/control-api-v1.md) for ordering and constraints. Cross-module reads are through public query interfaces or deliberate projections; no direct arbitrary table access. Cross-module writes are through owner-owned commands with explicit authorization. Domain events may drive notifications and analytics but never replace the necessary transactional write for resource safety.

## 3. Synchronous vs asynchronous

**Synchronous**: permission checks, Core validation, expected-revision CAS, transaction for Forward + port reservation + Operation, non-network-heavy reads. API acknowledges only durable acceptance.

**Asynchronous**: deploy, prepare/activate/drain, retry, reconciliation, telemetry aggregation, alerts. Worker is allowed to perform recoverable steps, but never treat Redis messages as the only operation record.

Avoid chains of async module-to-module commands in one request. Dependency ordering happens in one Runtime coordinator to prevent Routing and Forwarding issuing conflicting Agent assignments.

## 4. Read models vs source of truth

Forwarding owns `desired.enabled` and `revision`. Runtime owns `deployment.status` and `appliedGeneration`. Agent supplies `observed` conditions/boot/time and current listener facts. Observability can index these facts but does not overwrite owner state. Web should show separate fields, and never infer `healthy` from `202 Accepted`, `ACK` or `applied`.

## 5. Anti-patterns forbidden

- Generic `BaseManager` subclass shared by all business features.
- Calling Prisma from Core.
- Sending Redis task before persistent Operation exists.
- Routing Module directly sending arbitrary Agent commands.
- Billing in the data plane hot path.
- Transport Profile with mutable in-place security requirements that bypass Forward revision/deployment tracking.
- Exposing arbitrary Agent shell command as an extension point.
- User auth derived from the first untrusted proxy header without trusted-proxy configuration.

## 6. Scope and isolation

Every resource and query explicitly carries scope; cross-tenant authorization is checked at module public interfaces and database write boundaries. Do not rely on frontend filtering or Redis key prefixes as the only isolation mechanism. Operational machine endpoints use independent Node credentials, never user session cookies by accident.

## 7. Native declarations and Profile configuration impact

[ADR-0019](../decisions/0019-native-catalog-and-profile-impact.md) adds a closed
product catalog, not a new Agent driver registration path or Core selector.
`NativeDrivers` separates static declarations/process gates from Node evidence
and execution authorization. `TransportQueries` owns the read use case; its
`TransportReferenceReader` is a deliberate SELECT-only current-intent projection,
and the existing `TransportProfileResolver` resolves an explicitly chosen immutable
revision inside the same authorized transaction. Impact output is a proposal only;
it never writes Forward intent, resources or the Runtime ledger. Console loading
continues through the original editor, plan check and owner-owned CAS command.

## 8. Explicit Console Native Commands

[ADR-0020](../decisions/0020-explicit-native-rule-commands.md) keeps copying as an
editor proposal and a bounded ten-rule batch as tab-local serial orchestration.
Neither can write owner tables or bypass Forward commands. Each frozen request
uses the original authorized transaction, CAS, independent idempotency and single
Runtime ledger. A stopped/uncertain local dispatch is not remote rollback; retries
require explicit consent and retain original keys/bodies. Operation detail exposes
only its already-scope-authorized Forward identity. No durable Batch, new Agent
command, Core selector, generic plugin interface or recovery authority is introduced.

## 9. Native TLS Tunnel Read Model

[ADR-0021](../decisions/0021-native-tunnel-read-model.md) introduces `TunnelQueries<Tx>`
and a deliberate SELECT-only `TunnelReadPort` projection. Scope membership and exact
Node ownership precede all Endpoint/peer/desired-reference reads in one supplied
transaction. Only bounded fingerprints, times, counters and current adjacency are
returned, never certificates, issuance responses, raw Reports or runtime authority.
The owner-defined pure Endpoint parser is shared without importing its write module.
Recorded windows are not TLS/session/network/health evidence or deletion safety.
Console delegates deployment inspection and explicit Profile/copy commands to the
original entrypoints; no new write authority, Runtime ledger or Agent protocol exists.

## 10. Explicit Profile Publication

[ADR-0022](../decisions/0022-explicit-profile-batches.md) extends only the Console's
bounded command queue: immutable impact proposals first call the original read-only
Relay compiler, then the original individually authorized Forward CAS command.
There is no server Bulk endpoint, second ledger or plan-issued execution authority.
Preflight failure proves no write was started; an uncertain write requires exact
original replay, not a new plan/key/CAS. A denied replay cannot erase uncertainty
about the original acceptance. Cross-rule atomicity and automatic rollback remain absent.

## 11. Native PathTemplate Metadata

[ADR-0023](../decisions/0023-immutable-native-path-metadata.md) adds the separate
`PathTemplateCommands/Queries<Tx>` application owner and supplied-transaction
metadata reader/writer. Only its three tables are writable; the Scope row is a
quota lock. Native references delegate to original Node grants/current facts,
immutable Profile resolver and exact Endpoint locks. No pool, Forward mutation,
Runtime, machine protocol, credential issuer or lease authority is imported.
Queries check Scope access and stored integrity without claiming fresh reference
authorization. Immutable revisions and terminal archives survive backup/recovery;
restored request keys retain existing quarantine. Future bindings must enter
the original Forward acceptance in the same transaction, not grow a second
executor or add template IDs to Core. Binding/impact/manual-switch APIs remain
unimplemented in that first metadata-only slice; the follow-up below implements
their original-owner integration.

## 12. Native Path Bindings

[ADR-0024](../decisions/0024-original-owner-path-bindings.md) supplies
`ForwardPathBindings<Tx>` expansion/provenance ports to the original
`ForwardCommands<Tx>`. Exact template integrity/current reference checks,
original Forward CAS/preparation/Relay resources/Operation/capacity, immutable
binding history and original idempotent receipt share one supplied transaction.
Ordinary replacement uses the same private acceptance and atomically detaches
topology-divergent provenance; no pool, second executor or Core template ID is added.
The new MySQL store mutates only its two tables, reads the scoped original
Forward and retains all immutable history. Template authoring still owns only
its three original metadata tables. Reference/proposal reads never accept an
Operation or reserve resources. See [binding contract](../spec/native-path-bindings-v1.md)
for no-op attachment, bounded history, archive/recovery and Console uncertainty.

[ADR-0025](../decisions/0025-explicit-path-batches.md) reuses the same tab-local
rule queue for at most ten exact path proposals from one current impact page.
Each first write rechecks the original path proposal and Relay plan, then calls
the independently authorized original binding command. No Bulk API, persistent
coordinator, cross-rule transaction, extra writer or execution authority is added.
Unknown writes replay only the original command; acceptance is not deployment
or health. See [explicit path publication](../spec/path-publication-v1.md).


