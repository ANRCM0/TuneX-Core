# Durable Manual Path Publications v1 (C2-B)

Status: 2026-10-18 (Asia/Shanghai), source implementation locally unverified.
Decision: [ADR-0033](../decisions/0033-durable-path-publications.md). Complements
[C2-A groups](path-groups-v1.md), not completion of C2. Ingress multi-Forward groups
and C3 automatic policy remain deferred. The earlier tab-local queue remains a
different feature and is not retroactively described as a durable saga.

## Immutable Plan And Explicit Consent

Preview input is a closed `{schemaVersion:1,group,items}` object. `group` is the
exact `{groupId,revision,configDigest,candidateId}` C2-A selection. `items` contains
1-10 distinct closed `{forwardId,expectedRevision}` entries in explicit order; no
all-pages selection, latest lookup, expanded-spec override or duplicate Forward.

```json
{
  "schemaVersion": 1,
  "group": {
    "groupId": "saved-group",
    "revision": 2,
    "configDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "candidateId": "primary"
  },
  "items": [{ "forwardId": "rule-one", "expectedRevision": 4 }]
}
```

Original owner preview captures source Forward revision/full spec/specDigest and
nullable exact path/group provenance (selection plus immutable sequence and accepted
Forward revision), original complete template selection, proposed spec/digest and
position. Source and target path bounds remain at most seven `via` Nodes. Scope
management and original reference authorization apply. Capture follows deterministic
Forward ordering but returns requested positions; it is not an atomic multi-host
runtime snapshot or a reservation.

Preview returns `previewDigest` of the full immutable plan. Confirmed creation
includes that digest and recomputes the plan in the creation transaction. Any changed
Forward revision/spec/provenance or target expansion rejects creation; explicitly
preview again. Creation claims the original request key and Scope quota, but does
not change Forward intent, reserve resources, create an Operation or execute a path.
Each accepted plan fixes source guards and target candidate permanently.

## API Surface

Routes are under `/api/v1/scopes/:scope`, original Bearer authentication and no-store
responses. Plain list/get require Scope access; preview/create and all commands
require Scope management. Only original creator plus current management can advance
or cancel an existing batch.

| Method / path | Closed input or query |
| --- | --- |
| `POST /path-publications/preview` | `{schemaVersion,group,items}`, max 16384-byte body; read-only plan plus `previewDigest` |
| `POST /path-publications` | Same fields plus `previewDigest`, max 16384-byte body; original `Idempotency-Key`; durable creation only |
| `GET /path-publications` | Only canonical `page` and `limit`; default 25, max 100, page 1-10000 |
| `GET /path-publications/:batch` | No query; head, immutable plan, attempts, derived item state and exact original Operation views |
| `POST /path-publications/:batch/items/:position/apply` | Closed `{expectedRevision}`, max 1024-byte body; canonical position 1-10 and original `Idempotency-Key` |
| `POST /path-publications/:batch/items/:position/compensate` | Same exact batch CAS/key body, one explicit conditional compensation |
| `POST /path-publications/:batch/cancel` | Closed `{expectedRevision}`, max 1024-byte body and original `Idempotency-Key` |

Mutations/preview and get-by-ID reject query parameters. Duplicate/unknown JSON
keys, duplicate/unknown list query keys and ambiguous numeric forms are rejected.
Creation returns HTTP 202 with `{batchId,revision:1,planDigest,changed:true,
reserved:false,executionAuthorized:false}`. Item commands return HTTP 202 containing
`{batchId,revision,position,kind,attempt,atomicAcrossForwards:false}`, even when the
stored attempt is a sanitized expected rejection. The nested accepted original
Forward receipt retains its own 200/no-Operation or 202/new-Operation meaning.
Cancellation returns `{batchId,revision,cancelled:true,changed}`: 202 for the first
change, 200 for an already-cancelled accepted no-op at the current CAS. Identical
original-key replay returns the original outer response rather than rerunning work.

## Durable State And Bounds

