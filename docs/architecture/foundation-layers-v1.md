# Foundation Layers v1

Original source handoff: 2026-10-18 (Asia/Shanghai), declared boundary and first
live extraction; then not accepted. Documentation status clarified: 2026-10-21.
See [ADR-0048](../decisions/0048-foundation-layer-boundaries.md) and
[readiness](../development/foundation-readiness.md).

B subsequently accepted the bounded frozen public contract/consumer/compatibility/
example scope at source `e208a3abf17129b0c2898ba2022c69f60f45445a`, actually tested
as `c3ce8a67b901f61234b4116190409854818cb6c7`. See the
[candidate index](foundation-candidate-index-v1.md) and
[verification record](../development/foundation-verification-2026-10-19.md).
Dated source-phase/unexecuted statements below preserve their original scope and
are superseded by that decision for its exact revision. They neither negate B
acceptance nor certify subsequent changes. Future module work needs its own task,
accepted contracts or a verified successor, tests and integration instructions;
physical-host, load/long-run, independent Responder and release gates stay separate.

Later current source disposition, 2026-10-19: manual A5 ownership/type/private/
default/consumer/asset classification is closed in
[foundation-a5-source-closure-v1.md](foundation-a5-source-closure-v1.md).
FR-0023-0025 source-separate Agent timing/credential representation and common
Control cancellation. Earlier paragraphs preserve extraction history; actual
configured boundary/contract/example checks passed on the saved PR #111 candidate.
See [verification](../development/foundation-verification-2026-10-19.md).
Full readiness acceptance and independent physical/release gates remain separate.

## N Product Source Successor (2026-10-21)

FR-0028–0032 extend current source under the explicitly authorized
[N stage](../development/product-development-stage-n-2026-10-21.md). L1 gains
owner-independent ResourceReadAccess/claim and Runtime port-policy contracts;
L3 ResourceAccess, Node, Forward, Path and query owners supply product ownership,
purposes, personal visibility and shared-Node port decisions. L2 original MySQL
stores persist explicit claims, caller-filtered projections and original slot
aggregates in the supplied transaction. Original Runtime hosts invoke injected
policy without importing product owners or creating another ledger.

The original NodeService supplies policy at construction; legacy Nodes and Runtime
constructors assemble the required providers. Raw store create no longer grants
Node use. The product owner inserts a private creator grant explicitly; shared
resources require an administrative grant. Legacy unclassified resources fail
closed until audited CAS classification; no owner is inferred from old grants.

L2 browser account-context, line-builder, template-reference and admin-resource
representation leaves follow the original asset adapter. Role-specific selection
can enter either original immutable template publication or a disabled Relay
draft. Core, Agent authority/Journal and protected execution history stay with
their existing owners. The boundary inventory declares these source changes;
it has not been executed as acceptance. The [candidate index](foundation-candidate-index-v1.md)
lists successor counters separately from the frozen B evidence.

FR-0032 adds L1 RuntimePayloadPolicy/OfflinePayloadPolicy, SharedResourceLimitStore,
payloadbudget decisions and injected payload/precharge contracts. L3
resource-limit-owner supplies immutable Forward-owner/user/Node policy; L2 original
MySQL, ADP/3 and native state encode/persist it. RuntimeHost calls the policy in
its original transaction; Runner uses the original authenticated Journal for
save-before-write debit. Agent engines consume an injected gate and keep original
authorization. They create no second ledger or authority. The payload console is
an L2 representation leaf and the new example consumes public owner/framework
entries. These are declared source dependencies, not passing boundary evidence.

## 1. Meaning Of The Four Layers

| Layer | Owns | Current public entry |
| --- | --- | --- |
| L0 kernel | Pure domain language and minimum runtime publication decisions | `@tunex/core`, `apps/control/src/kernel/public.ts` |
| L1 framework | Ports, common errors/logging, Runtime coordination and lifecycle helpers | `apps/control/src/framework/public.ts`, precise contracts `policy` / `execution-observation` / `execution-values` public leaves |
| L2 compatibility | External representations, platform observations, protocol and storage adapters | `apps/control/src/compatibility/public.ts`, supplied RuntimeCodec/RuntimeStateStore, Agent `platformobservation` API |
| L3 features | Product commands/queries and user-facing behavior | Owner/module public contracts; sample `examples/foundation-extension/public.ts` |

The existing directory name `modules/runtime` does not make every file L0.
`RuntimeHost` is L1 coordination. The old `RuntimeController` constructor is a
composition bridge. MySQL persistence and ADP compilation are L2 implementations.
`packages/core` remains the frozen pure domain package; runtime decisions have a
separate version and entrypoint. Business-specific execution plans stay with their
owners, not in a growing universal Core.

The Agent's current Runner/authorization/Journal packages mix pure mechanisms and
platform/persistence work. Preserve their authority ownership during migration;
they are not automatically certified L0 just because they enforce safety. Track
the remaining source separation instead of declaring mixed packages compliant.

## 2. Dependency Rules

L3 may consume public L1/L2 capabilities; L2 may consume public L1 and L0 contracts;
L1 may consume public L0 contracts. Same-owner internal files can collaborate.
Cross-owner calls use a declared public interface. An injected higher-layer
implementation satisfies a lower-layer port; the lower layer must not import the
implementation's class, type or path. Type-only references count as dependencies.

New L3 modules obtain domain intent through framework values/facades such as
`ForwardIntent`/`parseForwardIntent`, without importing kernel internal files.
No artificial L2 pass-through is required for a feature that has no external
difference. The prohibition concerns private/bypassed boundaries, not adding a
meaningless adapter to every call.

The known composition roots are `server.ts`, `application/control.ts`, the old
`modules/runtime/controller.ts` bridge and the example's `main.ts`. They may assemble
concrete providers; features must not use them as service locators. New composition
roots need explicit classification rather than an automatic exception.

The JSON [boundary inventory](foundation-boundaries-v1.json) records the source
scopes/public entrypoints. It is a declaration, not an executed import analysis.
Existing boundary tooling has not yet been adapted to these new locations and
imports. Concentrated verification must consume/cover the declared rules, including
type imports and unclassified files. Legacy debt is not an allowlist for new work.

## 3. Current Live Extraction

Source governance update, 2026-10-19: the human granted standing authorization
to choose and implement similar foundation source proposals without repeated
confirmation. Record each FR's impact, compatibility/migration, chosen design and
planned acceptance before implementation. This supersedes older repeated-confirmation
wording for those proposals, not the separate verification/commit/release/feature
gates. Runtime host interface2 is now source-authored under FR-0002, unverified:
explicit clock and parse/format effects, native defaults in RuntimeController/L2.

`framework/runtime-host.ts` consumes only its declared ports, stable wire value
types and public L0 functions. It has no MySQL connection/SQL, concrete Node/Forward/
Relay classes, AuthorityStore or schema parser dependency. Its constructor receives
transaction-aware providers and a clock. The old constructor supplies the existing
owners and adapters; there is still one ledger and one coordinator's behavior.

The state adapter preserves the existing boot/snapshot/report SQL and ordered
locks in the caller transaction. The codec adapter preserves closed ADP/3 parsing
and Snapshot compilation. The L0 publication helpers consume already validated
facts and decide only hold/reuse/deadline; they neither read a clock nor mint a lease.
The host still records protected authority before persisting a new publication.

Common `ControlError`, authorization/transaction/idempotency ports, BackgroundTasks
and RequestLifecycle now live in L1. Old application paths re-export them for
callers/tests; production Control source imports the framework public entry.
The error class identity and existing status/code/retryable behavior are preserved.

The next source slice puts resource lock/reservation/transition/capacity/release
decisions into L1 `RuntimeResources`, consuming `RuntimeResourceStore<Tx>`.
`infrastructure/mysql-runtime-resources.ts` is the L2 provider for the existing
resource tables, plus an explicit factory for legacy/default callers. The live
server supplies one resource service to Nodes and the original RuntimeLedger;
Nodes no longer constructs its own complete ledger. Old ledger resource methods
delegate, and old planner/Relay-plan type paths re-export the same declarations.
No new ledger, resource table, pool, nested transaction or authority is introduced.

Relay's Node/Forward/endpoint/ledger providers use independent owner contracts.
Operation changes and resource release are called through the existing ledger
owner rather than SQL writes from Relay. These contracts do not certify the
remaining implementations: concrete cross-module consumers and other unclassified
mixed owners remain migration debt.
The legacy constructors' optional L2 defaults are explicit compatibility bridges;
new modules should receive public services through their existing composition root.
All extraction equivalence and new public interface-1 cases remain unverified.

The ledger's remaining coordination is now `framework/runtime-ledger.ts` with
explicit store/clock/ID/compiler/authorization/resource/assignment/Forward ports.
`infrastructure/mysql-runtime-ledger.ts` implements its SQL storage port. The old
ledger class is a compatibility constructor that binds original providers; it
does not retain another copy of coordination or create another persistent ledger.
Quarantine, ordered claims, retirement/lease/drain ownership and distinct completion
branches stay with that one host. Existing native compiler/policy implementations
are now relocated to L2 compatibility with old-path aliases. L1 has
no source/type import of those implementations, database, platform or ID/clock globals.

Relay coordination is now `framework/runtime-relay.ts` with an injected clock,
Node/Forward/Transport/endpoint/ledger owner contracts, native compiler, deployment
store and read-only runtime observation provider. The legacy RelayCoordinator is
only provider assembly plus its preserved static quarantine entrypoint. L2's
MySqlRelayDeploymentStore writes its own deployment table; MySqlRelayObservations
projects other owners' existing tables in the same authorized transaction and does
not mutate them. Neither observations nor a compiled plan confer execution authority.

The native Direct/Snapshot/Relay/multihop compilers, role topology, endpoint parser
and literal-IP target checks live inside `compatibility/native-*.ts`. Their public
entry is `compatibility/public.ts`, including the lower-owned compiler objects.
This is source relocation, not broader protocol support or a new L0 API. Old module
paths re-export functions/types; `mysql.json` aliases the single L2 stored-value
decoder. Compiler/provider acceptance has not been run.

