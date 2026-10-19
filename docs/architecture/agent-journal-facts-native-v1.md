# Agent Journal Facts And Native Records V1

Date: 2026-10-19 (Asia/Shanghai).
Status: FR-0013 implemented-unverified source. Candidates executionstate3,
runtimeplatform2/native platformruntime2; not accepted on a frozen revision.

## Actual Representations

The original state owner still authenticates/loads/saves the one Journal. L1 now
holds only its history facts; L2 native records retain the prior JSON format. These
are projections of the same state, not a second host, durable store or authority.

| L1 public facts | L2 canonical native state record | Exact source mapping |
| --- | --- | --- |
| Journal.Snapshot []byte, no tags | Journal.Snapshot json.RawMessage, json snapshot | Explicit slice type conversion; same nil/len/cap/backing, no copy or JSON parse |
| Journal.Generation/Digest/Fences/Retired | Same original native names and lower-case tags/order | Same scalars and map references, no clone/sort/default |
| RuntimeJournal.FormatVersion | ProtocolVersion, json protocolVersion | Exact uint64 value, no supported-version inference |
| RuntimeJournal.NodeID/Journal | Original nodeId/journal fields | Every inner field explicitly projected |
| RuntimeJournal.ExecutionExtension | Original executionExtension,omitempty | Same *uint64 pointer, no fresh allocation or zero default |
| RuntimeJournal.ImportedHistoryDigest | Original importedTransitDigest,omitempty | Same text, no hashing/normalization |

`executionstate/types.go` no longer imports encoding/json or declares native JSON
tags. The original two record types are canonical at `state/native_journal_types.go`.
Their original public state names, native field types, declaration order and tags
remain. Type identity intentionally differs from L1: the old state aliases no longer
make native and lower records implicitly assignable. Reflection package identity
changes accordingly. Direct lower serialization is no longer the native durable
contract; callers must use state-native records/APIs, not depend on incidental
default []byte/name encoding. There is no lower MarshalJSON or format fallback.

## Complete Observed Call Chain

| Entry -> port -> adapter/conversion | Original decision/effect stage |
| --- | --- |
| state.AcceptRuntimeSnapshot -> RuntimeJournalFacts -> original RuntimeHost.Accept | Projection is pure; original host receives current facts and the same native input/store/codec |
| RuntimeHost -> RuntimeStore.Load -> runtimeFileStore -> LoadRuntimeJournal -> facts | Same single authenticated native load, then project returned value and unchanged error |
| RuntimeHost -> input/codec -> same native validation/history projection | Input serialization/strict parse and lazy previous decode are unchanged |
| RuntimeHost -> RuntimeStore.Save -> RuntimeJournalFromFacts -> saveRuntimeJournal | Same save at original stage, original native JSON/HMAC/atomic write implementation |
| state.AcceptRuntimeSnapshot error | Return original native current and the exact host error, no reverse conversion/reset/retry |
| state.AcceptRuntimeSnapshot success -> RuntimeJournalFromFacts | Exact returned facts/native fields/references, including equal-generation no-write success |
| platformruntime.Bootstrap.LoadRuntime -> native LoadRuntimeJournal -> facts | Same key/path/Node load, preserve both returned native value and error through projection |
| platformruntime.Bootstrap.EnableRuntime -> native EnableRuntimeExecution -> facts | Same explicit migration/locks/import history and returned value/error |
| Runner construction -> Bootstrap.LoadRuntime -> error return -> native conversion | Original feature/proof/root/key/load stages and extension refusal/state construction afterward |
| Runner reloadCredential -> optional Bootstrap.EnableRuntime -> error return -> native conversion | Original enabled Journal/runtimeState assignments then client construction |
| General state.Save/Load, Agentidentity Relay data and offline Transit | Stay entirely on native state record; no unrelated protected payload projected through Runtime facts |

