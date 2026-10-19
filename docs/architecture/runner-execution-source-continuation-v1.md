# Runner Execution Source Continuation v1

Latest source continuation: [execution/status/result/echo/shared time](agent-execution-wire-source-v1.md).
Original execution status/result/ACK/echo-format and the named Hello/Relay text
parses now use public L2. Parent statement positions, clock short circuits and
history/Guard callbacks remain. This supersedes older remaining-format statements
for those exact files; readiness111/112/114 are planned only, not A4 acceptance.

Date: 2026-10-19 (Asia/Shanghai). A4 source candidate, authored and unverified.
This continues [Agent execution host](agent-execution-host-v1.md), not a complete
Agent boundary or foundation acceptance. The current dirty source is not
identified by the base HEAD alone.

## Scope And Contracts

This slice separates the original Runner ADP representation and native engine
configuration from execution coordination. L1 executionhost and the typed
executiondriver Host/Driver/Instance/Registry contracts remain unchanged.
`nativeexecution/runner_wire.go` owns the original Runner JSON/strict parser
operations. `nativeexecution/assignment_wire.go` owns original Direct config/policy
and Relay assignment conversion. `direct.go` and `relay.go` retain their existing
driver declarations and native engine lifecycle bodies. There is one conversion
implementation, and the old Control helper names continue to call it.

The additional L2 codec functions receive only existing typed values or bytes;
they receive no Runner, authority issuer, Guard, ticket, Journal path/key or state
writer. Representation decoding is not authorization. No frozen public L0/L1
contract, feature default, role/phase/protocol, persisted format, capability,
native engine API or native wire version changes in this source intent.

## Original Entry And State Chains

| Entry | Codec/adapter chain | Original decision/state owner |
| --- | --- | --- |
| Runner.Run Hello | EncodeRunnerHello -> original channel -> DecodeRunnerHello -> existing adp3.Parse(HelloResponse) | Runner checks Node/Boot, initializes Guard, validates server time and starts selected loops |
| Runner.poll live Snapshot | original channel -> DecodeRunnerSnapshot -> existing adp3.Parse(Snapshot) | Runner checks extension/identity/session/history, samples time and obtains the original ticket |
| Runner.poll prior Snapshot | authenticated retained Journal bytes -> DecodeRetainedRunnerSnapshot -> original json.Unmarshal | Runner maps the original corrupt-JSON error and compares prior assignment configuration/phase before accepting history |
| Runner.poll Report | Runner observations/drains -> EncodeRunnerReport -> original json.Marshal | Runner owns sequence exhaustion/increment, observations, drain close decisions and pending bytes |
| Runner.report ACK | original channel -> DecodeRunnerReportAck -> existing adp3.Parse(ReportAck) | Runner checks exact Node/Boot/session/sequence before reading locally pending report and retiring drain entries |
| Runner.report local pending projection | DecodePendingRunnerReport -> original json.Unmarshal | Runner retains the original best-effort partial decode and only clears pending after matching ACK |
| Direct start/replace | old Control helpers -> nativeexecution -> DirectAssignment; start also directPolicy | Runner owns all selection/history/ticket checks; original forward engine owns sockets and instance callbacks |
| Relay start | old Control helpers -> StartRelay -> RequirePeerIdentity -> relayAssignment -> original strict adp3relay.Parse -> relay.Prepare -> FinishRelayStart | Runner supplies exact existing peer/check; native engine owns prepared sockets and activation/drain/close |
| Multihop start | old Control helpers -> StartMultihop -> RequirePeerIdentity -> original relay.PrepareMultihop -> FinishRelayStart | Original native parser/engine and Runner authority owners remain |

Live parsing and retained-state decoding deliberately remain distinct. Retained
Snapshot is JSON-only at this call point; no new live parser or relaxed fallback
is inserted. Report encoding keeps only the original nil-observations-to-empty
projection; drains, field order, timestamps and caller sequence decisions stay
unchanged. Hello retains its original ignored marshal error; pending projection
retains its original ignored unmarshal error and partially decoded result. This
slice does not silently tighten or broaden those existing compatibility paths.

## Defaults And Compatibility

The builtin driver order remains Direct, Relay, Multihop. Native wrappers retain
all old private factory/start/replace/phase/maximum/error helper signatures.
Native DirectAssignment keeps its existing exported signature after relocation
within the same package. Typed registry zero-value behavior and platform binding
remain at executiondriver/executionhost and are not modified here.

