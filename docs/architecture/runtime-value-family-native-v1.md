# Runtime Coordination Values And Native Family Source

Date: 2026-10-19 (Asia/Shanghai).
Status: FR-0008 implemented as source, unverified; readiness127-129 planned only.
Scope: actual common declarations, Runtime provider graph and current native
bindings. This is not a boundary/type/behavior pass or a frozen-candidate claim.

## Lower Values And Outer Format

@tunex/contracts/execution-values is a precise L1 public leaf. It owns the original
coordination fields for assignments, resources, tombstones, complete snapshots,
Hello/report/ACK and contribution driver identity. It imports only public Core
NetworkProtocol and the existing lower policy/observation types. No parser, native
default, protocol version, driver config/schema union, I/O or clock is included.
Runtime values interface1 is distinct from protocol/driver/host versions.

Shared declarations are relocated, not copied. Native RuntimeAssignment extends
the common assignment with its original closed native driver payload. Native
RuntimeTombstone aliases the common facts; Snapshot extends common fields with the
original ADP3/executionExtension envelope. Historical Hello/report/ACK interfaces
extend common facts with their old version2 field, and RuntimeMessages keeps its
existing Omit/version3 specialization. Schema/parser/value implementations remain
original. DEFAULT_POLICY stays in its original module. Core/kernel are unchanged.

RuntimeValueFamily supplies erased outer driver/source declaration, opaque Profile
and envelope extension types. Type operators derive assignments and snapshots together, retaining
the snapshot-assignment relation through compiler/store/ledger methods. The common
default has no native fields. NativeRuntimeFamily derives its extensions from the
actual native types and preserves the existing driver/schema/role closure; it does
not negotiate a protocol or add a driver, registry, dispatch callback or state owner.
Unknown direct/custom clients must bind their family explicitly rather than rely
on an implicit native lower default.

## Actual Provider And Compatibility Graph

| Existing binding | Current common/native type relation | Runtime body/lifetime |
| --- | --- | --- |
| RuntimeController | RuntimeHost<Transaction,NativeRuntimeFamily>, native runtimeCodec/state store and existing ledger callbacks | Original positional construction, dynamic native clock and same provider instances |
| RuntimeLedger | RuntimeLedgerHost<Transaction,NativeRuntimeFamily>, native compiler/store/assignment collector | Original policy/resource fallback, captured clock/UUID, single ledger and caller Tx |
| RelayCoordinator | RuntimeRelayHost<Transaction,NativeRuntimeFamily>, native compiler/store/ledger | Original constructor/defaults/static recovery, same Relay coordination |
| Native compilers | NativeRuntimeSnapshotInput and NativeRuntimeRelayPlan aliases specialize common generics | Original compiler bodies/clone/sort/parse/digest and native driver formats |
| MySQL Runtime state/ledger/Relay stores | Explicit native family on lower storage contracts; original native method record types | Original SQL, parameter order, lock/persistence, no new clock/Tx |
| Forward SnapshotAssignmentRegistry/RelayAssignmentSource | Native contribution/source/collector/reader/declaration aliases, common context unchanged | Original static catalog checks, bound receivers, clone timing and one collector |
| Probe publication read store/contracts | NativePublishedRuntimeEvidence/Reader specialize the existing lower evidence generic | Original scoped SQL/read/parser/identity checks; no publisher or new authority |
| HTTP app/application ports | NativeRuntimeMachinePort specializes the lower machine port | Existing native parse before original host calls, no new routes/protocols |
| Old Runtime snapshot/query/relay type paths | Explicit native aliases for wire-bearing types, common lower aliases for status/context/facts | No copied implementations or extra provider instances |

The family and aliases are erased types. They do not introduce a second Runtime
ledger, authority, Journal, clock default, store or transaction. Public old native
paths retain their structural closed wire types. Source declaration augmentation,
source-text tooling and unknown direct/custom callers still require inventory and
same-source acceptance; structural relocation alone proves no such compatibility.

## Machine Codec Order

RuntimeCodec now requires four native-bound methods. Constructor time/clock guard
remains first, then missing/wrong-kind machine methods refuse with the recorded
configuration error before policy validation or the first clock read.

hello retains three stages at their original positions: native protocol predicate,
host foreign-Node identity refusal, native direct-capability predicate. Native
methods use the exact original combined includes conditions, ControlError type/
message/status and short circuits. No new parser, clock, normalization or accepted
capability is added. Boot/history/credential/Node state changes stay in the host Tx.

Hello projection remains at the original return expression: read bootId, format
the original Now sample, copy policy once and pass these evaluated values to the
native formatter. It returns the original mutable object/key order without another
copy/validation/sample. ACK projection remains after digest/prior lookup and before
duplicate-body comparison, retaining sequence/boot getter timing, accepted/duplicate
status and the original duplicate early return. Later report/publish/claim/fence/
authority-before-save/lease/cleanup bodies are unchanged by the type migration.

## Current Versions And Remaining Debt

FR-0008 introduced Host3/ledger3/Relay4/evidence2/runtime values1. Subsequent FR-0009
updates Relay5/values2/configuration2/Transport2, and FR-0010 updates Node authority3.
Policy1/observation1/general framework/kernel/ADP3/native schema/driver versions
remain. These are source candidates, not accepted/frozen versions.

The formerly listed assignment/snapshot/messages/tombstone dependencies use common
family types; FR-0009 also makes Profile an opaque family payload with explicit
native configuration aliases. FR-0010 addresses the inspected Node native inputs/
support/prefix. See [current source chains](profile-node-native-boundaries-v1.md).
Other Control/Agent/HTTP/default/private/consumer/removal classification remains
in scope. No family or named migration is a package exemption or full A5 proof.

## Planned Acceptance

127 covers exact old/common/native fields, generics, source declarations, public
exports/defaults, no duplicate schema and snapshot-assignment correlation.128
covers required machine methods, refusal/getter/short-circuit/key/copy/sample timing,
duplicate replay and existing authority/Tx/publication behavior.129 covers every
actual native binding/old alias, constructor/default/prototype/static behavior,
store/Forward/Probe/HTTP integration and remaining debt. Current observed legacy
snapshot-assignment test source imports its old exact native aliases; it was read,
not executed or used as evidence of compatibility.

All cases planned/unexecuted. No tests, syntax/type/static/import/boundary checks,
formatter/generator/build, CI, experiments, commits, pushes or delegation occurred.
Full candidate identity, public example, authorized Actions behavior/MySQL/network,
independent physical-host, long-run/backup/release/production gates remain unverified.
