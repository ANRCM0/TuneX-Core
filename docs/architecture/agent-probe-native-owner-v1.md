# Agent Probe Native Owner V1

Latest continuation: [execution/status/result/echo/shared time source](agent-execution-wire-source-v1.md)
supersedes earlier remaining-status/result/ACK/echo-format pointers for the named
files. Readiness111/112/114 planned only; remaining whole A3/A4/A5 classification
and acceptance stay open.

Date: 2026-10-19. Source authored only; unverified and not accepted.

## Scope And Owner Chains

The original product Probe remains L3. Its child package
`agent/internal/probe/native` is an explicit L2 native adapter, rather than a
second executor, authority, Gate, budget or counter registry. The new adapter
imports existing L1 runtimeplatform ports and L2 platformruntime, egress and
probeecho implementations. It never imports its parent product owner.

Original public constructors -> original Executor -> same host resolver -> native
ParseDestination -> original binding/measurement/callback/expiry condition ->
native Destination.Allowed -> original authority recheck/admission/monitor ->
same Executor dial port using native Network/Address -> original outcome owner.
Parse still occurs after detached service/echo target comparison and before the
binding condition. Policy still occurs after binding/callback/expiry checks, not
as an eager parse side effect. No DNS, target substitution or second dial appears.

Echo path: same Gate claim burn -> same Executor echo validation and target
resolution -> same single admitted dial -> old package-local exchangeEcho ->
native ExchangeEcho -> existing public probeecho frame/proof functions -> same
Executor result projection. Echo service/invocation/binding/selection/expiry
validation and authority monitoring stay in the product owner. Adapter receives
only the original detached execution, raw socket, context and callback; it never
receives a Gate, Runner or authority store.

The next source slice also separates original external-format operations before
that dial: validateEchoExecution -> same measurement/version/domain condition ->
same wire Binding-to-product Binding comparison -> native ParseEchoContext
(original json.Marshal then public ParseServiceContext) -> same product purpose/
trust/selection/current-time condition -> same protocol declaration loop -> same
public InvocationDigest and challenge comparison -> native ParseEchoTimes -> same
product duration/current-time/service-window condition -> native EchoFrameValid.
The original condition sequence remains in the parent; native format success is
not a grant. Target echo identity still uses the old sameEchoExecution wrapper,
now calling the moved original reflect.DeepEqual, preserving nil versus empty
slice distinctions. This does not substitute canonical JSON for equality.

TLS path remains same Executor -> old handshakeService -> observationtrust
Trust.Handshake -> same original pin verifier/native handshake. No trust code,
TLS wire budget or TLS error alias changes in this slice.

## Source And Compatibility Details

- `probe.go`: actual numeric parse/unmap, CIDR/multicast adapter and socket address/
  UDP family formatting move to native/destination.go. Caller retains the same
  condition placement, single attempt, dial/error branches and connection closes.
- `echo.go`: actual native exchange moves to native/echo.go. The old private
  function keeps its signature, result bytes and original ErrDenied identity;
  lower adapter denial is mapped at that bridge. Existing errTLSBudget still
  aliases observationtrust.ErrTLSBudget and is not changed.
- `native/echo_format.go`: original JSON roundtrip, both RFC3339Nano parses,
  reflect.DeepEqual and frame-format length check move into the L2 adapter.
  ParseEchoTimes executes both parses before returning validity, including when
  the first fails. The parent retains its same ErrDenied branch. Both private
  echoFrameBytes constants alias the one exact 256-byte adapter constant, keeping
  package-local fixture references without changing framing/schema versions.
- `platform.go`: old nativeEffects constructor and scheduler/randomSource fixture
  fallbacks bind native Schedule/Entropy/Dialer factories. Public Effects stays
  the same named type. Old constructor error order and explicit-provider nil
  rejection stay in their original functions.
- `counters.go` and private budget.acquire: same old helper paths use those exact
  factories. Schedule remains platformruntime.Schedule{}, entropy remains
  platformruntime.Local{}, and each default Executor gets one fresh original
  platformruntime.NewDialer, evaluated at the original construction point.

The native exchange keeps SetDeadline and cancellation Close, a single exact
256-byte write, UDP's single 257-byte receive buffer, TCP ReadFull followed by a
single trailing-byte/EOF read, original short-read evidence, proof verification
and every original native time.Now/check/context check point. It adds no retry,
socket creation, authority decision, custom clock or shutdown state. Caller still
owns its original deferred close. Echo stays staged/default-disabled at its
existing composition and capability boundaries.