Node credential/state coordination is `framework/node-authority.ts`, with explicit
storage, machine lookup, signer, Scope authority, secrets, codec, clock, transaction
and resource ports. The Node product commands remain in `modules/node-owner` with
their own public entry and product DTOs. MySqlNodeAuthorityStore, the separate
pool-backed machine lookup, existing PKI signer and identity-secrets provider are
L2; old Nodes construction and policy/token paths are compatibility bridges. The
original Node tables, signer and authority bounds remain in use; this is not a new
Agent root of trust, Journal or second command owner. Broader Identity/HTTP/module
and Agent platform migration remains open and this slice is unverified.

Identity now has L1 IdentityAccessHost/interface 1 for common bearer/Scope checks,
with injected store/account lookup/secret/value-codec ports and no native effects.
L3 identity-owner retains bootstrap/member/recovery/list/audit command policy and
business DTOs. L2 MySqlIdentityStore retains caller-transaction SQL; the explicitly
separate account lookup retains original pool-backed authentication. Native value
grammar and secrets are injected through the existing compatibility/infrastructure
providers. The old Identity constructor and member type path are bridges to this
one owner, not a competing store or authority. HTTP consumes IdentityQueries;
Control composition consumes IdentityOwner; Node and other Scope consumers use
their existing lower public authorization contracts. Other module/HTTP class
views and mixed persistence still need extraction/classification, and none of the
new Identity behavior/alias/transaction equivalence has been accepted.

Transport Profile and Relay endpoint product commands now live in independent L3
transport-owner/relay-endpoint-owner modules with public API/resolver/grant/options
contracts. L1 relay configuration interface 1 declares store/codec ports; L2 keeps
the original SQL and native Profile/endpoint/stored-value/digest/key/ID behavior.
HTTP and composition use the independent owner contracts. Node management/audit
and Forward reference locks use owner-owned public ports on the caller transaction,
not cross-owner writes or concrete implementation types. Old Transport/RelayEndpoints
constructors, Transport static recovery and parser/type paths remain explicit
compatibility bindings to these providers. Changed active endpoints still refuse;
no-op behavior and pinned revision/grant/atomic reconciliation policy remain source
intent only. This does not certify Forwarding/idempotency or other mixed owners,
nor establish any executed boundary/transaction/compatibility evidence.

Forward intent state and idempotency now have explicit L1 transaction/storage
interfaces and L2 MySQL providers. L3 `ForwardStateService` and L1
`IdempotencyHost` retain original filtering, lazy stored-value decoding, affected
row conflicts, recovery flags, locked replay and status/body semantics. Old
Forwarding/Idempotency constructors and port aliases bind the same stores. Runtime
Controller/ledger, ForwardCommands, Transit and path/application consumers use
their public contracts; execution publication remains with the single Runtime
ledger. This is source separation only: SQL/JSON/transaction/rollback equivalence,
remaining application coupling and full import classification are unverified.

The management HTTP seam now imports independent NodeApi and application command/
detail contracts, not Node/ForwardCommands/AccessCommands/NodeManagementCommands/
TransportGrantCommands/ControlQueries implementations. Existing response and
capability type exports alias one declaration at each owner contract. Business DTOs
remain L3/application-owned; no L1 class imports the HTTP view. The source map and
remaining class-derived views are documented in control-application-contracts-v1.md.
Type-only extraction leaves method bodies/routes/transactions unchanged in source
intent, but alias/substitution/HTTP/error/layer equivalence remains unverified.

Relay preview now has an independent application API and response union; Transit
machine HTTP has public declarations in its existing runtime owner; passive Node
observation consumes its original public observation DTO through a narrow API.
No L0/L1 host, compiler, SQL, admission or route behavior is changed by this slice.
Transit SQL/native/clock coordination remains mixed implementation debt, not a
new compliant L3 module or accepted exception. Item 25 records pending acceptance.

Path groups/publications and ingress groups/deployments/migrations now have
independent application APIs rather than class-specialized HTTP views. Internal
ingress consumers use the public transaction resolver, not IngressGroups's class.
Template/group config declarations live in owner ports; the original native
contracts reexport them. Public path-operation limits hold one copy of the old
objects and retain legacy value exports. Pure ports consume declared paging and
framework domain aliases rather than executable helpers or direct Core types.
Existing native-format/application implementations remain mixed debt. Source
initialization, aliases, CAS/replay/compensation and behavior await item 26; this
does not certify the entire path/ingress implementation or HTTP dependency graph.

Probe preflight/management and nine machine HTTP surfaces now consume independent
application API declarations and original wire types. Existing instance/permit
owners expose separate public ports; wrappers no longer derive methods from their
classes. Acceptance/instance types and measurement/qualification metadata have
single declarations with legacy aliases. The pure metadata helpers remain L3
product metadata, not execution authorization or a new generic Core capability.
Permit budgets, consume/withdraw/result/history transactions and commit-before-ACK
remain with the original owner. Native parsing, clocks/crypto, mixed SQL type
dependencies and staged echo interactions remain debt. Item 27 is unexecuted;
new declarations neither finish staged echo nor establish Probe/HTTP acceptance.

Management read interface 1 adds raw storage rows/page/filter/selector types,
observation/format effects and supplied-transaction stores. L2 SQL no longer
imports Console/Profile/Tunnel application DTOs/helpers; L3 public projection
services keep those product shapes. A synchronous projection callback executes
after the last read without a reverse source dependency; native JSON/time/ISO
effects remain explicit L2 providers. Existing ControlApplication composition binds
them, while old MySQL reader classes are precise stateless compatibility methods,
not newly exempt composition roots. SQL pagination has one independent L2 helper
with the old export retained. See management-read-models-v1.md and unexecuted item
28; other adapters/type references and whole-repo evidence remain unfinished.

Agent executionhost is the generic L1 Host/Driver/Instance/registry mechanism;
native assignment/policy/peer identity types are injected parameters and selection
uses explicit header/features/platform values. Existing executiondriver is now a
typed L2 alias/actual-OS binding over that one public registry implementation, with
zero-value behavior preserved in source intent. Native Direct/Relay/Multihop
adapters live in L2 nativeexecution; old Control helper names delegate rather than
duplicate conversion/engine code. Runner authority/Journal/Guard/Ticket/retirement
ownership and all wire/feature/capability meanings remain unchanged in intent.
Control private compatibility/prechecks, Probe/trust/CLI and native engine/wire
internals remain debt. See agent-execution-host-v1.md and unexecuted item 29;
this does not certify all Agent source or change the closed parallel gate.

Five optional telemetry/aggregate APIs now use independent L3 declarations with
original wire ACKs and explicit query/delta/history/capacity views. Public telemetry
policy holds the five existing frozen objects with old aliases and distinct family
identities; no state/algorithm is merged. Owner method/SQL/route bodies are unchanged.
Native time/parser/Buffer and storage dependencies remain debt. Item 30 is unexecuted;
the subsequent optional API slice and whole-source/Agent acceptance remain open.

The remaining eight optional observability HTTP services now have independent L3
contracts in six entrypoints, covering diagnostics/audit/station alerts, notification
endpoints/deliveries, Probe runs/plans and observation services. Explicit public DTOs
reuse owner/wire value declarations, not implementation classes or a never-Tx
specialization; original bodies/ownership/budgets/transactions remain unchanged in
source intent. Seven limit objects and audit coverage are public single-source
policy with old aliases; ProbePlanReceipt retains its old type export. This does
not turn read evidence/configuration flags into health or authority. The public
[seam document](observability-http-contracts-v1.md) records version 1 entrypoints,
integration/compatibility rules and limitations. HTTP private/native helpers and
the owners' time/format/crypto/storage dependencies remain migration debt, including
reverse product-contract/parser references in MySQL adapters. Item 31 is unexecuted;
whole-source classification/separation, enforcement and the closed acceptance gate
are not completed by this seam extraction.

Console, native catalog, Profile reference and Tunnel query HTTP surfaces now also
use independent application contracts, including old projection/read/helper type
aliases. Native descriptor metadata is reused through a public L2 type entry;
application DTOs retain their original qualifiers and evidence limitations. These
declarations do not certify the existing MySQL read models' application type/helper
dependencies: those adapters remain recorded mixed migration debt, with unchanged
SQL bodies. Source aliasing does not accept reverse L2 -> L3 dependencies or prove
query/authorization/provenance/HTTP equivalence.

Agent L1 `runtimeobservation` owns Process/Host measurement values and a Provider
for individually ordered memory/process/goroutine/PID/platform/host reads. L2
`platformobservation.Native` supplies original runtime and OS effects; its old
Process/Host type exports remain aliases. CaptureProcess retains Linux rusage and
`/proc/self/fd`, with absent values on unsupported platforms. A platform label is
provenance, not a platform compatibility decision. Host-worker deadlines and loss
decisions remain caller-owned. This is not full Agent platform extraction.

Agent `executiontime` is L1 timing coordination: the original Guard/Ticket and
synchronization cache consume injected samples, evidence, host and platform identity.
L2 `platformclock` owns uptime, OS status queries and Windows text parsing. Old
authorization functions bind the same native/proof providers and delegate to one
lower guard; the compatibility clock field remains a source for that guard, not
a second copy of timing/failure state. Lower logic contains no OS/proof/file reads.

Agent `executionstate` is L1 locked Journal acceptance through RuntimeStore,
SnapshotInput and SnapshotCodec. The native L2 adapter supplies the exact validated
history projection and original wire bytes, keeping native parser implementations
out of lower source/type imports. State file/MAC/native readers and explicit
migration remain L2 owners; the old state.AcceptRuntimeSnapshot binds them to the
lower host. Save precedes socket changes, old public type names alias one JSON
layout and high-water remains in the same authenticated Journal. L2 platformstate
contains original atomic-write and OS-lock implementations behind old state calls.
This does not complete Runner scheduling/TLS/HTTP/credential or other Agent platform
separation, nor prove native-platform, persistence or timing equivalence.

