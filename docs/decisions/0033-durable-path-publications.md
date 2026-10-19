# ADR-0033: Durable Manual Path Publication Saga

Date: 2026-10-18 (Asia/Shanghai). Status: C2-B implemented locally, unverified.

## Decision

Add bounded durable coordination for manually applying one exact C2-A group candidate
to 1-10 explicit existing Forwards. This is distinct from the original tab-local
publication queue: a confirmed immutable source/target plan, accepted/rejected attempts
and cancellation survive reload, but execution remains an explicit one-item command.
No scheduler, background worker, automatic retry/tail, new Runtime permission or
cross-rule atomic transaction is introduced. Ingress groups and C3 policy are deferred;
this is not completion of C2. See [contract](../spec/path-publications-v1.md).

Preview captures original Forward revision/full spec/digest and exact nullable
path/group provenance, plus one exact group/candidate and each proposed complete path.
Creation recomputes the preview digest under current authorization and stores the plan
without any Forward mutation, Operation or resource reservation. Original creator plus
current Scope management is required to advance or cancel a batch. Scope members can
read persisted state without treating it as current authorization or runtime health.

Each item allows exactly one apply and, only after accepted apply, one conditional
compensation. All are independently manual commands with batch CAS and original outer
idempotency. Batch head locks serialize cancel against acceptance. Cancellation stops
future applies, not already accepted Operations; it does not prohibit compensation.
Rejection consumes the applicable attempt and never silently changes original intent.

## Original-owner Atomicity And Errors

The original Forward owner exposes supplied-transaction apply/compensate entrypoints.
It retains fresh source/provenance guards, authorization, preparation, Relay resources,
Operation/capacity and Runtime acceptance. No nested transaction or child idempotency
key/response exists. The outer request is claimed before the adapter SAVEPOINT. On
success original acceptance/state, durable attempt, batch revision/audit and outer
response commit atomically for that item, not for all rules in the plan.

Only explicitly allowlisted nonretryable ControlError statuses 403/404/409/422/429
become durable sanitized rejects. Roll back to SAVEPOINT before recording rejection,
so no partially prepared Forward, provenance, resource or Runtime changes survive.
The batch command returns HTTP 202 with an accepted-or-rejected attempt outcome; 202
means the durable decision was accepted, not that runtime succeeded. Integrity,
recovery, arbitrary database, deadlock/timeout, savepoint, connection and commit errors
escape to the outer transaction. Never classify an uncertain commit as rejected.
Unknown HTTP outcome is resolved only by the original key/body/command, not new CAS.

## Conditional Compensation

Compare current state against the complete accepted Forward revision/spec digest and
nullable exact path/group selection plus provenance sequences. Forward CAS alone is
insufficient because equivalent-spec attachments do not increment its revision.
Mismatch records a rejected compensation rather than overwriting later work.

Compensation restores the full source spec through the original owner and freshly
reauthorized original choices; it never points back to old binding rows, replays an
old Snapshot or resurrects an Operation. Original path references must be authorized
even for disabled/unbound source intent. Archive/grant/credential/capability changes
can reject restoration. Metadata-only restoration can be 200/no Operation, while
actual spec restoration uses a new Forward revision/Operation. New provenance rows
count against original immutable history limits. No zero-loss rollback is promised.

## Persistence, Recovery And Compatibility

Schema 0026 adds `path_publications`, `path_publication_attempts` and
`path_publication_events`. Plans are immutable JSON at most 131072 bytes, 1-10 items;
attempt results at most 32768 bytes. Unique item/kind keys bound attempts to 20 per
batch. Scope locks enforce 64 batches including terminal/recovered rows. No purge or
quota-reset workflow rewrites history. Head/event revision is bounded 1-24 with
`revision = 1 + attemptCount + cancelled + recoveryInvalidated`, maximum 23.

Full SQL backup includes all three tables and original referenced histories. Existing
recovery quarantine records one event at revision+1 and advances/invalidates each
not-yet-invalidated head in the same transaction. Plans/attempts/receipts/audits and
cancelled flags remain intact; pending items derive suspended. Restored batches cannot
apply, cancel or compensate. Original identity/Grant/idempotency/Forward/Operation
quarantine and Authority/Journal/high-water maintenance remain unchanged. No automatic
resume or new recovery executor is added.

Control-only `adp3-path-publications-v1` has ceiling 0026; older Control ceilings reject
applied 0026 even if batches are unused. Agent profile/ADP/Journal and flags are unchanged.
The catalog is deliberately extended to 26 files. Partial DDL requires review, not
automatic retry, table deletion or fabricated migration records.

## Evidence

Only source/document edits and necessary reads were performed. No new tests/fixtures,
static/syntax/type/contract/boundary checks, generators, formatting, network/browser,
Compose/CI, migration execution, commit or push were authored or run. Per-item
atomicity, savepoints, replay/unknown commit, compensation, lock contention, quotas and
recovery remain locally unverified. Logical JSON bounds exclude physical storage,
indexes, logs and backups. No production-readiness or C2-completion claim is made.
