# Module Boundaries & Interaction Rules v1

## Four-Layer Foundation And Current Gate

Current A5 source classification/candidate scope is closed in
[foundation-a5-source-closure-v1.md](foundation-a5-source-closure-v1.md).
The exact saved revision and B boundary/type/contract/example evidence remain
unexecuted. This manual classification does not certify any directory, erase old
compatibility consumers or open the foundation/upper-module gate.

The later human-defined L0/L1/L2/L3 rules are specified in
[foundation layers](foundation-layers-v1.md) and the root `AGENTS.md`.
Pure domain/runtime decisions, framework hosts/ports, external adapters and product
modules have distinct public dependencies. Runtime invocation of an injected
provider does not permit a reverse source/type import. Known composition roots
are explicit. Unclassified legacy source is migration debt, not a broad exception.
The first live extraction and [DoD readiness](../testing/verification-status.md)
remain unverified; the earlier ADR-0047 source closure does not open parallel work.

## Classified Integration Framework v1 Source Closure

The 2026-10-18 [framework contract and recipes](framework-integration-v1.md) /
[ADR-0047](../decisions/0047-classified-integration-framework-v1.md) close the current
source scope. HTTP receives structural public methods and named optional services;
detail SQL/transactions belong to application/infrastructure. Control preparation
and Agent execution dispatch use explicit native adapter contracts. Task scheduling
does not own business state, and shutdown drains tasks and actual handlers before
closing dependencies. The [Core surface](../spec/core-v1-surface.md) is protected.
Current production, experimental, staged and historical contracts have separate
package entrypoints. The aggregate compatibility export remains available.
All of these source changes await concentrated verification; existing boundary
checks have not yet been extended/executed for this slice.

**Accepted for implementation.** Tiny Core works only when runtime and product modules obey explicit ownership boundaries.

## 2026-10-18 Controlled Direct Ingress TLS Increment

[ADR-0045](../decisions/0045-direct-ingress-tls-probes.md) /
[contract](../spec/direct-ingress-tls-probes-v1.md) connects the manager-declared
service owner through a narrow current-reference resolver to the original Probe
permit owner. The resolver locks current head/config/metadata CAS and checks
current manager/window/digest; it never issues permits, resolves arbitrary targets
or supplies a Relay private key. Every original execution-authority stage rechecks
the same exact service, Forward, Node policy and instance. Metadata-changing
publication, archive and recovery invalidate the old reference, without automatic
rebase. Ordinary same-config publication remains a no-op; recovery re-declaration
of the same config advances metadata CAS only.

Runner alone supplies the current physical Direct listener and original ticket
checks. The existing Gate burns each permit once and keeps the sole original
256/two-second budget; TLS adds bounded handshake work, not another executor or
deployment authority. Pinned public leaf/SNI/scoped URI/ALPN trust is not business
Relay mTLS or OS/public-CA trust. Handshake records traverse the real TCP Forward,
can dial downstream and count as business payload; no TLS application request or
echo is sent. Reports remain agent-reported/health unknown.

Only the offer carries bounded full public context. Permit storage preserves it;
results, finite plans and history keep compact exact selection/context digest and
whitelisted TLS evidence, without DER duplication or secrets. Existing egress
telemetry is not reinterpreted. Explicit probeVersion3 qualification strengthens
the same current original slot without extending expiry or rearming revoked
identity. Registry GET/publication stay no-network/no-permit; measurementAvailable
is configured original-owner issuance only, not liveness. All new source and
Schema0036/upgrade/recovery/UI are unverified; no C3 or production gate is closed.
The passive diagnostic consumer parses actual v1/v2/v3 bodies and validates the
historical permit/context/pin relation internally. Its public full context is not
exported; support also strips compact service identities, trust digests and leaf
fingerprint with the same closed server/client whitelist.

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
| Tunnels (native business composition) | no additional authoritative state in the first slice; reuses immutable PathTemplate definitions and original PathBindings | definition list/detail/publish/archive, exact topology, binding/impact through original owners |
| Runtime | Operation, Deployment, Assignment, snapshots, leases, port reservations, tombstones | requestDeploy, observeDeployment, getRuntimeStatus |
| Transport | immutable profile revisions, driver/cipher capabilities, Link pools | resolveProfile, validateRequirements |
| Routing (optional) | route policy and candidate calculation | proposeResolvedPath |
| Metering (optional) | durable, deduplicated traffic usage | usage facts with unit/period/provenance |
| Billing (optional) | plans, invoice, financial rules | billing status and constraints |
| Observability (optional) | metrics aggregation, alerts, drill-down | health/diagnostic read model |

