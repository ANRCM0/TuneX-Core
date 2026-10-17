# ADR-0011: Internal Probe permit authority and durable one-use consumption

Date: 2026-10-17. Status: Accepted for internal Control authority only.
Predecessor: [ADR-0010](0010-probe-registration-lifecycle.md).

Subsequent slice: [ADR-0012](0012-probe-claim-contract.md) exposes a closed mTLS
claim adapter over this existing consume transaction and a non-executable Agent
verification hook. It does not add a remote issuer, dispatcher or continuous
independent execution authority; the internal-only scope below records this
decision's original delivery boundary.

[ADR-0013](0013-probe-delivery-authority.md) subsequently adds internal offer/check
ports and sticky consumed withdrawal. It preserves the original consumed record
instead of treating revoke-after-consume as a harmless no-op. The new table has
its own 0016 compatibility and recovery review; existing permit record shape,
one-use semantics and issuance reservations remain unchanged.

## Scope And Ownership

Add `ProbePermits` behind classified application ports. It owns short-lived
issuance, consumption and revocation, with `MySqlProbePermits` owning only
`probe_permits` and the singleton `probe_permit_budget`. Production composition
supplies locked authorization projections and the existing machine/instance
owners. It does not own Forward intent, Snapshot, execution leases, ports,
Journal or independent Authority high-water.

The service is internal, not a remotely authenticated issuer or dispatcher.
Its detached views explicitly retain `executionEnabled:false` and
`dispatch:not-implemented`. They are not serialized Agent permits and cannot
be converted into `probe.Grant` without the future verifier/online authority
protocol. No new HTTP endpoint, Go receiver or background issuing loop is added.
The existing preflight, read-only Hello and registration responses stay unchanged.

## Authorization And Transaction

`issue(actor, scope, forward, command)` accepts only version 1, `tcp-connect`,
expected Forward revision, optional 100..2000 ms timeout and exact registered
instance ID/generation. IDs and input are validated/detached before asynchronous
work; callers cannot choose a permit ID, target, binding or issue timestamp.

Within one existing guarded MySQL transaction:

1. Require current Scope manager membership, then acquire the shared permit
   budget lock. No process-local cache stands in for this lock.
2. Reuse Forward probe authorization through a supplied-transaction port, not
   the public preflight's separate transaction. Production supplies scoped
   `FOR SHARE` intent and published session/Snapshot projections. Existing
   membership, explicit Node Grant and Node-policy reads also hold their locks.
3. Require enabled, non-deleting/non-recovery-suspended Direct TCP numeric-IP
   intent, strict non-metadata target policy and a unique matching active
   published binding. Publication is not proof of Agent application.
4. Read/lock the existing instance slot, compare Node/boot/session/instance/
   generation and recheck the actual slot certificate's current credential,
   revocation, expiry, retirement and Direct TCP capability evidence. Resample
   time after waits; preserve all locks through durable commit.
5. Enforce issuance reservations and mint a cryptographic random UUID. Expiry
   is at most two seconds, intersected with plan/Snapshot cutoff minus existing
   skew, instance freshness and current machine/Node/retirement bounds.

The stored binding includes Node, boot, session, Snapshot generation,
Assignment, Forward/revision, deployment generation, Fence, config digest and
egress revision. Store no target address or executable payload. Fingerprints
remain internal and are omitted from views. This authority cannot extend the
already protected Snapshot deadline, so it does not mint another execution lease
or lower/change independent Authority state.

## Single-use Consumption And Closing

`consume(node, actualFingerprint, epoch, claim)` requires permit ID, boot and
exact instance/generation. The future machine adapter must supply real mTLS
identity, not caller-declared fingerprints; this slice supplies no such endpoint.

Under the same budget lock and transaction, require an `issued` row, exact
machine/instance association and a live deadline. Reauthorize the **original
issuing Actor** with current membership, Node Grant, intent and policy. Compare
every current execution-binding field, recheck the locked current instance and
machine evidence, and reject shortened authority bounds. Only then atomically
close the row as `consumed`. The caller gets a result only after commit.

Concurrent consumers across processes cannot both win. An unknown, expired,
replaced, revoked, quarantined or already-consumed ID is not a new request.
Lost claim acknowledgements leave committed consumption spent: do not retry
network work under that ID or turn an ambiguous result into a refund. Owner or
post-acceptance maintenance failure rolls the whole transaction back; no network
side effect is performed inside this transaction.

Any current Scope manager can revoke a still-issued scoped row even if its
original Node Grant was withdrawn. Closing never reopens a consumed/revoked row
or refunds its issuance reservation. SQL revocation is not an immediate push
to an Agent, and no in-flight remote execution revocation is claimed here.

## Bounded Shared Issuance Reservations

Limits apply to one Control database across its processes and Scopes:

- At most four unexpired issuance reservations, including consumed/revoked rows.
- One reservation per Actor across Scopes and per Node across Actors, retained
  through expiry plus one second of cooldown, independent of instance rotation.
- At most 256 retained records. Read at most 257 bounded records to detect
  overflow, limit persisted binding reads to 2 KiB, and fail closed on malformed
  records, missing singleton state or duplicate IDs.
- Prune only rows expired for at least one second during successful owner work.
  Deleted IDs remain invalid; issuance never accepts caller-selected IDs or
  resurrects an unknown ID. There is no replay-as-insert path.
- A SQL-local observed-time floor rejects backward time/future issuance history.
  It is not independent rollback-proof time or authority, and is preserved during
  supported restore rather than reset to make quota errors disappear.

These are **issuance rate/reservation budgets**, not proof that all actual
network work has ended at expiry. Existing Agent global/Node admission and
cooldown still remain held until real work and monitors terminate. Future
dispatch must define cancellation, live authority checking, bounded outstanding
work and overload separately; a durable claim alone cannot provide the
continuous `Permit.Check` required by the executor.

## Migration, Recovery And Compatibility

Migration `0015-probe-permits.sql` adds only the two owner tables. No Core,
ADP/3/Probe machine schema/capability or Agent Journal change is introduced.
The Control-only profile `adp3-probe-permits-v1` has reader ceiling 0015; old
Control profiles remain capped at their historical ceilings. Agent profiles
are unchanged and cannot declare either Control-only Probe profile.

Reviewed maintenance/backups are still required for DDL, including partial
table footprints; disabling Probe does not undo migration or permit rollback
to an old Control reader. The existing backup includes these tables. Supported
restore invokes this owner in the existing recovery transaction, quarantines
restored `issued` IDs, preserves closed states/IDs and the budget clock, and
continues the original instance quarantine, old-credential revocation, fresh
trust and reviewed-resume workflow. No restored row alone grants execution.

## Evidence And Remaining Work

Eleven new permit-port test groups, one supplied-transaction plan regression,
one compatibility regression and six isolated real MySQL groups are authored
and wired into Actions. MySQL acceptance uses SELECT on other tables, DML only
on permits and UPDATE only on the budget; it covers independent pools racing,
lock retention, current authorization withdrawal, rollback, clocks and quarantine.
The real Linux Agent backup/recovery script additionally internally issues a
permit against the actual registered Agent, then checks restored quarantine and
the preserved budget clock. It does not dispatch that permit.

Local checks are static only. No matching-commit functional, physical-host or
production acceptance is claimed. Next is a strict independently authenticated
permit/claim wire contract and current host verification, then bounded dispatch,
continuous execution revocation and result validation/ingestion. No UI should
label an internally issued or consumed row as a completed/healthy Probe.