Agent executionidentity/executionchannel now declare generic credential/main-Control
channel ports without importing native certificate/root/client implementations.
Runner consumes them with its existing native types; L2 agentidentity/controlchannel
contain original file/crypto/CA/TLS/HTTP effects. The default New and explicit
NewWithProviders bind trusted implementations, not a new plugin or authority. Runner
still owns Probe invalidation, in-memory certificate switch and Guard update. Raw
bootstrap, scheduling and Probe/telemetry-specific client operations remain mixed
source debt; the main-channel extraction does not certify those paths.

Agent runtimeplatform/ platformruntime separate bootstrap and operational scheduling
contracts from native reads, timers and context deadlines. Original constructor
and explicit migration order remain with Runner; new effect injection grants no
authority and old constructors keep native defaults. Probe instance/claim/delivery
and telemetry HTTP effects use executionchannel.Auxiliary; native profiles perform
only their original transport/URL effects. Caller-owned bodies retain bounded read,
deferred close and ACK/one-use/freshness decisions in their original owners. Telemetry
still has independent pools and bounded no-retry exporters. Host resources now join
process observations under L2 platformobservation with old aliases. CLI enrollment,
concrete execution/Probe internals and remaining native helper bindings remain debt.

Local observation/entropy/file/log effects are now explicit injected providers.
L1 runtimeplatform declares Entropy/MeasurementFiles/LocalLog; L2 platformruntime.Local
retains secure reads, stderr and the same measurement paths/modes/atomic writer.
Runner still controls sampling order, lock scope, failure handling and final writes.
Telemetry epochs and Probe IDs use the injected secure source at their original
locations; old helper signatures delegate to native providers. Additive
NewWithLocalServices requires all explicit services; older constructor requirements
do not change. These are trusted compiled-in effects, not a plugin security boundary.
No authority, Journal layout, retry policy, product feature or compatibility default
changes here, and current-source behavior remains unverified.

First enrollment now has its own L1 executionenrollment coordinator over generic
native root/client/reply types, with L2 agentenrollment retaining original native
file/key/CSR/CA/certificate/HTTPS/JSON operations. The CLI remains the existing
composition, preserving flags/environment/path/proof/inspection/lock behavior and
its old enrollment function. Journal initialization and atomic writes use the
original state owner. The final MAC-key/Journal/certificate/output/body/idle order
is retained in source intent through a completion hook inside deferred cleanup;
there is no recovery/reset/retry or execution-authorization extension. See
[enrollment boundary](agent-enrollment-v1.md) and unexecuted item 32. Control/Probe/
trust, other CLI/native composition and native engine/wire debt remain open.

Control's native Probe config/digest/policy and numeric endpoint projections now
use public nativeexecution helpers. Runner keeps live binding/Guard/Ticket/instance/
lock/once ownership; projection is not authority. observationtrust is explicit L2
public trust plus native bounded TLS handshake, with original Probe wrapper/error/
budget alias and caller-owned socket lifetime retained. Numeric egress parsing/
policy remains its existing L2 adapter. No network feature, fallback or echo is
enabled. Probe executor/Gate/counters/echo native effects, other Control private
compatibility and engine/wire internals remain debt. See
[Probe native boundary](agent-probe-native-boundary-v1.md), unexecuted item 33;
none of this supplies foundation or parallel acceptance evidence.

Probe executor/Gate/counters now consume existing L1 Scheduler/Entropy and an
additive generic native-type-parameter Dialer port. L2 platformruntime owns the
original zero-configured native dialer. Old Probe constructors and Control/Runner
provider scope stay native by default; explicit Effects constructors require all
providers. One global admission map and the original Gate/replay/counter owners
are retained, with original clock/random/deadline/ticker/cooldown/end-time points
delegated, not replaced by authorization. Probe remains a product-specific mixed
owner with native value/net/address/wire/default/echo dependencies, not a new L1
authority. See [Probe effects boundary](agent-probe-effects-v1.md), unexecuted
item 34. No whole-source compliance or acceptance gate is established.

Notification endpoint/outbox storage interface 1 now provides parameterized L1
persistence envelopes/ports and synchronous value callbacks. Product enum/payload/
rule definitions stay L3 through existing specialized names; L2 SQL imports only
lower contracts/Core and SQL helpers. Existing root composition supplies original
owner parser bindings at the old decode points. Legacy zero-argument store classes
retain precise public wrappers/count-get override hooks, not duplicate SQL or new
composition-root exemptions. Notification transactions/ownership/dispatch do not
change here. See [notification storage boundary](notification-storage-boundary-v1.md)
and unexecuted item 35; mixed value/native/vault/sender and other SQL debts remain.

Control Probe history/finite-plan storage interface 1 now parameterizes persistence
values and supplied-transaction ports without upper wire/enum/parser dependencies.
Existing product names specialize those lower fields; record capture and issuance
remain with original owners. Two L2 stores import only lower contracts/Core/SQL,
with original synchronous L3 parser/digest bindings. Active-plan expiry conversion
and savepoint failure classification are explicitly L3 callbacks, not lower
business decisions. Existing roots and recovery bind the lower implementations;
old zero-argument/static/get/lock/put compatibility remains precisely recorded.
See [Control Probe storage boundary](probe-storage-boundary-v1.md) and unexecuted
item 36; native product values/other SQL/full-source acceptance remain open.

Observation metadata/audit read storage interface 1 separates lower SQL/native
mapping from L3 config/kind interpretation and audit vocabulary/projection.
Untrusted audit columns do not promise a valid product record; original closed
validation and metadata/trust checks remain at their old points. Existing roots
bind public providers; precise zero-argument/head/count/static compatibility
entries remain without duplicate SQL/new roots. See
[observation read storage](observation-read-storage-v1.md), unexecuted item 37.
Other diagnostic/station/native/value debt and acceptance remain open.

Diagnostic/station storage interface 1 now provides detached lower diagnostic
records, parameterized policy/audit/event envelopes and supplied-transaction
storage/passive fact ports. L2 owns original SQL/native projection and single
station row-mapping helpers; L3 keeps rule/state/reason/threshold/evaluation and
original type/error-code interpretation without earlier full validation. Existing
server binds lower providers; old zero-argument/public/policyCount compatibility
is precisely recorded. See [diagnostic/station storage](diagnostic-station-storage-v1.md),
unexecuted item 38. This narrows two SQL reverse dependencies; other mixed product,
native/value/telemetry/HTTP/Agent and full-source debt remain unclosed/unaccepted.

Raw telemetry and rollup storage interface 1 parameterize lower heads/points/
accepted mappings and stored observation/bucket envelopes without upper wire or
product imports. Existing four raw SQL stores and two published-provenance adapters
now reference lower contracts with their native implementations retained. L2
aggregate SQL receives original L3 parser/fold/limits at synchronous old points;
old aggregate construction is a precise wrapper and the existing server shares
one lower store on original accepted-raw transactions. See
[telemetry storage boundary](telemetry-storage-boundary-v1.md), unexecuted item 39.
Application/native-value/HTTP/Agent and full-repository debt remain unclosed;
raw provenance and aggregate arithmetic never grant execution or health status.

Observation metadata value/effect separation now places native IP/URL/URN/DER/
X509/public-key/echo-wire/UTF8/UUID/digest/clock operations behind public L2
functions. L3 retains scoped trust/config/window/revision/receipt rules and original
transaction/admission sequencing. Synchronous native fact callbacks preserve
validation and hash order in intent. L1 request identity framing takes an explicit
digest callback; the old shared function and observation helper names remain
compatibility entries. HTTP removes only its business-private observation helper
import. See [observation value boundary](observation-value-boundary-v1.md), unexecuted
item 40. Other native/product/HTTP/Agent and whole-source boundaries remain open.

Optional observability application owners now bind native UUID/digest/JSON/base64/
UTC/ISO/monotonic/byte and selected wire-codec operations through public L2
compatibility functions. L3 keeps owner policy, authorization, cursor framing,
transaction/replay/rollback, handoff/sender and Probe/Runtime authority; old
constructors/default captures and signatures remain. No native helper grants
authority, leaks notification keys or changes feature defaults. See
[observability application effects](observability-application-effects-v1.md),
unexecuted item 41. Remaining application/query/HTTP/Agent and full-source debt
stays open.

Observability value helpers now share public L2 URL, digest/time/JSON/bytes/base64/
clone and staged-echo-frame effects. Notification infrastructure and application
reuse one URL parser; Probe plan/run and rollup values retain their L3 rules and
arithmetic. No DNS/secret/permit/echo execution or authority is moved. See
[observability value codecs](observability-value-codecs-v1.md), unexecuted item 42.

HTTP composition now uses public L2 JSON/UUID/UTF8 and existing Runtime/Transit/
Probe/observability codec bindings; generic page arithmetic is L1 while product
filters remain L3. Routes/auth/TLS/body/error behavior stays in the HTTP owner.
See [HTTP codec boundary](http-codec-boundary-v1.md), unexecuted item 43.

Probe observation service resolution now consumes public L2 Probe/TLS/echo context
parsers and digest while L3 keeps metadata authorization/window/version/transport/
clock/refusal policy and resolver shapes. No permit/network/echo execution moves.
See [Probe observation codecs](probe-observation-codecs-v1.md), unexecuted item 44.

Probe machine adapters now consume public L2 Probe parser/JSON/UTC-ISO/default-clock/
digest bindings while L3 retains session/freshness/permit-owner/ack/refusal behavior
and disabled execution. See [Probe machine codecs](probe-machine-codecs-v1.md),
unexecuted item 45. Probe permit/native and Agent source debt remains open.

The single Probe permit owner now consumes public L2 parser/result/proof/JSON/ISO/
fingerprint/default-clock bindings while retaining its L3 authority, budget, locks,
replay, history and disabled execution. See [Probe permit codecs](probe-permit-codecs-v1.md),
unexecuted item 46. Agent native/state acceptance remains open.