The first D2 [Node telemetry slice](../decisions/0027-independent-node-telemetry.md)
owns only `telemetry_heads` ingestion checkpoints and `telemetry_points` operational
history. It shares the existing authentication owners through supplied transactions
and reads Runtime boot/session without locking or updating Runtime rows. Sampling
and intake never create execution rights; database pool admission, retention and
query work are independent of Runtime scheduling. This slice is implemented but
unverified and does not imply host metrics, payload usage or aggregate alerts.

The independent [Forward telemetry slice](../decisions/0028-independent-forward-telemetry.md)
owns only `forward_telemetry_heads` / `forward_telemetry_points`, sharing the same
bounded telemetry database pool rather than introducing a third executor or pool.
Runtime owns a supplied-transaction, SELECT-only published mapping port: current
Snapshot and exact retirement plus same-session lease establish historical provenance,
never execution rights. It compares complete ingress identities, derives Forward Scope
from trusted records and does not import controller writes or compile desired state.
Intake, history and Console are unverified; one latest instance is not a whole-Forward
aggregate, and history does not recheck current binding or infer health/settlement.

Application API orchestrates a use case and is not a database super-user. Runtime alone owns the Operation ledger; Forwarding invokes its transaction-aware acceptance command and does not own a second ledger. Owner-owned commands may share one UnitOfWork/transaction handle in the same MySQL database. The coordinator never bypasses those interfaces to write another module's tables. See [Control API / Operation](../spec/control-api-v1.md) for ordering and constraints. Cross-module reads are through public query interfaces or deliberate projections; no direct arbitrary table access. Cross-module writes are through owner-owned commands with explicit authorization. Domain events may drive notifications and analytics but never replace the necessary transactional write for resource safety.

The independent [Host telemetry slice](../decisions/0029-independent-host-telemetry.md)
owns `host_telemetry_heads` / `host_telemetry_points`, not host control or resource
entitlements. Linux OS, root-filesystem and network-namespace visibility does not
imply physical-host or cgroup quota visibility. Three telemetry families share the
existing two observation connections and owner authentication semantics. Retention
worker batches run serially across families to avoid systematic third-family rejection;
no queue/retry, Runtime writes or execution grants are added. Implementation is unverified.

[Probe cumulative telemetry](../decisions/0030-independent-probe-telemetry.md) owns
only `probe_telemetry_heads` / `probe_telemetry_points`; the original Probe Gate,
permit/claim/result and Runtime safety owners do not gain historical metrics writes.
Actual dial attempts, valid results and unknown outcomes are counted at the Agent,
not inferred from consumed permits or received result rows. Runtime's supplied-
transaction mapping reads at most two immutable historical Snapshots plus current
Node/optional registered instance and trusted Forward Scope, without execution locks
or writes. Four telemetry families share the existing two observation connections;
bounded cleanup visits each serially. Historical provenance is not proof of each
permit or renewed Probe authority. All implementations remain unverified.

[Durable rollups](../decisions/0031-bounded-telemetry-rollups.md) own only Scope
budget rows, Node-family loss heads, predecessor cursors and exact-series minute/hour
buckets. Recorder runs in the accepted raw transaction before commit, not a second
Runtime transaction or asynchronous raw scanner. Scope locking serializes telemetry
budgets only; a prune never takes a raw head or Runtime lock. Both resolutions fold
the same new observation directly, no minute-to-hour double counting. Bounded actual
Scope/Node cardinality, own-only eviction and Scope rejection preserve finite storage
policy; they are not proved disk capacity. No Agent protocol, execution or billing
authority changes. Recovery clears cursors, retains loss history and flags buckets.

The accepted [tunnel/forward framework](project-framework-and-boundaries.md) is
an incremental product boundary, not a new execution architecture. Its first
[logical tunnel slice](../decisions/0026-logical-tunnel-management.md) composes
existing application owners without a new transaction, table or resource pool.
New API names retain the original canonical idempotency identity and receipts.
Configuration reuse must not be reported as live physical connection sharing.

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

