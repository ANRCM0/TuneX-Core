# FR-0014: Offline Transit Native Binding And Prepared Lifecycle

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner: existing offline Transit coordinator, L1 executionhost lifecycle and L2
nativeexecution/Transit adapters. Human standing source authorization of 2026-10-19
covers similar proposals after recording their exact contract/compatibility scope;
proceed without repeated confirmation. Evidence/Git/release/feature gates stay closed.

## Task Proposal

1. Layers: additive L1 prepared lifecycle, L2 native Transit representation/engine
   binding and existing L3 offline Transit controller.
2. Consumed public interfaces: existing executionhost, native ParseWireTime,
   platformruntime.Schedule, state TransitJournal API and native ADP Transit codec.
3. Foundation impact: new PreparedInstanceVersion1 lifecycle interface; driver
   HostVersion1, all existing required ports and wire/schema/capabilities unchanged.
4. Contracts: PreparedInstance exposes Activate() error and Close(). Existing native
   adapter exposes aliases for original TLS/root/Transit identity, original identity
   availability/projection, intent JSON, Prepare and diagnostic code operations.
   Old NewTransitController retains identical underlying parameter types/defaults.
5. Acceptance: planned exact-source alias/port/nil-interface/codec/time/ordering,
   native callback/prepare/activate/close and protected persistence. None run now.
6. Parallel impact: original coordinator/state/callbacks own all decisions; no new
   driver registration, engine implementation, Journal or live Transit workflow.

## Why Current Extensions Are Insufficient

The complete original controller, bridge, native engine/TLS/wire and native Transit
intent/envelope codecs were read. Controller directly imports TLS/X509, JSON and
concrete transit.Engine, and reads wall time. The generic executionhost.Instance
requires Drain/Remaining/SetAuthorization, which this prepared engine does not
implement and this owner does not need. Do not add fake lifecycle methods or copy
an engine/authority to fit it. Add the exact minimal prepared lifecycle alongside
the existing generic host and bind the same native engine object to it.

Native ParseWireTime already performs the original RFC3339Nano parse; reuse it at
the two original issued-then-valid sites, preserving their order. Existing native
Schedule.Now supplies dynamic wall time; bind its method value without reading a
clock during construction. Native JSON/identity/engine differences belong to the
existing nativeexecution adapter. Product authorization, history, phase and error
continuation decisions remain in the original controller.

## Exact Source Contracts

executionhost.PreparedInstanceVersion=1 and PreparedInstance { Activate() error;
Close() } are additive. Driver HostVersion remains1 and existing Instance/registry
signatures do not change. Native OfflineTransitAdapterVersion1 binds that lifecycle
without registering a new execution driver or capability.

Native aliases OfflineTransitCertificate/Roots/Identity select the actual original
tls.Certificate/x509.CertPool/transit.Identity; they are not neutral L1 types or a
new schema. Existing constructor arguments use the aliases with identical native
type identity. Native identity availability tests only roots != nil and original
certificate slice length; no new leaf parse/trust validation. Identity projection
copies the original certificate and clones roots at the same return-literal stage,
after original capability/load/authorize checks and key copy, before capability copy.

EncodeOfflineTransitIntent accepts the original native Assignment and marshals only
its Driver.Config.Intent. Call at the old JSON site after the per-item check; on
marshal error return the current observations plus that error, exactly as before.
Do not collapse this into a Prepare error, which would instead become an item result.

PrepareOfflineTransit calls original transit.Prepare with the same raw bytes,
identity and allow callback. Return a nil lifecycle interface if the native pointer
is nil, retaining its exact error; a typed-nil interface would wrongly trigger
Close and is forbidden. Preserve a non-nil partial pointer with its error for the
original caller cleanup. Do not activate/close/normalize errors inside this adapter.
The controller map stores the same native engine object through PreparedInstance.

OfflineTransitErrorCode moves the exact original nil/Error/range/prefix/fallback
expression. Original control.transitErrorCode remains its precise private wrapper.
No error vocabulary, retry/status classification or Unicode/index rule is changed.

## Original Coordination And Default Stages

