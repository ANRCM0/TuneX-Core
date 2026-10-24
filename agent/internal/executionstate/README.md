# Runtime Journal Coordination Boundary

Public Go interface 4 (FR-0013 and FR-0032). RuntimeHost coordinates
the one existing authenticated Runtime Journal through RuntimeStore, SnapshotInput
and SnapshotCodec. It does not open files, acquire OS locks, compute MACs, parse a
native wire protocol, read time or create an execution lease.

Accept orders lock -> authenticated durable reload -> caller/high-water comparison
-> native encode/validation callback -> identity/Fence/phase history decisions ->
save -> return. Errors return the caller's old state; a persistence error never
authorizes socket changes or resets durable history. Equal generations still load
and validate before returning without a write. Lock release is deferred on every
post-lock path, including validation and persistence failure.

SnapshotHistory is only the exact identity/history projection needed by this owner,
not a second wire schema. A trusted native adapter must validate the complete input,
return its original bytes and project every referenced identity/resource field
without normalization. Prior-body decoding retains the original lazy point. Store
providers must authenticate/bind the existing durable format and save the same
single record; this is not a plugin sandbox or a license to substitute a new store.

The old state.AcceptRuntimeSnapshot binds the original MAC/key/path/wire adapters.
state.Journal/RuntimeJournal retain their native field/tag/order contract as distinct
L2 record types. They are no longer aliases of lower facts; use explicit projection.
Initialization, explicit multihop/import migration, read-only inspection and Runner
authorization/socket ownership stay with their original owners and entrypoints.


SnapshotCodec now requires SupportsProtocol(version) and PhysicalSlotKey(protocol,
port), in addition to DecodePrevious. Old custom codec method sets must migrate;
there is no native fallback in L1. Native state supplies the original version3
predicate and exact protocol/port text. The host calls the predicate after original
input validation and extension-presence refusal, before owner binding/history and
equal-generation decisions. Key callbacks stay at the original assignment/tombstone
stages; prior decode/session checks, immutable owner/Fence/phase rules and save
remain owned here. These methods must be synchronous pure representations, preserve
distinct physical identities and use the same stable format as their authenticated
store/loader; they do not confer authority or replace complete native validation.

state.PhysicalSlotKey/TransitSlotKey/NativeRuntimeJournal are native representation
helpers shared with the original Runner, loader and explicit migration. They do
not load, save, initialize, clear or migrate state. Native fields/JSON layout remain;
FR-0013 below supersedes the earlier shared lower/native type aliases. The broader
consumer/default inventory is not accepted by either source record.
Readiness138-140 adds planned callback/format/persistence/Runner cases, unexecuted.

FR-0013 lower Journal contains opaque Snapshot []byte and no JSON tags/import.
RuntimeJournal uses FormatVersion/ImportedHistoryDigest with the original owner
binding and extension facts; it does not define a stable native JSON encoding.
Direct lower serialization is not the old durable format. Custom lower consumers
must migrate field/type assumptions, and Bootstrap interface2 produces these facts.

state.RuntimeJournalFacts/RuntimeJournalFromFacts project all native/lower fields
without parsing, validation, copying or defaulting. Raw backing storage, maps and
extension pointers are retained. The native store converts only at its existing
load/save boundary; native AcceptRuntimeSnapshot returns original native current
on error and converts success. Native Bootstrap projects both values and errors,
and Runner converts successful results before original extension/state assignments.
There is still one host, one authenticated native Journal and no second authority.
Native state type identity now belongs to state, so direct cross-layer assignment/
reflection identity changes are intentional even where native fields stay the same.
Readiness141-143 covers exact native bytes/MAC/nil/reference/error/order and actual
consumer migration, all planned/unexecuted. Original14-15 and138-140 remain pending.

FR-0032 adds ResourceBudgets to RuntimeJournal and ResourceLimits to
SnapshotHistory. These are payloadbudget interface1 decision facts, not a second
store or authority. Native projections copy policies and limit values; original
Snapshot bytes, fences, retired slots and extension facts retain their previous
ownership. Accept reloads the authoritative budget history under the existing
RuntimeStore lock, preserving debits made after the Runner cached its Snapshot.
New generations preserve all old buckets; equal generations return the latest
durable consumption without writing or accepting a changed retained policy.

RuntimeHost.Precharge uses that same lock and authenticated Load/Save. It verifies
the immutable bucket binding and latest policy revision, checks the explicit
period and counter bounds, and persists the debit before permission is returned.
A stale expected policy returns the current record and ErrPolicyChanged without
charging; the gate adopts it with zero rate credit. Zero-byte datagrams validate
the policy and authority but need no write. Persistence errors never authorize
payload, and cancellation/short writes never refund an ambiguous reservation.
The original state adapter supplies MAC, key, path and OS lock; an additional
in-process mutex serializes Snapshot and payload writers before that OS lock.

The new payloadbudget, executionstate, state and Runner source cases cover
aggregate bidirectional use, concurrent writers, restart, policy revision changes,
drain retention, read-only inspection and original authority preservation.
Exact-source execution is recorded separately from these contract obligations.

Exact-source verification and remaining environment limits are recorded in
[verification status](../../../docs/testing/verification-status.md).
