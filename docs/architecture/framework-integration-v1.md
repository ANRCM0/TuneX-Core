# Classified Integration Framework v1

Original source handoff: 2026-10-18 (Asia/Shanghai), ADR-0047 scope closed and then
unverified. See [ADR-0047](../decisions/0047-classified-integration-framework-v1.md).
Documentation status clarified: 2026-10-21.

The later [ADR-0048](../decisions/0048-foundation-layer-boundaries.md) adds the
human's stricter [four-layer scope](foundation-layers-v1.md) and
[foundation DoD](../development/foundation-readiness.md). B subsequently accepted
the bounded frozen public contract/consumer/compatibility/example scope at source
`e208a3abf17129b0c2898ba2022c69f60f45445a`, actually tested as
`c3ce8a67b901f61234b4116190409854818cb6c7`. The
[candidate index](foundation-candidate-index-v1.md) and
[verification record](../development/foundation-verification-2026-10-19.md) govern
that later decision. Dated source-only/unexecuted entries below retain their
historical handoff meaning. They do not negate B acceptance or certify a successor.

Future modules need an authorized task on that accepted contract set or a verified
successor, with their own branch/worktree, public contract, tests and integration
instructions. Physical-host, load/long-run, independent Responder and release gates
remain separate. This clarification does not open an implementation task.

This is the development foundation for subsequent features. Core v1's current
surface is the protected baseline. Application services compose owners, Runtime
coordinates execution, and the Agent Runner controls actual execution authority.
Source closure does not approve a release or replace final-source acceptance.

## N Product Source Integration (2026-10-21)

The authorized [N stage](../development/product-development-stage-n-2026-10-21.md)
integrates successors under FR-0028–0032. Consume the explicit successor counters
in the [candidate index](foundation-candidate-index-v1.md); the following original
extension table retains its dated contract scope. N has no current acceptance.

The actual chain is account context -> resource-filtered Console queries ->
original Node/Forward/Path/Ingress commands -> original transaction/CAS/Operation
-> Runtime resource admission -> original Snapshot/Agent authority and reports.
L1 ResourceReadAccess and RuntimePortReservationPolicy are injected contracts;
ResourceAccess and Node policy remain L3, SQL remains in original L2 stores.
Direct NodeService construction requires the port policy, RuntimeResources and
exclusive reservations require the same original-ledger policy, and aliases bind
native providers explicitly. Old provider fakes must implement the successor
ports; unclassified records and absent purpose fields are not compatibility
shortcuts. No historical green run validates these later changes.

Browser selection reads exact Profile/Endpoint revisions and purpose-specific
Node candidates, then explicitly saves a template or enters an unsaved disabled
Forward draft. Original previews and commands reauthorize; no UI selection is an
execution grant. Personal port usage reads only the current account's original
physical slots. Probe support reads issue no tasks and distinguish an unsupported
measurement from an authorization/read failure. Detailed entry and acceptance
instructions are in [Web integration](../../apps/web/PRODUCT-INTEGRATION.md) and
[Node integration](../../apps/control/src/modules/node-owner/PRODUCT-INTEGRATION.md).

Payload limits use `RuntimeHostOptions.payloadPolicy` in the same locked Runtime
transaction; `TransitStagingOptions.payloadPolicy` refuses configured offline
shared resources. Production Runtime/Transit aliases bind the real original
stores and product owner, while direct hosts require explicit providers.
SharedResourceLimits owns policy/CAS/receipts/audit only; execution is original
Snapshot -> Runner -> driver/engine gate -> authenticated Journal precharge.
Consume the [public example](../../examples/shared-resource-limits/README.md) and
[specification](../spec/shared-resource-payload-limits-v1.md). Nil-gate engines
are explicitly unmetered, not a fallback for unsupported limited drivers. Online
consumption remains unknown; rates/quotas are not inferred from telemetry.

## 1. Concrete extension points