Construction keeps authorizer/reservation/identity/epoch preflight, capability check,
native journal load, authorizer call, key copy, root clone, capability copy and map
allocation order. A private now function binds the original native Schedule.Now
method without sampling; no new public constructor/option, provider fallback or
Runner scheduler borrowing. Zero/manual unsupported controller construction is
not expanded into a new default-binding API.

Apply keeps mutex/deferred unlock, closed/capability/authorize, strict Snapshot parse,
Node/epoch and strictly-new generation checks. Native issued parse then valid parse
precede one dynamic Now, original one-second future/time-window check, per-assignment
authorize/reserve and final authorize. Only then call original state.AcceptTransitSnapshot.

After successful commit, set the original Journal and close/remove every old engine.
For each assignment build the same diagnostic observation and allow callback. That
callback still calls authorizer before dynamic Now/deadline comparison. Preserve
precheck failure append/continue, separate intent marshal failure return, native
Prepare, active-only Activate, non-nil partial cleanup/error code, draining Close/
removed, active ready and map insertion. Close/CurrentJournal ownership stays.

Engine-owned time, TLS, network, allow checks, replay/budget/watch/frame/cleanup
internals are not changed or virtualized by the controller clock binding. Native
engine remains a data-plane adapter, not a controller/state authority. Transit
bridge still requires independent Control permission/live Runner Ticket/capability/
identity/exclusive physical guard, rejects old Direct/Relay history/active/draining
TCP resources, and is absent from deployed Run/poll. No live feature is enabled.

## Classification, Consumers And Known Limits

Record exact native engine.go/tls.go/wire.go, adp3transit/validate.go and
transitcontracts/validate.go plus their embedded schemas as L2 representation/
data-plane sources, not whole package exemptions. Original Forward budget/destination,
Relay framing/fingerprint and native contracts imports remain explicit existing
mixed/native dependencies; this wrapper does not certify their closure or extend
their behavior. Native engine implementations are not edited in this proposal.

Observed native TLS peer-chain length !=1 refusal precedes intermediate iteration;
that existing compatibility limit remains unchanged and needs explicit later
vectors. No intermediate-chain support follows from this source split.

Observed constructor/bridge consumers are original transit_runner_test.go and the
not-Run-wired integration hook; no full consumer/type/behavior evidence follows
from source search. Preserve original public controller/observation/constructor/
Apply/Close/CurrentJournal and private error wrapper until actual callers and
same-source acceptance pass. Lower lifecycle is additive; old direct engine types
remain native for their original engine tests, with no accepted extension recipe.

## Acceptance And Known Limits

144 planned: new prepared lifecycle/version and unchanged driver HostVersion1,
native aliases/old constructor identity, same concrete engine/nil interface/error/
partial cleanup; nil/wrong identity/epoch/capability/load/authorize first errors,
key/root/capability copy order and no constructor time sample. New native functions
must not start/activate/register/authorize anything beyond the original Prepare.

145 planned: issued-before-valid parsing, no time sample on either parse failure,
original one-second bound and Now/authorize/deadline order; original mutex/strict
decode/identity/history/reservation/final authorize/save then old-engine close.
Compare all assignment phases, check failure, JSON failure versus Prepare/Activate
failure, nil/non-nil cleanup, same observation/map/Close/CurrentJournal behavior.
Native engine TLS/frame/budget/watch/allow/deadline behavior remains original.

146 planned: complete original offline journal/replay/no cached restart/no lost
high-water on failed preparation or activation, independent authorization and
physical guard, all old controller/engine tests on authorized native Actions.
Confirm no live registry/capability/Run/poll integration, protocol/wire/schema drift
or authority weakening. All cases unexecuted; full repository/candidate/consumer/
default/CLI/engine/physical/long-run/backup/example/release acceptance remain open.

No tests/checks/gofmt/generators/build/CI/network/native/PKI/container/MySQL/browser
experiments, commits/pushes or delegation. Independent physical-host evidence is
unavailable/unverified where not provided; hosted same-host does not replace it.

## Source Authorization And Acceptance Gate

This record precedes implementation. Implement under standing source scope, then
record authored/unverified and keep the complete frozen-source acceptance separate.