Probe permit state validation now uses public L2 context/selection/invocation digest
and ISO bindings while retaining pure L3 field/state/binding/TLS/echo refusal rules.
See [Probe permit state codec](probe-permit-state-codec-v1.md), unexecuted item 47.

## 4. Public Versions, Errors, Logging And Configuration

Core/Forward v1, runtime kernel interface 1, framework interface 1, Runtime host
interface 1, Runtime resource/ledger/Relay, Node authority and Identity access
interfaces 1, relay configuration and intent/idempotency storage interfaces 1,
notification/Probe history/observation read/diagnostic/station/telemetry/rollup/
observability application effects interfaces 1,
compatibility entry interface 1 and the sample module contract 1 are
separate scopes. Their initial source-candidate declarations do not change ADP/3,
execution extension 1, assignment schema 1 or package `0.1.0`.

Agent executiontime, executionstate, executionidentity, executionchannel,
runtimeplatform, runtimeobservation, executionenrollment and their native adapters have separate
source-candidate interface version 1 declarations. Old authorization/state names
and default-provider paths remain compatibility entries; no protocol, Journal/MAC,
lease/skew/clock policy or protected-state migration version changes here.

L0 decisions have explicit typed input/preconditions and no logging/transport
effects. L1 retains `ControlError` code/status/retryable at the existing service
boundary; making this transport-neutral later is a separate contract change.
Unexpected owner/storage failures propagate to the existing safe HTTP mapping;
adapters do not convert an unknown failure into success, authorization or retry.

New modules receive `ModuleLogger` from composition. Events use stable module/code/
level and optional requestId; do not log raw payloads, keys, tokens, certificate
details, SQL credentials or arbitrary exception messages. Sink failure must not
change command completion or authority; the example isolates its optional log sink.
Existing operational log calls remain pending normalization, not silently replaced.

Composition reads environment/configuration and passes validated finite values.
L0 never reads configuration, time or I/O. L3 does not probe OS/versions or discover
external secrets; L2 encapsulates those differences. Owners retain validation,
budgets, flags, cancellation and I/O deadlines. Common helpers do not invent them.

## 5. Public Extension And Parallel Work

The [example](../../examples/foundation-extension/README.md) provides an independent
L3 import-preview module using only public L1 interfaces and an L2 format adapter.
Its composition supplies demonstration authorization/transactions and request
drain. It is source-only and unexecuted, so it does not yet satisfy the runnable
example acceptance gate. Real publication would call the original Forward command.

Once the readiness gate passes, module tasks use independent branches/worktrees
and directories, frozen public contracts, local module docs and matching tests.
Changes to frozen foundation interfaces first use the
[change request](../templates/foundation-change-request.md). An approved private
refactor can retain old aliases; breaking behavior requires a recorded migration
under the applicable direct or standing source authorization.
No silent field additions, fallback protocols, copied host logic or foundation
modification under a feature task is permitted.

## 6. Plan A1 Registration Storage Continuation (2026-10-19)

The existing Probe instance and qualification records now specialize L1 persistence
envelopes through the framework public entry. L2 stores keep native row/sentinel/
marker mapping and original SQL; synchronous L3 value providers retain the original
state/window/transition checks. Existing roots bind those providers, while old
zero-argument/static paths remain precise compatibility bridges. There is no new
instance, Gate, issuer, budget, pool, transaction or authority.

Probe instance time reads use the public dynamic L2 helper at the original five
points; default-function capture in qualification remains separate. Public parser
exports are unique references to the same existing functions. See the
[registration storage boundary](probe-registration-storage-v1.md) and readiness
item 48 for unexecuted compatibility cases and remaining mixed Probe SQL/application
debt. The execution plan permits exclusive-file subagents within this foundation
task following the human's latest authorization, not parallel upper modules or
verification. Source placement and this declaration do not establish acceptance.
## 7. Plan A1 Evidence Read Continuation (2026-10-19)

The framework public entry now owns MachineSessionEvidence/Reader and
PublishedRuntimeEvidence/Reader, with the same existing stable RuntimeSnapshot
value type and no parser/product dependency. Probe public names specialize these
contracts; its intent reader reuses RuntimeForwards. Three existing native MySQL
readers now depend directly on lower contracts rather than Probe L3 type paths.
Their original query/native mapping stays in L2, without duplicate implementations.

Forward Probe decisions, authorization and issuance remain L3; target, dynamic
clock/ISO, request digest and selection use existing public L2 bindings. Export
integration fixes preserve original function objects. See
[evidence boundary](probe-evidence-read-v1.md) and readiness item 49 for planned
exact-source acceptance. Remaining permit persistence and other mixed/private/wire
source are not exempted; no foundation acceptance or parallel feature gate opens.
## 8. Plan A1 Permit Persistence Continuation (2026-10-19)

The framework public entry defines parameterized permit storage records and
transactional/value ports; the old Probe store specializes them. L2 owns the one
original SQL and native persistence implementation. L3 supplies original product
measurement/context, permit and result validation through synchronous providers.
Explicit Control/recovery composition does not grant L2 a reverse product import.
The old stateless zero-argument class, public methods, subclass override points
and static recovery form a precise compatibility bridge without copied SQL.

See [permit storage boundary](probe-permit-storage-v1.md) and readiness item 50
for unexecuted lock, decode, result-version, rollback and recovery cases. No new
authority, budget, schema, wire or execution capability is introduced. Remaining
Probe application/private/type/wire and other owner dependencies are not exempted.
A1 and the foundation are not accepted; the upper-module gate remains closed.
## 9. Plan A1 Public Owner Collaboration (2026-10-19)

The Probe and observation declaration owners now have owner-local rules and public
entries. Application consumers no longer need private application implementations
for machine/qualification checks, permit/measurement values or service references
and metadata validation. Old value paths alias the same implementation. The public
declaration reader retains original caller-Tx head/revision signatures and does not
publish, sign, dial, authorize execution or own a credential.

See [owner call chains](probe-owner-collaboration-v1.md) and readiness item 51 for
source intent, exact compatibility entries and unexecuted acceptance. The existing
state owners, SQL, clocks, result/version distinctions and feature gates remain
unchanged. New owner entries do not certify remaining wire/native dependencies or
open A1, foundation or independent upper-module acceptance gates.

## 10. Plan A1 Result Codec And ACK Follow-Up (2026-10-19)

The public L2 result codec restores its existing export route through a direct
alias to one native implementation. Original version parsing/body/digest, stored
format checks and three result ACK constructions stay below product coordination.
The caller supplies time and measurement facts; it retains identity, current
binding/proof, admission/budget/history, freshness and committed-result decisions.
No adapter imports the Probe owner or issues authority. Public wire aliases retain
the same types; ACK executionEnabled:false and health:unknown are unchanged.
See the owner collaboration follow-up and readiness item 52 for unexecuted evidence.
Other wire/native/default and whole-source classification and acceptance stay open.

## A2 Public PathTemplate Rules (2026-10-19)

Path owner public interface candidate 1 contains original template parsing, native
capability declarations, limits and head/revision validation. Cross-owner consumers
use this L3 contract and old named exports directly alias the one implementation.
Template application coordination retains its original owner/transaction behavior
over existing L1 and public L2 effects. SQL adaptation and remaining Path/Ingress/
Transit work are not exempted. See [Path owner](path-template-owner-v1.md) and
readiness item 54; source placement is not boundary or behavior acceptance.

## A2 PathTemplate Storage (2026-10-19)

The original template persistence now uses L1 parameterized records/transactional
ports and the existing public read paging window. One L2 MySqlPathTemplateStore
contains its SQL/JSON/UUID mapping without a product/application import; Control
binds the public Path configuration. Original public Path records/ports specialize
the lower shapes. The zero-argument MySqlPathTemplates is a precise compatibility
wrapper, not a reverse dependency exemption or an additional state owner. See
[storage boundary](path-template-storage-v1.md) and readiness item 55 (unexecuted).
Remaining Path/Ingress/Transit, A1 residuals and full classification stay open.
Source placement and declared inventory do not establish acceptance or equivalence.

## A2 PathBinding Owner And Persistence (2026-10-19)

Original exact-template selection and expansion live in the public Path owner;
old contract functions alias the same implementation. Lower L1 provenance records
and transactional ports reuse existing Forward and paging types, with separate
sequence lookup rather than a new required product-writer method. One L2 store
owns the original SQL and numeric sequence rules; Control binds it explicitly.
Original async zero-argument storage methods remain precise compatibility entries.
PathBindings retains product validation, original transaction/Forward lock and
public native effects; history is never cleared and previews grant no authority.
See [PathBinding boundary](path-binding-owner-v1.md) and readiness item 56, planned
only. Remaining group/publication/Ingress adapters are explicitly migration debt,
not new L2 exceptions; all A1/native/full-source and acceptance gates remain open.

## A2 PathGroup Owner And Persistence (2026-10-19)

Original group configuration/selection rules and the same mutable limits now use
the public Path owner. Lower metadata records parameterize product configuration;
original group binding records/ports reuse public Forward and paging types. One
L2 file owns both original SQL implementations. Control binds the lower stores;
old zero-argument classes keep async prototype/subclass methods, including the
lazy publish -> this.count call through a trusted compatibility callback. Original
Scope/head lock order, quota/CAS differences, group-history LIMIT 64 and original
Path current/at provenance stay intact in source intent. Application-private product
validation remains with PathGroups over public providers, not in the SQL adapter.
See [PathGroup boundary](path-group-owner-v1.md) and item 57 (unexecuted). Remaining
publication/Ingress/Transit, A1, Agent/native/Runner and full-source work stay open.

## A2 PathPublication Owner And Persistence (2026-10-19)

