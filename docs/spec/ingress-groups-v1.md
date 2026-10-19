# Bounded Ingress Groups v1 (C2-C)

Status: 2026-10-18 (Asia/Shanghai), source implementation locally unverified.
[ADR-0034](../decisions/0034-bounded-ingress-groups.md). Complements C2-A single-path
choice and C2-B replacement publications; C3 and final C2 acceptance remain open.

This slice creates new independent rules only. Existing deployment member diff and
reconciliation to another group revision (per-member add/update/remove migration and
revision impact) are not implemented. Publishing a new definition leaves earlier
Forwards untouched; creating duplicate rules is not an update of that deployment.
Existing-deployment migration remains the next C2 gap before D3.

## Definition And Expansion

An ingress definition is closed `{schemaVersion:1,members}` with 1-8 ordered closed
`{memberId,template:{templateId,revision,configDigest}}` members. Original case-sensitive
IDs, exact template revision1-64 and lowercase SHA256/JCS digest are required. Member
IDs and complete template digests are distinct. Templates describe full native paths,
not partial fragments or sets to cross multiply. All members have distinct ingress
Nodes and the same protocol set. No ingress/Node override, latest selector, caller
expanded-spec override, VIP, DNS switching or global HA is provided.

Publication authorizes original Node/Profile/Endpoint references and locks Scope before
head CAS. Definitions are immutable revisions with digest/creator/time, terminal
archive and audit; 64 groups/Scope including archived and64 revisions/group. Archive
stops new definitions/use of the archived identifier, not created traffic, original
same-key responses or conditional deletion of existing rules. Template/group revision
publication never automatically changes created Forwards.

Deployment input is closed `{schemaVersion:1,group,enabled,target,items}`. Exact group
selection contains `{groupId,revision,configDigest}`. Shared explicit enabled/target
and 1-8 unique `{memberId,listen:{address,port}}` items select each member once. A subset
is allowed; input order supplies positions. Each complete template determines its
original ingress/path/protocol/Profile, and each selected member creates one independent
Forward and Operation. No Cartesian product or implicit selection of all pages occurs.

```json
{
  "schemaVersion": 1,
  "group": {
    "groupId": "entrances",
    "revision": 1,
    "configDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "enabled": false,
  "target": { "host": "service.internal", "port": 8080 },
  "items": [{ "memberId": "entrance-a", "listen": { "address": "127.0.0.1", "port": 18080 } }]
}
```

Preview resolves original templates/authorization and returns full deterministic specs,
digests, exact member/template source and positions plus `previewDigest`. Confirmed
batch creation recomputes that expansion; changed digest requires fresh explicit
preview. Neither preview nor durable creation reserves IDs/resources, creates Forward
intent or an Operation. There are no Forward IDs in input/preview/plan. Original owner
allocates each ID only at that item's manual accepted create; lost HTTP replays the
original outer command rather than allocating another committed rule.

## API Surface

All routes use `/api/v1/scopes/:scope`, original Bearer access and no-store responses.
Plain list/get need Scope access; mutations/preview require current management.
Existing batch item/cancel commands also require the original creator.

| Method / path | Input |
| --- | --- |
| `GET /ingress-groups` | Only bounded `page`, `limit`, optional `prefix` |
| `GET /ingress-groups/:group` | Optional exact `revision`1-64; defaults current |
| `PUT /ingress-groups/:group` | Closed `{expectedRevision,config}`, body8192; CAS0 creates, original Idempotency-Key |
| `DELETE /ingress-groups/:group` | Closed positive `{expectedRevision}`, body1024, original Idempotency-Key |
| `POST /ingress-deployments/preview` | Closed deployment input above, body16384; no mutation |
| `POST /ingress-deployments` | Deployment input plus `previewDigest`, body16384, original Idempotency-Key |
| `GET /ingress-deployments` | Only `page`, `limit`, optional exact `groupId`; historical batch listing |
| `GET /ingress-deployments/:batch` | No query; persisted head/plan/attempts/items/Operation views |
| `POST /ingress-deployments/:batch/items/:position/create` | Closed `{expectedRevision}`, body1024, position1-8, original Idempotency-Key |
| `POST /ingress-deployments/:batch/items/:position/compensate` | Same batch-CAS/key body; one guarded original deletion |
| `POST /ingress-deployments/:batch/cancel` | Closed `{expectedRevision}`, body1024, original Idempotency-Key |