Global admissions stays one parent package variable shared across Executors:
four active, 128 keys, per-node active/cooldown and captured-schedule release.
Gate claims, random instance identity, 256 non-evicting permit IDs, Close/watch/
callback synchronization and counter epoch/attempt/drain/seal remain original.
Native extraction does not change injected Scheduler scope or native certificate/
echo hard deadline domains. Zero-value/package-local fixture fallbacks remain.

## Planned Acceptance And Remaining Dependencies

All cases below are planned, not executed. Frozen-source functional/native/network
acceptance requires later human authorization and GitHub Actions evidence:

1. Numeric IPv4/IPv6/mapped IPv4, zone/hostname/bad-port rejection; empty, malformed,
   sensitive or nonmatching CIDRs; IPv4 >=224; exact IPv6 brackets and UDP family;
   preserve resolver/parse/binding/check/expiry/policy/dial rejection order.
2. Echo exact write, short/error write; UDP short/exact/257-byte and timeout;
   TCP early EOF/unexpected EOF, exact frame plus EOF, trailing byte and missing
   EOF; proof mismatch, callback revocation, cancellation and native hard deadline
   at every old check point; exact byte counts and ErrDenied identity.
3. Old versus explicit constructors, provider nil/error order, one fresh native
   dialer per Executor, old private fixture dial field and zero-value fallbacks;
   default Scheduler/Entropy identity and unchanged Runner provider scope.
4. Shared process admission across all constructors, cooldown, Gate replay burn
   on busy/error/cancellation, current instance change, Gate Close and counter
   attempted/unknown/inFlight/drain semantics, with unchanged TLS budget alias.
5. Echo context typed-value JSON roundtrip and lower schema/digest/key/address
   rejection; wrong Binding must reject before that roundtrip. Wrong purpose,
   version, trust, selection, current service window or protocol must reject before
   invocation digest work. Wrong digest/nonce must reject before timestamp work.
   Invalid issued/expires strings, either/both parser failures, fractional/offset
   handling and zero values must retain the same original parse functions and
   later parent duration/window decisions, without a new permissive fallback.
   Nil versus empty execution slices must retain reflect.DeepEqual distinctions.
   Final request-frame/schema/challenge rejection must occur only at its original
   position; no eager combined validation reorders it.

Open source/type classification is explicit: Probe public values and Effects
retain net.Conn and observationtrust/probeecho types; parent echo validation
still maps the 11 wire binding fields into its original product Binding and
compares product measurement/domain/version/purpose/trust/selection/protocol,
challenge identity and temporal authorization. Those comparisons are deliberately
owned by L3. JSON/text/frame mechanics now have an explicit L2 owner. Parent
direct calls to probeecho IsEcho/CloneExecution/InvocationDigest are public lower
codec consumption, not private format implementations. Existing L2 probeecho
retains its public codec dependencies. Reading existing ADP3 schema decoding and
Forward's ObserveIngress confirms neither is a substitute authorization owner:
Forward retains original socket/current-stream locks and callback, and ADP3
retains protocol validation. Neither is changed or bypassed here. Runner current-
instance/resolver/wire negotiation and CLI native defaults outside this scope
need their own owner inventory. These are
not waived as a whole-package exception. Source extraction alone does not close
A3, A5, foundation acceptance or the parallel module gate; independent physical
multi-host evidence stays unverified. No tests, checks, formatters, builds,
experiments, CI, commits or pushes ran for this slice.

## Runner Registry And Echo Endpoint Continuation

The following additional source moves preserve the same owner and private
compatibility entrypoints; they do not accept all A3/A4 source or behavior.

`control/execution_drivers.go` newExecutionRegistry -> original private descriptor
mapping in execution_driver_adapter.go -> nativeexecution.ValidateLegacyDriverHeader
with the original private Start/Phase/Classify availability booleans -> original
Runner duplicate-ID map check and exact interpolated error ->
nativeexecution.ValidateLegacyDriverDeclaration -> original slices.Clone for all
six descriptor lists -> original private map/ordered append -> public adapter ->
executiondriver.NewRegistry -> executionhost.NewRegistry.