The public Path owner contains original publication/state/plan rules and synchronous
refusal values. L1 parameterizes Plan/Outcome and retains operation/head/store
shapes; L2 mysql-publication-store.ts owns original SQL/savepoint order. Control
binds the original classifier, while precise old zero-argument methods preserve
lazy count/event dispatch without copied SQL. Product validation, outer transaction,
Forward execution and conditional compensation stay with their original owners.
See [publication boundary](path-publication-owner-v1.md) and item 58 (unexecuted).
Remaining Ingress/Transit, A1/native/Runner/full-source classification and all
acceptance gates stay open; source placement is not equivalence or acceptance.

## A2 IngressGroup Owner And Persistence (2026-10-19)

A dedicated public Ingress owner contains the original group/selection/input/plan
rules, directly aliased by the old contract path. Lower parameterized group ports
and one original SQL store remove product/paging imports from that adapter; Control
binds the public config and the old zero-argument class preserves lazy count calls.
Original member traversal/order, distinct ingress Nodes, actor-dependent reference
checks, resolver responsibilities, locks/quota/CAS/audit and native effects stay
with their owners. See [IngressGroup boundary](ingress-group-owner-v1.md) and
readiness item 59 (unexecuted). Deployment/migration/Transit, A1 residuals and broad
Agent/Runner/full-source work remain open; no boundary or behavior acceptance.

## A2 IngressGroup Owner And Persistence (2026-10-19)

Ingress has public interface candidate 1 for its original shared group, selection,
deployment-input and plan rules. Group heads and parameterized revisions/storage
ports live in L1; one lower SQL store keeps original raw projection, lock/quota/CAS
and audit behavior without a product import. Control binds the store explicitly;
the old zero-argument methods and dynamic count override remain precise entries.
Application-private member and persisted-state rules retain original actor-dependent
checks and resolver ordering over public Path/Ingress and L1/L2 providers. See
[IngressGroup boundary](ingress-group-owner-v1.md) and item 59 (unexecuted).
Deployment/migration/Transit, A1/native/Runner and full classification remain open;
source placement and declared inventory do not establish foundation acceptance.

## A2 IngressDeployment Owner And Persistence (2026-10-19)

L1 parameterizes original deployment Plan/Outcome and the encoded group index,
reusing lower head/Operation shapes. One L2 store owns original filtered SQL and
savepoint order; Control explicitly binds the same public refusal provider. The
legacy zero-argument class retains count/event dispatch and a direct filtered list
COUNT. Public Ingress also owns the original shared origin/lineage/migration rules
with direct old aliases; deployment private validation and Forward authority stay
in their original owners. See [deployment boundary](ingress-deployment-owner-v1.md)
and item 60 (unexecuted). Migration SQL/coordination, Transit, A1/native/Runner and
full classification remain open; source placement does not prove acceptance.

## A2 IngressMigration Owner And Persistence (2026-10-19)

L1 parameterizes the original source/target group index and Plan/Outcome storage
contracts. One L2 store owns original migration SQL/savepoint behavior with the
public refusal provider explicitly bound in Control. Precise old zero-argument
count/event methods remain aliases to that implementation, not copied SQL. The
L3 coordinator keeps lineage/current-state, replay/CAS, add/update/remove and
conditional compensation decisions over public Ingress/Path and L1/L2 services.
See [migration boundary](ingress-migration-owner-v1.md) and readiness item 61
(unexecuted). Transit, A1 residuals, Agent/native, Runner and whole-source
classification remain open; declared placement is not foundation acceptance.

## A2 Transit Negotiation Owner And Raw Machine Evidence (2026-10-19)

L1 describes raw lock-bound machine evidence, without product admission decisions
or eager JSON normalization. One L2 reader retains original FOR UPDATE SQL and
returns the original raw row. L3 Transit negotiation retains identity, current
boot/session, credential, capability and retained-generation refusal ordering.
Its public API retains the same wire aliases through L2; the pure ACK formatter
receives sampled time and never grants execution. Control explicitly assembles
providers and the old class remains a precise single-argument compatibility entry.
See [Transit negotiation boundary](transit-negotiation-owner-v1.md) and readiness
item 62 (unexecuted). Other Transit stores/coordinators and full-source inventory
remain open; this placement is neither foundation acceptance nor live Transit.

## A2 Transit Preview Delivery And Shared Rules (2026-10-19)

L1 carries raw delivery evidence and transactional storage, without parsing facts
or choosing product actions. One L2 store owns original preview outbox/receipt SQL,
with full locked enqueue journal and distinct minimal poll/report projections. L2
codec functions retain original envelope and ACK formats; L3 keeps machine checks,
lineage/reservation decisions, replay/high-water/freshness and receipt/CAS ordering.
The public Transit owner supplies shared preparation/coordination types, retained
stage validation and offline step projection. Old value/type entries remain precise
aliases; the restored step path exports the existing single implementation.
See [delivery boundary](transit-delivery-owner-v1.md) and readiness item 63, which is
unexecuted. Staging/coordination SQL, preparation/reservation implementations and
full-source classification remain open. No execution authority or acceptance follows
from source placement; one Runtime ledger and original Agent authority/Journal remain.

## A2 Transit Offline Coordination (2026-10-19)

L1 carries raw journal evidence and an explicit transactional storage port, with
parameterized phase strings and opaque high-water JSON. One L2 adapter owns the
original stage/session/slot/journal queries and journal insert/revision-plus-digest
CAS. L3 TransitCoordinationService retains actor, stage integrity, freshness and
sorted ownership, proof authentication, state transitions and recovery policy.
Control binds explicit providers; the old single-argument journal forwards its
own public async methods through a lazy db bridge to the single implementation.
The current Transit entries are under modules/runtime; the earlier src/runtime
lookup was wrong and required no recovery. See the [current Control source map](foundation-control-source-closure-v1.md)
and [coordination boundary](transit-coordination-owner-v1.md). Readiness item 64
is unexecuted. Staging/preparation/reservations, A1 residuals, Agent/native, Runner
and whole-source classification remain open. No foundation/upper-module gate opens.

## A2 Transit Preparation And Exclusive Runtime Resources (2026-10-19)

The public Transit owner keeps original offline path/resource-set, peer, policy,
Fence/generation and expiry rules. Profile/Endpoint references use their public
contracts; Node facts reuse L1. L2 owns original Profile JSON parsing, CIDR/time
aliases and pure Transit Intent projection/JSON/parser framing. The deterministic
compiler still returns executable:false and retains original freeze/error order.
The exclusive resource algorithm is moved, not copied, into the same L1 Runtime
resource owner. Its required storage reuses existing MySQL ensure/assign SQL with
original Node-row count, minimal slot and raw capacity projections. The existing
RuntimeResourceAccess/reserveRelay contract and behavior remain unchanged because
same-owner refusal, Fence validation, locks and capacity timing differ. Legacy
functions bind one stateless host/store and the original late policy source. No
second ledger, connection, transaction, execution route, schema or history reset
is introduced. See [preparation/reservations](transit-preparation-reservations-v1.md).
Readiness items 65/66 are unexecuted; staging/abort/protected release and remaining
foundation owners stay open. Source placement is not acceptance or an open gate.

## Transit Staging And Exact Resource Release Follow-Up (2026-10-19)

Public TransitStagingService consumes public product/L1/L2 providers. Raw stage
storage contains only original stage writes and read-only Runtime/history
observations; exact slot writes stay in the existing Runtime SQL owner. L1
RuntimeReservationRelease retains complete retained-set verification before any
owner/Fence/generation release, with the caller's historical proof and same Tx.
The original five-argument wrapper binds the same implementations lazily. See
[staging boundary](transit-staging-owner-v1.md) and readiness item 67, unexecuted.
This does not prove whole A2/source classification, behavioral compatibility or
foundation acceptance. No checks/tests/CI/commits/pushes/delegation ran.
## Passive Audit And Forward Diagnostic Owners (2026-10-19)

Original Audit and ForwardDiagnostics implementations now live in independent L3
public owners, with original APIs, vocabulary/read contracts and policies. Audit
read projection remains an injected L3 assertion over unchanged L1/L2 storage;
Station reads public Audit error codes. Diagnostic uses public Probe validation
and L2 retained-result framing/body projection with the original catch boundary.
Server/HTTP bind the same public services. Precise old class/type/constants-only
leaf aliases do not authorize new private imports. See
[owner chains](passive-diagnostic-audit-owners-v1.md) and readiness items68/69,
entirely unexecuted. Other mixed owners and complete classification remain open.
## Station And Notification Public Ownership (2026-10-19)

Original Station/Notification services, rules, product APIs/records/policies and
storage values now live in independent public owner directories. Station owns the
same supplied-transaction event handoff; Notification consumes public Station
rules/types. L1 notification-effects-ports owns the original Vault/Sender/lease/
result declarations, unchanged. Existing native Vault/Sender import only lower
contracts and keep all platform/security/dispatch behavior. Existing lower SQL
and same-instance server wiring remain. See
[owner chains](station-notification-owners-v1.md), readiness70-72 unexecuted. Old
leaf aliases are precise compatibility, not a general private-import exception.
Other mixed owners and complete source/type classification remain open.
## Probe History And Finite Plan Public Owners (2026-10-19)

Original bounded history recorder/read and finite plan services, rules/contracts/
APIs/policies/storage values now live under independent public owner roots. L1
history/plan envelopes and L2 SQL remain unchanged. Original Probe command API/
acceptance declarations now live in the Probe owner, with exact old leaf aliases;
plan issuer and history recorder still join original Tx/authority owners. L2
formats retained echo facts and re-exports the existing service-selection parser.
No new parser, live echo issuance, filter, flag or scheduler behavior. See
[owner chains](probe-history-plan-owners-v1.md), readiness73/74 entirely unexecuted.
Other owners and full source/type/default/bridge classification remain open.
## Public Telemetry Facets And ACK Projection (2026-10-19)

