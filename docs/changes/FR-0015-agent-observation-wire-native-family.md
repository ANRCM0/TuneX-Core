# FR-0015: Agent Observation Wire And Explicit Native Host Family

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner: existing Agent measurement/export owners, L1 runtimeobservation and L2
platform/wire adapters. Human standing source authorization of 2026-10-19 covers
this recorded proposal and its source compatibility changes without repeated
confirmation. Verification, Git, release and parallel-feature gates stay separate.

## Task Proposal

1. Layers: L1 observation contracts, L2 native observation DTO/encoding/ACK/body
   adapters and original L3 Runner sampling/export/counter retention coordination.
2. Consumed public interfaces: runtimeobservation, runtimeplatform Scheduler/Entropy/
   MeasurementFiles, executionchannel Auxiliary, native Host/Probe result codecs
   and original counter-reader contracts. No new authority or transport pool.
3. Foundation impact: runtimeobservation1 -> 2, generic Provider[Host]; native
   platformobservation1 -> 2. Add observationwire interface1. No L0/driver/ADP/wire
   version, capability, protocol/schema or persisted state change is intended.
4. Contracts: neutral lower Host facts lose JSON tags. Native wire owns exact Host
   and telemetry/counter DTOs. Public native provider alias explicitly selects that
   Host type; old direct Provider use must supply a type argument and custom native
   observers must return the native Host type. Named type identity changes recorded.
5. Acceptance: planned exact-source type/alias/native family, original bytes/time/
   pointer/nil/body/ACK/error/ordering and owner cursor/budget/retention/lifecycle
   equivalence. Functional evidence later authorized Actions; none executed now.
6. Parallel impact: migrate platform native Host aliases/provider and Runner local
   service/legacy types together; samplers/defaults and owner state stay original.

## Why Current Extensions Are Insufficient

All four current telemetry exporters, counter pages and diagnostics were read.
They contain native JSON DTO/Marshal/ACK parsing/uint64/hex/time operations inside
Runner coordination. The existing native channel already owns HTTP/TLS/pool setup;
reuse it and move only formats/body reading, preserving timeout/close/state ordering.
Do not add an HTTP retry loop, queue, second measurement authority or CI substitute.

The same read found native JSON tags on L1 Host facts. Relocating wire functions
while keeping those shared native declarations would retain the type boundary.
Parameterize the existing Provider's Host output and use an explicit native family,
as existing generic Agent ports do. Native Host samplers keep their exact record
shapes and references without lower/native slice-copy conversions or extra OS work.
Do not place native Host defaults/JSON methods into L1 or import Runner/Probe owner
implementations from the new L2 codec.

## Lower And Native Types

runtimeobservation.Provider[Host any] retains Memory/Process/Goroutines/ProcessID/
Platform methods and returns Host from Host(). Lower HostResources and children
are tagless common facts with original data fields; direct lower JSON serialization
is no longer the old native contract. No native default type argument exists in Go.

observationwire owns the original Host DTO declarations with exact field names,
types, order, tags, pointer/null and network slice semantics. platformobservation
Host names alias those native declarations, and Provider aliases
runtimeobservation.Provider[HostResources]. Native.Host returns that explicit
native type; existing CaptureHost/EmptyHostResources and OS implementations use
the same native aliases. control host names and LocalServices/observer use that
public native binding. No new conversions, copying, normalization, platform reads
or clock samples in these type-only boundaries. Memory/Process lower facts unchanged.

Named Host/telemetry/counter DTO identity now belongs to observationwire rather
than prior lower/control declarations. Alias field/source shape and intended wire
bytes remain, but reflection/direct old Provider method sets are intentionally
source-breaking. Custom observers must select the native Host or another explicit
family and migrate all actual call sites; no implicit native fallback in L1.

## Exact Native Codec Split

Move original process/runtime/sample, Forward/Probe identity/resource/value/point/
coverage and Host sample declarations into explicit native DTO files. Old control
private names remain direct aliases. Forward local snapshot retains its private
node/boot/session in an owner wrapper with an embedded original native public
snapshot DTO; source access remains promoted. Its JSON ignores private context
as before, flattening the same native fields/order; local writer encodes that DTO.
Probe page/source/retiring/tail state stays entirely local, not a new wire record.

Four family encoders keep original preflight/identity/point JSON/size/sample JSON
order. Forward wire limit32 becomes the canonical native constant with old alias.
Probe's page/snapshot/retiring limits remain owner constants passed explicitly to
native encoding/ACK; original384+retiring*256 bounds remain the original format
guard, not a new budget owner or field mutation. Process still has no added sample
size guard; Host8192 and Forward/Probe65536/point4096 guards keep distinct errors.