The header's original incomplete error remains first, duplicate ID remains second,
then declaration loops in roles/phases/protocols/capabilities order, consistency,
ProbeIngress presence and Probe capability loops. The legacy loops deliberately
do not acquire the stricter lower registry's length/platform/value constraints;
those still run at the original final stage. Moving them together or calling the
strict host registry early would change error order and is not done. Nil private
functions are inspected before public callback wrappers can mask their absence.
Runner still owns duplicate detection, ordered private compatibility projections
and cloning; no second runtime registry, registration mechanism or authority is
added. newExecutionRegistry/nativeDirectDriver/nativeRelayDriver/nativeMultihopDriver
and other old private entry signatures remain unchanged.

`control/probe_echo_target.go` retains explicit feature prerequisites, echo/service
exclusion, exact measurement and Binding, original JSON context/codec and current
service validity, nonce/digest, protocol loop, original business target and exact
declared host/port/public-address checks. Only the subsequent original numeric
parse/egress predicate moves to nativeexecution.ProbeEchoBusinessDestinationAllowed.
The original current assignment loop, driver resolution, protocol-selected
ProbeIngress/ProbeUDPIngress and callback/check still precede the moved
ProbeEchoIngressEndpoint. The latter retains configured parse then observed parse,
zone checks, unmap equality, port equality, resource protocol, public address,
egress policy and final port bounds in that order. Its distinct original checks
are not replaced by ProbeIngressEndpoint, whose plain-ingress sequence differs.
The caller still clones execution, tightens deadline and installs the original
current-instance callback under Runner's original mutex. No new dial appears.

Additional planned cases: each header field and private nil function; incomplete
plus duplicate; duplicate plus bad lists; role/phase/protocol/capability simultaneous
errors; missing own capability; multihop without relay; Probe port/list mismatch;
empty/repeated/overlapping Probe capability; clone alias mutation; legacy-valid
but strict-invalid descriptor, including empty platforms and size bounds. Preserve
all exact old error strings and built-in Direct/Relay/Multihop order. Echo endpoint
cases include two parse failures, zones, mapped representations, wrong protocol,
observed port mismatch/out-of-range and egress/public-address rejection, with
current-stream/callback failures occurring before native projection. None ran.

## Concrete Agent Source And Type Ownership Inventory

This is a scoped source-read inventory, not an executed boundary report or blanket
classification of every Agent file. No source/type/import validation tool ran.