Five original telemetry services, exact shared API/contracts/policies and rollup
rules/provider now live under telemetry-owner/public.ts. Per-class state, family
stores and budget/flag/mapper distinctions remain. Existing L1 contracts and L2
SQL/database/mappers are unchanged. The L2 public entry gains original four pure
ACK projections and same wire-type aliases; product count guards stay L3. Old
application/flat/runtime mapping/policy/value sources directly alias canonical
leaves; server/HTTP bind same instances. See
[owner chains](telemetry-public-owners-v1.md), readiness75-77 entirely unexecuted.
Other application/HTTP/A1/Agent/Runner and full classification remain open.
## Observation Declaration Service Follow-Up (2026-10-19)

Original manager-declaration command/query/API/contracts/storage values now live
under observation-service-owner/public.ts with existing read/reference rules.
L1 contracts, lower SQL and L2 providers are unchanged. Old application/flat paths
are precise leaf aliases; same server/Control/HTTP roots and wrapper hooks remain.
See [owner chain](observation-service-owner-v1.md), readiness78 unexecuted. Inert
metadata, trust projection and availability flags do not grant execution or health.
A1/application/HTTP/Agent/Runner/classification and acceptance remain open.
## Control Probe Registration Public Chain (2026-10-19)

Original hello/instance/machine-adapter/qualification coordinators and exact API/
instance/evidence/measurement contracts now belong to probe-owner/public.ts.
Original L1 stores, lower SQL, time/lock/generation/recognition/ACK order and old
leaf aliases remain. See [chains](control-probe-registration-owner-v1.md), planned
readiness79/80. Remaining A1 and other A2/A3/A4/A5 and acceptance stay open.
Human source-task delegation authorization does not authorize verification.
## Source-Task Agent Integration (2026-10-19)

Human explicitly allowed source-task subagents; feature module gate is still
closed. Original Probe preflight/command/resolver and remaining product contracts
now live inside the public L3 owner; canonical private leaves replace old flat
implementation paths with exact aliases. Original Console query coordinator/
projection/rules/API has an independent public L3 owner, reusing required L1
stores and same existing root providers. Probe native child is explicit L2 for
original destination/echo socket/format/default provider bodies; parent keeps
product checks and one global admission/Gate/counter. Existing nativeexecution
L2 owns original Runner wire/assignment/catalog; Runner keeps state/authority/
Journal/locks/lifecycle and private registry refusal order.

See Control Probe preflight, Agent Probe native, Runner continuation and Console
owner documents in the index. Readiness81-85 planned only. Public net.Conn and
native/wire references, remaining Probe/Control command/query/HTTP, private registry,
engine/authority/Journal/CLI and complete A5 classification remain source work,
not blanket package exceptions. No validation or acceptance is inferred.
## Original Probe Permit/Machine Source Continuation (2026-10-19)

Six-part scope: L3 original single permit authority and five machine adapters
reuse L1 Tx/Scope and public product instance/qualification/store/history/plan plus
L2 wire/time/crypto effects. No frozen foundation or product semantics change;
full original classes move to existing public owner with exact old class leaves.
Same Control instances, store/budget/clock/history/qualification/callbacks remain,
with original time/lock/error/ACK/version distinctions and no new echo issuance.
See control-probe-permit-machine-owner-v1.md and readiness86-88, entirely planned.
Named old application paths are now aliases; empty named mixed list is not whole
A1/A5 compliance, behavior equivalence or gate evidence. No checks/tests/CI/builds/
experiments/Git writes. Human source-agent authorization remains narrow to current
source task; upper-module/acceptance/physical/release gates stay closed/unverified.
## Further Query/Command And Agent Source Integration (2026-10-19)

Original Control/Transport/Tunnel query coordination/projections now have public
L3 owners; original Identity Access and Node commands/APIs/effects live inside their
existing public owners. Original native catalog/logical tunnel views have public
owners, with Path template/binding and Forward command APIs canonical in their
own owners. Exact old application/Runtime type leaves remain. Existing Control/HTTP
roots bind same instances, required L1 stores, values, effects and optional resolver.
L2 exposes only original token hash/catalog constants and existing time/wire effects.

Nativeexecution L2 additionally owns exact original legacy header/declaration rules
and echo endpoint mechanics, around unchanged Runner duplicate-ID/clone/strict-last
and authority/current-instance/callback points. Readiness89-97 is planned only.
See indexed owner docs and Agent source inventory. Remaining control commands/
HTTP and Agent I/O/JSON/wire/time/native references/default chains are explicit
freeze blockers; no whole package or bridge list is an acceptance exemption.
No checks/tests/CI/build/experiments/Git writes or foundation/feature gate opening.
## Forward/Profile, Passive Node/Relay And Agent Representation (2026-10-19)

Full original Profile/Forward commands and collaboration ports are canonical in
existing L3 owners; old class/API/type paths exact aliases. Passive Node rules/
host/product contracts and Relay preview have public product owners. Original raw
report context/provenance/evidence/reader declarations are public L1; lower MySQL
imports them directly with unchanged SQL/cancel body. L2 owns original observation
native create/schedule/clear and Agent HTTP/JSON/body/result-wire operations. Parent
product state, budgets/claim/report-once, trust/currentness, time decisions and
original different errors stay. Existing Control/HTTP roots integrate same providers.
Readiness98-105 planned only, no checks/tests/builds/CI/experiments/Git writes.
Remaining Path/Ingress/HTTP/private Runtime and Agent formats plus complete A5 are
source blockers; no whole A2/A3/A4/foundation/feature/physical/release acceptance.

## Path/Ingress And HTTP/Agent Representation Continuation (2026-10-19)

The original eight Path/Ingress coordination classes and their full API/flat type
declarations are canonical in the existing public owners; old entries are exact
leaf aliases. Original Path references now consume public Node/Transport/Endpoint
contracts over the same Tx; original Node execution declarations are canonical
public types. Path/Ingress limits retain original values, identity, mutability and
migration freeze in local leaves with exact old combined aliases. Root instances,
lower stores, Forward callbacks and cyclic origin resolution remain original.

The complete existing HTTP entry was read through its compatibility wrapper.
Original TLS/body/error/console read implementations are public L2 helpers; HTTP
retains ordered lifecycle/admission/auth/routes/limits/responses. Remaining URL/
header/query/native-type/default classification is explicit, not a blanket adapter
exemption. Nativeexecution owns original qualification/delivery/v1 status codecs,
wire times/service context and report/drain/Snapshot/credential representations;
parent keeps burn, authority/Guard/Journal, budgets, samples, callbacks and history.
Readiness106-110 planned/unexecuted. No checks/tests/CI/build/experiments/Git writes.
Other runtime/private/default/Agent formats and complete A5 inventory remain open.

## Execution Wire And HTTP Query Source Continuation (2026-10-19)

L2 owns original three-version status request/response, four-version result ACK,
neutral generic result fields/JSON and staged echo context/reflect representation.
The parent keeps original family/receipt/service/challenge checks, once-only report,
watch/cancel/publish, Guard, conservative monotonic projection/entropy/quantization/
report cutoff and native/injected samples. Shared ParseWireTime covers original
Probe/Snapshot/Hello/Relay text points without moving provider/history/short-circuit
decisions. Old Probe parse signature remains a compatibility function.

Original fifteen HTTP query files are precise native or Console canonical aliases.
L2 holds only original external query representation and neutral records; Console
public supplies its local filter map/validator at the original extraction/filter/
page phases. No L2 product import, new default or generic parser normalization is
introduced. Readiness111-114 planned only; no checks/tests/CI/build/experiments/Git
writes or agents this turn. Remaining HTTP/native/default/engine/CLI/Runtime and
whole A5 source/type/legacy-consumer/removal/freeze inventory remain blockers.

## Runtime Product Coordination And Assignment Sources (2026-10-19)

Original Forward command executor/registry/native policy adapters and Snapshot
registry/Relay source are canonical in Forward L3, with local original contracts,
public Node/L1 facts/assignment ports and L2 compiler/catalog/clone. Original
Profile/Access/Node reconcilers are canonical in their Transport/Identity/Node
owners. Original authorization extensions, Node management/grant declarations and
all old Runtime/flat type/value aliases preserve shape and same supplied Tx.
Control retains original callbacks/instances/single ledger/collector, not new
composition roots or copied L1/framework code. Original native driver registration,
receiver/sort/freeze/detach and permission/capacity/cutoff policies remain intent.

Runtime directory source table identifies current class aliases, L1/L2 compiler/
contract aliases and legacy constructor/provider wrappers; their dependencies and
full consumer/default/removal conditions remain subject to A5, not exempted.
RuntimeHost's optional dynamic native clock/default and Date formatting are still
L1 debt subsequently addressed in source by FR-0002 below. Readiness115-118 remains
unexecuted; no checks/tests/CI/build/experiments/Git writes.

## Runtime Host Interface2 And Current Source Authorization (2026-10-19)

FR-0002 was explicitly confirmed and implemented as unverified source. L1 options
require now, RuntimeCodec requires parseTime/formatTime, and the host-specific
version is2. Missing/wrong-kind effects refuse before host policy/clock/I-O. All
time parsing/formatting stays at its original expression point through supplied
codec; the L1 native clock fallback is removed. L2 supplies the original native
parse/ISO functions; existing RuntimeController supplies dynamic nativeWallClockNow
without changing its positional constructor. Store/ledger/authority/transaction/
claim/publication ordering and data formats remain source intent, not acceptance.

Current Runtime query and telemetry type bridges explicitly name original exports
through public L1/product entries; staging uses public Transport type. Readiness
119/120 planned only. Other L1 type/native/default and full A5 consumer/removal/
candidate classification remains open. No tools/tests/CI/build/experiments/Git writes.

## Lifecycle And Remaining Host Time Effects (2026-10-19 Source Only)

FR-0003 now exposes background interface2 with required monotonic/interval effects.
L2 binds the original native operations; server's five tasks use explicit effects
and the old application one-argument entry wraps the same L1 lifecycle. Native
wrapper/direct L1 constructor identity intentionally differs. FR-0004 updates
Ledger/Relay/Node authority interfaces to2 and adds required time methods to their
existing compilers/codec; all native Date expressions and NodeService response
formats use the original L2 functions at the same transaction/sample positions.
Missing direct/custom effects intentionally refuse; old wrappers/default clocks
remain. Common error/lifecycle and six type aliases now use public framework.