Each Scope retains at most 64 batches including completed, cancelled and restored
batches; there is no history deletion to reset the quota. Each immutable plan has
1-10 items. Each item allows at most one apply and one compensation attempt, the
latter only after accepted apply; a rejected attempt cannot be retried with changed
intent/key. At most 20 immutable attempts and 24 event revisions exist per batch.
Head revision starts at 1 and obeys
`1 + attemptCount + Number(cancelled) + Number(recoveryInvalidated)` (maximum 23).

Plans are bounded JSON at 131072 bytes. Attempt outcome JSON is at most 32768 bytes;
attempt records retain position/kind, creator actor/time, original request key/digest
and accepted original receipt/state or sanitized `{code,status}` rejection. Events
record create/apply/compensate/cancel/recovery against the head revision. Actual
SQL/row/index/log/backup overhead is separate and unmeasured.

Source plans and attempts never change. Per-item derived apply state is pending,
accepted or rejected; pending becomes cancelled when the batch is cancelled, or
suspended when recovered. Compensation has its separate accepted/rejected outcome.
Accepted means original intent was accepted, not that deployment succeeded. There is
no durable in-progress flag that can be mistaken for a committed result: the entire
one-item transaction either commits its decision or leaves no new attempt.

## Manual Commands, Ownership And Atomicity

Only the original creator, still authorized as a current Scope manager, can advance
or cancel a batch. Current access is checked on replay. Scope members can read
persisted batches. A command includes exact batch `expectedRevision`, one position
and one kind (`apply` or `compensate`), plus original `Idempotency-Key`. It never
starts remaining items automatically, even if an earlier item succeeded. There is no
worker, loop, background recovery executor or cross-rule transaction.

The batch head lock/CAS serializes each command against cancellation and other item
commands. The outer original idempotency row is claimed before a SAVEPOINT; the
original Forward owner receives the same supplied transaction and does not open a
nested transaction or claim/respond with child keys. Its current full source guards,
authorization, Forward preparation, Relay plan/resources, Operation/capacity, original
path/group provenance and Runtime acceptance remain authoritative.

Success commits original receipt/state, attempt, head/audit and outer batch response
atomically for that one item. A batch can therefore contain successful and rejected
items; there is no atomicity across Forwards. Original Runtime controls rollout,
supersession, drain, leases/fences and cleanup. Same-spec provenance changes can be
accepted with unchanged Forward revision and no Operation.

Only nonretryable allowlisted `ControlError` with status 403/404/409/422/429 is a
durable expected rejection. Allowed codes are `REVISION_CONFLICT`,
`AUTHORIZATION_DENIED`, `GROUP_ARCHIVED`, `TEMPLATE_ARCHIVED`, `RESOURCE_LIMIT`,
`PORT_RESERVED`, `UNSUPPORTED_CAPABILITY`, `REVISION_EXHAUSTED`,
`PUBLICATION_STATE_CHANGED`, `NOT_FOUND` and `RESOURCE_CONFLICT`.
SAVEPOINT rollback removes all original Forward/resource/Runtime/provenance changes
before recording only the sanitized code/status. Arbitrary exception messages,
credentials or internal SQL are not persisted. The outer batch response is HTTP 202
with either outcome; a durable rejection is not a successful Forward application.

Integrity/recovery errors, retryable errors, SQL deadlock/timeout, connection,
SAVEPOINT and commit errors propagate instead of becoming false business rejects.
Original UnitOfWork rollback/retry ownership remains. A lost HTTP response may have
committed; unknown is not a durable rejected state. Resolve only by replaying the same
outer command/key/body. Never substitute new CAS, key, source or target to bypass
uncertainty or start the next item automatically.

## Cancellation And Conditional Compensation

Cancel is a serialized batch-head change. It blocks only future applies; an apply
already holding the head can commit before cancellation. Cancellation neither aborts
that transaction remotely nor cancels/drains an accepted Operation. No retroactive
rollback is implied. Explicit compensation of accepted items remains allowed after
cancellation, subject to all guards and permissions.

Compensation compares the current original Forward against the entire accepted state:
Forward revision and full spec/digest, plus null-or-exact path and group provenance
including sequence numbers. A later same-spec provenance attachment can change only
the sequence, so revision-only CAS would be unsafe. Any mismatch consumes a rejected
compensation attempt instead of overwriting someone else's accepted work.

