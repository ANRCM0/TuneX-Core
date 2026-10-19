# Explicit Ingress Revision Migrations v1 (C2-C2)

Status:2026-10-18 (Asia/Shanghai), source implementation locally unverified.
[ADR-0035](../decisions/0035-explicit-ingress-migrations.md). Complements
[new ingress deployments](ingress-groups-v1.md); does not add current live membership,
automatic revision following, VIP/DNS/global HA or C3 policy. Final C2 acceptance
remains required on final source.

## Exact Definitions, Origins And Actions

Input is closed `{schemaVersion:1,sourceGroup,targetGroup,sources,items}`. Source and
target select different exact revisions of the same ingress group ID, each with its
immutable configDigest. No latest or caller-supplied full spec override. Both complete
definitions and the entire sorted union diff are preserved in the plan; each diff
entry is added/removed/unchanged/reference-changed/ingress-changed with exact nullable
source/target template selections and ingress Nodes. At most16 diff rows describe
two eight-member definitions, but at most8 TOTAL selected actions may execute.

Sources are1-8 distinct exact `{kind:"deployment"|"migration",batchId,position,phase}`
references. Position is1-8; deployment phase is only apply (its accepted create).
Migration phase names apply or compensation. No browser-supplied Forward ID alone can
assert ingress origin. Each source resolves immediate checked historical group/member/
template and whole accepted Forward state; source Forward IDs and member IDs are
distinct, match the chosen source definition and retain exact PathBinding provenance.
No recursive history traversal, inferred current-group pointer or membership scan.

Each item is one closed explicit action:

```json
{
  "kind": "add",
  "memberId": "new-entrance",
  "enabled": false,
  "target": { "host": "service.internal", "port": 8080 },
  "listen": { "address": "127.0.0.1", "port": 18080 }
}
```

Update is `{kind:"update",memberId,source}`; remove is `{kind:"remove",source}`.
`source` is the1-based index in supplied sources, not a revision or arbitrary ID.
Each source may be consumed once; add/update target members may be used once.
Source member cannot be renamed by update/remove. Unselected diff rows/sources are
not automatically mutated, so this is explicit scoped migration, not global desired
membership reconciliation. Removing a definition member does not itself delete rules.

Add uses the exact target member path/protocols with caller's explicit enabled/target/
listener. Update is only path/Profile replacement on the same ingress/protocols,
preserving source target/listener/enabled intent. Adding an already-selected member
requires its explicit paired source remove, even on the SAME ingress: this permits
deliberate re-creation for protocol/business-intent changes, not an unpaired duplicate.
Changing ingress also requires remove+add. Both count toward the eight-action limit,
remain independent and can partly fail; the original port arbiter still decides
whether add-before-remove is possible. No Cartesian products or implicit port
reassignment. Native paths retain at most seven via Nodes.

## API Surface

All routes use `/api/v1/scopes/:scope`, original Bearer access and no-store responses.
List/get need Scope access; preview/create require management. Existing batch actions
also require the original creator who remains a current manager.

| Method / path | Closed input or query |
| --- | --- |
| `POST /ingress-migrations/preview` | Input above, max16384-byte body; read-only full diff/selected plan plus previewDigest |
| `POST /ingress-migrations` | Same input plus previewDigest, max16384-byte body and original Idempotency-Key; coordinator creation only |
| `GET /ingress-migrations` | Only canonical page/limit and optional exact groupId; default25/max100, page1-10000 |
| `GET /ingress-migrations/:batch` | No query; immutable plan/attempts, action/state/compensatable flags and original Operation views |
| `POST /ingress-migrations/:batch/items/:position/apply` | Closed `{expectedRevision}`, body1024 bytes, canonical position1-8, original Idempotency-Key |
| `POST /ingress-migrations/:batch/items/:position/compensate` | Same CAS/key body; accepted add/update only |
| `POST /ingress-migrations/:batch/cancel` | Closed `{expectedRevision}`, body1024 bytes and original Idempotency-Key |

Mutation/preview and exact batch get reject query parameters. Unknown/duplicate JSON
or list query fields and ambiguous numeric forms are rejected. Creation returns202
`{batchId,revision:1,planDigest,changed:true,reserved:false,executionAuthorized:false}`.
Item commands return202 `{batchId,revision,position,kind,attempt,atomicAcrossForwards:false}`
for either accepted original work or durable sanitized rejection; nested original
receipt retains its own200/no-Operation or202/new-Operation meaning. Cancel returns202
when changed,200 for an accepted already-cancelled no-op at current CAS. Identical
outer-key replay returns saved response, not another owner command. Preview/get label
`impactScope:"selected-origins-not-global-membership"` and `removeCompensation:false`.

## Preview, Persistent Plan And Identity

Original Scope management and owner reference authorization apply. Immediate origin
records are read under shared head lock with checked bounded attempts; original Forward
locks then capture/recheck full revision/spec/digest and nullable exact path/group
selection/sequence state. Source historical attribution does not imply current state.
Invalidated/deleting/stale results cannot silently authorize a new command. Add/update
need active target group/template plus fresh original references. An already planned
remove can still run after group archive because cleanup resolves no new target path.

Preview contains exact source/target definitions, complete diff, resolved lineage
baselines and planned specs/digests plus previewDigest. Confirmed creation recomputes
this plan and compares the digest under current authorization. It persists only
coordinator metadata, no original Forward mutation, identity/resource reservation or
Operation. Add plans have no new Forward IDs; original owner generates them only on
that manual accepted create. Plain definition publication never updates rules.

