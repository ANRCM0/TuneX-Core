# Native Path Bindings and Explicit Single-rule Switching v1

Status (2026-10-17): implemented, tests and real Actions scenarios authored/wired;
not functionally verified for the exact commit. Decision:
[ADR-0024](../decisions/0024-original-owner-path-bindings.md).

## Exact Selection and API

All routes are under `/api/v1/scopes/:scope`, Bearer authenticated and no-store.
This selection is closed, detached and immutable before a transaction:

```json
{
  "expectedRevision": 4,
  "template": {
    "templateId": "saved-path",
    "revision": 2,
    "configDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

CAS is a positive safe Forward revision; template revision is 1-64, with exact
case-sensitive ID and SHA256/JCS digest from the immutable template read. There
is no latest, caller-provided expanded spec, Node/Endpoint override or bulk API.
Mutation/proposal bodies are limited to 1 KiB, reject duplicate/unknown JSON
fields and query parameters. `PUT` requires the original `Idempotency-Key`.

| Method / path | Behavior |
| --- | --- |
| `GET /forwards/:id/path-binding` | Current desired CAS, deleting/suspended flags, current binding or null, and at most 64 retained immutable history records; no query parameters |
| `POST /forwards/:id/path-preview` | Closed exact selection/CAS above; concrete current/proposed spec after reference checks, no write or reservation |
| `PUT /forwards/:id/path-binding` | Same body; original Forward update acceptance and binding provenance share one transaction |
| `GET /path-templates/:id/references` | Current desired bindings; canonical page/limit, optional exact `revision` and `targetRevision` only |

Scope members may read plain provenance/references. Proposals, target impact and
commands require current scope management. Original explicit Node/Profile grants
are not implied by Scope ownership. Missing membership remains opaque 404;
current viewers cannot issue proposals or commands (403). Unknown/duplicate
query keys and ambiguous numeric forms are rejected. Limits use the original
Console bounds: page 1-10000, default limit 25, maximum 100.

## Transaction and Result

New commands lock the current original Forward and reject stale CAS,
recovery-suspended or deleting intent. The exact template head is locked against
archive; immutable config/digests are checked, then original current Node grants,
credentials/capabilities, Profile grant/exact digest and Endpoint revisions are
revalidated. Protocols and ingress Node must match. Expansion replaces only
`path.via` and `transport`; target/listener/enabled remain the original intent.

The original Forward domain decision/preparation, actual expanded spec/history,
authorizer, Relay resource/plan, Operation/capacity, binding record and original
idempotency response share the same transaction. No second executor or nested
acceptance transaction exists. Failure rolls all owners back, including keys and
resources. An identical replay returns its original status/body after current
scope management without re-resolving or redeploying. It is not fresh authority.

Response is the existing `{forwardId,revision,operationId}` plus:

```json
{
  "pathBinding": {
    "templateId": "saved-path",
    "revision": 2,
    "configDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "sequence": 3,
    "forwardRevision": 5,
    "changed": true
  }
}
```

Changed expanded spec returns 202 with the original Operation and new Forward
revision. Equivalent expanded spec returns 200/`operationId:null`; a new
provenance selection can be recorded without restarting the unchanged rule.
Exact same binding with a new key is a no-op (`changed:false`) after fresh checks.
Metadata-only attachments serialize on the original Forward row but do not
increment its CAS. Concurrent equivalent-spec provenance selections can therefore
both be accepted in sequence; the last accepted record becomes the pointer.
There is no separate caller-supplied provenance CAS in v1.
Its `forwardRevision` may precede current CAS because later target/listener/enable
edits preserve the same path provenance. Binding history stores the actual spec
and spec digest **at that binding's acceptance**, actor and ISO time, and labels
the current pointer. History is not a current runtime plan or permission.

Each Forward retains at most 64 immutable binding records permanently; detached
records count. New bindings at the ceiling return 429 and roll back execution
acceptance. No-op and ordinary disable/delete remain possible. Ordinary topology
or Profile edits detach the current pointer atomically; history remains. Ordinary
target/listener/enable edits retain the path binding without rewriting its saved
expanded spec. No historical Snapshot or binding record is executed directly.

Archive blocks all new binding commands, including new-key no-ops, while keeping
existing expanded rules/history. Same-key replay can describe a pre-archive
acceptance. Publishing a template revision does not change existing rules.
The metadata APIs remain non-executable even when a separate binding exists.

## Read and Preview Labels

Provenance/history requires Scope access and stored integrity, without rechecking
historical Node/Profile grants. Plain reference lists include disabled and
recovery-suspended rules, exclude deleting rules, and count current pointers only.
They do not prove deletion safety or list every historical use. Exact source
revision filters only those current pointers.

Target impact resolves the exact immutable target and validates original
references while active. An archived template produces unavailable impact rows;
suspended or incompatible rules cannot produce applicable proposals. Rows expose
current `expectedRevision`, current binding, spec/proposedSpec, changed and a
machine reason when unavailable. Select a row, then prepare/confirm separately.

Reads explicitly identify `source:"persisted-control-state"`, `reserved:false`,
`executionAuthorized:false`, `fullPlanAuthorization:false`. History additionally
states `referenceAuthorization:"not-rechecked-by-this-query"`. Reference pages
state `consistency:"read-committed-page-not-global-snapshot"`; concurrent changes
can invalidate a page/proposal. They have no authorization/reservation lifetime.
Provenance/history also labels its READ COMMITTED view, rather than promising an
atomic snapshot across independently read current state and history.
The proposal adds `previewOnly:true` and explicit interruption/TCP/UDP limits.

## Console, Uncertainty and Switching Limits

The separate path panel uses explicit template ID/revision inspection, current
provenance/CAS reading, proposal preparation, and one-rule apply consent. Apply
does a fresh original `/relay-plan` for the frozen expanded spec and exact
Profile digest, then sends `/path-binding` with its independently checked CAS.
No hidden editor changes, latest lookup, automatic template publication, durable
batch, cross-rule atomicity or automatic compensation is provided.

Unknown/malformed preflight means no path command was sent. Renew preparation
and consent to check again. If a sent path command might have committed, fields
lock with its original key/body in tab memory. Explicit identical replay sends
only the original PUT, without a new plan, replacement key/revision/CAS or
automatic tail. A replay denial cannot prove the original was uncommitted and
does not clear uncertainty. Discard/disconnect aborts local work and drops memory;
it cannot cancel a remote acceptance. Late responses cannot resume another scope.
No browser persistence, background switch or automatic retry is added.

The original Runtime owns all deployment/drain/fence behavior. Replacing a
physical same-listener path can interrupt traffic; TCP old connections obey
bounded drain and original authorization expiry, UDP associations may reset and
lose datagrams. Return to an old template is a newly authorized CAS update with
new revision/Operation/generation, never old Snapshot replay. No zero-downtime,
cross-host atomic or session-migration claim is made. Ingress Node/protocol-set
changes must use their separately authorized original workflows.

## Storage, Recovery and Acceptance

Migration 0019 adds only immutable `forward_path_bindings` and
`current_path_bindings`. Control profile `adp3-path-bindings-v1` reads through
0019; older Control profiles are rejected. Agent profiles, Core, machine protocol
and authenticated Journal/high-water do not change. Full SQL backup preserves
both tables, template history and original Forward history. Existing recovery
isolates old keys, credentials/grants and restored intents; retained provenance
cannot renew authority, bypass recovery suspension or auto-apply a path. Partial
DDL requires review; no cleanup/rewind/Journal reset workaround is supplied.

Actions is wired for `path-binding-ports.test.ts`,
`path-binding-mysql-acceptance.test.ts`, `path-switch-flow.test.mjs`, upgrade
compatibility/partial-DDL regressions, and the existing
[real multi-hop Chromium fixture](../testing/native-multihop-console.md).
That fixture attaches without a deployment, publishes without implicit apply,
switches an enabled copy to two Nodes, loses an already-committed reply and
replays identically, checks real TCP/UDP, explicitly returns to its 3/4/8-Node
path, and archives without revoking the expanded rule. Source rule remains
independent and cleanup still uses original CAS/Operations.

All new functional scenarios are authored, not executed locally or exact-SHA
acceptance. Single-host Agent processes do not prove physical-host/public NAT,
long-run or measured interruption bounds. Multi-rule explicit path publication
is now authored through the [bounded original queue](path-publication-v1.md),
still pending exact-SHA functional acceptance. C1 acceptance and whole-project
delivery remain open.
