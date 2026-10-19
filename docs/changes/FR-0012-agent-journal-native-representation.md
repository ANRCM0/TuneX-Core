# FR-0012: Agent Journal Native Representation At Existing Ports

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner: original L1 executionstate acceptance host, L2 state/channel/native formats
and L3 Runner/Transit integration. The human's standing source authorization of
2026-10-19 permits this similar proposal to proceed after this record, without
repeated confirmation. Verification, Git, release and feature gates stay separate.

## Task Proposal

1. Layers: L1 executionstate; L2 state, controlchannel, nativeexecution; L3 Runner
   and its original fail-closed offline Transit physical guard.
2. Consumed public interfaces: RuntimeStore, SnapshotInput/SnapshotCodec, original
   Journal/native wire API, Guard/Ticket, channel providers and driver contracts.
3. Foundation impact: executionstate interface1 -> interface2, required codec methods.
   No L0, native wire/schema, durable field, MAC or authority/high-water migration.
4. Contracts: SnapshotCodec adds SupportsProtocol(uint64) bool and
   PhysicalSlotKey(string,uint64) string. Existing native state codec supplies
   exact version3 predicate and original slot expression; custom codecs must migrate.
5. Acceptance: planned exact-source interface/callback order, old/new native bytes,
   lock/reload/refusal/save and Runner persist-before-bind/drain/ACK, plus authorized
   Actions native/platform/persistence behavior. Nothing executed in this source phase.
6. Parallel impact: original state wrapper, loader/migration and Runner/Transit call
   the same canonical slot formatter. No second store, authority, retry or journal.

## Why Current Extensions Are Insufficient

The current complete executionstate host/ports and state adapter were read. L1
already consumes neutral SnapshotHistory, but still hardcodes current protocol3
and the persisted protocol/port text at assignment/tombstone stages. Existing
SnapshotCodec only decodes previous bytes. Extend this existing representation
port rather than add a competing host, move history decisions to L2, or relabel
wire/schema implementations L1. RuntimeStore still authenticates and binds the
single original Journal. Lower records/JSON tags remain the existing source API;
this proposal does not prove complete external-type or repository closure.

Runner and the offline Transit guard repeat physical keys used by that Journal.
Keep canonical format under the state owner, while the original drain tuple text
is a nativeexecution projection and original URL prefix/snapshot-path text belongs
to controlchannel. These helpers only represent caller-supplied values; they cannot
grant execution, accept a snapshot, mutate a map or open a file/socket.

## Exact Contracts And Stages

SnapshotCodec interface2 contains existing DecodePrevious plus the two required
synchronous methods. Go method-set compatibility is intentionally breaking for
old custom implementations; there is no implicit native fallback. The native
unexported runtimeSnapshotCodec keeps its identity and adds both methods.

RuntimeHost.Accept retains its original nil-provider/input check, lock and deferred
release, authenticated durable reload and complete stale-caller comparison, then
input EncodeValidated. Original extension-presence refusal remains before protocol
recognition. At the old current.ProtocolVersion != 3 term invoke
!host.Codec.SupportsProtocol(current.ProtocolVersion); the host then performs the
same short-circuit Node/generation/digest decision and existing error. Native codec
returns version == 3 without extra validation, I/O, clock or state access. Equal
generation still returns only after validation/binding and before any key method.

At the original assignment and tombstone fmt sites, host calls codec.PhysicalSlotKey
with the original values. Retain prior decode, session and immutable-owner/Fence/
phase/resource comparisons, map updates/max/retirement, extension copy, save and
error wrapping. Native helper returns exact fmt.Sprintf("%s/%d", protocol, port),
with no escaping, normalization, protocol allowlist or port/fence validation added.
Wire and authenticated loader retain original validation and failure precedence.

L2 state.PhysicalSlotKey is reused by Runtime native codec, Runtime loader/live
history overlap and Runner's assignment/tombstone/live-instance sites. The distinct
state.TransitSlotKey preserves literal fmt.Sprintf("tcp/%d", port) for offline
Transit journal/controller bridge. L3 controller still rejects any Direct/Relay
high-water, active socket or retiring TCP port and is not connected to Run/poll.

