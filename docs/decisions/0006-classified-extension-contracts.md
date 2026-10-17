# ADR-0006: Classified extension contracts and native execution registration

- Status: Accepted for incremental implementation.
- Date: 2026-10-16.
- Predecessors: [module boundaries](../architecture/module-boundaries.md) and
  [ADR-0005](0005-mixed-multihop-execution.md).
- Updated: 2026-10-17.
- Validation: Agent registration, Control query/resolution, Profile grants,
  member/Node Grant, whole-Node, Forward commands, Snapshot sources and passive observation implementations
  and regressions are in the working tree;
  matching-commit Actions evidence is pending. This is not a release gate
  completion or a public plug-in SDK.

## Decision

Keep Core v1 limited to the existing pure intent model, parsing, validation and
change decisions. Do not add deployments, driver implementations, credentials,
metrics or routing policy to Core. Its current implementation is a freeze
candidate, not a new declaration of completed production acceptance.

Use three separate extension categories:

| Category | Inputs and responsibility | Authority it does not acquire |
| --- | --- | --- |
| Control product module | Authorized application commands/queries and owner-owned transaction ports | Arbitrary writes to other modules' tables, a second Operation/resource ledger |
| Agent execution driver | Strictly parsed assignment, bounded policy, host authorization check and required peer identity | Issuing leases, accepting snapshots, changing sessions/fences or writing the host Journal |
| Observation / Probe | Bounded, independently authorized observation work and provenance-bearing results | Treating a probe as applied state or deploying/rerouting directly |

Do not force these categories into a generic `Module.execute(any)` interface,
create a new universal compatibility manager, or split the Control into
microservices merely to express these boundaries. The first slice implements
Agent registration. The second slice implements the concrete Control queries
and Transport resolution below; other command and observation ports still
require subsequent implementation.

## First slice: internal Agent registration

The existing Runner dispatches Direct, Relay and default-off multi-hop through
an explicitly ordered, statically constructed execution registry. Each driver
declares its ID, exact configuration schema version, roles, phases, business
protocols, advertised capabilities and Relay/multi-hop feature requirements.
Registration rejects duplicate IDs, incomplete callbacks, empty/duplicate
declarations and inconsistent multi-hop requirements. Capability output is
deterministic and deduplicated.

Driver selection uses that same declaration and rejects unknown IDs, versions,
roles, phases, protocols and disabled features. This supplements, and never
replaces, the existing closed ADP/3 schemas and semantic validators. Adding a
registry entry does not make an unsupported wire assignment valid.

The host keeps one execution sequence:

1. Parse and validate the complete Snapshot, identity, session, time and history.
2. Resolve every driver and preflight required peer credentials.
3. Persist the complete Snapshot and physical high-water in the protected
   Runtime Journal before any driver may bind or prepare a socket.
4. Build host authorization checks and invoke the selected native adapter.
5. Reconcile observations, replacements, drains, expiry and retirement through
   the existing common host.

Drivers expose startup, optional compatible in-place replacement, phase
application and existing error classification. Direct retains its TCP/UDP
listener replacement behavior. Relay and multi-hop retain prepare, activation,
drain and failed-activation cleanup behavior; they do not gain Direct's
replacement hook. No cross-driver/schema/protocol in-place handoff is allowed.

The narrow host input contains Node/session identity, policy and a peer
credential accessor. It does not contain the Runner, Journal or authority
issuer. These are trusted, compiled-in adapters, not a security sandbox against
malicious Go code. They remain private in the Control package in this slice;
package-level isolation and a public third-party SDK are not claimed.

## Compatibility and safety

No Core API, ADP/schema, driver ID, wire protocol, database schema or persisted
Journal format changes in this slice. Existing capability order and default-off
flags are preserved for supported configurations. Multi-hop still requires
Relay and the existing explicit Journal extension/migration checks.

Capability advertisement is not authorization. The host still checks leases,
credentials and physical ownership; the native engines still enforce the
provided authorization callback during data-plane operation. Disabling a
feature does not erase persisted state, retire fences or release resources
early. There is no dynamic plug-in loading, arbitrary command execution or
fallback to a weaker driver.

Forward revision continues to represent user intent. Future automatic routing
that does not change intent must use a new resolved deployment generation,
not rewrite Forward revisions.

## Verification and follow-up

The new `TestExecution*` cases cover declaration validation, selection,
capability gates, factory authorization/credential boundaries, compatible
replacement, shared ticket expiry, error mapping and policy limits.
Architecture checks prevent native driver dispatch from returning to Runner
and prevent these adapters from importing Journal/authority internals.
These targeted static checks are not a complete dependency proof.

