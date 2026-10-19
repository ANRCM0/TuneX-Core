# ADR-0034: Bounded Ingress Groups And Independent Forward Creation

Date: 2026-10-18 (Asia/Shanghai). Status: C2-C implemented locally, unverified.

## Decision

Add separately versioned ingress definitions and durable manual creation batches.
Definitions contain 1-8 ordered complete pinned templates, distinct ingress Nodes and
one business protocol set. Deployment input explicitly selects unique members with
per-member listeners, shared target and enabled intent. Each selected member expands
once into an independent original Forward/Operation; never Cartesian products, VIP,
DNS steering, global entrance HA, shared physical connection or one atomic Operation.
See [contract](../spec/ingress-groups-v1.md).

Group publication/preview and confirmed batch creation do not write Forward intent or
reserve resources/identities. Preview and plan contain no generated Forward IDs, so
planDigest equals confirmed previewDigest. On each explicit manual create the original
owner generates the Forward ID and accepts original path provenance and Runtime work
in the caller's transaction. Accepted state/PathBinding receipt, immutable batch
plan/member, attempt/audit and outer idempotent response commit together per item.
No child key/response, nested transaction, background worker or second executor exists.

Creation origin is deliberately historical attribution, not a current ingress binding.
There is no ingress binding table/current pointer. Reads do not infer current membership
after ordinary edits, fresh reference permissions, group health or deletion safety from
the origin. Original PathBinding remains authoritative for its own current path state.

## Manual Saga And Conditional Removal

Creator-bound current Scope management, batch head CAS, shared-lock reads/exclusive
commands, same-command unknown replay and bounded attempts follow C2-B. One create
and one compensate attempt per member. Cancel serializes with head-locked creation
and only prevents future create; it cannot interrupt committed Runtime work and does
not prevent explicit conditional compensation. Accepted deletion intent is not cleanup.

Compensation compares whole accepted Forward revision/spec and nullable exact original
path/group provenance sequences, detecting later same-spec attachments. If unchanged,
original owner accepts a new deletion revision/Operation with `deleting:true`; it does
not restore an old Snapshot, remove ledger rows or reuse the ID. Mismatch rejects
without overwriting later work. Resource release and lease/fence rules remain Runtime's
responsibility; independent rules can succeed/fail/clean up at different times.

Only nonretryable allowlisted original domain errors become sanitized durable rejects,
after SAVEPOINT rollback removes all original writes. Outer key is claimed before the
savepoint. Integrity/recovery/database/deadlock/connection/savepoint/commit failures
escape whole transaction; no uncertain acceptance is relabeled rejected. Original
same-key response resolves lost HTTP; no new CAS or replacement create is automatic.

## Storage And Recovery

Schema0027 adds six tables: ingress_groups/revisions/events and ingress_deployments/
attempts/events. Scope bounds: 64 definitions including archives, 64 revisions each,
64 batches including terminal/recovered. Members/items at most8, attempts16; head/event
range1-20. Formula `1 + attempts + cancelled + recoveryInvalidated` is at most19.
Definition JSON8192, plan131072 and attempt outcome32768 bytes are logical bounds,
excluding physical row/index/log/backup overhead. Plans/attempts/audits are never
rewritten to release quota. Group revision is a direct deployment foreign key.

Full SQL backup includes all six tables and original referenced histories. Existing
quarantine transaction inserts one recovery event and advances/invalidates previously
active heads; preserves all history/cancel flags, derives pending suspended. Restored
batches cannot create, cancel or compensate. Existing Forward/Operation/idempotency/
identity isolation and independent Authority/Journal/high-water remain unchanged;
no recovery executor or auto-resume exists. Control-only `adp3-ingress-groups-v1`
ceiling0027/catalog27 rejects older Control readers even if unused; Agent/ADP/Journal
and runtime flags unchanged. Partial DDL requires manual review, not fabricated history.

## Evidence And Remaining Scope

This slice creates new deployments only. Existing-deployment revision impact and
per-member add/update/remove reconciliation into a new group revision remain the
next C2 gap before D3. Publishing definitions does not alter prior Forwards; creating
duplicate rules must not be labeled migration or reconciliation.

The subsequent [ADR-0035](0035-explicit-ingress-migrations.md) and
[ingress migration contract](../spec/ingress-migrations-v1.md) implement that separate
bounded manual migration slice in source. They retain historical lineage rather than
adding a current membership pointer; their behavior and this creation slice remain
unverified pending the concentrated acceptance phase.

Only source/document edits and necessary reads. No tests/new fixtures, checks,
generators, formatting, network/browser/Compose/CI, migrations executed, commit or push.
All new behavior, compensation, quotas, locks/replay/recovery and final-source
integration remain locally unverified. C3 and concentrated C2 acceptance remain open;
this is neither C2 acceptance completion nor production-readiness evidence.