## 13. Bounded Path Groups (C2-A)

[ADR-0032](../decisions/0032-bounded-path-groups.md) adds Scope-owned immutable
group metadata and `ForwardPathGroups<Tx>` to the original Forward command owner.
The first slice supports only ordered complete `egress-candidates` / `backup-paths`,
not ingress multi-Forward expansion. Each candidate pins an original template ID,
revision and digest; all candidates share ingress and protocols. Egress candidates
have distinct terminal Nodes. Metadata publication validates original references
without creating Forward intent, resource reservations, Operations or authorization.

Explicit selection resolves one group revision/candidate to the original
`PathSelection`. Group and original PathBinding provenance, original Forward CAS,
preparation/Relay plan/resources/Operation, Runtime acceptance and idempotent receipt
share one supplied transaction. The group store writes only its five new tables;
scoped references map the original Forward rows without a new connection. It adds
neither executable group IDs to Core/ADP nor a second executor or resource owner.
Metadata-only attachment serializes on the original Forward lock and does not
invent a Forward revision or Operation; last accepted pointer wins, without a
separate caller-supplied provenance CAS. Explicit ordinary path apply detaches the
group even for an equivalent spec. Ordinary topology/Profile changes detach;
target/listener/enabled changes preserve provenance without rewriting history.

Scope locks precede group head locks for authoring. Bounds include archived
definitions and detached histories: 64 groups/Scope, 64 revisions/group, 8 candidates,
64 immutable group bindings/Forward, separately from original path-binding limits.
Archive blocks new applications, not existing traffic or already accepted replays.
Recovery preserves all metadata/history/current pointers while original Forward
quarantine prevents restored provenance from becoming a new apply or permission.
Reads/previews are not reservations, complete-plan authorization, deployment health
or current runtime proof. Overall group health remains unknown; no OR aggregation
of candidate observations or AND aggregation of required branch Nodes is implemented.

Ingress expansion, durable multi-rule saga/cancellation/conditional compensation and
C3 automatic policy remain separate deferred slices. C2-A is source-only and locally
unverified; it does not complete C2. See [contract](../spec/path-groups-v1.md).

## 14. Durable Manual Path Publications (C2-B)

[ADR-0033](../decisions/0033-durable-path-publications.md) adds durable coordination,
not execution authority. `PathPublications<Tx>` owns at most 64 batches/Scope,
including terminal/recovered batches, with immutable plans of 1-10 exact source
Forward revision/spec/provenance guards and one exact group/candidate target.
Preview and confirmed digest recomputation create only a batch, never Forward intent
or resources. Each item has at most one manual apply and one manual compensation.
There is no worker, automatic tail, cross-rule atomic transaction or second Runtime.

The creator must still be a current Scope manager. Original outer idempotency and
batch head locking/CAS serialize one requested item against cancel; the original
Forward owner receives the same transaction without child keys/responses or nesting.
SAVEPOINT isolates only its mutation. An expected allowlisted nonretryable rejection
rolls back all Forward/Runtime/resource/provenance work before a durable sanitized
rejection and HTTP 202 batch receipt commit. Accepted original state/Operation,
attempt, batch head/audit and outer response commit together per item. Unknown SQL,
integrity, savepoint, connection and commit failures are not durable business rejects;
only original-command replay resolves a potentially committed HTTP response.

Compensation compares the entire accepted Forward revision/spec and nullable exact
path/group sequences, preventing same-spec provenance overwrite. It restores the
full source spec through original fresh authorizations and provenance choices, not
historical pointers/Snapshots. Old path references require reauthorization even for
disabled/unbound source intent; archive/grant loss can reject compensation. Cancel
only marks future apply as cancelled, never interrupts an accepted Operation; manual
conditional compensation can remain possible. Operation reads are scoped exact IDs
(at most 20), with original status/cleanup/recovery flags, not health claims.

The three Schema 0026 tables retain bounded immutable plans/attempts/audits. Existing
recovery records one recovery event and head revision advance, marks invalidated and
derives pending work as suspended, keeping cancellation/receipts/history. No restored
batch can apply, cancel, compensate or auto-resume. Control ceiling becomes 0026;
Agent/ADP/Journal and flags remain unchanged. This source-only slice is locally
unverified; ingress groups/C3 remain pending and C2 is not complete. See the
[publication contract](../spec/path-publications-v1.md).