Actions runs the new contract cases explicitly, plus the existing full Go
test/vet/race and Direct/Relay/3-4-8-node acceptance matrices. Functional,
database, network and container tests stay in Actions; local work is limited
to formatting, compilation/type analysis and dependency/document checks.
Evidence applies only to the corresponding commit.

## Second slice: authorized queries and locked Transport resolution

`ConsoleQueries<Tx>` consumes `TransactionBoundary<Tx>`,
`ScopeAuthorization<Tx>` and a typed `ConsoleReadPort<Tx>`. It does not import
MySQL, HTTP or the concrete Control application. The existing Control application
remains a composition point and wires the MySQL projection into that service.

The six existing queries (Node/Forward/Operation lists, candidates, overview and
diagnostics) retain their HTTP shapes. Validation also applies to non-HTTP callers.
Filters are detached before awaiting authorization. Each call checks scope
before reading projections on the same transaction; candidates still require
management permission and explicit Node grants. The MySQL adapter retains
bounded SELECT-only projections, sanitization, full-scope totals and the
distinction between persisted observations and independent health probes.

`TransportProfileResolver<Tx>` is an owner-defined port for exactly one
authorized immutable Profile revision, with explicit actor and scope.
Relay/multi-hop and offline Transit consumers use it rather than the full
Transport class. The current result remains a validated Relay configuration;
no generic untyped driver config or implicit latest-revision fallback is added.
Authorization/digest checks remain in the Transport owner and planners.
Offline Transit remains non-executable.

MySQL implements the transaction boundary, but existing commands still use
mysql2 transactions. Other API reads, write commands, grant-change hooks and
Runtime coordinator dependencies are not all ported. There is no new database,
state owner, schema, machine protocol or execution state machine.

Actions explicitly runs query port regressions and the adapted coordinator
tests, retaining the real SELECT-only MySQL/API acceptance. Local checks remain
static. The next command/revocation slice is recorded below. Independent
Probe/telemetry contracts follow their authorization and resource decisions.
Neither slice completes the unified extension framework on its own.

## Third slice: owner-owned Profile grant acceptance and Runtime effects

The Profile grant HTTP route now enters `TransportGrantCommands<Tx>`, not a
transaction-opening Transport method with a mutable `onGrantChange` callback.
The application service consumes transaction, owner-authorization, idempotency,
`TransportGrantWriter<Tx>` and required `TransportGrantEffects<Tx>` ports.
There is no optional effect or silent live-deployment bypass in that service.
Assembly happens once in the existing Control application, after Relay is ready.

The sequence stays within one transaction: authorize the owner, claim/replay the
existing idempotency entry, apply the owner mutation, reconcile changed grants,
then persist the complete response and operation IDs. The request digest and
HTTP status/body remain compatible. Replay still requires current owner
authorization; replay and no-op do not create extra execution work.

Transport's transaction-taking `applyGrant` primitive retains input and owner
checks, locked grant CAS, subject management authorization on grants, revision
limits, grant rows and audit events. It does not open a nested transaction,
write execution tables or invoke Runtime. Its narrowed Forwarding reference
port preserves the previous shared reference locks before authority changes.
This primitive is for trusted application composition, not an independently
complete public grant use case. HTTP cannot call it directly.

`ProfileGrantReconciler<Tx>` consumes only the owner reference lookup and a
bounded Runtime host port. It retains sequential Node locking, subject-based
execution checks, enabled-intent transition, shared ledger acceptance and
all-path capacity checks. Revocation does not transition or reserve resources;
restoration cannot bypass other Node/Profile/Scope authorization. Disabled
intents do not transition. Cross-scope references fail closed. The same host
methods and ledger are used, not a second coordinator or execution store.

Acceptance stops future renewal/publication; it is not evidence that old sockets
have closed. Existing issued leases retain their cutoff and physical resources
remain owned until the existing drain/retirement rules allow release. Forward
revision stays user intent; successful restoration may create a new deployment
generation without changing it. Core, schemas, wire protocols, database and
Journal formats are unchanged.

Actions explicitly runs seven port-regression groups and the real MySQL
multi-hop suite now includes Profile revocation/replay/restoration, rollback
after response persistence, and rollback after intermediate-node capacity
failure. Existing Transport/Relay API acceptance remains wired. Local work is
static only; none of these new functional cases has matching-commit Actions
evidence yet. This slice alone does not port the other commands;
member/Node Grant integration follows below.

## Fourth slice: member and Node Grant acceptance