Four ACK validators move the original I-JSON -> raw-field count -> ordered missing/
null check -> typed decode -> time parse -> identity/provenance/point correlation
and family errors. Process uses its original Z suffix plus time parse; other
families keep their original timestamp regex, not a unified stricter parser.
Forward/Probe accepted+rejected counts and final rejectedPoints error remain in
their original phase. No ACK can grant execution or change owner authority.

ReadAckBody performs only original io.ReadAll(io.LimitReader(body,4097)). It neither
closes nor cancels; caller registers original deferred Body.Close first, then reads,
then tests error/status/length with the original family unavailable error, then ACK.
Encode failure still precedes timeout construction; Post failure still has no body
close; successful response close stays after parsing via original defer. Existing
sendTelemetry/With family signatures and native zero-helper defaults stay.

Public native decimal/optional signed/hex/time/JSON helpers replace only their old
format sites. Do not precompute fields across observer/ticket calls or locks. Time
format helpers distinguish UTC normalization and plain Format: Probe terminal
EndedAt was formatted without UTC conversion and keeps its offset. The standalone
Probe point helper still performs its original native Now().UTC sample even for
terminal values before replacing the time; use native Schedule at that exact site,
not Runner's injected schedule and not a new conditional sample.

Forward/Probe identity JSON used for ordering and local measurement JSON remain
one original Marshal call at original sites, including ignored identity Marshal
errors and exact sort keys. Diagnostic map projection stays owner-owned and uses
native encoding after its original field-expression evaluations. Native wire
adapter imports no Runner, Gate, product Probe counter or history implementation.

## Owner Ordering, Defaults And Compatibility

Keep lock/reference capture, stream counter reads outside the Runner lock, ticket
checks, Memory/Process/Now/Platform/Goroutines ordering and argument expressions.
Retain independent pool clones, redirect texts, one16-byte entropy call/ignored
short read, 10s ticks, max sequence, per-family drop/saturation and no retry queue.
Host retains one pending worker,500ms cutoff, late-result discard and callback-only
worker. No changing provider capture, starting extra OS work or blocking shutdown.

Counter dedup, lifecycle precedence, tails, available/unavailable/null values,
retirement budgets/freeze, cursor wrapping/local-vs-remote rotation, generation
selection and coverage counts remain the original owner algorithms. Sampling and
serialization never authorize execution or infer health/billing/physical capacity.
Before the additional diagnostic binding edit, record this scope amendment:
nativeexecution.ReadUDPDiagnostics accepts the existing generic execution Instance,
performs the original exact *forward.UDP assertion and calls its Stats once, then
projects the same five drop values. Controller invokes it only inside the original
non-TCP branch after Remaining and under the same mutex; no new nil guard or engine
read. This removes the concrete private engine assertion from L3, while preserving
the original native Stats (including its unused ActiveSessions read). Native Forward
counter/diagnostic implementations remain explicit debt; this does not declare
those owners or full Agent source accepted. This amendment precedes that edit.

Observed consumers include four send/capture helpers, control diagnostic/counter
helpers, native Host aliases/Provider and their source tests. Bounded source search
is not full consumer/type evidence. Preserve original public constructor/default
entries and legacy type/helper names until actual migration and exact-source
acceptance passes; direct old generic/serializer/reflection users must migrate.

## Acceptance And Known Limits

147 planned: generic Provider2/native provider2/wire1 method sets and explicit Host
binding, lower tag removal/native exact tags/order/pointers/slices/nil and type
identity migration; local alias/embedded snapshot flattening and old helper APIs.
No hidden native family, JSON fallback, Host conversion/copy or new OS/time work.

148 planned: all four sample/point/identity/local measurement JSON bytes/nil/limits/
first errors and integer/optional signed/hex/time boundaries; exact Process suffix
versus other regex ACK behavior, I-JSON/fields/null/decode/time/identity/provenance/
point counts/final reject order. Probe terminal offset and unconditional native
sample, field evaluation/observer/ticket timing and local sort/cursor identity.

149 planned: encode/timeout/Post/deferred close/bounded read/error-status-length/
ACK/cancel ordering, partial/oversized/read-failed bodies and no cancel/early close;
pool/entropy/tick/drop/max sequence, Host pending/timeout/late result and same owner
counter/retention/budget/generation/cursor/diagnostic lifecycle. Later authorized
native/platform/network Actions on full frozen source; no physical substitute.

All cases unexecuted. Full Agent/Control/CLI/default/private/type/consumer/removal/
frozen candidate/public example/foundation/physical/long-run/backup/release gates
remain open. No tests/checks/gofmt/generators/build/CI/native/PKI/network/container/
MySQL/browser experiments, commits/pushes or delegation occur in this source slice.

## Source Authorization And Acceptance Gate

This record precedes the concrete implementation and explicitly covers generic
Provider and native type-identity changes under standing human source authority.
Implement then record authored/unverified, preserving the later evidence gate.