## 15. Bounded Ingress Groups (C2-C)

[ADR-0034](../decisions/0034-bounded-ingress-groups.md) adds separately versioned
ingress definitions and manual durable creation coordination. One of 1-8 pinned
complete members expands exactly once to an independent Forward/Operation on its
distinct ingress, with shared protocols/target/enabled intent and explicit per-member
listener. No Cartesian product, VIP, DNS steering, global HA, shared executable group
or cross-rule atomic Operation is introduced. Definitions own only metadata; the
original Forward supplied-Tx owner retains all preparation/resource/Runtime acceptance.

Preview/confirmed creation plans contain no reserved/generated Forward IDs. Each
manual original create acceptance generates its ID once, and original-key replay
returns the committed receipt. Plan/member plus accepted original PathBinding receipt
and immutable source state form historical creation attribution in that transaction.
There is deliberately no ingress binding/current pointer; origin reads must not
claim current route membership, fresh authorization or deletion safety.

Creator/current-manager authorization, head CAS, one create and one guarded original
delete compensation per item, SAVEPOINT rejection isolation, cancel-vs-create
serialization and unknown-command replay follow C2-B boundaries. Compensation requires
the entire accepted Forward revision/spec and nullable path/group sequences to match;
it creates original deleting intent, not historical rollback or immediate cleanup.
GET holds a shared head lock while projecting attempts; Operations may progress
independently. Scope counts include terminal/archived/recovered rows: 64 definitions,
64 revisions each, 64 ingress batches, 8 items/16 attempts and head revision at most20.

Schema0027 owns six metadata/coordination tables only. Original recovery records one
event/invalidation/revision advance per ingress batch in its same quarantine
transaction, retaining all plans/attempts/audits and suspending pending work. No
restored batch can create/cancel/compensate or auto-resume. Control ceiling0027,
Agent/ADP/Journal unchanged. Source-only, locally unverified; C3 and final C2
acceptance remain open. See [contract](../spec/ingress-groups-v1.md).

Existing ingress deployment revision impact and per-member add/update/remove
reconciliation are outside that initial slice; see the C2-C2 follow-up below. C2-C creates NEW deployments;
definition publication does not mutate earlier Forwards, and creating duplicates
is not migration. Historical origin must not be presented as current live membership.

## 16. Explicit Ingress Revision Migrations (C2-C2)

[ADR-0035](../decisions/0035-explicit-ingress-migrations.md) supplies explicit
same-group/different-revision migration plans. Full source/target definitions and
sorted complete member-union diff are saved, but only1-8 explicitly selected
add/update/remove actions execute. Immediate deployment or prior migration outcome
references retain exact accepted states; no recursive lineage traversal/current
ingress pointer or global member reconciliation exists.

Origin records are checked with shared head/attempt reads before original Forward
state capture. Full revision/spec/path/group sequence guards reject stale lineage,
including later same-spec metadata changes. Update replaces only path/Profile on
the same ingress and protocols, preserving business intent; ingress change needs
independent explicit remove+add. Add allocates ID only on original create acceptance.
Remove is original deleting intent and is NONCOMPENSATABLE. Add compensation is
guarded deletion; update compensation is fresh authorized full-source restoration,
not historical pointer/Snapshot replay. Later source claims use exact immediate
accepted outcome/phase, not inferred latest membership.

Re-creating an already-selected member always requires explicit paired remove,
including on the same ingress when changing protocols/business intent. There is no
unpaired duplicate add or automatic sequencing guarantee; original port/resource
arbitration can reject either independent action. Planned removal remains cleanup
after group archive and does not resolve a new target path.

The original owner remains supplied-Tx execution authority; coordinator owns three
new metadata tables only,64 batches/Scope inclterminal,8 actions/8 sources/16 attempts,
head20. Per-item attempt/outer idempotent response and original Runtime work commit
together; SAVEPOINT handles only known sanitized nonretryable rejections. Unknown
SQL/connection/commit failures remain unknown until identical-command replay.
Cancel prevents future apply but not committed Operations; only permitted compensation
continues. Recovery once audits/invalidates heads in original quarantine, preserves
all definitions/lineage/receipts and suspends pending work, never auto-reconciles.
Control ceiling0028/catalog28; Agent/Journal unchanged. Source-only/unverified,
not final C2 acceptance or C3 readiness. See [contract](../spec/ingress-migrations-v1.md).