`AccessCommands<Tx>` now owns the member and Node Grant application acceptance
sequences. The existing Control methods are compatibility facades that delegate
to it, so existing API and internal callers take the same production path.
Identity and Nodes retain their existing transaction-taking mutations behind
`MemberWriter<Tx>` and `NodeGrantWriter<Tx>`. Owner checks, owner protection,
membership/grant CAS, revision limits and audit SQL stay in those owners.
There is no new database abstraction or alternative authorization store.

Both commands require current owner authorization before idempotent replay, use
the existing request digest/body and commit owner mutations, Runtime effects and
the full response on the same transaction. Member inputs are detached before
awaiting authorization so digest and mutation cannot observe different ordinary
caller inputs. The original credential hash/validation helpers are shared via a
small leaf module; raw bearer tokens never enter the request digest.

`AccessChangeReconciler<Tx>` consumes actor-owned Forward references and bounded
`AccessExecution<Tx>` methods over the same host used for Profile changes.
`ForwardAuthorizationExecution<Tx>` is shared by both adapters. No execution
SQL, connection creation, credential issuance or second ledger is exposed.
Member and Node Grant rules remain explicit rather than forced into one generic
allow/deny pipeline:

- Member reconciliation locks each candidate, re-reads its current record and
  authorizer, and skips deleted or reassigned intents. Manager restoration
  rechecks subject execution authorization. Disabled intents do not transition,
  but an allowed member still checks their outstanding cleanup capacity.
- Node Grant reconciliation selects ingress or intermediate references for that
  subject, retains the existing transition/rollback behavior on restoration,
  and validates the changed Node's scoped cleanup facts. Restoration failures
  from the host propagate and roll back; they are not silently downgraded.
- Neither withdrawal is vetoed by a Snapshot capacity check. Issued leases and
  occupied slots are retained; cutoff reporting includes current and historical
  path Nodes. A member no-op returns no cutoff, while a Node Grant no-op still
  checks its Node and reports that Node's existing authorization cutoff.

Cross-scope references fail closed. The existing 5000 ms cutoff padding,
operation kinds, HTTP bodies and Forward intent revisions are unchanged.
Successful restoration may advance deployment generation, not user revision.

Actions explicitly runs eleven access-port regression groups. Four additional
real MySQL cases cover member and intermediate Node Grant withdrawal/restoration,
resource and replay semantics, persisted member-response rollback and Node Grant
restoration capacity rollback. Existing access/Relay API and data-plane scripts
remain wired. Local work stays static only; matching-commit functional evidence
has not been obtained.

Whole-Node policy/revocation follows in the fifth slice below, retaining its
separate credential and policy-denied intent rules. Remaining Forward commands,
`additionalAssignments` and independent observation/Probe contracts still need
their own slices.

## Fifth slice: whole-Node policy and credential revocation

The existing `ControlApplication.changeNode` delegates to
`NodeManagementCommands<Tx>`. Its transaction, Scope management authorization,
idempotency, `NodeManagementWriter<Tx>` and required `NodeManagementEffects<Tx>`
ports are explicit. Unlike grant administration, this use case requires Scope
management permission, not only the Owner role. Current authorization still
precedes replay; complete response, owner mutation, effects and audit share one
transaction. Closed command validation and detached, deeply frozen policy arrays
also apply to non-HTTP callers before the first await.

Nodes owns `AuthorizedNodeFacts`, policy mutation, revision CAS, credential
invalidation and security audit. The existing validator moves unchanged to a
small policy leaf; Nodes and the Runtime planner retain compatibility exports.
No owner SQL or credential storage format changes. The mutation primitive takes
the supplied transaction and does not independently publish execution work.

`NodeChangeReconciler<Tx>` consumes owner reference lookups and the existing
bounded execution host, without SQL, connections or a second ledger. Policy
recompilation uses each Forward's original authorizer, not the requesting
manager. Enabled authorized intents transition and check full-path capacity;
disabled authorized intents do not transition. Denied or missing authorizers
produce the existing failed withdrawal intent with cleanup pending through
`denyIntent`. Policy changes also retain the changed Node's final capacity check.

Whole-Node revocation instead invalidates both machine and Relay credentials,
accepts withdrawal work and bypasses policy-denial marking and Snapshot capacity
checks. An oversized removal Snapshot must not veto credential invalidation.
This does not close old sockets immediately or release occupied resources.
Issued lease cutoffs, current and historical path Nodes, raw audit timestamps
and the response's 5000 ms padding remain unchanged. A repeated revocation with
a new key retains the existing 202 acceptance semantics; same-key replay creates
no new operations or audit. Forward intent revisions remain unchanged, while
successful recompilation may advance deployment generation.