| Source | Owner and public consumption | Exact default or retained bridge; residual |
| --- | --- | --- |
| `control/runner.go` | L3 reconciliation; adp3 values, authorization Guard/Ticket, state RuntimeJournal, public execution/native codecs | New -> defaultProviders -> defaultEffects -> defaultLocalServices. Poll identity/history checks, guarded ticket acceptance, original state.AcceptRuntimeSnapshot and mutex/current-instance updates remain product policy. Direct time.Parse and snapshot/report projection still require format classification. |
| `control/platform.go` | Declared provider/effects/default compatibility seam; generic executionidentity/executionchannel/runtimeplatform/runtimeobservation ports with tls/x509/http bindings | Exact defaults: agentidentity.Native, controlchannel.Native, platformruntime.Bootstrap/Schedule/Local, platformobservation.Native. Explicit constructors reject missing providers; private fixture fallbacks remain exact. No new composition root. Native public type references require an explicit binding classification, not L1 purity. |
| `control/execution_drivers.go`, `execution_driver_adapter.go` | L3 compiled registry/instance compatibility coordination consuming public executiondriver and nativeexecution | Actual legacy declaration mechanics now lower; private descriptor and callback shapes remain precise compatibility bridges. Builtins still Direct, Relay, Multihop; actual OS selection belongs to executiondriver. |
| `control/native_direct_driver.go`, `native_relay_driver.go` | Existing private source bridges only | Forward all original names to public nativeexecution; native relay helper still exposes *relay.Engine as a typed compatibility binding, not a generic L1 interface. |
| `nativeexecution/direct.go`, `relay.go`, `assignment_wire.go`, `runner_wire.go`, `catalog.go`, `probe.go`, `legacy_registry.go`, `probe_http.go` | L2 native wire/config/engine adapters using executiondriver public binding, ADP/contracts and existing forward/relay owners | Public native inputs are not permission. Strict live ADP decoding versus retained JSON-only decoding remain distinct. Original peer identity lookup precedes relay conversion; Maximum still clamps at 4096. Probe HTTP JSON/body mechanics now live in probe_http.go. |
| `executiondriver/driver.go`, `registry.go` | L2 native type/actual-platform binding over L1 executionhost | Generic aliases specialize ADP assignment/policy and relay.Identity; runtime.GOOS remains here. NewRegistry still delegates to the one executionhost registry. |
| `executionhost/driver.go`, `registry.go` | L1 generic driver lifecycle/descriptor/selection contracts | No native assignment/relay/OS imports. Caller supplies platform, policy, identity and authority callback. Generic host does not own Runner/history or mint tickets. |
| `control/probe_negotiation.go`, `probe_registration.go` | L3 original Probe session identity/currentness/rotation owner consuming probenegotiation/probeinstance, Probe Gate and lower HTTP auxiliary | Negotiation selects old native Probe constructors; Runner Scheduler/Entropy injection is not silently copied into Probe. Registration serializes probeChange, closes predecessor Gate then waits outside runner.mutex, and rechecks node/boot/epoch/fingerprint/Guard/expiry. JSON/body I/O now use probe_http.go at original call points; direct timestamp parsing remains. |
| `control/probe_delivery.go`, `probe_claim.go` | L3 original offer/claim budgets, claim tombstone/current target/receipt owner over public lower codecs/channel | Process probeDeliveries remains the original shared HTTP admission budget, distinct from unchanged Probe socket admissions. Burn-before-I/O and one retained receipt remain. Legacy helpers use native Schedule/Local, while live methods use Runner injected ports. JSON, io.ReadAll/LimitReader and error body decode now have one L2 implementation; Binding/request assembly and timestamp/currentness rules remain parent-owned. |
| `control/probe_authority_watch.go`, `probe_execution.go`, `probe_workflow.go` | L3 original watch, execute and report-once owner consuming public Probe/lower wire | Watch retains runner/session/receipt pointer and current-instance checks, shrinking cutoffs and original close/drain. Execution retains conservative monotonic-to-server projection; report bit burns before I/O. Wire body assembly/JSON/time formatting are residuals interleaved with these product rules. |
| `control/probe_types_instance.go`, `probe_types_delivery.go`, `probe_types_execution.go` | L3 typed qualification/current-machine and v2 dispatch/evidence decisions over public probetypes | Machine/qualification/poll/claim wire mechanics and time text now use explicit lower qualification/delivery adapters; original Binding conversion, descriptor eligibility and evidence policy remain product-owned. v2 status/result/report format in execution.go is outside this slice, not claimed closed. |
| `control/probe_services_instance.go`, `probe_services_delivery.go`, `probe_services_execution.go` | L3 service-bound qualification/dispatch/result rules consuming public probeservices and observationtrust | Machine/qualification/poll/claim and native context/selection conversion now use lower adapters with original private bridges; trust/fingerprint evidence decisions remain product-owned. serviceProbeResult native Schedule fixture must not replace live injected schedule. v3 execution/status/report remains outside this slice. |
| `control/probe_echo_instance.go`, `probe_echo_delivery.go`, `probe_echo_execution.go`, `probe_echo_target.go` | L3 original echo qualification, exact service/challenge/instance matching, receipt/results and current target | Machine/qualification/poll/claim/invocation field projection now uses lower adapters; exact digest/version/challenge and feature/instance checks remain L3. Native address mechanics are lower; target JSON/reflect mechanics and v4 execution/status/report remain separate residuals. |
| `control/native_direct_probe.go` | L3 current Runner/Ticket/Journal/instance target proof consuming nativeexecution public projection | Original exactly-one-live-assignment scan and immutable tuple checks precede native config; deadlines are min of current Runner and instance tickets, CIDRs detached. Receipt ingress checks compare original stream identity. |
| `control/credentials.go`, `relay_credentials.go` | L3 renewal/replay/credential-currentness policy over public executionidentity provider | Exact private certificate helpers delegate agentidentity; machine change closes Probe under original mutex and updates Guard after unlock. Relay historical verification never grants live authority; save/reload/pending cleanup and timestamp rules remain. JSON request assembly/direct timestamp parsing remain format debt. |
| `authorization/guard.go`, `clock.go` and synchronized-clock bridge | Compatibility wrapper to single L0 executiontime decisions plus explicit L2 platformclock default | Ticket aliases the original executiontime.Ticket. Guard retains the legacy overridable clock field by callback, without copied Guard state; native clock/proof work stays in platformclock. |
| `state/journal.go`, `adp3_journal.go`, `runtime_adapter.go`, `platform.go` | L2 protected MAC/file/ADP envelope adapters around executionstate history owner | Journal and RuntimeJournal alias lower original types. runtimeFileStore uses same path/key/lock/load/save; state adapter keeps strict live snapshot validation separate from previous JSON recovery. AtomicWrite/AcquireLock alias platformstate, no replacement store/history. |
| `control/transit_runner.go`, `transit_runner_bridge.go` | Existing explicit integration controller and fail-closed physical-owner bridge | Not invoked by Runner Run/poll. Existing live ticket and independent Control authorization both required; any historical/live/draining Direct/Relay physical port denies Transit. No new route or release/reset permission. |
| `cmd/tunex-agent/main.go` | Existing CLI composition root; not a reusable business precedent | Original flags remain false by default. Proof/key/state paths and inspect-only refusal precede run. state.AcquireLock -> crypto/rand boot ID -> control.New -> signal context -> Runner.Run. Inspection/enrollment stay separate existing branches, with no implicit init/recovery. |

