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


