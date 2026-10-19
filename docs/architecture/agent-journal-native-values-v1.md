# Agent Journal And Runner Native Values V1

Date: 2026-10-19 (Asia/Shanghai).
Status: FR-0012 source-authored/unverified; executionstate interface2 candidate.
Later FR-0013 supersedes the shared lower/native representation debt below: explicit
tagless facts/native record conversion is source-authored, executionstate3 and
Bootstrap/provider2, still unverified. See [current chain](agent-journal-facts-native-v1.md).

## Public Chains And Original Owners

| Entry -> coordination -> port -> native implementation | State/effect ownership and original stage |
| --- | --- |
| Runner.poll -> state.AcceptRuntimeSnapshot -> executionstate.RuntimeHost.Accept -> runtimeFileStore | One original authenticated Journal; lock/reload/stale/validate/history/save remains before socket changes |
| RuntimeHost.Accept -> SnapshotCodec.SupportsProtocol -> runtimeSnapshotCodec | Original current version3 predicate after extension refusal and before owner/generation/digest; no native default in L1 |
| RuntimeHost.Accept -> SnapshotCodec.PhysicalSlotKey -> state.PhysicalSlotKey | Original protocol/port string at each assignment/tombstone site, after prior decode/session check; owner still compares and updates high-water |
| Runner.poll -> state.PhysicalSlotKey | Same pre-persistence assignments/retirements and later live-instance keys, no early key/index recomputation |
| Runtime loader / EnableRuntimeExecution -> same PhysicalSlotKey | Original retained physical-fence proof and imported Transit overlap/cutoff refusal, same record/maps/locks |
| Transit loader/accept / Runner.transitPhysicalGuard -> state.TransitSlotKey | Original literal TCP representation, existing offline journal and fail-closed Direct/Relay map/socket checks |
| InitializeRuntimeJournal / changed-snapshot empty-node fallback -> state.NativeRuntimeJournal | Original protocol3/Node/Journal literal with other fields zero, no I/O/auth/reset inside helper |
| Runner.beginDrain / removed ReportAck cleanup -> nativeexecution.RunnerDrainKey | Same assignment/generation/fence tuple; Ticket/drain/deadline/ACK ownership stays Runner |
| Runner construction -> controlchannel.ValidateControlURL | Original case-sensitive https prefix only, after feature checks and before Bootstrap effects |
| Runner.poll -> controlchannel.RuntimeSnapshotPath -> channel provider | Original base10 generation in GET path after Guard/Ticket/pending-report, same native URL concatenation/headers |
| Legacy control.httpError.Error -> executionchannel.HTTPError.Error | Same local type/fields/As behavior and exact diagnostic string; no error/status policy move |

SnapshotCodec gained two required synchronous pure methods; old custom method sets
must migrate to interface2. Native runtimeSnapshotCodec remains the existing private
adapter and supplies both methods. RuntimeStore, SnapshotInput and all old state
entry signatures remain; no second native codec pipeline, Journal or authority.
Key representations must preserve distinct physical identities, remain stable and
agree with authenticated store/loader data. These are trusted compiled providers,
not an untrusted-format plugin or permission to skip full native validation.

## Acceptance Sequence Kept In L1

RuntimeHost.Accept retains provider/input nil refusal before lock, deferred release,
authenticated durable load and full stale-caller comparison before EncodeValidated.
The original extension-presence gate remains before the native version predicate.
The original Node/generation/digest short circuit and error stay in the host. Equal
generation still validates and returns without prior decode, keys or save.

Changed history retains extension copy, cloned Fences/Retired, lazy prior decode,
session non-regression, assignment order and key stage. Fence/retired and physical
owner/immutable tuple/resource/phase comparisons stay original. Missing assignments
retire previous Fences; tombstones apply max to Retired. One save then return; load,
decode, native predicate/key and persistence failures never authorize socket changes.
Persistence errors retain the original wrapper and return caller state. No new time
read, retry, lock, session authority, reset or rollback path is introduced.

