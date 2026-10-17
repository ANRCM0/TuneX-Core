# ADR-0009: Durable, non-executable Probe instance ownership

Date: 2026-10-17. Status: Accepted for internal ownership only.
Predecessor: [ADR-0008](0008-probe-contract-negotiation.md).

## Decision And Scope

Add `ProbeInstances` as a transaction-bound application service and a narrow
`ProbeInstanceStore` owner port. Production composition supplies the existing
machine evidence reader and a MySQL owner of the new `probe_instances` table.
It is an internal integration port, not an HTTP registration endpoint, permit
issuer, Agent polling loop or execution authorizer. All returned views retain
`executionEnabled:false`. The existing `/agent/v3/probe/hello` stays read-only.

The trusted caller must supply the Node and actual verified certificate
fingerprint, not caller-declared machine identity. Registration and replay
recheck current Node/boot/session, credential validity/revocation/retirement and
Direct TCP capabilities in the same transaction. Machine rows are held by the
existing `FOR SHARE` reader. Recheck time after waiting for the instance lock.
Maintenance guards apply before and after acceptance through the existing UoW.

## Ownership State

There is at most one slot per Node, not one per Control process. An owner-only
no-op upsert followed by `FOR UPDATE` serializes first registration as well as
replacement; failed acceptance rolls the initial empty seed back. No write
touches execution leases, Forward intent, Snapshot, reservations or Journal.

- Initial registration requires `expectedGeneration:0`, stores generation 1,
  and binds the exact Node, boot, session, certificate fingerprint and random
  256-bit Agent gate instance. The service validates the instance shape; only
  Agent gate construction, not this store, proves the random-generation origin.
- A different instance requires the current generation and advances it once.
  Concurrent different replacements cannot both win. A delayed request cannot
  overwrite a later generation, including after a Control process restart.
- An exact retry uses the original expected generation and returns the original
  record without renewal or another generation. It still reauthorizes current
  machine evidence before returning. Revoked, quarantined or expired instances
  cannot be revived by this retry.
- Registration freshness is at most 30 seconds, intersected with actual
  certificate/Node expiry and overlap retirement. This is **not** the two-second
  execution-permit lifetime and grants no time budget for network work.
  Expiry or a clock before registration requires a new instance/current CAS.
- Revocation matches the current instance and generation, is sticky/idempotent,
  and preserves the generation. Capability withdrawal does not prevent closing
  a slot with otherwise valid current machine credentials. Generation exhaustion
  denies replacement but never prevents revocation.
- Inspection is SELECT-only and reports absent, registered, stale, revoked or
  quarantined. Boot/session/certificate/capability changes or expiry make a
  registration stale; observation is not an atomic reservation for later work.

Generation is a SQL-local ownership counter, **not an independent rollback-proof
high-water**. A supported restore can recover an older SQL generation. Recovery
quarantines every restored nonempty slot without clearing its identity/counter,
alongside the existing old-credential revocation, fresh trust and reviewed resume.
No restored registration becomes current authority merely because its deadline
has not passed. The store does not replace protected Authority state.

## Migration And Recovery

Migration `0014-probe-instances.sql` is additive, creates only this owner table,
and adds no Core or ADP/3/Journal fields. Include it in existing SQL backups.
The existing restore transaction invokes its quarantine owner; no separate
backup format or recovery path is introduced.

The Control-only `adp3-probe-registry-v1` compatibility profile reads through
0014. Agent profiles remain unchanged. An applied 0014 blocks a target Control
declared at either old schema ceiling even if Probe is never enabled. The
read-only upgrade inspector recognizes the new migration/partial-table footprint
and requires reviewed maintenance for pending DDL. Assessment does not execute
the migration; deployment startup still uses the existing migration mechanism.

## Not Yet Delivered

There is no remote register/rotate/revoke schema or endpoint, gate replacement
in Runner, independently authenticated execution permit, durable permit claim,
actor/cluster issuance budget, dispatch receiver or result persistence. Revoking
this SQL record does not yet cancel an Agent gate or an in-flight measurement.
The old contract-only acknowledgement neither creates this row nor permits work.

Live issuance must lock/revalidate this slot with current actor/Forward/Node
authorization and the complete execution binding, then intersect its own deadline
with current credentials and target authority. It must specify restart/recovery,
clock and in-flight withdrawal semantics rather than infer them from a registered
row. The Agent must close the predecessor on replacement/session loss/shutdown.
Neither a stored instance nor the internal one-use gate alone completes remote
or distributed replay protection.

## Evidence

Nine port regression groups, one additional upgrade-profile regression and four
isolated real MySQL groups are authored and explicitly wired into Actions.
Coverage includes first-slot/concurrent replacement races across application
instances, replay without renewal, stale identity/expiry, sticky revocation,
rollback after owner writes/maintenance guard failure, counter exhaustion and
quarantine. Existing real dump/restore acceptance additionally seeds a record
and verifies its restored identity/generation and quarantine state. These are
not executed locally and have no matching-commit acceptance yet.

## Subsequent Integration

[ADR-0010](0010-probe-registration-lifecycle.md) adds a separate remote
inspect/register/revoke adapter and default-off Agent lifecycle around this same
owner. The deferred remote-registration/lifecycle items above describe the scope
at this ADR's implementation, not the later slice. Read-only negotiation stays
unchanged. The real recovery test subsequently observes actual Agent registration
instead of internally seeding it. Executable permits/dispatch/results remain
absent, and SQL revocation still is not immediate Agent push cancellation.
