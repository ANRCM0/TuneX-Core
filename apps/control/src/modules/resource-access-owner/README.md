# Resource read access owner

Source candidate for FR-0028 / N1. No verification has been executed for this
candidate. Runtime execution authorization and the single Runtime ledger retain
their original owners.

## Policy and storage

`ResourceAccess(identity, store)` implements the mandatory L1 `ResourceReadAccess`
port. `identity.scope` and the raw claims reads run on the supplied transaction.
`MySqlResourceAccessStore` reads the original tables and never opens a transaction,
writes a grant, renews a lease, or derives private ownership from grants or an
execution authorizer.

- `principal` validates Scope membership and identifies the original Scope owner
  as the Scope governance actor.
- `forward` permits its immutable business owner or Scope governance.
- `owned` permits its owner; a caller must explicitly request governance access.
- Node `basic` permits personal ownership, a granted admin-shared resource, or
  governance. Node `host` and `diagnostics` permit personal ownership/governance.
- Legacy unclassified resources do not become personal resources. Invalid or
  missing source/owner fields cause an integrity failure. Invisible and absent
  resources both return `NOT_FOUND` after the Scope authorization.

The provider uses explicit `owner_actor_id` for Forward/template/group resources.
Immutable coordination/request records retain their existing `created_by` or
`actor_id`; these fields identify those records themselves, not their referenced
Node, Forward, template, or group. This design was explicitly agreed during the
source task. The schema migration and catalog are integrated by the main task.

## Mandatory composition changes

Create one `new ResourceAccess(identity, new MySqlResourceAccessStore())` in the
existing composition root, then inject that port:

| Consumer | Constructor argument order |
| --- | --- |
| ConsoleQueries | `db, identity, read, access` |
| ControlQueries | original arguments through `features`, then `access` |
| TransportQueries | `db, identity, read, resolver, access` |
| TunnelQueries | `db, identity, read, access, clock?` |
| NodeTelemetry / HostTelemetry | `db, auth, access, machine, store, enabled?, clock?, rollups?` |
| ForwardTelemetry / ProbeTelemetry | `db, auth, access, machine, store, mapping, enabled?, clock?, rollups?` |
| TelemetryRollups | `db, auth, access, store, targets, enabled?, clock?` |
| ForwardDiagnostics | `db, auth, access, read, policy, clock?` |

There is no optional compatibility fallback. Legacy application class aliases
remain aliases of the same guarded owner implementation. Their callers and test
fixtures need the new explicit injection too.

The mandatory `ReadPrincipal` is placed immediately after `scope` on management
read methods, ConsoleReadPort methods, and Profile/Tunnel `references` methods.
The old candidates-only actor argument is replaced by that same principal.
The management/Console/Control/Transport/Tunnel/Telemetry/ForwardDiagnostic public
interface versions advance to 2 for the changed source and read semantics.

## Projection and isolation

COUNT and page SELECT use the same caller visibility predicate and bindings
before pagination. Nodes include private ownership or granted admin-shared
resources; Forward/Operation/reference queries join immutable Forward ownership.
Overview counters use those same scopes. Governance is an explicit principal
flag produced by this owner, never a request filter.

Console Node rows carry mandatory `read_detail` and DTO `readDetail`. Shared
basic rows expose only capability/listener-address/port policy, basic credential
window, and revoked status. Session/snapshot/report fields are suppressed; no
machine-wide report, egress policy, credential material, or private references are
included. Candidate reads never use governance to select another user's private
machine. Their optional `role` filter defaults to ingress and intersects granted
`allowed_roles`; capability selection remains advisory, with full path execution
authorization still required at the original command.

Node/process/host telemetry, node diagnostics, and tunnel credential metadata use
the host/diagnostics policy. Forward and Probe telemetry are guarded by Forward
ownership; whole-machine exporter coverage/dropped counters stay internal.
Aggregate Forward reads withhold Scope-wide loss counters; aggregate capacity is
governance-only. Forward diagnostics may retain original Forward-scoped listener,
probe and cleanup facts on a shared machine, but hide whole-machine Node evidence
unless the caller has diagnostics access. Support bundles use the same redacted
Node evidence and remain Forward-scoped.

## Acceptance to execute after source freeze

`test/resource-access-owner.test.ts` authors denial, malformed claims, explicit
governance, transaction identity, shared projection, and count/page binding cases.
These cases have not run. Their fake SQL executor asserts statement construction,
not MySQL behavior. Authoritative MySQL/HTTP evidence belongs in exact-source
GitHub Actions, including mixed users on one shared machine, pagination totals,
references, historical telemetry and advanced owner routes.

Named Console, Transport/Tunnel, diagnostic and telemetry owner/port/MySQL cases
now have authored successor migrations in the main worktree. They supply explicit
access providers and principals, preserve transaction and pagination assertions,
and add personal/governance separation and shared-detail denial cases. They have
not run and must not be cited as evidence for this source candidate. Remaining
legacy constructor/store-signature fixtures, version/arity/DTO assertions and
examples still require source closure before freezing. The new Node `readDetail`,
withheld telemetry exporter metadata, and role-aware candidates are intentional
successor contract changes.

Main-task follow-through includes HTTP/composition injection, migration/catalog,
the Node owner's view/listGrants policy, and governance restrictions on advanced
Audit/Notification/Station/Probe plan/run/history surfaces. The unchanged lower
historical Runtime/intent/diagnostic storage ports are internal owner provenance
ports; callers must not expose them directly as product read APIs.