state.NativeRuntimeJournal(node,journal) returns the exact original protocol3/Node/
Journal envelope with all other fields zero. Initialization and Runner's changed-
snapshot fallback call it at their original literal positions. It performs no
initialization, auth, I/O or reset; original explicit-new-file checks stay first.

nativeexecution.RunnerDrainKey(id,generation,fence) returns the original
fmt.Sprintf("%s/%d/%d",...) at beginDrain and removed-ACK cleanup sites. Map creation
still precedes key creation; duplicate drain still returns before Ticket.Drain,
SetAuthorization/Drain and deadline clipping. Report still checks correlated ACK,
best-effort decodes the original pending report, takes mutex, retains tails and
deletes only acknowledged removed entries, then clears pending after unlock.

controlchannel.ValidateControlURL keeps the original case-sensitive https prefix
test and exact error, after original feature dependency checks and before Bootstrap.
It does not parse/normalize the URL or make it more permissive/restrictive.
RuntimeSnapshotPath keeps original path plus base10 uint64 at the original poll
request argument, after old Guard/Ticket/pending-report checks. Auxiliary request
scheme/host/user/query/fragment/redirect checks remain distinct and unchanged.
Runner's legacy httpError fields/type remain, delegating only its exact diagnostic
text to the already existing executionchannel.HTTPError.Error implementation.

## Impact And Compatibility

Observed production lower-host binding is state.AcceptRuntimeSnapshot -> original
runtimeFileStore/runtimeSnapshotInput/runtimeSnapshotCodec. Old state Journal/
RuntimeJournal type aliases and public function signatures remain. Existing tests
construct native Runner/state records and old key strings; they are not edited or
run here. No direct custom executionstate codec test source was found in the bounded
source search; that is not full consumer/type evidence. Keep native old entries
until actual consumers, tools and frozen-revision contract acceptance are migrated.

No durable field/tag/order, wire version, protocol capability, map key bytes, hash,
MAC, atomic-write/lock/rename, offline import digest/cutoff, Guard/Ticket deadline,
bind/replace/close/drain, telemetry, CLI flag or constructor/default is changed by
design. Native formatting does not refund or clear protected history. Unknown/
stale/corrupt input continues to fail at its existing native/owner boundary.

## Acceptance And Known Limits

138 planned: interface2/custom method-set migration; missing provider/input nil
error before lock; lock/load/stale before validation; extension before protocol;
false protocol short-circuit; equal generation before key/decode/save; original
prior/session/key/Fence/owner/phase/tombstone/max/save/release/error sequence. Use
non-native codec facts to demonstrate L1 does not hardcode ADP text; no unknown
format fallback or acceptance without the complete owner history checks.

139 planned: physical/Transit slot and drain tuple bytes across original protocol/
ID/zero/max uint64 values without new bounds/escaping; original Runtime initialized/
fallback envelope fields/order, loader/explicit import/read-only inspector and MAC
equivalence. Persisted history never resets. Run/poll retain same earlier checks,
same lock and persistence-before-bind; lost/stale ACK and duplicate drains retain
old map/tail/Ticket behavior. Native/persistence evidence requires authorized Actions.

140 planned: exact URL prefix and feature/Bootstrap error precedence, malformed/
case/user/query/fragment text behavior without new parser; snapshot path decimal
boundaries and old header/request/body/retry order; legacy httpError type/As and
exact text. Keep original native defaults and offline Transit refusal/not wired.

All cases unexecuted. Full Agent Runner/wire/engine/CLI/default/private/public-type/
consumer/frozen candidate classification, Control server/CLI and complete repository
acceptance remain open. No tests/checks/gofmt/generators/builds/CI/network/native/
container/PKI/MySQL/browser experiments/commits/pushes/delegation run in this slice.
Independent physical-host, long-run, backup/recovery, example and release evidence
remain unmet where unavailable; no hosted same-host substitute or source-only proof.

## Source Authorization And Acceptance Gate

This record precedes implementation and explicitly describes the interface2 break
for custom Go codecs. Proceed under the standing source instruction, then record
authored/unverified separately from later authorized frozen-source acceptance.