Runner.New still supplies the original native identity/channel, bootstrap,
scheduler and local providers through its existing constructors. Explicit provider
constructors retain their existing nil rejection, while old private/direct Runner
construction retains existing per-provider fallback. CLI run still calls
control.New with exactly the original parsed options. All opt-in flags remain
false by default; required feature combinations and import/journal migration
checks remain at the same CLI/Runner decision points.

CLI inspection still reads the authenticated original Journal without Control;
online startup still validates proof/key boundaries, acquires the original
instance lock, generates BootID, constructs Runner, installs the signal context
and runs it. Enrollment still uses the existing enrollment host. None of these
CLI/state operations moves into a codec or starts another state owner.

## Lifecycle And Failure Order

Runner.poll still processes pending ACK before fetching a new Snapshot, performs
selection and native identity checks before protected acceptance, and persists
the original RuntimeJournal before any instance start/replacement. Its existing
mutex, context/ticket checks before execution and bind, old deadline, callback and
instance/drain maps remain at the original statements. No codec can acquire a
Runner lock, issue a ticket, extend a deadline or accept history.

Direct keeps assignment conversion before policy conversion and TCP/UDP dispatch;
replacement keeps assignment conversion before native instance type dispatch.
Relay keeps peer-identity lookup before assignment conversion, then forces the
native prepared phase before Prepare. Capacity still selects the original TCP/UDP
policy and clamps to 4096. FinishRelayStart still closes the same prepared engine
on phase/activation failure; successful active/draining paths return that engine.
Error prefix, retryability and bind-error classification remain unchanged.

Replacement still tries the original in-place path, drains the old instance, and
only then falls back to the same driver's start when replacement fails. The
original beginDrain derives the old ticket's drain ticket, installs its callback,
calls Drain, calculates its recorded cutoff from the old deadline and supplied
time, and stores the same instance. Report/guard paths retain their original
Remaining/ticket/Close and ACK removal behavior. No new cleanup/recovery policy is
inferred from this extraction.

Run still defers channel cleanup and Runner.stop; enabled workers retain their
original cancel-and-wait defers. The independent 100 ms guard checks original
Guard/ticket authorization under the Runner lock, closes Probe, cancels the run
and closes active/draining instances on expiry. stop keeps Probe stop/close,
active close/tail/delete, then drain close/tail/delete ordering. Restart still
requires a new generation, preserves original fences/retired high-water and uses
the same RuntimeJournal acceptance. No history reset, new driver or shell exists.

## Planned Acceptance And Remaining Work

No tests, checks, formatter, generator, build, native/network/container/browser
experiment, CI, commit or push was run. These are planned cases for later
authorized Actions against one frozen source revision, not executed evidence:

1. Compare exact Hello/Report JSON bytes, nil/empty observations and drains,
   unchanged fields/timestamps/order, codec errors and pending report partial
   decode. Compare all live parser valid/unknown/invalid/oversized/version cases.
2. Compare retained Snapshot JSON-only recovery, corrupted JSON error, protected
   identity/MAC/history rejection and restart-new-generation requirements. Live
   strict parsing must not replace retained decoding or become its fallback.
3. Compare Direct config/policy JSON failure order, TCP/UDP starts/replacements,
   phase/type refusal, callbacks and public/legacy helper equivalence. Compare
   Relay peer refusal before wire errors, exact injected fields, prepared phase,
   original strict parser, capacity clamp and exact error/retry classification.
4. Compare failed partial preparation/activation cleanup, unchanged same-instance
   return, replace/drain/fallback, authorization expiring at bind and during I/O,
   prior/current deadline behavior, stop idempotence, worker cancellation/wait and
   ACK-driven drain retirement. Do not infer hard-deadline equivalence from source.
5. Compare zero-value typed registry, exact builtin ordering/capabilities, feature
   refusal/defaults, legacy constructor/provider behavior and CLI flags/inspection/
   enrollment/lock order. No local acceptance is authorized by this document.

Control's private registry still has legacy prechecks/indexing with distinct error
order before the public registry; removing it requires explicit equivalence work,
not assuming duplicate checks are interchangeable. Native engine/wire internals,
authority/Journal mixed dependencies, remaining Runner/Probe/Transit/CLI imports
and whole-source/type/default classification remain A4/A5 work. The native L2
codec entrypoints do not certify that the entire control package is compliant L3.
Shared readiness and boundary records are integrated by the main owner. A4,
foundation acceptance, the upper-module gate and stages B-E remain incomplete;
independent physical-host/release evidence remains unverified.

## Second A4 Slice: Native Catalog And Advertisement

The actual legacy registry source is `control/execution_drivers.go`; there is no
`control/native_driver_registry.go` in this source tree. This slice reads the
entire registry/adapter/native factory chain and moves its original native
advertisement algorithm and builtin factory order to `nativeexecution/catalog.go`.
It does not move or rewrite the legacy constructor validation.