Eligible historical outcome interpretation is explicit: deployment accepted create
with no successful deletion compensation may provide a source; rejected compensation
does not undo the accepted create. Prior migration accepted add/update may provide an
exact source only while its chosen result remains eligible; accepted update compensation
is a separate exact new restored result. Remove and accepted add-deletion compensation
are deleting outcomes, not live sources. A rejected apply is never an accepted source.
Each command still checks original whole Forward state, including metadata-only changes.

## Durable Commands And Atomicity

Each Scope retains64 migrations including terminal/restored. Sources max8, selected
actions1-8, each one apply and optional compensation (add/update only), at most16
immutable attempts. Head/event revision1-20 and exact formula
`1+attemptCount+Number(cancelled)+Number(recoveryInvalidated)` maximum19. Immutable
plan JSON131072 bytes, outcome32768; physical row/index/log/backup overhead unmeasured.
No purge/history rewrite resets limits.

Only original creator still a current Scope manager can advance/cancel. One explicit
request identifies batch CAS, position and apply/compensate, with original idempotency
key. There is no worker, automatic loop/tail or cross-rule transaction. Head exclusive
lock serializes concurrent actions/cancel. Shared get holds head through attempt
projection; Operation progress remains independent, not a global snapshot.

Outer original idempotency is claimed before SAVEPOINT. Original Forward owner receives
the supplied transaction, not child keys/respond or nested transactions, and owns all
authorization/preparation/Forward history/resources/Operation/capacity/Runtime writes.
Those commit atomically with accepted state, immutable attempt, batch CAS/audit and
outer response for that item only. Independent add/update/remove can partly succeed.

Expected nonretryable allowlisted ControlError403/404/409/422/429 rolls back all original
mutations before sanitized code/status rejection is saved. Shared allowlist includes
REVISION_CONFLICT, AUTHORIZATION_DENIED, GROUP_ARCHIVED, TEMPLATE_ARCHIVED, RESOURCE_LIMIT,
PORT_RESERVED, UNSUPPORTED_CAPABILITY, REVISION_EXHAUSTED, PUBLICATION_STATE_CHANGED,
NOT_FOUND and RESOURCE_CONFLICT. Raw exception messages/SQL/credentials are not persisted.
HTTP202 accepts the durable attempt decision, including business rejection, not runtime
success. Integrity/recovery/retryable/SQL/deadlock/timeout/connection/savepoint/commit
failures escape; never label unknown submission rejected. Only identical outer
command/key/body replay resolves potentially committed HTTP, not a new CAS/key/plan.

Cancel blocks future apply only, not committed Operation, and does not automatically
roll back accepted actions. Eligible explicit compensation may continue after cancel.
Restored invalidated plans cannot execute any command. Discard/disconnect cannot
cancel remote acceptance. No hidden tail is allowed after unknown or partial failure.

## Compensation Limits

Add compensation is original guarded delete of precisely the accepted created Forward.
Update compensation compares entire accepted revision/spec/path/group state, then
freshly authorizes/restores full source spec and original provenance choices through
the original owner. Grants, archive/capability changes, resources or immutable history
limits can deny restoration. A later same-spec provenance sequence change must reject,
even without a new Forward revision. No historical pointer/Snapshot is replayed and
new provenance rows consume original quotas.

Remove is NONCOMPENSATABLE. It accepts original deleting intent; it cannot be undone
by resurrecting rows, IDs or old authorization. Changing ingress by remove+add is not
an atomic swap and removal has no automated undo. Any separate re-creation is a new
explicit command/identity and must not be mislabeled compensation.

Accepted delete result uses deleting:true and original new revision/Operation, not
completed cleanup. Actual source restoration uses new revision/Operation; metadata-only
update restoration can retain revision/no Operation. Runtime owns drain/fence/lease,
cleanup/supersession and interruption/TCP/UDP limits. No zero-loss or cross-ingress
availability guarantee is added.

## Reads, Backup And Recovery

Scoped list may filter exact groupId. Get returns immutable plan/attempts and derived
item states plus at most16 distinct scoped exact Operations from accepted receipts,
with original forwardId/targetRevision mapping, status/cleanupPending/recoveryInvalidated.
These are progress facts, not health/current membership/fresh permissions. Persisted
source labels remain non-reserving/non-executable, health unknown, no physical sharing,
automatic execution or cross-Forward atomicity; history is not deletion-safety proof.

Schema0028 adds ingress_migrations, ingress_migration_attempts and ingress_migration_events.
Head exact source/target ingress group revisions are foreign-keyed under one group ID.
Control-only adp3-ingress-migrations-v1 ceiling0028/catalog28 rejects old Control even
unused. Agent protocol/Journal/Profile/flags unchanged. Partial DDL footprints require
manual review, never automatic rebuild/retry or fabricated migration history.

Full SQL backup retains the three tables and original lineage families, definitions,
Forward/PathBinding/Operation/request histories. Same existing recovery quarantine
transaction writes one recovery event and advances/invalidates each not-yet-invalidated
head; leaves definitions/diff/lineage/attempts/receipts/cancel/audit intact. Pending
derives suspended; no restore-time reconciliation, apply/cancel/compensate or auto-resume.
Original identity/Grant/request/Forward/Operation quarantine and independent Authority/
Journal/high-water remain protected. Maintenance, historical authorization exhaustion,
fresh trust and human recovery review remain unchanged.

## Evidence

Source/document edits and necessary reads only. No tests/new fixtures, static/syntax/
type/contract/boundary checks, formatting/generators, network/browser/Compose/CI,
migration execution, commit/push. New behavior and final-source acceptance remain
unverified; this is not C2 acceptance completion or C3/production readiness.
