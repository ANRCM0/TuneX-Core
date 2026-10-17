# ADR-0013: Bounded delivery selection and sticky consumed-permit withdrawal

Date: 2026-10-17 (Asia/Shanghai).
Status: accepted internal authority direction; working-tree implementation;
functional and migration acceptance pending Actions.

## Context

[ADR-0011](0011-probe-permit-authority.md) persists one-use consumption.
[ADR-0012](0012-probe-claim-contract.md) exposes a non-executable claim receipt.
Neither provides continuous independent execution authority. In particular,
revoke on an already consumed permit previously preserved the record without
changing its usability: a new status reader must not accidentally interpret
that no-op as support for revocation after consumption.

## Ownership and internal ports

Keep the permit owner, guarded transaction, original Actor/Forward authorization
and global budget lock. Do not add a separate queue, mutable callback registry,
execution lease, driver or Core entity. Add three owner behaviors:

- `offer`: authenticate and lock the current registered Node/boot/session,
  actual credential fingerprint and instance/generation, even for an empty
  mailbox. Select at most one unexpired issued permit for that exact association
  from the existing bounded permit set, then reauthorize its original Actor and
  complete current binding. Multiple candidates fail closed, rather than picking
  one. Foreign, old-instance, consumed and closed IDs are not offered. A reply
  contains only permit ID, instance/generation, binding, timeout and original
  issue/expiry bounds, plus observation time and disabled execution. It does not
  reserve, consume, mint, renew or guarantee later claim success.
- `check`: require an existing consumed, unwithdrawn ID for the exact machine and
  instance. Reauthorize the original Actor, current Forward/target/network policy,
  every binding dimension, current machine capabilities/credential/retirement,
  registered instance and all original deadlines in the same transaction.
  Return a detached non-executable observation with `checkedAt`; do not change
  consumption, timestamps, budget clock or expiry. Repeated checks are allowed
  observations, never repeated claims or permission to restart work.
- `revoke`: a current Scope manager may withdraw an already consumed permit,
  including after the original Actor's Node Grant has disappeared. Preserve
  `state:consumed`, original `closedAt`, ID and issuance reservation; insert a
  separate sticky withdrawal fact. Original issued -> revoked behavior remains.
  Current Scope authorization still applies to repeat requests; foreign Scope
  lookup stays opaque. An existing withdrawal returns its first timestamp and
  performs no new write or budget update. Restoring source grants cannot clear it.

The common current-authorization helper serves consume, offer and check to avoid
three divergent permission implementations. It resamples time after awaited
authorization/lock reads and rejects shortened/invalid time bounds. No callback
or network operation executes inside these owner transactions.

## Persistence and failure paths

Migration `0016-probe-permit-withdrawals.sql` adds only
`probe_permit_withdrawals(permit_id,withdrawn_at)`, owned by `MySqlProbePermits`.
The foreign key references the existing permit and cascades cleanup. Existing
permit schema and record shape do not change. The global budget lock serializes
consumption, checks and withdrawal; table reads are bounded at 257 to detect
corruption above the 256-record cap. Reject duplicate/orphaned/impossible/future
withdrawal facts. Withdrawals are immutable and never refund a reservation.

Withdrawal insertion and budget-clock maintenance commit together. A failed
insert, post-action maintenance guard or clock write rolls back the withdrawal
and leaves the consumption fact intact. ID pruning still occurs only through
the existing owner's expiry-plus-cooldown policy; cascading withdrawal cleanup
does not create a caller-selected reissue or replay-as-insert path. This bounded
operational history is not an indefinite audit log.

On upgrade, backfill withdrawal facts for all already consumed permits using
their original closure time as a conservative lower bound. Those old receipts
were explicitly non-executable; they must not become newly eligible for future
execution. This timestamp is not evidence that a new revocation request occurred
at the old consumption time. The one-use fact is unchanged.

Recovery still quarantines issued permits. It additionally inserts missing
withdrawal facts for consumed permits, preserving existing first withdrawals,
consumption states/times, IDs and budget floor. This occurs in the existing
recovery transaction with instance/credential quarantine, not in startup or an
independent recovery process. SQL remains SQL-local state, not an independent
rollback-resistant authority or replacement for the protected authorization store.

## Compatibility

Control-only profile `adp3-probe-withdrawals-v1` has ceiling 0016. Historical
registry/permit profiles retain ceilings 0014/0015. Old Control profiles cannot
read/roll back across the new schema, even when Probe is disabled; the new profile
is invalid for Agent. The example plan shows 0015 -> 0016. Upgrade assessment is
still read-only and detects an applied-but-missing or present-but-unrecorded table.
DDL commits implicitly, so an interrupted create/backfill requires maintenance,
backup and operator review. The inspector does not prove row-level backfill
correctness or repair it automatically.

Core, existing ADP/3 and Probe hello/instance/claim contracts, Agent Runner/Gate,
Journal, authority high-water and Forward execution leases are unchanged. No
remote issue, delivery/status endpoint, Agent polling or new execution capability
is delivered by this slice. Existing claim responses remain
`executionEnabled:false`, and no receipt or observation becomes a `probe.Grant`.

## Evidence and next boundary

Authored/Actions-wired, not locally executed:

- Nine additional permit port groups: closed machine commands, empty/one/foreign/
  ambiguous offers, original Actor and all binding checks, repeatable consumed
  observations, sticky withdrawal/restart/scope isolation, transaction rollback,
  corrupt/future facts and expiry cleanup.
- Five additional real MySQL groups: independent-host current projections,
  sticky withdrawal with failure rollback, recovery preservation, production
  migrator backfill/cascade and authorization/budget locks through check commit.
- One additional upgrade matrix group: new Control-only reader ceiling, Agent
  refusal, partial table footprints and migration-runner-compatible SQL.

Existing real mTLS claim, instance and backup/recovery acceptance remains wired.
The real backup scenario still tests issued-permit quarantine; consumed withdrawal
recovery has separate real MySQL transaction coverage, not a new full backup pass.
Local verification remains static only and no matching-SHA functional pass is
claimed. Next: strict bounded poll/status machine contracts and a fail-closed
Agent monitor with explicit staleness/cancellation bounds, then result protocol
and one-use execution admission. A successful `check` is a point-in-time
observation, not instantaneous revocation delivery or continued permission after
the transaction; never cache it indefinitely or claim that a disconnected Agent
has already stopped. Real execution must retain independent host/Gate limits.

Follow-up: [ADR-0014](0014-probe-delivery-contract.md) exposes these ports through
non-executable mTLS poll/status with strict TS/Go parsing. It adds no Agent
monitor or execution permission and does not change the above historical scope.