## 17. Passive Forward Diagnostics (D3-A)

[ADR-0036](../decisions/0036-passive-forward-diagnostics.md) adds a narrow
`ForwardDiagnosticReadPort<Tx>` deliberate SELECT-only projection of original owners.
Viewer Scope authorization and projection share one supplied transaction on the
existing two-slot/1.5-second observation pool; Bearer lookup precedes it on that pool,
not an atomic authentication-plus-projection claim. Pre-auth admission has no main
Runtime-pool fallback. No executable Runtime/Probe method, sockets, notification queue,
cleanup, reservation or write is invoked by the GET.

The service owns bounded strict public DTO construction, seven diagnostic layers,
identity/time freshness classification and same-read64KiB redacted support export.
It validates projected fields/enums/codes instead of exposing whole Snapshot/Report/
driver configs/raw errors/security state. Projected Snapshot digest metadata is not
cryptographic recomputation of its body. Network/health remains unknown; original
ephemeral Direct TCP-IP egress Probe evidence keeps historical/current-binding limits.
Overall128KiB plus collection/truncation caps do not imply complete history/global
snapshot or measured physical capacity. Support additionally aliases identifiers and
omits addresses, target/endpoint, Profile IDs, digests, free text and actor/request
identity; it is not privileged SQL backup or forensic/recovery authority.

No Schema/Profile/Agent/ADP/Journal/deploy-flag change (Schema0028 reused). The bounded
audit query is a separate D3-A2 slice below. Station events, dedupe/silence/recovery notifications and separate SSRF-safe controlled
webhook outbox/sender remain future work. Source-only/unverified, not D3 completion.
See [contract](../spec/forward-diagnostics-v1.md).

## 18. Bounded Owner-Record Audit Query (D3-A2)

[ADR-0037](../decisions/0037-bounded-audit-query.md) adds the deliberate SELECT-only
`AuditReadPort<Tx>` over fifteen existing owner-record families, not a new audit
writer or execution authority. Current manager Scope authorization and projections
share one supplied transaction. Bearer lookup precedes it on the same two-slot,
1.5-second observation pool; actor cooldown/admission never falls back to Runtime's
main pool. No executable Runtime imports, GET mutations, network or notification.

The application owns closed query validation, public DTO allowlisting and merging
per-source bounded windows ordered by descending `(occurredAt,source,key)`. The
key derives from the full source primary-key tuple. Every filter/time/cursor
predicate applies before each source limit+1, with no COUNT or whole-history scan
claim. Default24 hours/max31 days and default25/max50 rows bound output; source
query cost is additionally constrained by the existing observation budget, not a
claim that all old tables have new indexes. Unsigned cursor binds fixed query
window/filters/limit but is position only, never authorization or snapshot proof.

Preserve original record/time/actor/revision/Node-association semantics. Recovery
batch creators are not recovery operators; mutable Operation status is not an
immutable status-transition ledger and requester is not status actor. Node filters
use explicit source identity or saved immutable source spec/config/definition,
not today's Forward. Lifecycle records do not fabricate member Forward/Operation
links. Global recovery_events lacks Scope attribution and is excluded.

Projection returns no raw details/config/spec/plan/outcome bodies, free text,
request keys/digests, fingerprints, credentials or protected recovery state.
Authorized original IDs remain manager metadata, not aliasing support export.
Related owner events and attempts are not independent-command totals; coverage,
capturedAt and pagination never establish exhaustive retention or a global
cross-page snapshot. No Schema/Agent/ADP/Journal/flag change; Schema0028 reused.
Station events/alerts, dedupe/silence/recovery notifications and controlled webhook
delivery remain future work. Source-only/local unverified; D3/project not complete.
See [contract](../spec/audit-events-v1.md).

## 19. Bounded Station Alerts (D3-B First Slice)

[ADR-0038](../decisions/0038-bounded-station-alerts.md) gives Observability a narrow
station-alert metadata owner: fixed version1 policy, condition episodes, station
events and bounded audit. Pure values parse/evaluate/reduce only; source facts use
`StationAlertFacts<Tx>` and metadata uses `StationAlertStore<Tx>`. No Core extension,
arbitrary expression, free SQL, Runtime command, active Probe or network sender.