The [manual source inventory](framework-lifecycle-effects-v1.md) records precise
effects/defaults/legacy distinctions and nine remaining direct L1 shared/runtime
type dependencies plus transitive Relay configuration. They are migration debt,
not exceptions to dependency direction; do not freeze from a shared-type list.
Readiness121-123 planned/unexecuted. Complete repository classification, consumers/
removal/frozen candidate and authorized exact-source acceptance remain outstanding.

## Common Runtime Values And Native Assignment Views (2026-10-19 Source Only)

FR-0005/0006 now give the original Policy and execution observation/drain facts one
canonical L1 declaration each, with exact old public type aliases. Only those two
contracts package leaves are lower source owners; native default policy, parsers,
schemas and wire envelopes/configs remain outside. No L0/Core expansion or copied
interface/schema is used to close a type dependency. Old DEFAULT_POLICY stays put.

FR-0007 advances Relay to3 and injects two minimal native assignment policy views.
Native methods return the original raw config/hop references at the old cast sites;
the host keeps lookup/digest/clock/short-circuit/authority/Tx decisions. New required
projection refusal follows the time guard, before options/policy copy. Original
constructor/defaults/static recovery remain. Ledger/Node stay2; value leaves are1.

See [actual source/remaining debt](runtime-common-values-and-relay-views-v1.md).
Readiness124-126 unexecuted. Nine framework files still use outer runtime wire
types, Relay profile remains transitive and Host has ADP-specific choices. Complete
source/type/consumer/default/candidate acceptance still requires further work.

## Runtime Values And Explicit Native Family (2026-10-19 Source Only)

FR-0008 now relocates one common set of assignment/resource/tombstone/snapshot and
Hello/report/ACK facts into the lower execution-values leaf. Native wire declarations
extend/alias it with original driver/envelope fields. Erased family types connect
the same Runtime/ledger/Relay/assignment/evidence providers; native constructors,
compilers, MySQL, Forward sources, Probe publication, HTTP and old wire-bearing
type aliases explicitly bind NativeRuntimeFamily. No native default or complete
wire schema moves to L0/L1, and no second state/authority/transaction owner appears.

RuntimeHost's exact protocol/capability predicates and Hello/ACK envelopes now use
required native codec methods at their original stages; foreign identity and all
publication/claim/authority/report decisions remain in the host. Candidates are
Host3/Ledger3/Relay4/evidence2/runtime values1, with unchanged ADP/driver/general
framework versions. See [actual graph](runtime-value-family-native-v1.md).
Readiness127-129 unexecuted. RuntimeRelayProfile's native ProfileConfig/transitive
configuration and broader HTTP/Agent/native/default/consumer/candidate work remain;
type/boundary/behavior acceptance is not established by source parameterization.

## Opaque Profile And Node Native Codec (2026-10-19 Source Only)

FR-0009 removes the remaining named native Profile type from the lower Runtime
ports by extending the existing family with an opaque payload. Native family and
explicit Transport/Endpoint/compiler/Transit/legacy aliases keep the original closed
schema outside L1. Configuration codec supplies the original native time formatter
at Transport get's existing transaction-bound property; missing custom formatter
intentionally refuses before effects. Candidates values2/Relay5/config2/Transport2.

FR-0010 Node authority3 moves original token/CSR/native support and fingerprint
prefix expressions to its existing codec. Host retains identity/listener/port/
protocol/target, credential/sign/replay/expiry, clock, same Tx and protected authority.
Native support takes the same facts reference; no cached capabilities or premature
Forward access. Constructor retains prior guards then refuses incomplete native
methods. No native schema, signer, authority, Journal or history reset is added.

See [actual source and limits](profile-node-native-boundaries-v1.md).130-134 planned/
unexecuted. Named source migration is not full framework/repository type/boundary/
behavior acceptance. HTTP/Agent/native/default/private/consumer/removal/candidate
and usable public example work continue under the source-only agreement.

## Control HTTP Public Integration And Native Transport (2026-10-19 Source Only)

FR-0011 separates original L3 product routes/options at api/public.ts (HTTP1) from
L2 Hono/Node/URL construction/types/context at compatibility/control-http/public.ts.
The native provider never imports aggregate product contracts. Routes consume public
native operations at original sites and keep product API calls/closed HTTP framing,
with old app/ports direct aliases and server public binding. Header/Console/withdrawal
formats reuse the original native owner. No new L1 layer or broad dependency exception.
Readiness135-137 unexecuted; full default/private/consumer/frozen candidate and all
contract/example/runtime acceptance remain open. See the updated HTTP source chain.

## Agent Journal And Runner Native Values (2026-10-19 Source Only)

FR-0012 executionstate interface2 moves original protocol3 recognition and physical
slot text behind existing SnapshotCodec. Native state keeps the exact predicate,
canonical physical/Transit keys and Runtime envelope; Runner/loader/import consume
them at original sites. Drain tuple and URL/path text stay with nativeexecution/
controlchannel. Host retains original lock/reload/validate/session/Fence/owner/phase/
save, and Runner retains persist-before-bind and Ticket/drain/ACK/tail authority.
Old native signatures/defaults remain; custom old codec method sets must migrate.

See [actual chains and remaining native types](agent-journal-native-values-v1.md).
138-140 planned/unexecuted. Existing lower Journal RawMessage/native tags/metadata,
other Agent wire/engine/telemetry/default/CLI, full source/type/private/consumer and
frozen candidate remain explicit source work; no L1/global package exemption or
acceptance follows from the bounded representation extraction.

## Agent Journal Facts And Native Record Binding (2026-10-19 Source Only)

FR-0013 source-migrates the specific FR-0012 RawMessage/JSON-tag/native-metadata
dependency. executionstate3 has tagless opaque Snapshot bytes and neutral format/
imported-history facts. State owns the exact original JSON records and native
entry names, with an intentional split from lower type identity. Pure converters
project every field/reference at original store/wrapper/Bootstrap/Runner boundaries;
Bootstrap/provider2 returns lower facts. Native wrapper returns current on error.
Original native format/MAC/history/save-before-bind remain intended, unverified.

See [actual mappings, consumers and migration](agent-journal-facts-native-v1.md).
141-143 planned/unexecuted. Direct lower/native assignment and lower serializers
must migrate; no serialization fallback, copied framework or second authority.
Full Agent/Control/engine/wire/default/private/type/consumer/CLI/frozen candidate,
public example and exact-source acceptance remain open.

## Offline Transit Native And Prepared Lifecycle (2026-10-19 Source Only)

FR-0014 adds minimal PreparedInstanceVersion1 while driver HostVersion1 stays.
Original offline controller now consumes native identity aliases/intent/Prepare/
error and existing time codec/Schedule, storing the same engine through Activate/
Close. Adapter preserves nil interface/partial pointer and separate JSON error;
owner retains original auth/Journal/mutex/time/phase/save-before-engine and guards.
Old native constructor/defaults remain; no new driver/Run/poll or production Report.

Exact native Transit engine/TLS/wire and intent/envelope codec files now have L2
source purposes, with original Forward/Relay/native contracts dependencies still
explicit pending debt and no edits to engine bodies. See [source binding](offline-transit-native-binding-v1.md).
144-146 planned/unexecuted; full Agent/Control/CLI/default/private/type/consumer/
frozen candidate, example and foundation/physical/release acceptance remain open.

## Agent Observation Wire And Native Host Family (2026-10-19 Source Only)

FR-0015 runtimeobservation2 makes Provider Host output generic and lower Host facts
tagless. Native platformobservation2 explicitly binds exact observationwire1 Host
DTOs, preserving native samplers/fields/references without conversion/copy. Old
direct Provider/type identity/serializer assumptions require explicit migration.
Four exporter DTO/encode/ACK/body and native format operations are L2; Runner keeps
same timeout/close/sample/counter/worker/retention/budget/cursor policy. Local Forward
snapshot embeds its native DTO beside private context; UDP concrete diagnostic read
is behind an exact native Instance adapter with one original Stats call.

See [actual chain and compatibility](agent-observation-wire-native-v1.md).147-149
planned/unexecuted, including Process suffix versus other ACK regex and standalone
Probe native sample/terminal offset distinctions. Full native dependencies/Agent/
Control/CLI/default/private/type/consumer/frozen candidate/example and acceptance
remain open; no whole-package exception, new authority or current behavior proof.

## Agent Command And Native CLI (2026-10-19 Source Only)

L3 agentcommand1 now retains original CLI dependency/mode/refusal decisions,
instance-lock lifetime and public Runner option projection. L2 agentcli1 owns the
original global flags and path/proof/key/inspection/token/enrollment/entropy/native
diagnostics path/signals. Existing main explicitly supplies native effects and
public control.New; old run/enrollment signatures remain. Native imports no product
command/control implementation. L0/L1 interfaces and control.Options identity stay.
Control offline plan directly consumes public compatibility compiler/framework facts.

See [actual public chain and compatibility](agent-command-native-v1.md).150-152
planned/unexecuted; original inspection --relay/proof behavior, lexical key predicate,
enrollment partial state and run cleanup are preserved in source intent. Control
main/client/server/ops/MySQL, native engines/wire and full consumer/frozen candidate/
example/acceptance remain open, with no new composition or package-wide exemption.

## Runtime Status And Parallel Native Source (2026-10-19 Source Only)

FR-0016 adds only raw persisted status storage1 to L1; original SQL is L2 and
correlation/freshness/recursive path aggregation is L3 runtime-status-owner1, with
explicit native JSON/time. RuntimeController/Control detail compose these providers;
old MySqlRuntimeObservations keeps a precise construction/prototype bridge. Complete
mysql.ts source is native UoW/migration adapter, without unnecessary extra wrappers.
153-155 planned/unexecuted; see [source chain](runtime-status-read-owner-v1.md).