`BuiltinDrivers` returns the same ordered Direct(), Relay(), Multihop() values.
Control applies the same adaptExecutionDriver conversion and calls its original
newExecutionRegistry. Old nativeDirectDriver/nativeRelayDriver/nativeMultihopDriver
private functions remain precise delegates for existing callers. All descriptor
validation, duplicate/name/list/requirement/Probe errors, original checks before
cloning/indexing, public registry construction and error propagation remain in
the original order in Control. No lower adapter imports Control types or state.

`executionRegistry.capabilities` translates its existing ordered values through
the existing publicExecutionDriver adapter and calls L2 Capabilities. That one
projection retains the original adp.3 prefix, actual-platform and Relay/Multihop
gating, declaration order and first-occurrence dedup. Probe advertisement still
requires explicit ingress plus a non-nil ingress callback; TLS still additionally
requires services, and TCP/UDP echo still requires echo plus services and a non-nil
UDP ingress callback. A descriptor's Probe list and callback absence retain their
original treatment. The adapter never calls a start/phase/observation callback.

Zero-value private registry capability projection still returns only adp.3.
Typed registry zero-value behavior, native host version 1 and every wire/default
remain unchanged. Factory output is a fresh list of original factory values; it
is neither dynamic registration nor an authority grant. Execution selection and
Runner options/current-instance/Guard/Journal state remain with their owners.

Planned additional acceptance, entirely unexecuted: compare old/private and L2
projection on empty/zero-value and custom ordered registries, duplicate native
capabilities, disabled/unsupported platform, all Relay/Multihop combinations,
each Probe opt-in combination, nil callback and empty/duplicate declarations.
Compare exact builtin metadata/order and original legacy constructor errors when
multiple declaration defects coexist, including errors that precede the public
registry's stricter validation. Preserve existing error strings and first refusal;
do not normalize them merely because the lower registry also validates. Recheck
old helper equivalence and unchanged Hello capability bytes at the final frozen
revision. No tests/checks/formatter/build/experiment/CI/Git write was executed.

This is additional original implementation extraction. Remaining private
prechecks/indexing and native engine/authority/Journal/CLI classification are
still open. Shared readiness/boundaries integration belongs to the main owner;
A4/foundation acceptance and the upper-module gate remain incomplete.

## A3/A4 Probe Result Wire Slice

The original v2/v3/v4 result projection, JSON encoding and strict result parsing
now have one L2 source in `nativeexecution/probe_result_wire.go`. This is actual
native representation code moved from three existing Control implementations:

| Original private entry | Same-owner decisions retained | L2 representation entry |
| --- | --- | --- |
| typedProbeResult | original typed/services guard, descriptor lookup and Point check | ProbeTypesResult |
| serviceProbeResult/serviceProbeResultWith | original services/typed guard, descriptor/Point, service equality, trust check using supplied scheduler, TLS version/ALPN/fingerprint/status and non-TLS refusal | ProbeServicesResult |
| probeEchoResult | original echo/input/service/TLS guard, descriptor/Point/measurement, VerifyProof, verified status/code and exact 256/256 payload checks or original rejection codes | ProbeEchoResult |

The original private signatures, native default serviceProbeResult wrapper and
injected serviceProbeResultWith scheduler remain. The TLS branch still samples
schedule.Now at its original observationtrust.New call, after service equality and
before TLS evidence checks. No helper receives a scheduler, clock, receipt,
watch, Runner, Guard, ticket, Journal or issuer. Their inputs are the same original
wire fields and already selected descriptor/binding/service/evidence values;
projection does not grant permission or validate a live instance.

Each helper constructs its own exact original machine version (protocol 3,
ProbeVersion 2/3/4), kind and fields, then performs the same json.Marshal and
version-specific ParseResultRequest in that order, propagating those original
errors. V2 has no Service/TLS/Echo projection. V3 retains Service and TLS in its
actual v3 body and zero application payload. V4 retains Service, Challenge, Echo,
RequestBytes/ResponseBytes and their original uint64 sum for application payload;
its original omitted TLS field stays the zero value of the same wire struct.
ApplicationHealth remains unknown and Source remains agent-reported. No result
is sent through the legacy v1 route or a lower-version digest.

Parent authority, receipt/current-instance checks, result lifetime, shared
report-once bit, body snapshots, per-version request copies, claim/receipt maps,
budgets, deadline samples, ACK parsing/checks and subsequent authority rechecks
remain unchanged. Status request/response and qualification/delivery mechanics
remain separate source debt. This file does not edit or define the other slice's
nativeexecution/probe_http.go, generic request encoding, bounded response reader
or response error helpers.