Three rules cover eligible current Operation failure, armed exact-instance stale
Node report and expiring/expired Node credentials. Unknown/missing/invalid facts
cannot recover firing or imply target failure. Operation recovery needs a distinct
new succeeded Operation with proven revision/retry lineage; report instance change
invalidates, not recovers; credential recovery requires increased expiry. Event
time is detection, not backfilled historical transition or end-to-end health proof.

Manager commands use original authorization/Idempotency in one transaction. Viewer
reads station events; manager reads/publishes/silences policies and acknowledges
events. Observer rechecks managedBy current Scope manager permission; revocation
suspends it. Default-off independent5-second observer handles one due policy/tick,
30-second policy interval and bounded failure backoff, never GET-triggered evaluation.
Persisted episode state suppresses duplicate firing; silence marks new events while
retaining state, without later catch-up sends. Acknowledgement is not resolution.

Metadata quotas/retention expose losses, not complete history or verified capacity.
Original recovery suspends policies/resets state/marks old events without replay;
never touches protected Journal/high-water. Webhook/outbox/rate-limited delivery is
separate future work, and notification failure cannot mutate deployment success.
Source-only/local unverified; D3/project not complete. See
[contract](../spec/station-alerts-v1.md).

## 20. Protected Notification Endpoint Intent (D3-B2 First Slice)

[ADR-0039](../decisions/0039-protected-notification-endpoints.md) adds endpoint
intent/config/audit metadata and independent `NotificationSecrets` material, not
delivery authority. Manager Scope authorization, CAS, original Idempotency and
SQL audit share the supplied observation transaction. GET never decrypts secrets,
tests connectivity or sends. Public metadata has no destination URL/hostname/key,
opaque credential reference, Authority binding or secret-derived digest. Canonical
configDigest hashes only nonsecret subscription config.

PUT is full URL/key replacement with new endpoint and credential revisions;
disable is vault-independent and unchanged when already disabled after CAS. Vault
file is immutable/fsynced before SQL reference publication; rollback leaves bounded
orphans, not a fake filesystem/SQL atomic transaction. Linux-only optional
operator-preprovisioned0700 root/records and raw32-byte0600 key remain separate
from Authority/PKI. No auto-init, automatic stale-lock takeover or global orphan
cleanup. File count/bytes and limited old-record GC bound logical storage; path
checks assume trusted parent directories and no hostile root/same-UID process,
not openat2 isolation or filesystem rollback resistance.

The standalone `NotificationSender` has no caller here: no route/test/outbox/queue/
timer sends, and metadata reports deliveryAvailable:false. Its HTTPS443 primitive
resolves each attempt, rejects any forbidden answer, pins one IP with original
Host/SNI/certificate checks, TLS1.3 and bounded bytes/deadlines. Actual DNS/socket
completion retains active capacity after timeout/abort. Stable deliveryId+body HMAC
is receiver dedupe input, not proof of business processing; HTTP 2xx only acknowledges
HTTP acceptance. No redirect/environment proxy/automatic retry or raw errors/body.

Recovery suspends metadata and Authority-bound credentials need explicit re-adoption.
Source-event handoff/outbox/dedupe/rate/silence/recovery delivery/retry/dead-letter
remain future slices; no notification failure mutates deployment success. Schema0030
metadata does not change Agent/ADP/Journal/high-water. Source-only/local unverified,
not D3/project completion. See [contract](../spec/notification-endpoints-v1.md).

The unconnected statements in this section record D3-B2's first slice; section21
and ADR-0040 describe the subsequent default-off delivery implementation, not
retroactive verification of the earlier source.

## 21. Bounded Notification Delivery (D3-B2 Second Slice)

[ADR-0040](../decisions/0040-bounded-notification-delivery.md) gives notification
its own bounded outbox/attempt/rate metadata owner. New station event/state and
`StationEventHandoff<Tx>` enqueue share one supplied transaction. No old-history
scan/catch-up. Flag-off/silence/routing/queue losses are explicit; unknown SQL
failure rolls back source event and derived changes together. Recipient capacity
rejection does not discard the source event or alter original Runtime success.

