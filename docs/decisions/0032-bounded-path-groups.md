# ADR-0032: Bounded Path Groups Through Original Forward Acceptance

Date: 2026-10-18 (Asia/Shanghai). Status: C2-A implemented locally, unverified.

## Decision

Implement the first C2 slice as native Scope metadata for `egress-candidates` and
`backup-paths`. Each immutable group revision contains one to eight ordered complete
paths pinned by original template ID, revision and config digest, with explicit
candidate IDs. Candidates share ingress and protocol set; egress candidates have
distinct terminal Nodes. Ordering is recorded preference, not an automatic scheduler.
There are no partial branch fragments, implicit latest references or new Core path
semantics. The [contract](../spec/path-groups-v1.md) records the source-level surface.

Retain the original Forward owner. One explicit group/candidate selection resolves
to an original PathSelection; the original Forward command owns authorization,
CAS, preparation, Relay resources/plan, Operation, capacity and Runtime acceptance.
It saves original path provenance and the group provenance in the same transaction
as the original idempotent response. The new store never mutates executable business
tables, opens its own connection or runs a second executor. Publishing group metadata
is not application, reservation, deployment or execution authorization.

The group provenance pins group ID/revision/config digest/candidate ID, original
path binding sequence, accepted Forward revision and expanded spec/digest, actor and
time. It is immutable. A current pointer can move or detach, but history is never
rewritten. Equivalent-spec application can attach provenance without a new Forward
revision or Operation. Original Forward locking serializes those attachments; there
is no separate provenance CAS and the last accepted pointer wins. Exact replay
returns the original response rather than reselecting or redeploying.

Explicit ordinary applyPath relinquishes group provenance even if the resulting
spec is identical. Ordinary topology/Profile changes detach, while target/listener/
enabled changes preserve the accepted path/group provenance without rewriting its
saved spec. Group archive prevents new applications, including new-key no-ops, but
does not stop expanded traffic or invalidate an already accepted same-key response.
New group/template revisions never automatically follow into existing Forwards.

## Bounds And Locks

Migration 0025 adds only `path_groups`, `path_group_revisions`, `path_group_events`,
`forward_path_group_bindings`, `current_forward_path_group_bindings`. Group authoring
locks Scope before the group head and advances immutable revisions with head CAS.
Per Scope: 64 groups including archives. Per group: 64 immutable revisions and one
to eight ordered candidates/revision. Per Forward: 64 immutable group binding records,
including detached history, independently of its original 64 path bindings. No
automatic history deletion or quota-reset operation is added. References are scoped
and bounded, show original Forward state and count current pointers rather than
all historical use; they are not a deletion-safety or fresh authorization proof.

## Compatibility And Recovery

Control-only `adp3-path-groups-v1` has Schema ceiling 0025 and a deliberately reviewed
25-file catalog. Older ceilings reject applied 0025 even when groups are unused.
Agent protocol/Journal/Profile and runtime flags are unchanged. Partial DDL footprints
require manual review, not automatic retry, fabricated migration records or rollback.

Full SQL backup preserves definitions, revisions, archive/audit facts, immutable
original/group binding histories, current pointers and Forward revisions together.
Existing recovery quarantines identities/Grants/keys and suspends Forwards; it does
not choose a candidate, reapply metadata, create an Operation or restore permission.
Authority/Journal/fence/generation high-water and existing maintenance/new-trust review
remain protected. Group metadata is historical provenance, not a recovery executor.

## Deferred And Evidence

No group health is derived in this slice. A future aggregate would require OR across
complete candidate branches and AND across each branch's required Nodes, with unknown
observations kept unknown; individual observations are not full-plan authorization.
No automatic failover, latest following or health-based policy is introduced.
Ingress groups spanning multiple Forwards, durable multi-rule saga/cancellation and
conditional compensation remain later C2 slices; C3 policy is also deferred. The
existing tab-local publication queue is not relabeled as a durable saga.

Only source/document edits and necessary source reads were performed. No tests,
fixtures, checks, generators, formatting, network/CI, migration execution, commit or
push were authored or run in this slice. Behavior and compatibility are locally
unverified. This records C2-A, not completion of C2 or a production-readiness claim.
