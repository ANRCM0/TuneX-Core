# Framework Lifecycle And Time Effects Source Inventory

Date: 2026-10-19 (Asia/Shanghai).
Status: source-authored under FR-0003/FR-0004, not checked, run or accepted.
Scope: actual Control L1 lifecycle/common host source and observed bindings. This
is not a full-repository classification or an import/type/boundary acceptance result.

## Public Chains And Required Effects

| Public entry and source | Coordination owner and injected effects | Observed binding/compatibility and removal gate |
| --- | --- | --- |
| framework/public BackgroundTasks, background interface2 | One original PeriodicTask lifecycle; required BackgroundTaskEffects.now/scheduleInterval; native timer handle never enters L1 | server.ts passes nativeBackgroundTaskEffects; application/background-tasks.ts aliases L2 NativeBackgroundTasks, whose original one-arg construction inherits the same host. Keep until all actual callers migrate and exact-source acceptance passes |
| compatibility/public nativeBackgroundTaskEffects/NativeBackgroundTasks | L2 dynamic performance.now through existing nativeMonotonicNow; setInterval at start, clearInterval at stop, no constructor/module-load time read | Old class name and inherited lifecycle preserved; old application constructor differs from direct framework constructor. No duplicate task state/body |
| framework/public RuntimeLedgerHost, ledger interface3 | Original one ledger, family-typed compiler/store/assignment facts plus existing Now/newID/resource providers | RuntimeLedger explicitly binds NativeRuntimeFamily with original args, policy/resource defaults and captured Date.now/randomUUID |
| framework/public RuntimeRelayHost, Relay interface5 | Original coordination with family-typed plan/assignment/compiler/store and opaque Profile, time methods and policy views | RelayCoordinator explicitly binds NativeRuntimeFamily with original args/policy/captured Date.now/static recovery |
| framework/public NodeAuthorityHost, Node authority interface3 | Original authority/clock/signer/secrets/store/resources plus time and four native input/support/prefix methods | Nodes -> NodeService -> same host; native codec supplies original predicates/formatters, captured Date.now remains |
| Node owner public NodeService | Original provision/grant/policy/view commands; uses inherited codec formatTime at previous native expressions | Provision expiry formats after original Tx completes; view formats inside its Tx with unchanged truthy nullable timestamps and credential map order |

FR-0003 records direct-constructor refusal, interval/monotonic provider semantics and
legacy constructor identity. FR-0004 records required compiler/codec refusal and
all original conversion positions. Both were recorded before implementation under
the human's standing source authorization, without repeated confirmation. Core,
wire/schema, protected history and authority ownership do not change in this scope.

## Lifecycle Timing And Shutdown

BackgroundTasks still validates unique bounded registrations, freezes declarations,
starts independent enabled timers once and refuses restarting a stopped task. Each
task has one active promise, no queue. Stopping/active short circuits precede the
same monotonic sample; run remains deferred through Promise.resolve().then. Failure
backoff reads monotonic time only with failureDelay, caps count at16 and delay at
maxMs, then invokes the sanitized onFailure callback, swallowing logger failure.
Success resets failures/nextAt. Provider methods preserve their receiver; returned
cancellation is called without a receiver and discarded only after it returns.

close still stops admission before invoking onStop and awaiting the already active
work; it memoizes close promises, settles all tasks and retains original sanitized
failure messages. Native provider must not synchronously tick during registration;
it cancels future interval work without cancelling active business work. server's
runtime/telemetry-retention/station-alerts/notification-delivery/probe-plans entries,
intervals, worker flags, shared backoff, authority check, serial prune loop and
owner close callbacks are the original ones. HTTPS startup failure and normal
request/task drain happen before dependencies close in their original order.

RequestLifecycle's body remains unchanged: admission refusal increments nothing;
admitted work decrements active in finally, and drain resolves only after the
application promise finishes. A disconnected socket is not a substitute completion.
No new timer, timeout or best-effort drain is introduced.

FR-0011 source follow-up: HTTP product routes now consume L2 native factory/types/
URL/context and formats through compatibility/control-http/public.ts. The L3
api/public.ts exposes original factory/options; old app/ports are direct aliases.
server imports that public entry with the same requests and services. Global request
ID/no-store remain before optional run, authority allow stays inside its action
except health, original admission/auth and machine exclusion order remains. Native
default Hono/URL/Console header/session/Probe formats have no clock/task/authority
state. The separate Hono entry is not eagerly imported by general compatibility.
Readiness135-137 plan public/native/getter/route/drain acceptance; none executed.
Full HTTP/server/default/consumer/freeze and repository classification remain open.

## Common Source And Exact Alias Inventory

The following files were read as source, not executed. Only the compatibility alias
targets listed here were changed; common mechanism bodies stay original.