`state.PhysicalSlotKey` keeps exact fmt protocol/decimal port. `TransitSlotKey`
retains its distinct literal tcp/decimal expression. Neither validates, normalizes,
escapes or clamps inputs; full wire/load validators retain those responsibilities
and the original error order. Loader HMAC, I-JSON/unknown-field/native validation,
protocol/Node/outer-inner bindings, physical counter/port constraints, explicit-new
initialization, import digest/overlap, atomic write and read-only inspector remain.
The new envelope helper preserves existing map/raw references without cloning.

## Runner, Drain And Offline Transit

Runner preserves Guard/Ticket checks and pending report replay before Snapshot
request. Native decode/capability/identity/history and clock/window/ticket steps
precede the original map/history checks. Changed history is durably accepted before
the mutex-held authorization recheck and first bind/replace/phase/drain operation.
Existing runtimeState/Journal assignments, resource maps, observations and accepted
Ticket remain the same objects/owners in source.

beginDrain creates the map, forms the original tuple and returns on duplicate before
Ticket.Drain, authorization binding, stream.Drain and old deadline clipping. Report
does remote request/strict Ack decode/correlation before best-effort pending decode;
it locks, retains counter tails and deletes only sent removed drains, unlocks, then
clears pending. Lost/unmatched ACK and partially decoded local-report behavior are
not hardened or changed. No new stream close, report retry or tail/reset policy.

The offline Transit bridge still locks Runner, rejects any Direct/Relay historical
Fence/Retired, then active physical key, then retiring TCP port. A valid Runtime
Ticket does not authorize Transit. Its controller still requires independent
permission/capability/identity/exclusive guard and remains absent from Run/poll.

ValidateControlURL intentionally retains prefix-only behavior, including unusual
text that later request construction may reject. It is not replaced by Auxiliary's
distinct native HTTPS/host/user/query/fragment/redirect validation. Existing default
New/NewWithProviders/NewWithEffects/NewWithLocalServices and package-local fallback
providers, captured values, Bootstrap proof/root/key/load/enable, TLS/HTTP and all
CLI flags remain; this slice adds no user configuration or execution capability.

## Consumers, Migration And Known Limits

Observed production lower-host construction is state.AcceptRuntimeSnapshot with
runtimeFileStore/runtimeSnapshotInput/runtimeSnapshotCodec. Original state tests
and Runner tests construct native records and literal physical keys; the bounded
source search found no direct custom SnapshotCodec test implementation. Source
search is not a full consumer/type check, and none of those tests/tools were run.
Old native entries/type aliases stay until consumers and frozen-source acceptance
are migrated; custom codecs must provide both methods before building interface2.

At this FR-0012 snapshot, remaining source debt was: executionstate Journal/RuntimeJournal
still imports encoding/json.RawMessage and carries original native JSON tags and
format metadata names. The representation interface change does not erase that
external-type coupling or prove a fully neutral lower storage contract. Other
Runner/Probe native wire types, telemetry formatting, offline Transit clock/engine
binding, constructors/default providers/CLI and full repository source/type/private/
consumer/removal inventory remain to close. No blanket state/control/engine package
exemption or accepted foundation version follows from this bounded extraction.
FR-0013 later source-migrates the named RawMessage/tag/metadata chain, with explicit
native/lower type identity change, required actual consumer migration and141-143
planned/unexecuted; the other inventory and acceptance gates remain open.

Readiness138-140 are planned/unexecuted, extending original14-15: interface2/callback
order, physical/drain/envelope bytes and original loader/import/Inspector/history,
Runner save-before-bind/drain/ACK, URL/default/error behavior. Functional/platform/
persistence/network evidence requires later authorized Actions on the exact frozen
source; independent physical-host, long-run, backup/recovery, example and release
gates remain separate. No tests/checks/gofmt/builds/experiments/CI/Git/delegation.