Additional planned cases, all unexecuted: compare old private/new L2 typed wire
bodies and digests for v2/v3/v4, exact machine version/kind/field/null behavior,
strict parser size/schema/version/error order, malformed field handling, zero
and verified TLS evidence, ALPN/fingerprint/status mismatch and injected/native
schedule samples. Compare valid/rejected echo proof and exact 256/256 evidence,
payload sum, Challenge/Service copying, rejected-result codes and cross-family
refusal. Verify that product rejection happens before projection/schema errors,
original report-once/lifetime/current-instance behavior remains, and ACK failure
does not refund claims or permit another report. Functional evidence belongs in
later authorized Actions on the same frozen source. No tests, checks, formatting,
build, CI, native/network experiment, commit or push ran for this slice.

## A4 Report/Drain And Credential Representation Continuation

The original report/drain field and timestamp projection now lives in
`nativeexecution/runner_report_projection.go`. RunnerDrain receives the same
assignment and retained started/deadline/count/condition values and formats the
original UTC RFC3339Nano StartedAt/Deadline fields. EncodeRunnerReportAt receives
the Runner's original node/boot/session/sequence/generation, observations, drains
and already sampled poll time; it builds the same protocol-3 body and calls the
existing EncodeRunnerReport, including its original nil-observations handling.
Neither helper reads a clock, stream, ticket, Guard or Journal.

Runner.poll still checks sequence exhaustion, increments once, iterates the same
drain map in its original order, calls Remaining, then checks zero/ticket with the
original short circuit, closes expired/empty streams and projects removed versus
draining before report encoding. It still assigns the resulting bytes/error to
the same pending field. No map sorting, drain deletion, slice normalization or
extra timestamp sample is added. beginDrain's ticket/callback/Drain/cutoff sequence
and ACK-driven removal remain unchanged. The original prior poll sample supplies
ObservedAt; the adapter does not resample after native execution work.

`nativeexecution/credential_wire.go` now holds the original shared credential
rotation JSON map projection, Relay response-to-bundle projection and retained
renewal schedule representation:

| L2 entry | Existing parent call point and behavior |
| --- | --- |
| EncodeCredentialRotation | Machine rotate and Relay renew, after PrepareRotation and before original request; map still contains only requestId/csr, with the same ignored marshal error |
| RelayCredentialResponseBundle | After the existing provider DecodeProtected and before ValidateRelay; original response fields, request key/ID and exactly one sha256: prefix |
| RelayCredentialSchedule | After successful LoadRelay and before ValidateRelay; ValidUntil parse first, optional RenewAfter parse second, original strictly-before relation and exact integrity errors |
| RelayCredentialWithRenewal | Only inside the original non-nil overlap branch, after all original bounds/refusal decisions; original UTC RFC3339Nano RenewAfter persisted field |

No credential verification, protected decode, disk/crypto operation or callback is
moved into these helpers. Native/default and injected identity providers remain
unchanged; old private credential type aliases/load/prepare/validation entrypoints
remain intact. The new functions consume the existing executionidentity value
types without modifying that frozen provider interface or adding a new provider.
No composition root or CLI changes are required for these exact internal calls.

Machine rotation retains Prepare -> request -> validate -> SaveMachine -> reload
-> Remove(ignoreMissing=true), including the reload's Probe close/fingerprint/
mutex/Guard/idle-connection order. Relay ensure retains missing-before-error,
retained schedule format rejection before provider validation, then the original
expiry reparse and short-circuit scheduler.Now decision. Historical validation at
expiry minus one nanosecond still proves only the retained identity, followed by
authenticated renewal. Pending request decode/removal and in-memory publication
remain in the same parent branches.

Relay renew retains protected response decode, original bundle validation, the
single retryExpired gate and expiry parse before its short-circuit Now sample,
historical verification before pending removal and one recursive retry. Overlap
parsing still precedes the original conditional Now().Add(300 seconds) bound;
until bound, plus-one-second renewAfter, strictly-before denial, SaveRelay,
Remove(ignoreMissing=true), mutex and in-memory publication keep their original
order. No time sample is hoisted across an error, callback or short circuit. No
expired bundle can execute and no key/Journal/history is reset by this move.