| L1 source | Public dependencies/effects and observed compatibility |
| --- | --- |
| errors.ts | Local Error class/status/codes, invalid/notFound; application/errors.ts now exact aliases through framework public, same constructor identity |
| application-ports.ts | Six original owner-independent transaction/auth/request/response declarations; application/ports.ts now explicitly lists those six via framework public, retaining generic defaults/signatures |
| request-lifecycle.ts | Local ControlError, Promise/finally drain only; old application entry exact public alias |
| module-log.ts | Code-only ModuleLogEntry/ModuleLogger contracts; no default sink, clock, I/O or raw-error projection |
| request-identity.ts | Public Core isId, local invalid and injected synchronous digest; existing nativeCommandRequest supplies native digest through one original call |
| pagination.ts | Local invalid plus canonical decimal/Number rules, original page1/limit25 and bounds10000/100; no time/IO effect |
| forward-import.ts | Public Core parsing/deepFreeze/isId only; no native format/provider/authority lookup |
| identity-access.ts and identity-access-ports.ts | Local store/account/secrets/codec/auth contracts; original bearer hash and transaction/pool lookup distinction; no new provider/default or token store |
| idempotency.ts and intent-store-ports.ts | Existing store/read/encode effects; snapshot key across awaits, recovery refusal before digest/replay, no new transaction or clock |
| node-facts.ts | Readonly validated facts supplied by original Node authority; no grant/lookup implementation |
| runtime-exclusive-reservations.ts | Public Core bounds, local store/resource contracts and existing late capacity callback; lock/order/reservation authority unchanged |
| runtime-reservation-release.ts | Local identity/store/error contracts; whole set validated before release and exact race check, no time/IO implementation |

These source observations do not prove full transitive boundary closure, public
type equivalence, alias consumer completeness or framework acceptance. Errors and
RequestLifecycle aliases remain the original function/class objects. BackgroundTasks
has the intentional different native-wrapper/direct-host constructors in FR-0003;
do not generalize identity preservation from the simpler aliases.

## Shared Type Source And Remaining Classification

FR-0005/0006 now relocate the original Policy and execution fact declarations into
precise public L1 leaves; no duplicate interface or native defaults moved to L1.
FR-0007 replaces direct RelayConfig/MultihopConfig casts with narrow native reference
views while original authorization stays in the host. See the [current source chains](runtime-common-values-and-relay-views-v1.md).
FR-0008 subsequently replaces shared assignment/snapshot/message types with common
family facts and explicit native bindings, and moves Host machine predicates/
projections into its codec. See the [current family graph](runtime-value-family-native-v1.md).
FR-0009 subsequently makes Profile opaque in L1 and selects its original native
schema only through outer family aliases. FR-0010 moves original Node native
input/support/prefix expressions into its existing codec. See [current source](profile-node-native-boundaries-v1.md).
The original bounded source inventory now reads; full classification/acceptance
is still pending and no whole package is exempt:

| Framework source | Current fact/type ownership and remaining debt |
| --- | --- |
| runtime-assignment-ports.ts | Common family assignment/source declaration facts; old native source types are explicit outer specializations |
| runtime-contracts.ts | Common role/resource/status facts and family machine messages; HTTP/old machine alias selects native family |
| runtime-evidence-read-ports.ts | Family snapshot evidence; native Probe reader/record is an explicit specialization |
| runtime-host-ports.ts | Common family assignment/snapshot/messages/tombstone plus policy/observation and required machine codec |
| runtime-host.ts | Common family facts; exact native Hello checks/projections supplied by codec |
| runtime-ledger-ports.ts | Common family assignment/snapshot compiler/storage/collector contracts |
| runtime-ledger.ts | Common family assignments/snapshots/reports and common tombstones, original coordination |
| runtime-relay-ports.ts | Common family assignment/plan/compiler/store and opaque Profile payload, native schema selected outside |
| runtime-relay.ts | Common family facts/opaque Profile passed to supplied compiler; original coordination retained |

relay-configuration-ports now derives an opaque family payload rather than a native
schema; native Transport/Endpoint aliases select the original Profile type outside
L1. This source migration does not prove complete transitive consumer or boundary
closure. Keep actual alias/removal and remaining mixed-owner inventory explicit;
do not use raw declarations or copied schemas as a substitute for acceptance.

Remaining A5 includes all other Control/Agent source and type chains, native/default
bindings, complete actual consumer/removal conditions, exact candidate contents and
public version/acceptance mapping. HTTP native types/remaining projections, Agent
URL/protected keys/engine/CLI and the shared wire type ownership remain source work.

## Planned Acceptance

Readiness121 covers FR-0003 and server lifecycle/legacy constructor behavior;
122 covers FR-0004 and Node response transaction timing;123 covers common aliases,
classification and precise unresolved shared type debt. All are planned/unexecuted.
Later authorized same-frozen-source contract/boundary and Actions functional/MySQL/
network evidence must validate original behavior and every actual migrated caller.
The public runtime example and independent physical/long-run/release gates remain
unverified. Source authorship alone opens no foundation/parallel-feature gate.
