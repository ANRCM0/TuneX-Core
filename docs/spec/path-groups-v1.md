# Bounded Native Path Groups v1 (C2-A)

Status: 2026-10-18 (Asia/Shanghai), source implementation locally unverified.
Decision: [ADR-0032](../decisions/0032-bounded-path-groups.md). This is the first C2
slice, not completion of C2. Ingress multi-rule groups, durable saga/cancellation/
conditional compensation and C3 automatic policy are deferred.

## Group Definition

An immutable Scope-owned definition uses `schemaVersion:1`, `kind` exactly
`egress-candidates` or `backup-paths`, and an ordered `candidates` array of one to
eight entries. Each entry contains a unique `candidateId` and a complete pinned
original `template:{templateId,revision,configDigest}`. Objects are closed, IDs are
case-sensitive original native IDs, revisions are 1-64 and digests are exact
`sha256:` plus 64 lowercase hexadecimal digits. Duplicate complete-path digests
are rejected. No caller-supplied expanded spec, inline node override, partial
branch, latest selector or inferred fallback is accepted.

```json
{
  "schemaVersion": 1,
  "kind": "backup-paths",
  "candidates": [
    {
      "candidateId": "primary",
      "template": {
        "templateId": "complete-primary",
        "revision": 1,
        "configDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    }
  ]
}
```

Every candidate is a full existing path template with the same ingress Node and
protocol set as the other candidates. `egress-candidates` additionally requires
distinct terminal Nodes. Original reference/grant/Profile/Endpoint checks apply;
Scope management is not a substitute for explicit Node/Profile grants. Group
publication validates references but creates no Forward, Operation, resource
reservation, execution permission or shared physical connection. Candidate ordering
does not start a scheduler or cause automatic failover. A group revision's
`configDigest` pins its entire ordered definition, independently of template digests.

Authoring locks Scope before the group head. Publish uses current-head CAS and
append-only revision/audit records; archive is terminal metadata. Limits are 64
groups/Scope including archived groups, 64 revisions/group and eight candidates per
revision. Publishing a revision does not update old groups or expanded Forwards.

## Explicit Original-owner Application

### API Surface

All routes are under `/api/v1/scopes/:scope`, use original Bearer/Scope access
and no-store responses. Read routes need Scope access; publication, archive,
preview and application require Scope management. The original Node/Profile
reference grants are independently rechecked where applicable.

| Method / path | Body or query |
| --- | --- |
| `GET /path-groups` | Only canonical `page`, `limit`, optional `prefix`; returns bounded heads including archived groups |
| `GET /path-groups/:group` | Optional exact `revision`; defaults to current head and returns pinned ordered complete topology |
| `PUT /path-groups/:group` | Closed `{expectedRevision,config}`, max 8192-byte body, original `Idempotency-Key`; creation uses CAS 0 |
| `DELETE /path-groups/:group` | Closed positive `{expectedRevision}`, max 1024-byte body, original `Idempotency-Key`; terminal archive |
| `GET /path-groups/:group/references` | Only canonical `page`, `limit`, optional exact `revision`; `targetRevision` is rejected, no bulk target expansion |
| `GET /forwards/:id/path-group-binding` | No query; current original Forward CAS/flags, current group pointer or null, retained history |
| `POST /forwards/:id/path-group-preview` | Closed `{expectedRevision,group}`, max 1024-byte body; original path preview plus exact group/candidate and priority |
| `PUT /forwards/:id/path-group-binding` | Same closed body plus original `Idempotency-Key`; original single-Forward command acceptance |

Mutation/preview routes reject query parameters. Unknown/duplicate query keys,
duplicate JSON keys and unknown body keys are rejected. Numeric query selectors
must use their canonical integer form; JSON body numbers use the original safe-integer rules.
Paging uses original Console bounds: page 1-10000, default limit 25, maximum 100.
Exact revision selectors are 1-64. Definition writes return
`{groupId,revision,configDigest,archived,changed}` with 202 when changed, 200 for
unchanged accepted metadata. No new revision is published for an identical config.
Archived identifiers cannot be reused. Definition no-ops still check current
reference authorization; original identical-key replay returns its saved receipt.