Queue freezes endpoint/credential revision, policy config/actors and Authority
digest plus closed nonsecret summary payload; no URL/key/credential reference.
Stable event/endpoint ID and canonical wire property order preserve HMAC bytes
across retries. Receivers MUST deduplicate uncertain attempts; no exactly-once,
ordering or guaranteed acceptance. Claims/rate limits/attempt fences persist in SQL.

Claim and AFTER-DNS preflight each check exact current owners, manager permissions,
config/silence/authority and claim budget. DNS/socket work stays outside SQL; no
long transaction spans network. Sender has no late guard/DNS dispatch, TLS1.3 and
original-host certificate checks. Post-preflight revocation cannot retract already
dispatched bytes; the5-second network budget is not zero-latency revocation.

Scope bounds1024 heads/all statuses,256 attempt details,6 attempts,1-hour event
lifetime and7-day terminal retention. Never capacity-evict active heads; detail
eviction preserves head attempt count/fence and visible losses. Expired claims
become unknown then backoff/dead-letter, not immediate redelivery. Single host
worker retains non-reentry and vault pins until sender.idle actual DNS/guard/socket
completion; OS lookup can hold shutdown indefinitely without fake completion.

Default-off TUNEX_WEBHOOK_DELIVERY requires independent vault; worker:false is no
automatic timer, not liveness. Recovery cancels old nonterminal queue/sticky history
without resume or replay. Schema0031 metadata does not change Agent/ADP/Journal/
high-water. All functional/network/recovery/capacity acceptance remains unverified;
D3/project not complete. See [contract](../spec/notification-deliveries-v1.md).

## 22. Bounded Probe Run History (D1)

[ADR-0041](../decisions/0041-bounded-probe-run-history.md) adds independent history
for existing Direct TCP/IP-literal agent-direct-egress zero-payload Probe runs.
`ProbeRunRecorder<Tx>` receives closed issued/consumed/revoked/withdrawn/result
summaries only AFTER the existing permit owner mutation in that SAME transaction.
No second executor, new Probe type, schedule, source catch-up or GET-generated fact.
Original2-second/global256 budget/pruning remain unchanged.

History retains complete original binding/instance/time and accepted-result summary,
not fingerprint/requestId/raw bodies/addresses/config/credentials. Manager reads
use current Scope authorization and bounded observation-pool projection with no
Runtime fallback or original budget/resource locks. Agent-reported historical
evidence is not current health or topology; captured resultDigest is not recomputed
from omitted wire bodies, and summary contentDigest is not attestation.

At most1024 histories/Scope,7-day logical retention with at most16 lazy expiry
deletions on new insert, then oldest ANY-state history eviction if full. Missing
updates count loss instead of reconstructing an evicted head. Independent tables
have Scope ownership only; short-lived permit cascade cannot remove retained runs,
and history eviction does not revoke/renew execution. Recovery only marks sticky
history suspension and advances newly suspended rows' history revisions, preserving
original captured state/close/withdraw/result/update-time facts.

Manual manager API/Console adds no health aggregation, statistics, automatic Probe
or C3 switching authority. Physical/functional/retention/recovery evidence remains
unverified; D1/C3 prerequisites/project not complete. See
[contract](../spec/probe-runs-v1.md).

## 23. Bounded Existing Probe Plans (D1)

[ADR-0042](../decisions/0042-bounded-probe-plans.md) adds immutable finite
manual/scheduled intent for the existing Direct TCP Probe only. Creation performs
original-owner preflight but does not issue. Per-decision issuance uses the current
manual caller or original scheduled creator, with current manager/Node Grant checks
and a still-authorized creator; no service-account delegation or pinned-revision
rebase. Historical origin binding is not current execution authorization.

`ProbePlanIssuer<Tx>` calls the original preflight/permit owner in the supplied
transaction. Permit, Run capture, plan receipt/head and outer idempotent response
commit together; no child key or post-commit repair. Savepoints isolate only closed
known rejection codes, including explicit PROBE_PERMIT_LIMIT/429; SQL/integrity/
clock failures roll back. A trusted end cap shortens but never extends the original
two-second permit. Agent/ADP/Journal/high-water and original budgets stay unchanged.