Additional planned acceptance, entirely unexecuted: compare exact Report and Drain
JSON/timestamps for UTC offsets, nanoseconds, zero time, empty drains and nil
observations; preserve drain iteration/count/ticket/close/ACK behavior and a single
original poll sample. Compare Machine/Relay request bytes and absent private key,
bundle field/prefix/request-key identity, omitted renewal, malformed effective
expiry before malformed renewal, equal/later renewal rejection and exact errors.
Compare original provider callback ordering, injected/native defaults, failed save/
remove/reload, missing/corrupt pending, expired historical authentication, one
retry only, lost response recovery and overlap boundaries. Count scheduler samples
on parse failures/short circuits so extraction cannot advance a lease or change
refusal order. These cases require later authorized same-revision Actions; no
tests/checks/formatter/build/CI/experiment/commit/push ran here.

Remaining A4 representation debt includes Runner Hello/server and Snapshot issue/
valid timestamp parsing, selected URL/key formatting, and Relay overlap/expired
timestamp parses adjacent to authority decisions. Native certificate/provider and
protected Journal internals retain their separate classification/equivalence work.
Their existing mixed source is not certified by these codecs. Foundation/A4
acceptance and independent physical/release gates remain unmet.

## A4 Ordered Snapshot Time Parse And Precise Remaining Sites

The next coherent representation slice adds RunnerSnapshotWindow to
`nativeexecution/runner_report_projection.go`. It moves the original two-step
Snapshot ValidUntil then IssuedAt RFC3339Nano parse, propagating the first raw
parse error and returning the same issued/valid values to Runner.poll. The call
remains after extension/Node/session/history rejection and the original
scheduler.Now sample, before the generation decision and Guard.Accept. The two
parses are not moved into DecodeRunnerSnapshot, which would make malformed time
win over earlier owner refusals. No time window comparison or Guard call moves.
This supersedes only the preceding paragraph's remaining Snapshot pair debt;
the other listed representation/owner sites remain open.

Read-only inspection of Hello, Relay recovery/overlap and actual channel/state
sources identified these precise sites that were deliberately not replaced with
one-expression wrappers:

- Run Hello ServerTime parses immediately before Guard.ValidateServerTime, after
  Guard initialization and diagnostics setup. Adding a duplicate parse to the
  Hello decode would change errors and worker setup order. This lone format
  operation remains adjacent to its original authority consumer.
- ensureRelayCredential re-parses retained ValidUntil only after ValidateRelay
  fails. `parseErr != nil || expired.After(scheduler.Now())` controls whether the
  clock is sampled, then historical ValidateRelayAt runs before online renewal.
  Reusing a value parsed earlier by RelayCredentialSchedule would remove that
  exact original post-provider parse point. The statement remains in the owner.
- renewRelayCredentialAttempt parses expiry after provider failure, even when
  retryExpired is false; its following retry flag/parse-success/Now short circuit
  controls historical verification and pending removal. Hoisting sampling or
  fusing this with retained schedule parsing would change that original order.
- Renewal overlap parsing is followed by parse-error short circuit, then
  Now().Add(300 seconds), then certificate-until comparison, plus one second and
  strict-before refusal. A helper accepting pre-sampled now would sample on
  malformed overlap; passing a clock callback would move the owner's sampling
  decision into a new callback protocol. Neither is introduced for source closure.

The actual URL/key inventory in this slice is also explicit: Runner.poll builds
`/agent/v3/snapshot?sinceGeneration=` with base-10 FormatUint at the original
pending-report-before-fetch point. Physical slot keys use protocol/port; retired
instance keys use assignment/generation/fence at beginDrain and ACK cleanup.
controlchannel.Native.Request owns existing base trimming, HTTP construction and
session header formatting, but exposes no public Snapshot-query formatter. The
state owner validates protected physical slots and contains its own inline slot
projection; it exposes no public shared key-format codec. No private state helper
is imported and no protected key/identity migration is inferred. These inline
formats remain declared source debt, not a new public-entry exception.

Additional planned, unexecuted cases compare both-invalid and individually invalid
Snapshot times, raw time.Parse errors, offsets/fractions, exact prior owner refusal
precedence, original scheduler sample count and unchanged Guard.Accept input/order.
Later acceptance also retains the previously listed malformed Hello, Relay expiry/
overlap short-circuit, callback/retry and protected key compatibility cases. No
tests/checks/formatting/build/CI/experiment/Git write ran. This is one additional
source slice with exact remaining sites, not an A4/foundation closure claim.

Readiness83/84 and shared boundary declarations now record these authored L2
leaves and planned cases. Shared integration is source-only, not acceptance.

Current shared source integration records probe_result_wire.go (item105), the
qualification/delivery/v1-status leaves (item109) and report/credential/Snapshot
representation (item110), all planned and unexecuted. Remaining execution status/
result/ACK/echo and exact adjacent time/native/default/type debt stays open.