Actions explicitly runs ten port-regression groups. Six additional real MySQL
groups cover manager/source-authorizer separation, policy denial and restoration,
overlapping credential revocation, path capacity rollback, persisted response
rollback and credential/audit rollback. These cases are authored and CI-wired,
not locally executed or accepted at a matching commit yet. Core, ADP/schema,
database and Journal formats remain unchanged; the unified extension framework
is not complete. Forward write acceptance follows below, before snapshot-host
and independent observation integration.

## Sixth slice: Forward intent acceptance and native preparation

`ControlApplication.create/update/remove/retry` now delegate to
`ForwardCommands<Tx>`. The application service depends on transaction, Scope
authorization, idempotency, `ForwardWriter<Tx>`, `ForwardOperationCommands<Tx>`,
required `ForwardCommandPreparation<Tx>` and an explicitly supplied ID factory.
It does not import MySQL, HTTP, concrete Nodes/Forwarding/Runtime classes or native
compilers. The canonical parser and pure change decision remain in Core. The
existing `Accepted` type export remains compatible through a type-only re-export.

Forwarding retains the original transaction-taking repository writes, revision
CAS, authorizer binding, deletion history and scoped reads. RuntimeLedger retains
the only Operation and physical resource authority. The new typed ports do not
open transactions, mint leases, publish Snapshots or add persistence formats.
Control remains the composition point, including bounded shared execution
callbacks and the existing Relay preview; it is not a new universal manager.

`ForwardCommandExecutor<Tx>` moves native preparation out of the Control
facade. It consumes Node-owned execution authorization, resource and Relay host
ports and the same bounded execution methods used by authorization changes.
Direct creation validates the enabled projection before reservation and again
with the actual reserved slots, even for a disabled user intent. Relay creation
retains sorted Node authorization/locking and plans only after owner insertion.
Changed Direct intents still transition resources while disabled; Relay updates
plan only when enabled. No-op updates still authorize and validate, but do not
allocate a generation, rebind an authorizer or accept an Operation.

Acceptance order is intentionally not made identical to grant administration:
all four methods require current Scope visibility before replay, and management
permission for a new write. Creation replay also reads the existing scoped
Forward record; other replay paths retain their previous complete response.
Parsing detaches canonical input before authorization, preserving the request
digest, paths, status/body and complete replay semantics.

Ingress Node moves retain the narrow restored-intent exception: recovery
suspension and a revoked old Node are both required before sorted old/new Node
locking. Deletion retains its Direct versus Relay lock paths, revision exhaustion
and cleanup capacity veto; it must not inherit whole-Node revocation's capacity
bypass. Retry reads the source reference, locks the current Forward/path, then
locks and validates the source Operation. Recovered, stale and nonfailed sources
are rejected. Execution is reauthorized before any enabled transition; retry
rebinds the requesting authorizer without changing Forward revision and retains
the original source Operation and previous-spec payload.

All owner writes, reservations/fences, plans, Operations and the complete response
commit or roll back together. Existing lease cutoffs, cleanup ownership and drain
rules do not change. There is no early resource release or second execution
state machine, and Core, ADP/schema, database and Journal formats are unchanged.

Actions explicitly runs fourteen port-regression groups. Six additional real
MySQL groups cover Direct lifecycle/no-op authorization, multi-hop edit/retry,
creation response rollback, update path-capacity rollback, deletion capacity
rollback and retry response rollback. Existing Direct/Relay/multi-hop acceptance
stays wired. These are authored/CI-wired cases, not local functional results or
matching-commit acceptance. Snapshot-host integration follows below; other API
writes/reads and independent observation contracts remain.

## Seventh slice: immutable Snapshot assignment sources

The public mutable `RuntimeLedger.additionalAssignments` field is removed.
`RuntimeLedger` now requires a constructor-supplied
`SnapshotAssignmentCollector<Transaction>`. Production composition supplies one
`SnapshotAssignmentRegistry<Tx>` containing the native
`RelayAssignmentSource<Tx>`, whose narrow `RelayAssignmentReader<Tx>` delegates to
the existing coordinator. That adapter declares both Relay and multi-hop roles
even when multi-hop is disabled; disabling a feature must not remove the host's
ability to withdraw and retire its existing state.