An application body has this exact shape:

```json
{
  "expectedRevision": 4,
  "group": {
    "groupId": "saved-group",
    "revision": 2,
    "configDigest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "candidateId": "primary"
  }
}
```

The original `{forwardId,revision,operationId}` acceptance response also contains
`pathBinding` and `pathGroupBinding`. The latter includes exact group selection,
`sequence`, `pathBindingSequence`, `forwardRevision` and `changed`; it does not
describe completed Runtime deployment. Group reads expose topology `operator:"OR"`
with ordered complete branches marked `operator:"AND"`, their required Nodes and
`health:"unknown"`; these are structural labels, not evaluated health.

An application selection is the exact closed
`{groupId,revision,configDigest,candidateId}` plus the original Forward
`expectedRevision`; it chooses one complete candidate, never an entire bundle of
new Forwards. The original Forward command remains the sole mutation owner and
requires its normal idempotency key. Current Scope management and original reference
authorization are checked; deleting or recovery-suspended Forwards are rejected.
Group head/archive/config/candidate checks resolve to the original exact PathSelection.
Expansion and Relay preparation retain the existing target/listener/enabled intent.

Original Forward CAS/history, reference authorization, preparation/Relay resources,
Operation/capacity, Runtime acceptance, original PathBinding, group provenance and
the original idempotent receipt commit together. Any failure rolls the transaction
back; no independent connection, executor, new Core/ADP group ID or reservation
authority exists. A changed expanded spec uses the original new Forward revision
and Operation. An equivalent spec may attach provenance with no new Forward revision
and `operationId:null`. Metadata-only attachments serialize on the original Forward
row; there is no caller-supplied provenance CAS, so later accepted attachments win
the current pointer. Forward CAS alone does not exclude another equivalent-spec
metadata attachment.

Immutable group binding records contain exact group selection, `sequence`,
`pathBindingSequence`, `forwardRevision`, accepted `expandedSpec`, `specDigest`,
`actorId` and `createdAt`. The path sequence references the original immutable
PathBinding accepted or reused by that transaction. Historical group reads load that
exact original row and compare its selection, spec/digest and topology; a foreign
key alone is not treated as proof of matching provenance. Saved spec/revision describe the binding
acceptance, not a later target/listener/enabled edit or live Runtime plan. Each
Forward retains at most 64 group binding records, including detached history,
separately from the original path binding limit. Hitting either required bound
rejects and rolls back acceptance rather than deleting history or bypassing Runtime.

An ordinary explicit applyPath detaches current group provenance even for an
equivalent expanded spec. Ordinary topology/Profile changes detach the group and
path pointers atomically; ordinary target/listener/enabled changes preserve them.
Detachment never rewrites saved history. Same-spec/no-op handling does not create
an artificial Forward revision merely to advance provenance.

Archive blocks new group applications, including new-key no-ops, while preserving
existing traffic and immutable provenance. An already accepted identical-key replay
returns the original receipt after current command access checks; it does not resolve
the group again, create a new binding or grant fresh execution permission. Neither
group publication nor template publication automatically updates existing Forwards.

## Read And Preview Meaning

Scope access protects metadata, current provenance/history and reference pages.
Reference pages count current group pointers on non-deleting original Forwards,
including disabled/recovery-suspended intent; optional exact source revision and
bounded pagination do not enumerate every historical use or prove deletion safety.
History is bounded to 64 records and remains queryable after pointer detachment.
Readers use the caller's transaction and original Forward mapping, not a separate
connection or an executable projection.