Converters in `state/runtime_facts.go` project all fields and share byte/map/pointer
references. They perform no I/O, locks, time read, validation, defaulting, encoding,
clone or authority operation. SnapshotInput still returns the original validated
bytes as []byte, matching the now opaque lower Snapshot. The native store alone
converts them to RawMessage at the save boundary; this preserves its old JSON
validation/null/empty semantics by design, pending actual acceptance.

## Authority And Failure Order

L1 RuntimeHost only renames protocol/import metadata fields in its existing body.
The exact old provider/input check -> lock/defer -> authenticated reload -> full
stale comparison -> native input -> extension gate -> version codec/binding/history
-> equal-generation return or prior/session/Fence/owner/phase/tombstone/max/save
sequence stays. FR-0012 protocol/key callback signatures and native implementations
remain. No version or physical key is synthesized by the new facts converter.

Native Accept returns original current on every error, retaining native fields and
references. A save failure can still have an uncertain native commit outcome; the
adapter adds no retry, rollback assertion or historical reset. Lower load/native
Bootstrap project error values without changing the error; Runner still returns
on errors before converting successful outputs or assigning Journal state.

Runner's native current/journal fields remain native. Credential reload still
precedes optional durable extension enable; client construction stays after the
original successful assignments. Snapshot save-before-bind, Guard/Ticket checks,
physical maps, counter tails, drain/ACK and protected high-water remain original.
No extra snapshot JSON re-encoding, lease, issuance, clock or execution is added.

Native state Load/Save/Initialize/Enable/Inspect bodies and APIs retain original
format behavior. Runtime validates I-JSON, strict fields, Node/version/extension,
outer-inner maps, physical bounds and original native snapshot. General protected
Relay and offline Transit still use their original native envelope/validation.
No file was read as a live Journal or initialized/migrated during this source task.

## Versions, Consumers And Removal Conditions

executionstate interface3 changes facts field names/RawMessage/tags/type identity;
old direct consumers and direct serializers must migrate explicitly. RuntimeStore
and SnapshotInput/Codec method signatures remain, but their referenced record type
semantics changed. Bootstrap output changes transitively, so runtimeplatform and
its native platformruntime provider declare interface2. Other scheduler/dial/local
interfaces, flags/options and public native state function signatures remain.

Observed production boundaries were the original native store, Bootstrap and Runner.
State Runtime/Transit/multihop/inspection/Journal tests and Runner/Relay/diagnostic/
Probe tests use native records; Agentidentity uses native Journal for Relay secrets.
Their existing field/tag/raw layout remains, while source-level identity assumptions
need later type/contract coverage. Bounded source reading/search is not full consumer
or type evidence. No test/tooling was expanded, adapted or run in this phase.

Keep native state entry names and old accepted durable format until complete actual
consumer migration and same-source bytes/contract/owner acceptance passes. Removing
entries or changing protected data requires separately recorded scope. Identical
intended native bytes do not authorize dropping unknown fields/history, downgrading
migrated execution extensions or replacing the original native validation.

## Remaining Work And Planned Evidence

This source-migrates the specific RawMessage/tag/native-metadata dependency recorded
by FR-0012. It does not establish all Agent/Control source/type/private/default/
consumer/removal classification or a complete frozen candidate. Other Probe/native
wire, telemetry formatting, offline Transit clock/engine, Runner/CLI/default and
Control server/CLI/infrastructure chains remain open. Full public example and
foundation/parallel-development acceptance remain unmet.

141-143 are planned/unexecuted: lower/native type/identity and no hidden serialization
fallback; round-trip nil/empty/invalid bytes/backing/maps/pointers; exact native
JSON/envelope/MAC/loader/import/inspection/Relay/Transit; host/provider error/order,
Bootstrap conversion and Runner save-before-bind. Original47 and later prior cases
also remain pending. Native/persistence/platform/network evidence needs authorized
Actions on the full frozen source; no local run or hosted physical substitute.
No tests/checks/gofmt/generators/build/CI/experiments/Git/delegation occurred here.