The source chains across those entries remain:

1. CLI protected path/lock -> Runner bootstrap -> original MAC/Runtime Journal ->
   machine identity/channel -> Hello -> Guard/native synchronized clock ->
   snapshot identity/history/strict driver selection -> same state acceptance ->
   same Ticket and assignment callback -> original native direct/relay engine.
   Runtime state is saved before accepted in-memory execution, at the same point.
2. Native start -> original direct authorized start or relay Prepare -> original
   phase -> Close on partial phase failure. Runner replacement and fallback-start
   stay distinct, with original beginDrain/SetAuthorization/Ticket.Drain and old
   deadline clamp. Removed drains survive pending report/ACK until the old exact
   matching cleanup, and stop closes original instances and retained counters.
3. Runner negotiation -> original native Probe Executor/Gate -> registration
   predecessor close/current session -> qualification -> poll -> burned claim ->
   retained receipt -> monitor/current Guard/Ticket/Journal/stream recheck -> same
   Gate burn/global admission/dial -> conservative result -> report-once -> same
   report cutoff and final authority recheck. HTTP ACK cannot mint execution.

## Remaining Freeze Blockers And Integration

The original Probe HTTP body/JSON adapter slice in registration/delivery/claim/
negotiation is now authored as recorded below. Remaining source slices include
typed/services/echo wire request/result construction and timestamp mechanics
around explicit unchanged product conditions; then Runner
remaining ADP timestamp/report and credential wire mechanics. Each must keep exact
early error order and native/injected sampling points. For example echo target
currently returns on JSON marshal failure before sampling Now, but samples Now
after ParseServiceContext even on parse failure; a combined decode helper that
moves that sample would need a more precise contract. Do not silently reuse a
similar-looking helper. No frozen public semantic change is proposed here.

Main integration should classify new nativeexecution/legacy_registry.go as L2 and
the existing changed nativeexecution/probe.go as the same explicit adapter owner;
new private publicExecutionDescriptor is a compatibility projection, not a second
public domain type. Record the additional source files and planned legacy error/
clone/strict-host and echo endpoint cases in readiness, retaining all unexecuted
statuses. Probe native child remains explicit L2 from preceding slices. This
inventory intentionally leaves the listed mixed source and public type/default
bridges open for A5; neither all control nor all agent can be exempted. Functional
start/partial cleanup/replacement/drain/stop/recovery/network/platform evidence is
still planned for the exact later-frozen source; physical-host evidence remains
unavailable/unverified. No validation or Git mutation has run for this continuation.

## Original Probe HTTP Body And JSON Source Slice

New `nativeexecution/probe_http.go` owns actual JSON marshaling, bounded response
body reading, error-body JSON projection and original codec parse/check sequences.
The four existing Control file entrypoints keep their signatures and product
state. No executionchannel provider/effects contract changes, new native defaults,
retry, redirect policy or parser fallback are introduced.

Exact source chains and order:

- `probeInstanceExchange`: original Scheduler WithTimeout(2s)/cancel defer ->
  EncodeProbeRequest -> same auxiliary ProbeInstance -> original Body.Close defer
  -> ReadProbeResponseBody(maximum 4096, actual reader limit 4097) -> reader error
  -> oversized maps to same probe.ErrInvalid -> non-200 maps to same private
  httpError using ProbeResponseErrorCode -> original probeinstance ParseResponse
  then CheckResponse through DecodeProbeInstanceResponse -> same work.Err check.