Lifetime is at most one hour, 1..16 accepted/rejected issuance-decision slots;
scheduled interval is 30..3600 seconds. The independent default-off one-second
worker handles at most one item/tick and schedules from current decision time,
without catch-up bursts. It requires both schedule and original execution/strict
clock opt-ins. Cancel prevents only future decisions, not already issued tasks;
no refund/edit/rearm/resume. Recovery terminally suspends active plans, preserving
past receipts/IDs and cancellation facts, without replaying old authority.

Independent history owns at most 32 heads/Scope, terminal seven-day lazy pruning/
eviction with loss counters, never active-plan eviction. Manager read projection
uses the bounded observation pool and no Runtime fallback, permit inspection or
network/write action. Accepted IDs link separate lossy Run history; plan counters
and states are not dial/results/current health or C3 evidence. Functional,
concurrency, scheduling, recovery, capacity and browser acceptance remain unverified.
See [contract](../spec/probe-plans-v1.md).

## 24. Typed Same-Agent Direct Ingress Probe (D1)

[ADR-0043](../decisions/0043-typed-direct-ingress-probes.md) adds a distinct
tcp-ingress-connect-v1 measurement at agent-local-direct-ingress, not a second
executor. The host derives the numeric actual active Direct TCP listener in its
own namespace and checks exact Resource/current execution instance plus both
original listener authorization and destination CIDR policy. No caller target,
wildcard rewrite, DNS or wider route/health claim. A TCP self-connect can trigger
business accept/downstream dialing and ordinary counters despite zero payload.

Closed probeVersion:2 qualification/poll/claim/status/result binds complete typed
descriptor. Qualification uses the original Gate slot/generation, cannot renew or
rearm revoked authority, and is quarantined by recovery. Unified poll serves both
kinds with the original shared cooldown; v1 wire remains unchanged and never
receives ingress offers. Typed failure never falls back to v1. Original permit
owner, complete binding checks, Node Grant, watch/one-use burn, two-second and
global256/active/cooldown bounds still apply at each step.

Schema0034 persists ingress measurement/qualification. Old row defaults retain
egress semantics, with absent optional object keys preserving historical hashes.
Run history/finite-plan receipts carry actual type; no relabeling old results.
Existing Probe v1 counters/telemetry/rollups remain egress-only and explicitly
exclude ingress calls. No typed metrics-v2/current-health aggregation is delivered.
Control/Agent ingress flags are independent default-off opt-ins requiring original
execution/registration/strict clock prerequisites. Source-only changes do not
satisfy D1/C3, physical or production acceptance. See
[contract](../spec/direct-ingress-probes-v1.md).

## 25. Declared Observation Services And Independent Responder (D1)

[ADR-0044](../decisions/0044-observation-service-authority.md) adds an inert
manager-owned endpoint/public TLS leaf-pin registry, not execution authority.
Independent immutable configRevision/digest and current metadata CAS prevent a
historical trust read from becoming a selectable current grant. Service ID/head/
config/audit limits are 32/Scope, 64 configs/service, 256 events/Scope and latest
16 detail events plus truncation/loss. The existing central fifteen-source audit
query is unchanged; this owner's bounded detail audit is not all-site history.

Current manager authorization, Scope lock, original idempotency and metadata/audit/
receipt share a transaction on the observation pool, without Runtime fallback.
All GET/PUT/DELETE are no-network/no-secret/no-permit. Public DER is strictly
dedicated serverAuth-only/non-CA/exact DNS+scoped URI, pinned by raw-leaf SHA-256,
not a public-CA chain or proof that a remote peer owns the endpoint/private key.
No private key, credential, arbitrary URL, enrollment, worker or machine route.

Archive permanently prevents republish/reuse; recovery suspends nonarchived head
metadata without changing immutable configs. Explicit valid republish can clear
recovery isolation, not revive a task. A future issuer/watch must match current
head/config/digest and current authorization/window/policy; no read of old trust
can substitute. No immediate in-flight withdrawal is claimed by this inert slice.

Separate operator Linux TLS-only responder has its own finite identity/files,
exact listener/SNI/ALPN, source CIDR/admission/byte/time budgets and drain. It has
no Agent/Relay identity, echo/application I/O/dial/proxy or Scope-client auth.
Registry archive/recovery cannot kill that process. New source-only Docker/Compose
is unbuilt/unreleased/unverified, not a production image. No new D1 measurement
client/permit, metrics/health or C3 evidence is provided. See
[contract](../spec/observation-services-v1.md).