| Concern | Existing source contract | Live reference |
| --- | --- | --- |
| Pure intent | `packages/core/src/index.ts` | Forward parsing and revision decisions |
| Application commands | `framework/public.ts`, owner-defined command ports | `ForwardCommands`, `TransportGrantCommands`, `AccessCommands` |
| Scoped detail queries | `modules/forward-query-ports.ts`, framework Runtime read contracts | `ControlQueries`, `MySqlRuntimeObservations` |
| Runtime coordination | framework RuntimeHost3 with family facts, required clock/time/machine codec and transaction-aware providers | FR-0008 RuntimeController explicitly binds NativeRuntimeFamily and original native effects/MySQL/ADP; source unverified |
| HTTP integration | L3 `api/public.ts` HTTP1; L2 `compatibility/control-http/public.ts` native Hono/Node/URL services/types | FR-0011 same `createControlApp({control,runtime,authority,services,requests})` in server; old app/ports exact aliases,135-137 unexecuted |
| Control execution preparation | Forward public original execution adapter contracts; old Runtime aliases retained | Canonical `ForwardExecutionRegistry`, `nativeForwardAdapters` |
| Snapshot contribution | Public L1 assignment contracts with exact old Runtime aliases | Canonical Forward `SnapshotAssignmentRegistry`, `RelayAssignmentSource` |
| Agent execution | L1 `agent/internal/executionhost`, typed L2 `executiondriver` | `nativeexecution` drivers through old `control/execution_driver_adapter.go` |
| Offline prepared lifecycle | Additive L1 PreparedInstanceVersion1, native OfflineTransitAdapterVersion1; existing driver HostVersion1 unchanged | FR-0014 original offline controller/engine binding with nil preservation and save-before-engine,144-146 unexecuted; no live registration |
| Agent authenticated history | L1 executionstate3 tagless facts with required protocol/slot codec; Bootstrap/provider2 | FR-0013 exact native state records and reference-preserving store/wrapper/Bootstrap/Runner conversion; split type identity and direct serializers must migrate;141-143 unexecuted |
| Agent observations | L1 runtimeobservation2 generic Host, native platformobservation2 and observationwire1 | FR-0015 exact native DTO/encoder/ACK/body formats, explicit native family/no Host copy, original exporter/counter/worker owners;147-149 unexecuted |
| Agent command | L3 agentcommand1 structural Platform/Runner, L2 agentcli1 native flags/effects | Existing main composes public control.New; original inspect/enroll/run/proof/lock/signal chain, no L0/L1 change;150-152 unexecuted |
| Runtime status read | L1 raw storage1, L3 runtime-status-owner1, native codec and MySqlRuntimeStatusStore | FR-0016 original tuple/freshness/path recursion and explicit production/legacy bindings;153-155 unexecuted |
| Control process commands | L3 control-startup1/client-command1 with structural generic effects; explicit public native leaves | Existing main/client compose original server/release/HTTP;156-157 unexecuted |
| Native data plane | Existing public Forward/Relay/payloadstats, same shared process permits and egress policy | Single native multihop config projection and same-package Snapshot; exact source owners documented,158 unexecuted |
| Control bootstrap | Existing startup public preflight, MySqlControlBootstrapStore and public native protected-path rule | Original server/authority/raw-row/getter/default/cleanup assembly;159 unexecuted |
| Native codecs/operator entry | Exact Agent ADP/Probe/schema/generated aliases and auxiliary CLI/responder | Native L2 purpose/public consumers, internal Direct reuse is not live ADP2 fallback;160 unexecuted |
| Recovery quarantine | L1 observation/publication/event storage1, original L3 owner Recovery operations and RecoveryQuarantine1 | FR-0017 supplied original Tx/order/state/time/unknown-outcome/history retained in intent;161-163 unexecuted |
| Recovery workflow | L3 RecoveryWorkflow1 structural/generic effects and public native recovery1; same protected AuthorityRecord alias | Existing operator entry composes original full backup/restore and lazy owners, commit -> durable credentials -> protected rebind;164-166 unexecuted |
| Independent periodic work | framework `BackgroundTasks` interface2 with required effects | FR-0003 L2 native provider/legacy wrapper; same Runtime, retention, alerts, delivery and finite Probe plans |
| Ledger/Relay/Node representations | Existing compiler/codecs; Ledger3/Relay5/Node3, configuration2/Transport2 | FR-0009 opaque Profile and FR-0010 native input/support/prefix, original native formatter/defaults/owner decisions |
| Common runtime values | Public L1 policy1/execution-observation1/execution-values2 | Unique facts and opaque Profile with explicit native specializations; no native default/schema/format implementation |
| Request completion | framework `RequestLifecycle` | Production HTTP admission and shutdown drain |

