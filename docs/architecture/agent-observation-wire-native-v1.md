# Agent Observation Wire And Native Host Family V1

Date: 2026-10-19 (Asia/Shanghai).
Status: FR-0015 source-authored/unverified. runtimeobservation2,
platformobservation2 and observationwire1 candidates; wire versions unchanged.

## Public Types And Dependencies

| Public entry / original source | Actual owner and source binding |
| --- | --- |
| runtimeobservation.Provider[HostValue] | L1 independent Memory/Process/read ports and explicit Host output type, no native default |
| runtimeobservation.HostResources and children | Tagless common facts with original data fields; direct lower JSON is not the native contract |
| observationwire HostResources/CPU/Memory/Load/Filesystem/Network/Interface | Exact original native JSON field names/order/types/tags/pointers/slices |
| platformobservation Host aliases + Provider | L2 explicit runtimeobservation.Provider[HostResources], original Native.Host/CaptureHost/EmptyHostResources produce native types directly |
| control LocalServices.Observation / observer / host type aliases | Same original Native default and explicit constructor checks, now public native provider binding |
| observationwire Telemetry/Forward/Probe/Host sample DTOs | Canonical original native representation; old control private names are direct aliases |
| observationwire Forward/Probe counter identity/value/point/coverage DTOs | Original JSON fields including native Probe result Binding; no product CounterSet/Gate imported |
| control forwardCounterSnapshot | Original private node/boot/session context plus embedded native ForwardCounterSnapshot; public access promoted, local JSON uses same DTO |
| nativeexecution.ReadUDPDiagnostics | Exact original *forward.UDP assertion/one Stats call/five-value projection behind existing execution Instance, no new read or nil guard |

The generic observation port changes method-set/type assumptions for direct old
Provider users. Custom native observers return the public native Host type; common
observers may choose tagless facts explicitly for other consumers. Native Host/DTO
identity now belongs to observationwire, not the old lower/control declarations.
Source/JSON shape alone does not prove identity/reflection compatibility. Old
direct lower serialization and implicit cross-type assignment must migrate.

This design adds no native/lower Host conversion or slice/map/pointer copy. Original
OS sampler aliases resolve to exact native DTOs, and the Host pending worker still
receives the same Host-returning callback. Other Memory/Process facts/methods and
OS bodies, counter/driver/wire/schema/version/capability defaults remain unchanged.

## Export And ACK Sequence

| Family | Original preflight and ACK distinctions preserved |
| --- | --- |
| Process | Original Marshal error, no new sample cap; ACK11 fields, Z suffix and time parse, stored/provenance/correlation |
| Forward | Page32, each identity then point JSON4096, whole sample65536; ACK13 fields, original regex, accepted/rejected count sum then final rejection |
| Probe | Owner page/snapshot/retiring bounds passed explicitly; original coverage384+retiring*256, identity/generation/point4096/sample65536 stages; ACK13 regex/count/final rejection |
| Host | Marshal/8192 error; ACK11 original regex/provenance/correlation |

Each original send*With calls its native encoder before creating the2s timeout.
Channel Post, its error, successful deferred Body.Close, ReadAckBody, original
error/status/4096 length check, then family ACK occur at their original positions.
ReadAckBody only performs original io.ReadAll(io.LimitReader(body,4097)); no close,
cancel, early status decision, retry or new transport. ACK body still passes I-JSON,
raw-map count, ordered missing/null checks, typed decode, time parse and original
family-specific identity/provenance/count failures. Existing send* native wrappers
retain original Schedule/Channel default effects and signatures.

Four exporters retain distinct redirect text and independent pool clone, single
16-byte entropy call (same ignored short-read count),10s ticker/max sequence, no
queue and original increment/saturation/cancel differences. No output/ACK can
authorize execution or supply Runtime/Probe credential/session authority.

## Sampling, Counter And Local Measurement Stages

Only formats moved. Process still captures bounded execution references under
Runner mutex, reads stream counts and OS process data outside it, samples Now,
then evaluates Platform/Goroutines/field counters/Ticket at original property
positions. Numeric/optional/hex/time helpers do not collect data or read clocks.
Host still has one pending callback-only worker with500ms deadline, late-result
discard, original pending drain/drop behavior and no replacement result sampling.

Forward/Probe retention, immutable identity capture, close-before-tail capture,
availability/null/terminal precedence, source freeze, capped tails/retiring readers,
loss saturation, source/session/generation filtering, JSON sort key, cursor wrap/
rotation and coverage decisions remain in their original owner methods. Decimal
helpers execute at their original fields; identity JSON errors remain ignored for
the original sort-key behavior. No budgets/cursors/CounterSets moved into codecs.

UTC normalization is deliberately separate from plain time formatting. Forward
and sample/page times use UTCTimeText at original samples. Standalone Probe point
construction still samples native Schedule.Now().UTC first even for terminal
values, then replaces the time with EndedAt. TimeText performs plain Format for
that value; it does not normalize terminal offsets or borrow Runner's schedule.

Forward local snapshot keeps private context and embeds the exact native record;
direct reads are promoted, while composite literals must use the embedded record.
Local writer captures once then encodes only that DTO, matching the prior ignored
private fields. Generic measurement encoding preserves original map-sorted JSON
for diagnostics and original field-expression/read order. File paths, native file
provider, secret/proof boundaries and error propagation remain unchanged.

The UDP diagnostic binding amendment was recorded before implementation. It is
called only in the old non-TCP branch after Remaining and under the same mutex.
It asserts exactly *forward.UDP, invokes the original Stats once (including its
unused ActiveSessions/Remaining read), and projects the same five drop values.
No broader optional Stats interface, extra nil guard, engine mutation or authority
read is introduced. The original native engine/counter owner still needs its own
complete source/default/private classification and acceptance.

## Consumers, Removal And Limits

Observed consumers are original four exporters, local counter/diagnostic helpers,
Host native aliases/provider and source tests. Old private DTO/helper names remain
aliases/wrappers; old timestamp regex implementation lives once in native wire.
Bounded source search is not full consumer/type evidence. Preserve native entries
and migrate direct generic/reflection/serialization assumptions before accepted
removal; no complete module or foundation freeze follows from this source slice.

New native wire imports common time/IO/JSON/format libraries, original contracts
I-JSON and native proberesult.Binding, never Runner/Probe product implementations.
Those original format dependencies and native engine/counter adapters remain
explicit inventory, not blanket package exclusions. Counter values remain
non-authoritative self-report and do not establish health/billing/physical capacity.

Readiness147-149 are planned/unexecuted: generic/native/alias/embedded JSON identity,
four-family sample/ACK bytes/first errors/size/null/regex/provenance and time/field
ordering, original Post/body/read/close/cancel and pool/entropy/worker/cursor/
retention/budget/diagnostic behavior. Later authorized native/platform/network
Actions require the complete frozen source. Full Agent/Control/CLI/default/private/
type/consumer/candidate/example/foundation and independent physical/long-run/backup/
release evidence remain open. No checks/tests/gofmt/generators/build/CI/experiments/
Git writes/delegation ran; source relocation/edits do not prove byte equivalence.
