# ADR-0024: Exact Path Bindings Through Original Forward Acceptance

Date: 2026-10-17. Status: accepted for implementation; exact-commit functional
acceptance remains pending.

## Context and Decision

[ADR-0023](0023-immutable-native-path-metadata.md) supplied immutable saved paths.
C1 now needs a real connection to executable rules. Template metadata remains
outside Core. The existing Forward owner and single Runtime retain all intent,
Operation, authorization, resource, Fence, generation, drain and cleanup duties.

The application `PathBindings<Tx>` supplies exact expansion and provenance ports
to `ForwardCommands<Tx>`. `PUT /forwards/:id/path-binding` requires the current
Forward CAS plus an explicit template ID, immutable revision and config digest.
There is no latest alias. It locks the original Forward, locks the template head
against archive, validates saved integrity and current original Node grants,
Profile grant/digest and Endpoint revisions, and expands the concrete spec.
Scope managers use the existing idempotency owner before those mutations.

The command then calls the same private update acceptance used by ordinary
Forward replacement: pure domain decision, original execution preparation,
Forward revision/history, authorizer, original Relay plan/resources, Operation,
capacity and response. Binding provenance and the acceptance response commit in
that same transaction. A failed binding quota/write rolls back the entire
Forward/Operation/resource change and claimed key. No nested transaction or
post-acceptance binding write can leave the two owners partially committed.
Original bounded MySQL deadlock retry remains in effect with identical inputs.

## Expansion, Provenance and Lifecycle

The first version requires the existing ingress Node and exact business protocol
set. It replaces only the ordered downstream path and locked Transport Profile;
target, physical listener, enabled intent and remaining spec stay unchanged.
The actual expanded ForwardSpec is stored by the original Forward owner and in
immutable provenance with its spec digest, template selection, actor, timestamp,
Forward revision and per-Forward sequence. Endpoint locks are checked at
acceptance, not introduced as a new ongoing authority in Core or Runtime.

An equivalent expanded spec can attach/change provenance with 200 and
`operationId:null`, without a Forward revision or deployment generation. A
changed spec uses the original 202/Operation lifecycle. Exact repeated binding
with a new key is a no-op after fresh reference/original preparation checks.
An identical same-key replay requires current scope management and returns the
original receipt without re-expanding, refreshing a plan or granting execution.

Migration 0019 creates immutable `forward_path_bindings` and a separate
`current_path_bindings` pointer. There are at most 64 retained records per
Forward, including detached history. There is no compaction, ID reuse, cascading
history deletion or automatic cleanup. At the ceiling, an exact no-op is still
available; a new binding is 429. Ordinary disable/delete do not consume the
binding quota. Ordinary updates preserving topology retain provenance; changing
ingress, business protocols, path or Profile detaches the current pointer in
the original transaction and retains all historical records. Changes to target,
listener or enabled intent do not pretend that old expanded snapshots are current
full specs: provenance always exposes its own original `forwardRevision`.

Template publication/archive does not rewrite a binding or running rule. New
bindings to archived templates are rejected; current/historical provenance stays
readable. Recovery-suspended or deleting Forward intents reject path proposals
and new path commands. Existing disable/delete/recovery owners retain their
original rules; path binding does not provide a recovery shortcut.

## Preview and Console

`POST /forwards/:id/path-preview` is a non-reserving proposal with exact CAS and
selection, original reference validation, and concrete old/proposed specs.
Scope-authorized `GET /path-templates/:id/references` lists only current desired
bindings, including disabled/recovery-suspended rows and excluding deleting
rules. It supports bounded canonical page/limit and exact source/target revision
filters. Target impact requires management and fresh reference checks when the
template is active. Archived/suspended/incompatible rows cannot become proposals.
These READ COMMITTED pages are not a global snapshot, full history, full runtime
authorization, network test or reservation.

Console explicitly inspects an exact target, reads current CAS/provenance,
prepares a proposal and asks for one-rule consent. Apply performs a fresh original
Relay plan, then the independently authorized same-transaction path command.
No plan grants future authority. An unknown preflight sends no path command and
requires renewed preparation/consent. A potentially committed path command keeps
its original key/body only in tab memory for explicit identical replay, without
a replacement plan/CAS/key. A replay denial remains uncertain. Edits/disconnect
invalidate late reads, discard cannot cancel remote work, and no hidden batch,
background retry, automatic publication or rollback is added.

This is an original Forward replace, with possible same-listener interruption,
bounded TCP drain and UDP association reset/loss. A manual return to an old
template is a new authorized Forward revision/Operation/generation, not an old
Snapshot replay. No cross-host atomicity, session migration, zero downtime,
physical pooling, automatic failover or production enablement is claimed.

## Upgrade, Recovery and Acceptance

Control-only profile `adp3-path-bindings-v1` has schema ceiling 0019. Older Control
profiles cannot read this schema; Agent profiles, Core, machine contracts and
authenticated Journal/high-water do not change. Full SQL backups retain both
new tables, immutable templates, Forward history and existing audits. Existing
recovery quarantines old request keys, identities/grants and restored intents;
it retains provenance as history without materializing fresh authority or
automatically applying a saved path. Partial DDL requires operator review.

Port, Console and real MySQL regressions are authored and wired to Actions. The
existing real 3/4/8-Agent Chromium fixture additionally attaches an unchanged
path without deployment, publishes a shorter path without automatic application,
explicitly switches the copy, loses an already-committed response, replays the
same key/body, verifies real TCP/UDP, explicitly restores the original path and
archives without changing its expanded rule. Source intent/resources are checked
independently. Local validation is static only; no exact-SHA acceptance, physical
host proof, measured interruption bound, C1 acceptance or project completion is
claimed. The bounded multi-rule follow-up is implemented separately in
[ADR-0025](0025-explicit-path-batches.md), still awaiting exact-SHA acceptance.