Preview is an original path preview for the explicitly selected candidate. It is
read-only, non-reserving and non-executable; subsequent command authorization,
CAS and original Relay checks still apply. Current/read-committed metadata is not
a global snapshot, freshness guarantee or full-plan authorization. Persisted source
and history labels must not be interpreted as current execution or proof of health.
Read labels include `source:"persisted-control-state"`, `reserved:false`,
`executionAuthorized:false`, `fullPlanAuthorization:false`, `automaticSelection:false`
and `health:"unknown"`. Provenance/reference reads additionally label historical
reference authorization as not rechecked and their read-committed consistency;
they do not independently promise a fresh Node/Profile permission window.

Group health is currently unknown, not the OR of isolated Node observations. A
future group aggregate must OR complete usable branches and AND all required Nodes
within each branch, preserving unknown observations and original plan requirements.
No automatic health selector, fallback, failure-rate policy or latest following is
implemented. Selection acceptance is not deployment completion; original Runtime
retains drain/fence/lease behavior, potential interruption, TCP reconnection and UDP
loss/duplication limits. No zero-loss or connection-migration guarantee is added.

## Console

The existing tunnel-management view adds explicit group list/get, ordered candidate
editing, metadata publication/archive, current-reference pages and Forward group
binding/history reads. Reads are manual, bounded and non-polling; references use 25
rows per page with an optional exact source revision. Loading one reference copies
only its Forward ID/CAS while retaining the explicitly selected candidate; it does
not prepare or submit a proposal. Disabled/recovery-suspended state is shown and
suspended or archived references cannot be loaded for application. Reference pages
are not global snapshots, full-history searches or deletion proofs.

The operator must inspect an exact group and explicitly choose one candidate; the
first candidate is never preselected. Preparing reads that candidate's immutable
template/config/Profile digest and requests the group preview. After explicit
confirmation, the original Relay plan is checked before the original Forward group
binding request. Receipts retain both path/group provenance. A lost or malformed
write response preserves the frozen key/body; explicit replay sends only that
original command without fresh preview, selection or CAS. A replayed refusal does
not establish that the original command was uncommitted. Unknown preflight results
do not send a Forward mutation and require a fresh explicit preparation.

Reads and writes have a five-second local deadline and stale-result epochs. Input,
filter, page, clear and disconnect transitions invalidate stale results/actions;
an unresolved write blocks new local commands and reads. Clearing local pending
information does not cancel or roll back a remote submission. No storage-backed
queue, persistent saga, automatic refresh, retry or rollback is added.

## Storage, Recovery And Evidence

Schema 0025 owns `path_groups`, `path_group_revisions`, `path_group_events`,
`forward_path_group_bindings` and `current_forward_path_group_bindings`. Definition
JSON is at most 8192 bytes and accepted expanded-spec JSON at most 65536 bytes;
row/index/log/backup overhead is separate. No physical-capacity measurement is
claimed. New binding rows reference exact group and Forward revisions plus the
original path binding sequence. Only head/archive and current-pointer state move;
revision, audit and binding histories are not rewritten.

Control-only `adp3-path-groups-v1` has Schema ceiling 0025. Agent protocol, Journal,
runtime/multihop profiles and flags are unchanged. Older Control ceilings reject
applied 0025 even with no group usage. All five DDL footprints are compared with
migration history; partial DDL requires manual review, not fabricated history or
automatic rebuild. See [upgrade/recovery](../operations/upgrade-assessment.md).

Full SQL backup retains all five tables with original templates/path bindings,
Forward revisions and audits. Existing recovery preserves definitions/history/current
pointers, quarantines credentials/Grants/request keys and suspends original Forwards.
Restore does not choose/apply candidates, create Operations, clear suspension or
renew execution permission. Authority/Journal/high-water, maintenance and fresh-trust
review remain unchanged. New group metadata is not a separate recovery format.

This slice performs source edits and necessary reads only. No tests, fixtures,
generators, formatting, syntax/types/contracts/boundary/static checks, migration,
browser/Compose, network/CI, commit or push are authored or executed. All new
behavior, locking/replay, quota, compatibility and recovery remain locally unverified.
