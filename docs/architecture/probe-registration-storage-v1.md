# Probe Registration Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: development plan A1 / FXR-00; no new product or execution behavior.

## Ownership And Public Surface

- L1 `framework/public.ts` exports registration storage interface 1: parameterized
  instance and qualification persistence records, supplied-transaction stores and
  synchronous owner-value callbacks. It imports no product state union, wire or SQL.
- L3 instance/measurement public ports specialize these records without changing
  readonly/mutable fields, optional version markers or existing method signatures.
  `probe-instance-storage-values.ts` retains the original field/state/window and
  ownership-transition checks. `probe-qualification-storage-values.ts` retains the
  original qualification checks; neither callback reads time or performs I/O.
- L2 `MySqlProbeInstanceStore` and `MySqlProbeQualificationStore` contain the original
  SQL, native row/optional-marker mapping and persisted empty-slot interpretation.
  SQL state literals are the existing stored discriminators, not new policy.
  Normalized fields reach owner callbacks synchronously after the original reads
  and before the same writes. No asynchronous validation phase or new connection.
- Existing `ControlApplication` binds each store to its owner values. The unique
  permit owner still consumes current instance and qualification facts in its
  original transaction; these stores cannot issue permits or extend a Gate.

The callbacks retain only their function bindings, never a caller transaction or
record. Their contracts are trusted compiled composition, not a plugin sandbox.
They preserve the original validation rules rather than adding closed-object or
timestamp checks that the old storage did not perform. Native field projection
now precedes owner validation; exact mapping/error timing still needs acceptance.

## Compatibility And Ordering

Old `MySqlProbeInstances` and `MySqlProbeTypeQualifications` remain zero-argument
classes with their original public prototype methods and static quarantine paths.
They bind the same lower stores, not duplicate SQL or independent state. Existing
ops recovery calls the lower static implementations, with the same transaction
and ordering; no recovery command is run by this extraction. Wrapper initialization,
Promise/rejection timing and subclass compatibility remain unverified.

Instance reads retain plain SELECT, FOR SHARE for current reads, and no-op upsert
then FOR UPDATE for absent-slot serialization. Replacement still validates the
record before the transition and checks the same affected-row count. Revocation
matches the full original identity/timestamps at the same generation. Quarantine
still preserves generations, uses the original native time read and changes only
the original state/revoked timestamp; no protected history is deleted.

Qualification reads retain the exact empty-row checks, marker interpretation and
share/update locks. Upsert retains marker COALESCE only for the same complete
slot identity, original assignment order and parameters. Product validators keep
their distinct existing behavior: the application qualification helper is not
broadened to accept staged echo just because storage supports its marker.

`ProbeInstances` uses public L2 `nativeWallClockNow` at its five original call
sites. This helper dynamically calls `Date.now()`; it does not capture a default
function at construction. Qualification keeps its previously authored parser,
JSON, ISO and default-clock bindings. Locks, credential rechecks, 30-second slot
window, replay, generation/tombstones and `executionEnabled: false` stay with L3.

The public codec barrel now exports each existing parser name once; both old
paths directly re-exported the same underlying contract function. The duplicate
staged invocation-digest export is also removed without wrapping its function.
Function identity and public export compatibility remain planned acceptance.

## Evidence And Remaining Work

Readiness item 48 records exact-source type/export identity, callback order, SQL,
locks, CAS, optional markers, malformed data, replay and recovery regression cases.
No tests, checks, formatters, builds, experiments, CI, commits or pushes ran.
No wire/schema/Core change, execution flag, authority, pool, retry or worker is added.

A1 is not complete: Forward Probe formatting/private helpers and the remaining
permit, published-Snapshot, machine-evidence and intent read adapters still need
their own source classification/extraction. Agent/native, other owners and full
repository enforcement remain open. This slice does not freeze the foundation,
accept the Probe feature or open independent upper-module development.