On a match the original owner restores the entire saved source spec, not only path
fields. It freshly reauthorizes source Node/Profile/Endpoint references, including
old path references for disabled or previously unbound source intent. Archive,
revocation, grant loss, capabilities, quotas or current resources may deny restoration.
Source provenance choices are applied as fresh original binding acceptance; old row
pointers, original revision numbers, Runtime state and Snapshots are never restored.
Null source provenance detaches the current pointers while retaining all history.

If only provenance changes, the original compensation receipt is 200 with no
Operation and no invented Forward revision. An actual spec restoration creates a
new Forward revision and Operation through normal Runtime acceptance. Fresh binding
records consume original path/group immutable history quotas. This is conditional
intent compensation, not an atomic rollback or proof of restored traffic. Existing
interruption/TCP reconnection/UDP loss and association-reset limits remain.

## Reads And Unknown Results

List/get are scoped bounded persisted-state reads, not authorization or reservations.
Get holds a shared batch-head lock through the head/attempt projection in its original
transaction, excluding concurrent append/cancel head changes while those related
rows are read. Commands use the same head with an exclusive lock. This protects the
local revision/attempt-count view, not Runtime resources or a global snapshot;
Operation progress remains a separate read that can advance concurrently.
Get includes immutable plan/attempts, per-item derived states and original Operations
referenced by accepted receipts. At most 20 distinct exact Operation IDs are read
from the original scoped `operations` table. Their original status, target revision,
cleanupPending and recoveryInvalidated flags describe deployment progress only;
they are not health, physical connectivity or full-plan authorization. Operation
IDs must map back to the exact accepted Forward/revision receipt.

Read labels include `source:"persisted-control-state"`, `reserved:false`,
`executionAuthorized:false`, `fullPlanAuthorization:false`, `health:"unknown"`,
`automaticExecution:false`, `atomicAcrossForwards:false` and a read-committed,
not-global-snapshot consistency label. Preview retains interruption/TCP/UDP limits.
Receipt and provenance history do not acquire a fresh permission lifetime.

The Console must lock uncertain sent command fields and offer only identical command
replay. A failed replay/read cannot prove the first write uncommitted. Reload may
inspect the durable batch but is not consent to repeat an item with a new key or
fresh CAS. Disconnect/discard cannot cancel an accepted remote Operation. No hidden
selection, automatic tail or browser-driven recovery loop is allowed.

## Compatibility And Recovery

Schema 0026 adds exactly `path_publications`, `path_publication_attempts` and
`path_publication_events`; supplied-transaction adapters never mutate Runtime tables.
Control-only `adp3-path-publications-v1` has Schema ceiling 0026 and catalog 26.
Old Control ceilings reject applied 0026 even when batches are unused. Agent ADP,
Journal, runtime/multihop profiles and feature flags are unchanged. Partial DDL
footprints require manual review, not automatic retry, clear/reset or fake migration
records. See [upgrade assessment](../development/upgrade-recovery-development.md).

Existing full SQL backup retains all three tables with original referenced ledgers.
In the existing quarantine transaction, each non-invalidated batch gets exactly one
recovery audit at revision+1 and then `recoveryInvalidated:true`, revision+1. Creator
is the audit's owning actor and the transaction records recovery time. Plan, attempts,
receipts, previous events and cancelled flags remain untouched. Pending items derive
suspended; no recovered batch can apply, cancel or compensate, nor auto-resume.
Original identity/Grant/request-key/Forward/Operation quarantine and independent
Authority/Journal/high-water safety remain unchanged. Review/new trust and historical
authorization exhaustion still belong to the original recovery workflow.

## Evidence And Remaining Scope

This is source/document work only, locally unverified. No tests/fixtures, static,
syntax, type, contract or boundary checks, generators, formatting, network/browser,
Compose/CI, migration execution, commit or push are authored or run. Savepoint
rollback, uncertain commits/replay, conditional compensation, permissions, locking,
quotas and restore behavior have not been accepted on the final source. Ingress
multi-Forward group semantics and C3 automatic policy remain deferred; C2 is not
declared complete and no production-readiness claim is made.