- `claimProbe`: original current session/Binding/Guard/target/request/replay/capacity
  sequence -> same claim burn under Runner mutex -> unlock -> original started
  sample, WithTimeout(2s), session AfterFunc and defers -> EncodeProbeRequest ->
  same auxiliary ProbeClaim and original forbidden-URL mapping -> original close
  defer -> same 4096/4097 reader/error/size/status sequence -> original claim
  ParseResponse then CheckResponse through DecodeProbeClaimResponse -> original
  Binding/server-time/expiry checks -> same monotonic deadline -> original mutex
  and work.Err/current session/target checks -> same retained receipt and final
  receivedAt sample. Body error or lost ACK never restores burned identity.
- `probeDeliveryExchangeBounded`: original started sample -> original allowed
  (path, limit) pair check -> same min(session.until, started+200ms) deadline and
  session cancellation hook -> EncodeProbeRequest -> original request-byte limit
  4096 -> same URL/client capture under mutex -> same auxiliary ProbeDelivery and
  forbidden-URL mapping -> original close defer -> ReadProbeResponseBody(limit)
  -> reader error -> oversized/ErrInvalid -> same work.Err -> non-200/error code.
  Plain maximum remains 4096; 32768 is allowed only for services/echo poll, with
  reader limit 32769. Reader limits never become larger request-byte limits.
- `pollProbe`: original currentness/skew/shared admission/request-ID sequence ->
  original PollRequest shape -> EncodeProbePollRequest performs original Marshal
  then ParsePollRequest -> same exchange re-encodes request -> DecodeProbePollResponse
  performs original ParsePollResponse then CheckPollResponse -> original freshness/
  mutex/session/replay/target/deadline and detached offer. Duplicate marshaling
  from prevalidation and actual exchange remains at the original two points.
- `negotiateProbe`: same feature-based old native Executor/Gate and optional counter
  creation -> original NewRequest -> EncodeProbeRequest -> original WithTimeout
  and Runner request -> DecodeProbeNegotiationResponse performs original strict
  ParseResponse then CheckResponse -> original time parse/work.Err/current
  node/boot/epoch/Guard checks. Accepted flag and deferred Gate cleanup are intact.

ReadProbeResponseBody returns `(raw, oversized, err)` so a reader's original
error identity is never replaced by a limit sentinel. Partial read bytes may
still exist on error, but callers take their original error branch before any
size/status work. Lower helpers never close a body, read clocks, access Runner/
Gate/session/budgets or perform a request. ProbeResponseErrorCode deliberately
ignores the original json.Unmarshal error and preserves partially decoded Code;
it does not replace error bodies with strict success-message schema parsing.

Planned, unexecuted acceptance additions:

1. Empty/exact 4096/4097 and exact 32768/32769 responses; oversized non-200;
   partial bytes plus reader error; request JSON marshal error and >4096 request;
   invalid larger-limit/path combinations before deadline/provider access.
2. Non-200 absent/wrong-type/malformed/partial code fields retain the old Code
   value and httpError; provider/reader errors propagate exactly. Forbidden URL
   still maps only where the old claim/delivery paths did so.
3. Observe body Close after every original parse/check/error path, including
   under the original Runner mutex/defer order on claim return; no early close
   in the lower reader. No new request, retry or drain is added.
4. Simultaneous context cancellation and non-200/schema-invalid response preserve
   each distinct owner order: delivery context before status; instance context
   after parse/check; claim context at original later held-lock point; negotiation
   after its original server-time parse.
5. Schema/response correlation mismatches at instance/claim/poll/negotiation;
   exact encoded bytes and both poll marshaling points; claim tombstone persists
   on marshal/provider/read/limit/status/codec/time/current-instance failure.
   Shared HTTP and socket budgets, current session and report-once unchanged.

Main integration should add probe_http.go to explicit L2 classification and record
the four changed Control files and these planned cases without claiming any
executed acceptance. Residuals within this exact scope are direct timestamp
parsing and original wire-to-product Binding/request-shape projection; product
session/guard/ticket/claim/freshness/expiry decisions intentionally remain L3.
Other agents own typed/services/echo and Runner/credential format continuation;
this record does not certify their state. No shared readiness/boundary/FR/status
file or shared root was edited, and no checks/tests/builds/experiments/CI/Git writes
ran. A3/A4/A5 and foundation acceptance remain open.