Parallel authorized source work adds Control startup1/client-command1 owners and
explicit native env/file/format/URL/HTTPS effects; existing main/client bind original
server/release implementations. Original Forward/Relay/payloadstats source files
have precise native/public-consumer purposes, one same-owner multihop conversion,
direct existing egress policy and shared original budgets.156-158 unexecuted; see
[Control chain](control-startup-client-native-v1.md) and [Agent chain](agent-native-engine-owner-v1.md).

[A5 source closure](foundation-a5-source-closure-v1.md) and its current ledgers
supersede the earlier partial inventories for Recovery, server/native, auxiliary
contracts/CLI and support consumers. Manual classification is not a whole-package
exemption. Executed checks and remaining acceptance use the verification record.

## Recovery Owners And Complete Native Workflow (2026-10-19 Source Only)

FR-0017 observation/publication/event storage1 exposes only caller Tx/encoded state/
time. Existing Telemetry/Station/Notification/Path/Ingress public recovery operations
consume own lower SQL stores; RecoveryQuarantine1 coordinates original ordered
owners without direct foreign-table SQL. Mutable Station state, post-endpoint
Notification sample, shared publication sample/event-before-invalidation, original
Probe/ledger/history and final Recovery event retain original source stages.

RecoveryWorkflow1 now owns the original complete backup/restore rules through
explicit structural/generic native effects1, which own original manifest/path/fs/
dump/restore process/raw MySQL/OS-clock/native format operations and no L3 import.
Native AuthorityRecord is only an exact public type alias of its unchanged owner.
The existing operator script keeps old exports as real composition, not a new
business exemption; original lazy legacy constructors/statics still bind the same
owners. Original DDL/commit/credential/rebind failures remain separate and unknown
outcomes are not converted to rollback/retry/reset. See [full public chain](recovery-owner-workflow-v1.md).
161-166 planned/unexecuted; whole Recovery acceptance and backup safety unproven.

The existing server separately consumes public preflight/raw bootstrap/native
protected paths, retaining original authority/native assembly and cleanup. Exact
Agent codec/generated/schema assets and auxiliary operator/responder sources are
declared L2 with real public consumers; retained internal contracts reuse is not
live ADP2 support.159-160 planned/unexecuted. Ops CLI/upgrade/packages native sources,
remaining Agent/private/default chains and full consumer/type/asset/candidate/example
inventory and all later evidence/physical/release gates remain open.

## Ops, Native Contracts And Current Agent Source Follow-Up (2026-10-19)

UpgradeAssessment1 and OperatorCommand1/native1 source now bind original upgrade
plan/report rules, native bounded/catalog/Authority/read-only inspection and old
CLI/release effects through public entries. Exact legacy upgrade exports remain;
no existing L0/L1 contract or authority semantics change. Current exact source
chains are in architecture/upgrade-assessment-owner-native-v1.md and
architecture/operator-command-owner-native-v1.md (relative to docs/).

B amendment 2026-10-20: UpgradeAssessment2 adds the explicit Control0038 profile
under [FR-0027](../changes/FR-0027-probe-plan-json-integers.md). The L2 MySQL repair
accepts native unsigned JSON integer expiry while retaining historical migrations,
all other bounds and read-only assessment. Old profiles/Agent restrictions remain;
the pure CHECK catalog review does not claim complete schema equivalence.

Contracts package classification now identifies three L1 leaves (1/1/2), every
native L2 leaf/barrel and actual eleven public exports/schema/catalog origins.
Native root/shared imports remain eager and native; telemetry handwritten parsers
are not schema-loader implementations. See architecture/contracts-package-native-
boundaries-v1.md. No package source/default/asset change was needed for this map.

Architecture/agent-remaining-source-callchains-v1.md supersedes broad prior Agent
JSON/time/echo debt with concrete native default/fallback, Probe constructor and
production counter clock sites. Those sites remain to migrate; offline Transit
is not live integration. Public preview example source was read and its README
clarified; it was not executed. Readiness167-173 planned/unexecuted; full A5 source,
public/type/private/default/consumer/asset/candidate and all acceptance gates remain.
No tests/checks/formatters/generators/build/CI/experiments/Git writes ran.
## FR-0018 Native Defaults And Counter Domain (2026-10-19)

Source implemented, unverified: agentplatform.InterfaceVersion1 owns the original
native Providers/Effects/LocalServices structs and defaults. Control old names are
exact aliases; canonical named-type/reflection package identity changes explicitly,
while existing public constructor/nil/partial-fixture/default rules remain source
intent. No L0/L1 interface/semantics or native protocol/schema version changes.

Original Probe factory selection is in the existing Control construction seam,
called after Guard and before NewGate/counters/defer-close. Counter point policy
now requires an explicit scheduler, with a separate original native provider bound
at existing Runner assembly and passed by both production calls. Terminal points
still sample Now before EndedAt; Runner injected clocks are not substituted.
Old free helper/fallbacks remain. New L2 owner imports no L3 Control/Probe module.

See changes/FR-0018-agent-native-default-bindings.md and architecture/agent-native-
default-bindings-v1.md (paths relative to docs). Readiness174-176 planned/unexecuted.
Full A5/public/private/type/default/consumer/assets/candidate/example and foundation/
physical/release evidence remain open. No tests/checks/formatters/generators/build/
CI/experiments/Git writes or delegation ran in this source slice.
## A5 Source Roots, Bootstrap And FR-0019 Console Model (2026-10-19)

Manual source-root catalog now explicitly includes shipped apps/web, original
Control bootstrap, protected Core four files, native development/fixture/acceptance
support and runtime/generated/specification assets. This is not an exhaustive
import graph/frozen content manifest or a browser-folder exemption.

ControlBootstrapCommand1/native1 binds original required args/env, migrate, public
Identity bootstrap, output/finally-close in its existing root. FR-0019 records
ConsoleModel1/BrowserNative1 before source implementation: old model.js retains
ten exports, product helpers consume explicit native time/query, three fixed JS
asset routes/type entries preserve real browser relative imports and original
CSP/MIME/reader. Docker COPY/ignore declarations were read only, not built.

See architecture/foundation-source-root-catalog-v1.md, control-bootstrap-command-
native-v1.md and console-model-browser-native-v1.md (relative to docs/). Readiness
177-180 planned/unexecuted. Other named Web modules and full Control/Agent/type/
private/default/public-version/consumer/remove/asset/candidate/example remain to
close and accept; all foundation/physical/release gates remain closed. No tests,
checks, formatting/generation/build/CI/experiments/Git writes or delegation ran.
## FR-0020 Console Request And Native Composition (2026-10-19)

Source implemented, unverified: ConsoleRequest1 owns original required/version/
result ordering and one pending-key Map; BrowserNative1 adds original dynamic HTTP/
abort/JSON/error/UUID and native main/Relay form/view factories. Original app/model/
Relay entry/constructor bindings supply public helpers/callbacks without reverse
native source imports or a directory exemption. No L0/L1/protocol/schema/Authority/
Journal/ledger/permission changes; original reset, unknown-outcome and UI behavior
remain source intent, not passing evidence.

Five explicit JS asset union/routes follow actual imports with original headers/
MIME/native reader. Current console-flow VM harness uses old source/declaration/
lexical state layout and needs authorized canonical factory/UI-port adaptation,
not new production credential hooks. See changes/FR-0020-console-request-native-
effects.md, architecture/console-request-native-v1.md and console-browser-composition-
v1.md (relative to docs/). Readiness181-184 planned/unexecuted; other Web files/full
source/type/private/consumer/default/asset/version/candidate and all acceptance
gates remain open. No tests/checks/format/generation/build/CI/experiments/Git/delegation.
## FR-0021 Existing Echo Historical Read Completion (2026-10-19)

Source implemented, unverified: existing browser Echo receipt projection, correct
native selection for original permit inspection/capture, same-Tx challenge/proof/
byte/TLS summary capture, and native browser history shape/digest/display/filter.
Original HTTP/owner/browser/select accept the already declared echoed value.
No L0/L1/public type/method/schema/version/asset-route change; original SQL/clocks/
transaction/history ownership stays. Existing0037/storage source contains the
representation but has not been executed. Declared machine and receiveResult
public inputs remain v1/v2/v3; native stored v4 parsing is not a typed live v4 API.
See changes/FR-0021-echo-receipt-history-completion.md and architecture/browser-echo-
receipt-history-v1.md (relative to docs/). Readiness185-188 planned/unexecuted;
all22 Web leaves still need their complete per-leaf inventory under188. Existing
VM layout adaptation/full A5 candidate/consumer/type/default/private/assets/public
version/example and later foundation/physical/release gates remain open. No tests,
checks, formatting/generation/build/CI/experiments/Git writes or delegation ran.

## FR-0022 Rule Commands And Complete Browser Leaf Map (2026-10-19)

All22 named original Web bodies now have a manual exact public/default/return/
trigger/caller/asset map. Twenty-one remain purpose-classified native adapters;
the Rule product command state machine is actually moved into L3 RuleCommands1,
with original native DOM/representation/effects and the old initializer binding.
There is one original selected Map/plan/generation/cancellation state; first
preflight/unknown replay/stop/tail/finally refresh intent remains unverified.
No L0/L1/ledger/Authority/Journal or live capability changes. Three new literal
JS assets follow the actual import graph and original MIME/CSP/reader. Existing
Rule/app/Relay private VM source extraction needs later canonical adaptation,
retaining coverage without production auth/state hooks. See changes/FR-0022-rule-
command-owner-native-view.md, architecture/rule-command-owner-native-v1.md and
browser-native-leaf-inventory-v1.md (relative to docs/).188 manual map is authored;
185-191 and prior acceptance remain planned/unexecuted. Full source/type/private/
consumer/default/asset/version/removal/candidate/example and all later gates remain
open. No checks/tests/tool expansion/format/generation/build/CI/experiments/Git
writes/delegation ran; source identity/declaration/private layout changed explicitly.