Body limits are bytes. Mutations/preview and get-by-batch reject all queries; closed
parsers reject unknown/duplicate body/query fields and ambiguous numeric forms.
Paging uses original page1-10000, default limit25/max100. Definition writes return
`{groupId,revision,configDigest,archived,changed}` with202 for changed or200 no-op;
identical config does not publish another revision. Confirmed deployment creation
returns202 `{batchId,revision:1,planDigest,changed:true,reserved:false,
executionAuthorized:false}`. Item commands return202 with batchId/revision/position/
kind/attempt/atomicAcrossForwards:false even for durable sanitized rejection.
Cancellation returns202 for changed,200 if already cancelled at current CAS.
Identical-key replay returns saved outer response, not another create/delete.

## Historical Origin, Not Current Binding

Plan/member and accepted state/receipt are durable historical creation attribution.
The original PathBinding sequence is accepted atomically with the Forward and attempt.
No separate ingress binding/current pointer is created, and the original path-group
pointer is null for ingress creation. Reads never present origin as current route
membership or automatically rewrite origin after later rule edits. Original PathBinding
APIs retain their separate current/provenance semantics. Group history/batches cannot
prove deletion safety, current authorization, live configuration or runtime health.

## Durable Manual Commands

Each Scope stores64 ingress batches including cancelled/terminal/restored, independently
from C2-B replacement batch quota. Each plan has1-8 items, each one create and at most
one compensation after accepted create. Rejected attempts are final for that kind;
there is no new-key retry with revised intent. At most16 immutable attempts and20
head/event revisions. Head formula is `1+attemptCount+cancelled+recoveryInvalidated`,
maximum19. Plan/member data and attempt receipt/state/code/actor/time/key/digest never
change. Definition JSON is bounded8192 bytes, plan131072, each outcome32768; physical
SQL/row/index/log/backup costs are separate and unmeasured.

Only original creator still authorized as current Scope manager can advance/cancel.
Members can read; current access remains checked on replay. One explicit request
names batch CAS, position1-8 and create/compensate. Exclusive head locking serializes
steps against cancel; shared head locking on get protects head/attempt projection
within its supplied transaction. There is no worker, automatic loop/tail, global
transaction, second Forward owner, child idempotency key/response or nested transaction.

The outer request claims original idempotency before SAVEPOINT. Original owner supplied
transaction accepts Forward/history/path provenance, authorization, resources,
Operation/capacity and Runtime work. Success commits those with accepted state, attempt,
batch CAS/audit and outer receipt atomically for that item only. Create is original
revision1/status202 with original PathBinding sequence1/forwardRevision1 and original
Operation. Partial batch success is expected, not a global atomic deployment.

Known nonretryable allowlisted ControlError statuses403/404/409/422/429 roll back all
original mutations to SAVEPOINT, then persist only sanitized code/status rejection.
The allowlist is shared with C2-B: REVISION_CONFLICT, AUTHORIZATION_DENIED,
GROUP_ARCHIVED, TEMPLATE_ARCHIVED, RESOURCE_LIMIT, PORT_RESERVED,
UNSUPPORTED_CAPABILITY, REVISION_EXHAUSTED, PUBLICATION_STATE_CHANGED, NOT_FOUND,
RESOURCE_CONFLICT. Arbitrary messages/SQL/credentials are not saved. Batch item HTTP202
means durable decision accepted, including a rejected create/delete attempt, not
runtime success. Integrity/recovery/retryable/database/deadlock/timeout/connection/
savepoint/commit errors escape; never infer rejection from an uncertain commit.

Unknown sent writes offer only identical command/key/body replay, not new CAS/key,
new plan or automatic next item. Rejected replay does not prove the original command
uncommitted. Reload can inspect durable results without authorizing another creation.
Disconnect or discard cannot cancel remote acceptance.