## Qualification, Delivery And Legacy Status Wire Continuation

This later source slice adds two explicit L2 files, both consuming existing lower
codec/trust/entropy APIs without importing product Control, Probe Gate or Runner:

- `nativeexecution/probe_qualification_wire.go`: original 32-byte request-ID read
  and hex projection; v2/v3/v4 Machine fields; exact qualification request shape,
  Marshal/Parse and response Parse/Check; original RFC3339Nano parsing; original
  service context Marshal -> service codec -> Unmarshal -> native trust and
  selection projection; original echo invocation fields and TLS-context conversion.
- `nativeexecution/probe_delivery_wire.go`: original v2/v3/v4 poll fields and
  Marshal/Parse, claim fields and separate Marshal/Parse, response Parse/Check;
  original v1 status shape, Marshal/Parse and response Parse/Check.

Changed product files are `probe_types_instance.go`, `probe_services_instance.go`,
`probe_echo_instance.go`, their three `_delivery.go` files, the explicitly assigned
v1 status section in `probe_authority_watch.go`, and the earlier assigned
`probe_registration.go`, `probe_delivery.go`, `probe_claim.go`,
`probe_negotiation.go` for their remaining time-text call points. The three
`probe_*_execution.go`, Runner/credentials, native probe.go/runner_wire.go and
shared docs were not edited in this slice. The existing HTTP helper is reused,
not rewritten.

### Qualification And Provider Order

Each original `probe*MachineWith` first calls the unchanged private request-ID
entry, which delegates the moved original entropy read/hex implementation. It
then passes the same node/boot/epoch/Gate instance/generation/id values to the
wire projector. The original package-private zero-argument helpers still pass
platformruntime.Local; live Runner methods still pass runner.entropy(). Neither
the lower helper nor explicit Effects adds a nil fallback, extra entropy read or
full-buffer check that the old source did not have.

Original `qualifyProbeTypes/Services/Echo` still owns feature/currentness/pending
checks under the Runner mutex, skew capture, shared admission and the exact
inspect-then-register loop. After the original Machine call the lower helper
constructs the same Kind/action/measurement list and performs original JSON
Marshal followed by ParseQualificationRequest. The existing exchange still
marshals the same request again. Response lower helper performs only original
ParseQualificationResponse then CheckQualificationResponse. Original caller
then parses server text at the same point, validates the original Guard and
server high-water, rechecks currentness, applies inspect/Qualified nil/value
rules, and only for register parses qualified/expiry texts before original
window/remaining/deadline checks and final mutex/currentness sample/state update.

ParseProbeQualificationTimes executes both original parses even when the first
fails; callers retain the same single ErrDenied branch. It does not dereference
optional fields before their original parent nil checks. ParseProbeWireTime is
the same time.Parse(time.RFC3339Nano, text), returning its original errors and
zero/partial result values to unchanged caller decisions. It never reads time.
Legacy freshness still parses observed then server, runs Guard validation, computes
the same conservative age, and samples the same injected/native Scheduler after
that calculation; only text decoding now lives below.

### Poll, Claim And Status Order

Poll keeps feature/currentness/skew -> original global admission -> Machine
entropy -> same request/Marshal/Parse -> original bounded exchange -> original
response Parse/Check -> original freshness. Typed path still holds/rechecks its
mutex before the nil-offer decision; services/echo still decode optional offered
context at their original points before final locked checks. No nil-offer path
is unified with another family's order. Descriptor/selection/challenge/current
target/replay/deadline conditions stay in the same product functions.

Claim deliberately uses separate lower field projection and lower encoding
functions. Request fields are constructed at their old pre-burn point under
Runner mutex, then the same replay/capacity checks burn the original session
claim ID. Original skew/limit capture, unlock and WithDeadline precede lower
Marshal/ParseClaimRequest, which still precedes the original shared HTTP admission.
The same bounded exchange and response Parse/Check follow. Caller retains family
and exact service/challenge/Binding/timeout/issued/expiry comparisons, Guard
server-time check, remaining duration, original mutex/work.Err/currentness,
receipt receivedAt sample, original stream identity target recheck, cutoff and
retained receipt. Any codec error still leaves the original claim tombstone.

