# ADR-0035: Explicit Ingress Revision Migrations

Date: 2026-10-18 (Asia/Shanghai). Status: C2-C2 implemented locally, unverified.

## Decision

Add bounded explicit plans between two different exact revisions/digests of the same
ingress group. Preserve both immutable definitions, a complete sorted member-union
diff and selected immediate historical origin outcomes with whole Forward states.
The diff is inspection, not automatic reconciliation. Only1-8 explicitly selected
add/update/remove actions run, one manual request at a time through original owner
supplied-Tx commands. No current ingress membership pointer, recursive lineage scan,
automatic removal of omitted members, VIP/DNS/global HA or global atomic Operation.
See [contract](../spec/ingress-migrations-v1.md).

Origin references name deployment/migration batch, exact position and apply/compensate
phase. They resolve immediate checked immutable results and original PathBinding
sequences, not an inferred current group binding. Original Forward whole-state guards
must still match at preview/create/acceptance. A later same-spec provenance change is
a conflict even when Forward revision is unchanged. Accepted update compensation has
a new guarded source result, not old provenance row resurrection.

Update retains ingress/protocols/target/listener/enabled and changes only exact native
path/Profile. An ingress change requires explicit independent remove+add, each counting
against the eight-action bound. Add uses original create with ID generated at accepted
execution, never reserved in preview/plan. Remove accepts original deletion intent
and is explicitly NONCOMPENSATABLE. Never label unpaired duplicate creates as migrating
a selected source or claim cross-rule atomicity.

## Compensation And Failure Boundaries

An already-selected member may also be explicitly re-created on the SAME ingress
for protocol/business-intent changes, but only with a paired selected source remove.
Unpaired duplicate add is rejected; both actions count and can partly fail. This is
not an automatic replacement or rollback. Existing planned remove can still perform
guarded cleanup after group archive; add/update resolve active target references.

One apply per action and optional one compensation only for accepted add/update.
Add compensation is guarded original deletion. Update compensation compares whole
accepted state and freshly authorizes/restores complete source spec/provenance choices.
Grant/archive/capability/resource/history quota changes may reject it. No Snapshot,
historical pointer or old revision is replayed. Remove cannot resurrect deleted intent.

Creator-bound current Scope management, batch CAS/head locks, outer original idempotency
and SAVEPOINT isolation follow C2-B. Original Forward/resource/Runtime/Operation writes
and accepted state/attempt/audit/outer response commit together per item. Allowlisted
nonretryable domain errors roll back all owner writes before sanitized rejection.
Integrity/recovery/database/deadlock/connection/savepoint/commit errors escape; unknown
HTTP requires same key/body/command replay, not a replacement plan/CAS or automatic tail.
Cancel stops future apply, not accepted Operations; eligible compensation remains manual.

## Storage And Recovery

Schema0028 owns ingress_migrations, ingress_migration_attempts and ingress_migration_events.
Head stores group ID and exact source/target revision FKs. Scope quota64 includes all
terminal/recovered batches; plan max8 source refs and8 total actions, outcome max16
attempts. Plan JSON131072 bytes, outcome32768, head/event1-20. Formula
`1+attemptCount+cancelled+recoveryInvalidated` maximum19. No deletion/history rewrite
resets quotas. Shared head reads stabilize bounded attempts; original Operation views
remain separately progressing, scoped and limited16 exact IDs.

Full SQL backup includes new tables and original lineage families/Forward/PathBinding/
Operation/request history. Existing quarantine transaction inserts one recovery event,
advances head and invalidates once, preserving source/target definitions/diff/lineage,
attempts/receipts/cancel/audit. Pending derives suspended; no restored plan can apply,
cancel, compensate or auto-reconcile. Existing Forward/Operation/request-key/identity/
Grant quarantine and Authority/Journal/high-water remain unchanged. Control-only
adp3-ingress-migrations-v1 ceiling0028/catalog28 rejects older readers even if unused;
Agent protocol/Journal/Profile/flags unchanged. Partial DDL requires manual review.

## Evidence

Source/document edits and necessary reads only. No tests/new fixtures, static/syntax/
type/contract/boundary checks, generators, formatting, network/browser/Compose/CI,
migration execution, commit or push. All new behavior, origin state guards,
compensation, concurrency/replay, quotas and recovery remain locally unverified.
Logical JSON bounds exclude row/index/log/backup overhead. No C2 acceptance completion,
C3 readiness or production-readiness claim is made.