## Cancel And Guarded Delete Compensation

Cancel stops only future creates and serializes against a currently head-locked create.
It cannot interrupt committed Operations or undo creation; explicit compensation can
remain allowed after cancel. Pending items derive cancelled unless recovery invalidated,
when they derive suspended. Accepted/rejected create state and separate compensation
outcome are retained unchanged.

Compensation compares entire accepted Forward revision/spec and nullable exact original
path/group provenance, including sequences. A later same-spec provenance change must
deny deletion even if Forward revision is unchanged. It never overwrites edits or
deletes a rule merely because it came from this batch. On exact match original owner
accepts a new deletion revision/Operation and returns `deleting:true` plus accepted
state. No old Snapshot is replayed, no historical row is deleted, no ID is reused.

Deleting intent is not cleanup completion. Original Runtime retains resource release,
lease/fence, supersession, drain and authorization deadlines. Subsequent status/cleanup
may fail or progress independently. No zero-loss rollback, TCP connection migration,
UDP preservation or synchronized multi-ingress availability is promised.

## Read Views And Limits

Group get resolves immutable complete members with historical reference checks only;
publishing/new use performs original fresh authorization. Batch list optionally filters
exact groupId; it counts historical deployments, not current group-bound Forwards.
Get includes plan/attempts, derived item states and at most16 distinct exact scoped
original Operations referenced by receipts. Each view must match original accepted
Forward ID/target revision. Status accepted/running/succeeded/failed/superseded,
cleanupPending and recoveryInvalidated are original progress facts, not health.

Shared head lock keeps revision/attempts coherent, not global Runtime progress;
Operation views can advance concurrently. Labels remain persisted-control-state,
reserved:false, executionAuthorized:false, fullPlanAuthorization:false, health:unknown,
automaticExecution:false, atomicAcrossForwards:false, physicalConnectionSharing:false
and read-committed-not-global-snapshot where applicable. No fresh execution lifetime,
network proof or full-plan permission follows from reading history.

## Compatibility And Recovery

Schema0027 owns ingress_groups, ingress_group_revisions, ingress_group_events,
ingress_deployments, ingress_deployment_attempts, ingress_deployment_events. Deployment
head references exact ingress group revision; definitions/coordination never mutate
executable tables independently. Control-only adp3-ingress-groups-v1 ceiling0027 uses
catalog27; older Control readers reject applied0027 even unused. Agent ADP/Journal,
runtime/multihop Profile and flags remain unchanged. Partial DDL mismatches require
manual review, not clear/rebuild/automatic retry or false migration records.

Full SQL backup includes all six tables and original referenced histories. In the
existing recovery quarantine transaction, not-yet-invalidated ingress heads receive
one recovery event at revision+1, then invalidated plus revision+1; creator is recorded
as owning actor with recovery transaction time. Preserve definitions, plans, attempts,
receipts, audit and cancelled flags; repeated quarantine does not advance again.
Pending derives suspended. No restored batch can create/cancel/compensate or auto-resume.
Existing Forward/Operation/request-key/identity/Grant isolation and independent
Authority/Journal/high-water remain protected. Review, fresh trust, maintenance and
historical lease exhaustion continue through the original recovery workflow.

## Evidence

The subsequent [ingress migration contract](ingress-migrations-v1.md) and
[ADR-0035](../decisions/0035-explicit-ingress-migrations.md) add selected-origin
revision impact and explicit add/update/remove plans separately from creation.
They do not turn these historical deployment receipts into current membership or
silently reconcile an entire group. Both slices remain source-only and unverified.

Source/document edits and necessary reads only. No tests/new fixtures, static/syntax/
type/contract/boundary checks, formatting/generators, network/browser/Compose/CI,
migration execution, commit or push were authored/run. Final-source atomicity,
partial failure, unknown replay, compensation, quotas, recovery and UI behavior are
unverified. This implements a C2-C slice, not final C2 acceptance or C3 readiness.