Registry construction only validates and captures declarations/read functions;
it performs no reads or execution. The Control composition's deferred reader
resolves the readonly Relay coordinator only after complete construction. This
handles the existing Ledger/coordinator dependency without a mutable post-build
setter. Nodes' internal lock/cutoff helper and offline recovery quarantine use
explicit empty source registries; neither publishes assignments. Omitted
collectors are rejected, rather than silently treating missing production
integration as an empty result. This changes internal assembly, not the API or
machine protocol.

Registration rejects missing/duplicate source IDs, incomplete declarations,
unsupported driver/schema/role pairs and duplicate ownership. Direct remains
host-owned and cannot be declared by an extension source. The current declaration
set is closed to existing Relay/multi-hop driver v1 roles, not a dynamic plug-in
loader or an implicit expansion of supported wire schemas.

Collection runs sources sequentially in deterministic source-ID order on the
supplied transaction. Context and each result detach before later awaits;
declarations, captured source references and returned assignment values are
immutable. Contributions must belong to the requested Node and declared
driver/schema/role ownership. Duplicate assignment IDs, logical bindings and
physical protocol/port resources fail closed, including conflicts with Direct.
No source failure is swallowed and no partial result is published.

Direct-present and Direct-empty paths both use this collector, as do capacity
checks and publication. `includeAccepted` retains its existing meaning: capacity
can see pending accepted work, while publication cannot acquire authority from
that flag. The native coordinator still checks current authorizer, Scope/Node/
Profile grants, policy, pinned peer credentials, session, deployment and phase.
The registry's declarations are not authorization. Complete ADP/schema/config,
session/fence and size validation remains in the existing Snapshot compiler.

RuntimeController publication, protected authority recording, lease persistence,
drain and retirement methods are unchanged. Collectors receive no publisher,
lease issuer, Journal or alternate state store. The supplied transaction is a
trusted in-process port, not a sandbox for malicious code. A publication failure
after protected authority recording rolls back MySQL, but must never roll back
the independently persisted authority high-water. Core, ADP/schema, database and
Journal formats remain unchanged.

Actions explicitly runs ten Snapshot-source regression groups. Five real MySQL
groups cover mixed Direct/multi-hop publication and accepted-work visibility,
capacity-source failure rollback, ownership/conflict publication rollback,
default-off withdrawal with resource retention and post-lease persistence
rollback with monotonic authority high-water. Existing recovery and native
Direct/Relay/3-4-8-node acceptance remain wired. Local checks are static only;
these cases have no matching-commit functional acceptance yet.
The first passive observation contract follows below; active Probe, remaining
API reads/writes, public SDK/version guarantees and production gates are not closed.

## Eighth slice: bounded passive Node observations

`NodeObservations` accepts only `persisted-agent-report` v1 and a bounded timeout,
not an arbitrary host/port or executable command. The required
`AuthorizedNodeReportReader` has no Runtime, Snapshot, lease, resource or Journal
authority. Production composition installs `MySqlNodeObservationReader` and the
new scoped Node observation API. The pure result reducer is outside Core.
See [Node observation v1](../spec/node-observation-v1.md) for the exact contract.

The reader checks maintenance and existing Scope viewer authorization, then
reads the scoped Node and bounded persisted report metadata on the same dedicated
transaction. No raw report, credentials, assignment details or new observation
records are exposed or written. Scope diagnostics do not imply execution grants;
active probing requires a distinct authorization decision.

The host enforces per-process global, actor and Node concurrency, a bounded
actor cooldown map, request/result size and monotonic deadlines. It captures the
reader and policy at construction. Abort or expiry destroys only the source's
dedicated connection. Late pool acquisition cannot start more work; late results
cannot succeed; admission is retained until the underlying work actually stops.
Normal reads roll back before returning, and failed cleanup destroys the
connection instead of returning an open transaction to the pool.

Results separate observed/stale/unknown, bind boot/session/report/snapshot
provenance and expiry, and always carry `independentProbe:false` and
`health:unknown`. Fresh reports are not independent connectivity tests or
proof that a deployment is applied. Source failures are sanitized.

Actions explicitly runs port regressions and real SELECT-only MySQL/API cases,
including scope rejection, database non-mutation, stale/mismatched provenance
and authorization-lock timeout. Local checks are static; matching-commit
functional evidence is still pending. Core, machine messages, schemas, database,
execution state machines and Journal formats are unchanged.

This is the first implemented observation source, not a completed telemetry
pipeline, public SDK or full extension framework. The next bounded Agent Probe
foundation is separately decided in [ADR-0007](0007-bounded-agent-probe.md).
It adds a non-executable Control preflight and internal connect-only executor,
not a remote permit issuer, dispatch protocol or complete active Probe service.