Control paths in this table are relative to `apps/control/src`. These are trusted
source interfaces, not a runtime loader or code sandbox. HTTP consumes independent
owner API declarations; remaining optional legacy class views are tracked debt.
These views do not receive constructors,
a database pool, transaction callbacks, full Runtime or secret storage. New HTTP
features extend the service declaration and named composition. The old positional
`createApp(...)` delegates for existing callers; it does not translate machine traffic.

FR-0011 keeps product HTTP routes and aggregate service declarations L3. Native
Hono creation/types, URL and context socket extraction stay L2 without reverse
product-type imports or a general L1 HTTP layer. Routes call those public operations
at original sites; session/Console/withdrawal formats reuse the existing codec.
Native Hono has a separate public transport entry to avoid an eager import from
the general compatibility barrel. Original query/body/argument/error and request
lifecycle stages remain intended; frozen-source acceptance and full inventory open.

## 2. Contract imports and version meaning

| Package entrypoint | Purpose |
| --- | --- |
| `@tunex/contracts/shared` | Policy, errors, JSON, digest, time and common validation |
| `@tunex/contracts/runtime` | ADP/3 Runtime, native Relay/multihop and catalog |
| `@tunex/contracts/probe` | Existing original, typed and controlled TLS Probe families |
| `@tunex/contracts/observability` | Node, Forward, Host and Probe telemetry |
| `@tunex/contracts/experimental/transit` | Explicit experiment; does not install a production transit driver |
| `@tunex/contracts/legacy/adp2` | Historical/offline ADP/2; production Control still rejects ADP/2 |
| `@tunex/contracts/staged/probe-echo` | Incomplete echo source, not end-to-end availability |
| `@tunex/contracts` | Existing aggregate compatibility export retained for tools/tests/callers |

Control source imports by purpose. Older tools/tests can migrate later. Entrypoints
re-export existing implementations instead of translating messages. Runtime parsers
can still reuse historical internal structural validation; import paths do not
redefine algorithms or relax schemas. A staged import is not a feature gate or
permission. Existing incomplete echo remains independently unfinished.

Package `0.1.0`, Core/Forward v1, API v1, ADP/3, execution extension 1, assignment
schema 1 and process-local host interface 1 are distinct compatibility dimensions.
The host version is not serialized into ADP or Journal. A change to one dimension
does not implicitly make another compatible.

## 3. Management and configuration adapter recipe

Use `ObservationServices` as an independent owner and `NativeTunnels` as composition
of existing owners. A normal feature follows these steps:

1. Define bounded input/result values and an owner-specific store/resolver port.
   Keep feature parsing and pure rules beside the feature. A new form or external
   configuration format does not require new Core fields.
2. Implement the application service. Authenticate current actor/Scope before
   scoped reads. Commands keep authorization, CAS, quota, audit, original
   idempotency claim and receipt in the owner's transaction.
3. Implement infrastructure for the port. Query projections use the caller's
   transaction without opening a connection, issuing commands or accessing the
   network as a GET side effect.
4. Expose only required public methods in `ControlHttpServices`/`ControlApi`, compose
   owner/store explicitly, and add HTTP parsing and Console/CLI calls as needed.
   A configuration importer maps external input to the same application command;
   it does not write Forward, assignments or reservations itself.
5. For cross-owner atomic work, add an explicit transaction-aware owner port.
   Follow `ProbePlanIssuer<Tx>` or Forward preparation; a nested public command
   transaction is not one atomic commit.

A metadata-only feature needs no Agent driver, machine family, timer or new
execution ledger. Unknown completion retains the original command request identity,
not a replacement key, newer revision or repeated physical action.