V1 status keeps family dispatch, local watch/current-target check, watch mutex and
fresh cutoff, deadline, original request-ID call, same wire request fields and
Marshal/Parse, existing delivery exchange, response Parse/Check, same exact
receipt comparison, freshness, second local watch check, original checked/server
text parsing, work.Err and watch.publish. No ready/until/fresh/last-server state
or supervisor/Close/drain code moves. V2/v3/v4 status methods inside the excluded
execution files remain explicitly outside this slice.

### Native Context And Timing Compatibility

Original `probeServiceContext` remains a private wrapper with its old signature,
including nil -> nil,nil and unchanged propagated codec/trust errors. Lower
ProbeServiceContext samples native time.Now only after successful original JSON
Marshal, service-context codec and Unmarshal; the trust validation itself runs
after that sample exactly as before. ProbeServiceSelection still returns a fresh
detached field-only selection. This does not introduce Runner's injected schedule
into the previously native trust path.

Original `probeEchoInvocation` still checks kind/required service/challenge before
wire projection. It still compares original invocation digest with the original
challenge and calls RequestFrame in their old order; the native projector cannot
mint or validate a Gate instance. Echo offer context Marshal errors propagate
unchanged before the original parser/version-to-ErrDenied branch. Its TLS branch
retains challenge/measurement/version checks before the exact Marshal/Parse
conversion and original service-context wrapper. The distinct echo target path
was not edited: its marshal error still returns before Runner Now; its codec
parse occurs before Now and its parse error still rejects after that sample.
Do not conflate that order with the separate successful-codec native trust chain.

### Additional Planned Acceptance And Integration

All cases are unexecuted and need the later exact frozen source:

1. V2/v3/v4 Machine and qualification/poll/claim wire bytes, Kind/version/action/
   measurements/nil-empty distinctions; original prevalidation plus exchange's
   second serialization; schema errors and response correlation error identity.
2. Inspect cannot accept qualified fields; register requires both optional times;
   both text parses execute, invalid either/both/offset/fractional texts retain
   exact original codec/parse rules and parent ErrDenied versus raw errors.
   Wrong server high-water/Guard/currentness must reject before field/state work.
3. Every family retains one original session/Gate and its shared claim tables;
   Marshal/Parse/admission/provider/ACK/current-instance failure after burn cannot
   refund ID, create another poll slot, retry a different protocol or qualify a
   lower family. Qualification and receipt writes stay under original mutexes.
4. Zero/native helper versus live injected Entropy/Scheduler scope; one 32-byte ID
   read at original point, unchanged source error and short-read-without-error
   behavior; no new provider fallback. Every original Now/deadline/check callback
   ordering, including currentness changes between decode and lock, remains.
5. Native service nil/marshal/codec/unmarshal/trust failures; no native Now before
   original successful codec chain, exact trust error propagation and detached
   selection/context. Echo invocation missing challenge/context, bad digest/frame,
   mixed TLS/echo fields and exact old error mapping. Echo target's distinct
   pre-/post-Now errors stay separately covered.
6. V1 status malformed request/ACK, wrong receipt fields, old checked/server,
   session revocation, late cutoff and cancellation before publish. Supervisor,
   report-once, Gate burn, socket/HTTP admission, close/drain and raw connection
   lifetime are still original state owners and need their existing acceptance.

Main should add both helper files to L2 inventory and record the exact changed
Control leaves plus planned cases in readiness. Residuals are explicit: excluded
v2/v3/v4 status/report code in execution files; echo target's JSON/reflect native
mechanics; product-owned Binding conversion and measurement/descriptor/selection/
challenge/time-window policy; other original Runner/CLI/native wire classification
outside this task. Public lower codec calls are not a private-source exception.
No public frozen API/semantics change or new FR is required by these private
source moves. No tests, static/type/syntax/import/boundary checks, formatting,
generation, builds, CI, native/network experiments or Git writes ran. This is
source progress, not A3/A4/A5 or foundation acceptance.

Readiness82 and the shared boundary inventory now record the explicit child L2
source owner and planned cases. This integration is source-only, not acceptance.

Current shared integration records legacy_registry.go in existing nativeexecution
L2 and exact echo endpoint helpers, with readiness96/97 planned/unexecuted.
Remaining source blockers above and all acceptance gates remain unchanged.

Current shared source integration records probe_http.go and readiness104 planned
cases. Body/JSON extraction is not acceptance or closure of remaining time/wire debt.
