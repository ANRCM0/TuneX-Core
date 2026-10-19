# Foundation Readiness And Parallel Gate

Date: 2026-10-19 (Asia/Shanghai).
Overall: **not stable/accepted; upper parallel-development gate closed**.

Current source disposition, 2026-10-19: **A5 manual source classification and
reviewable candidate records are closed**, including the application99/Runtime34/
top-level59 maps, full Control/Agent/assets ledgers and implemented-unverified
FR-0023-0025. See
[A5 source closure](../architecture/foundation-a5-source-closure-v1.md).
The saved head `9f1d78d939a59c1514d9bcca1591afa2e89e6754` passed all nine
configured PR checks and was merged by PR #111 as
`373c291a6ea4f04e5929796a6119eb3b60027c34`. Exact checkout identity and
scope are recorded in [verification](foundation-verification-2026-10-19.md).
This supersedes source-phase statements that verification has not started.
Readiness 1-220 now has a case-by-case [assertion map](foundation-b-assertion-coverage.md):
31 requirements have complete identified assertions and 189 remain partial.
These are coverage classifications, not execution passes. The map records actual
suites and the remaining obligations; an acceptance decision is still pending.
PR #112 carries the B tests and necessary private repairs and requires its own
exact-source Actions. Upper product-module parallelism remains closed.

The source-only sections below retain implementation rationale, consumer and
planned-case details. Their no-check/unexecuted descriptions refer to each
original source slice, not the overall verification status of the saved candidate.

Source work from ADR-0047 and the first ADR-0048 extraction is present. The earlier
phrase "source scope closed" does not satisfy the human's complete foundation DoD.

## 1. DoD Evidence

| Required criterion | L0 | L1 | L2 |
| --- | --- | --- | --- |
| Public document/version | Domain v1 plus runtime kernel interface 1 documented | Framework/resource1; Host3/Ledger3/evidence2; Relay5/runtime values2/configuration2/Transport2 (FR-0009), Node authority3 (FR-0010), BackgroundTasks2, policy/observation1, Agent executionstate3/runtimeplatform2 (FR-0013), PreparedInstance1 (FR-0014; driver HostVersion1 unchanged), runtimeobservation2/platformobservation2/wire1 (FR-0015), raw Runtime status storage1 (FR-0016), observation/publication/event recovery storage1 (FR-0017); all source-authored/unverified | Entry interface/target matrix and provided ports documented |
| Automated critical-path/contract tests | Configured domain/decision suite passes on the saved candidate; detailed case mapping pending | Configured owner/host/port/lifecycle suite passes; detailed case mapping pending | Configured wire/storage/MySQL suite passes; detailed case mapping pending |
| Minimal runnable example | Consumed through L1 in the passing public example | Public extension compiles and runs in Actions on the saved candidate | Example adapter runs; real Runtime behavior uses separate integration evidence |
| Extension point instructions | Public intent and decision boundary | Ports and module recipe | Named target/refusal recipe |
| Error/log/config conventions | Pure decisions, no I/O | Common error/log ports and injected configuration documented | Adapter refusal, no hidden fallbacks or secrets in logs |
| Explicit limitations/debt | Present below | Present below | Present below and in target matrix |
| Upper module using public interfaces only | Public example passes in Actions | Public example passes in Actions | Public example passes in Actions |

Configured CI evidence above is **passed on its identified source**. Cases below
remain planned/unmapped until their actual assertions are associated with evidence;
no individual case is marked passed from aggregate totals. Source/read-only review
does not substitute for acceptance. No checks ran during the original A5 source
phase; verification and its repairs followed under later explicit authorization.

Latest independent A5 counters are cancellation1, Node report read2, Notification
effects2, executiontime2/platformclock2, executionidentity2/agentidentity2 and
nativeexecution2. Host/Guard/Journal, wire/schema and package release versions are
not changed by those source proposals. The candidate index records all other
current public counters separately. No version declaration proves compatibility.

## 2. Source Separation Record

The table and dated slices below preserve their historical bounded source
snapshots. Current source ownership/known-consumer closure is the A5 record linked
above; older statements that full classification remained open do not override
that later integration. All stated equivalence, tooling, contract/example and
physical/release evidence remains unexecuted wherever no result is recorded.

| Work item | Current state and required closure |
| --- | --- |
| Runtime controller | Extracted L1 RuntimeHost uses ports; MySQL state, ADP codec and legacy construction bridge are outside. Equivalence unverified |
| SQL ledger/Relay/Node/Identity/Transport/endpoint/Forward owner internals | Runtime hosts/common access use L1 providers; Node/Identity/Transport/endpoint/Forward product/state commands stay in independent owner modules. Notification endpoint/outbox, Probe history/plan, observation metadata/audit and diagnostic/station SQL now use lower L1 storage/read contracts; synchronous L3 value/rule/vocabulary providers preserve original interpretation. Raw telemetry/provenance types now use lower contracts directly; aggregate SQL has explicit original L3 parser/fold/limits providers. Legacy zero-argument/static stores are precise wrappers. Source splits are present, not accepted; remaining application coordination, idempotency consumers, Probe value/native/wire/default and other mixed owners/cross-module dependencies remain to classify/extract |
| Broad Agent safety/platform separation | L1 timing/Journal/identity/channel/runtimeplatform/runtimeobservation, generic executionhost and first-enrollment coordination use injected providers. Scheduler/Entropy/generic Dialer now serve original Probe executor/Gate/counter local effects; old Probe/Runner entries keep native defaults and one global budget. L2 retains native execution/binding/Probe projections, enrollment, trust/TLS/address policy and dialer providers. CLI keeps its existing composition checks/flags. Runner keeps live Probe binding/authority/current-instance checks. Probe native value/address/wire/echo/default bindings, other Control private compatibility/CLI/native composition and engine/wire internals still need closure/classification; all behavior/native compatibility acceptance remains open |
| HTTP and product module contracts | Identity/Node/Transport/endpoint, management commands/details, Console/catalog/Profile-reference/Tunnel queries, Relay preview, Transit/Probe HTTP, passive Node observations, path/ingress and all thirteen named optional observability services use independent APIs. Scope/owner, Node audit/management, Runtime/Forward state, ingress resolution and Probe instance/permit calls use public contracts. Management SQL/raw rows and L3 projection have separate providers with precise old reader bindings. Observation metadata values/platform effects now use public L2 with original L3 trust rules, and HTTP no longer imports that private value helper. FR-0011 now source-separates original L3 HTTP routes/options and L2 Hono/Node/URL/header/formats with exact old aliases and public server binding; server/CLI and full source/type/default/private/consumer/frozen-candidate classification remain open; optional observability native effects now have precise bindings but remain unverified |
| Full repository classification/enforcement | JSON inventory covers extracted scopes and known composition bridges. Unlisted source is pending classification, not implicitly compliant. Existing allowlists reference older paths and require concentrated-stage adaptation |
| Public version and change governance | Initial candidate surfaces and FR process recorded; final accepted revision and compatibility removal conditions still need evidence |
| Minimal module | L3 preview, L2 flat conversion and L1 transaction/auth/drain/log composition authored; not executed, no deployment capability claimed |

Do not open the parallel gate until the required source boundaries are closed and
the evidence below passes. Independent physical/release gates are tracked separately;
a narrow pure-module gate must not be confused with production execution approval.

### 2a. Resource And Owner Contract Slice (Source Only)

The human requested continued work from this checklist on 2026-10-18. The first
continuation separates the existing resource decisions from their SQL provider:

- L1 `RuntimeResources` and resource interface 1 own Node session lock checks,
  Direct/Relay reservations, fence/generation exhaustion, capacity and slot release.
  They receive the caller's transaction and the existing assignment limit; there
  is no clock, connection, policy discovery or second authority in this service.
- L2 `MySqlRuntimeResourceStore` uses the same runtime_nodes, port_slots and
  execution_leases tables. It has no pool or transaction entrypoint. One shared
  resource service is injected into Nodes and the original ledger at server
  composition. Old constructors retain optional-provider defaults for source
  compatibility; Nodes no longer constructs a full RuntimeLedger/assignment registry.
- `ForwardRuntimeReader`, `RelayNodeAuthority`, `RelayEndpointResolver` and
  `RelayExecutionLedger` are explicit owner contracts, not class-derived Picks.
  Relay no longer imports those concrete provider classes. Operation types and
  reservation types have independent declarations with old-path re-exports.
- Relay still decides its own deployment transitions. Operation error/failure/
  success/terminal-cleanup and desired resource-slot release now go through the
  original ledger using the same supplied transaction, without a queued event.
- This is not complete ledger/Relay/Node separation. Relay still contains SQL
  reads and deployment writes; the ledger still contains assignment and retirement/
  lease/Operation persistence. Nodes still combines identity/PKI and persistence.
  Existing default-provider bindings are migration bridges, not a new-module recipe.

No tests, checks, generators, builds, network experiments, CI, commits or pushes
were run. SQL semantics and behavior equivalence are intended, not demonstrated.
The resource adapter unifies slot reads to owner/fence/generation and parameterizes
the initial generation `1`; SQL text is therefore not claimed byte-identical.
RuntimeResourceStore is an additive source-candidate interface; no Core/ADP/schema/
Journal or frozen public semantics were changed. Removal of compatibility aliases
or a change of reservation semantics requires its own FR with explicit impact,
migration and applicable source authorization; similar foundation proposals use
the human's 2026-10-19 standing authorization without repeated confirmation.

### 2b. Ledger Coordination And Persistence Slice (Source Only)

The human requested a persistent goal to complete this checklist, retaining the
source-first agreement and later verification authorization. Ledger extraction now
continues beyond section 2a's earlier snapshot:

- L1 `RuntimeLedgerHost<Tx>` owns the original assignment/authorization filtering,
  capacity compilation, publishability, claim deadlines, Operation supersession,
  recovery quarantine, retirement, leases, drain and completion coordination.
  Clock, ID generation, compiler/decoding, assignment collection, Forward reads,
  execution authorization, resources and storage are explicit injected providers.
- L2 `MySqlRuntimeLedgerStore` keeps original statement predicates, argument order,
  operation/retirement locks, joined read-only Forward query, ordered insert/update
  groups and supplied transaction. It does not acquire a pool, retry, read a clock,
  issue an ID, authorize execution or add a recovery authority.
- The old `modules/runtime/ledger.ts` constructor now only binds these providers
  and the old compiler/policy functions. This converts an existing mixed owner to
  a declared compatibility construction bridge, not an alternate publication path.
  Its constructor and methods remain available; there is still one live ledger.
- Operation/assignment collection type declarations live in L1 and retain old-path
  aliases. The Forward owner extends the L1 consumer contract rather than copying
  its shape. Compiler/target-policy source placement is still tracked legacy debt,
  and this extraction does not certify Relay or Node internals.

This code is unverified. Existing 600000ms execution/15000ms claim bounds, 5000ms
lease safety offset, lazy decoding, statuses/error codes and distinct completion
claim-clearing branches are retained in source intent. No policy widening, SQL
schema/ADP/Journal change, history deletion or automatic retry was introduced.
No checks/tests/build/CI/network/commits/pushes were executed. The goal remains
active and the parallel-development gate remains closed.

### 2c. Relay Host, Deployment Store And Native Adapter Slice (Source Only)

- L1 `RuntimeRelayHost<Tx>` now contains the original two-Node and bounded
  multihop coordination, authorized facts resolution, transitive Node locks,
  resource selection, phase transitions, renewal/withdrawal and observation checks.
  It consumes public Node/Forward/Transport/endpoint/ledger providers plus an
  injected clock, compiler, deployment store and read-only observation port.
- L2 `MySqlRelayDeploymentStore` writes only the existing Relay deployment table.
  `MySqlRelayObservations` implements the original runtime/session/snapshot/port/
  retirement/lease projections, read-only in the same supplied transaction.
  Authorization still runs through the original owners before its corresponding
  read; neither projection nor compiler can grant execution or open a transaction.
- The old RelayCoordinator constructor binds these providers, and its static
  recovery quarantine entrypoint delegates the original update to the store.
  Operation and slot mutations continue through the original Ledger owner. There
  is no second deployment coordinator, new queue, retry or changed feature default.
- The required runtime-value contracts for Profiles/endpoints/peer facts/prepared
  plans and multihop compiler input are declared in L1. Existing owner/type paths
  export aliases or extend those declarations, rather than importing concrete
  business implementations into the host. Unrelated product DTOs were not moved.
- Direct/Snapshot, Relay and multihop compilation, native path planning, endpoint
  parsing and literal-IP target policy were relocated (not duplicated) into the
  L2 compatibility owner. `nativeLedgerCompiler` and `nativeRelayCompiler` expose
  explicit lower-port implementations; old function/type paths remain bridges.
  Persisted JSON decoding has one L2 definition, with `mysql.json` re-exporting
  the same function. It retains its old string-parse/otherwise-pass-through behavior.

This closes the tracked source placement of these Relay/codec implementations;
it does not accept their behavior or close Node/Agent/other module migration debt.
Profile revisions, plan digest/identity checks, two-Node refusal, multihop flag,
downstream-first preparation, observation-bound activation, stale-Snapshot error
guards, grace periods and the 100-deployment pending limit are intended unchanged.
All new source remains unverified; no check/test/build/formatter/generator/network/
CI/commit/push was run and no test/CI tooling was expanded.

### 2d. Node Credentials, Product Owner And Platform Providers (Source Only)

- L1 `NodeAuthorityHost<Tx>` coordinates original enrollment, machine credentials,
  rotation, Relay credential issuance, current facts/capabilities, grant-bound
  execution authorization and Node security events. Its transaction boundary,
  resource locks, Scope authority, store, machine lookup, signer, secrets, codec and
  clock are injected. It has no direct database, crypto, process or file access.
- L3 `modules/node-owner` retains provision/policy/revoke/grant/view commands and
  their existing product DTOs, with its own `public.ts`. It extends the lower host
  and uses public lower contracts rather than moving product command DTOs into L1.
  Management still checks visibility before the Runtime lock and Node record lock.
- L2 `MySqlNodeAuthorityStore` keeps original statements and owner-table mutation
  order inside the supplied transaction. `MySqlNodeMachineLookup` explicitly keeps
  the existing pool-backed TLS lookup; it is not a hidden command transaction or
  a substitute for transaction-bound credential/authorization checks.
- Existing NodeCertificateAuthority satisfies the explicit signer port, retaining
  its original OpenSSL/key/purpose/file handling and bounded calls. Original random
  IDs/tokens and hashes live in the L2 identity-secrets provider with old Identity/
  identity-credentials exports retained. Native network-policy validation and JSON/
  digest/ID/counter/target checks have a named L2 codec. Old Nodes and node-policy
  entries remain compatibility construction/function/type bridges.

No new root of trust or Agent authority/Journal is introduced. The original signer
and Node tables remain the owners. Source intent preserves enrollment expiry before
and after signing, replay digest checks and source-credential ordering, current-only
issuance, post-sign credential rechecks, existing machine/Relay authority bounds,
two-credential Relay overlap, retirement/grant revision rules and atomic audit.
No protocol/schema/feature default changed, no secrets were printed, and no checks,
tests, builds, network/PKI experiments, CI, commits or pushes were executed.
This source slice does not close Agent or unrelated Identity/module/HTTP debt and
does not open the acceptance/parallel gate.

### 2e. Agent Timing, Journal Acceptance And Platform Effects (Source Only)

- `executiontime` (L1 interface 1) owns the existing Guard/Ticket decision code and
  synchronization cache. OS samples, evidence, hostname and expected platform are
  injected. Linux CLOCK_BOOTTIME, Windows interrupt time, OS synchronization query
  and Windows text parsing moved to L2 `platformclock`; unsupported platforms keep
  their original errors. The second sample remains after a potentially blocking
  provider query, with original cache/freshness/error/holdover decisions.
- Old authorization exports retain Sample/Clock/status/options aliases, default
  OS-or-proof provider binding and a delegating Guard constructor. It owns only
  one lower Guard; the legacy clock field still supplies that guard and Ticket
  aliases the lower type. No timing/failure state is duplicated or restored.
- `executionstate` (L1 interface 1) coordinates lock/reload/stale-caller check,
  validated Snapshot history, session/Fence/phase decisions and persistence for
  the same Runtime Journal. It imports neither the native parser nor a storage
  implementation. The L2 native adapter validates the original complete wire input
  and projects only the exact fields used by the history owner, retaining raw bytes.
- Old state.AcceptRuntimeSnapshot binds its original authenticated loader, key/path,
  writer and native Snapshot codec to that host. Journal/RuntimeJournal declarations
  have one lower definition and old aliases with unchanged JSON fields/order.
  Save still precedes any Runner socket change; equal generations, failure and
  stale-caller paths preserve their original no-write/refusal behavior in source.
- L2 `platformstate` owns original Linux/Windows locks and the original atomic
  temporary-write/chmod/sync/close/rename/directory-sync body. Old state API delegates
  to those primitives. MAC, native decoding, initialization, explicit migration and
  read-only inspection stay with the original state adapter/owner; no file or
  authenticated high-water was cleared, created or migrated during this work.

This is a live source split, not a complete Runner/platform acceptance claim. The
remaining broad Agent item includes raw Runner scheduling/TLS/HTTP/credential I/O,
host observations and concrete execution/Probe coupling. No tests or tooling were
changed or executed, no gofmt/build/network/native clock/file/PKI experiment or CI
ran, and no commit/push occurred. Only source files/docs were read and edited.

### 2f. Runner Credential And Main Control Channel Effects (Source Only)

- L1 `executionidentity.Provider[Certificate,Roots]` defines credential locations,
  original request/bundle values and native file/verification effects without TLS,
  filesystem or crypto implementation dependencies. L2 `agentidentity.Native`
  contains original key/CSR/random generation, machine/Relay validation, CA reads,
  protected envelope checks and atomic credential/pending-request file effects.
- Runner retains fingerprint/Probe invalidation, mutex-protected identity switch,
  Guard update, credential/Relay renewal eligibility and the one bounded expired-
  replay retry. Machine persistence precedes reload/Guard update, which precedes
  pending cleanup. Relay save/cleanup/in-memory install and historical expired
  validation remain in their original source order. No new credential authority,
  trust store or Journal is created by these providers.
- L1 `executionchannel` defines generic main-channel client/request/idle-close
  effects. L2 `controlchannel.Native` keeps the original dynamic TLS certificate
  callback, timeout/redirect/headers/read limit/status handling. The old request
  entry retains its httpError shape; there is no hidden business/transport retry.
- `New` binds native providers; additive trusted `NewWithProviders` requires both.
  Existing package-local construction keeps native defaults, and old credential
  helpers/types still delegate/export their original shapes. Main client remains
  the same native HTTP type so untouched Probe/telemetry paths retain their behavior.

The missing flag on Relay load is true only for its first file read. A later
protected read/MAC failure is not missing-state renewal. Machine response CA does
not replace configured trust; current native machine and protected Relay JSON
decoding remain intentionally distinct. These are intended preservation details,
not executed compatibility evidence. Raw bootstrap/scheduling and Probe/telemetry
transport work remain open. No tests/checks/gofmt/build/credential/file/network/CI
experiments or commits/pushes were executed, and test tooling was not expanded.

### 2g. Bootstrap, Scheduling, Auxiliary Channels And Host Observation (Source Only)

- L1 `runtimeplatform` declares injected Bootstrap and Scheduler; L2 platformruntime
  delegates the original proof boundary/CA/key/Journal/explicit migration calls and
  standard scheduling effects. Constructor order and migration-after-credential-
  reload remain with Runner, while the CLI's instance lock/enrollment stay intact.
  Receiver-bound Runner/Probe watch operations consume the scheduler, including
  timeout/deadline/cancel callbacks, with unchanged intervals and completion waits.
- Old constructors keep native defaults; additive NewWithEffects requires explicit
  identity/channel/bootstrap/schedule/auxiliary providers. Scheduling is separate
  from Guard authorization evidence; a timer or wall reading cannot grant execution.
- Auxiliary HTTP profiles isolate original Probe instance/claim/delivery request
  creation, URL gates, client copies/redirect policy and telemetry client cloning/
  POST effects in L2 controlchannel. Owner code still bounds/reads/closes response
  bodies and decides ACK/status/context/identity/claim/freshness. Body close remains
  deferred by that same caller, not moved before parsing. URL refusal maps back to
  the original Probe sentinel, and no retry or queue was added.
- All four exporters retain independent cloned transport pools, one connection,
  original header/time bounds, per-stream redirect messages and existing no-retry
  drop accounting. Legacy sender/freshness helpers retain native defaults; live
  Runner paths supply their actual effects. A source read also found the prior
  main-request extraction had removed strconv while poll still uses FormatUint;
  that import was restored as a private source fix, not a passed compiler result.
- Host resource structs/sampling move to the existing L2 platformobservation package,
  with old private type/function aliases. Original Linux bounded reads/parsing/order,
  network truncation and non-Linux unsupported values remain source intent; the
  bounded host-worker ownership/timeout/drop logic remains in its exporter.

No native operation or validation was executed. Raw free helpers, diagnostics/
entropy/runtime observations, CLI enrollment and execution/Probe internal platform
dependencies are not certified by this slice. No test/CI tooling expansion, check,
gofmt, build, network/file/OS experiment, commit or push occurred; the full goal and
parallel gate remain open/closed respectively.

### 2h. Local Observations, Entropy And Measurement Effects (Source Only)

- L1 runtimeobservation owns the same Process/Host value declarations and an
  explicit Provider for separate memory/process/goroutine/PID/platform/host reads.
  Existing platformobservation types remain aliases; no host JSON field/order,
  units, absent-value or unsupported-platform representation is intentionally changed.
  Native reads remain L2 platformobservation.Native. Diagnostics and telemetry retain
  their original read order and Runner lock boundaries rather than batch-capturing
  unrelated values under a new lock or on an authority path.
- L1 runtimeplatform adds Entropy, MeasurementFiles and LocalLog. L2
  platformruntime.Local binds the original crypto/rand.Read, stderr line output,
  0700 parent creation and state.AtomicWrite. Diagnostics writes its configured
  path; Forward counters use the original sibling forward-counters.json. No write
  is attempted when diagnostics is disabled. Journal/credential persistence and
  MAC/high-water ownership are unchanged; these are measurement effects only.
- All four telemetry epochs and actual Probe poll/status/typed/services/echo and
  result-projection request IDs consume the injected entropy source. The default
  source retains 16/32-byte secure reads and lowercase hex, returning errors at
  the same points. No weak entropy, cached/reused ID, retry or execution fallback
  is introduced. Private old helper signatures remain native-provider wrappers.
- Old New/NewWithProviders/NewWithEffects retain their prior requirements and
  native local effects. Additive NewWithLocalServices requires all local services
  plus the existing providers/effects, with no explicit-provider fallback. Local
  defaults only support old constructors and existing package-local Runner values.
  These providers are trusted compiled-in code, not untrusted plugins.
- The host worker receives only the bound observation callback and result channel,
  not Runner/Guard/Journal. Its original 500ms cutoff, one pending sample, late
  discard and pool remain unchanged in source intent. Probe result freshness and
  the TLS-result trust helper use the existing injected operational scheduler;
  this is not a replacement for independent Guard/server-time authorization.

No check, test, formatter, build, native measurement/file/entropy experiment, CI,
commit or push was executed. This slice does not certify the mixed control package,
complete CLI/driver/Probe separation, or open the parallel gate. Acceptance item 19
is planned, not executed; all preservation claims above remain unverified intent.

### 2i. Identity Access, Membership Owner And Persistence (Source Only)

- L1 IdentityAccessHost/interface 1 handles the original bearer lookup and shared
  Scope/owner/executing checks through transaction-only IdentityAccessStore, a
  separately injected account lookup, secrets and value codec. It has no SQL,
  pool, clock/ID read, native crypto or concrete product owner dependency. Member
  role/command/view/recovery DTOs stay in L3 identity-owner, alongside original
  bootstrap, member changes, recovery rotation, list projection and access audit.
- L2 MySqlIdentityStore retains original tables, SQL predicates/arguments and
  ordered locked reads/writes on the supplied transaction. MySqlIdentityAccountLookup
  explicitly preserves the existing pool-backed bearer lookup outside a caller
  transaction; authenticateIn still uses the transaction. Native duplicate insert
  errors map to ACCOUNT_CONFLICT only in the original member-account path;
  bootstrap errors remain unmapped. Database row names are projected at the adapter.
- L2 nativeIdentityCodec preserves exact Bearer grammar, existing bearer-token,
  ID/counter validation and maximum revision. Existing native secrets supply token
  generation/hash/UUID; the injected clock stays at the original audit point.
  Audit serialization remains with the persistence adapter at the same write.
- The old Identity(db), token helper exports and MemberWriter/type paths remain
  bridges to this one owner. ControlApplication and HTTP now consume independent
  IdentityOwner/IdentityQueries. Nodes uses NodeScopeAuthority; Transport and Relay
  endpoint consumers use existing Scope/owner ports rather than the concrete class.
  This does not finish those other modules' persistence/platform/HTTP separation.
- Existing member commands still authorize and reconcile access/Runtime changes in
  their original transaction. No account/token migration, recovery execution,
  history reset, second authority/ledger, event queue or additional transaction is
  introduced. Old constructor call shapes and mutable concrete method response
  shapes are retained; independent writer contracts retain their prior readonly DTOs.

All changes are unverified source. No checks, tests, formatting, generators, build,
database/network/crypto experiments, CI, commits or pushes were performed. Required
current-source equivalence/contract/alias cases are recorded in item 20. Other
business/HTTP contracts, Agent/owner migration and full classification remain open.

### 2j. Transport Profile And Relay Endpoint Owners (Source Only)

- L3 transport-owner and relay-endpoint-owner expose independent public APIs,
  options, resolver/grant contracts and command services. Existing grant DTOs and
  type paths alias the same declarations. HTTP uses TransportApi/RelayEndpointApi;
  Control composition exposes owner contracts rather than concrete class fields.
  The original Transport/RelayEndpoints constructors bind native providers and
  retain static recovery/parser/type entrypoints without another command owner.
- L1 relay configuration interface 1 declares transaction-only storage and native
  codec ports, not product command construction or business response DTOs. L2
  MySqlTransportProfileStore/MySqlRelayEndpointStore keep original SQL/argument/
  lock/write groups on the supplied transaction. Native codec keeps original
  Profile/endpoint parsers, stored-value decode, JSON/digest, ID/counter/key rules.
  The explicit clock/ID callbacks remain at their original decision/write points.
- Transport publication keeps idempotency before locks, existing old-revision
  integrity checks, no-op revision behavior, initial owner grant and response
  writes. Locked resolve still requires Scope management and an authorized pinned
  revision. Grant mutation keeps original owner/Profile/subject checks and Forward
  reference locks before grant/event writes; existing application reconciliation
  runs before commit. Static recovery changes only the original grants when called.
- Endpoint change uses Node-owned RelayEndpointNodeAccess and Forward-owned
  RelayForwardReferences. Original Node management/revocation, endpoint update
  lock, digest comparison, active Relay refusal, endpoint write and Node audit
  stay in the same transaction. No-op still skips live-reference/write/audit; get
  still calls Node cleanup facts and returns executionSupported false. Old stored
  endpoint digest comparison is not silently replaced with stricter re-parsing.

No L0/protocol/capability/schema/authority/Journal/history change or new product
behavior is intended. No checks, tests, formatter, generator, build, native/parser/
database/network experiment, CI, commit or push was run. Section 3 item 21 records
unexecuted contract/equivalence/refusal/rollback/alias cases. Forwarding/idempotency,
Agent and other HTTP/module/classification work remain open; the gate stays closed.

### 2k. Forward Intent State And Idempotency Owners (Source Only)

- L1 `ForwardIntentStore`/`IdempotencyStore` and `StoredValues` declare
  transaction-only persistence effects. L3 `ForwardStateService` owns stored
  Forward intent projection/reference selection and affected-row conflict mapping;
  L1 `IdempotencyHost` owns ensure/locked replay/digest/status response behavior.
  Neither reads a pool, clock, ID, network, policy, parser or Runtime authority.
- L2 MySQL stores preserve the original table names, SQL predicates, argument order,
  locks, affected-row checks, JSON values and recovery flags on the supplied
  transaction. Forward lazy decoding remains the stored-value adapter; no new
  Forward parser or schema is accepted. Idempotency response encoding/decoding
  remains the same adapter at replay/write points.
- Existing Forwarding() and Idempotency() constructors bind these stores and
  native stored-value behavior. Old ports and response aliases remain available.
  ForwardCommands, RuntimeHost/Controller, Transit staging, Relay/Node references
  and application reconciliation consume owner contracts; the Runtime ledger and
  existing authority remain the only execution/publication owners.
- Preserve Forward filtering differences: deleted/recovery flags and reference
  query predicates, actor/profile/node selection, revision list ordering/limit,
  current-row versus revision-row writes, quarantine-only recovery marking and
  affected-row conflict errors. Preserve idempotency recovery invalidation,
  digest mismatch refusal, locked replay response decode and status/body writes.
  No new retry, event, transaction, authority or protected-history reset is added.

No checks, tests, formatting, generators, builds, database/network experiments, CI,
commits or pushes were run. Item 22 below is planned and unexecuted; source intent
and boundary declarations do not establish equivalence. Remaining application
coordination, HTTP views, Agent coupling and full repository classification stay open.

### 2l. Node And Core Management HTTP Contracts (Source Only)

- NodeApi is an independent L3 owner API for the original user and machine
  methods. NodeService explicitly implements it through its existing product
  methods/inherited credential owner; no lower source imports the L3 HTTP contract.
  Mutable enrollment/rotation/grant/view DTOs retain their old fields and nulls;
  policy remains unknown rather than claiming newly validated stored data.
- Independent application contracts declare Forward commands/path binding,
  member/Node grants, Node policy/revocation, Profile grants and scoped management
  details. These business responses stay with the application owners, not generic
  L1. Implementations declare the interfaces without changing their method bodies.
  Old ForwardAccepted, MemberChangeResponse, NodeGrantResponse, NodeChangeResponse,
  TransportGrantResponse and ExecutionCapabilities exports remain type aliases.
- HTTP consumes these contracts directly, replacing the corresponding concrete
  class Picks/indexed methods and never-Tx specializations. Existing optional
  fields, readonly/mutable distinctions, literal/union statuses and unknown/raw
  values remain explicit. No route, input parser, transaction, authorization,
  idempotency, machine credential or Runtime effect ordering changes are intended.
- The contract map is architecture/control-application-contracts-v1.md. Remaining
  class-derived console/Relay preview/path/ingress/Probe/observability views are
  still debt; this is not full HTTP or application layer acceptance. Existing
  business implementation paths with alias exports are not blanket layer exceptions.

No checks, tests, formatters, generators, builds, browser/network/database/PKI runs,
CI, commits or pushes were executed. Item 23 below records required substitution,
payload/old-alias and route/transaction acceptance. The full gate remains closed.

### 2m. Console, Catalog And Reference Query Contracts (Source Only)

- ConsoleQueryApi and Console paging/filter/projection/read contracts are declared
  independently of ConsoleQueries or helper implementations. NativeDriverApi,
  TransportQueryApi and TunnelQueryApi similarly expose actual existing query
  signatures and views, not class Picks or never-Tx instantiations. Classes declare
  the interfaces; method bodies, constructors, SQL and HTTP routes are unchanged.
- Old Console helper/projection, Profile reference and Tunnel record/read-port type
  exports remain aliases to single declarations. Native descriptor types reuse the
  public native compatibility type entry, with no schema/catalog/parser copy.
  Business/application query DTOs do not move into generic L1.
- Preserve explicit Console literal provenance flags, raw/unknown values, optional
  queries, nulls and old mutable/readonly distinctions. Runtime freeze does not
  introduce a new deep-readonly type or stronger literal promise. Profile proposed
  specs keep the old outer spread/explicit transport reference; Tunnel role unions,
  nested protocol/declaration readonly arrays and effective credential cutoffs remain.
- Catalog declarations and persisted Console/Profile/Tunnel metadata still do not
  confer authorization, live health, network/certificate checks, physical-host
  compatibility or deletion safety. Target Profile resolution remains authorized
  in the same transaction; paging, validation, clock and frozen response operations
  stay at their original source points.
- Source reads expose existing mixed MySQL console/transport/tunnel adapters that
  import application projection aliases or filter helpers. This reverse direction
  remains explicit debt, not accepted L2 compliance. This slice does not extend
  their SQL behavior or classify their whole implementation as an exception.

No checks, tests, type/syntax/boundary validation, formatter, generator, build,
browser/network/database/CI run, commit or push occurred. Item 24 is planned and
unexecuted. Other HTTP/Agent/adapter/classification work and the gate remain open.

### 2n. Relay Preview, Transit HTTP And Passive Observation Contracts (Source Only)

- RelayPlanApi and RelayPreview replace HTTP's ReturnType of the concrete Relay
  coordinator. The explicit union keeps single endpointRevision versus multihop
  endpointRevisions/path, absent branch fields, readonly resource arrays and the
  old broader inferred flags. The existing application explicitly implements the
  API; RuntimeRelayHost, compiler and transaction bodies are unchanged.
- TransitNegotiationApi and TransitDeliveryApi are declarations in the existing
  runtime owner, consuming original experimental wire types. Implementations add
  implements only. HTTP gets hello/poll/report, never enqueuePreview, coordinator
  confirmation or executor access. Null poll, received-only ACK, contract-only
  negotiation and original session/boot/credential/history refusals are retained.
- NodeObservationApi consumes the original observation-ports DTO and optional
  AbortSignal, not a concrete class Pick. Original closed input, budgets, cooldown,
  timeout/cancel, late-reader retained slot and safe errors remain untouched.
- Transit negotiation/delivery SQL/clock/native validation remains classified
  mixed-owner debt alongside staging. observation-ports is classified as a public
  L3 declaration, not a new L1 generic business API. No claim of full runtime/HTTP
  dependency closure follows from these narrow contract declarations.

No checks, tests, type/syntax/boundary validation, formatting, builds, generators,
network/database/browser/CI runs, commits or pushes occurred. Item 25 is planned,
not executed. Source separation and foundation acceptance remain unfinished;
the parallel-development gate stays closed.

### 2o. Path/Ingress APIs And Transactional Resolution (Source Only)

- PathGroupApi, PathPublicationApi, IngressGroupApi, IngressDeploymentApi and
  IngressMigrationApi replace five class-derived never-Tx HTTP views. Existing
  implementations explicitly implement them; original private response types move
  to named declarations. Business method/SQL/route bodies remain unchanged.
- Views keep paging/query optionality, ISO time projections, raw immutable plans,
  original response statuses/changed fields, accepted/rejected attempt unions,
  original apply/create names and nullable/undefined provenance. Literal const
  flags versus broader inferred topology/state/impact fields remain distinct;
  runtime deepFreeze does not create a new deep-readonly public type.
- IngressGroupResolver and its original Member shape are public owner ports.
  Deployments require resolveIn only and migrations require both resolveIn and
  describeIn, not IngressGroups's private state/class. Caller transaction, exact
  immutable revision/digest, management auth, lock and expansion behavior remain.
- PathTemplateConfig and PathGroupConfig/Selection move to existing public ports,
  retaining old type exports. Six path/ingress ports reference the public paging
  declaration instead of the executable helper and existing framework domain type
  aliases. Limits have one public source; four legacy exports alias the same
  objects, preserving values/const types and migration's runtime freeze/broad
  numbers. Module initialization moved; equivalence is not yet established.
- Native path-format and application coordination implementations retain direct
  Core/parser/clock/ID/helper dependencies, explicitly classified mixed debt.
  This slice does not certify them as complete L2/L3 or adapt boundary tooling.

No tests, checks, type/syntax/boundary runs, formatters, generators, builds,
network/MySQL/browser/CI execution, commits or pushes occurred. Item 26 remains
planned. Other source boundaries and all required frozen-source acceptance are
unfinished; the upper parallel-development gate stays closed.

### 2p. Probe HTTP And Original Owner Contracts (Source Only)

- Two application declaration entries replace eleven HTTP class/never-Tx views:
  Forward preflight/management and nine explicit v1/v2/v3 machine APIs. Existing
  wire request/response types are reused, not copied or widened. Implementations
  explicitly implement interfaces; HTTP route/parser/owner method bodies are not
  changed. Internal transaction/authorize/issuance/store methods remain off HTTP.
- Original acceptance DTOs move from ForwardProbes to forward-probe-api with old
  type exports. Finite-plan declaration/parser imports use that public source.
  Preflight's retained staged variants do not enable new management kinds or wire
  versions. Incomplete staged echo stays incomplete and is not newly composed.
- Instance command/registration/inspection types move to instance ports with old
  exports; ProbeInstanceOwner and ProbePermitOwner are independent public methods.
  Wrappers consume narrow owner Picks, not concrete classes. Registry retains its
  old generic arity using _Tx without a phantom runtime/provider dependency.
- Explicit permit/offer/historical/inspection/revocation views preserve shallow
  spread mutability versus nested readonly data, fingerprint omission, optional
  measurement/service metadata, nullable offers/results, ISO receipt versus numeric
  machine/revocation times and original non-execution/unknown-health fields.
  Owner dispatch and management dispatch keep their original distinct values.
- Measurement constants/arrays and qualification types now have a single public
  declaration entry; old exports alias it. The pure metadata helper has an explicit
  equivalent candidate return shape, including the original paired echo unions.
  One SQL consumer imports qualification types from that entry; broader adapter
  acceptance and import classification remain open. Probe intent/Node value types
  use existing public framework aliases instead of private/direct domain paths.
- Existing native formats, time/crypto/randomness, qualification/authorization and
  staged interactions are mixed application debt, not compliant generic L1 or new
  authority. All persistence, original shared budget/instance/permit, consumption,
  withdrawal, result/history ownership and commit-before-ACK ordering remain there.

No checks, tests, type/syntax/boundary validation, formatters, generators, builds,
network/MySQL/browser/CI runs, commits or pushes occurred. Item 27 is planned,
unexecuted. Foundation acceptance and the upper parallel gate remain unmet.

### 2q. Management Raw Reads, SQL And Product Projections (Source Only)

- New L1 management read interface 1 declares raw row/page/filter/selector contracts,
  injected effects and three supplied-transaction stores, not Console/Profile/
  Tunnel business DTOs. Existing L3 query/projection contracts remain public and
  unchanged; their basic page/filter/selector shapes use the lower declarations.
- L2 MySqlManagementReadStore, MySqlProfileReferenceReadStore and
  MySqlTunnelMetadataReadStore own the original SELECTs/predicates/args/order on
  the caller transaction. They import no L3 type, implementation or filter helper.
  Original validation and observation effects are injected; candidate capability
  selection belongs to L3. No pool, transaction, lock/write/retry is added.
- Each store invokes its trusted projection exactly once, synchronously after the
  last read, without retaining/awaiting it. L3 ConsoleReadModels,
  TransportReferenceReadModels and TunnelReadModels perform original DTO/JSON/time
  projections through public value ports. This avoids an extra asynchronous gap
  between rows and projection; effect/error/event-loop equivalence is unverified.
- Native read projection values keep stored-value behavior, dynamic Date.now,
  explicit-number ISO and zero-argument current ISO separate. Invalid date/JSON
  behavior is not normalized; these effects are observational, not authority.
  Independent mysql-read-pagination keeps the same bounded interpolation helper;
  seven other SQL adapters use that path without changing their query bodies.
- Existing ControlApplication composition explicitly binds new services/providers.
  Three old reader classes retain zero-argument construction and stateless public
  prototype delegates, not private fields that would make structural fakes nominal.
  The old helper export aliases the lower function. These are precise legacy
  provider bindings, not new composition roots or permission for L2 -> L3 imports.
- Business flags, provenance, candidate mode, null/unknown/readonly and DTO behavior
  remain with L3. Source intent preserves count/page ordering/arguments, observation
  points, filter validation and conversion failures, read-committed semantics and
  original authorization. Other mixed storage/application/Agent work is still open.

See architecture/management-read-models-v1.md for port, composition and removal
rules. No checks/tests/type/syntax/boundary/format/build/generator/network/MySQL/
browser/CI/commit/push occurred. Item 28 is planned only; foundation acceptance and
the parallel-development gate remain unmet.

### 2r. Generic Agent Execution Host And Native Driver Adapters (Source Only)

- L1 executionhost owns generic Host/Driver/Instance and the original bounded
  descriptor registry implementation. Assignment/Policy/Identity are type parameters;
  selection uses header values, explicit features and trusted platform. It imports
  no ADP/Relay, runtime/OS, native clock/I/O, Runner, Journal or authority owner.
- Existing executiondriver keeps HostVersion 1 and old public names/fields through
  typed aliases plus actual-OS registry binding. Its lower registry is held by value
  so a zero old Registry retains empty/unsupported behavior. OS filtering no longer
  lives in Control's descriptor method and does not trust observational/remote OS.
- L2 nativeexecution contains the single original Direct/Relay/Multihop factories,
  config conversion, start/replace, actual-instance observation, capacity clamp,
  phase/cleanup and error/retry behavior. Old private Control helpers delegate and
  host mapping passes the original values/callbacks. No authority/Journal is exposed.
- Driver/host versions, schemas, descriptors/capability ordering, feature defaults,
  cleanup, original persist-before-sockets and lifetime checks remain source intent.
  Runner/Guard/Ticket/Probe Gate/watch/retirement/state ownership is unchanged;
  staged echo is neither expanded nor newly composed.
- Control's private compatibility declarations/prechecks/indexing, remaining native
  type/trust/Probe/CLI coupling and engine/wire internals remain classified debt,
  not new generic modules or accepted exceptions. Typed alias/lifecycle/native
  equivalence is unverified, including old zero/nil and descriptor clone behavior.

See architecture/agent-execution-host-v1.md and the new packages' public README
contracts. No checks/tests/type/syntax/boundary/gofmt/build/generator/native/network/
MySQL/browser/CI/commit/push occurred. Item 29 is planned only; no foundation or
parallel gate is opened.

### 2s. Optional Telemetry HTTP Contracts And Public Policy (Source Only)

- Node/Forward/Host/ProbeTelemetryApi and TelemetryRollupApi replace five optional
  class/never-Tx views. Implementations explicitly implement declarations; generic
  admission methods, unknown ingest, original wire ACKs and query optionality remain.
- Explicit history/point/delta/capacity types reuse wire and owner declarations.
  Keep nested readonly values, mutable outer fields, null results/cursors, string
  counters, typed delta statuses, Node/Host literal freshness versus Forward/Probe
  broader freshness and ordinary broad inferred response flags/version numbers.
  Old TelemetryRollupQuery exports remain aliases; private delta types move once.
- Five frozen policy objects move to a public L3 source via the existing freeze
  helper. Old exports alias them; values, broad numeric types and distinct family
  object identities remain source intent. No admission state or algorithm merges.
- Ingest/history/admission/aggregation/SQL/route/worker bodies remain unchanged.
  Mixed native time/parser/Buffer/application/storage dependencies are recorded,
  not certified. Other optional diagnostics/audit/alerts/notifications/history/plan/
  service interfaces, Agent/native work and full classification remain unfinished.

No checks/tests/type/syntax/boundary/format/build/generator/network/MySQL/browser/
CI/commit/push occurred. Item 30 is planned only; source types/import relocation,
behavior and all foundation/parallel acceptance remain unverified/closed.

### 2t. Remaining Optional Observability HTTP Contracts (Source Only)

- Eight optional service views now use six independent L3 API entrypoints for
  diagnostics, audit, station alerts, notification endpoints/deliveries, Probe
  runs/plans and observation services. HTTP no longer specializes those classes
  with never Tx. Implementations declare their public API, without changing their
  original request/command/read/worker method bodies or constructor defaults.
- Explicit DTOs reuse the original owner/wire declarations. Timestamp encodings,
  optional query defaults, null histories/results/cursors, nested readonly values,
  literal evidence flags versus broad inferred strings/booleans/version fields,
  and original manager/member scopes remain compatibility intent. There is no
  broad unknown/any response escape hatch or copied storage/authority interface.
- Notification DTOs exclude credential references/authority digests/destinations;
  diagnostic support explicitly models original redacted aliases and same-read
  output. Original plan receipt moves once to the public seam with an old-path
  alias. Existing staged echo declarations/source are preserved, not enabled,
  completed, or presented as network/health/ownership verification.
- Seven limit objects and audit coverage have a public policy source; old aliases
  and notification readonly literal types remain, while the previous deepFreeze
  objects retain broad mutable TypeScript fields and runtime freezing. Each
  service keeps its own admission, actor cooldown, pool and worker state.
- No SQL, route, parsing/serialization, transaction/replay/CAS, permit issuance,
  notification dispatch or authority logic changes here. Native time/Buffer/crypto/
  wire helpers in the eight owners and six values files, all eight relevant MySQL
  adapters' product/format dependencies, and HTTP private-helper/native effects
  remain named migration debt. Declared inventory is not enforcement or acceptance.

See [public seam and integration](../architecture/observability-http-contracts-v1.md).
Item 31 is planned and unexecuted. No checks/tests/type/syntax/boundary/format/build/
generator/network/MySQL/browser/CI/commit/push ran. Whole-source separation and
foundation/parallel acceptance remain incomplete/closed.

### 2u. First Enrollment Coordination And Native Binding (Source Only)

- L1 executionenrollment.Host coordinates the original first-enrollment workflow
  through generic Platform/Channel ports with opaque native roots/client/reply
  types. No filesystem/crypto/HTTP/TLS/parser/native Journal or clock imports enter
  this source. It is not a second authority, Journal, or credential issuer.
- L2 agentenrollment moves the original CLI native key/CSR/files/CA/certificate/
  HTTPS/bounded JSON implementation once. Atomic writes and initial Journal still
  delegate to the same state owner. Old CLI function/flags/environment/path/proof/
  inspection/instance-lock/signal behavior remains in the existing composition.
- Native token/refusal/key/CSR/CA/error branches, ignored returned CA, TLS 1.3/
  ten-second/no-redirect/no-retry transport and bounded read/status/parse ordering
  are unchanged in source intent. No key format, state layout, MAC, protected
  history, enrollment lock, implicit repair or capability defaults are changed.
- Final writes retain MAC key -> original Journal initialization -> certificate,
  then the old success output before deferred reply and idle-client cleanup.
  The host completion callback preserves that lifetime rather than closing the
  response early. Partial writes are not cleaned or silently used to reinstall.

See [Agent enrollment boundary](../architecture/agent-enrollment-v1.md). Item 32 is
planned/unexecuted. Control private prechecks/Probe/trust and native engine/wire/
other composition dependencies still need work. No checks/tests/type/syntax/
boundary/format/build/generator/native PKI/file/network/MySQL/browser/CI/commit/
push ran; no whole Agent/foundation/parallel acceptance is established.

### 2v. Probe Native Destination And Pinned TLS Boundary (Source Only)

- Native Direct config/digest/policy/port projection, observed ingress numeric
  endpoint restrictions and service-to-original-business-destination matching move
  from Control to nativeexecution public helpers. Runner retains original closed
  protocols, binding/Guard/Ticket, single live instance/stream/tuple checks, deadline
  and CIDR copy, mutex/current pointer and callback rechecks; native output is not
  a permit or live-binding proof. Native failures still return old Probe denial.
- observationtrust owns the original TLS handshake implementation alongside its
  strict public context/leaf-pin/identity/purpose checks. Native TLS 1.3-only range,
  SNI/ALPN, 32768-byte independent RX/TX limits, cancellation raw close, native clock
  points, deadline/callback checks and timeout versus unverified semantics remain.
  probe.handshakeService retains its old signature/error, and its budget error
  aliases the one native budget error. Caller-owned connection closing is unchanged.
- No dial, worker, protocol/feature/capability, fallback or new application data is
  added. Gate replay burn, global admission, watch/monitor/once-report/result/
  counters/freshness, protected state and incomplete echo source are unchanged.
  Reading the two typed/services result sources exposed unused context imports;
  those imports were removed as source authoring cleanup, not compiler evidence.
- L2 trust and numeric egress-policy sources are explicitly declared, with precise
  Control/Probe bridge entries. Probe executor/Gate/counters/echo still contain
  mixed native/time/entropy/network/wire dependencies; native engines and other
  private compatibility/type references remain debt, not whole-package exemptions.

See [Probe native boundary](../architecture/agent-probe-native-boundary-v1.md).
Item 33 is planned/unexecuted. No tests/checks/type/syntax/boundary/format/gofmt/
generator/build/PKI/network/MySQL/browser/CI/Git/commit/push ran. Source separation
and all Agent/foundation/parallel acceptance remain incomplete/closed.

### 2w. Probe Executor, Gate And Counter Platform Effects (Source Only)

- Existing L1 Scheduler/Entropy are reused, with an additive generic Dialer port
  free of native connection/Probe types. L2 platformruntime owns the original
  zero-configured native dialer. Probe's old constructor signatures/resolver order
  and native defaults remain; explicit Effects constructors require all three
  trusted providers with no fallback. Runner's prior provider scope is unchanged.
- Executor time/deadline/25ms ticker points, Gate local time and secure 32-byte ID,
  process-admission release cooldown and CounterSet 16-byte epoch/UTC end times
  now use those providers. Native default read/creation/error/lock/defer order is
  retained in intent. Old private dial/acquire/counter helper and zero-value fixture
  defaults remain. Pure cancellation and original socket/attempt outcomes stay put.
- One original Gate claims/replay map, CounterSet and process-global admission
  ledger remain; no new budget per constructor/provider, queue, eviction, reset or
  execution authorization is added. Explicit schedules must share the process/
  native deadline domain, not invent independent clocks or replace Guard time.
  Counter epoch failure still only marks metrics unavailable, not execution denial.
- Typed net.Conn/net.Error, numeric address/format/wire/value dependencies, native
  default bridges and unchanged staged echo remain mixed-source debt. Native
  certificate/trust/echo operations and original Control construction are not
  silently redirected to Runner overrides or enabled by effect injection.

See [Probe effects boundary](../architecture/agent-probe-effects-v1.md). Item 34 is
planned/unexecuted. No tests/checks/type/syntax/boundary/format/gofmt/generator/
build/native PKI/file/network/MySQL/browser/CI/Git/commit/push ran. Whole Probe/
Agent/foundation source closure and all acceptance/parallel gates remain unmet.

### 2x. Notification Endpoint And Outbox Storage (Source Only)

- L1 notification storage interface 1 owns parameterized persistence envelopes,
  supplied-transaction ports and synchronous value callbacks, with config/payload/
  state/code/outcome supplied by the product. Original L3 names specialize these
  types; notification rules, payload schemas, receipts and delivery policy remain
  in L3. No higher-source/type dependency enters the lower declaration.
- Two L2 stores hold the original SQL/native row mapping once, without importing
  L3 modules/parsers. Root composition supplies separate frozen bindings to the
  original endpoint/audit and delivery/attempt parsers; callbacks stay synchronous
  at original decode/error points, not a new asynchronous validation phase.
- Existing zero-argument public store classes become stateless compatibility
  wrappers. Public endpoint count/outbox get override points stay in their old
  transaction positions through precise lower compatibility hooks. Production
  constructs lower typed stores directly; no new composition root or blanket
  reverse-import exemption is added.
- Original SQL/args/locks/JSON/dedup/immutable/CAS/loss/retention/quota/rate/history
  sequence remains source-preservation intent. No schema, pool, transaction,
  authority, request/worker, event handoff, vault, dispatch or feature changes
  occur. L3 values/native format/vault/sender and other SQL owner debts remain.

See [notification storage boundary](../architecture/notification-storage-boundary-v1.md).
Item 35 is planned/unexecuted. No checks/tests/type/syntax/boundary/format/generator/
build/MySQL/network/browser/CI/Git/commit/push ran; source separation and all exact-
revision behavior/foundation/parallel acceptance remain unproven.

### 2y. Probe History And Finite Plan Storage (Source Only)

- Parameterized L1 persistence envelopes/stores/value callbacks hold no product
  wire/parser/authority imports. Existing L3 historical run/permit/result and plan
  head/decision/failure/query names retain exact specializations; capture/recorder/
  issuer, closed business types and native TLS/echo values stay in their owners.
- Two new L2 stores contain original SQL/native row mapping once, with separate
  frozen L3 parser/immutable providers. Actual active-plan expiry conversion and
  accepted savepoint-failure classification move to synchronous L3 callbacks,
  preserving original call/lock/parse/error/rollback/release sequence in intent.
- Existing server/control and recovery composition use lower stores/static
  entries. Old zero-argument public classes/static recovery methods remain
  wrappers, including get/lockScope/put override points at old transaction slots.
  No nested transaction, second history/permit/authority owner or new root is added.
- SQL/args/projections/binary filters/JSON/presence/size/immutable/CAS/pruning/quota/
  loss/header/decision/recovery behavior remains unverified preservation intent.
  Original finite-plan application/worker, record capture, machine/HTTP/Agent and
  existing unfinished echo fields/defaults are not extended or enabled. Product
  value native dependencies and other observability SQL/whole-source debt remain.

See [Control Probe storage boundary](../architecture/probe-storage-boundary-v1.md).
Item 36 is planned/unexecuted. No checks/tests/type/syntax/boundary/format/generator/
build/scripts/MySQL/network/browser/CI/Git/commit/push ran; no foundation/parallel
or broad Probe/source acceptance is established.

### 2z. Observation Metadata And Audit Read Storage (Source Only)

L1 parameterized metadata storage and untrusted audit row/query/projection ports
contain no product/wire vocabulary imports. Two L2 stores keep original SQL/native
mapping; L3 supplies metadata kind/config interpretation and audit policy/product
projection. These deliberately preserve old type assertions, not new validation:
full metadata/trust and closed AuditEvents.row checks remain at original points.
Audit arrays keep identity/runtime mutability; only the new holder is shallow
frozen. Projection remains synchronous after the same native counter/flag mapping.
Old zero-argument/public metadata head/count/static recovery and audit entrypoints
remain precise wrappers. Existing roots use lower implementations; no new root,
pool/transaction, authority/event store, feature/echo or health claim is introduced.

See [boundary](../architecture/observation-read-storage-v1.md). Item 37 is planned
only. No checks/tests/type/syntax/boundary/format/build/scripts/MySQL/network/CI/
Git/commit/push ran. Diagnostic/station SQL, mixed product values/native/wire and
whole-source separation/acceptance remain open; parallel gate remains closed.

### 2aa. Diagnostic And Station Storage (Source Only)

L1 detached diagnostic records and parameterized station storage/fact contracts
now separate native SQL from business types. Three L2 stores keep original
diagnostic SELECT projections, station four-table mutations and passive facts;
shared native station parsing lives once in a private L2 helper. L3 supplies
original type assertions and the module-initialized audit error-code Set mapping,
without introducing earlier full business validation. Old product names specialize
the lower records; rule/state/reason/evaluation and complete validators stay L3.
Original event-body consistency and mutable-column overlay, bounded report/
snapshot projection, invalid markers, identity joins and storage limits remain
in source intent. No raw owner payload, new authority, connection or owner-table
write is added. Old zero-argument public wrappers and station policyCount override
remain; existing server composition binds lower providers on the same observation
host with the same shared station store. Async/type/native equivalence is unverified.

See [boundary](../architecture/diagnostic-station-storage-v1.md). Item 38 is planned
only. No tests/checks/type/syntax/boundary/format/generator/build/scripts/MySQL/
network/browser/CI/Git/commit/push ran. This finishes authoring this narrow pair of
storage splits, not all optional observability/application/value/telemetry/SQL,
Agent or repository source closure. All foundation/parallel gates remain unmet.

### 2ab. Raw Telemetry, Provenance And Rollup Storage (Source Only)

L1 parameterized telemetry storage/mapping and rollup storage interfaces now own
lower persistence metadata and ports without wire/L3 imports. Old Node/Host/
Forward/Probe and Runtime mapping names specialize them with original outer types.
The four existing raw stores and two provenance adapters use lower contracts
directly; their runtime bodies, class/constructor paths and production wiring are
retained. MySqlTelemetryDatabase keeps the original two-slot nonqueued observation
pool, deadline, guard and rollback/release behavior; no Runtime pool is borrowed.

The new L2 aggregate store keeps one copy of original SQL/native row checks and
receives the same original L3 observation/bucket parsers, fold function and limits
object through a synchronous explicit provider. Parsing, corruption wrapping,
fold/selection/eviction/write order and same-transaction raw/aggregate recording
are preserved in source intent. Product series/metric/quality/coverage schemas
and arithmetic remain L3. The old aggregate class keeps zero-argument public
wrappers; existing server binds one lower instance for queries and enabled recorders.
No authority, ledger/Journal, pool/transaction/retry, worker/schema, feature/default
or health assertion is added. Native/type/async/behavior compatibility is unverified.

See [telemetry storage boundary](../architecture/telemetry-storage-boundary-v1.md).
Item 39 is planned/unexecuted. No checks/tests/type/syntax/boundary/format/generator/
build/scripts/MySQL/network/browser/container/CI/Git/commit/push ran. Mixed telemetry
applications/value helpers, other owners and HTTP/Agent/full-source classification
remain open. Named storage declarations do not prove import closure or acceptance;
all foundation/parallel gates remain unmet.

### 2ac. Observation Owner Values And Native Module Effects (Source Only)

The observation metadata owner now uses public L2 native object/IP/server-name/
URN/echo-wire/public-key/leaf projection helpers while retaining its L3 schema,
window/revision/receipt/scoped trust rules. Native certificate facts never return
a key handle or raw certificate; synchronous expected-SAN/policy callbacks retain
original projection, key, short-circuit and fingerprint order in source intent.
No trust fallback or echo execution is introduced. Old value helper exports remain
aliases; HTTP removes its specific business-private observationObject import.

Public L2 UUID/digest/JSON-byte/monotonic/default-wall-clock helpers replace direct
native operations in ObservationServices, retaining the old constructor/default
function capture, explicit clock, state maps and admission/audit/transaction points.
L1 buildRequestIdentity performs the original pure identity/key/frame/immutable
coordination with an explicit digest callback. L2 supplies the original digest;
the old shared application function remains a signature-preserving wrapper and
this owner now consumes the public binding. No new state/authority, transaction,
schema, clock policy, worker, feature/default or protocol is added.

See [observation value boundary](../architecture/observation-value-boundary-v1.md).
Item 40 is planned/unexecuted. Native/API/default/initialization/equivalence and
source closure are unverified. No tests/checks/type/syntax/boundary/format/generator/
build/scripts/native PKI/MySQL/network/browser/container/CI/Git/commit/push ran.
Other mixed owners, native values, HTTP query/routing, Agent and full classification
remain open; all foundation/parallel gates remain unmet.

### 2ad. Optional Observability Application Native Effects (Source Only)

The telemetry, diagnostics, audit, station, notification and Probe history/plan
application owners now use public L2 bindings for native UUID/digest/JSON/base64/
UTC/ISO/monotonic/bytes, selected observability/Probe wire parsers and notification
secret bytes. L3 retains owner authorization, policy, admission/cooldown, clock
skew/freshness, cursor/query framing, response/receipt validation, transaction/
replay/rollback, sender/handoff and Probe/Runtime authority. Existing constructors,
default clock function capture, direct overrides, UUID placement, exact cursor bytes,
errors, feature flags and cleanup order remain in source intent. No secret leaks,
new authority, second parser policy, pool, protocol or feature is introduced.

See [observability application effects](../architecture/observability-application-effects-v1.md).
Item 41 is planned/unexecuted. Native/type/default/codec/error/transaction
equivalence remains unverified. No tests/checks/type/syntax/boundary/format/generator/
build/scripts/native PKI/MySQL/network/browser/container/CI/Git/commit/push ran.
Other application values, HTTP/query/private helpers, Probe/path/Transit storage,
Agent and full repository classification remain open; foundation/parallel gates
remain unmet.

### 2ae. Remaining Observability Value And Wire Codecs (Source Only)

Notification destination URL parsing now lives in public L2 compatibility and is
reused by application and infrastructure owners; the old application helper is a
precise wrapper. Endpoint/delivery/station values, Probe plan/run values and
telemetry rollup values now use public native digest/time/JSON/byte/base64/clone/
staged-echo-frame bindings. Original closed-object validators, state/lifecycle/
quota/measurement/rollup rules, payload order, error order and no-execution/no-DNS
semantics stay in L3. No secret, key, authority, permit, sender, pool, transaction,
schema or feature behavior is added. Compatibility and source direction remain
unverified.

See [observability value codecs](../architecture/observability-value-codecs-v1.md).
Item 42 is planned/unexecuted. No checks/tests/type/syntax/boundary/format/
generator/build/scripts/native PKI/MySQL/network/browser/container/CI/Git/commit/
push ran. Remaining HTTP/query/path/Transit/Probe owners, Agent and whole-repository
classification remain open; foundation/parallel gates stay closed.

### 2af. HTTP Codec And Generic Query Boundary (Source Only)

HTTP composition now consumes public L2 bindings for UUID/JSON/body UTF8 and the
existing observability, Runtime, Transit and Probe wire parsers. Its routes,
middleware, TLS/client certificate admission, body limits, auth/error mapping and
owner calls remain unchanged in L3. Generic pagination arithmetic is L1
`pageWindow`; the old application `consolePage` signature remains a wrapper, while
product filter vocabularies stay in the console owner. No protocol fallback,
network, authority or feature behavior is introduced; other HTTP/query/private
dependencies remain open and this is unverified.

See [HTTP codec boundary](../architecture/http-codec-boundary-v1.md). Item 43 is
planned/unexecuted. No tests/checks/type/syntax/boundary/format/generator/build/
scripts/network/MySQL/browser/container/CI/Git/commit/push ran. Foundation and
parallel gates remain closed.

### 2ag. Probe Observation Service Codec Binding (Source Only)

Probe observation service resolution now uses public L2 Probe/TLS/echo context
parsers and digest binding. L3 retains scoped reference validation, authorization,
metadata head/revision reads, archive/recovery/version/transport/window/clock rules,
resolver return shapes and existing refusal errors. The constructor/default clock
and no-network/no-credential/no-permit semantics remain unchanged in source intent.
No parser copy, fallback, sender, listener, echo execution or Runtime write is added.

See [Probe observation codecs](../architecture/probe-observation-codecs-v1.md).
Item 44 is planned/unexecuted. No tests/checks/type/syntax/boundary/format/build/
network/MySQL/browser/container/CI/Git/commit/push ran; Agent/Probe/private wire,
HTTP and full-repository classification remain open.

### 2ah. Probe Machine Codec And Default Effects (Source Only)

Probe claim/negotiation/instance/delivery/result/typed/service HTTP machine adapters
now consume public L2 Probe parsers, JSON/UTC-ISO/default-clock and digest bindings.
L3 keeps session identity, freshness, permit-owner calls, committed-before-ack
ordering, `executionEnabled: false`, service/measurement selection and refusal
rules. Existing request/response shapes and parser labels remain; no permit,
Runtime, network, sender, retry or echo enablement is added. Compatibility remains
unverified.

See [Probe machine codecs](../architecture/probe-machine-codecs-v1.md). Item 45 is
planned/unexecuted. No tests/checks/type/syntax/boundary/format/build/network/
MySQL/browser/container/CI/Git/commit/push ran; remaining Probe permit/native
code, Agent and full repository classification stay open.

### 2ai. Probe Permit Authority Codec Binding (Source Only)

The single Probe permit owner now uses public L2 parser/result-body/digest/proof,
JSON/UTC-ISO/certificate-fingerprint and default-clock bindings. Its authority,
transaction locks, budget, issuance/consume/check/revoke/withdrawal state machine,
instance/machine/plan/qualification checks, replay/duplicate handling, history and
protected store calls remain L3 and are not copied. Echo proof bytes, refusal order,
feature-disabled semantics and no Journal/Runtime ledger reset remain unchanged in
source intent. Item 46 is planned/unexecuted; all compatibility and Agent acceptance
remains open. No checks/tests/type/syntax/boundary/format/build/network/MySQL/
browser/container/CI/Git/commit/push ran.

### 2aj. Probe Permit State Validator Codec Binding (Source Only)

The pure permit state validator now uses public L2 Probe service/echo context,
selection/invocation digest and ISO bindings. L3 retains exact field-key unions,
binding identity, state/expiry/fingerprint rules, context scope/version/protocol/
window checks and malformed-state refusal. It remains synchronous/pure with no
storage, clock, network, mutation, authority or fallback. Item 47 is planned only;
no checks/tests/type/syntax/boundary/format/build/network/MySQL/browser/container/
CI/Git/commit/push ran. Agent/native and whole-repository acceptance remains open.

### 2ak. Probe Instance/Qualification Storage And Native Effects (Source Only)

Development plan A1 now gives the original instance and qualification SQL lower
parameterized persistence contracts and synchronous owner-value providers. L3
retains the exact state, thirty-second window and generation/qualification rules;
L2 owns native row/empty-slot/version-marker mapping and original supplied-Tx SQL.
Existing Control composition binds these stores directly, including permit reads.
Legacy zero-argument classes/public methods/static recovery entries remain precise
bridges to one SQL implementation. Static recovery preserves the original native
clock and quarantine updates, without clearing generation, history or budgets.

ProbeInstances uses public L2 dynamic wall-clock calls at the original five points,
not a constructor-captured clock. The previously started qualification codec split
keeps parser/JSON/ISO/default-function behavior; duplicate named codec exports are
consolidated without wrapping the original parser functions. No schema, wire,
execution/default, issuer or authority change is intended. Item 48 is unexecuted.
The human now authorizes disjoint sub-agent work within this same foundation task;
the upper-module parallel gate remains closed. Remaining permit/read/machine/intent
SQL adapters, Forward Probe internals, Path/Ingress/Transit and Agent/native/full
classification remain open; this is not whole-Probe or foundation acceptance.

### 2al. Probe Evidence Read Contracts And Forward Effects (Source Only)

Plan A1 continues with lower MachineSessionEvidence/Reader and
PublishedRuntimeEvidence/Reader contracts. Original Probe names specialize them;
ProbeIntents reuses RuntimeForwards. The three original MySQL readers now import
lower public types directly, retaining their classes, constructors, SQL, native
JSON/wire/time interpretation and same supplied transaction. No duplicate query,
new wrapper, pool or provider assembly is introduced. ForwardProbePlans/Probes
use public L2 target policy, DirectConfig, dynamic clock/ISO and request/selection
effects at original points; their product decisions and owner calls stay L3.

The prior repeated registration exports are consolidated and the existing staged
echo challenge parser receives its missing public binding. No parser is copied,
feature enabled or validation widened. Item 49 is planned only; no checks, tests,
builds, experiments, CI or Git writes ran. Permit storage and other mixed Probe
application/wire/private helpers remain open, as do all Agent and whole-repository
acceptance gates. These declarations are not proof of foundation compliance.

### 2am. Probe Permit Persistence (Source Only)

Plan A1 now separates the original permit/withdrawal/result SQL from product values.
The framework exposes parameterized storage records and synchronous value ports;
the old ProbePermitStore specializes them. MySqlProbePermitStore receives the
original L3 provider explicitly at Control composition. The zero-argument legacy
class retains stateless methods, subclass override points and static recovery over
the same lower implementation. Recovery composition uses that implementation too.

The existing single budget lock, two LIMIT 257 scans, column byte predicates, lazy
JSON branches, validation/freezing, clock CAS, close/withdraw and result insertion
remain in original source order. The 4096-byte write bound precedes result checks;
v4/v3 parser/digest checks retain their temporary requestId and error mapping, while
v1/v2 deliberately remain unchecked here. Recovery retains both separate clock
reads and preserves IDs/consumption/results/budget without refund or history reset.
See [permit storage boundary](../architecture/probe-permit-storage-v1.md).

Item 50 is planned, not executed. Old source-string boundary rules require later
adaptation to the new owner file; no test/CI tooling was expanded now. Other Probe
application/private/type/wire, Path/Ingress/Transit, Agent/native and whole-source
debts remain open. No frozen semantics, schema, feature or authority was changed;
source placement does not establish equivalence or open the parallel-module gate.

### 2an. Probe And Observation Owner Collaboration (Source Only)

Plan A1 now gives the original shared product rules an owner-local implementation
and public entry. Probe machine checks, qualification rules, measurement mapping,
permit/binding validation and the three storage value providers live under
modules/probe-owner. Observation references, configuration/trust and metadata
validation live under modules/observation-service-owner. Old paths directly alias
the original names; they do not retain duplicate implementations. Application
coordinators, transaction entry, clock reads and SQL owners remain unchanged.

ProbeObservationServices consumes the explicit public declaration read port rather
than private observation application helpers. Forward planning/commands, permit
coordination and history/plan values consume the appropriate owner public rules.
The declaration reads still use the supplied transaction and original Scope/head/
revision/time order. No read port issues a permit, publishes Runtime or owns a key.
See [owner collaboration](../architecture/probe-owner-collaboration-v1.md) for the
complete entry/rules/port/adapter/state chains and precise compatibility entries.

The application qualification validator deliberately remains narrower than its
storage projection, and staged echo description still does not authorize command
issuance. No implicit hardening, renewal, state merge, refund or feature enable is
included. Item 51 is planned only; direct wire type bindings and remaining owner/
repository classification require subsequent source work. A1 and the foundation
are not accepted, and the independent upper-module gate remains closed.

### 2ao. Probe Result Format And ACK Codec (Source Only)

The interrupted result codec entry is restored after explicit human authorization
as a direct export of the existing single native implementation. L2 owns original
result dispatch/body/digest, stored v4/v3 checks and v1/v2/v3 ACK projection. The
permit owner, storage value provider and three result adapters consume that public
entry at their original call points. Result wire type aliases remain identical.

Business binding/proof/budget/history, SQL byte bounds, transaction completion,
identity, clock sampling and freshness stay with their original owners. Typed and
service measurement descriptions are supplied at the old projection point, not
looked up by the adapter. Unknown versions still reach the original v1 refusal
path; stored v1/v2 are not silently revalidated. There is no v4 ACK or wider issuer.
See [owner result follow-up](../architecture/probe-owner-collaboration-v1.md).

Item 52 is planned only. No tests/checks/builds/experiments/CI/commits/pushes ran.
Other wire/native/default and full-source classification work remains open; neither
restoration nor source relocation establishes A1 or foundation acceptance.

### 2ap. Probe Machine Wire Projections (Source Only)

The L2 Probe machine codec now formats the original negotiation, instance, claim,
delivery, typed and service qualification/poll/claim/status acknowledgements.
The application adapters retain request parsing, mTLS-bound identity, current
permit/instance/qualification decisions, same-owner refusal, transaction commit,
clock sampling, freshness and deadline checks. They call a pure formatter only
after those checks. Measurement descriptions and qualification server-time callbacks
remain at their original evaluation points; the codec does not read a clock or
inspect authority. Wire aliases are re-exported through the public compatibility
entry without a new version or execution capability.

Item 53 is planned only. No tests/checks/builds/experiments/CI/Git writes ran.
Remaining direct wire/native/default imports and full-source classification remain
open; A1 and the foundation are not accepted.

### 2aq. PathTemplate Public Owner (Source Only)

Plan A2 begins with the original PathTemplate parser, capability requirements,
limits and head/revision validators under modules/path-owner/public.ts. The old
contract and application named exports directly alias that one implementation.
PathBindings, PathGroups and IngressGroups consume public Path rules instead of
another application's private helpers. Existing public record/read/write/reference
contracts retain their original field, readonly, optional and nullable meanings.

PathTemplate query/command coordination now consumes existing public pagination,
digest, ISO and default-clock helpers at original call points. Scope authorization,
idempotency claim, Scope/head locks, CAS, archive refusal, prior revision checks,
clock sampling, reference validation, quotas, publish/audit and response order stay
with the original owner. No SQL, listener, authority or automatic selection is added.
See [PathTemplate owner](../architecture/path-template-owner-v1.md).

Item 54 is planned only. The original SQL adapter and its reverse product/paging
types remain explicit next source work. Other Path/Ingress/Transit and A1 residual
classification remain freeze blockers; entering A2 does not accept or exempt A1.
No checks/tests/builds/experiments/CI/commits/pushes ran; the upper gate stays closed.
### 2ar. PathTemplate Storage (Source Only)

The original template SQL now has parameterized L1 records and transactional ports
over ReadPageWindow, and one L2 MySqlPathTemplateStore. Public Path records/ports
specialize the lower types; the adapter no longer imports product or application
paging types. Original raw JSON decoding and Boolean projections, bounded prefix
paging, optional head lock, Scope lock, publish/archive and audit SQL stay below.
Control explicitly supplies the lower store with the public Path configuration.
The old zero-argument MySqlPathTemplates and public async/prototype/subclass entry
points delegate without copied SQL or a new pool, transaction or authority owner.

See [storage boundary](../architecture/path-template-storage-v1.md). Item 55 is
planned only; no L0/frozen semantic, schema, protocol, feature or history change is
included. A1 residuals, other A2 owners and full classification remain blockers.
No verification, experiments, CI, commits or pushes ran; all gates remain closed.

### 2as. PathBinding Owner And Persistence (Source Only)

Original exact-selection parsing and path expansion now live under the public Path
owner; legacy functions directly alias that implementation. Path/Forward/Ingress
callers consume these public rules. Original binding records/read/write contracts
specialize lower L1 shapes over existing Forward and paging types; sequence lookup
is separate and does not add a required method to the old product writer. One L2
MySqlPathBindingStore owns the original SQL, raw JSON/Boolean projections, numeric
sequence handling, history/pointer writes and detach. Control explicitly binds it;
the old zero-argument class retains async public/prototype/subclass methods.

PathBindings keeps all product provenance, archive/digest/reference checks and the
same supplied Forward transaction, using public pagination/digest/clock/ISO effects.
The reference timestamp keeps new Date() semantics through the existing provider.
Immutable history is never cleared; the original 64-entry writer/application
invariant is not a new SQL history LIMIT. Preview remains non-authorizing metadata.
See [owner/storage chain](../architecture/path-binding-owner-v1.md) and item 56.
Other Path/Ingress/Transit and A1/native/full-classification work remain open. No
verification, CI, commits, pushes or delegation ran; all acceptance gates stay closed.

### 2at. PathGroup Owner And Persistence (Source Only)

Original shared group configuration/selection parsing and limits now have one
public Path owner, with direct legacy aliases. Parameterized L1 group metadata and
lower group-provenance records/ports replace reverse product/paging dependencies.
One lower file owns the two original SQL implementations, with explicit Control
assembly and zero-argument legacy methods. Original publish quota recheck and
conditional head CAS, group history LIMIT 64, sequence conversion and immutable
history/current-pointer writes stay distinct from template/Path binding behavior.
The legacy publish -> this.count override remains lazy at the old revision-one
call point via a trusted adapter callback, not a new product policy.

PathGroups retains its original private validators, sorted candidate/reference
reads, explicit selection, same-Forward-transaction provenance and public Path
history current/at reads. Native digest/request/paging/clock/ISO effects use existing
public providers without moving authority or enabling automatic selection. See
[group boundary](../architecture/path-group-owner-v1.md) and item 57 (unexecuted).
Other Path/Ingress/Transit, A1 residuals, Agent/Runner and full classification stay
open; no tests/checks/builds/experiments/CI/Git writes/delegation or gate acceptance.

### 2au. PathPublication Owner And Durable Storage (Source Only)

Original publication input/plan/state rules, limits and rejection Set now live in
the public Path owner with direct legacy aliases. Parameterized lower Plan/Outcome
records and ports serve one original SQL/savepoint implementation. Synchronous
product values retain the original refusal classifier before rollback and error
projection after release. Control binds them explicitly; the old zero-argument
class, optional lock and dynamic count/private-event calls remain precise entries.

The original coordinator retains head/plan/receipt/attempt validation, creator and
recovery-before-replay checks, item CAS and original Forward execution/conditional
compensation owners. FOR SHARE/FOR UPDATE, bounded reads, SQL predicates, savepoint
failure propagation and outer transaction rollback remain source-intended unchanged.
See [publication boundary](../architecture/path-publication-owner-v1.md), item 58
(unexecuted). Ingress reverse storage dependencies and other A1/A2/Agent/Runner/full
classification stay open; no verification, CI, commits, pushes or delegation ran.

### 2av. IngressGroup Owner And Persistence (Source Only)

The original ingress group/selection/input/plan parsers share one implementation
under modules/ingress-owner/public.ts, with direct legacy aliases and unchanged
limits. Existing Path and native digest/UTF-8 helpers serve their original rules.
Group records/storage ports specialize lower parameterized shapes; one L2 store
owns original SQL and Control binds it explicitly. Old zero-argument methods and
lazy publish -> this.count dispatch remain precise compatibility entries.

IngressGroups keeps private product validation and original Scope/head/transaction
coordination over public effects. Member traversal/order, distinct ingress Nodes
and common protocols, actor-dependent live-reference checks and declaration-only
describeIn/resolveIn retain original differences. These resolvers do not become
execution authorization; deployment/migration SQL and coordination remain open.
See [IngressGroup boundary](../architecture/ingress-group-owner-v1.md) and item 59
(unexecuted). Other Ingress/Transit, A1/native/Runner and full classification remain
open; no verification, experiments, CI, Git writes or delegation ran.

### 2aw. IngressDeployment Owner And Persistence (Source Only)

Parameterized lower Plan/Outcome records and ports now serve one original ingress
deployment SQL/savepoint store. Group index fields, filtered list COUNT, LIMIT 16,
revision<20 and original recovery/cancel/CAS/event behavior stay distinct from Path
publication. Control explicitly binds the original shared business refusal provider;
old zero-argument methods preserve create/count and event dispatch without copying
SQL. Refusal classification precedes rollback and error projection follows release.

The original origin/lineage/migration parsers move together under the public Ingress
owner because deployment origin uses their shared helpers. Old exports alias that
single implementation; original migration limits and native digest/byte behavior
stay intact. Deployment product validation, original transactions/Forward creation,
conditional deletion and historical origin eligibility remain with original owners.
See [deployment boundary](../architecture/ingress-deployment-owner-v1.md) and item 60
(unexecuted). Migration SQL/coordination, Transit, A1/native/Runner and full-source
classification remain open; no verification, CI, Git writes or delegation ran.

### 2ax. IngressMigration Owner And Persistence (Source Only)

The original migration SQL/savepoint body now consumes lower parameterized Plan/
Outcome/Failure contracts. Control binds the one store and original public refusal
provider; the old zero-argument class preserves lazy count/event dispatch. The
same-group guard remains before quota evaluation, filtered list COUNT stays
direct, and original source/target indexes, LIMIT 16, revision<20, CAS/recovery/
cancel behavior and late refusal projection remain source-intended unchanged.

The coordinator retains original immutable-plan/current-state/lineage checks,
manager/creator/recovery-before-replay ordering, action-specific Forward calls,
same-transaction acceptance and private receipt validation. Add compensation is
conditional removal; update compensation restores exact source state; remove is
not compensatable. Historical origin eligibility remains distinct from current
state authorization. Public paging/native providers replace private format effects
at their original points, not the original owners. See [migration boundary](../architecture/ingress-migration-owner-v1.md).

Item 61 is unexecuted. Transit, A1 residuals, Agent/native, Runner and full-source
classification remain open. No checks/tests/builds/experiments/CI/commits/pushes
or delegation ran; neither A2 nor the foundation or upper-module gate is accepted.

### 2ay. Transit Negotiation Owner And Raw Session Lock (Source Only)

The original negotiation now has one public Transit owner over the existing
transaction boundary and a required raw machine-session lock reader. One lower
SQL reader retains the original FOR UPDATE query without eager JSON decoding or
normalizing nullable numeric credential facts. Probe's shared-lock/eager projection
reader is deliberately not substituted. The owner keeps all original identity,
current boot, clock, credential, capabilities and retained-generation refusals.
L2 formats the same contract-only ACK and aliases the same wire types/capability
tuple; it does not read time, parse again, freeze the response or grant execution.

Control binds the reader explicitly. The old one-argument constructor and async
hello prototype method remain precise compatibility entries. HTTP consumes the
public Transit API, with the original old contract path directly aliasing it.
See [Transit negotiation boundary](../architecture/transit-negotiation-owner-v1.md).
Item 62 is planned only. Staging, coordination, reservation, preparation and delivery
remain mixed source debt, as do A1 residuals, Agent/native, Runner and whole-source
classification. No checks/tests/builds/experiments/CI/Git writes or delegation ran;
this is not A2/foundation acceptance or an open upper-module gate.

### 2az. Transit Preview Delivery And Shared Rules (Source Only)

The original preview delivery now has one public TransitPreviewDelivery owner over
explicit transaction, raw storage and peek-only planning contracts. One lower SQL
store retains delivery-specific machine, outbox, receipt and journal projections.
It deliberately preserves the full locked enqueue journal versus minimal poll/
report status queries; raw facts and nullable high-water values are not normalized.
L2 owns original stored-command framing, preview envelope and received ACK codecs.

Original preparation/coordination types, stage verification and offline step rules
now have one public owner. After human authorization to continue, the missing
coordination-step.ts route directly exports the existing coordination-values.ts
implementation, without deleting or copying that existing source. Old value/type
paths and the single-argument delivery class remain precise compatibility entries.

Enqueue retains the original peek transaction followed by a separate revalidation
transaction. Poll/report preserve identity/credential/JSON/clock ordering, bounded
pending reads, exact duplicate replay, high-water, freshness, receipt insert and
acknowledged CAS. The planner cannot confirm, and ACK never advances coordination.
See [delivery boundary](../architecture/transit-delivery-owner-v1.md). Item 63 is
planned only. Staging/coordination/reservation/preparation implementations, A1
residuals, Agent/native, Runner and full classification remain open. No verification,
experiments, CI, commits/pushes or delegation ran; no acceptance gate opens.

### 2ba. Transit Offline Coordination And Source Location Correction (Source Only)

The human-authorized inventory found all seven Transit entries under
apps/control/src/modules/runtime. The earlier missing-source interruption read
the incorrect src/runtime path; no source recovery or new directory was needed.
See [current Control source map](../architecture/foundation-control-source-closure-v1.md). This limited read
is not repository-wide import closure or historical deletion evidence.

Original coordination now uses public TransitCoordinationService over required
transaction/raw storage contracts and one MySqlTransitCoordinationStore. The
product retains stage actor/identity/integrity, fresh-window and sorted Node/slot
ownership rules, journal body/high-water validation, explicit proof authentication,
phase transitions and exact revision/digest CAS decisions. Recovery retains its
Scope-less stage read and withdrawal-only state change without releasing ports.
Native encoding/digest/clock calls stay at the original evaluation points,
including two distinct begin timestamps. The old single-argument journal keeps
its own public async methods and lazy db bridge; Control binds explicit providers.
See [coordination boundary](../architecture/transit-coordination-owner-v1.md).
Item 64 is planned only. Staging/preparation/reservations, A1 residuals, Agent/native,
Runner and full-source classification remain open. No checks/tests/builds,
experiments, CI, commits/pushes or delegation ran; no acceptance gate opens.

### 2bb. Transit Preparation And Exclusive Resource Mode (Source Only)

Original preparation/resource compilation and complete resource-set validation
now have public Transit implementations. Input types consume public Transport/
Endpoint contracts and existing L1 Node facts. L2 owns original Profile framing,
CIDR/time helpers and pure Transit Intent projection/JSON/parser; L3 retains path,
capability, grants, neighbor policy, peer/session/reservation binding and expiry
rules. Old compiler paths directly export the same functions and types.

Original exclusive reservation coordination now belongs to the existing Runtime
resource owner through required raw storage and capacity callbacks. Its MySQL
adapter reuses existing ensure/assign methods and keeps distinct raw Node rows,
minimal owner/fence and nullable count projections. Transit validates the full
resource set before delegating in the caller transaction. The old async function
binds that same host/store and reads DEFAULT_POLICY after each capacity query,
not at construction. Existing reserveRelay remains unchanged: it permits same-owner
reuse and has different checks/order, so it is not a substitute for this mode.
See [preparation/reservations](../architecture/transit-preparation-reservations-v1.md).
Items 65-66 are planned only. Staging/abort SQL and exact resource-release ownership
still need extraction; no new cleanup, live execution or protected-history reset
is included. A1 residuals, Agent/native, Runner and full classification remain
open. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran; no gate opens.

### 2bc. Transit Staging And Exact Runtime Release (Source Only)

Public TransitStagingService now owns the original stage/abort rules and requires
public transaction, Node/Forward/Transport/Endpoint, preparation/reservation and
exact Runtime resource-release providers. MySqlTransitStagingStore contains the
original stage SQL and explicit read-only journal/runtime/slot/lease/Snapshot
observations; only the original Runtime resource store writes physical slots.
Stage preserves the Forward-first transaction, raw latest generation, sorted
sessions, Profile-before-clock, peer/Endpoint/port selection and reservation/plan/
expiry/JSON insertion order. Abort preserves actor/retained-plan/idempotent-state,
any-journal refusal, sorted Node locks and original lease/Snapshot proof.

RuntimeReservationRelease is the extracted exact mode of the same resource owner:
all retained slots are locked/verified before any owner/Fence/generation-predicated
release, then the stage CAS occurs in the same transaction. It is not independent
historical proof or a substitute for the caller's required refusal checks. No
protected history is cleared. Existing RuntimeResourceAccess and Relay semantics
stay unchanged. The legacy five-argument coordinator keeps its own async methods,
direct verifier/type compatibility and lazy collaborator dispatch, including null
unused-provider abort fixtures. No live route or execution capability is added.
See [staging boundary](../architecture/transit-staging-owner-v1.md).

Item 67 is planned only. A1 residuals, other mixed application owners, Agent/native,
Runner and full-source classification remain open. No checks/tests/builds,
experiments, CI, commits/pushes or delegation ran; no acceptance gate opens.

### 2bd. Public Audit Owner And Original Read Projection (Source Only)

The original AuditEvents implementation, closed API/record vocabulary, limits/
coverage and AuditReadModels now live once under audit-owner/public.ts. The lower
AuditStorage and original MySQL store remain unchanged; the original assertion
callback and shallow-frozen source/error policy stay L3, with full row validation
at its original query point. Old application/flat ports/policy entries directly
alias canonical leaves. Server and HTTP consume the public owner; Station consumes
the same public Audit error vocabulary. Cursor/filter/window/order, manager Scope
authorization, sequential same-Tx source reads and per-instance admission remain
source-preservation intent. See [owner chains](../architecture/passive-diagnostic-audit-owners-v1.md).
Item 68 is unexecuted. Other mixed owners and full-source classification remain
open. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran; no gate opens.

### 2be. Public Passive Diagnostics And Stored Probe Format (Source Only)

The original ForwardDiagnostics class, public DTOs/read-port aliases and policy
now live under forward-diagnostic-owner/public.ts. It consumes the public Probe
binding rule, unchanged lower SELECT-only storage and public native codecs. L2
owns the exact retained v3/v2/v1 request framing and separate body projection;
the original parse catch still excludes projection, and all identity/trust/time/
digest/state checks remain L3. Old class/API/ports/policy entries directly alias
their canonical leaves; server/HTTP and the legacy SQL bridge use public contracts.
Original sequential reads, freshness/unknown flags, same-read support redaction,
admission/default clocks, bytes/digests and non-authorizing behavior are retained
in source intent, not established by this move. Item 69 is entirely unexecuted.
Other mixed owners, A1 residuals, Agent/native, Runner and full-source classification
remain open. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran;
foundation and upper-module acceptance gates remain closed.

### 2bf. Public Station Owner And Producer-Owned Handoff (Source Only)

Original StationAlerts commands/worker, rules/evaluator/transitions, API/contracts,
policy and storage/fact values now live once under station-alert-owner/public.ts.
They consume unchanged L1 storage/facts/transaction/Scope/idempotency, public Audit
vocabulary and L2 native primitives. StationEventHandoff is now producer-owned,
with the same supplied-Tx policy/event/time signature and old route alias. The
original appendEvent -> optional enqueueIn -> policy-state update stays one Tx;
failure deferral remains the separate guarded transaction. Old class/API/value/
storage/flat ports/policy entries directly alias their canonical leaves. See
[owner chains](../architecture/station-notification-owners-v1.md). Item 70 is
unexecuted; other owners and complete classification remain open. No acceptance
gate opens and no checks/tests/builds/experiments/CI/commits/pushes/delegation ran.

### 2bg. Public Notification Owner And Lower Effects Contracts (Source Only)

Original endpoint/delivery classes, product contracts/APIs/values and storage-value
providers now live under notification-owner/public.ts. L1 owns the exact existing
Vault/Sender declarations; native implementations import L1 without product type
references. No method, option, literal, required field or native implementation is
changed. Notification consumes Station's public handoff/rules/types. Existing
server binds the same instances and transaction paths; old paths are precise
leaf aliases and legacy SQL count/get hooks remain. Original replay/auth/stage/
publish ordering, claim/preflight/attempt/Fence guards, retry/lifetime, temporary
key zeroing and idle-before-Vault-release remain source intent. Items 71/72 are
unexecuted. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran;
other mixed owners, Agent/native, Runner and full classification remain open.

### 2bh. Public Probe Historical Capture And Read Owner (Source Only)

Original ProbeRunHistoryRecorder/ProbeRuns, record/capture/recorder/read contracts,
validators/projections/API/policy/storage values now live under the public history
owner. The original permit owner consumes its public recorder and still passes its
original transaction. L2 formats only the original retained echo invocation; it
does not resolve a current context or admit execution. Missing service-selection
parser re-exports were restored to the existing parser, not reimplemented. Lower
SQL/ports and capture/lifecycle/query/admission semantics remain source intent.
Old paths are precise leaf aliases. See
[owner chains](../architecture/probe-history-plan-owners-v1.md). Item 73 is entirely
unexecuted; no check/test/build/experiment/CI/commit/push/delegation or gate opening.

### 2bi. Public Finite Probe Plan And Original Issuer Contract (Source Only)

Original ProbePlans config/head/decision/receipt rules, APIs/issuer/read/store
contracts, policies and storage callbacks now have an independent public owner.
It consumes public Probe bindings/acceptance/preview contracts and the same original
issuer, supplied Tx and store.isolate savepoint. The original Forward Probe API
declarations move into the Probe owner with old aliases; no issuance implementation
or feature flag changes. Command replay/CAS, creator authorization, finite bounds,
recognized-refusal isolation, decision/head atomicity, scheduling and query behavior
remain source intent. Old combined history API still exposes its original const/
types through canonical leaves; original defaults and SQL hooks remain. Item 74 is
unexecuted. Telemetry, A1 residuals, Agent/native, Runner and full classification
remain open; no check/test/build/experiment/CI/commit/push/delegation or gate opening.

### 2bj. Public Telemetry Facets And Original ACK Formatting (Source Only)

Original Node/Host/Forward/Probe services and aggregate query service, shared API,
record/mapping/recorder contracts, five policy objects, rollup values/provider now
live under telemetry-owner/public.ts. Each original service keeps separate state,
admission, enabled flag and storage/mapper. Wire types use public L2 aliases; four
original ACK projections/strict parser calls move to L2 while mapped count guards
and private ack dispatch stay in L3. L1 contracts and lower SQL/mapping/database
bodies are unchanged, with same five root instances, targets and recorder binding.
Old class/API/flat/runtime/policy/value paths directly alias canonical leaves.
See [owner chains](../architecture/telemetry-public-owners-v1.md). Items75-77 are
unexecuted. Original raw/aggregate transaction/order/epoch/precise-count/quality/
coverage/admission/read semantics remain source intent, not proven equivalence.
A1 residuals, other application/HTTP, Agent/native, Runner and full classification
remain open. No check/test/build/experiment/CI/commit/push/delegation or gate opening.

### 2bk. Observation Declaration Public Service Chain (Source Only)

The original ObservationServices command/query class, API/DTOs, storage values and
flat product contracts now live in observation-service-owner/public.ts beside its
existing rules/reference/read port. Original class/leaf aliases, runtime-mutable
limits, per-instance budgets/default clock and inert declaration semantics remain.
Existing Control/server/HTTP roots use the public entry with original lower SQL
providers; legacy head/count overrides and static recovery are unchanged. See
[owner chain](../architecture/observation-service-owner-v1.md). Item78 is entirely
unexecuted: replay/locks/CAS/clock/quotas/archival/recovery/reads/rollback and exact
API/provider identity remain source intent, not acceptance. A1 coordination,
other application/HTTP, Agent/native, Runner and full classification remain open.
No checks/tests/builds/experiments/CI/commits/pushes/delegation or gate opening.

### 2bl. Control Probe Instance And Qualification Coordination (Source Only)

Original ProbeInstances, ProbeInstanceRegistry, ProbeNegotiator and v2/v3 registry
classes now live under the public Probe owner with exact original machine API,
instance/evidence/measurement/qualification contracts and CurrentProbeInstances.
Old application/flat paths are precise leaf aliases; Control binds same original
classes/stores. Dynamic instance/hello/registry clocks versus captured qualification
clocks, same-transaction locks/time resampling, generation/replay/tombstone rules
and distinct v2/v3 ACK timing remain source intent. See [chains and compatibility](../architecture/control-probe-registration-owner-v1.md). Items79/80 unexecuted.
Other A1 coordination and A2 application/HTTP, A3/A4/A5 remain open. No checks,
tests/builds/experiments/CI/commits/pushes or acceptance. Source-task delegation was
explicitly authorized by the human on 2026-10-19; verification remains unauthorized.

### 2bm. Control Probe Preflight, Command And Declaration Resolution (Source Only)

Original ForwardProbePlans/ForwardProbes/ProbeObservationServices now live under
public Probe owner, with canonical plan/service/owner/permit/result contracts.
Exact old leaf exports and same Control/finite-plan/issuer/Observation bindings
remain. Preflight five-kind support versus three-kind issuance, same-Tx replay/
flag/window/read/target/capability checks and clock distinctions remain original.
See [chains](../architecture/control-probe-plan-command-owner-v1.md). Item81
unexecuted; permit/claim/delivery/result/type/service coordination still open.

### 2bn. Agent Probe Native Adapters (Source Only)

Original address/CIDR/unmap/format/family, echo bounded socket exchange, native
default factories and JSON/timestamp/frame/deep-equality mechanics now live in
probe/native, an explicit L2 child owner. Parent keeps original product binding/
measurement/window/authority/Gate/counter/budget and exact private wrappers/error
identity. Fresh default dialers/fixture fallbacks/native hard-time checks remain.
See [chains](../architecture/agent-probe-native-owner-v1.md). Item82 unexecuted;
public native/wire types, Runner scope and A3/A5 full classification remain open.

### 2bo. Runner Wire, Assignment And Native Catalog (Source Only)

Original Hello/live Snapshot/retained JSON/report/ACK codecs and Direct/Relay
assignment conversion now have nativeexecution L2 leaves. Original native factory
order and capability projection also live there, with same legacy adapters and
prechecks/index/error order in Control. Original Runner authority/Journal/locks/
tickets/start/replace/drain/cleanup/stop remain. See [chains and planned cases](../architecture/runner-execution-source-continuation-v1.md). Items83/84 unexecuted;
remaining private registry/native-engine/authority/Journal/CLI and A4/A5 source
classification remain open. No whole-Control or native-engine acceptance claim.

### 2bp. Console Query Public Owner (Source Only)

Original ConsoleQueries/ConsoleReadModels/filter/page rules/API/DTO contracts now
live under console-query-owner/public.ts. HTTP and Control consume public owner;
original L1 store/values and lower SQL remain explicitly bound. Exact old leaf
aliases, mutable vocabulary/results, same-Tx authorization/read and callback time
sampling remain. Mixed management-read-models retains Transport/Tunnel originals.
See [chains](../architecture/console-query-owner-v1.md). Item85 unexecuted; remaining
queries/commands/HTTP and full classification remain open.

All four sections record source intent only. Human authorized subagents on
2026-10-19 for these source tasks. No tests, type/syntax/static/boundary checks,
formatters/generators/builds/CI/native/network/MySQL/browser/container experiments,
commits or pushes ran. No foundation acceptance, physical/release readiness or
parallel feature-development gate is opened.

### 2bq. Control Probe Permit And Machine Coordination (Source Only)

Original ProbePermits/Claims/Delivery/Results/Types/Services bodies now live under
public Probe owner with local canonical contracts/rules and public L1/L2/history/
Observation dependencies. Old six application entries are precise class aliases;
Control still builds same instances, store/budget/clock/qualification/history.
Original lock/clock/issuance/consume/discovery/withdrawal/result and per-version
ACK/freshness differences remain source intent. See [owner chains](../architecture/control-probe-permit-machine-owner-v1.md). Items86-88 entirely
unexecuted. The former named application implementations are no longer bodies,
but full A1/A5 source/type/default inventory and acceptance remain open. No new
echo issuance, budget, authority or format is introduced. No tests/checks/builds/
experiments/CI/commits/pushes; human-authorized source agents do not open any gate.

### 2br. Control, Transport And Tunnel Query Chains (Source Only)

Original ControlQueries and TunnelQueries now have public owners; TransportQueries
and its reference projection join the existing public Transport owner. All three
original read projections are canonical leaf aliases at management-read-models,
with its original version constant. Existing Control/HTTP bindings consume public
entries, keeping required lower stores, values, optional resolver and exact clock
semantics: Transport tail dynamic new-Date ISO, Tunnel captured Date.now default.
See [chains](../architecture/control-transport-tunnel-query-owners-v1.md). Items89-91
planned only; original same-Tx/read/order/window/flags intent remains unverified.

### 2bs. Identity Access And Node Commands (Source Only)

Full original AccessCommands/NodeManagementCommands plus APIs/effects now belong
to their existing public Identity/Node owners. Old application and Runtime effects
port leaves precisely alias canonical declarations; Runtime reconciler bodies and
root instances are unchanged. L2 nativeIdentityTokenHash aliases original tokenHash,
with original public codec/request/ISO operations. See [chains](../architecture/access-node-command-owners-v1.md). Items92/93 unexecuted: same-Tx
owner/manage -> replay -> writer/effects/audit/receipt, exact hash and truthy +5000
response rules remain source intent, not proven equivalence.

### 2bt. Native Catalog And Logical Tunnel Views (Source Only)

Original NativeDrivers/NativeTunnels implementations/API declarations now have
public product owners; catalog/digest are direct original L2 aliases. Full original
Path template/binding and Forward command APIs move to their matching public
owners with exact old leaf aliases; this does not move ForwardCommands itself.
Existing Control/HTTP roots bind same collaborators/default flags/instances.
See [chains](../architecture/native-catalog-tunnel-owners-v1.md). Items94/95 entirely
unexecuted; no new tunnel command identity, state, authority or platform evidence.

### 2bu. Agent Legacy Registry And Echo Endpoint Mechanics (Source Only)

Original legacy registry header and declaration rules now have nativeexecution L2
functions around the same original Runner duplicate-ID check; callback availability
is checked before wrappers, then original clone/index and strict registry last.
Actual echo numeric/policy/observed-endpoint mechanics move to same native L2 owner
with echo-specific order. Original Runner feature/instance/ticket/trust/callback
and authority owner remain. See [continuation and per-file inventory](../architecture/agent-probe-native-owner-v1.md). Items96/97 unexecuted. Remaining
Probe HTTP/JSON/wire/time, Runner ADP/credential formats and A3/A4/A5 classification
are explicit source blockers, not whole-package exceptions.

These sections record authored source only. Human-authorized source agents do not
open feature development or authorize checks/tests/builds/format/generation/CI/
experiments/Git writes. All listed acceptance/functional/physical/release gates
remain separate and unmet where evidence is absent.

### 2bv. Profile Grant And Forward Command Bodies (Source Only)

Full original TransportGrantCommands/ForwardCommands now live in their existing
public owners, with exact old class/API aliases and canonical original Forward
operation/retry/preparation collaboration ports. Existing Runtime resource/Relay
ports and all implementation bodies remain; Control/HTTP binds original classes,
providers, optional provenance and same Tx. Profile digest shape and changed-only
effects, distinct CRUD/manage/replay order, supplied-Tx respond=false, retry and
restoration fallback remain. See [chains](../architecture/forward-profile-command-owners-v1.md). Items98-101 unexecuted.

### 2bw. Passive Node Observation And Relay Preview (Source Only)

Original NodeObservations/rules/API/product contracts now have a public owner;
raw context/provenance/evidence/reader declarations move unchanged to public L1.
Lower MySQL reader only changes type import, keeping original SQL/cancellation.
Original controller/timer native expressions join public L2 at same call sites;
parent retains work-settled admission release, abort/listener/finally policy.
Original Control planRelay body now belongs to required-provider RelayPlans, with
original root async delegation and same existing RelayCoordinator after assembly.
See [chains](../architecture/node-observation-relay-plan-owners-v1.md). Items102/103
entirely planned, unexecuted; neither observation nor preview grants execution.

### 2bx. Agent Probe HTTP And Result Representation (Source Only)

Original JSON encoding, bounded response body reads/error decode and instance/
claim/poll/negotiation Parse+Check mechanics now live in nativeexecution/probe_http.
Caller retains original Close/cancel/size/status/clock/claim and currentness order.
Original v2/v3/v4 result construction/marshal/strict parse now has one L2 wire
source, while parent descriptor/Point/TLS/echo proof/evidence checks, scheduler
samples, report-once and authority remain. See Agent Probe/Runner continuation
docs. Items104/105 unexecuted. Remaining time/status/qualification/delivery/credential
formats, Path/Ingress/HTTP and whole A5 classification stay actual source blockers.

All are authored source intentions, not type/behavior/native/contract evidence.
No tests/checks/formatters/generators/builds/CI/experiments/Git writes ran. Current
source-agent permission does not open verification or parallel feature gates.

### 2by. HTTP Native Effects And Path/Ingress Public Owners (Source Only)

The complete HTTP entry was read through Runtime and the old createApp wrapper.
Original TLS/fingerprint, bounded request-body, native error and console asset
read implementations now have public L2 helpers; route limits, ordered admission,
authentication, telemetry lookup exclusions, security headers and owner calls stay
at their original sites. NodePolicy uses Node public. See [HTTP source chain](../architecture/control-http-native-adapter-v1.md).
HTTP query/header/URL/native-type/default and full middleware classification remain
open; no blanket whole-adapter compliance is declared. Item106 unexecuted.

Original PathTemplate queries/commands, bindings, groups and publications now have
canonical full class/API/contract leaves under Path public; Ingress groups,
deployments and migrations have corresponding full canonical leaves. Existing
Control/HTTP roots consume them with original instances/stores/Forward callbacks.
NativePathReferences also has its original canonical Path class using public Node/
Transport/Endpoint contracts; original Node execution types are canonical public
with old exact aliases. Path/Ingress limits are canonical local leaves with same
identity/mutability/freeze intent and exact old combined aliases. See [full chains](../architecture/path-ingress-source-continuation-v1.md).
Items107/108 unexecuted. Root/Runtime/HTTP/private native/default and whole A5
classification remain explicit blockers; moved classes do not open acceptance.

### 2bz. Agent Probe Qualification And Delivery Representation (Source Only)

Original v2/v3/v4 machine/qualification/poll/claim field construction, JSON and
Parse/Check, qualification wire times, service context/native trust conversion and
v1 status codecs now have two nativeexecution leaves. Claim fields still precede
burn; encoding remains after burn/deadline and before shared admission. Original
native/injected entropy and time scope, both qualification parses, parent Guard/
currentness/receipt/budget/freshness/authority stay. See [Agent exact chains](../architecture/agent-probe-native-owner-v1.md).
Item109 unexecuted. Remaining version status/report, echo JSON/reflect, generic
result/report ACK/native/default/type chain stays open, without new echo authority.

### 2ca. Runner Report And Credential Representation (Source Only)

Original report/drain fields and UTC text, ordered Snapshot validity/issuance parses,
Machine/Relay request map, Relay response bundle and retained renewal schedule now
have nativeexecution leaves. Caller retains every original scheduler sample,
short circuit, provider/history callback, retry gate, save/remove and authority.
See [precise source and remaining debt](../architecture/runner-execution-source-continuation-v1.md).
Hello and Relay expiry/overlap parse sites remain adjacent to original authority
decisions; URL/key/private engine/Journal/default inventory also remains open.
Item110 entirely unexecuted; this does not close A4 or foundation acceptance.

### 2cb. Agent Execution Wire, Echo And Shared Time (Source Only)

Original v2/v3/v4 status and all four result ACK Parse/Check implementations now
live in nativeexecution leaves; parent keeps family checks, service/challenge/
receipt equality, deadlines, report-once, watch freshness and final authority.
Generic result field/JSON/fixed-millisecond formatting now has a neutral L2 value
projection, with original parent measurement/clock/uncertainty/entropy/cutoff.
Echo native context encode/decode are separate stages, preserving marshal failure
before sampling and parse failure after sampling. Shared ParseWireTime now serves
Probe/Snapshot/Hello/Relay format points with old Probe alias, without moving
short-circuit clocks, Guard or provider/history decisions. See [exact chains](../architecture/agent-execution-wire-source-v1.md).
Items111/112/114 unexecuted; native URL/protected key/default/engine/CLI/private
Runtime and complete A5 classification remain open. Product comparisons remain L3.

### 2cc. HTTP Query Codecs (Source Only)

Fifteen original API query files now have canonical lower codecs or the Console
owner entry with exact old aliases. HTTP imports public L2 and Console public.
L2 uses neutral query record declarations, with the original Console map/validator
supplied by the product entry at the original loop/filter/page phases; no reverse
L2 product source import. Original per-family duplicate/empty/pagination/revision
ceilings/first-error differences stay. See [complete query source distinctions](../architecture/control-http-native-adapter-v1.md).
Item113 unexecuted; remaining HTTP Hono/node-server/URL/header/inline projection/
lifecycle/default and full consumer/removal inventory still require source work.

All are authored source intent. This turn used no subagents and ran no checks,
tests, formatting/generation/build, CI, experiments or Git writes. No foundation
or feature gate is opened and no exact accepted source revision exists yet.

### 2cd. Control Execution Policies In Product Owners (Source Only)

Full original ForwardCommandExecutor/registry/native adapters now belong to Forward
public, while original Profile/Access/Node reconcilers belong to Transport/Identity/
Node public. Original authorization/resource/Relay/adapter contracts are canonical
owner declarations with exact old Runtime aliases. Full Node management/grant
declarations are local canonical leaves, preserving old flat exports and audit.
Control binds the same instances/callbacks over the same RuntimeLedger/Relay hosts;
those hosts and all storage bodies remain original. Public L2 supplies original
compileDirect/catalog instead of private planner/type references. See [chains](../architecture/control-execution-policy-owners-v1.md).
Items115-117 unexecuted; no Runtime/foundation compliance from source relocation.

Original SnapshotAssignmentRegistry/RelayAssignmentSource now also have canonical
Forward classes and old exact aliases. Original L1 assignment contracts remain;
native catalog/wire type/structured clone use L2 public and original callback/
sorting/duplicate/error/detach timing. Control retains one original deferred source
and one original collector. The source doc lists every current Runtime-directory
file as implementation/alias/wrapper with precise remaining debt, without claiming
whole-repository import/type/consumer/default closure. Item118 unexecuted.

The L1 time debt found in this slice is subsequently source-addressed by FR-0002:
host interface2 explicitly requires clock and parse/format codec, with native effects
bound in the old constructor. That breaking direct-host scope was confirmed, then
the human granted standing authorization for similar future source proposals.
Runtime/default/native/type/whole-A5 inventory and candidate remain open.
No checks/tests/builds/CI/experiments/Git writes or agents this turn.

### 2ce. Runtime Host Interface2 And Explicit Compatibility Exports (Source Only)

FR-0002 source implementation requires now and RuntimeCodec parseTime/formatTime,
with the host-specific version2 and exact missing-effects refusal before policy/
clock/I-O. L2 runtimeCodec binds original native time functions, RuntimeController
binds dynamic native clock with its original positional constructor. Original
clock samples and parse/format call positions, hold/reuse/claim/report decisions,
authority-before-save/leases and all existing owners remain. Item119 unexecuted.

Runtime query/forward-telemetry/probe-telemetry type bridges now explicitly list
their original exports through public L1/Telemetry entries, preserving names;
Transit staging consumes public Transport. Known native provider/default/consumer
capture points are recorded in the execution-owner source doc; item120 unexecuted.
These declarations do not prove complete A5, type equivalence or runtime behavior.

The human's 2026-10-19 standing instruction now authorizes autonomous selection and
source implementation of similar foundation proposals after an FR records impact/
compatibility/migration/acceptance. No repeated human confirmation is needed for
that source scope. Root instructions/template/plan reflect it. Verification, Git,
release and feature gates remain separate; no checks/tests/CI/experiments ran.

### 2cf. Background Lifecycle And Remaining Host Time Effects (Source Only)

FR-0003 now requires explicit BackgroundTaskEffects in direct L1 construction,
with background interface2. One native L2 interval/monotonic provider is bound in
server, whose original five tasks/startup/close calls remain; old application
construction aliases one native subclass of the same lifecycle. Its one-argument
constructor remains, while equality with the direct framework constructor is no
longer promised. Missing effects refuse before clock/scheduling/owner callbacks.
Non-overlap, backoff samples/cap, cancellation and drain remain original intent.
Item121 is planned/unexecuted. See [source inventory](../architecture/framework-lifecycle-effects-v1.md)
and [FR-0003](../changes/FR-0003-background-task-explicit-effects.md).

FR-0004 moves remaining Ledger/Relay/Node host Date conversion to required methods
on their existing compiler/codec ports and updates each specific interface to2.
Native providers supply original parse/ISO functions; legacy constructors/default
clock capture remain. Every conversion stays at its original expression, including
Ledger drain/ready short circuits, Relay status/plan/observation and Node response
formatting after credential writes but before replay/audit. Node provision keeps
post-commit formatting, view keeps its original transaction/truthiness. Required
method refusal is intentional for incomplete old direct/custom providers. Item122
unexecuted; [FR-0004](../changes/FR-0004-owner-host-time-codecs.md) records impact.

Common error/RequestLifecycle aliases now consume public framework; old application
ports explicitly list the six original types. Common source/dependency/default
observations and exact compatibility distinctions are recorded. Nine L1 files still
directly reference outer shared/runtime wire types, with a transitive Relay config
dependency; the source doc lists each symbol/file. This remains migration debt,
not a shared-type exemption or whole-A5 closure. Item123 unexecuted. All broader
HTTP/Agent/native/default/type/consumer/removal/frozen-candidate work remains open.
No tests/checks/builds/formatters/CI/experiments/commits/pushes or agents this slice.

### 2cg. Common Values And Relay Native Assignment Views (Source Only)

FR-0005 moves the one original thirteen-field Policy declaration into the explicit
L1 @tunex/contracts/policy entry; six L1 imports migrate. Old types/shared/runtime/
index/legacy aliases retain the same type, and DEFAULT_POLICY's original initializer
stays in its native owner. FR-0006 similarly moves original Observation/Drain/
Condition facts plus the existing three-phase union into the L1 execution-observation
entry. Original wire reports alias those facts; no native envelope/config schema
or Core/kernel API moves into L1/L0. Package exports were edited manually, not
generated or executed.124/125 planned/unexecuted; source-text/augmentation and all
actual consumers still need inventory. See [current chains](../architecture/runtime-common-values-and-relay-views-v1.md).

FR-0007 exposes lower readonly assignment network/peer views through two required
compiler methods. Native adapter returns original config/hop references at the
old cast expressions. Host retains all pinsChanged/authorized/authorizationBound
loops, lookup/digest/short-circuit/conditional Now and Tx/authority decisions. Relay
interface3 supersedes its historical interface2; original wrapper/defaults/static
recovery remain. Missing direct/custom projections intentionally refuse after the
time-codec guard before options/policy copying.126 planned/unexecuted.

Nine framework files still directly consume native RuntimeAssignment/Snapshot/
Messages/Tombstone/Profile types, with transitive Relay profile and explicit host
ADP capability/envelope choices. Common value relocation and narrow views do not
close those debts, full A5, the candidate or any acceptance gate. No checks/tests/
formatters/generators/builds/CI/experiments/commits/pushes or delegation this slice.

### 2ch. Runtime Common Facts And Explicit Native Family (Source Only)

FR-0008 now relocates common assignment/resource/tombstone/snapshot and Hello/report/
ACK fields into one lower execution-values entry. Native interfaces extend/alias
these fields while keeping their original protocol/driver payload declarations and
schemas/parsers. An erased RuntimeValueFamily carries native extensions through
host/ledger/Relay/assignment/evidence ports; native providers/wrappers explicitly
specialize it, including MySQL, Forward sources, Probe publication and HTTP. Old
wire-bearing Runtime aliases preserve native specialization rather than the new
common default. No Core/kernel, native default policy or generated data changes.
See [actual graph](../architecture/runtime-value-family-native-v1.md).

RuntimeHost's exact protocol and capability predicates move into required native
codec methods with foreign-Node refusal between them. Hello/ACK projection remains
at the original expression after original getters/format/sample/policy copy and
digest/prior lookup respectively; native formatters do not parse/sample/clone.
Required machine methods refuse after clock/time guard before policy validation.
All publication/claim/fence/authority-before-save/lease/report/cleanup decisions stay
in the existing owners/Tx. Source versions: Host3, ledger3, Relay4, runtime evidence2,
new common values1. Other wire/driver/framework versions remain.127-129 unexecuted.

The inspected former raw assignment/snapshot/message dependencies now use lower
family facts, but this is not a type/boundary pass. RuntimeRelayProfile still uses
native RelayProfileConfig, with transitive relay configuration debt; other native
owner policies, HTTP/Agent/CLI/default/source/consumer/candidate work remains. No
tests/checks/formatters/generators/builds/CI/experiments/Git writes or delegation.

### 2ci. Opaque Profile And Node Native Codec (Source Only)

FR-0009 extends the existing family with opaque Profile payload and parameterizes
Profile transport/compiler/input/configuration ports. L1's default is unknown;
native family/aliases select original closed RelayProfileConfig for Transport,
Endpoint, native compilers, Transit and old multihop input. No native schema is
copied into L1/L0. Configuration codec now supplies native ISO; Transport get uses
it at the old property inside Tx after original read/parse/digest. Missing formatter
intentionally refuses direct/custom construction before effects. Source versions
values2/Relay5/configuration2/Transport2; Endpoint body/module1 unchanged.130-132
unexecuted. See [actual source chains](../architecture/profile-node-native-boundaries-v1.md).

FR-0010 Node authority3 requires original token/CSR/native runtime predicates and
fingerprint prefix projection on the existing native codec. Native support reads
the same facts reference at original two capability accesses. Host keeps exact
isId/token/CSR error stages, identity/listener/port before support, protocol/target
afterward, and every signer/replay/credential/clock/Tx/authority decision. Fingerprint
format remains at the original credential-map property with no parse/normalization.
Four required methods refuse after original constructor guards, before effects.
Original Nodes constructor/defaults/static recovery remain.133/134 unexecuted.

Named Profile/input representation dependencies in the inspected graph are source-
migrated; complete L1/repository classification and type/boundary/behavior acceptance
remain unproven. Full HTTP/Agent/native/default/private/consumer/removal/frozen-source
and example work continues. No checks/tests/formatters/generators/builds/CI/experiments/
commits/pushes or delegation in these source slices.

### 2cj. Control HTTP Product And Native Public Entries (Source Only)

FR-0011 keeps the complete original product route integration in api/routes.ts and
the original four service/options declarations in api/contracts.ts, exposed by
L3 api/public.ts (HTTP interface1). Old app/ports directly alias original functions/
types; server uses public with the same services/lifecycle. Native Hono/Node/URL
factory/types/context access live in L2 compatibility/control-http/public.ts without
reverse L3 types or an eager Hono import from the general native barrel. Routes use
those public operations at each original site. Original epoch predicate/Console
headers/Probe withdrawal expression are pure native functions; query string versus
params.size, body/field/argument/error order and optional lifecycle remain original.
See [actual chain, consumers and removal gates](../architecture/control-http-native-adapter-v1.md#fr-0011-product-routes-and-native-transport-public-entries).

135-137 planned/unexecuted. No signature/default/wire/SQL/authority/ledger/Journal
or native fallback change; equivalence is intended, not verified. Full server/CLI/
Agent and repository type/private/default/consumer/candidate work and acceptance
remain open. No checks/tests/formatters/generators/builds/CI/experiments/Git writes
or delegation occurred.

### 2ck. Agent Journal And Runner Native Values (Source Only)

FR-0012 executionstate interface2 adds required SnapshotCodec SupportsProtocol and
PhysicalSlotKey methods. Native state codec supplies original version3 and exact
physical key at original stages; host retains lock/reload/stale/input/extension/
binding/session/Fence/owner/phase/map/save/error ownership. Custom old method sets
must migrate, without native fallback. State owns shared physical/Transit key and
original Runtime envelope helpers; Runner loader/migration/current/retired keys
now consume them. Drain tuple uses nativeexecution; prefix URL/path use channel,
legacy httpError delegates only existing text. Native formats are pure and leave
old defaults, same Journal, persistence-before-bind and ACK/tail/drain rules intact.
See [actual chains and limits](../architecture/agent-journal-native-values-v1.md).

138-140 planned/unexecuted. Remaining explicit L1 external-type debt includes
Journal RawMessage/native JSON tags/format metadata; other Agent wire/telemetry/
offline Transit clock/engine/default/CLI and full source/type/private/consumer/
frozen candidate inventory remain open. This is source progress, not A3/A4/A5 or
foundation acceptance. No tests/checks/gofmt/generators/build/CI/experiments/Git writes
or delegation occurred.

### 2cl. Agent Journal Facts And Explicit Native Records (Source Only)

FR-0013 executionstate3 uses tagless Journal Snapshot []byte and neutral FormatVersion/
ImportedHistoryDigest. L2 state owns exact original native Journal/RuntimeJournal
fields/order/tags/RawMessage; the previous lower/native type identity intentionally
splits. Custom lower users/direct serializers must migrate to facts/native APIs.
All fields/references project through two pure native converters at original store/
wrapper/Bootstrap/Runner boundaries. Native wrapper returns original native current
on error. Host only changes two metadata field names; original history/save/error
and persist-before-bind remain. Bootstrap referenced facts change, so runtimeplatform/
native platformruntime2; other methods/defaults/native state APIs remain original.
See [actual chain, mapping and limits](../architecture/agent-journal-facts-native-v1.md).

The specific FR-0012 RawMessage/tag/native Transit-metadata debt is source-migrated,
not verified.141-143 planned/unexecuted; full Agent/Control/default/private/type/
consumer/CLI/engine/wire/frozen candidate and example/acceptance remain open. No
tests/checks/gofmt/generators/build/CI/experiments/Git writes/delegation occurred.

### 2cm. Offline Transit Native Binding And Prepared Lifecycle (Source Only)

FR-0014 adds L1 PreparedInstanceVersion1 (Activate/Close) without changing existing
driver HostVersion1. Original controller consumes explicit L2 native identity/intent/
engine/error and existing time codec/Schedule. Same concrete engine binds to the
minimal lifecycle; nil pointer becomes nil interface and partial pointer/errors are
retained. JSON marshal error still returns separately before Prepare. Old constructor
keeps actual native types/defaults through aliases; no constructor time sample.
Original capability/Journal/authorize/mutex/time/save-before-engine/phase/close and
not-Run-wired guard ownership remain. See [complete source chain](../architecture/offline-transit-native-binding-v1.md).

Exact native Transit engine/TLS/wire and offline intent/envelope codec sources now
have recorded L2 purposes, with no edits to native bodies/schemas. Their original
Forward budget/destination, Relay framing/fingerprint and native contracts imports
remain existing mixed/native dependencies, not accepted exceptions or new behavior.
144-146 planned/unexecuted; full Agent/Control/CLI/default/private/type/consumer/
frozen candidate/example and foundation/physical/release acceptance stay open.
No checks/tests/gofmt/generators/build/CI/experiments/Git writes/delegation occurred.

### 2cn. Agent Observation Wire And Native Host Family (Source Only)

FR-0015 runtimeobservation2 parameterizes Provider Host output and removes lower
Host JSON tags. Native platformobservation2 explicitly binds canonical observationwire1
Host DTOs without conversions/copies, and control uses that public native provider.
Four family sample/counter DTOs, preflight encoders, ACK validators and bounded body/
decimal/hex/optional/time/JSON operations move to L2 with exact old aliases. Forward
local snapshot embeds its native DTO beside private context; Probe page/owner state
stays local. UDP diagnostics delegates only the original concrete assertion/one Stats
read through nativeexecution. Original time/field/IO/close/lock/cursor/retention/budget/
worker rules remain intended. See [actual source chain](../architecture/agent-observation-wire-native-v1.md).

147-149 planned/unexecuted. Generic/type identity/direct lower serializer users must
migrate; Process versus other ACK time rules and Probe terminal offset/native sample
remain distinct. Other native format/engine/CLI/default/private/type/consumer/frozen
candidate and all foundation/example/physical/release gates remain open. No tests/
checks/gofmt/generators/build/CI/experiments/Git/delegation occurred.

### 2co. Agent Command And Native CLI (Source Only)

L3 agentcommand1 now owns original flag dependency/mode/run-lock/Runner projection
coordination. L2 agentcli1 retains original global flags and native path/proof/key/
inspection/token/enrollment/entropy/diagnostics/signal operations. Existing main
binds one native platform and public Runner constructor; old run/enrollment remain.
Native does not import command/control. No L0/L1 interface or control.Options type
identity change. Control offline plan now directly consumes public compiler/facts
instead of its old planner alias. See [actual chain](../architecture/agent-command-native-v1.md).

150-152 planned/unexecuted. Inspection retains --relay/time-proof behavior and
proof/path-first refusal, no run lock/entropy/Runner; existing native key predicate
and error masking stay unchanged. Full Control startup/client/server/ops/MySQL,
Agent engines/wire/default/type/consumer/candidate and acceptance still open.
No checks/tests/gofmt/generators/build/CI/experiments/Git writes/delegation occurred.

### 2cp. Runtime Status Raw Reads And Product Projection (Source Only)

FR-0016 adds L1 raw node/current/reported snapshot reads1. Original SELECTs move
to MySqlRuntimeStatusStore; L3 RuntimeStatusQueries owns original correlation,
freshness/readiness and serial recursive path aggregation. Native stored JSON/time/
dynamic clock is explicit. Both RuntimeController and Control detail composition
bind public owner/store/codec; old MySqlRuntimeObservations(policy) keeps own status
prototype/dynamic recursion through a precise constructor bridge. Existing status/
Host/Core/API unchanged; private ancestor/provider layout is not promised identical.
Full original mysql.ts UoW/migration read is classified native L2 without new code.
See [actual chain](../architecture/runtime-status-read-owner-v1.md).153-155 planned/
unexecuted, including malformed reported epoch using its original query shape.

### 2cq. Parallel Control CLI And Agent Native Engine Slices (Source Only)

The human explicitly reauthorized disjoint source-task agents. Control startup1
and client-command1 now own original configuration/feature/signal and all command/
key/body mapping; public native leaves own original env/file/JSON/URL/HTTPS effects.
Existing main/client bind public effects and original start/release verifier; no
lower product import/default. Shared exports and public version candidates are
integrated. See [full chain](../architecture/control-startup-client-native-v1.md).
156-157 planned/unexecuted; server composition/lifecycle and ops remain open.

Native Forward/Relay/payloadstats source has precise L2 owner/public-consumer paths.
Original multihop config conversion is one same-owner private native leaf after
old validation/fingerprint; Relay numeric policy consumes existing egress directly.
Shared Forward TCP/UDP process permits remain. Snapshot moves within the same
payloadstats package with identical public type; counter mutation/lifecycle/wire
unchanged in intent. See [actual native chain](../architecture/agent-native-engine-owner-v1.md).
158 planned/unexecuted. Native contract packages and whole source/type/default/
consumer/frozen candidate, example/foundation/physical/release gates stay open.
Source agents ran no checks/tests/format/generator/build/CI/experiments/Git writes.

### 2cr. Server Bootstrap And Precise Native Codec Sources (Source Only)

Existing server assembly now consumes public startup preflight and original raw
MySqlControlBootstrapStore queries; notification protected-path rules are public
native operations. Original policy/getter/default/refusal/query/authority and
optional store-open/partial-failure/shutdown lifetimes remain intended.159 planned/
unexecuted; see [actual chain](../architecture/control-server-bootstrap-native-v1.md).

Agent native contracts/ADP/Relay/Probe code/schema/generated declarations and
auxiliary CLI/responder now have exact manual source/public/asset/consumer purposes.
adp3 declarations alias actual adp3execution generated owner; retained contracts
Direct/stateless/time reuse does not accept live ADP2. Responder is native TLS-only;
network-fixture remains acceptance infrastructure, not physical evidence.160
planned/unexecuted; see [precise inventory](../architecture/agent-native-contracts-auxiliary-v1.md).
No schema generation, import/type/boundary/asset parity or whole-source check ran.

### 2cs. Owner-Owned Supplied-Transaction Recovery (Source Only)

FR-0017 adds observation/publication/event storage1, each with explicit supplied
Tx and primitive state/time. Original telemetry10/Station2/Notification4/Path2/
Ingress deployment2/migration2 statements belong to corresponding raw stores;
product public recovery operations own mutable Station state and Notification
post-endpoint clock. RecoveryQuarantine1 invokes original owners in order on the
same tx, shared publication time and separate final event now/JSON. No pool/new
transaction/retry/authority/ledger/history reset.161-163 planned/unexecuted; see
[observation owners](../architecture/observation-recovery-owners-v1.md) and
[complete Recovery chain](../architecture/recovery-owner-workflow-v1.md).

### 2ct. Complete Recovery Workflow And Native Effects (Source Only)

The FR-0017 amendment was recorded before native-workflow source. RecoveryWorkflow1
now owns original complete backup/restore policy; public native effects1 owns
manifest DTO/strict parser/path/fs/hash/dump/restore child/raw DB/clock/format. L2
imports no product owner; generic database/source keeps URL/Connection types native,
and exact original AuthorityRecord is only aliased, not moved or copied. Existing
script retains old public options/returns and trusted-time alias through explicit
composition, preserving lazy legacy owner constructions and one original ledger.

Original stopped/maintenance/trust/binding/time refusal, one original transaction,
capture of accounts, committed quarantine -> durable credentials -> protected
rebind, and pool/admin finally order remain source intent. No uncertain outcome
is automatically retried/rolled back/cleared.164-166 planned/unexecuted; see
[workflow](../architecture/recovery-owner-workflow-v1.md) and
[native effects](../architecture/recovery-native-effects-v1.md). Ops CLI/upgrade,
packages native format/assets, whole public/type/default/consumer/removal/frozen
candidate/example and foundation/physical/release acceptance remain open. Source
agents/root ran no checks/tests/format/generator/build/CI/experiments/Git writes.

### 2cu. Upgrade Assessment And Operator Command Owners (Source Only)

UpgradeAssessment1 now owns original plan rules, profile/Journal/schema assessment
and report decisions. Native bounded file/catalog/hash/Authority/CA/MySQL inspection
and schema/JSON/format mechanics use public L2 entrypoints; old upgrade scripts are
exact aliases through public owners. Original37 migrations/four later profile adds,
read-only transaction setup/rollback/end and runtimeReady:false remain source intent.
The relative migration asset root follows the new canonical native file. One old
test asserts the READ ONLY literal in the former script text; later authorized
acceptance must follow the canonical implementation or its behavior. No test ran.

OperatorCommand1/native effects1 separate existing argv/env/file/JSON/output from
command coordination. Old CLI binds upgrade and original Recovery compositions;
release evidence binds the same native verifier. Original required-env/argument/
CA/digest/clock-args ordering, whitelist redaction, exit and restore behavior remain
intended, unverified. No new L0/L1 change, operation, authority, retry or guarantee.
Readiness167-171 planned/unexecuted. See [upgrade chain](../architecture/upgrade-assessment-owner-native-v1.md)
and [operator chain](../architecture/operator-command-owner-native-v1.md).

### 2cv. Contracts Leaves And Current Agent Call Chains (Source Only)

The contracts package has precisely three isolated L1 leaves, policy1, execution
observation1 and execution values2. All other native source leaves/barrels are L2,
with eleven actual public package exports and exact schema/catalog assets recorded.
Broad root/shared barrels eagerly reach native Node/AJV/fs/schema implementations;
selected common type reexports do not make them L1. Four handwritten telemetry
parsers do not runtime-load their specification schemas. Source/export/schema/default
code is unchanged by this classification. Readiness172-173 planned/unexecuted; see
[exact package map](../architecture/contracts-package-native-boundaries-v1.md).

[Agent call chains](../architecture/agent-remaining-source-callchains-v1.md) replace
the older broad control/JSON/time/echo residual claims with current source facts.
Concrete remaining work: native default/fallback seam in control/platform.go,
production Probe constructor selection in probe_negotiation.go, and the native
Schedule.Now sample in probe_counters.probeCounterPointValue, including terminal
calls. Live and private compatibility clocks must not be silently substituted.
TransitController remains an offline pre-integration path. These items are listed,
not migrated or verified in this slice. Full A5/type/private/consumer/asset closure,
reviewable candidate identity, existing public example execution and foundation/
physical/release gates remain open; source agents do not open upper feature work.

### 2cw. Agent Native Binding And Counter Clock Slice (Source Only)

FR-0018 was recorded before implementation. New L2 agentplatform1 owns original
native Providers/Effects/LocalServices structs and stateless defaults; Control old
names alias them and keep public constructor signatures, nil refusal and private
partial-fixture fallbacks. Canonical named-struct package/reflection identity now
belongs to agentplatform, an explicit compatibility limit requiring acceptance.
The package imports no Control/Probe L3 producer and changes no L0/L1 interface.

Probe constructor selection uses the original public factory hierarchy in the
existing Control constructor/default seam, still after Guard and before NewGate,
counters and deferred failed-session close. Counter point policy now receives an
explicit scheduler; both production calls use a separately bound native provider,
not the Runner's injected scheduler. Old free helper/zero-value fixture fallbacks
remain. Now().UTC() still precedes terminal/availability selection; terminal EndedAt
keeps original representation. Private field binding reads no time and adds no
authority, budget or worker.174-176 planned/unexecuted; [full chain](../architecture/agent-native-default-bindings-v1.md).
This supersedes the three specific pending source bodies in2cv; complete A5/type/
public/private/default/asset/consumer/candidate/example and all later gates remain.

### 2cx. Source Roots, Protected Core And Development Tools (Source Only)

The manual [source root catalog](../architecture/foundation-source-root-catalog-v1.md)
records actual production/support/asset roots, not a frozen manifest or automated
import report. Core's complete four production files and package exports were read,
with no source/API change. Native generator/run-wrapper/fixture/tool roles are
separate from product authority and from passing evidence. Tool bodies or heads/
tails were read only; none executed. Existing boundary roots/type/JS/string lists
still require later authorized adaptation, not source-stage tool expansion.

Full-repository reading identified apps/web as shipped production, plus the
bootstrap entry, previously absent from the current declared source root records.
New source slices below address those bounded entry/model bodies. Named remaining
Web files are explicit A5 work, not a native/presentation exemption. Case177 and
complete source/private/type/asset/consumer/candidate identity remain unverified.

### 2cy. Original Control Bootstrap Command (Source Only)

ControlBootstrapCommand1/native1 now separate original argv/env/database/console
effects from migrate->original Identity.bootstrap->log->finally-close sequencing.
The existing bootstrap.ts remains the composition with top-level await/no exports,
same combined required check and database construction outside try. L3 has generic
database/effect views; L2 imports no Identity/product owner. No existing L0/L1/
Identity method set, Authority/Journal, schema or first-owner semantics change.
See [bootstrap chain](../architecture/control-bootstrap-command-native-v1.md).
178 planned/unexecuted; no operational safety/transaction equivalence proven.

### 2cz. Browser Console Model And Native Asset Chain (Source Only)

FR-0019 preceded implementation. ConsoleModel1 owns original UI helper rules with
explicit effects; BrowserNative1 owns dynamic Date.parse/Date.now and complete
URLSearchParams representation. Old model.js keeps all ten exports and binds native.
Credential getter thunk preserves parse lookup before second credential read and
Now after parse; absence/policy failures short-circuit native time. List guard
precedes native query, preserving defaults/iteration/conversions/string result.

Three fixed JS module assets are explicitly present in the native asset union and
original HTTP route owner, with the same headers/MIME/reader and no wildcard paths.
Existing app/Relay imports stay on model.js. UI DOM/requests/layout/policy remain
unchanged in this bounded move; the other named Web bodies still need appropriate
owner/native/compatibility classification.179-180 planned/unexecuted; [actual chain](../architecture/console-model-browser-native-v1.md).
This is not browser execution evidence, JS boundary acceptance or full A5 closure.

### 2da. Console Request And Native Main/Relay Composition (Source Only)

FR-0020 and its view/Relay scope amendments preceded corresponding source moves.
ConsoleRequest1 now owns original connected/version/decode/result and one pending
key Map, taking lazy original state readers plus explicit native effects. Native
fetch is returned directly; decode still precedes stale, abort and HTTP checks.
Signature/key generation remains before connected, failure retains the same key,
success deletes it, and the old reset clears at its original location. No retry,
clone/queue/scope-key/concurrency semantics are added. [Request chain](../architecture/console-request-native-v1.md).

Old app is now an exact real composition. Import-free L2 native main view owns
the unchanged ephemeral auth/page/connection/DOM body, calls the supplied product
factory at the old Map site and keeps every listener/render/reset/initial display.
Native Relay form/view factories retain original native fields/validation/preview/
CAS/deployment/cache bodies; old relay-model six exports and initRelayConsole bind
public helper callbacks at existing module/constructor entries. BrowserNative1
remains additive; no L0/L1/schema/protocol/Authority/Journal/ledger change.

Five fixed served JS assets follow real ESM imports with original headers/MIME/
reader and no wildcard. Source-only canonical/declaration/stack changes are not
private reflection guarantees. Current console-flow VM test reads old app/relay
source and lexical fields; it needs authorized canonical factory/UI-port adaptation
with original coverage retained. It was not modified/run, no result is inferred.
181-184 planned/unexecuted; [view/Relay chain](../architecture/console-browser-composition-v1.md).
Other named Web files and full type/private/default/consumer/asset/candidate and
foundation/physical/release gates remain open. No test/check/tool expansion ran.

### 2db. Existing Echo Receipt And History Completion (Source Only)

FR-0021 fixes the existing undefined browser echoReceiptView and the original
permit owner's Echo service-selection/history projections. Existing declared
challenge/proof/byte fields now pass to the same history recorder in the original
transaction; TLS summaries also retain evidence for existing v3/v4 result parsing.
The browser consumes the actual historical receipt shape, decodes existing Echo
run summaries, binds their invocation/content digests and displays actual native
protocol/byte values with unknown health and recorded-evidence limits. The existing
HTTP/owner/browser closed status lists and markup now include declared echoed.
[Source chain](../architecture/browser-echo-receipt-history-v1.md).

No L0/L1/public method/type/schema/version is changed. Migration0037 and the MySQL
history store already declare Echo status/challenge/evidence/byte representation;
their source was read only. All SQL/transaction/locks/clocks/retention/loss/history
owners remain. Declared machine APIs and public receiveResult input still cover
v1/v2/v3; native stored-result v4 parsing and corrected private capture do not
constitute a typed v4 ingestion route or live qualification/authorization. Staged
source compatibility and subsequent capability acceptance remain open.

Readiness185-188 and all preceding current-source cases remain planned/unexecuted.
At this slice188's full22-leaf map was pending; the later2dc source map and Rule
split supersede that inventory status without claiming acceptance. Console VM and
full A5 candidate/consumer/type/default/private/asset/version/example work remain.
No tests/checks/tool expansion/build/CI/experiments/Git writes/delegation ran.

### 2dc. Browser Leaf Map And Original Rule Command Owner (Source Only)

The complete original22 named Web bodies and their actual initializer/default/
return/caller/asset roles have now been manually read and mapped in
[browser-native-leaf-inventory-v1.md](../architecture/browser-native-leaf-inventory-v1.md).
Twenty-one remain explicit native view/form/response/HTTP representations at their
old paths. The original Rule leaf contained actual product command construction,
preflight/replay/tail state; FR-0022 preceded its real L3 RuleCommands1/native view
split rather than declaring that whole body L2. Old unversioned APIs are not
silently assigned BrowserNative1, and none of this is an automated boundary pass.

The new canonical owner has the original single selected Map/plan/active/stopped/
generation/opaque controller state. Native DOM/input Set, separate JSON/ordered/
clone/encoding, UUID/confirm, abort/options, error text and preflight timestamp
effects remain at the original positions. The old named initRuleConsole/defaults/
return methods bind public factories; main's lazy Profile/path callbacks stay.
Three fixed JS asset union/routes follow the graph with original reader/MIME/CSP.
[Rule source chain](../architecture/rule-command-owner-native-v1.md).

Original first-write checks, fixed CAS/key/body, unknown write replay, rejection/
abort/preflight distinction, stop/tail and finally-awaited refresh remain intended,
unverified. Current direct rule-flow import remains; console-flow private old Rule/
app/Relay source extraction needs canonical factory/UI-port adaptation later with
coverage retained. No production credential/state hooks, L0/L1/ledger/Authority/
Journal, new retry/queue or new live capability is added.

188 now has its manual source map;188-191 and all preceding acceptance remain
planned/unexecuted. Full A5 source/type/private/default/consumer/asset/version/
compatibility-removal/frozen-candidate/example and subsequent foundation/physical/
release gates remain open. No checks/tests/tool expansion/format/generator/build/
CI/experiments/Git writes/delegation ran.

### 2dd. Bounded Runtime Legacy Leaves And Public Type Sources (Source Only)

All34 modules/runtime bodies are now recorded in
[the bounded leaf map](../architecture/control-runtime-legacy-leaves-v1.md):
eight existing construction/callable bindings, one retained native ledger
interface and25 value/type forwarders. Five type-port forwarding paths now
consume the same existing owner public declarations; three Policy type imports
consume the precise lower public leaf. Value loading, constructor signatures,
default/clock/resource expressions, method bodies and version counters stay.

The map records held/per-call/module-time Transit binding differences and actual
production/Recovery/phase/fixture/test consumers without claiming a complete
cross-repository caller audit.203-205 are planned/unexecuted. No checks/tests/
formatters/generators/builds/CI/experiments/Git writes or delegation ran. Complete
application/nested owner/Agent/Web/type/private/default/consumer/fixture/asset
closure, candidate identity and all acceptance/parallel gates remain open.

### 2de. Complete A5 Source Candidate Integration (Source Only)

Application's99 original entries now have exact source/default/value/type roles;
nineteen named type-export paths and Control's Policy/Accepted sources reach the
same existing public declarations. Full Control, Agent and assets/support ledgers
join the top-level59/Runtime34 and previous Web/package/schema records. Actual
production/Recovery/phase/manual/test/private serializer and source-text consumers
are retained with explicit compatibility removal conditions, not blanket scopes.

FR-0023/0024 source-separate lower synchronization and credential representations
from original native records/providers; FR-0025 replaces two lower native signal
types with a common cancellation observer. Breaking lower serialization/type/
native-event access and the timing parse-position/cache change are recorded before
implementation under standing source authorization. Same native/protected owner
and runtime sequence preservation remains intended, not demonstrated. A separate
read-only provider/serializer/proof/credential cross-review found no specific missed
production conversion; it is not compilation, native bytes or behavior acceptance.

A5 classification and reviewable source scope are now closed by the
[integrated record](../architecture/foundation-a5-source-closure-v1.md), with no
immutable revision generated. Cases206-220 below map this integration to later
verification. No tests/checks/format/generator/build/CI/experiments/commits/pushes
ran; B and foundation/upper-module/physical/release gates remain unopened.

## 3. Concentrated Verification Plan (Not Executed)

1. Adapt the existing import/boundary rules to real paths and the declared inventory.
   Include type imports, internal subpaths, L0 infrastructure globals, L1 concrete
   providers, L3 platform branches and a failing unclassified/forbidden-import case.
2. Check public export/alias compatibility, same ControlError identity, Core/API
   shapes, closed contract families and existing tool/test callers. Add the example
   to type/contract acceptance without weakening current schema/owner assertions.
3. Cover L0 hold/reuse/deadline equivalence: exact renewal margin, queued command,
   multihop withdrawal, session change, absent previous state, credential/Relay caps,
   withdrawn empty publication and counter exhaustion at the host.
4. Exercise RuntimeHost with explicit port fakes and then real MySQL/Control/Agent:
   boot retirement/capability immutability; exact lock/transaction ordering; stale
   claims; authority recording failure; Snapshot publication/leases; report replay,
   generation/fence/phase refusal; cleanup/drain and current multihop rejection.
5. Check adapter SQL semantics/rollback/claim competition with original behavior,
   no nested transactions/pool fallback; ADP/codec refusal; Linux/Windows build and
   absent process fields; unchanged telemetry/diagnostic field scope.
6. Run the example with the supported runtime/dependencies. Check canonical host
   normalization, BOTH protocol mapping, denied actor/Scope, unknown keys/version/
   protocol, invalid intent, detached immutable results, no command/network/store
   writes, isolated logger failure and request completion/drain.
7. Re-run existing lifecycle/authorization/recovery regressions and relevant full
   Actions matrix against the final source identity. Capture commit plus dirty
   source status as needed; do not join passes from different source revisions.
8. For the resource slice, compare port-fake call traces and real MySQL behavior:
   Node initialization/epoch absence or mismatch; Direct protocol sorting and
   existing-owner refusal (including same owner); Relay resource ordering, same-
   owner re-reservation and physical TCP/UDP distinction; fence/generation limits;
   transition's initial owned-slot lock and max(revision, old generations + 1);
   post-reservation capacity failure with caller rollback; unchanged drain window;
   desired-slot owner predicates and removal order; missing/NULL lease maximum.
   Cover shared-provider server wiring and old constructor/default aliases.
9. For Relay owner commands, preserve operation-error detail, terminal success
   deadline/status predicates, claim clearing, terminal cleanup selection, and
   successful-history retention on a later non-retryable failure. Fail after the
   operation write and before deployment withdrawal to prove single-transaction
   rollback. Compare Date.now call boundaries and no added transaction/connection.
10. For the complete Ledger host/store split, compare ordered storage and provider
    traces for quarantine and duplicate retirement, empty/no-authorized assignments,
    succeeded/running/accepted filtering and revoked/recovery-invalidated intent,
    authorization changes during capacity/compilation, exact operation created_at
    monotonicity and supersession/retirement ownership, stale claim rejections,
    expiry then SKIP LOCKED claim with unchanged deadline/attempt/token behavior,
    cross-session leases and 5000ms safety boundary, generation-limited tombstone
    order, drain generation/lease rejection, absent vs zero lease values, and
    stopped/failed/ready completion's distinct claim and cleanup writes. Assert
    Node -> Operation (not Forward) locks, callback transaction identity and a
    mid-write failure rollback. Test malformed persisted bodies at the original
    lazy decode point and retain constructor/type aliases on the same source.
11. For Relay host/store/observation and native adapter separation, compare provider
    traces and real-transaction results: historical transitive Node closure and
    sorted locks; grant/facts/session/current-peer order; Profile/endpoint revision
    and compiler refusals; prefer-old-port selection and the non-reserving preview;
    exact plan-derived multihop ingress/egress/path persistence; generation limit;
    downstream-first prepare cursor and matching-phase activation; stale report,
    Snapshot generation/epoch/fence/configDigest or expired authority rejection;
    exact current pins versus retiring credential overlap; refresh then capacity
    rollback; old published errors not failing successor plans; successful-history
    retention followed by a separately failed Operation; safe withdrawal/leases/
    slot cleanup; pending query eligibility, order and limit; static quarantine.
    Check digest/compiled wire equivalence, error identity/codes, shared JSON decoder,
    public old-path aliases and refusal vectors after native compiler relocation.
    Preserve same Tx and no owner-table writes from the projection adapter.
12. For Node host/module/storage/signer/secrets separation, compare enrollment
    validation, missing/revoked/expired tokens, equal/different CSR replay, expiry
    during signing and credential-insert timing; pool-backed machine lookup and
    transaction credential bounds; Scope/grant/network/capability refusal; grant
    revision no-op/change/exhaustion and atomic access audit; policy exact fields,
    immutable command snapshot and single revision increment; visibility -> Runtime
    lock -> scoped Node FOR UPDATE order; machine/Relay rotation replay before
    superseded-source rejection, current source required for new issuance, post-sign
    credential rechecks and rollback; overlapping Relay count, currentOnly, min
    authority/overlap bounds and sha256 peer format; all-three-table revocation and
    quarantine order; pendingRevocation/absent lease fields; same security event
    codes and ordered credential/request/audit writes. Cover PKI failure and
    mid-write rollback without credential leakage, existing constructors/aliases,
    signer purpose/default, random-token/hash behavior, and the single live owner.
13. For Agent timing extraction, compare old entrypoints and pure provider traces:
    sample-before/provider/sample-after (including blocked provider), two-second
    cache and uptime rollback, 30-second freshness and 500-ppm holdover, exact
    host/platform binding, Linux/Windows suspend-aware counters and unsupported OS
    errors, Windows parser refusal, forged/missing/stale proof, clock rollback/jump/
    read failure latch, credential cutoff, old ticket not inheriting renewal, expired
    session refusing renewal, server skew and drain earliest deadline. Cover legacy
    clock-field changes, nil Ticket, pure nil-provider refusal and old type/API names.
14. For Runtime Journal acceptance, compare lock/reload/encode/history/save/unlock
    traces and original persisted bytes. Cover stale caller, MAC/identity mismatch,
    unchanged generation/digest, generation or session rollback, explicit extension
    migration gate/import digest retention, physical Fence/retired cutoff, immutable
    owner/config/resource/protocol identity and phase regression, withdrawal and
    tombstone retirement, prior-body lazy decode refusal, save failure and unknown
    persistence outcome returning no new authority. Assert the native history view
    includes every compared field and raw bytes are not reconstructed from it.
    Confirm Runner changes no socket before save, never executes cached authority,
    and keeps the original one Journal/key/owner through wrappers and type aliases.
15. Compare original platform lock and atomic-write effects/faults on Linux/Windows:
    same lock path/exclusivity/release, unsupported platform refusal, temp/chmod/write/
    file-sync/close/rename/cleanup order, POSIX directory-sync errors and Windows
    exception. Exercise authenticated Journal/proof and inspect/migration callers
    without deleting protected history or weakening existing restore/high-water
    refusal. All native/file/functional execution belongs to later-authorized Actions.
16. For Runner identity/main-channel providers, compare default and explicit provider
    wiring, legacy helpers/type aliases, nil-provider refusal and ordered traces:
    machine bundle fallback only on missing bundle, CSR/key/request replay versus
    malformed/non-missing failure, Node/chain/fingerprint/exact expiry/overlap
    checks and configured (not returned) CA trust; atomic machine save -> reload/
    Probe invalidation -> Guard update -> idle close -> request cleanup, including
    every intermediate failure. Cover Relay initial-missing versus second-read/MAC
    failure, strict envelope/JSON bounds, effective expiry and renewal schedule,
    expired protected history verification without execution, exact pending RequestID
    cleanup, one authenticated expired-committed-replay renewal, overlap and MAC
    persistence, and save/cleanup/install failure order. Preserve machine/Relay JSON
    grammars, file names/modes and original raw/MAC representation. Compare TLS
    callback rotation, timeout/redirect refusal, method/URL/headers/epoch, response
    limit and body close, non-200/error-code mapping, context cancellation, idle close
    and no added retries. Re-run unchanged Probe/telemetry client users on the same
    source to confirm the retained native-client contract.
17. For bootstrap/scheduling, compare ordered default/injected traces: flags/URL
    before effects, proof path check, trusted CA, exact 32-byte key, authenticated
    load, extension refusal, credential reload before explicit import/migration,
    then client creation. Confirm no initialize/reset fallback or new instance lock.
    Cover missing/corrupt state and each failure leaving original history intact.
    Compare After/timer/ticker and context cancellation/deadline/AfterFunc behavior,
    all existing intervals/backoff caps, report/credential retry paths, guard/Probe
    drain/stop joins, host-worker timeout/no overlap/late-result drop, freshness
    helper clocks and old constructor/default compatibility. Guard proof/time
    authorization must remain independent of injected operational scheduling.
18. For auxiliary channels/host observation, preserve differing instance/claim/
    delivery URL gates, no redirects, exact epoch/content-type/method/path, claim
    burn-before-I/O and delivery budgets, caller-owned bounded body read/deferred
    close, status/context/ACK order, sentinel identity and cancellation. Assert all
    four isolated telemetry pools/limits/redirect text, sender helper compatibility,
    no retry/catch-up/queue and unchanged identity/provenance ACK checks. Compare
    original host JSON values/order/absent fields, Linux source bounds/overflow/
    parsing/truncation, non-Linux unsupported values and adapter aliases. Include
    retained private callers and exact current-source compile/import acceptance.

19. For observation/local providers, compare default and explicit traces for the
    original individual memory/process/time/PID/platform/goroutine read order and
    Runner lock scope. Preserve process/host JSON field types, units, absent versus
    zero counters, native runtime values, unsupported platforms and old aliases.
    Confirm the host worker has no authority references, stays non-overlapping
    during a blocked provider, retains 500ms/late-result drop and drains as before.
    Cover diagnostics disabled, exact configured/sibling paths, 0700 parent/0600
    atomic file behavior, mkdir/write/sync/rename failures and final writes after
    execution shutdown. Compare identical warning arguments and original stderr
    placement; warnings must not become another authority or retry decision.
    Cover four independent 16-byte telemetry epochs, each 32-byte Probe request ID,
    lowercase hex, random failure before any HTTP at the original point, including
    result projection, and no entropy reuse/fallback or extra reads. Exercise old
    helpers/constructors and explicit nil-provider rejection without bootstrap I/O.
    Recheck Probe result deadline reads, uncertainty deduction, guard/server-time
    checks, TLS trust expiry and one-use reporting with injected scheduling and
    entropy. No new staged echo behavior is accepted by these mechanical changes.

20. For Identity, compare legacy-constructor/default providers and explicit
    IdentityService/IdentityAccessHost traces. Preserve exact Bearer/header/token
    grammars, ID/counter limits, token hashes, pool versus transaction lookup, absent
    account 401, missing membership 404 and management/owner 403 behavior. Assert
    active membership FOR SHARE -> owner FOR SHARE -> scope FOR UPDATE -> member
    FOR UPDATE -> account FOR SHARE and the original argument order/transaction.
    Cover protected owner, stale/zero revisions, role/token validation, new account
    creation, existing credential mismatch, duplicate account/token mapping only
    on membership creation, and raw bootstrap errors. No-op members retain revision
    and emit no member/audit writes; max revision and mid-write failures roll back
    account/member/audit/Runtime changes together through the original caller.
    Check UUID -> clock -> audit JSON encoding order, query failure propagation,
    list ordering/role/active projection and mutable legacy response compatibility.
    Recovery must lock accounts in ID order, rotate every token before non-owner
    deactivation, retain owner status and leave protected Runtime/Agent history
    intact. Do not invoke recovery merely to verify the source split. Confirm old
    Identity/helper/type imports and independent HTTP/Node/Transport/endpoint ports
    on the same frozen revision; no historical green proves this extraction.

21. For Transport/endpoint owners, compare old constructor/default native providers
    and explicit services on the same source. Preserve exact public types/response
    shapes, Profile/endpoint normalization and malformed/unknown refusal, stored
    JSON lazy decode/digest points, ASCII key/ID/counter limits, request digests and
    clock/ID/encoding evaluation order. Test Profile owner/idempotency before
    insert/current FOR UPDATE, scope/revision conflict, missing/corrupt old revision,
    no-op/max revision, initial owner grant, pointer/response failures and rollback.
    Locked resolve must retain Scope management, profile grant FOR SHARE and the
    requested immutable revision; get/list/grants retain original permission and
    ordering. Grant commands retain Profile update lock, subject management check,
    exact-one previous grant, Forward reference locks before authority mutation,
    event ordering and same-transaction Runtime reconciliation, including no-op
    behavior and recovery-invalidated idempotency. Static recovery must not touch
    other tables/history; do not execute recovery as an ad-hoc local experiment.
    For endpoints assert owner/idempotency -> Node management/revocation -> endpoint
    FOR UPDATE -> revision/digest -> Forward references -> write -> Node audit ->
    response; include no-op with live references, changed-active refusal, exhausted
    revision, corrupt stored JSON, and failure after either write rolling back the
    shared transaction. get retains Scope/Node cleanup/shared read and false
    execution support. Confirm old parser/type/constructor imports and independent
    HTTP/Node/Forward contracts without creating a second authority or transaction.

22. For Forward/idempotency owners, compare old default constructors and explicit
    stores/values on one frozen source. Preserve every public alias and mutable
    response shape, lazy stored-value decode, JSON re-encoding and upstream parser
    boundary. Assert Forward reference filters and lock/read behavior: profile/node
    live Relay `FOR SHARE`, node ingress/path predicates, recovery/deleting filters,
    actor/profile ordering, actor `forActor` inclusion, `record` flags, missing
    `notFound`, current `FOR UPDATE`, revisions newest-first limit 25 and raw spec.
    Cover insert current then revision, replace affected-row conflict then revision
    write, markDeleting current/revision body, authorizer/setAuthorizer and
    quarantine-only flag mutation; mid-write failures roll back the caller's whole
    transaction. Keep separate encodes around each awaited write, including object
    mutation between writes, not a cached encoding or extra validation. Confirm no
    clock/ID/authority reads in lower services.
    For idempotency assert ensure-before-lock, exact scope/actor/key argument order,
    stable original key snapshot across awaits but current digest comparison,
    recovery-invalidated replay refusal, locked completed response decode/status,
    pending undefined, status/body encoding before request key reads on respond,
    and failure rollback. Exercise the same transaction with ForwardCommands,
    Runtime ledger, Relay, Transit, path/publication consumers and application
    reconciliation. Confirm no second ledger, event queue, retry, nested transaction
    or protected-history reset; old module imports/constructors/default response
    generic remain usable. Historical passes do not validate this extraction.

23. For explicit management HTTP contracts, confirm NodeApi inherited/current
    user/machine methods and implementation-independent Forward/access/Node/
    Profile-grant/detail API substitutability without constructor/private-field or
    Tx dependencies. Preserve old response/type imports and exact defaults through
    aliases, including ForwardAccepted for the legacy idempotency default. Keep
    optional sourceOperationId/path/path-group receipts, readonly member fields,
    mutable concrete returns, status 200|202 and Node change literal 202, nullable
    credentials/cutoffs/operations/deployments, policy/lastError unknown and raw
    revision spec values. Include Node CSR/rotation/Relay/machine errors and old
    scoped read flags; a declaration must not falsely imply stricter validation.
    Exercise existing HTTP routes with structural contract fakes and the same
    source's real composition. Assert unchanged arguments, parsing/authentication/
    authorization, idempotent replay, same-transaction owner/Runtime/audit ordering,
    error/status/body mapping and lifecycle behavior. Cover create/update/delete/
    retry, path/group binding, membership/grants, policy/revocation and scoped
    capability/forward/operation/revision/deployment reads. Later import/boundary
    acceptance must distinguish exact legacy type reexports from whole-file
    exemptions and still report all remaining class views; no broad HTTP closure
    claim is supported by only these cases.

24. For Console/catalog/Profile-reference/Tunnel APIs, compare old method and alias
    signatures with independent contracts on the frozen source. Include optional
    undefined/default paging/filter queries, readonly filters/protocol/declaration
    values, mutable descriptor/proposed-spec spreads, raw unknown fields/nulls,
    explicit Console literal flags and old broader inferred string/boolean/number
    fields. Do not silently invent deep-readonly types or a stronger evidence claim.
    Exercise each HTTP route with structural fakes and real composition, comparing
    arguments, pagination/filter refusal, same-transaction Scope authorization,
    candidate management versus read access, and persisted provenance/health flags.
    Catalog gates must not become Node evidence or authorization. Profile target
    resolution keeps management authorization, exact immutable revision identity,
    bounds/dedup/digest/spec checks and proposed-only semantics; metadata clocks,
    observedAt and freeze ordering stay unchanged. Tunnel checks retain Node/endpoint/
    peer parsing, bounded windows and truncation, effective cutoffs, role/path/protocol
    projection, missing/corrupt errors and false execution/deletion-safety claims.
    Confirm no new network, write, grant, reservation or command side effect, and old
    constructor/type/helper compatibility. Later boundary acceptance must continue
    distinguishing new raw-store/projection separation and precise legacy bindings
    from remaining mixed MySQL application dependencies rather than allowing
    whole-file exceptions or inferring full HTTP/L2 closure from interface extraction.

25. Substitute structural RelayPlanApi, TransitNegotiationApi, TransitDeliveryApi
    and NodeObservationApi providers through the actual HTTP composition on the
    frozen source. Compare Relay single/multihop union, absent keys, readonly
    resource array/mutable members, broader flags and readonly planRelay property;
    retain parse/Scope authorization/resource calculation/return ordering and
    confirm preview performs no reservation/publication. Transit keeps exact wire
    identity, nullable poll, fingerprint/epoch/boot binding, capability and protected
    generation refusal, original credential/current-session locks, expiration,
    sequence/digest replay and received-only ACK effects. Confirm no public enqueue,
    executor or coordinator advancement and no accidental execution claim. For
    Node observation preserve undefined/explicit signal behavior, source/version
    and input refusal, authorization, max active/actor/Node/cooldown budgets, timeout/
    cancellation races, late-reader slot retention, result bounds and error mapping.
    DTO remains persisted evidence with independentProbe false and health unknown.
    Compare old constructors, method signatures, route/auth/error/body order; later
    boundary enforcement must continue reporting mixed Transit implementation debt.

26. Substitute all five path/ingress HTTP APIs and IngressGroupResolver through
    the same frozen source's routes/composition. Compare paging/default/explicit
    undefined inputs, status unions/changed literals, nullable/undefined bindings,
    ISO timestamp and attempt unions, nested mutable/readonly fields, const flags
    versus broad topology/state/impact types, and old constructor/type exports.
    Check one declaration per moved config and shared old/new limit object identity,
    values, const shapes, migration runtime freeze/broad numeric type, import
    initialization and no new side effects. Preserve read versus manage authorization,
    same-transaction Scope/group/template/current-Forward ordering, exact immutable
    revision/digest/selection/CAS, current and historical provenance, bounded queries
    and corruption refusals. Resolve only explicit members in requested order with
    no transaction nesting, implicit latest revision or cross-owner table write.
    Batch cases include preview digest mismatch, stale source and origin binding,
    original creator/current-manager checks, request-key/digest replay, durable
    accepted/rejected item receipts, savepoint rollback, one decision per action,
    partial acceptance (not atomic across Forwards), explicit cancellation and
    conditional compensation with the original execution owner. Ingress remove
    remains uncompensatable; restored batches remain suspended before replay and
    cannot resume or compensate. Distinguish create versus apply and selected-origin
    lineage from global membership, independent listeners from physical sharing,
    preview/persisted evidence from execution/health. Confirm no auto-selection,
    worker/retry, second ledger/Journal/authority, history reset or new capability.
    Boundary acceptance must still report mixed native-format/application owners
    and remaining adapters rather than whitelist those files wholesale.

27. Substitute all eleven Probe HTTP APIs and both instance/permit owner ports on
    the exact frozen source. Compare old exports and constructor/generic arity,
    requests/response DTOs, default/undefined measurement and typed arguments,
    optional service/measurement/withdrawal fields, readonly nesting/shallow spreads,
    numeric versus ISO timestamps, nullable offers/results, result union correlation
    and original dispatch/execution/health flags. Preserve shared measurement-array
    identities/order/constants and helper branches through old/new public entries;
    no staged type/metadata relocation may enable a route, measurement or protocol.
    Confirm one-use instance generation/replay/expiry/capability/credential binding,
    qualification same-slot/no-renewal/tombstones, current mTLS fingerprint/Node/
    boot/session/Gate/binding checks, same-transaction authorization and budget/lock
    order, 256 retained/4-live/actor/Node/cooldown rules and no issuance refund after
    consume/revoke/restart. Issuance deadlines never widen; manager replay never
    mints or extends another permit. Offer remains non-executable, claim commits
    before ACK and lost/late replies stay spent. Status is a short current observation,
    not a cached lease; retain withdrawal, freshness/time resampling and bounded
    ACK refusal after owner commit. Result cases include exact binding/times/version/
    service/pin/digest, first ingest, same-result replay, conflict/corruption, withdrawn/
    expired rejection and original history capture/rollback. Manager inspection
    remains historical and manager revocation remains available after original
    grant loss. Keep original v1/v2/v3 selectors/checks and incomplete staged echo
    compatibility gaps explicit; do not silently add v4 or upgrade a preflight to
    authorization. Compare route/status/error/body/owner ordering with structural
    fakes and actual composition. No extra transaction, owner, network, retry,
    executor, history reset or authority is permitted. Boundary acceptance must
    report remaining mixed application/native/storage dependencies rather than
    certifying all Probe implementations from the declarations alone.

28. Exercise the three raw stores, native values, L3 projections and existing query
    applications on the same frozen source, with structural providers and actual
    MySQL in Actions. Compare ordered SQL/text/predicates/args, count then page,
    stable sorting, binary/JSON/exact revision reference filters, count/page argument
    choice, no extra statement/connection/transaction/lock/write/retry and original
    caller authorization. Preserve validated LIMIT/OFFSET integer bounds plus all
    bound user values and the old/new helper function identity; seven migrated
    consumers' query behavior must be unchanged. Verify one synchronous callback
    after the final read, not retained/awaited/retried, and propagation of callback/
    JSON/date/driver failures before caller transaction completion. Include live
    page/filter references, validation counts/order, original separate Forward clock
    reads, single Node/candidate clock, capability computation before SQL, missing
    diagnostics before time, overview zero-argument Date and native iso(undefined)
    refusal rather than a current-time fallback. Preserve raw null/unknown/malformed
    values, Number/Boolean/defaults, JSON identity/non-string pass-through, ISO calls
    and conversion order, diagnostics error cap/age-only facts and original note.
    Check peer counts/open-window-first/recent/four-row selection, reference spec/
    config extraction and original higher-layer validation/no authority/health or
    deletion-safety claims. Old classes retain zero-argument/prototype method/public
    structural substitutability, old helper exports, module initialization without
    new I/O or time sampling and no mutable per-read state/cache retained between
    calls. Production
    uses explicit providers, not old bindings as service locators. Boundary coverage
    must prove actual L2 stores consume only lower contracts and SQL helpers, product
    DTO/projection stays L3 and outward callbacks have no reverse source imports;
    classify legacy bindings at the exact entry, not as new exempt composition roots.
    Remaining adapters/whole-repo type imports still need their own coverage.

29. On the frozen source, compare old executiondriver public aliases/fields/method
    sets, typed/generic function binding, HostVersion 1, descriptor serialization,
    old private helpers and zero/nil Registry behavior. Cover bounded driver/list
    declarations, duplicates, required hooks, host/schema/role/phase/protocol/feature/
    platform refusal, clone input/result/Descriptors independence and ordering.
    Lower source must have no native protocol/Relay/runtime/OS/clock/I/O imports;
    actual platform comes from the typed native binding, never telemetry or remote
    declarations. Use Linux/Windows native Actions when authorized, keeping physical
    acceptance separate. Compare unchanged native descriptors, capability/Probe
    feature gates/order, identity callback availability/order and missing-identity
    errors, Direct config/policy conversion and TCP/UDP start/replacement refusal,
    native ingress observations on the same live instance, Relay/multihop parsing/
    prepared/activate/drain, 4096 clamp and exact retry/error mapping. Preserve partial
    start close and repeatable Close/Drain, authorization checks for the entire I/O
    lifetime, no resource leaks, same pointer/check bindings and no duplicate engine
    implementation. Runner must still persist before sockets and retain original
    Guard/Ticket/fence/session/generation/deadline/retirement/cleanup/recovery order.
    Wrong/stale/current-instance Probe binding must still refuse through the original
    Gate/watch; no observation or metadata becomes a permit or health. Confirm no
    role/phase/protocol/version/capability/default extension, echo composition, state/
    MAC/high-water reset, second authority/Journal/Runtime or fallback. Boundary
    acceptance must classify precise private native helper bindings and remaining
    mixed Control/precheck/Probe/CLI/engine sources instead of exempting the package.

30. Substitute all five optional telemetry APIs through real HTTP composition on
    the frozen source. Cover absent/undefined adapters versus installed-but-disabled
    collection, admission before parsing/authentication, generic callback results/
    failure/finally release, separate family four-request/two-active/key/cooldown
    budgets and observation-pool busy/timeout without Runtime-pool fallback. Compare
    old query/default/undefined/ACK signatures and delta/point/history/capacity DTOs,
    readonly nesting/mutable outer values, broad versus literal fields, null latest/
    session/cursors and precise string counters beyond safe integer range. Preserve
    one policy object per family, old/new export identity, distinct equal-valued
    families, runtime freezing/broad numeric types and initialization without I/O.
    Retain current machine credential/Node/boot/session/sample epoch/sequence/digest/
    clock/rate checks, replay/conflict, same supplied transaction and original mapping/
    rollup append/rollback ordering. Raw history keeps retention/order/duplicate and
    corruption refusal, delta baseline/gap/reset/unavailable/overflow/terminal cases,
    disabled/revoked/recovery historical status and age-only evidence. Aggregates
    retain family/target/window/resolution/cursor bounds, loss/coverage attribution,
    typed bucket quality and logical budget strings, not physical capacity, health
    or execution permission. No new telemetry measurement, Probe kind, worker,
    schema, query, authority or retry is enabled. Later boundary coverage must still
    report mixed telemetry native/format/storage dependencies and remaining optional
    class views, not certify whole owners from declarations alone.

31. Substitute all eight remaining optional observability APIs through the real
    named and positional HTTP composition on the exact frozen source. Compare
    generic admission result/failure/finally behavior, missing/undefined adapters
    versus disabled workers, owner-specific budgets/cooldown, auth-before-read/
    command and request-admission-before-parse/auth order, observation-pool refusal
    without Runtime fallback, old export/object identity and ProbePlanReceipt type
    aliases. Verify query default/undefined behavior, ISO versus numeric times,
    optional/null/readonly/literal/broad DTO fields, bounded arrays, union results
    and no hidden store/tick/close/send/recorder methods exposed through HTTP.
    Diagnostics must preserve bounded original evidence, support aliases/exclusions,
    same-read provenance, malformed/stale/session/config/plan refusal, no dialing
    or permit issuance and no independent health/cleanup/snapshot-digest claim.
    Audit retains all original source/order/keyset/cursor/filter/actor-attribution/
    coverage/response-size semantics and no new event store. Station policy CAS,
    silence/replay/acknowledgement, member event access versus manager policy access,
    same-Tx handoff and derived-state semantics remain with their original owners.
    Notification reads must never read/test credentials or dispatch; output excludes
    destinations/keys/authority/opaque references, and commands retain vault staging/
    SQL/replay order. Original enqueue/claim/fence/preflight/current authorization/
    rate/attempt/expiry/uncertainty/sender semantics and bounded loss/history/cursors
    remain unchanged. Probe history keeps original transaction capture, retention/
    eviction/corruption/refusal and result provenance, without minting permits or
    reevaluating current authorization. Finite plans retain creator delegation,
    current preview/CAS, original-issuer issuance, decisions/recovery/cancellation/
    clock/max-run and default-off worker gates; no staged echo is newly composed.
    Service declarations retain manager scope, immutable config and separate
    metadata CAS, archive/recovery/audit/trust projection and configuration-only
    availability, never ownership/liveness/health. Check each old/new limit object,
    runtime freeze, broad versus readonly literal types and initialization without
    I/O; do not merge admission state. Later boundary acceptance must classify the
    remaining private HTTP helper/native effects, mixed owners/values and MySQL
    product-contract/parser dependencies, not certify them from API declarations.

32. On the exact frozen source, compare the old CLI enrollment function and native
    providers, exported generic method sets and typed binding. Fake ports must
    establish all operation/argument/error/cleanup order and no effects on missing
    token, existing protected state or an earlier failure. Preserve existing CLI
    flag combinations, proof/key/path checks before enrollment, inspection and
    instance-lock/signal paths. Compare Stat/read-error branches, directory modes,
    private PEM/PKCS8/ECDSA checks and generation, CSR reuse/missing/other-read-error
    behavior, CSR CN and original file paths; do not claim changed hardening.
    Real native file/PKI/HTTPS cases run only in authorized Actions. Cover configured
    CA failure before HTTP, unchanged JSON body/URL/content type, TLS 1.3, ten-second
    timeout/no redirect/no retry, 32769-byte read versus 32768-byte parse, read/status/
    strict-JSON/Unmarshal ordering, malformed/oversized/duplicate replies, missing/
    wrong-Node/untrusted/expired certificates, client-auth/key-pair checks and the
    ignored response CA. Preserve native clock/entropy points and generated key
    lengths. Exercise each final write failure and resulting partial-state refusal:
    MAC key -> same original Journal initialization -> certificate -> one success
    message -> response close -> idle close. No success callback on errors, no
    early body close, cleanup-error replacement of the original outcome, rollback,
    protected-history reset or silent repair. Compare pending key/CSR retry before
    publication and refusal after protected publication; no second Journal/authority,
    alternate trust root, Runner execution or new feature/capability should appear.
    Linux/Windows behavior, native port boundaries and lower source imports need
    matching-source acceptance; compiled providers are not a plugin sandbox.

33. On the frozen source, compare native Direct Probe header/digest/config/policy/
    target validation and original denial identity/order. Confirm Runner still
    rejects wrong protocol/Node/boot/session/Journal generation/Guard/Ticket,
    duplicate/missing assignments, nil stream/tickets and stale tuple before
    native projection, with original deadline/CIDR copy and callback lock/current
    pointer semantics. Native helpers must never authorize or dial. Compare exact
    configured/observed endpoints, port bounds, IPv4-mapped/zone/unspecified/
    multicast/link-local/metadata/policy rules, service/business endpoint equality,
    trust time and original no-fallback behavior; reject different current instances.
    Public trust data/Current/New/VerifyConnection and added handshake must preserve
    strict digests/config/DER/leaf/SAN/EKU/key/purpose/time/pin/no-resumption rules.
    Real native PKI/network cases belong in authorized Linux/Windows Actions. Cover
    missing context deadline, raw SetDeadline failure, callback revoke before and
    after handshake, cancellation-driven close, RX/TX exact caps/partial I/O/budget
    error, TLS 1.3-only/SNI/ALPN, native clock boundaries, timeout/unknown/unverified
    versus denial and missing verification. No dial/application I/O/retry/CA fallback
    is added; raw connection deferred close and cancellation stop stay at their old
    points, including failed handshakes. Old handshake wrapper and budget alias
    must remain compatible. Original Gate 256-ID burn, global admission, monitoring,
    one-use/current watch/report/result/counter/freshness and absence of new staged
    echo composition/state reset/authority/feature meanings need regression evidence.
    Boundary acceptance must still report remaining mixed Probe/Control/wire/engine
    dependencies, rather than certifying them from native helper declarations.

34. On the exact frozen source, compare all four old native constructors and four
    additive explicit Effects variants, resolver prerequisite/error order, missing
    providers, no explicit fallback and unchanged old Runner provider scope. Native
    defaults must still create one zero-configured dialer at the old constructor
    point with unchanged network/address/context/errors and no socket policy or
    retry; compare legacy private dial mutation and default/zero-value fixture
    helpers. Trace original Now/deadline/ticker/random calls and their argument,
    failure, lock and defer ordering, all two-second/100ms/25ms bounds and context
    cancellation/watch drain. Gate random failures retain denial, 32-byte instance
    identity and single 256-ID non-evicting burn before work; failed/cancelled/busy
    work must not release replay IDs or create another authority. All Executors,
    old and explicit, still share one four-active/128-key process map with original
    one-second release cooldown and no queue or per-provider reset. Clock-domain
    preconditions must be documented and tested without adding a production reset
    API. Counter epoch remains 16 bytes, read before Gate eligibility lock even on
    repeated/closed enable; failure marks unavailable only. Compare original entry/
    call/attempt/unknown/inFlight/saturation, Seal/Close races, once-only finish/
    leave, delayed final UTC end time, nil/zero readers and detached snapshots.
    Native trust/handshake and unchanged staged echo retain their independent
    native time/effects and no new enablement. Preserve socket close/outcome/error/
    result/report/Guard/Journal semantics and all existing capability/default gates.
    Functional/native/dial/network/Linux/Windows acceptance is Actions-only when
    authorized. Lower generic port imports, precise native default bridges and
    remaining Probe net/address/wire/echo/type debt need boundary evidence, not a
    claim that the whole product package became a pure L1 framework.

35. On the frozen source, compare old product endpoint/outbox/attempt/header/query/
    loss interfaces with parameterized bases and specialized ports: method sets,
    type references, optional/null/literal/readonly/mutable fields, caller Tx,
    callbacks and no upper enums/payload schema/rules in L1. Substitute both real
    root-wired stores and old zero-argument prototype wrappers, including public
    count/get overrides at original put positions and stateless initialization.
    The two family bindings must not initialize the other family's parser graph;
    they must retain original function/error behavior, no I/O/retention/retry and
    synchronous decode timing before the same next SQL/return. Compare all SQL,
    args, field/JSON/immutable order, integer/boolean/size/scope/corruption failures,
    locks and transactional rollback under original real MySQL cases in authorized
    Actions. Endpoint quota 16 and audit tail/loss 128, outbox duplicate consistency,
    terminal-only seven-day pruning/1024-row eviction/full rejection and bounded
    loss increments must stay exact. Cover 256-attempt eviction, missing/evicted
    finish history without recreation, 16-endpoint rate rows, maximum counters,
    immutable fields, revision+1/CAS failures, claim headers/deferral, FOR SHARE/
    FOR UPDATE, history bounds/filters/cursors/order and malformed stored values.
    Original sender/vault/credential pin, event handoff, claim/fence/preflight/
    current authorization/uncertainty/rate/attempt/recovery/silence/replay paths need
    regression evidence; no new outbox, authority, transaction, table write, secret
    exposure, feature or worker is introduced. Boundary coverage must prove new
    L2 stores import only public lower contracts/Core/SQL helpers and execute outer
    callbacks without reverse source/type dependencies. Keep precise legacy
    wrappers separate from remaining mixed L3 values/native/vault/sender and other
    owner SQL debt; do not certify the whole notification feature from this split.

36. On the frozen source, compare all historical run/permit/result/query/loss and
    plan config/head/decision/failure/header/query/store types with their generic
    bases and product specializations: method sets, optional/missing/null/literal/
    readonly fields, native TLS/echo arguments and no upper vocabulary/imports in
    L1. Substitute new root-wired stores and old zero-argument prototypes/static
    recovery aliases; preserve run get overrides for insert/put and plan lockScope/
    put/get overrides for create/put/append. Verify family-isolated parser binding
    initialization, original synchronous parse/immutable/error timing before the
    same SQL/return, no async value phase/retention/retry/new connection, same Tx
    recorder capture and original history-only/no-permit-write ownership.
    Compare every SQL/argument/field/projection/size/numeric/boolean/presence/JSON/
    binary-filter/order/lock/corruption case using authorized real MySQL Actions.
    History must retain seven-day/1024-row/16-prune eviction, missing-head losses,
    immutable duplicate consistency, revision+1/CAS and unchanged 31-column/native
    optional staged fields. Plans retain 32-head/16-decision bounds, scope locks,
    locked active-expiry conversion/put order, terminal-only deletion/eviction,
    losses, original immutable/time/CAS checks, decision append/config validation,
    due/header deferral, share/update locks and bounded keyset history. Exercise
    savepoint success, every allowed/refused code/status/retryability combination,
    original retryable quota exception, exact rethrow identity for unclassified
    failures, callback errors, rollback-to/release failures and original action/
    issuer atomicity; no swallowed errors or new retry. Sticky recovery updates/
    revision increments and static aliases/ops composition must not reset states
    or grant authority. Source unchanged finite-plan worker/creator/replay/claim/
    once/ACK/Agent/default gates and unfinished echo scope need regression evidence.
    Boundary acceptance must prove lower stores import no L3 parser/type/class,
    product expiry/refusal rules stay L3, original synchronous callbacks add no
    reverse imports, and precise old wrappers do not exempt other mixed values/
    wire/native/owner adapters. No broad Probe acceptance follows from declarations.

37. Compare exact frozen-source metadata types/ports, raw audit rows and original
    public business queries/DTOs, constructors/prototypes/overrides/static recovery
    and root/ops wiring. No upper config/wire/enum/parser enters L1/L2 sources;
    callbacks must be synchronous, unretained, no-I/O/no-retry at original native
    parse/projection points. Preserve metadata object/16KiB/digest/ID/time/revision
    checks without earlier business validation, FOR SHARE/UPDATE, 32 identities,
    64 revisions, archive monotonicity, CAS, 256 audit eviction/loss and sticky
    recovery revision behavior, including public head/count overrides. Audit must
    retain every fifteen-family SQL/args/join/column/node association/actor
    attribution/key/order/filter/cursor/nullable numeric/flag/corruption rule,
    unsupported source refusal, original arrays/initialization and per-query
    error-code interpretation. The old business type assertion is not proof of
    valid data: actual closed row validation/error order remains in AuditEvents.
    No raw JSON, write/event store/current-route reverse join, authority, feature,
    health/ownership or Probe/echo enablement may appear. Preserve authorization,
    budgets/pool refusal and original service/Probe pin/current-head rules. Real
    SQL/rollback/recovery/functional evidence belongs in authorized Actions;
    remaining mixed diagnostic/station/native/value dependencies still require
    their own boundary and behavior evidence, not blanket legacy exemptions.

38. Compare exact frozen-source diagnostic/station public records, Core readonly
    endpoints, generic specializations and optional/null/mutable field behavior,
    old zero-argument constructors, public prototype methods, wrapper return/
    rejection/async/initialization timing, station policyCount overrides and
    existing server/notification shared-store wiring. Confirm lower imports and
    type references contain no L3 classes/parsers/config/rule/evaluation; original
    assertion callbacks stay synchronous after native mapping and full validators
    remain at their old application points. Trace diagnostic scope/ID checks,
    eight unique Nodes, all SQL/args/binary joins/JSON and byte bounds, each ordered
    cap-plus-one page, assignment identity duplicate refusal, native relay/hop
    target/digest mapping, observations/drains joins and invalid snapshot/report
    behavior, nullable/malformed values and internal-only Probe trust context.
    Trace station scope locks, 64 policies, 256 audit eviction/loss, 1024 events,
    thirty-day retention with sixteen-row pruning, bounded loss overflow refusal,
    deferral predicates, event config rule/target consistency, mutable-column
    precedence and acknowledgement CAS/exhaustion. Preserve Forward/Operation/
    Node/report/snapshot fact projections, latest-operation selection, native
    timestamps and exact report identity/epoch/sequence/generation/credential
    checks, partial malformed report markers and original non-Forward target
    branch. Error-code Set initialization, null/OTHER_ERROR fallback and callback
    order must match the original. Confirm transaction rollback, authorization,
    notification atomic handoff/routing, silence/recovery state and no extra
    connection, raw payload, owner write, Runtime method, threshold policy, health
    assertion or execution/echo enablement. Real SQL/functional evidence belongs
    in authorized Actions. Precise old bridges do not exempt remaining mixed
    telemetry/application/value/native/HTTP/Agent or unclassified source.

39. Compare exact frozen-source raw/mapped/rollup record fields, specialized wire/
    identity types, readonly arrays, nullable values and old public names/classes/
    zero-argument constructors/prototypes/async/initialization/error behavior.
    Lower contracts must import no wire or L3 types; native raw/mapping adapters
    must consume lower ports, with original method bodies/SQL/decoders preserved.
    Trace two-slot nonqueued observation pool admission, active release on every
    failure, transport destruction, 1500ms deadline, both guard points, session/
    isolation/begin/rollback/commit/release/close ordering and existing error mapping.
    Cover four raw head locks, byte/uint64/native JSON/flag/counter/date checks,
    sequence/drop/checkpoint behavior, twenty-four-hour retention and 256-row
    pruning, Node/Host 8640-point limits, Forward/Probe 4096-point/32-item limits,
    overflow eviction and accepted/rejected totals, scoped history cap-plus-one
    and same-identity/counter-epoch latest selection. Preserve Forward current/
    retired Snapshot/lease/ingress/relay/hop/config/scope provenance and Probe
    two-generation Snapshot/direct-TCP/binding/fingerprint/registered-instance
    checks, duplicate/null/malformed cases and original publication expiry meaning.
    Rollup callbacks must retain original parser/fold/limits identities, argument/
    failure timing, corruption wrapping and repeated validation, with no I/O,
    new async phase, retained Tx or changed receipt policy. Trace original scope
    serialization, all Scope/Node-family quotas, active-bucket exclusion, exact
    eviction selection/delete counts, cursor expiry, saturating uint64 markers,
    128-bit summed losses, minute/hour folding/digest/byte limits, monotone recovery
    suspension, keyset windows, over-budget capacity inspection and 128-cursor/
    256-total pruning. Prove original atomic rollback of raw points, heads,
    cursors/buckets and losses under parse/fold/quota/SQL failure. Existing server
    shares one rollup store and the original enabled-only recorder across all
    four families. Preserve metric/coverage/quality arithmetic, authorization,
    feature/default/echo and existing Runtime/Probe/Journal authority; provenance
    is never execution proof or health. Real SQL/deadline/functional acceptance
    belongs in authorized Actions. Remaining mixed application/value/HTTP/Agent
    and unclassified source require their own evidence, without blanket exemptions.

40. On the exact frozen source compare old observation helper exports and public
    L2 bindings, service constructor/default-function capture/explicit clock,
    response/type/freeze/exception/initialization behavior and shared command
    request signatures. Native imports must stay L2, L1 request framing must use
    only Core/errors/ports and a synchronous outer digest, and HTTP must not import
    the business observation value file. Cover closed keys, null/plain prototypes,
    malformed arrays/objects, original Node IP parsing/canonical IPv6/zone/mapped/
    multicast/link-local/metadata refusal, lowercase server-name labels and URN
    escaping. Trace bounded canonical base64/DER/X509 failures, date/usage/SAN/
    expected-set/native key/property projection/hash order and short-circuiting;
    retain RSA/EC/Ed25519 bounds, exact raw leaf/non-CA/server-only EKU/DNS/URI,
    config-inside-certificate window and old error messages/corruption wrapping.
    No system roots, chain fallback, current native time, I/O, retained key/native
    projection or new grant may appear. Compare staged echo decoder, SPKI/public
    32-byte checks, fingerprint, unsupported/malformed formats and unchanged
    feature/registration/permit/execution gates. JSON UTF8 limits, digest inputs,
    UUID count/error point, wall-clock source identity and monotonic admission/
    release/one-second cooldown must match original behavior. Request key/identity
    rejection must precede digest; immutable actor/scope/key and method/path/input
    framing must retain exact hashes, with no normalization or new asynchronous
    phase. Verify HTTP request fields/body bounds/error/service availability and
    original declaration list/get/publish/archive authorization, replay, quota,
    CAS, immutable history, audit, rollback and recovery-suspension semantics in
    authorized Actions. Public helpers grant no health/ownership/echo authority;
    remaining HTTP/private query/native/other-owner/Agent dependencies still need
    their own source and behavior evidence.

41. Compare exact frozen-source imports, public native function identity/default
capture, optional/nullable/type shapes, old constructors/overrides, error/status
and initialization order. Cover telemetry sample/ack/coverage/identity/point wire
parsers, canonical UTC and captured timestamp precision, digest inputs, default
clock and explicit clock, monotonic two-active/128-actor/one-second cooldown,
response byte limits and original rollup transaction calls. Cover audit/station/
notification/Probe cursor base64url bytes, canonical JSON/query digest/position,
request framing, UUID placement, scope/CAS/replay/rollback and exact error order.
Verify notification destination signing hex conversion, sender input and key zeroing
after send/error; no key or raw secret leaves the L3 owner. Verify diagnostic DER
fingerprint bytes and Probe result/service parser framing remain identical. Ensure
new L2 bindings have no business validation, hidden time read, retry, retained Tx,
authority, owner write, network or feature fallback. Real functional/SQL/network
evidence belongs in authorized Actions; all remaining mixed source needs separate
evidence.

42. Compare exact URL helper public identity, UTF8 byte bounds, ASCII/control/
userinfo/port/query/fragment/IP/TLD/private-name refusal and canonical href/errors;
the old application and both infrastructure callers must share one implementation
with no DNS/network/secret/authority. Compare endpoint/delivery/station digest and
JSON byte limits and payload field order. Compare Probe plan/run UTC parse/ISO,
canonical base64 challenge, service selection, staged echo invocation/frame bytes,
proof digest, result/permit/history error order and byte limits without enabling
echo or creating execution authority. Compare rollup series/sample/bucket digest,
Date parsing, JSON UTF8 encoder, deep clone and fold input ordering; retain metric,
quality, coverage, quota and arithmetic rules. Verify all callbacks/aliases are
synchronous/unretained where required and no lower helper imports L3 policy or
owner classes. Real wire/SQL/network behavior belongs in authorized Actions.

43. Compare exact app codec imports/function identity, JSON/parser limits and
errors, fatal UTF8 body decoding/chunk release, UUID placement, Runtime/Transit/
Probe/observability wire versions and route/middleware/auth/error ordering. Verify
unsupported ADP/protocol behavior remains refusal and no parser fallback/network/
authority/feature is introduced. Compare pageWindow and consolePage defaults,
maximums, offsets and duplicate/invalid query behavior. Verify product filter
vocabularies remain in L3 and lower helpers import no application classes.

44. Compare exact Probe service/TLS/echo parser identities, context digest bytes,
constructor/default clock capture, explicit clock override, authorization/store
call order, version/transport selection, stale/archived/recovery/digest/window/
clock refusal and existing error codes. Verify no network, secret, permit, sender,
listener, echo execution or Runtime write enters the resolver; real Probe/HTTP
evidence belongs in authorized Actions.

45. Compare exact parser/JSON function identity, request/response field order and
labels, UTC/ISO timestamps, default/explicit clock function behavior, 250ms
freshness, Node/session/instance/permit refusal, service/measurement selection,
owner transaction-before-ack ordering, duplicate/lost-response semantics and
`executionEnabled: false`. Confirm no parser fallback, permit creation/extension,
network/sender/Runtime write, retry, clock policy or echo enablement. Real mTLS,
Probe and Actions evidence belongs in authorized verification.

46. Compare exact Probe permit codec imports/function identity, JSON/ISO/fingerprint
bytes, invocation/challenge/proof digest and verification, issuance ID/binding/
expiry/freshness, 256-record budget, lock/transaction/plan/instance/machine/
qualification order, consume/check/revoke/withdrawal state/CAS/replay/duplicate
result/history capture and all refusal/error points. Verify one authority owner,
no caller-selected issuance/replay insert, no Journal/Runtime write/reset, no
network/sender/echo execution/fallback, and unchanged disabled execution. Real
permit/Agent/Actions evidence belongs in authorized verification.

47. Compare exact validator imports/function identity, sorted field-key unions,
binding equality, malformed/null/array behavior, TLS/echo context scope/version/
protocol/window checks, challenge/invocation digest and ISO timestamp bytes. Verify
false/refusal order remains pure and synchronous with no storage/clock/network/
authority/fallback. Real permit/Agent evidence belongs in authorized Actions.

48. Compare exact frozen-source instance/qualification record specialization,
    readonly/mutable and optional marker fields, legacy zero-argument constructors,
    method/prototype/static recovery signatures and explicit production wiring.
    Verify lower source/type imports contain no L3 parser/state/API or wire types;
    callbacks are synchronous at original post-row/pre-write points with no retained
    transaction, I/O, retry or new validation phase. Preserve undefined/null/empty
    rows, malformed sentinels and marker combinations, original corruption codes,
    field projection order, strict versus deliberately absent checks, and no new
    closed-object or timestamp constraints. Compare every SQL string/argument,
    nonlocking read, FOR SHARE/current read, absent-slot upsert/FOR UPDATE, matching
    revocation predicates, affected-row CAS and same-Tx rollback. Qualification
    markers remain sticky only for the same full instance identity; instance
    replacement must not carry an old proof. Preserve optional v3/v4 persistence
    versus the original narrower application validator without enabling echo.
    Trace the five dynamic Date.now calls, including resampling after lock waits,
    registration/replay/generation exhaustion/revocation/inspect refusal, thirty-
    second and credential bounds, typed/services qualification read/write ordering
    and post-transaction serverTime. Confirm parser function identity, one named
    export per public codec and unchanged default-function capture. Static recovery
    retains Date.now and original quarantines with generation/markers/budget/history
    intact; no reset or permit issuance. Real MySQL/Agent/functional evidence belongs
    in authorized Actions on the same source. Remaining mixed Probe SQL/application,
    Agent/native and whole-repository classification still need their own evidence.

49. Compare the exact lower evidence records, generic specializations, old Probe
    type names, readonly/nullable fields and public method/constructor signatures.
    The three existing readers must use lower source/type contracts without L3
    imports, while keeping their class identities and original SQL/arguments.
    Trace the machine LEFT JOIN, FOR SHARE, absent credential/null behavior, zero
    expiry defaults and original string-only capability filtering; do not add
    normalization, deduplication or stricter validation. Published reads retain
    scope/revocation/current-session/generation joins, byte bounds, optional share
    lock, parse limit and JSON decode/stringify order. Missing rows and mismatched
    node/session/generation/validUntil return undefined; malformed data must keep
    original parser failures. Forward intent reads retain same-transaction share
    locks, notFound timing, lazy stored spec and Boolean flag conversion. Preserve
    planner lock/auth/read/service/clock order, Direct config assertions, exact
    numeric target/metadata refusal, two-second/credential/skew bounds, typed/TLS/
    staged echo preflight and issuance flags without widening executable kinds.
    Compare request framing, native helper/parser identity, UTC bytes, errors and
    explicit deadline narrowing. Cover registration export consolidation and the
    original staged echo challenge function binding, with no new parser or enable.
    Real SQL/Agent/functional evidence belongs in authorized Actions on the same
    frozen source. Permit persistence/native/other-owner debts remain separate.

50. Compare exact permit/result storage specializations, readonly/optional fields,
    legacy zero-argument/stateless/prototype and subclass override behavior, plus
    explicit production and recovery bindings. Compare the original budget lock,
    permit/withdrawal LIMIT 257/FOR UPDATE, SQL text/parameters, column byte bounds
    and invalid sentinels. Exercise absent rows, invalid measurements/null contexts,
    lazy context/challenge/binding decode and validator/freeze/error ordering. Cover
    clock CAS, prune, issued-only insert, closure/consumed withdrawal conflicts and
    same-transaction failure/rollback without a second budget or issuer. Compare
    result SQL byte bounds and the UTF-8 write limit before verification; v4 echo
    first, v3 services second, and intentionally unchecked v1/v2 here. Cover own
    requestId rejection, the 64-zero temporary value, original parser/digest/error
    identity, missing/malformed results, replay and exact serialized body ordering.
    Exercise both separate recovery clock reads, statement ordering, quarantine and
    GREATEST withdrawals without clearing/refunding IDs/results/consumption/budget.
    Adapt historical source-string boundary rules only in the authorized verification
    stage, then run real SQL/Agent/functional evidence in Actions on the same frozen
    source. This item and all associated compatibility assertions are unexecuted.

51. Compare exact Probe and observation public type exports, readonly/mutable and
    nullable fields, reader optional arguments, old function exports and function
    identity through all legacy aliases. Trace module initialization and ensure one
    value/provider implementation with no clock, connection, transaction or issuer
    introduced at import time. Preserve machine session-before-credential-before-
    optional-capability rejection; compare qualification key sets, original optional
    servicesVersion versus the distinct persisted echoVersion/upper-time rules,
    current-slot identity/state/registeredAt/expiry checks and unchanged errors.
    Trace original register/revoke/inspect store/lock/capability/time/response order,
    and permit mutation/history/ACK boundaries using the same supplied transaction.
    Compare exact service-reference object checks, counters/digest, detached mutable
    return and parser aliases; preserve metadata auth/head/revision/trust/time and
    native callback order, null/error mapping and immutable config interpretation.
    The new reader must match the old Pick structurally, not tighten or broaden its
    result/lock semantics. Preserve separate state owners, one permit budget and
    original issuance kinds/feature flags; public echo descriptions do not authorize
    issuance. Adapt old source-string tooling only in the authorized verification
    stage and obtain functional/MySQL/Agent evidence in Actions on the same frozen
    source. This item is unexecuted and does not establish whole-owner acceptance.

52. Compare restored codec/public/canonical function and type alias identity and
    module initialization, with one implementation and no default/provider fallback.
    Preserve v4, v3, v2 and original v1 dispatch order, inherited discriminant reads,
    malformed/null/array/unknown-version behavior, JSON call count, parser/body/digest
    ordering and mutable envelope key order. The v1 measurement stays the same literal.
    Preserve stored v4-before-v3 checks, own requestId rejection, 64-zero temporary
    requestId, exact digest/error mapping and deliberately unchecked v1/v2 here.
    SQL's UTF-8 byte bound must still precede this guard and the insert, and the
    guard must not inspect acceptedAt or change business binding/proof validation.
    Compare v1/v2/v3 ACK fields and key order, UTC/JSON/parser/check calls and passed
    product measurement projection. Keep request parsing, machine identity, owner
    commit, clock sampling, 250ms freshness, result digest/deadline checks and error
    points in the original adapters before formatting. Cover duplicate results and
    committed-but-lost/late/malformed ACKs without refund, renewal or replay issuance.
    No v4 ACK or wider public issuer is accepted by this slice. Type/contract and
    historical source-string tooling adaptation waits for later authorization;
    functional/MySQL/Agent evidence belongs in Actions on the same frozen source.
    This entire item is unexecuted; source reads do not establish equivalence.

53. Compare the original negotiation, instance, claim, poll/status, typed and
    service qualification/poll/claim/status projections through old and new public
    entries. Preserve parser/check function identity, request spread and response
    key order, nullable offer/service fields, disabled state flags, health/status
    literals and exact response types. Verify callback evaluation timing: instance
    and service qualification serverTime remains post-owner transaction; typed and
    service measurement descriptions run only for non-null offers; no codec callback
    reads a clock, transaction or permit. Preserve machine identity and current
    owner refusal before formatting, 250ms freshness and deadline checks, commit-
    before-ACK behavior, duplicate/lost response semantics and original errors.
    Cover type-only public aliases and module initialization without a second wire
    implementation, protocol version, capability or issuer. Adapt historical
    boundary/source-string tooling only after verification authorization; execute
    functional/MySQL/Agent evidence in Actions on the same frozen source. Entire
    item 53 is unexecuted.

54. Compare Path public and legacy parser/validator/limits identity, type aliases,
    module initialization and the original mutable-as-const limits object. Preserve
    closed object/prototype/key checks, bounded distinct Node/protocol lists, ordered
    downstream Endpoint revisions, canonical protocol filtering and immutable config
    construction. Compare exact head/revision identity and counter bounds, existing
    hash regex behavior including terminal-newline cases, profile/config digest input
    key order, timestamp bounds, parser exception wrapping and original error codes.
    Preserve query auth/read/notFound/validate/page/ISO and command auth/idempotency/
    Scope lock/head lock/CAS/archive/prior revision/clock/reference/quota/publish/audit/
    response order in the same supplied transaction. Default clock helper must return
    the same captured function without an early time read; paging/digest/ISO helpers
    must not add policy, normalization or stronger validation. Trace sorted Node,
    Profile and Endpoint reference reads and Path/Ingress use of public validators
    without another owner table write or private application import. SQL is unchanged
    in this slice and still needs its separate source extraction and acceptance.
    Adapt historical source-string tooling only in the later authorized verification
    phase; obtain real SQL/functional evidence in Actions on the same frozen source.
    This item is unexecuted and does not establish A1, A2 or foundation acceptance.

55. Compare the original PathTemplate records/reader/writer with their lower
    specializations, including mutable fields, nullable reads, optional lock,
    ReadPageWindow/ConsolePaging structural compatibility, constructor arity and
    public async prototype/subclass methods. Verify lower-store and legacy entry
    module initialization without a reverse product import in the SQL owner. Trace
    the same supplied transaction, exact SQL strings/argument order, Scope/head
    locks, missing-row nulls, Boolean archive mapping and raw JSON behavior for
    string, driver object, malformed JSON and corrupt product config. Product
    validation stays at its old call points; do not silently validate inside SQL.
    Cover count-before-list, literal bounded LIMIT/OFFSET, bound prefix matching,
    archived rows, empty pages and read-committed non-global-snapshot behavior.
    Preserve revision-one head insert, immutable revision insert, head update,
    archive flag and audit UUID timing/fields, original failures and rollback.
    Compare auth/idempotency/quota/CAS/reference/clock/publish/audit order through
    Control and original Path/Ingress callers, with no extra transaction, retry or
    listener/Runtime authority. Adapt source-string tooling only in the authorized
    verification phase; obtain functional/MySQL evidence in Actions on the same
    frozen source. This entire item is unexecuted; no A1/A2 acceptance is claimed.

56. Compare public/legacy path parser and expansion identity, module initialization,
    exact closed-field/prototype/digest/revision errors and expansion of ordered
    nodes while preserving physical ingress and business intent. Compare original
    Path binding records/ports with lower specializations, mutable/null/optional
    fields, paging shapes, separate at reader, zero-argument construction and async
    prototype/subclass methods. Preserve the same transaction and original Forward
    row-lock precondition; verify exact SQL strings, SELECT b.* projections, double
    Scope predicates, revision filter, deleting exclusion, count-before-page and
    raw JSON/Boolean behavior without new validation inside SQL. Cover original
    numeric and DECIMAL-text sequence conversion, malformed values, 63-to-64 and
    limit/corruption refusal before writes; preserve history insert/current pointer
    order, spread/sequence result and rollback. Detach changes only the current
    pointer and never immutable history; history retains its original query, with
    contiguous/64-entry/current-pointer checks in the application. Trace complete
    Forward apply/create/group/publication and normal-update resolve/accept/preserve
    chains, old no-op attachment without Runtime restart, CAS/idempotency/reference/
    safety/Operation/capacity order and all failure rollbacks on the same transaction.
    Cover archived history versus new-binding refusal, profile/digest/topology
    corruption, scope and manager denial, suspended/deleting references, pagination,
    target unavailability and preview non-authorization. Compare original digest
    inputs/key order, captured default clock, item ISO and new Date()-based final
    observedAt timing; no extra time read or implicit Date.now substitution. Keep
    old compatibility consumers and PathGroup sequence history on one SQL owner.
    Adapt source-string tooling only after authorization; functional/MySQL/Agent
    evidence belongs in Actions on the same frozen source. Entire item unexecuted.

57. Compare public and legacy group parser/selection/limits identity, closed-field/
    prototype/version/kind/candidate order and uniqueness errors, exact digest and
    revision bounds and original mutable-as-const limits. Compare lower/product
    record/port fields, paging, nullability, generic configuration and initialization
    without product imports in SQL. Preserve both zero-argument classes, public
    async prototype/subclass methods and lazy publish -> this.count dispatch: same
    transaction/Scope, revision-one only, original errors and no extra count call.
    Trace original Scope/head lock order and application plus SQL quota checks;
    revision-one head insert versus later immutable insert/conditional head CAS
    with archived=FALSE and affected-row conflict, archive, audit UUID and rollback.
    Preserve exact SQL/arguments, raw JSON/Boolean mapping, prefix/revision filters,
    double Scope joins, SELECT b.*, count/page order and group-history LIMIT 64
    without changing ordinary Path history. Cover numeric/DECIMAL sequence edges,
    63-to-64, corruption/limit-before-writes, pointer upsert/detach and no history
    deletion. Trace publish/no-op/archive auth/idempotency/time/candidate/limit/audit
    order, sorted template reads then restored priority, actor-dependent live
    reference checks and archived historical versus new-use refusals. Verify same
    ingress/protocol and egress-terminal rules without auto-picking a candidate.
    Trace Forward/group/publication -> selected Path resolve -> original safety/
    Runtime/Operation/capacity -> Path accept -> group accept and exact original
    Path current/at provenance validation, no-op attachment, preserve/detach and
    rollback. Cover manager denial, source/CAS/digest/candidate/receipt corruption,
    missing history/current pointers, suspension/deleting, preview delegation and
    all non-authorizing/unknown-health flags. Keep original digest/request body
    order, default clock capture and timestamp formatting. Adapt source tooling
    only after authorization; functional/MySQL/Agent evidence belongs in Actions
    on the same frozen source. Entire item unexecuted; no A1/A2 gate acceptance.

58. Compare public/legacy parser, hash, limits and rejection-Set identity, runtime
    mutability, closed fields/prototypes, item bounds/order/uniqueness, exact source/
    provenance and path-only digest rules and UTF-8 plan byte/error behavior. Compare
    lower/product records, generic Plan/Outcome, operation status union, paging and
    optional/null/mutable meanings. Preserve zero-argument construction, public
    async prototype/subclass methods, private event and lazy count/event dispatch.
    Verify exact SQL/arguments, raw JSON/Boolean mapping, Scope count/lock, default
    FOR SHARE versus FOR UPDATE and same-transaction attempts projection, LIMIT 20,
    initial quota recheck, revision<24/recovery/cancel predicates, affected-row
    refusal, attempt/event order and rollback. Trace original SAVEPOINT creation,
    action/result validation, success release and known-refusal rollback/release;
    classifier runs before rollback and error fields project only after release.
    Cover original ControlError identity, mutable code Set, statuses, retryable/
    unknown errors, classifier/projection failures and every savepoint failure;
    none becomes an implicit retry or swallowed database error. Trace preview/
    create manager/idempotency/Scope/replan/digest/ID/time order; item creator and
    recovery refusal remains before replay, then CAS/attempt/cancel checks before
    Forward execution. Verify partial failures, lost replies, original-key replay,
    attempt/event/response failure rolling back accepted Forward changes, and
    exact-source/grant/provenance guarded compensation and pointer-only detach.
    Check cancel/no-op timing, immutable history preservation, operation association
    limits and unchanged non-authorizing/unknown-health/non-atomic flags. Keep one
    Runtime ledger and original Forward execution owner. Adapt source tooling only
    after authorization; functional/MySQL/Agent evidence belongs in Actions on the
    same frozen source. Entire item unexecuted; no A1/A2/foundation acceptance.

59. Compare public/legacy ingress parser/limit identity and initialization, original
    mutable limits, closed-field/prototype/version/member/order/uniqueness errors,
    exact selection/hash rules, explicit enabled false versus omission, original
    dummy-Forward listener/target parse order and UTF-8 plan byte boundary. Cover
    distinct ingress Nodes, shared protocols/target/intent and immutable plan order
    without substituting PathGroup's same-ingress rules. Compare product/lower group
    records/port fields, generic configuration, paging, optional/null/mutable shapes
    and zero-argument public async prototype/subclass methods. Preserve lazy count
    override only for revision one, its original transaction/Scope/error timing and
    both application/SQL quota checks. Verify exact SQL/arguments, Scope before head
    lock, missing nulls, raw JSON/Boolean mapping, prefix count/page and bounded SQL
    pagination, initial head/revision insert versus later immutable insert/head CAS
    with archived=FALSE, affected-row conflict, archive/audit UUID and full rollback.
    Trace original parse/identity/CAS/auth/idempotency/time/member/quota/audit order,
    no-op publish reference checks and archive no-op clock sampling. Compare sorted
    template traversal then restored member order, actor-dependent locks/live Node/
    Profile/Endpoint checks, absent/archived/digest/error differences and historical
    reads. Preserve describeIn default active=false, resolveIn active requirement,
    exact requested member copying/order and manager checks, without adding live
    reference authorization to persisted-only resolution. Trace downstream original
    selected Path/Forward authorization instead of treating resolver output as a
    permit. Keep clock capture, ISO/digest/request timing, original flags and no
    shared physical execution or history reset. Adapt source tooling only after
    authorization; functional/MySQL/Agent evidence belongs in Actions on the same
    frozen source. Entire item unexecuted; no A1/A2/foundation acceptance.

60. Compare lower/product head, Plan index, Outcome, attempt/operation records and
    store shapes, optional locks, null/mutable fields and structural public types.
    Preserve zero-argument construction, async prototype/subclass methods, private
    event and lazy create/count plus create/append/cancel event dispatch. Filtered
    list COUNT remains its own original query, never a call to overridable count.
    Trace exact SQL/arguments, group index evaluation, Scope lock and 64-batch quota,
    FOR SHARE/FOR UPDATE, LIMIT 16, revision<20, recovery/cancel predicates, affected
    rows, attempt/event order and full rollback. Verify original savepoint success,
    known-refusal rollback/release and late error projection; shared classifier/Set
    identity, unknown/retryable/database and savepoint failures must retain original
    propagation. Trace original manager/creator/recovery/idempotency/CAS order,
    group/member re-resolution and Forward create/conditional deletion, unique
    accepted Forward IDs, receipt/path checks, durable partial refusals and response
    failure rollback. Preserve originIn deployment/apply-only, Scope authorization,
    recovery and accepted-create/compensation eligibility, without treating old
    lineage as current Forward authorization or health. Compare public/legacy
    origin/lineage/migration parsers and limits identity, private helper errors,
    original frozen migration limits, group revision/complete-diff/source/action
    invariants, explicit enabled false, update-only-path/Profile, required remove
    before replacement-add and UTF-8 plan bound. Keep digest/request/ID/default
    clock/ISO timing, cancellation no-op timing and all non-authorizing/non-atomic
    flags. Adapt source tooling only after authorization; functional/MySQL/Agent
    evidence belongs in Actions on the same frozen source. Entire item unexecuted;
    no migration-owner, A1/A2 or foundation acceptance is established.

61. Compare lower/product Plan index, head/attempt/Outcome/Failure/Operation shapes,
    optional locks, null/mutable meanings and public/legacy alias initialization.
    Preserve zero-argument construction, async prototype/subclass methods, private
    event and lazy create/count plus create/append/cancel event hooks. Different
    source/target group IDs must fail before quota dispatch/query/insert/event;
    filtered list retains direct COUNT without a virtual count call. Compare exact
    SQL/arguments, source/target indexes, Scope/head locks, raw JSON/Boolean mapping,
    FOR SHARE/FOR UPDATE, attempts/Operations LIMIT 16, quota 64, revision<20, CAS/
    recovery/cancel predicates, affected rows, event order and rollback. Trace the
    named savepoint, shared refusal provider/Set identity, pre-rollback classifier,
    post-release error projection, success release and every retryable/unknown/
    database/savepoint failure propagation. Preserve preview's sorted origin and
    current-Forward inspections, source/active-target reads, complete sorted diff
    and input-order actions; create's replan/digest/ID/time and outer idempotency
    ordering. Trace creator/recovery before replay, then CAS/duplicate/cancel and
    compensation checks. Apply retains exact origin/current-state checks and
    action-specific add/update/remove calls; removal has no target resolution.
    Compensation conditionally removes accepted add, restores accepted update and
    refuses remove. Keep result checks inside savepoint, no-op/update revisions,
    receipt/Operation/path/group provenance, unique created IDs and durable partial
    refusals. Attempt/event/response failures roll back accepted Forward work in
    that Tx, not separately committed items. Preserve migration-only originIn,
    recovery/accepted/non-remove eligibility, compensated-apply refusal and exact
    update-restoration lineage; failed compensation/cancellation do not become
    implicit current-state authority. Keep clock capture/sampling/ISO/request/digest
    timing, cancel no-op timing, list/get Operation association and all unknown/
    non-authorizing/non-atomic flags. Adapt tooling only after authorization; real
    functional/MySQL/Agent evidence belongs in Actions on the same frozen source.
    Entire item unexecuted; no A1/A2/foundation acceptance or upper-module gate.

62. Compare public/legacy Transit API and wire aliases, capability tuple identity
    and runtime mutability, module initialization and structural consumers. Keep
    the old one-argument constructor and own async hello prototype/subclass entry,
    original database field access and no constructor I/O. The public owner requires
    an explicit reader; no fallback, pool, retry or independent authority is allowed.
    Trace request Node/session/counter before fingerprint before transaction, then
    exact SELECT/arguments/FOR UPDATE and raw first-row/undefined handling. Keep
    numeric/null flags and credential times unnormalized and facts undecoded until
    after boot/session, one dynamic clock sample and credential refusals. Cover
    absent rows, malformed/nullable facts, revoked/missing/zero/expired/retiring
    credentials, malformed capabilities, retained Transit history and overlapping
    failures to preserve original error precedence. Compare original facts JSON
    call timing, capability includes traversal, generation refusal, mutable ACK
    shape/key order/UTC/tuple reference and original no-response-parser behavior.
    Verify HTTP parsing and mTLS-to-Node mapping still precede this owner; ACK stays
    contract-only/executionEnabled:false and never clears Fences, confirms delivery,
    advances coordination, publishes a Snapshot or issues a lease. Keep SQL/clock/
    JSON/formatter failure rollback and no write/extra query behavior. Adapt tooling
    only after later authorization; functional/MySQL/network evidence belongs in
    Actions on the same frozen source. Entire item unexecuted; neither the remaining
    Transit chain nor A1/A2/foundation/upper-module gate is accepted.

63. Compare restored step/public/canonical function identity and module initialization
    over one existing implementation, with no duplicate algorithm or provider fallback.
    Compare old/new preparation, command/proof/body, raw stage/outbox/journal/receipt
    types and public aliases, optional/readonly/null/mutable fields and structural
    consumers. Preserve the old one-argument constructor, db/coordination fields,
    own async enqueuePreview/poll/report methods and lazy field/method dispatch.
    Trace exact SQL columns/arguments/predicates/locks and raw first-row/undefined
    results, including full locked enqueue journal versus minimal status projections,
    unlocked poll status versus locked report status, pending LIMIT 16/order, opaque
    facts/body and raw nullable high-water. No eager decode, extra query or retry.
    Preserve delivery-specific session/boot, clock, credential short-circuit and
    deferred facts/capability order, without adopting negotiation's different order.
    Enqueue keeps peek in its original transaction followed by re-locking stage,
    actor/state, retained-plan validation, coordination revision/digest/step, clock/
    30s cap/5s margin, exact Node bindings/session and physical owner/Fence/generation,
    then existing outbox decode/boot or new envelope/digest/parser/insert. Cover
    changed state between transactions; do not merge them or revalidate existing
    outbox at a new phase. Poll decodes before one clock read per row, keeps boot/
    issued/expiry short-circuits and excludes only original terminal journal phases.
    Report validates input identity before Tx, locks current machine before replay,
    compares original request digest and returns exact duplicates before high-water,
    outbox/freshness/journal checks. Retain different-body reuse, regressing sequence,
    pending identity, decode/clock/observed-time, 30s/expiry, locked journal revision/
    phase, receipt insert before acknowledged CAS and full rollback on failure.
    Compare codec JSON/UTC/digest/parser call count and order, envelope/ACK key order,
    disabled flags and original strict parser/freeze behavior. Preserve retained stage
    malformed-JSON mapping, digest/identity/topology/Fence rules and offline step
    terminal-null, activation/reversed-withdrawal, assignment sorting and errors.
    Do not add stronger checks or reinterpret historical data in this extraction.
    ACK and duplicate ACK never call confirm, authenticate execution proofs, advance
    offline state, issue a lease, free ports or prove listener readiness. Staging/
    coordination recovery still owns its original checks. Adapt source tooling only
    after later authorization; functional/MySQL/network/Agent evidence belongs in
    Actions on the same frozen source. Entire item unexecuted; no A1/A2/foundation
    acceptance, runnable public-example evidence or upper-module gate is established.

64. Compare public TransitCoordinationService and the exact old one-argument
    TransitCoordinationJournal constructor, own async begin/peek/confirm/fail/
    quarantineRecovery entries, lazy db dispatch, function/type aliases, Control
    composition and module initialization on the same frozen source. Confirm the
    actual modules/runtime paths without creating a second runtime directory.
    Preserve raw mutable journal fields, opaque high-water and missing undefined;
    separate Scope-filtered stage versus Scope-less recovery reads, session_epoch
    only projection, exact original SQL/args/FOR UPDATE and recovery ordering.
    Verify generation refusal inside Tx, actor before plan validation, reserved
    state before freshness, sorted distinct Node sessions before physical slots,
    and original owner/Fence/generation predicates. Body validation retains lazy
    JSON decoding, phase/revision/position, plan identity, high-water membership/
    counters and digest order without new retained-data hardening. Begin checks
    freshness/ownership before prior journal, inserts before step projection and
    makes two distinct dynamic clock calls for created_at/updated_at. Peek and
    confirm refresh only preparing/activating; compensation/terminal paths do not
    acquire those extra checks. Confirm requires an explicit verifier before Tx,
    then step/proof clock and original freshness/assignment/Fence/condition checks
    before awaiting verifier; only authenticated proof updates high-water/phase.
    Cover preparing-to-activating, activating-to-sealed and withdrawal-to-quarantined
    positions, duplicate/stale proof, future/old time, wrong assignments and verifier
    rejection/error. Preserve revision exhaustion, encoding before digest before
    clock, exact previous revision AND journal digest CAS and affectedRows===1;
    write, step or verifier failures roll back the original whole transaction.
    Fail has no fresh/ownership check, returns null for quarantined, reuses current
    compensating step and can move sealed to compensation. Recovery locks ordered
    preparing/activating/sealed rows, verifies each retained stage/body and persists
    compensation without Scope/actor/current-ownership substitution or partial
    commit. Preview/received ACK never calls confirm; no default verifier, network,
    Snapshot, lease, port release or history reset is introduced. Adapt existing
    source tooling only after later authorization. Functional/MySQL/network evidence
    belongs in Actions on the same frozen revision. Entire item is unexecuted; no
    A1/A2/foundation acceptance, public-example evidence or upper-module gate opens.

65. Compare original compiler/validator aliases, public TransitInput and preparation
    types, shared helper identities and module initialization on the same frozen
    source. Preserve mutable input fields, readonly arrays/maps and original Core
    parse then topology/Profile identity/framing/digest/protocol order. Cover complete
    and duplicate Node/endpoint sets, ports, Scope/role/wire capabilities, CIDRs,
    listener/address and adjacent/egress target policy, including competing invalid
    inputs and unchanged plain Error versus ControlError identities/messages.
    Preserve physical TCP/UDP collisions and deepFreeze behavior, time validation
    before parse, connection limits, repeated original checkPath/resource compilation,
    exact reservation/pin counts, active distinct peer pins, session/credential
    bounds, resource identity/Fence and one generation. Compare assignment/path/plan
    digest frames, property order, shortest expiry and tail-first activation. The
    L2 Intent projector retains original field reads, neighbor identity, ISO/JSON/
    strict-parser order and destination-CIDR set/sort without granting execution or
    reading time. Resource-set validation retains complete topology/physical/logical
    uniqueness and ingress/internal restrictions before any storage call. No data
    hardening, authorization bypass, parser widening or live publication is added.
    Entire item unexecuted; later functional evidence belongs in Actions on the same
    frozen revision. Staging and full foundation acceptance remain open.

66. Compare old reserveTransitResources async signature and supplied-Tx behavior,
    required TransitReservations/RuntimeExclusiveReservations providers and legacy
    dynamic default-policy binding. Confirm existing RuntimeResourceAccess, Direct
    reserve and reserveRelay behavior remain unchanged, with one resource ledger.
    Invalid Transit resource sets must fail before storage. Preserve sorted unique
    Node locks with raw row-count===1 before sorted physical slots; exact ensure,
    minimal owner/fence SELECT, missing-row and any-owner refusal, safe nonnegative
    fence exhaustion, assign and returned spread/Fence+1 order. Same-owner reuse is
    still refused here and allowed only by the existing different Relay mode.
    Capacity reads occur for sorted Nodes only after all assignments, retain raw
    count/missing values and Number coercion before the original per-Node late policy
    read. Preserve original error/status/message, no affected-row check on assign,
    original SQL/args/FOR UPDATE, unmodified input order and unfrozen returned array.
    Failures at any lock/write/count/limit roll back the caller transaction; no
    connection, nested transaction, internal retry, initialization, lease or Snapshot
    publication is added. Cover contention, duplicate writers, same-owner conflicts
    and post-allocation capacity failure in later authorized MySQL Actions. Staging
    abort/release remains its own unresolved owner chain, not an implied new release
    method or safe-cleanup claim. Adapt existing tooling only in the later authorized
    phase. Entire item unexecuted; no A1/A2/foundation or upper-module gate opens.

67. Compare public TransitStagingService and the old five-argument coordinator,
    own async stage/abort methods, raw stage-row and verifier aliases, initialization
    and lazy db/Node/Forward/Profile/Endpoint callbacks on the same frozen source.
    Abort with null unused collaborators, already-aborted state and invalid inputs
    must retain original call/refusal order. Revision/generation input guards run
    before Tx; stage locks Forward before revision/authorizer/topology/latest stage,
    including first-stage writer contention. Preserve descending generation LIMIT 1,
    newer-target/reserved-state refusal, generation exhaustion and sorted session
    locks before Profile resolution and the single dynamic clock sample. Compare
    Node authorization/facts/current peers, validity/fingerprint ordering and exact
    ten-second boundaries, Endpoint hop order, allowed-port iteration/seen set,
    distinct literal-TCP candidate and parameterized physical-owner queries without
    extra locks, resource-set validation and same-Tx exclusive reservation. Preserve
    same-owner refusal, original capacity timing, compiler/ISO/digest/freeze order,
    min(connection limit,4096), five-minute expiry cap and >ten-second margin;
    encode only at original insert phase. No clock capture or extra sampling.
    Abort preserves scoped stage lock, actor then retained-plan validation, aborted
    false return, ANY coordination row refusal before Runtime/history checks, sorted
    Node row-count===1 and one clock sample, raw nullable maximum Forward lease,
    +5000 margin and Snapshot valid_until>now-5000. Keep lazy stored JSON, malformed
    assignments or matching Forward refusal and original errors; do not harden or
    erase retained data. Verify exact Runtime release locks/checks ALL retained
    assignments before any update, preserves order and owner/Fence/generation,
    requires affectedRows===1 for EACH precise release, then original reserved-only
    stage CAS with the same sampled now. Cover missing/changed slot, wrong owner,
    Fence/generation, second-slot mismatch before first release, first/later update
    failure, stage CAS race, malformed Snapshot, lease boundary and provider errors;
    roll back all earlier allocations/releases/stage writes as one caller Tx.
    Preserve original SQL projections/args/FOR UPDATE, raw missing/null values,
    ControlError identity/status/message and absence of broad resource cleanup.
    No pool, nested transaction, retry, network, lease/Snapshot/journal mutation,
    new authority or live execution is introduced. Existing source-string tools
    still need later authorized adaptation; do not expand them during this phase.
    Functional/contention/MySQL evidence belongs in Actions on the same frozen
    revision. Entire item unexecuted; no A1/A2/foundation or upper gate opens.

68. Compare public/legacy AuditEvents constructors/prototype methods, AuditReadModels,
    exact API/record/type aliases, source/kind/error array identity and mutability,
    frozen limits/coverage, shallow storage policy and module initialization on the
    same frozen source. Constants-only/type-only legacy paths alias their canonical
    leaves without widening the old export surface; new consumers use public.ts.
    Preserve invalid identity/closed query refusal before clock/admission/Tx, the
    original two wall-clock call points, canonical UTC/window and explicit cursor
    window, exact filter vocabulary, digest frame/property order, base64url/JSON
    limits, cursor canonical round trip and catch/error mapping. Keep deepFreeze
    points, sourceSet/codeSet initialization semantics and original errors. Admission
    remains per instance: request cap, actor cooldown/key bound, monotonic sampling,
    concurrent actor refusal and finally cleanup on auth/store/projection/byte-limit
    failures, with no new global state. Inside one supplied Tx, manager Scope check
    precedes sequential per-source reads; preserve source list order and limit+1,
    original lazy asserted lower-row projection followed by full exact-key/product
    row validation, attribution/node association/operation special cases, filters,
    strict descending family and merged tuple ordering, duplicate refusal and page
    slicing. Response time/ISO/cursor/coverage/limits/freezing/byte guard order remains
    unchanged. Station error-code consumers retain the same array, module-time Set,
    null and OTHER_ERROR behavior. Existing lower MySQL queries and source-owned
    retention remain unchanged; no additional reader/pool, retry, event store or
    current-authorization/health promise. Functional/MySQL/source-filter acceptance
    belongs in later authorized Actions on the same revision. Entire item unexecuted.

69. Compare public/legacy ForwardDiagnostics constructor, own async get/admission,
    DTO/read-contract/policy aliases, public Probe validator and exact L2 wire-type
    aliases, native defaults and initialization on the same frozen source. Preserve
    timing-policy rejection and optional wall-clock capture, per-instance request/
    actor concurrency/cooldown/finally behavior and all original error identities.
    Scope authorization precedes the same sequential bounded Forward, operations,
    Nodes, assignments, deployment, slots, retirements, leases and Probe reads; one
    clock is sampled after them. Preserve eight-Node bound, parsed Forward identity,
    row/page/tuple uniqueness, exact old freshness-reason precedence and credential/
    boot/session/Snapshot/report/clock windows, assignment driver/protocol/link/
    reservation correlation, historical lease and operation/cleanup distinctions.
    Retained Probe checks preserve context/measurement/point/current-binding order,
    raw result/body/requestId preconditions BEFORE framing, original 64-zero requestId
    and v3->v2->v1 parser dispatch with JSON per selected branch. Catch parse/framing
    failures only; body projection remains outside that catch. No staged v4/echo
    support is added. Preserve service/trust-pin/body/binding digests and all state/
    consumed/issued/expiry/measurement/acceptance/withdrawal/window checks, including
    malformed retained data and competing invalid inputs without new hardening.
    Compare same-read support aliases/traversal/order/exclusions, exact omitted raw
    identifiers/addresses/ports/pins/bodies/credentials and nested DTOs, support bytes
    before digest/freeze and full response byte guard. Preserve unknown/read-only/
    executionAuthorized:false and original partial/truncated evidence distinctions.
    The existing lower SELECT projections/arguments/order/transaction stay unchanged;
    no Runtime/Probe command, lease/resource mutation, new authority, network health
    experiment or second reader is introduced. Adapt source tooling only after later
    authorization; functional/MySQL evidence belongs in Actions on the same frozen
    revision. Entire item unexecuted; no A1/A2/foundation or upper-module gate opens.

70. Compare public/legacy StationAlerts class/constructor/defaults/methods, exact
    API/value/record/limit/storage-provider aliases, reasons and public Audit array/
    module-time error Set identity. Keep private admission/ticking state per original
    instance, clock/skew/cooldown sampling and finally cleanup. Compare closed value
    and error/refusal ordering, config/target/threshold bounds, evidence binding,
    unknown/firing/clear precedence, administrative/recovery/clock states, operation
    successor recovery proof, fresh Node baseline, instance-change invalidation,
    credential-renewal proof, episode limits and deepFreeze. Preserve command Scope/
    replay/lock/CAS/quota/fact/digest/clock/audit/receipt ordering, known-target disable
    shortcut, silence deadline AFTER replay and event-revision acknowledgement.
    Retain read auth distinctions, fixed-window filters/cursor/order/bytes/losses.
    Tick keeps unlocked due/candidate, manager auth, Scope/policy lock and latest
    revision/manager/enabled/suspension/deadline checks before evaluation. Producer
    handoff has the same policy/event/now/Tx signature. Event append, optional enqueue
    and policy state update must commit/roll back together; no nested/async handoff
    substitutes. Failure uses the original guarded revision/cutoff deferral in its
    separate Tx and resets ticking. Preserve asserted storage projection timing and
    legacy policyCount overrides; lower SQL/retention/CAS remain unchanged. No event
    or derived state becomes execution/lease/health authority. Entire item unexecuted;
    later functional/MySQL evidence belongs in Actions on the same frozen source.

71. Compare original and new lower NotificationSecretBinding/Destination/Lease/
    Secrets/SendCode/SendResult/Sender declarations, field mutability, optional signal,
    literal outcomes, method signatures and original product/flat aliases. Native
    Vault/Sender import only lower contracts; this changes no implementation/default
    or platform refusal. Preserve Linux/getuid/absolute-path and protected material
    rules, separate Authority material, immutable stage/pin/reference/read/acquire/
    release/close and physical idle/close semantics under later authorized native
    acceptance. Endpoint public/legacy constructor/API/parser/policy/storage-provider
    identity and default timing stay compatible. Preserve config/destination/body
    bounds, manager Scope auth and replay BEFORE secret availability, original
    Scope/head/CAS/quota and selected Station policy reads, clock/Authority digest,
    credential revision and durable Vault stage BEFORE SQL publish/audit/response.
    Keep rollback-orphan and old count override behavior, no eager secret read or
    destination test. Disable/read/redaction/bytes/cooldown remain original; public
    views never expose authority digests, credential refs, destination/signing bytes.
    Existing lower SQL and shared root instances stay unchanged. Entire item
    unexecuted; functional/native/MySQL/network evidence waits for authorization and
    Actions on the same frozen source, not local experiments or inferred support.

72. Compare public/legacy NotificationDeliveries constructors/options/API/product
    aliases, storage values, constants and private per-instance state/defaults.
    Handoff verifies original policy/event/time before route locks/list/validation,
    only maps route integrity failure to routingRejected, and preserves route
    selection, disabled/silence loss accounting, deterministic payload/body/digest
    order and same-Tx outbox insertion. No new event bus/authority/store. Claim keeps
    due/header/candidate then sorted manager auth -> Station -> endpoint -> outbox
    lock/order and candidate revision guard. Preserve denial precedence, recovery/
    config/actor/silence/Authority checks, expired claimed-attempt accounting, max
    attempts/event lifetime, active/rate limits, claim/revision/Fence and attempt
    writes. Preflight reacquires original owners and enforces claim/Fence/expiry/
    backwards clock/five-second margin before Sender dispatch. Acquire the original
    bound Vault lease, validate material, keep unavailable-vs-dispatch-denied result,
    send outside Tx with beforeDispatch, and retain finish revision/Fence/deadline
    guard, retry code/backoff/lifetime and terminal rules. Cover stale completion,
    auth/config/secret rotation, clock rollback, partial store failures and replay.
    Every key byte array is zeroed in the original inner finally; outer finally
    awaits physical Sender idle before lease release even on timeout/error, with
    close/stopping/running and failure-header/cutoff deferral unchanged. Preserve
    share-locked detail head/attempt tail, query/cursor/order/filter/loss/byte bounds
    and redaction, old get override hook and exact lower SQL/CAS/retention order.
    No GET sends, reads/tests credentials or grants Runtime/Probe authorization.
    Entire item unexecuted; acceptance belongs in later authorized Actions on the
    same frozen revision. No A2/foundation/upper-module acceptance gate opens.

73. Compare public/legacy ProbeRunHistoryRecorder/ProbeRuns constructors/methods,
    original API/record/capture/store/recorder aliases, policies/array mutability,
    storage callbacks/default clock and initialization on the same frozen source.
    Original permit owner supplies its exact Tx AFTER actual mutation. Preserve
    closed capture/permit/time/result checks before history Scope/head lock, missing
    non-issue head loss without recreation, immutable association and issue replay,
    issued/consumed/revoked/withdrawn/result/recovery/revision/time rules, duplicate
    result digest and rollback of history with original permit mutation on failure.
    Keep original closed/optional measurement/service/echo keys, binding/instance,
    timeout/expiry/state, TLS/echo proof/bytes/digests and freeze/size checks. Existing
    parseProbeServiceSelection now directly aliases the original parser through L2;
    validate alias identity without new selection parsing. Retained echo formatter
    keeps exact property/read order, original references, ISO inputs and nonce,
    unlike live context-to-selection projection; no clock/I/O/admission/proof changes.
    Preserve current read status-filter allowlist and staged historical echo branches
    without adding issuance/plan/filter support. Compare manager Scope auth,
    per-instance request/actor cooldown/finally behavior, now/capturedAt timing,
    canonical fixed window/cursor/filters/keysets/order/duplicates, retention/losses,
    public history/unknown/non-authorizing flags, digests and bytes. No read consults
    current permits or Runtime or recomputes captured result authorization. Original
    SQL/get override/static recovery and same root/recorder instances remain. Entire
    item unexecuted; later functional/MySQL/capture rollback evidence belongs in
    authorized Actions on the same frozen source.

74. Compare public/legacy ProbePlans constructor/options/methods, exact finite-plan
    record/config/API/receipt/issuer/store/value aliases, original Forward Probe
    command/acceptance API version/types, combined legacy history API, flags/default
    clocks/policies/array initialization. Keep three original Direct TCP kinds,
    expected Forward revision/TLS metadata, timeout/finite maxRuns/expiry/mode/interval
    and old disabled receipts; no staged echo/new issuer. Preserve preview window,
    binding/kind/point/timeout/TLS checks and clock recheck; create Scope/replay/window/
    issuer preview/digest/lock/time/head/store/respond order. Manual commands retain
    replay/CAS/retention/clock/cancel/active-manual/recovery rules. Decide keeps before
    time/expiry, creator auth and original issueIn inside existing savepoint; exact
    code/status/retryable refusal mapping rolls back/releases savepoint, while
    unrecognized/uncertain failures abort the outer Tx without new retries. Compare
    receipt/decision validation, after clock guard, decision append BEFORE head put,
    accepted/count limits and completed/permanent-suspension/expiry/next-run ordering,
    full rollback if later writes fail. Scheduled tick keeps same running-promise
    identity and stop/flag checks, cutoff before Tx, due/candidate/creator/Scope/head
    lock/revision/mode/deadline/recovery checks, expiry-vs-revocation precedence and
    original-creator issuance. Conditional header/revision/cutoff deferral remains
    separate and cannot extend expiry or replace/duplicate a decision; close waits
    for original running work. Detail/history retain share lock, exact ordered
    decision tail/count/distinct permits, manager authority, canonical windows/
    cursors/keysets/filters/retention/loss/bytes/freezing and unknown/current-binding
    flags. Lower SQL/create/get/put/append override hooks/static recovery and same
    root issuer/store remain unchanged. Entire item unexecuted; later functional/
    MySQL/savepoint/scheduler evidence belongs in authorized Actions on the same
    frozen revision. No A1/A2/foundation/upper-module gate opens.

75. Compare public/legacy NodeTelemetry/HostTelemetry class/constructor/defaults,
    exact API/sample/delta/read/store/policy aliases and initialization; wire types
    directly alias the existing contracts through L2. Preserve independent per-class
    request/active-key/read-cooldown state and error/finally behavior, original small
    input/fingerprint guard differences, disabled/parser/identity/digest/admission/
    credential/Node/session/time/head/epoch/replay/uptime/rate order. Latest exact
    replay returns original receipt time without append/rollup. Original raw append,
    optional process/host rollup append and ACK remain one caller Tx, with complete
    rollback on callback/formatter/store failure. L3 private ack stays at the same
    dispatch point; L2 receives the original sample/time and preserves field order,
    ISO/parser/freezing without clock/state changes. Keep manager/Scope distinction,
    fixed query/window/retention/record/latest order, duplicate identities, digests,
    observed-at/cooldown timing and current-vs-historical/freshness/recovery/disabled
    flags. Exact BigInt/string dropped/CPU deltas, resets/gaps/continuity and Host
    logical-CPU/availability/tick consistency/nulls remain original; do not unify or
    zero missing fields. Same lower SQL, observation pool, recorder and prune path.
    Entire item unexecuted; later functional/MySQL evidence belongs in authorized
    Actions on the same frozen source, not local native/network experiments.

76. Compare public/legacy ForwardTelemetry/ProbeTelemetry constructors/methods,
    accepted/export/record/mapping/API/policy and exact L2 wire-type aliases. Preserve
    separate state/budgets, original intake/head/epoch/replay/count/clock/rate order
    and distinct mapper signatures: Probe retains fingerprint/current now and its
    instance/source checks; Forward retains its published/retired semantics. Mapping
    is read-only provenance, not current execution/permit permission. Preserve item
    ordering, point age/recovery filtering, trusted identity/digest/Scope/source/time
    checks, freezing and exact accepted/rejected replay counts. Count-sum guard stays
    BEFORE native ACK projection at the original private method; keep original field
    order/ISO/strict parser, no extra policy/clock. Raw append -> optional accepted
    observation rollup -> ACK share one Tx and roll back together on later failure.
    Query preserves Forward/Node Scope/identity, current credential/session, raw/
    exporter metadata bytes/digest/nanosecond time rules, item/series/order/latest/
    preceding selection and original observedAt/cooldown. Baseline/historical/
    unavailable/overflowed/terminal/reset/gap/continuous precedence and exact uint64/
    BigInt strings, drop/tail/truncation/instance markers stay original. Forward
    payload and Probe attempts/inFlightBefore are distinct meanings, never synthetic
    health or loss denominators. Lower SQL/mappers, pool/prune and root instances
    unchanged. Entire item unexecuted; later functional/MySQL/rollback evidence
    belongs in authorized Actions on the same frozen revision.

77. Compare public/legacy TelemetryRollups, shared DTO/query/target/record/series/
    recorder/store types, policy/value/provider aliases, private admission/default
    clocks and legacy zero-argument SQL wrapper initialization. Preserve original
    observation metric membership, omitted nulls and paired availability, process/
    host/Forward/Probe series/identity/time/digest/context, precise counters and Probe
    conservation, Host CPU/gauge consistency and size/freeze/error rules. Fold keeps
    receipt-end minute/hour attribution, prior/current validation and clone, series/
    sequence/uptime/context/availability/overflow/terminal/marker precedence, exact
    wide sums/min/max/counts/cumulative/increments, counter resets/gaps/truncation,
    Host CPU missing/context-change treatment and interval/elapsed/boundary coverage.
    Never use sample counts as rate denominators or missing metrics as zero. Original
    lower SQL locking/cursor/bucket/retention/loss callback order, same-Tx raw recorder
    and no authority/resource/permit effects remain. Query keeps aligned bounded UTC,
    target/family/resolution, canonical cursor/series/Node restrictions, cooldown/
    Scope/target, strict row order/closed bucket/flags/loss/response and next cursor.
    Capacity keeps exact counts/logical JSON bounds, unmeasured physical bytes and
    absent Scope raw hard cap; prune/limits/recovery are unchanged. No new scheduler
    or load optimization is introduced. Entire item unexecuted; functional/MySQL/
    equivalence evidence belongs in later authorized Actions on the same revision.
    Native/physical/load/release evidence and A1/A2/foundation/upper gate stay separate.

78. Compare public/legacy ObservationServices constructor/methods, DTO/API version,
    exact config/head/revision/audit/receipt/store/reference/read aliases and L2
    native effects. Keep the same runtime-mutable as-const limit object, default
    wall-clock capture, availability flags, independent actor/request admission,
    cooldown/cleanup/finally and original bounded response/identity checks. Preserve
    manager authorization -> claim/replay -> Scope/head locks -> CAS -> prior config
    read/validation -> clock/quota decisions -> immutable revision -> head/audit ->
    idempotent response in one transaction, with rollback on later failure. Replay
    precedes metadata locks; conflicts, corrupt stored values, clock-behind-history,
    expired/seven-day windows, safe revision exhaustion, service quota including
    archived IDs and separate config quota keep original errors/order. Archived IDs
    cannot be reused; no-change publish/repeated archive and recovery re-publication
    retain status/revisions/write decisions. List/get keep exact historical config
    bounds, trust validation, lifecycle precedence, row/ID uniqueness, truncation/
    loss and read-committed disclaimers. Storage config remains a deferred assertion;
    SQL does not move full trust validation earlier. Legacy zero-argument wrapper,
    module-local provider, lazy head/count overrides and static recovery stay exact.
    No dial, signing, secret/key access, permit/Runtime authority or synthetic health
    is added. Entire item unexecuted; functional/MySQL evidence belongs in later
    authorized Actions on the same frozen source. Full foundation/physical/release
    and parallel-module acceptance remain separate unmet gates.

79. Compare public/legacy ProbeInstances/ProbeInstanceRegistry/ProbeNegotiator,
    exact machine API/version, instance/evidence/current-reader declarations and
    unchanged lower SQL values/constructors/static quarantine. Preserve input
    detach and register evidence read -> dynamic time -> instance lock -> dynamic
    time -> evidence recheck -> generation/replay/expiry/credential-bound replace.
    Lock waits cannot reuse pre-lock time; exact replay cannot renew a slot and
    replacement increments once only at expectedGeneration with counter cap.
    Revoke retains two directCapability=false checks and original state/instance
    matching, allowing credential-valid closure after TCP capability withdrawal.
    Inspect keeps read/time/evidence/stale precedence, original frozen projection
    and no reservation. Hello retains parser/identity/fingerprint/error order and
    dynamic clock inside transaction. Registry retains action dispatch/current
    view and lazy dynamic ACK clock after owner completion. No captured replacement
    default, permit/Gate/budget or new authority is added. Entire item unexecuted;
    functional/MySQL/lock/rollback evidence later in authorized same-revision Actions.

80. Compare public/legacy ProbeTypeRegistry/ProbeServiceRegistry, exact measurement
    constants/array identity and mutability, original broad echo union types,
    qualification/evidence/storage aliases and public L2 codecs. Preserve captured
    default clocks, machine/current-slot reads, exact slot identity -> optional old
    proof lock/parser -> time/evidence checks, original capability checks and
    register/revoke/inspect decisions. Replay never renews, newer/equal mismatched
    generation refuses; revoke keeps tombstones and original servicesVersion spread
    behavior. v3 requires original three measurements and may add servicesVersion=1
    to the same live original proof, without rotating instance or adding echo proof.
    v2 keeps original ingress capability and returned-qualified predicate; v3 retains
    qualifiedAt>=registeredAt and all original conditions. Future qualification,
    expired credential/slot, unavailable/malformed proof and post-transaction clock
    failures retain original errors. ACK timing remains v2 eager now then helper,
    v3 lazy callback, with no additional clock read. Lower storage parser timing,
    same-Tx write rollback and static recovery remain. Entire item unexecuted;
    later authorized Actions on exact frozen source provide functional/MySQL evidence.
    Agent/current-instance/global-budget/physical/release/foundation gates stay separate.

81. Compare public/legacy ForwardProbePlans/ForwardProbes/ProbeObservationServices,
    exact canonical plan/service/owner/permit/result types, original shallow mutable
    views and readonly/optional unions. Keep plan request defaults/closed shape and
    five-kind support distinct from three-kind command issuance. Preserve manager
    authorization -> intent parse/CAS/state -> Direct/numeric target -> authorized
    Node/non-metadata policy/capability -> published/time -> exact active assignment
    -> service resolution/target -> Snapshot/credential/service validity arithmetic.
    Resolver keeps reference -> Scope -> head/archive/recovery/revisions -> immutable
    config/digest -> captured clock/history/window -> digest -> TLS/echo-specific
    context parser order, same caller Tx and original corruption catch. Command
    request framing precedes Tx; Scope/replay precedes flags/issueCurrentIn; finite
    plans retain same-Tx notAfter narrowing; receipt/response/inspect/revoke and
    missing TLS context errors stay exact. Replay cannot recreate/renew, plan does
    not authorize Agent work and echo preview does not add echo issuance. Entire
    item unexecuted; functional/MySQL rollback evidence later in authorized Actions.

82. Compare original Probe constructors/private wrappers and L2 native child:
    numeric IPv4/IPv6/mapped unmap, zone/hostname/port/CIDR/sensitive/multicast refusal,
    exact resolver -> parse -> binding/check/expiry -> policy -> one admitted dial
    order, brackets and UDP family. Preserve fresh per-default-Executor Dialer,
    native Schedule/Entropy, explicit nil rejection, package-local fixture/zero
    defaults and single process admission/cooldown across constructors. Echo keeps
    exact context JSON roundtrip, two timestamp parses, reflect.DeepEqual nil/empty,
    request-frame validation and original product check order; no eager combined
    validation. Socket exchange preserves deadline/cancel-close, exact 256-byte
    write, UDP single 257-byte read, TCP ReadFull/short-read/EOF/trailing byte, proof
    checks and every native time.Now/check/context point. Original ErrDenied and
    errTLSBudget identity, request/response byte counts, no retries/second dial and
    caller Close stay exact. Gate burn/current-instance/Close, global budget,
    counter attempted/unknown/inFlight/drain/seal remain one owner. Entire item
    unexecuted; native/network/platform/functional evidence later in authorized
    same-revision Actions, physical-host/long-run/release gates independently unmet.

83. Compare Runner original wire/default/alias/lifecycle behavior after native L2
    extraction: exact Hello/report bytes and fields, ignored local Hello marshal
    behavior, live strict Snapshot/ACK parsing versus retained Journal JSON-only
    and locally pending best-effort partial report decode. Original corrupt-JSON/
    parse/identity/sequence errors and nil observations projection remain. Direct
    assignment before policy before engine dispatch; Relay peer identity before
    strict assignment/prepared conversion before Prepare and phase/cleanup; same
    native helpers and constructors. Keep Journal protected acceptance before
    execution, lock/ticket/context/callback/deadline points, replacement -> drain
    -> fallback, partial startup cleanup, prior/current cutoffs, 100ms independent
    guard, stop idempotence, worker cancel/wait and ACK-driven drain retirement.
    Codecs never receive state/key paths or issue authority. Entire item unexecuted;
    later authorized Actions on exact frozen source provide functional/native/
    recovery/deadline evidence; no physical/release/foundation acceptance implied.

84. Compare original private registry and native catalog: Direct/Relay/Multihop
    builtin order/metadata and legacy helper aliases, actual platform and explicit
    Relay/Multihop gating, adp.3 prefix, declaration order and first dedup. Preserve
    ingress opt-in/non-nil callback, services TLS and echo+services+UDP callback
    gates, empty/zero private registry projection and no callback execution.
    Legacy incomplete/duplicate/list/requirements/Probe prechecks stay before
    clones/index/public registry validation with original error strings and first
    refusal for multi-defect input. Typed zero-value behavior and all default CLI/
    Runner options stay original. Entire item unexecuted; same-revision Actions
    after authorization, not source declarations, must establish byte/default/error
    equivalence. Remaining engine/authority/Journal/CLI/A4/A5 work stays open.

85. Compare public/legacy ConsoleQueries/ConsoleReadModels/rules/contracts/version,
    exact class/type aliases and old mixed projection entry. Keep pageWindow
    defaults -> filter copy/freeze -> filter validation before authorization Tx;
    candidates manage=true, other reads false, diagnostics prevalidated Node and
    original projection validation/missing error. Same Tx reaches required original
    L1 store; projection callbacks remain synchronous with original null/Number/
    Boolean/JSON/time mappings. Overview currentIso and diagnostics now stay inside
    their callbacks, no early capture. Preserve mutable filter-name object/nested
    arrays/result DTOs, direct default/capability/protocol order, original flags,
    diagnostics note/age/lease rounding and maximum 50 projected failures. HTTP
    duplicate/unknown/enum/ID refusals and order stay exact. No new defaults/store/
    authority. Entire item unexecuted; functional/MySQL/HTTP evidence later in
    authorized same-revision Actions. Other query/command/HTTP/A5 gates stay open.

86. Compare public/legacy ProbePermits constructor/class/private helper/defaults
    and same original store/history/qualification instances. Preserve manager Scope
    -> global budget lock/retained+withdrawal validation/time -> same-Tx plan ->
    current/selected instance and machine -> resampled clock -> qualification and
    capabilities -> retained counts/cooldown -> minimum expiry/notAfter -> validate
    -> prune/clock/insert -> sanitized history. Keep 256 reservations/four live and
    actor/Node margin; consume/revoke/restart/new instance never refund issuance.
    Exact issued/current/consumed/withdrawn/pin/service/measurement/current binding
    matches precede original authorization; lock waits cannot reuse old samples.
    consume closes before history/view and commits before ACK; offer/check remain
    observations, no reservation/renewal. Result parser/mTLS/budget/pin/current auth
    -> result read -> resample -> measurement/permit expiry, persisted validation
    before digest replay/conflict, original acceptedAt/new checkedAt, write/history/
    persisted clock/final freshness keep errors and same-Tx rollback. inspect keeps
    synthetic requestId codec and historical checks; revoke keeps current-manager
    access after original Node grant withdrawal, consumed withdrawal replay and
    original other-state/no-write behavior. Staged echo helper/parser branches do
    not broaden original command/record construction/request union. Whole item
    unexecuted; functional/MySQL/locking/rollback evidence later authorized Actions
    on exact frozen source, independent Agent/physical/release gates remain unmet.

87. Compare public/legacy ProbeClaims/Delivery/Results and exact L2 wire helpers.
    Keep input JSON/parser then connection node/session checks; claim owner consume
    commits before dynamic native clock/identity/closedAt/expiry and ACK. Late/lost
    ACK never refunds or recreates a consumed permit. Delivery retains captured
    clock, safe observedAt/250ms/max Date bound, offer/consumed identity/state/flags
    and expiry checks; status reply does not authorize continued work. Result owner
    commits before captured-clock/acceptedAt/checkedAt/250ms/validUntil/digest and
    duplicate-type checks/ACK; a stale ACK is not ingestion rollback. Preserve all
    errors/default timing/field projections and no extra authority/transactions.
    Entire item unexecuted; later authorized Actions on same revision supply
    functional/wire/transaction/network evidence, not current source declarations.

88. Compare public/legacy ProbeTypes/ProbeServices across poll/claim/status/result,
    parser/connection identity, same original owner methods and measurement/service
    selection args. Keep v2 two-measurement set, partial descriptor shape and its
    original time predicate; v3 keeps original service set, stricter timestamp cap,
    service-selection digest and selection-before-identity-field comparison order.
    Poll measurement projection stays lazy inside exact original ACK callback,
    null offers remain null, default absent measurement stays egress. Claims/results
    commit before adapter freshness/refusal, no second issuer/budget or replay reset.
    Keep per-version output fields, maximum bounds and checks distinct; do not add
    absent legacy flag guards or a shared normalizer. Exact constructor capture,
    raw result digest, original expiry/freshness and receipt identity stay original.
    Entire item unexecuted; later authorized same-revision Actions evidence required.
    A1/A5/foundation/physical/release acceptance remains separate and unproven.

89. Compare public/legacy ControlQueries and all version1 contracts, original same
    transaction/authorization/providers and features copy/freeze/fresh-return-copy.
    Preserve Forward get -> observation status -> latest Operation -> metadata order,
    deployment/revision Forward resolution, Operation null/Boolean/unknown fields
    and original identity/not-found errors. Required read ports/stores remain same,
    with no authority or executable handle. Entire item unexecuted; functional/
    MySQL evidence later authorized Actions on exact frozen source.

90. Compare public/legacy TransportQueries/TransportReferenceReadModels/API, same
    required metadata/reference store/values and optional resolver. Preserve copied
    frozen query/paging, targetRevision presence as manage flag, metadata/current
    revision integrity before resolver identity/revision validation before reference
    reads. Projection callbacks keep JSON/Boolean/null count/revision fallback; page
    counts/duplicates precede per-spec/path/Profile identity checks. Keep proposed
    spec, deepFreeze, all original non-authorizing flags and tail dynamic zero-arg
    new-Date ISO through currentIso at same return position, not a captured or
    Date.now replacement. Same-Tx reads and later refusal/format errors unchanged.
    Entire item unexecuted; same-revision functional/MySQL/HTTP evidence later Actions.

91. Compare public/legacy TunnelQueries/TunnelReadModels/API, exact mutable fields,
    captured default Date.now function versus explicit clock, original synchronous
    raw projection callbacks. Keep auth -> node/notFound/integrity -> single now
    -> endpoint/revision/config parse narrow catch -> peers(now) -> bounded window
    projection; references auth/node before rows and original paging/spec/path-role
    checks. Preserve four peers/two windows, duplicate fingerprints, credential and
    peer revocation/expiry intersections, ISO/age bounds and open-first selection;
    health/network/certificate/deletion flags remain unknown/not-performed/not-proven.
    Old mixed read-model entry retains original version/three class aliases; no new
    time samples/providers/reservation. Entire item unexecuted; later authorized
    same-source Actions for functional/MySQL/HTTP and rollback/refusal evidence.

92. Compare public/legacy AccessCommands/API/effects, five original required args,
    effects rejection, member snapshot/validation/revision-zero/token omission and
    exact original SHA256 tokenHash alias. Request identity includes tokenHash,
    never bearer, same actor/Scope/key/path/shape/timing. Owner authorization remains
    before claim/replay, then original member/Node grant writer -> effects -> changed
    202/nochange200 response -> receipt in one Tx. Replay skips original side effects,
    nochange still invokes original effects. Runtime effects old type aliases and
    same reconciler instances remain; later effects/ISO/receipt failure rolls back.
    Preserve truthy null/zero/positive/negative maximumAuthorization +5000 formatting
    and exact response fields. Entire item unexecuted; authorized same-source Actions
    needed for functional/MySQL/hash/transaction evidence, no new Identity authority.

93. Compare public/legacy NodeManagementCommands/API/effects, exact required args,
    Node ID -> policy/revoke snapshot -> original request method/path -> same-Tx Scope
    manage -> claim/replay -> applyManagement -> reconcile -> audit -> 202/receipt.
    Keep closed policy/array clone/freeze and all original validators/defaults.
    Audit retains raw numeric maximumAuthorization and kind/details, response uses
    original truthy +5000/null ISO rule. Replay before writes/effects/audit, all same
    Tx and rollback on later audit/format/receipt failure, same Runtime reconciler.
    Exact original public codec/request/ISO aliases, no new Node/Runtime authority.
    Entire item unexecuted; later authorized Actions on final frozen revision.

94. Compare public/legacy NativeDrivers/API/version, direct original catalog/digest
    L2 alias identity and nested descriptor readonly/object identity. Keep constructor
    flag order/false defaults, same authorization Tx, catalog descriptor order/spread,
    multihop controlEnabled predicate, probe flag and all non-authorizing/evidence
    disclaimers plus final deepFreeze. No platform/Node capability inference. Entire
    item unexecuted; later authorized same-revision Actions for contract/HTTP behavior.

95. Compare public/legacy NativeTunnels/API and exact Path template/binding/Forward
    command API leaves/constants, preserving mutable/readonly declarations. Keep
    four constructor collaborator order/no new defaults, singleton management object,
    list/get call-and-spread, config.nodes topology order/roles/prior endpoint/null
    ingress and final deepFreeze. Six forwarding methods retain args, receiver and
    direct result identity; canonical request digest/durable receipt/authorization
    is the original Path/Forward owner across both API names. No extra async/Tx,
    /tunnels command identity, stored state, schema/authority or feature. Whole item
    unexecuted; later authorized frozen-source Actions, not API movement, proves it.
    ForwardCommands actual coordination and full HTTP/source classification open.

96. Compare original private Runner newExecutionRegistry and lower legacy functions:
    header checks original native metadata and actual private callback nil flags
    BEFORE wrapper creation; original duplicate-ID check BETWEEN header/declaration;
    same list/name/requirements/Probe rules and first error strings; same clones,
    private map/order and public strict registry LAST. Test multiple defects/duplicate
    fixtures/empty lists/nil callbacks/aliases and original builtin metadata/capability
    projection on same frozen source. No constructor normalization, second registry,
    selection/authority/default change. Entire item unexecuted; authorized Actions
    later supply error/default/lifecycle evidence; full A4/A5 remains unaccepted.

97. Compare original echo Runner target path and explicit native echo destination/
    ingress functions, preserving business match/public address before destination
    CIDR, observed parse -> zone -> unmap -> port equality -> protocol -> public
    address -> policy -> port bounds, distinct from non-echo ingress semantics.
    Parent retains all feature/service/challenge/instance/driver/callback/trust and
    current-binding/deadline checks, ErrDenied and detached execution comparison.
    Existing context marshal failure exits before Now; context parse failure still
    samples Now before refusal, so no eager combined parser/time normalization.
    Preserve same lock/current instance callback and Gate/global budget/authority/
    Journal. Remaining JSON/body/wire/time source chains stay explicit blockers.
    Entire item unexecuted; native/network/platform and lifecycle/physical evidence
    remain later separate authorized same-revision Actions/independent-host gates.

98. Compare public/legacy Profile grant class/API/default effects requirements and
    exact frozen command/request. Digest keeps original {method,path,expectedRevision,
    allowed} shape and same nativeValueDigest, never a new generic request envelope.
    Validate actor/Scope/Profile/subject/key/revision/Boolean in original order, then
    same-Tx owner -> claim/replay -> applyGrant -> changed-only reconcile -> 202/200
    response -> receipt. Unchanged does not reconcile; replay skips side effects.
    Same providers/Tx and later failure rollback, exact response/port/type identities.
    Entire item unexecuted; later authorized same-revision functional/MySQL Actions.

99. Compare public/legacy ForwardCommands constructor/private methods/API and exact
    original operation/preparation aliases. Required method checks/optional providers
    remain. Ordinary create/update/remove/retry keep read-auth -> replay -> manage;
    create replay also reads Forward record; Path/Group keep manage before replay.
    Create ID/preparation/insert/plan/operation/capacity/binding/receipt order exact.
    Update prepares before changed-revision branch, only changed revision writes
    spec/authorizer/plan/operation/capacity; same-revision path provenance can change
    without restart. Preserve metadata preserve/detach/accept order and status/body.
    Remove execution lock precedes CAS/exhaustion, then deleting/operation/capacity/
    receipt. No new queue/ledger/table owner. Entire item unexecuted; later authorized
    same-source Actions establish error/transaction/rollback/compatibility behavior.

100. Compare original Forward Path/Group/Ingress/publication preview/apply/update/
    inspect/compensate methods under same supplied Tx, exact parse/manage/current
    metadata/digest/provenance checks, no nested Tx or inner receipt (respond=false).
    Keep same ingress Node/protocol and path/Profile-only migration restrictions,
    original resolved template/group equality and expanded-spec digest. Restoration
    authorization precedes original selection checks; preserve optional resolveCreateIn
    or original resolve fallback instead of forcing a new provider. Current Group/path
    detach precedes topology replace only at original points; immutable history stays.
    Later capacity/provenance/error must roll back original Tx; no preview reservation
    or global batch atomicity added. Entire item unexecuted; authorized Actions later.

101. Compare original retry sequence: Operation reference -> current Forward lock ->
    execution lock -> Operation reread -> recovery/revision/status refusal -> retry
    preparation -> authorizer -> source-linked Operation -> capacity -> receipt.
    Multi-defect first-error behavior, source previous_spec/id, exhausted/recovery/
    superseded/nonfailed cases and replay remain exact. Same root Runtime implementation
    satisfies canonical Forward port without copied logic/authority. Entire item
    unexecuted; later exact-source authorized MySQL/lock/rollback/contract Actions.

102. Compare public/legacy NodeObservations/observeNodeReport/API/limits/types and
    unchanged raw L1 aliases. Same bound reader receiver, policy clamp/freeze, closed
    input validation before cancel/admission, instance-local actor/Node/global budgets,
    cooldown and byte bounds. Timeout/cancel reply must retain capacity until owned
    work settles; dedicated MySQL connection/guard/auth/read/abort-destroy/rollback
    remains original. Dynamic monotonic/wall/JSON bytes/ISO call sites stay exact.
    Original native controller/timer create/schedule/clear keep dynamic global lookup,
    callback/delay/handle and finally clear-before-listener-removal. Preserve original
    Promise.race/error masking/listener cleanup, malformed/null raw validation, bounded
    provenance copy, reason precedence/expiry intersections, stale versus unknown and
    unknown health. No active network/Runtime authority. Entire item unexecuted;
    later authorized same-source Actions for MySQL/HTTP/cancellation/late-work behavior.

103. Compare extracted RelayPlans with original root planRelay behavior: parse spec
    then path/Profile refusal before Tx/manage auth, exact preview Forward id/revision/
    forced enabled, same required provider/receiver/Tx/result union/error propagation.
    Root keeps original async public method and assembles one required service after
    original RelayCoordinator; no fallback, new planner/reserve/ledger or tightened
    literal response flags. Existing raw Node read ports contain declarations only,
    no platform/product implementation imports. Entire item unexecuted; later same-
    revision authorized contract/HTTP/MySQL Actions; lower Relay/A5 still open.

104. Compare original Probe HTTP paths with L2 request/read/error/Parse+Check leaves:
    exact 4096/4097 and original services/echo poll 32768/32769 response bounds, 4096
    request limit, invalid large-limit/path refusal before provider work. Reader error
    retains identity and precedes oversize/status even with partial bytes; error JSON
    best-effort preserves partial Code, no strict-success fallback. Caller Close/defer
    remains original, including late claim return under mutex. Delivery work.Err before
    status, instance after Parse+Check, claim original late locked stage, negotiation
    after original server-time parse. Poll prevalidation Marshal+Parse and actual
    exchange Marshal remain two original points. Claim ID stays burned on every
    I/O/parse/status/time/currentness failure; same HTTP/socket budgets/Gate/receipts.
    Entire item unexecuted; authorized same-source native/network/functional Actions
    later; independent physical-host and whole A3/A4 acceptance still unverified.

105. Compare original v2/v3/v4 result private functions and native wire helpers: same
    machine/kind/version/field/null projection -> JSON marshal -> strict per-version
    ParseResultRequest/error order, bytes/digests without v1 downgrade. Parent family/
    descriptor/Point/service/TLS trust/proof/status/code and exact256/256 evidence
    refusals precede projection. v3 supplied scheduler.Now remains at original trust
    creation; native wrapper/injected schedule stay distinct. v2 no service/TLS/echo;
    v3 real service/TLS with zero payload; v4 real Service/Challenge/Echo and original
    byte sum/omitted TLS. No helper reads clock or takes receipt/Guard/Journal/authority.
    Original report-once/budget/receipt/current-instance/deadline/ACK/final checks stay.
    Entire item unexecuted; later authorized exact-frozen-source Actions plus separate
    physical/release gates, no current behavior/contract/whole-source acceptance.

106. Compare original HTTP and public native helpers on the same frozen source:
    absent/empty body, every route limit and limit+1, split multibyte chunks,
    reader/release/decode failures and finally release-before-fatal-UTF8 decode;
    no cancellation or content-length fallback. Preserve native TLS type/authorized/
    certificate/fingerprint refusal order and telemetry's four no-machine-lookup
    paths. Preserve ControlError identity, message-prefix evaluation, native malformed
    JSON mapping, exact code/status/retryable/body fields. Compare every explicit
    console asset byte, same relative URL directory, repeated read/read failure,
    security headers/status/content type; revocation timestamp/null post-owner.
    Original middleware/lifecycle/maintenance/health/optional admission/authentication,
    route arguments and positional createApp wrapper stay equivalent. Entire item
    unexecuted; later authorized Actions, no HTTP/browser/native evidence now.

107. Compare canonical/legacy Path classes, complete APIs/contracts/limits/validators
    and constructor defaults on one frozen revision. Template identity/parse/page/
    head/revision/archive/CAS/refusal/quota/audit/receipt order; binding same supplied
    Tx/no inner receipt, exact selection/current/history/contiguous 64 sequence,
    unchanged path without clock, archived/recovery/unsupported reasons and tail
    observedAt. Group sorted access then original priority order, passive/actor error
    distinctions, egress/ingress/protocol invariants, exact path sequence/provenance.
    Publication sorted Forward access then input positions, creator/recovery before
    replay/CAS, original savepoint/outcome/receipt order, immutable attempts and
    conditional compensation/Operation projection. NativePathReferences uses same
    Tx/receivers, sorted Nodes -> Profile -> sorted Endpoints and exact first errors;
    public/legacy Node types, class and limit identity/mutable/frozen shapes match.
    Entire item unexecuted; later authorized exact-source contract/MySQL/HTTP Actions.

108. Compare canonical/legacy complete Ingress classes/APIs/contracts/local limits:
    member sorted reads versus requested/input order, distinct Nodes/common protocols,
    active/archived/revision/digest distinctions, quotas including archived records,
    captured clock/newId defaults and same-Tx public Path/Forward collaborators.
    Deployment origins stay exact historical accepted creates, with recovery and
    compensation eligibility. Migration origin/Forward sorted reads, definition diff,
    explicit add/update/remove and no silent rebase; lineage rechecked at apply,
    add deletion/update restoration and irreversible remove preserved. Creator and
    recovery isolation precede replay, then original CAS/savepoint/append/receipt,
    cancellation and attempt errors remain. Original cyclic resolver callback,
    non-atomic/unknown-health/physical-sharing flags remain. Entire item unexecuted;
    no new feature or proof of A2 closure from class relocation.

109. Compare original Probe v2/v3/v4 qualification/poll/claim and v1 status with L2
    helpers: machine/version/descriptor/service/challenge fields, JSON and strict
    Parse/Check bytes/error order. Request ID still reads exactly 32 entropy bytes,
    ignores count as before, hex-encodes and propagates errors at original points.
    Claim projection before burn, encoding after burn/deadline before admission;
    prevalidation and actual exchange encoding remain separate. Both qualification
    timestamps parse even if first invalid; native service context retains Marshal
    -> Parse -> Unmarshal -> native Now -> Trust creation and error sequence, with
    no new scheduler propagation. Preserve cancellation/Guard/freshness/currentness,
    replay/global budgets/Gate/receipt and v1 publish/watch/close/drain. Echo target's
    distinct JSON-fail-before-sample/parse-fail-after-sample ordering stays untouched.
    Entire item unexecuted; later same-source authorized native/network Actions and
    independent physical gates, without current A3/A4/source acceptance.

110. Compare original Runner drain/report fields, UTC offsets/nanoseconds/zero time,
    nil observations/empty drains, original map iteration and Remaining/ticket/Close/
    ACK behavior. Original poll sample supplies ObservedAt. Snapshot ValidUntil parse
    precedes IssuedAt, both after identity/history and original now sample; dual
    invalid fields keep first raw error, Guard remains later. Compare Machine/Relay
    two-field request bytes, request key/ID/fingerprint prefix and renewal omission,
    malformed expiry before renewal, equal/later renewal errors. Provider validation,
    historical expired identity, single retry flag, short-circuit Now sample counts,
    overlap bounds, Save/Remove/reload/mutex/current publication remain exact. No
    helper reads authority/clock or persists history. Entire item unexecuted; later
    authorized exact-source Actions, physical/release gates remain independent.

111. Compare original v2/v3/v4 status field construction -> Marshal -> strict Parse,
    then exchange's original second encoding -> Parse/Check response. Exact version/
    descriptor/service/challenge/receipt fields and errors precede original parent
    equality, freshness, local-watch, CheckedAt/ServerTime/cancellation/publish.
    Compare all four result ACK families and original report-once before dispatch,
    local/I-O/ACK/final authority errors without retry/refund. Generic result values
    preserve fixed three-digit timestamps, elapsed rounding, binding/identity/flags,
    original legacy parse predicate even for echo, entropy/error and first/last Now
    order, millisecond quantization/uncertainty/inverse safe cutoff. Native helper
    never receives live authority or clock. Entire item unexecuted; later authorized
    same-source native/network/contract Actions, not current A3/A4 acceptance.

112. Compare Probe native ParseEchoContext composition and Control's separate
    encode/decode stage signatures/errors. Encode error returns before Now; decode
    error still samples Now before original refusal. No combined decoder or clock
    callback may change that order. SameEchoExecution retains parent nil checks and
    original reflect.DeepEqual for nil/empty/protocol slice/value differences. Keep
    all product purpose/validity/digest/protocol/endpoint/driver/actual-ingress/current
    instance/Check/deadline checks at original points. Entire item unexecuted; no
    new echo authority/protocol/feature or physical evidence from this source move.

113. Compare all old query exports/public canonical functions and exact structural
    return types, names, fresh mutable objects/key insertion and optional undefined.
    Console duplicate/unknown before owner filter callback before pageWindow; same
    map reference/kind/filters and thrown error. Profile/detail revisions retain no
    new64 ceiling, Path reference and Observation retain64; canonical decimal/counter
    refusal exact. Group targetRevision presence refuses before underlying parsing;
    Ingress pagination before group ID, aggregate own-property/nonempty/Object.assign
    distinct from getAll duplicate parsers. Cover every family empty/unknown/duplicate/
    encoded key order, ProbeRun resultStatus and original first-error/text. Business
    query auth/Tx/limits remain unchanged. Entire item unexecuted; later authorized
    same-revision contract/HTTP/browser Actions, not whole HTTP/A5 source acceptance.

114. Compare shared ParseWireTime and legacy ParseProbeWireTime raw RFC3339Nano
    results/errors for invalid/offset/fraction/zero values at original call sites.
    Qualification pair always parses both; Snapshot stops after invalid validity;
    Relay schedule expiry before optional renewal with original mapped errors.
    Hello setup/identity/Guard init/diagnostics precede parse then Guard validation.
    Relay post-provider expiry reparse remains even when retryExpired false, with
    original short-circuit Now counts/history/remove/retry and overlap parse-error
    before conditional Now bound, until/renewal checks. No stale earlier parsed
    value reuse, hoisted sample or new callback/provider. Entire item unexecuted;
    later authorized exact-source evidence required, physical/release separate.

115. Compare original/public Forward executor, registry, native factory and full
    authorization/resource/Relay/adapter declarations and exact old aliases. Same
    fifth-argument default evaluation, catalog length/descriptor/version/duplicate/
    six-method order, bound receiver/frozen registration and direct/relay/multihop
    selection. Direct authorize/lock/fakecompile/reserve/realcompile; update lock/
    validate/same-revision return or transition/compile; path sorted auth/lock and
    enabled/canExecute refusal/plan differences. Node move old-state read then
    recovery/revoked refusal/sorted locks, retry authorize/lock/conditional transition,
    explicit capacity preserve same Tx/error order. Entire item unexecuted; later
    authorized exact-source contract/MySQL Actions, no new driver/ledger/authority.

116. Compare original/public Profile/Access/Node reconciliation classes and effects:
    Profile allowed short circuit/lock/transition/accept/capacity; member candidate
    lock+reread/scope/deleting/authorizer and allowed-disabled capacity; grant path
    filters/node collection and unconditional validateNode even when unchanged.
    Node facts/scope/lock/sourceActor/policy-only allowed, denial after accept,
    policy-only whole-Node capacity and revocation acceptance. Preserve affected
    node iteration/max cutoff, operation/result order, callbacks/receiver and original
    caller transaction rollback. Entire item unexecuted; no source declaration
    proves behavioral equivalence, independent physical/release gates remain.

117. Compare complete canonical Node management/grant types and legacy exports,
    original AuthorizedNodeFacts alias, readonly/mutable fields/union/writer/audit
    vocabularies. All canonical Node services/commands/policy/API/effects use local
    leaves; consumers use public declarations. Existing Control constructor/default
    callbacks and L1 host/store instances are unchanged. Record actual old Runtime/
    Node test-source consumers and migrate/remove bridges only after same-source
    compatibility evidence. RuntimeHost default clock/Date formatting remains an
    explicit independent source debt, not accepted by these aliases. Entire item
    unexecuted; later authorized same-frozen-source acceptance, not whole A5 closure.

118. Compare original/public Snapshot registry and Relay source class/constructor/
    prototype/readonly contracts and exact old aliases. Module native roles, full
    source ID/driver/role ownership validation and error precedence, bound collect
    receiver, declaration/registry freeze/source-ID sort remain. Direct clone/freeze
    before first await, each contribution shape/clone/freeze before next source,
    assignment/logical/physical conflict order and final assignment-ID sort match.
    Native clone dynamic lookup/errors, same tx/context/includeAccepted, original
    deferred Relay callback/constructor timing and one collector/ledger remain.
    Runtime directory source table is declarative only: later authorized boundary
    acceptance must cover actual value/type/default dependencies and all consumers,
    not waive whole packages or infer full A5 closure. Entire item unexecuted.

119. For FR-0002 host interface2 compare explicit/native clock and time codec,
    missing/wrong-kind now/parse/format refusal before host policy/clock/store calls
    and exact Error text. Existing RuntimeController constructor supplies dynamic
    Date.now lookup; custom codec methods preserve receiver/errors. Compare zero/
    offset/fraction/invalid/NaN/infinite time values and original ISO/parse behavior,
    every prior hold/reuse/authority/report-freshness expression and short-circuit
    sample count/order. Preserve stale claim, lock/credential/boot/capability,
    authority issue before Snapshot save/lease recording, report replay/fencing,
    transaction rollback and wire/data formats. Record intentional refusal of old
    direct-host/custom-codec callers and migrate all actual consumers on one frozen
    revision. Entire item unexecuted; source authorization is not acceptance.

120. Compare explicit original Runtime query/telemetry type bridge exports and all
    public/legacy generic/mutable shapes, plus Transit public resolver type. Record
    constructor versus module-time versus per-call native defaults/instances for
    RuntimeController/Ledger/Relay and all Transit wrappers. Preserve callback
    receiver, static recovery, same supplied Tx, module-local reservation service
    and per-call versus retained service construction. Actual old source consumers
    and later bridge removal need same-source acceptance, not a wildcard exemption.
    Entire item unexecuted; full A5 source/type/default/consumer inventory remains.

121. For FR-0003 background interface2 compare explicit effects and native legacy
    construction, aggregate validation before missing-effects refusal, individual
    declaration error order, provider receivers, no constructor sampling/scheduling,
    native dynamic function lookup, deferred first tick and original interval order.
    Compare disabled/repeated start/stopped restart, independent active promises,
    run microtask timing, active/stopping short circuits, exact monotonic samples,
    rejection backoff through count16/max cap, no-delay failure, success reset and
    throwing onFailure. Cancellation stays once after success and retryable after
    throw; repeated close shares original promises, settles onStop and active work
    before reporting sanitized failures. Compare server's original five declarations,
    worker flags, authority/serial retention and partial HTTPS startup/normal request
    drain/dependency-close order. Legacy name/inherited methods remain, but native
    wrapper and direct host are intentionally different constructors. No new queue,
    second lifecycle or native L1 timer/time type. Entire item unexecuted.

122. For FR-0004 Ledger/Relay/Node authority interface2 compare required time-method
    refusal and first-error precedence before clock/I/O, native/custom receiver/error
    identity, invalid/NaN/infinite/zero/offset/fraction parse/ISO behavior. Ledger
    capacity formats after original awaits using its original early sample; draining
    parses only with a truthy lease, completion keeps report/snapshot/deadline and
    both Now short circuits. Relay status keeps receivedAt-zero null and post-isolation
    authorization format, plan formats after reservation with separate store samples,
    observed parses at original post-read expression. Node replay precedes sign and
    formatting, post-sign authority recheck stays; response formats after credential
    writes before replay/audit in one Tx and errors must roll it back. Provision
    formatting is after commit, so its error does not roll back provision; Node view
    keeps truthy until/retireAfter, pending-revocation sample/map order inside Tx.
    Preserve original Ledger/Relay/Nodes constructor defaults and captured clocks,
    static recovery, locks/fences/cleanup/credential lifetime/wire/data. No second
    authority or history reset. Entire item unexecuted; exact-source Actions later.

123. Compare common public/legacy ControlError/invalid/notFound and RequestLifecycle
    object identity, six explicitly named application port type signatures/generics,
    existing command digest/validation/error order and no extra side effect from
    entrypoint migration. Compare request finally/drain even on application failure
    or socket disconnect. Complete actual alias consumers/removal requirements and
    transitive source/type/default inventory. Nine listed L1 shared/runtime type
    dependencies and Relay profile derivation remain debt; a raw inventory declaration
    or another alias is not acceptance or a dependency-direction fix. Later authorized
    boundary coverage must classify all remaining files and reject forbidden/private/
    unclassified references on one frozen source. No broad shared-type allowlist or
    full-A5 proof from this bounded source doc. Entire item unexecuted.

124. For FR-0005 compare old/new Policy's thirteen required mutable number fields,
    public policy entry/version, framework export and old types/shared/runtime/index/
    legacy aliases. Confirm native DEFAULT_POLICY object/frozen values/property order
    and original host constructor copy/default/validation/sample timing. Cover source
    declaration/tool/private-path augmentation consumers, not only compiled imports.
    New precise L1 leaf must have no native parser/format/default dependency; no broad
    contracts-package exemption or duplicate Policy. Host interface versions remain
    unchanged by this exact structural relocation. Entire item unexecuted.

125. For FR-0006 compare original Observation/Drain/Condition fields, required/mutable
    arrays, nullability and three-phase plus absent unions across new lower entry,
    legacy Assignment, ReportRequest and original runtime/index/legacy paths. Compare
    public version/export resolution, native wire validation, report sequence/body
    digest/fence/phase matching, lease/drain/removed checks and same-Tx rollback/replay.
    No protocol/schema/default/unknown-input refusal change, generated artifact update
    or full wire ownership claim from value aliases. Cover source-text/augmentation
    consumers and unique canonical declarations. Entire item unexecuted.

126. For FR-0007 Relay interface3 compare time-method refusal before new projection
    refusal before policy/options copy, native/custom method receiver and unchanged
    old RelayCoordinator constructor/defaults/static recovery. Views return original
    config/hop references without cloning/freezing/eager normalization/validation.
    Cover malformed/getter/throwing config/hop/path/binding at original access/first
    error points, nested some/every/filter/map, missing Node/session/policy/CIDR/peer
    short circuits, exact digest and conditional per-peer Now/skew evaluation. Pins
    collection stays after original facts/credentials I/O, Set/refusal/minimum bound
    unchanged. Same-Tx auth/publication/refresh/cleanup and protected history remain.
    Boundary acceptance must remove native config type/cast dependencies while still
    reporting unresolved RuntimeAssignment/Messages/Snapshot/Profile debt. All cases
    planned/unexecuted; native format views do not become an authorization owner.

127. For FR-0008 compare common execution values and old/native declarations field
    by field, required/mutable/optional/null unions, protocol2/3 and executionExtension
    fields, driver ID/schema/config closure, native contribution declarations and
    public/legacy package exports. One canonical common field set must preserve
    native type shape; family snapshot assignments must retain the selected driver
    type through stores/compilers/ledger/sources. Common default exposes no native
    envelope/config. Cover source-text/declaration-augmentation consumers and no
    duplicate schemas or native defaults in the lower leaf. Entire item unexecuted.

128. Compare required machine codec method refusal after time/clock guard before
    policy validation/constructor Now, then hello native protocol -> foreign Node
    -> native capability refusal with original exact Error class/code/text and
    includes/getter short circuits. Hello projection keeps boot getter, single
    format/Now and policy copy after original boot/history/state operations. ACK
    projection keeps digest/prior lookup, boot/sequence/status/key order, allocation
    before duplicate integrity check and duplicate return. Native methods add no
    parsing/validation/sample/clone/freeze. Compare all existing hold/reuse/claim,
    authority-before-save/lease, replay/fence/error/Tx/drain/cleanup behavior on the
    same frozen source; direct/custom codecs without methods intentionally refuse.
    Entire item unexecuted; no runtime generic family/protocol negotiation is added.

129. Trace every actual native specialization: three old wrappers, native codec/
    compiler/Snapshot input/Relay plan, MySQL state/ledger/Relay, Forward registry/
    source, Probe evidence store/contracts, HTTP app/ports and old Runtime snapshot/
    query/relay aliases. Compare constructor arguments, policy/resources/default
    function capture, static recovery/prototype/instances, receiver/sort/clone timing,
    exact wire JSON and same supplied Tx/lock/SQL/authority order. Test/tool callers
    need exact-source coverage; a source search or old pass is insufficient. Record
    remaining native Profile/transitive config and broader A5 debts without waiver.
    Entire item unexecuted; Host3/Ledger3/Relay4/evidence2 are source candidates only.

130. For FR-0009 compare common opaque Profile default with explicit native family
    payload, old ResolvedProfile/View/Resolver/multihop/Transit/codec aliases and the
    original closed mutable/literal Profile fields. Preserve generic transport/
    compiler/input/configuration correlation, public versions and source/augmentation
    consumers. Lower ports must not import or duplicate native schema. A named type
    migration is not full framework/repository boundary acceptance. All unexecuted.

131. Compare native Profile parse/JSON/digest/freeze/resource/Relay/multihop/Transit
    argument and first-error order, original Transport/Endpoint owner scope/replay/
    revision/grant/read/write and same supplied Tx/SQL/authority. Explicit native
    aliases retain existing wrapper constructors/default clocks/UUID/static recovery
    and provider lifetimes. Endpoint's method bodies/module1 do not add formatter
    invocation or guard; dependency codec selects native configuration2. Wire/driver/
    security/schema/data versions and actual payloads stay original. All unexecuted.

132. Compare Transport formatter-required construction refusal before provider effects,
    method receiver and native/custom output/error. get auth/current revision/record/
    decode/parse/digest precede format at original response property inside Tx; format
    failure retains original rollback/error outcome. Cover zero/fraction/invalid/NaN/
    infinite timestamps, native ISO/RangeError, no extra clock or normalization,
    unchanged publish/grant/replay/list/default responses. Values2/Relay5/config2/
    Transport2 are source candidates only. Entire item unexecuted.

133. For FR-0010 compare constructor overlap/lifetime -> time formatter -> four native
    method guards and required-method refusal before time/I/O. Compare token type/
    alphabet/31/32/128/129 and CSR type/size/prefix with original three caller-specific
    invalid errors, isId/token/request/digest short circuits and no new crypto parse.
    Node/Scope/listener/port precede native adp/direct checks; preserve separate facts
    capability getter reads, Forward protocols/target afterward and provider receiver.
    Fingerprint prefix uses original template/coercion/error and map field order,
    with no validation/hash/normalization/sample. Entire item unexecuted.

134. Compare complete native Node enrollment/replay/digest/token hash/sign/post-sign
    expiry and rotation/Relay current credential/overlap/idempotency/read/write/save/
    audit/rollback in original Tx and lock order. Predicate extraction must not grant
    authority, bypass signer validation, expand native capabilities or change lifetime/
    resource/session/grant/network policy. Original Nodes constructor/default captured
    clock/static recovery and one authority/Journal/high-water remain. Node interface3
    missing custom methods intentionally refuses. All cases planned/unexecuted on
    current source; physical/release gates remain independent.

135. For FR-0011 compare original Hono Bindings/Variables/result and all four aggregate
    service/options types through named L2/L3 public entries; old function/type aliases
    and positional createApp order/undefined services/default requests. Server must
    pass the original collaborators without extra app/service/state construction.
    Keep Hono native import on its separate public transport entry. Source consumers
    and existing boundary tooling require later adaptation; none run now.

136. Compare native session header empty/zero/sign/whitespace/decimal/overflow and
    Core counter bounds, Number conversion/throw stages and original409. Compare
    exact Console header values/order/receiver and subsequent per-request asset IO.
    Compare Probe withdrawal absent/null/non-number/number/getter/ISO errors and
    id/state/false/time property order after successful owner revoke. Query functions
    must retain fresh original URL evaluation, search versus params.size, duplicate/
    encoded/empty behavior, original exceptions and no new early guard. Unexecuted.

137. Compare original route registration, field/body bounds/error precedence and
    middleware: requestId/no-store, optional requests.run, maintenance/health, optional
    family admission then cookie/bearer identity, Service Probe query then TLS and
    four machine-lookup exclusions. Compare Transit boot-before-epoch/body, disabled
    services, unsupported protocol/error/notFound framing and same owner Tx/replay/
    identity/resource refusals. Verify socket disconnect does not complete lifecycle,
    startup failure cleanup and stop admission/drain/dependency-close order. Functional
    HTTP/MySQL/browser/network evidence needs later authorized Actions on frozen source;
    no physical-host substitution or foundation acceptance is claimed.

138. For FR-0012 compare executionstate interface2 method sets and custom providers:
    nil refusal before lock; authenticated reload and full stale-caller comparison
    before input; extension gate before SupportsProtocol and Node/history checks;
    false-protocol short circuit, equal generation before prior decode/key/save.
    Preserve original prior/session/assignment/key/Fence/immutable-owner/resource/
    phase/tombstone/max/save/release/error sequence. Native codec adds no clock/I/O
    or fallback; a non-native pure format should demonstrate no hidden ADP text in
    these host decisions. Complete original native validation remains required.

139. Compare canonical physical and literal-TCP slots/drain tuple bytes for original
    protocols/IDs/zero/max uint64 without new escaping/normalization/bounds; original
    Runtime initialized/fallback envelope fields/order/references and JSON tags.
    Cover loader/I-JSON/unknown fields/Node/outer-inner/HMAC/fence/port bounds, explicit
    migration/import overlap/digest and read-only inspector. Runner retains old guard/
    ticket/pending-report checks, single Journal persistence before first bind/replace,
    same mutex/map/write stages and deadline clipping. Duplicate drains and lost/stale/
    removed ACK preserve Ticket/tails/map/pending state; no reset/refund/new authority.
    Functional native/persistence evidence needs later authorized exact-source Actions.

140. Compare original feature dependency checks before native URL prefix refusal and
    Bootstrap effects afterward; exact case/empty/malformed/user/query/fragment text
    behavior and error without a new parser. Compare snapshot GET path/base10 uint64,
    request body/header/retry and legacy httpError type/As/text. Retain default and
    explicit constructors/providers, separate Auxiliary URL checks, offline Transit
    historical/active/draining physical refusals and absence from deployed Run/poll.
    All cases planned/unexecuted; full external-type/metadata/consumer inventory,
    foundation, physical-host, long-run/example/backup/release gates remain separate.

141. For FR-0013 compare lower tagless facts Snapshot []byte/FormatVersion/
    ImportedHistoryDigest and native canonical Journal/RuntimeJournal original fields/
    declaration order/tags/RawMessage. Native/lower identity is intentionally distinct;
    migrate direct assignment/reflection/serializer assumptions and Bootstrap/provider
    interface2 consumers. Round trip nil/empty/invalid raw values, len/cap/backing,
    maps/extension pointers/zero/nonzero metadata with no cloning/default/validation/
    encoding. Lower facts do not promise the original JSON format or a native fallback.

142. Compare exact original native JSON payload/envelope/MAC bytes, RawMessage null/
    empty/invalid behavior, omitempty and field order. Cover loader I-JSON/strict/
    Node/version/extension/outer-inner/fence/port validation and first errors; atomic
    write/locks, equal generation, imported high-water and read-only inspector.
    Protected Relay and offline Transit continue their original native records and
    codec, with no Runtime facts conversion of unrelated secrets or history reset.
    Planned/unexecuted; later native/persistence evidence requires authorized Actions.

143. Compare original host lock/load/stale/input/extension/protocol/history/save/
    release/error sequence. Native AcceptRuntimeSnapshot returns original current
    and exact error on refusal/save failure; success preserves fields/references.
    Native store and Bootstrap project returned values/errors once at old boundaries;
    Runner still returns on errors before successful conversion and retains feature/
    proof/root/key/load/extension/credential/enable/client order. No extra state load/
    save/serialization/retry or clock read; Guard/Ticket/drain/ACK/save-before-bind
    and sole Journal remain. All cases unexecuted on current source; full consumer/
    candidate/foundation/physical/long-run/example/backup/release gates remain open.

144. For FR-0014 compare prepared lifecycle/version1 and unchanged driver HostVersion1;
    exact native certificate/root/identity aliases and old constructor signature.
    Check original missing authorizer/reservation/identity/epoch/capability/load/auth
    error precedence, key/root/capability copy stages and no constructor Now sample.
    Adapter returns nil interface for nil native engine with exact error, retaining
    non-nil partial pointer for original Close; no extra Activate/Close/registration.

145. Compare original controller mutex/strict parse/Node/epoch/new-generation then
    issued-before-valid parsing and Now/window, per-item authorize/reserve/final auth/
    original Journal save before old-engine close. Allow callback keeps authorize
    before native Now/deadline. Cover precheck failure, JSON return versus Prepare/
    Activate error observation, all phases, partial/nil cleanup, same map/Close/read
    behavior. Engine-owned native time/TLS/frame/watch/budget/allow stays independent;
    no validation normalization, new driver or virtualized engine authorization.

146. Compare original offline Journal generation/Fence/replay, no cached restart and
    no high-water loss on failed preparation/activation, original independent Control
    grant/live Ticket/capability/identity/exclusive physical guard and old Direct/Relay
    historical/active/draining refusal. Retain explicit native TLS vectors for the
    existing peer-chain length !=1 refusal before intermediate iteration; this slice
    does not add intermediate-chain support. Run existing controller/engine/native tests
    only in later authorized Actions on frozen source; confirm no deployed registry/
    capability/Run/poll/Report integration or protocol/schema drift. All unexecuted;
    native dependency owners, full consumer/candidate/default/CLI/foundation/physical/
    long-run/backup/example/release gates remain separate and unproven.

147. For FR-0015 compare Provider2 generic Host method sets and native provider2/wire1
    explicit Host binding, lower tag removal/native field/type/order/tag/pointer/
    slice/nil shape and intentional reflection/serializer/direct provider migration.
    Retain old control alias/helper signatures and embedded Forward snapshot promoted
    access/JSON flattening/field order; composite literals use the embedded DTO.
    No native family/default in L1, Host conversion/copy or extra OS/clock work.

148. Compare four sample/point/identity/local JSON bytes, nil/empty/size/first errors,
    uint64/optional signed/hex and all time boundaries. ACK keeps original I-JSON ->
    count -> ordered missing/null -> decode -> parse -> correlation/provenance/count
    -> final rejectedPoints stages. Process Z suffix differs from other regex guards.
    Preserve observer/ticket/field/sample timing, Probe unconditional native UTC Now
    before terminal EndedAt replacement and plain terminal offset Format, ignored
    identity Marshal errors and original local sort/cursor/null/pointer semantics.

149. Compare encode before timeout/Post, original deferred response close then4097
    bounded read/error-status-length/ACK/cancel, no extra cancel/early close/retry.
    Cover pool/redirect/entropy short-read/tick/drop/max sequence, Host pending worker/
    cutoff/late result, original counter source freeze/retention/budget/generation/
    cursor and file lifecycle. UDP diagnostic helper retains exact *forward.UDP and
    one original Stats (including ignored ActiveSessions read), non-TCP/Remaining/
    mutex stages and native nil behavior. All planned/unexecuted; later authorized
    native/platform/network Actions on full frozen source, independent physical/
    long-run/backup/example/release and complete foundation acceptance still unmet.

150. Compare original Agent global flag registration order/help/defaults/parser and
    old run/enrollment signatures, parsed value capture and duplicate registration
    behavior. Command host retains echo/services/inspection/proof-pair/required/prefix
    first refusal and short circuits before native effects; --relay alone/time-proof
    remain allowed with inspect. Missing explicit trusted providers get no native
    fallback; existing Runner rejects later feature dependencies at the old stage.

151. Compare native Abs state/proof/Abs key/Rel/key-predicate/path order and ignored
    Rel errors/lexical parent behavior without new normalization. Inspection keeps
    exactly32-byte key/error mask/native inspector/stdout Encoder behavior, no lock,
    token, entropy, constructor, writes or connection. Enrollment keeps mode priority,
    token timing and existing refusal/partial-write/completion/deferred-cleanup order;
    no new lock/reset/rollback. Native imports no product command/control implementation.

152. Compare run instance lock/deferred release, one16-byte entropy read ignoring n,
    optional diagnostics path, every original Runner option/default, construction
    error before signals, interrupt/SIGTERM context/cancel before lock release and
    Run error propagation. Existing Runner stop/recovery/authority remains unchanged.
    Control plan public imports retain strict read/parse/Forward errors/compile/pretty
    stdout and no authority/reservation/deployment. All planned/unexecuted; authorized
    Actions on complete frozen source must supply functional/native evidence later.
    Full candidate/type/consumer/example/foundation/physical/release gates stay open.

153. For FR-0016 compare raw node/current/reported SELECT text/args/order/supplied Tx,
    optional query short circuits, absent node/current/reported, malformed bodies and
    first errors. Report decode precedes current query; current decode/filter/applied
    precedes reported query; current is decoded separately again for freshness. An
    undefined malformed report epoch still uses the session_epoch placeholder query.
    Native adapter opens no transaction/pool, adds no write/lock/retry/auth/clock.

154. Compare tuple assignment/generation/Fence matches, applied spreads/order/role,
    received/window/current-and-reported deadline/skew/session freshness and count/
    every-ready decisions. Preserve policy shallow copy, non-string stored references,
    no protocol/identity hardening, truthy0/null/NaN/invalid-date errors, dynamic native
    clock and non-null-only now sample. Path removes path, visits ingress/via serially,
    dispatches this.status overrides, aggregates unknown/minimum/null/times in old order.

155. Compare unchanged Runtime read contract/return shapes and both production
    compositions, old MySqlRuntimeObservations(policy) arity/own status method/subclass
    behavior; explicitly migrate private ancestor/provider-layout reflection users.
    Existing mysql.ts pool/guard/read-committed/action/commit/rollback/retry/release,
    legacy schema/migration lock/sorted SQL/partial DDL/lease backfill/marker/unlock/
    close behavior must retain native evidence, not be inferred from classification.
    All planned/unexecuted; later authorized exact-source MySQL/native Actions needed.

156. Compare Control startup1 structural options and original port/features/env
    read/refusal order, production release short circuit/failure, required option
    evaluation, repeated host/multihop/notification reads, policy identity/spread,
    server-start failure before logging/signals, host log reread, SIGINT before SIGTERM
    and guard-before-await once-only close including rejection. Native leaves import
    no L3, same original server/release implementations bind in existing main.

157. Compare client-command1 opaque Url/Bytes providers and every original command/
    usage/file/parse/method/path/body/Number/encoding branch, key precedence/create
    refusal, URL before CA read, original Bearer/JSON/optional headers and body length,
    10s timeout/destruction/error/end, response chunks/2xx/status and final strict
    parse/pretty stdout. No new limit/retry/redirect/exit/catch.156-157 unexecuted;
    later authorized exact-source native/HTTPS/process Actions and full type acceptance.

158. Compare original multihop immutable JSON/Hop/Profile/edge/role/binding/pin/target/
    digest/synthetic assignment and validation/leaf/fingerprint/conversion/prepare
    error stages. Relay direct public egress policy must equal old Allowed detour and
    preserve callback/DNS/dial/partial close. Retain sole TCP/UDP process budgets and
    original release/admission/draining/expiry/TLS/ALPN/frame/FIN/read-write/error order;
    payloadstats same-package Snapshot identity, nil/epoch failure/atomic saturation/
    successful ingress payload semantics and existing Control reads. Detailed5 native
    groups are in agent-native-engine-owner-v1; all planned/unexecuted. Whole native
    contract/type/default/consumer/candidate and physical/release acceptance still open.

159. Compare server public options/result, original feature/lifetime/policy getter
    and short-circuit order, two exact bootstrap raw SQL/rows (n>0 versus nodes===0),
    migrate/refusal/db.close/identity/CA/authority/guard sequence. Native notification
    root retains repeated path getters/resolve/dirname/containment and exact error,
    store-open and sequential dependency-close catch. Keep original assembly/Date
    defaults/HTTPS/listen/tasks/start/partial shutdown/allSettled/close identity. No
    added row guard/normalization/pool/Tx/cleanup. Planned/unexecuted exact-source cases.

160. Compare native codec/public aliases and actual per-package schema/generated
    sources including adp3execution/adp3 copies, lazy sync.Once/sticky compile errors,
    bounds/I-JSON/schema/JCS/time/typed-error stages and each Probe family distinction.
    Retain internal contracts ADP2-shaped Direct/stateless/time reuse after live ADP3
    rejection; no new live fallback. Cover native time-proof/ADP validator CLI and
    observationresponder config/identity/files/TLS/clock/budget/listen/lifetime with
    no Agent identity/upstream/echo. Fixture remains separate infrastructure. All
    planned/unexecuted; exact asset/type/private/default graph requires later checks.

161. For FR-0017 compare telemetry10 raw writes/order/retained samples, Station exact
    mutable9-field state/key order/native encoding then2 writes, Notification endpoint
    suspension before one now then history/cancel/pending3 writes. Preserve status
    assignment order, claimed unknown/null status, terminal HTTP evidence, GREATEST,
    rate bounds/opaque credential refs; no catch-up/requeue/refund/new transaction.
    L2 imports no L3, explicit product providers have no hidden default. Unexecuted.

162. Compare original Path/Ingress event-before-invalidation statements/predicates/
    revision/created_by and shared supplied at. Preserve definitions/lineage/attempts/
    audits/cancel flags/current pointers, no replay/reconcile/apply/compensation.
    Public PathPublicationRecovery/IngressRecovery consume only own supplied-Tx stores;
    explicit providers add no clock/read/connection. All cases planned/unexecuted.

163. Compare RecoveryQuarantine original complete owner callback sequence, exact same
    tx, immediate accounts capture, lazy legacy constructor/static defaults, original
    Probe/instance/permit sample count, single original ledger retirement algorithm
    and final Idempotency then event. Publication now is shared; event now precedes
    ordered native details encoding; restore options newTrustDigest stays lazy at
    original stage. UoW rollback/retry/uncertain commit remains original. No direct
    foreign writes/new transaction/authority/clear protected history. Unexecuted.

164. Compare complete backup output protection/mkdir/recheck/db/metadata/binding/
    ID/file-wx/dump/sync/authority recheck/lease/manifest/time/hash/signature/pretty/
    durable file/close sequence and every partial error. Native MySQL clientOptions,
    args/env/executable getter/pre-execute error versus masked execute failure and
    original limits remain; file/directory/symlink/ancestor/protected-vault exclusion
    and sync close precedence unchanged. No failed dump accepts a manifest. Unexecuted.

165. Compare restore stopped/target/maintenance/strict manifest/MAC/version/binding/
    new trust/safe SQL/hash/trusted-time/history-bound/output protection/source/admin/
    ID/fresh-target/create/restore/migrate/restored-lease stages. Preserve original
    getter repetition/first errors and child stderr/error/exit/pipeline Promise.all,
    no kill/new timeout/partial-target deletion. Trusted-time args/default/started/
    exec/bounded-parse/skew/late-Now short circuit and alias identity unchanged.
    Native target/hash predicates retain original coercion, not stricter validation.

166. Compare old backup/restore/trusted-time exported signatures and native Authority
    record identity, generic database/source/effect method sets, raw row arrays and
    no L3 import in native. Restore commits same quarantine before binding/credential
    write/owner filter/protected rebind/result, target pool finally then admin end.
    DDL/process/commit/credential/rebind failure boundaries remain distinct and unknown
    outcomes never imply rollback/clear/retry success.164-166 all planned/unexecuted;
    later authorized exact-source MySQL/native/functional Actions, full example/type/
    consumer/candidate/foundation/physical/long-run/recovery/release gates still required.

167. Compare upgrade old aliases/public types and source-only version1, exact single
    options argument, original JSON/key/counter/profile/Journal rules, all four late
    profile additions and complete ceilings. Preserve mutable report/check ordering,
    blocked/review precedence and permanent runtimeReady:false/productionApproved:false.
    Schema footprints retain enum/history differences; no migration/runtime readiness
    is granted by compatible output. All cases planned/unexecuted.

168. Compare bounded input/default maximum/stat/read-loop/UTF8/finally, exact37-file
    catalog/0037 floor/hash/markers/new relative root, unknown-file refusal and eager
    imports/assets. Preserve original read-only SQL/timeout/setup-before-try, conditional
    tables/null/metadata/node/counter/history/lease bounds, schema-race check, rollback
    failure precedence and zero database writes/migration. MySQL/file cases unexecuted.

169. Compare assessment plan->catalog->authority-before->CA->connection->database->
    authority-after->report->end order, lazy options reads and native AuthorityRecord
    identity, before/after sequence/trust, original error and close failures. Adapt
    old script-source READ ONLY assertion to canonical native source/behavior only
    after authorization. All type/functional/native cases planned/unexecuted.

170. Compare complete ops argv/usage/required-env/Authority constructor order for
    assess/status/maintenance/resume/backup/restore/unknown, original short circuits,
    nullish/empty defaults, notification optional field, CA await/digest and repeated
    clock-env read before JSON parse. Same Recovery delegates/arguments and postcommit
    failure boundaries; no new extra-argument checks/transaction/authority/retry.

171. Compare pretty/compact output and exit0/1/2, exact twelve-code upgrade whitelist,
    unknown-error redaction, usage outside inspection catch, output/serialization
    failures, outer non-Error failure and output-before-exit order. Release argv/env
    priority/usage/top-level await/same verifier/pretty output remain, no new catch.
    Existing native verifier15 gates/containment/hash/source/physical/image rules
    unchanged and unexecuted; invoking an entry is not approval or publication.

172. Compare contracts eleven package exports and exact L1 policy1/observation1/values2
    leaves versus every L2 native leaf/barrel, including negative private import/
    root-as-L1 cases. Preserve DEFAULT_POLICY identity/native fields, generic facts/
    native specialization, type aliases and legacy ADP2 internal projection after
    live ADP3 refusal; staged/experimental exports never enable production features.

173. Freeze/check actual direct and recursive schema/catalog dependency assets,
    eager Node/fs/AJV/CJS init/failure, parser/format/pair-check/JSON/JCS/time/digest
    order and handwritten telemetry/spec parity. Cover actual Control/Agent/ops/tool
    consumers, public versus private exports, distribution and generated parity.
    Classification alone proves none of these; full source graph/public example/
    dirty candidate content identity and physical/release gates remain unverified.
    167-173 and all preceding current-source acceptance are planned/unexecuted.

174. Compare agentplatform1 canonical native Providers/Effects/LocalServices exact
    fields/order/lower specializations and old Control aliases, including reflective
    package identity migration. All old New/With constructors retain original nil/
    error/default sequence and partial private fallback, same native types and no
    default construction time/IO/client/entropy sample. No L2 reverse product import.

175. Compare native Probe Echo->Services->Ingress->base factory selection, original
    bound resolvers, nil/constructor hierarchy/fresh Dialer/native scheduling/entropy,
    Guard refusal before construction and NewGate/counters/deferred close/negotiation/
    exact current-instance/Guard recheck after. No Runner clock replacement or new
    factory registration/cache/Permit/execution receiver/live Transit capability.

176. Compare explicit native counter provider binding with zero Now calls at Runner
    assembly; both live CounterSet and frozen-tail projection call sites. Every
    point still calls native Now().UTC() before terminal/unavailable choice; supplied
    EndedAt keeps offset/TimeText, epoch/overflow pointers/decimal values unchanged.
    Keep private free helper/partial Runner fixture fallback, separate injected
    Runner retention/page clock and original Probe executor counter clock. Preserve
    mutexes/loss/saturation/limits/session/retention/sort/cursor/close lifecycle.
    174-176 and all preceding current-source acceptance remain planned/unexecuted.

177. On the exact candidate compare protected Core four-file/public package surface,
    pure parser/canonicalization/no-op/CAS/exhaustion behavior and private ipv4Bytes
    not gaining a package subpath. Complete real source/type/private consumer, roots,
    dependency/generated/distribution/config assets and role inventories. Existing
    tool assertions/success logs/fixtures are not current results. Adapt boundary
    rules to actual JS/TS/Go/module/assets only after authorization, with negative
    unclassified/private/native-in-L0/L1 cases. No generator/check executed here.

178. Compare old bootstrap args slice/destructuring/ignored extras, both env reads
    before required check, exact first error, constructor outside try, then migrate,
    same original Identity creation/bootstrap, output and awaited finally close.
    Preserve constructor/migrate/bootstrap/log/close error precedence and top-level
    rejection, native type alias and original Identity transaction/validation/owner
    rules. No new token/logging/authority/schema or migration rollback claim.

179. Compare old ten model exports/function arguments/defaults/results/errors and
    direct/Relay consumers with new pure aliases/bound factory. Preserve credential
    short-circuits/two getters, Date.parse lookup before second getter, native parse
    then Now even invalid, no init time read; directSpec original first-error/form/
    Number/String/protocol/listener/target ordering. Query guard then exact native
    URLSearchParams defaults/filter iteration/String/primitive conversion/encoding;
    ports/CIDRs/candidate pinned limits/tones/page behavior. No server authorization.

180. Exercise exact /console/model.js -> owner/public.js -> service.js and browser-
    native/public.js fixed relative imports through the actual Control routes, union,
    reader/MIME/CSP/security headers and unknown-path refusal, plus existing Node
    imports/browser flows. Existing typecheck/test:web/boundary source lists do not
    prove new JS graph coverage; adapt later without weakening original checks.
    177-180 and all preceding current-source acceptance remain planned/unexecuted;
    functional/native/MySQL/browser evidence later in authorized Actions, with full
    Web/A5 candidate/consumer/type/asset and independent physical/release gates open.

181. Compare ConsoleRequest1 old connected/request signatures and lazy scope/token/
    connectionVersion reads, required short-circuit/version capture and exact errors.
    Keep native JSON decode before stale version before caller abort before HTTP
    status, including malformed result/native errors and original defaults/getters.

182. Compare native fetch/headers/endpoint/options/AbortSignal/JSON/error/status
    representation and direct returned promise without extra async stage. Mutation
    signature/key before connected, same-signature sharing, failure retention,
    success deletion and explicit reset order remain; no clone/freeze/retry/new
    queue/concurrent-outcome guarantee. Original input is still serialized twice.

183. Exercise actual app/request owner/native main view fixed imports/routes/MIME/
    CSP and packaged COPY source in matching-source browser/Node environments.
    Factory setup reads no lazy state/DOM/time/network; original later version let
    initialization, all24 initializer callbacks, listeners/render/connection/auth/
    secret/pending/candidate/dialog/reset order remain. Adapt existing console-flow
    VM source extraction to canonical factories/UI ports after authorization, retain
    coverage and add no production credential/state hook for private test layout.

184. Compare old six Relay helper exports/names/arguments and native form factory
    original fields/bounds/protocol/capability/parse order/mutable returns, including
    base direct helper time behavior. Old initRelayConsole retains argument/return
    methods, fresh per-init caches and original DOM/edit/pinned-profile/plan version/
    JSON-equality/CAS/unknown-result/history/deployment/clear sequence. Native modules
    import no L3 producer, no eager mount or new feature; all five fixed asset routes
    and no wildcard/security change.181-184 and all preceding cases unexecuted;
    full remaining Web/A5/candidate and independent physical/release gates stay open.

185. Exercise existing TCP/UDP Echo historical receipt pending/absent/consumed/
    revoked/quarantined and allowed outcomes. Reject closed-key/service/Scope/
    descriptor/machine/binding/time/byte/proof mismatch and malformed data. Display
    recorded evidence with unknown health and false execution; no browser trust
    claim. Retain old receipt families, bounded wait/revoke/issue/consent/replay.

186. Compare old non-Echo and existing Echo native selection per family; same-Tx
    permit challenge/result proof/byte/TLS capture, old mutation/capture/clock/
    refusal/commit order, immutable head/revision/loss and MySQL0037 representation.
    Exercise failure/rollback/duplicate/missing-head paths with no history reset,
    backfill or new authority. Public v1/v2/v3 input API remains separate from
    staged native v4 storage parsing; no new live Echo acceptance is inferred.

187. Exercise Echo/legacy browser run shapes, invocation and full stored-content
    digests, time/retention/query/Scope/cursor/order/size relationships, actual byte/
    protocol display and recorded evidence. Cover declared echoed status in HTTP
    decode/owner/browser/select, unknown-status rejection and unchanged parameter
    SQL. Include abort/version/input/error/clear/no-hidden-request behavior; adapt
    existing fixtures under later authorization, retaining original coverage.

188. Accept the authored22-leaf manual public/default/native/callback/product-rule/
    consumer/asset/compatibility-removal map, including21 original native adapters
    and the actual Rule split under FR-0022. Cover real request triggers such as
    telemetry-open reload, tunnel parallel reads, metadata refresh and Probe revoke
    query; no blanket no-automatic-read claim or folder exemption. Extend actual
    source/type/private/asset boundary coverage only after verification authorization.

189. Compare RuleCommands1 selected Map/ten-limit/key/CAS/body preparation before
    discard, Profile/path native relationships and retry Operation->Forward reads.
    Exercise first preflight, no-write failures, original uncertain replay without
    replacement check, rejection/abort/stop/tail/generation/plan identity/no-op/
    acceptance, finally consent/render/await refresh and all old error paths.

190. Compare native Rule DOM/input Set, old init destructuring/defaults/function/
    return names/order, lazy construction and original callback invocation order.
    Preserve separate clone/ordered/JSON/getter evaluation, native encoding/time/
    UUID/confirm this-binding/abort/options/error text. Check real main lazy Profile/
    Path consumers and adapt existing Rule/app/Relay private VM source extraction
    with old coverage and no production credential/state hook.

191. Exercise old Rule->owner/public and native/public->service/native graph and
    three literal asset union/routes, original MIME/UTF8 reader/CSP/headers/packaging
    and negative native-to-product source/type boundaries. Adapt older test:web/
    boundary tooling in concentrated verification without weakening coverage.
    185-191 and all preceding current-source acceptance remain planned/unexecuted;
    exact-source Actions and independent physical/release gates stay required.

192. On the later exact saved candidate, cover additions/modifications/deletions
    together, including untracked0020-0037 SQL, schemas, new TS/Go/JS owner/native
    sources, public example, responder deployment inputs and FR/owner documents.
    foundation-candidate-index-v1.md is a review index, not a saved source identity
    or exhaustive dependency manifest. HEAD/historical passes cannot identify the
    present dirty content; no candidate is frozen by this documentation slice.

193. Compare actual public declarations/exports with each independent counter in
    the candidate index: Host3/Ledger3/Relay5/Node3, common values2/configuration2/
    Transport2/BackgroundTasks2, Agent state3/platform2/observation2, browser1 and
    the separately versioned storage/product/native ports. Retain actual generic,
    native named-type/reflect/serializer/default and legacy caller cases. Aggregate
    Framework1/package0.1.0/ADP3/schema0037 are not interchangeable versions.

194. Accept production/package fs and embed inputs, nested schemas/catalogs,
    generated native aliases/bytes, workspace lock/sum manifests, SQL migrations,
    fixed Web assets and ops entry imports in the actual distributions. Control
    COPY/contracts import/socket liveness alone does not prove the module graph.
    Verify Agent/responder and moving base-image resolution separately; no claim
    of responder build/scan/publication from the existing two-image workflows.

195. Adapt existing concentrated-stage coverage to include the public example
    omitted by current root tsconfig, all browser modules beyond old test:web's
    fixed syntax list, canonical Rule/app/Relay VM factories and actual ops/type/
    private/asset boundaries. Preserve prior behavior/security/negative coverage;
    no whole-package allowlist or new production credential/state test hook.
    Example preview evidence stays narrower than Runtime/Agent/MySQL execution.

196. Compare deleted authorization clock/synchronization/status, Control usage
    and state lock leaves with their platformclock/platformobservation/platformstate
    replacements and retained wrappers. Cover OS build selection, original public
    default/error/availability/lock/fsync/proof behavior and protected state/history.
    Keep deployment options/Compose profiles and staged Echo v4 separate from live
    capability, physical-host, release and production acceptance.192-196 and all
    previous current-source acceptance remain planned/unexecuted.

197. Accept the21 schema-to-TS-loader/Go-embed/generated/handwritten source roles
    in contract-assets-source-map-v1.md. Compare source/copy/generated bytes and
    native declarations, compile actual local definition references, and retain
    separate Runtime/execution and Relay resources. Preserve generator targets,
    including adp3execution schema/type output and exact adp3 aliases; do not infer
    coverage for runtime/Transit/typed/services/Echo/telemetry from generator scope.
    Resolve the recorded three Transit newline-comparison semantics in authorized
    concentrated verification without weakening contract-only/Runtime refusal.

198. Exercise all11 package entries and original native module initialization,
    schema/catalog asset paths and missing/malformed dependency refusal in actual
    distributions. Dedicated lower common entries remain native-loader-free; root/
    runtime/shared eager work and type-import direction stay explicit. Handwritten
    telemetry validators/ACK encoders require their own schema/fixture behavior
    cases; copied specification assets are not runtime execution evidence.

199. Compare catalog1 closed fields/digest/order/schema/platform/role/phase/
    protocol/capability/flag/gate declarations with original Direct/Relay/Multihop
    compiled providers, typed/generic host wrappers and platform/feature selection.
    Keep existing duplicate suppression, Probe opt-in/hook conditions and actual
    Guard/Journal/authority before execution. Catalog metadata does not install a
    driver, load its schema automatically, measure usage or enable live Transit/
    Echo.197-199 and all prior current-source acceptance are planned/unexecuted.

200. Accept the complete59 top-level modules leaf map in
    control-legacy-module-leaves-v1.md: six construction/static bindings and53
    exact value/type forwarding entries. Preserve old export names, pure aliases,
    original distinct frozen objects and native entry classification. This bounded
    map does not certify nested owners, import graph or removal of old consumers.

201. Compare Identity dynamic clock versus Nodes captured Date.now,120/86400 and
    optional resource construction, Transport UUID/dynamic clock, endpoint clock,
    Forward/Idempotency zero-argument stores and original static quarantine/lazy
    Recovery callbacks. Retain one supplied transaction, shared resources/ledger,
    original account/machine lookup and protected credential/history ordering.

202. Accept direct public type sources for Idempotency Accepted/ForwardAccepted,
    Transport ProfileForwardReferences, endpoint RelayForwardReferences, Nodes
    authority types and ControlApplication MemberChangeInput. Preserve original
    declaration/generic/default/export identities and type-erased loading/cycles;
    retain old wrappers/forwarders for actual server/bootstrap/Control/Recovery,
    phase scripts and test consumers until explicit migration and acceptance.
    No runtime body/version changes intended;200-202 remain planned/unexecuted.

203. Accept the bounded34 modules/runtime leaf map in
    control-runtime-legacy-leaves-v1.md: eight construction/callable bindings,
    one retained RelayExecutionLedger interface and25 exact value/type forwarders.
    Compare all original exports, native family aliases and generic defaults;
    retain the interface declaration and exact leaf value loading rather than
    replacing constructors/interfaces or widening runtime barrels. Account for
    actual production/Recovery/phase/fixture/test consumers before any removal.

204. Accept the five legacy access/authorization/execution-adapter/Forward-command/
    Node-change port type sources through existing owner public entries and the
    controller/Ledger/Relay Policy imports through contracts/policy. Compare the
    same canonical type declarations, inherited signatures, readonly/default/
    generic behavior and type erasure/cycles. EXECUTION_HOST_VERSION and native
    DEFAULT_POLICY value imports remain their original leaf/shared bindings;
    show module emission/initialization and old direct test imports still work.

205. Compare RuntimeController original ledger callbacks/Forward arguments/member
    receivers, selected-policy copy and supplied-resource short circuit, captured
    clock/ID functions, Relay default policy/false multihop and static same-Tx
    Recovery sampling. Compare Transit held coordinator versus per-call delivery/
    negotiation services, module-time reservations, staging callbacks and original
    resource/release/store owners. Retain current-only authority, offline-preview
    refusal, supplied transaction and protected history semantics. Adapt existing
    coverage later without weakening boundary cases or adding production hooks.
    No runtime body/version changes intended;203-205 and all earlier current-source
    acceptance remain planned/unexecuted. Full A5 and independent gates stay open.

206. Accept all99 application entries in control-application-legacy-leaves-v1.md:
    original Control composition, named request wrapper, independent management
    aggregate constant and96 exact forwarding leaves. Compare narrow type-star
    sets, value/function/class/object identity and aggregate native initialization.
    Preserve three old MySQL read-wrapper consumers, source-extraction fixtures
    and real phase/manual/operator/test imports until deliberate migration.

207. Accept nineteen named application type-export source changes and the original
    Control Policy/Accepted imports against the same canonical declarations.
    Retain old local/export names, default/generic/mutable/readonly/optional types,
    erased loading and all earlier forwarding leaves. No expanded wildcard, new
    version/public shape, DEFAULT_POLICY or Idempotency value import change.

208. Compare original Control field initializers and constructor groups, deferred
    Relay source and migration-origin callback, shared resource/ledger/qualification
    stores, explicit native readers and exact optional feature flags. Compare four
    execution callbacks, restoration authorization, current Path/group read order,
    sequential Node cleanup/capacity, receiver binding and same-Tx owner calls,
    including rejection and rollback. Named composition does not exempt product
    private imports or authorize a new root.206-208 are planned/unexecuted; all
    earlier current-source acceptance and independent physical/release gates remain.

209. Accept the full Control leaf/family record in
    foundation-control-source-closure-v1.md: public kernel/framework, exact native
    compatibility leaves, pure stores versus named construction bridges,31
    product owners, HTTP and existing root commands. Enforce real source/type/
    private edges and negative L1-to-native/L3 cases; neither a ledger row nor an
    old bridge exempts an entire directory or creates a new composition root.

210. Compare Control old MySQL projection/default wrappers and API aliases with
    original exact value loading, prototype/override/static/lazy semantics and
    raw storage/product callback separation. Exercise preflight/partial-start/
    shutdown, request drain/task failure/backoff/allSettled ordering, one shared
    resource/ledger and original same-Tx/lock/CAS/history/recovery owner sequence.

211. For FR-0025 accept CancellationSignal1/Node report read2/Notification effects2
    without DOM/Node types in the lower declaration. Native signal substitution
    must retain the same object, reason, throw, callback identity, once/removal
    and already-cancelled/registration race behavior. Lower-only onabort/dispatch/
    full EventTarget or native-API assignability is intentionally not promised.
    Exercise observation pool-wait/owned-connection and sender admission/DNS/guard/
    request/response cancellation, original rejected-versus-unknown classification
    and capacity held until actual drain; no wrapper/cast/controller replacement.

212. Accept package/support/distribution inputs in
    foundation-assets-consumers-closure-v1.md and the schema map: all11 exports,
    eager native versus dedicated lower loading,21 recursive schema resources,
    catalog/providers, Go embeds/generated versus handwritten roles, fixtures,
    locks/config/SQL/Docker COPY and source deletion replacements. Preserve native
    missing/malformed dependency refusal, canonical bytes and distinct resources;
    do not run a generator as a substitute for demonstrating parity.

213. Adapt existing Web syntax/type/private/asset and canonical factory coverage
    beyond the old fixed9 JS list. Keep Rule/app/Relay VM behavior/security cases,
    request key/stale connection/abort semantics, exact served module/MIME/CSP
    paths, all named owner/native/old entry consumers and narrow loading graphs.
    The manual22-leaf source map does not prove browser or capability acceptance.

214. Include the public example omitted by root TypeScript and the exact ops/
    phase/manual/fixture/source-text/container consumers in the saved candidate.
    Adapt upgrade-inspect source assertions and offline container imports without
    weakening readonly/refusal/negative cases. Demonstrate preview-only auth/error/
    immutability/log/drain, original operator exit/cleanup/protected owner ordering;
    no production credential hook or new test framework. Current two-image
    workflows cannot supply independent Responder build/publication or live Echo.

215. Accept every named lower/native/Runner/Probe/state/engine/codec/helper/test
    entry and asset in foundation-agent-source-closure-v1.md. Preserve public
    generic/native alias/method-set/default/zero/nil/private-fixture compatibility,
    OS build selection, native counter clocks, shared budgets and save-before-bind/
    partial-start/replacement/drain/close-before-tail authority. HostVersion1's
    fixed platform/phase/protocol vocabulary stays closed; unknown metadata and
    valid metadata with wrong actual platform/feature must retain refusal order.
    Actual runtime.GOOS remains native, not a remote descriptor authority.

216. For FR-0023 accept executiontime2 tagless parsed facts and platformclock2
    SyncStatus/SynchronizationFacts, old authorization native aliases and exact
    proof JSON field/order/MAC/provider errors. Direct lower native literals or
    serializers must migrate explicitly; no native tag/parser fallback in L1.

217. Exercise FR-0023's declared parse-at-Evidence/cache frequency change against
    original provider/second sample/host/source/validation error order: invalid
    timestamp plus wrong host/source, before/after provider errors, refresh and
    uptime rollback, future/stale/30s/500ppm bounds and both sample positions.
    Native parsing produces invalid facts without an earlier returned error.
    Cover OS/proof/unsupported provider selection and custom lower fact sources;
    source review does not demonstrate time-boundary equivalence.

218. For FR-0024 accept executionidentity2 facts versus agentidentity2 native
    CredentialBundle/RotationRequest/RelayResponse/RelayBundle and all eight
    bidirectional projections. Compare every field/order/tag, two omitempty
    properties, OverlapUntil nil/pointer identity and exact native JSON/old private
    fixture serializers. Lower direct JSON is intentionally not the native format;
    canonical native owner/reflection/type changes must be explicit.

219. Compare FR-0024 Provider/nativeexecution2/Control pending and response consumers:
    machine permissive versus protected strict decoding; initial missing versus
    later JSON/MAC/store failure; stable request ID/CSR/key replay; overlap/time
    and expired protected-history validation before online renewal. Retain original
    save/reload/remove and save/remove/publication branches, partial-failure cleanup
    and original credential/Guard/Journal authorities without clearing history.

220. Save and identify the complete integrated A5 candidate only under the later
    applicable authorization. Include all classified source/support/config/asset/
    addition/deletion inputs and independent public counters/FR-0001-0025; old HEAD
    or this manual ledger is not an immutable identity. Adapt existing checks and
    execute B on that same revision, keeping source-closed/planned/executed/pass/
    fail/skipped/missing states distinct. Any newly found omitted source or actual
    boundary violation reopens its source item.209-220 and all prior current-source
    acceptance remain planned/unexecuted; physical/long-run/recovery/Responder/
    release and upper-module acceptance need their own evidence.

Tests and actual functional/MySQL/network/container/browser runs follow the existing
Actions-only policy when that phase is authorized. The example is not being run
locally in this source phase. Physical multi-host, long-run capacity, backups/
recovery and release approval remain separate unmet gates where evidence is absent.

## 4. Parallel Module Procedure

After acceptance, record exact frozen public entrypoints/revisions. Create one
independent branch/worktree and directory per module with its own public contract,
tests, integration instructions and module owner. Integration binds providers in a
known composition root; independent feature branches do not edit shared foundation
contracts or race on central composition. Record required foundation interface/
semantic changes in their own FR under applicable source authorization; similar
changes use the 2026-10-19 standing authorization without repeated confirmation.

The saved candidate is merged; preserve any later unrelated dirty changes.
This procedure does not itself authorize a branch switch, commit, push or release.
No new product feature is started by this layer-governance work.