## 4. Execution adapter recipe

Control's current registry installs all three native implementations. It derives
the driver from parsed Forward intent, checks descriptor/business protocols, and
dispatches through `ForwardExecutionAdapter`. The command owner still accepts the
Operation and owns capacity checks and atomic writes. Shared Node-move, lock,
retry and cleanup rules remain in the host. Native paths use the existing Relay
coordinator. Snapshot sources use the same native catalog's role declarations.

On Agent, `executiondriver.Driver` declares host version, assignment schema,
platforms, roles, phases, protocols, capabilities and feature gates. `NewRegistry`
rejects duplicate/incomplete declarations and incompatible host versions. `Resolve`
rejects unsupported assignment classifications, platforms and disabled gates before
dispatch. Existing native implementations pass through the bridge. A new trusted
compiled driver can implement the public contract and enter static composition
through `adaptExecutionDriver`.

The stricter foundation extraction now places the generic implementation in
executionhost; executiondriver retains native type aliases and actual-platform
binding. Native Direct/Relay/Multihop code has one home in nativeexecution, with
old private helpers delegating. See agent-execution-host-v1.md and unexecuted
readiness item 29. This source change does not certify all Agent/Probe/CLI internals.

`Start` receives bounded assignment facts, policy and an authorization callback.
Drivers must honor authorization throughout I/O, close partial starts, and support
declared phases/drain/close. Optional replacement preserves existing compatibility
and authorization rules. Runner retains Journal, deadlines, generations, fencing,
resource retirement and recovery. Peer credentials are supplied only to drivers
whose declaration requires them. Observation ports cannot issue or execute Probe.

Registration deliberately cannot make arbitrary ADP JSON supported. A new execution
meaning needs a deliberate change across owner/intent mapping, locked Transport,
closed schemas and TS/Go parsers, catalog, Control preparation/compiler, Snapshot
roles, Agent lifecycle/negotiation and persisted readers/recovery. Unsupported input
uses existing explicit protocol/capability errors, with no automatic legacy fallback.
Disabling a feature never erases accepted cleanup, Journal or high-water obligations.

## 5. Observation and task recipe

Observation facts need source, identity, time, freshness, size and retention bounds.
Use the independent bounded observation database boundary, without fallback to the
authoritative execution pool. Existing telemetry owners are examples. Facts and
catalog entries are not execution authority or current application health. Active
Probe still enters its original permit/Gate/watch owner.

Register periodic work once in composition when necessary:

```ts
{id:'feature-retention',intervalMs:30000,enabled:workers,
 run:()=>feature.prune(),onStop:()=>feature.close(),
 onFailure:()=>console.error('Feature retention deferred')}
```

`BackgroundTasks` bounds registrations to 64 and interval/backoff declarations. Each
task has its own timer and one in-flight run; overlapping ticks are skipped. Failure
may delay the next opportunity, but never retries a business command. Owners retain
state, budgets, cancellation and I/O deadlines. Do not put permanent loops in ticks.

Shutdown stops HTTP/application and timer admissions first. Task `onStop` can signal
owner cancellation while the helper waits for actual task completion.
`RequestLifecycle` waits for handlers even if client sockets disconnect. Only then
does composition close observation storage, protected notification secrets and
MySQL. There is no timeout that claims an unfinished owner safely drained, and the
helper does not invent cancellation for unbounded owner work.

## 6. Source closure and pending acceptance

The ADR-0047 source scope is closed: scoped detail reads, structural HTTP/machine
surfaces, named composition, purpose-specific contract imports, native Control and
Agent contracts, existing-driver dispatch and independent task/request lifecycle are
connected. The [Core surface](../spec/core-v1-surface.md) and these recipes are the
development baseline. Core has not absorbed framework infrastructure.

No type/static/syntax checks, tests, generator checks, build, final-SHA Actions or
physical acceptance have executed for this slice. Existing tests/CI remain; updating
interface assumptions and extending boundary/acceptance coverage belong to the
agreed concentrated verification phase. Integration/shutdown defects remain possible.

That phase must cover authorization/response compatibility; transaction rollback,
CAS/replay; driver parity and unknown/duplicate/version/platform/gate rejection;
native create/update/remove/retry and Snapshot merge; actual request/worker shutdown;
failure/backoff and independent observation capacity; persisted readers/recovery;
and both narrow/aggregate exports. Obtain the full relevant Actions evidence for the
final source revision. Physical, long-running and release gates remain separate.

Current ops integration (2026-10-19): public UpgradeAssessment1 separates product
plan/report rules from native format/bounded file/catalog/Authority/read-only MySQL;
OperatorCommand1/native1 binds the original Recovery, env/argv/JSON/output and
release verifier in existing scripts. No frozen L0/L1 semantics change. Exact old
upgrade export aliases remain. Contracts now have an explicit leaf/export/asset
map; Agent call-chain inventory narrows remaining live native defaults/counter
clock without certifying the whole package. See architecture/upgrade-assessment-
owner-native-v1.md, operator-command-owner-native-v1.md, contracts-package-native-
boundaries-v1.md and agent-remaining-source-callchains-v1.md. Readiness167-173 are
planned/unexecuted; example source was read, not run. Full A5/candidate gates remain.

Ordinary features reuse these paths and reduce repeated plumbing. New protocols,
engines, authority semantics and recovery guarantees remain substantial work. This
does not finish the four product workstreams, echo, general failover or production
delivery, and does not promise every future feature will be inexpensive.

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

### P Relay Forward Read Extension

FR-0041 adds the separately versioned `RelayForwardAssignmentReader1` public
contract. `RuntimeRelayHost.assignmentsForForward(tx,forwardId)` reads only the
latest deployment of one Forward, runs the original publishable-plan authority
once, and projects each node with the same session and stage gates as legacy
`assignments(tx,nodeId,includeAccepted)`. The legacy method and RuntimeRelay7
remain available. Native Probe composition injects the new optional grouped
provider; all requester grants and exact published bindings are still checked in
the same caller transaction. The FR includes a public composition example and
the contract tests exercise it. This is a P acceptance candidate, not a new
parallel-module or release gate.

FR-0042 adds `ProbePermitObservationStorage1` beside the unchanged mutation
storage. Original offer/status may consume its optional shared-lock snapshot;
native composition delegates to the one original lower store. Normal mutations
continue acquiring the original exclusive budget lock and recovery keeps its
original startup admission/SQL. The shared reader retains all original bounded
projections, clock and corruption checks; old providers and overridden legacy
locks keep their original exclusive path. No new authority, schema or lifetime
is introduced. Concurrent readers/writer exclusion is covered by an authored
real MySQL case in the existing Actions invocation.

### P Node Snapshot Read Successor

FR-0043 adds `RelayNodeAssignmentReader1` and
`RuntimeRelayHost.assignmentsForNode(tx,nodeId,includeAccepted=false)`.
The native call chain is original Runtime transaction -> RuntimeLedger ->
SnapshotAssignmentRegistry -> RelayAssignmentSource -> explicit new-reader
callback -> original Relay owner forNode walk -> original publishable-plan and
Node projection helpers. Each multihop plan consumes one locked input for
resource and immutable-plan checks; two-node Relay retains its original flow.
The unchanged `modules/runtime/relay-coordinator.ts` compatibility constructor
still assembles the original host and native providers. Existing inherited or
instance canExecute overrides retain the legacy dispatch/provider path instead
of being bypassed by the optimized entrypoint.
The original `assignments` entrypoint, constructor, RuntimeRelay7, Snapshot
context/source/driver declarations and includeAccepted/session/stage behavior
remain available. No authorization input survives the caller transaction.

The native composition fake explicitly migrates its deferred method expectation
and retains the original receiver and argument/transaction checks. The public
example and new/legacy parity, input refusal, once-only read and error/no-cache
cases are authored in the original owner corpus. Local type/source boundaries
pass; exact-source Actions and native delay comparison are still required.
Earlier measured shared JOIN waits are not presented as pool starvation or as
acceptance of this successor. See
[FR-0043](../changes/FR-0043-relay-node-snapshot-assignment-read.md).
