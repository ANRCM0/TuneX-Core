# ADR-0023: Immutable Native PathTemplate Metadata Before Rule Bindings

Date: 2026-10-17. Status: accepted for this first C1 implementation slice;
functional acceptance remains pending for its exact commit.

## Context

C1 in the [platform plan](../development/forwarding-platform-plan.md) requires
saved paths, immutable references, impact preview and explicit manual switching.
The existing Core ForwardSpec, Forward owner acceptance and single Runtime
already own executable intent, resource fences, Operations and cleanup. A saved
path must not become another execution authority or implicitly rewrite rules.

This slice implements real metadata commands, persistence, reads and Console
authoring. It does not implement rule bindings, reference impact or switching.
Those remaining C1 capabilities must not be inferred from an accepted template.
The later [ADR-0024](0024-original-owner-path-bindings.md) implements their
separate original-Forward integration; this ADR preserves the first metadata slice.

## Decision

### Ownership and Configuration

Control's PathTemplate application service owns three metadata tables and a
supplied-transaction reader/writer port. Identifiers are case-sensitive and
Scope-local. Each immutable revision contains version 1, one or both business
protocols, two to eight distinct ordered Nodes (ingress first, egress last),
each downstream Node's exact Endpoint revision in the same order, and an exact
Transport Profile ID/revision. No `latest` alias, target, listener, enabled flag,
credential, executable plan or Runtime object is stored in this configuration.

Requirements are computed from the fixed native path: ADP/3, native Relay and
wire 1; paths longer than two Nodes also require execution/multi-hop wire 1;
every Node declares the selected business protocols. This describes capability
requirements, not online readiness or a verified physical transport.

Publication calls original Node authorization, Transport resolution and Endpoint
resolution ports in the same transaction. Every Node requires an explicit grant,
including for a Scope Owner, and a currently valid machine authorization. Profile
resolution checks its original explicit grant, immutable revision and digest.
Current Endpoint revisions must match the pinned proposal. A shared Profile or
Endpoint row is not permission to share a physical listener or resource.

Metadata can be authored with Control multi-hop execution disabled when the
Nodes declare the required capabilities. This cannot enable execution or bypass
the original Forward plan/acceptance gate. No target/egress policy, port budget,
TLS peer readiness, network reachability or runtime capacity is proved here.

### Acceptance, Bounds and Archival

Scope managers publish/archive; Scope members can read. Same-transaction scope
authorization precedes the existing Idempotency owner. New commands lock the
Scope quota and template head, check explicit CAS, resolve references, append a
revision/audit event and save the acceptance atomically. A normalized content
digest covers `{config,profileDigest}`. Unchanged publication rechecks current
references but creates no revision or event. Failures roll back the command,
claim, metadata and audit together. No other owner is mutated.

Limits are 128 identifiers per Scope including archived identifiers, and 64
immutable revisions per identifier. Quotas serialize across concurrent creates;
these are permanent v1 storage bounds, not an automatic cleanup service.
Archival is terminal and preserves all revisions and events; it never reuses an
ID. It requires current CAS but not continuing Node/Profile access, allowing a
manager to retire metadata after a grant is revoked. Repeated archival is a
no-op. Archive does not create another config revision or revoke a running rule.

Same-key/body replay returns the original metadata acceptance after current
Scope management authorization. It is not fresh reference authorization and
can legitimately describe a publication preceding later archival. Restored keys
remain quarantined by the existing recovery policy. Replay never updates a
Forward, publishes a Snapshot or renews a lease.

Reads use the supplied transaction and bounded canonical pagination, not a new
pool or a background resolver. They verify persisted configuration/digests but
do not recheck Node/Profile grants. Responses explicitly mark reference
authorization unchecked, execution unauthorized, no reservation and no binding.
Revocation does not rewrite historical revisions or erase their audit trail.

### Console and Uncertain Results

The original Relay view gains structured metadata authoring, explicit sequential
Endpoint capture (at most seven reads), exact revision inspection, bounded
listing and terminal archive. Editing invalidates captured locks; newer reads,
scope changes and disconnect suppress late responses. History inspection uses
the current head as the mutation CAS, never a historical revision as current.

Mutation confirmation explains metadata-only semantics. A potentially committed
request freezes its key and body in tab memory. It has no automatic retry or
replacement; only explicit identical replay is allowed, and denial of replay
does not prove that the original was uncommitted. Discard clears local memory,
not remote state. Nothing persists in browser storage or adds a service worker.

### Upgrade, Recovery and Remaining C1

Migration 0018 adds `path_templates`, `path_template_revisions` and
`path_template_events`. Control-only profile `adp3-path-templates-v1` reads through
0018; old Control readers and Agents declaring that new profile are rejected.
Core, machine schemas, Agent binary behavior, Runtime/Transit Journals and
Authority formats do not change. Partial DDL requires operator review, not
automatic drop/recreate or migration-history deletion.

Existing full SQL backup preserves all three tables, archival flags and immutable
history. Recovery retains metadata as non-executable history and quarantines old
idempotency keys; original identity/grant/intent isolation remains authoritative.
No metadata is converted into a fresh grant, binding or executable intent during
restore. Original Authority and Journals must still be preserved independently.

Future C1 bindings must be application metadata outside Core ForwardSpec, pin an
exact template revision/digest and store the actual expanded spec. Template
expansion, current grants/Endpoint checks and original Forward CAS/idempotency/
resource acceptance must share one transaction. There must not be a template
write followed by an unrelated Forward write presented as atomic. Existing
expanded rules are not implicitly updated or revoked by template changes/archive;
new bindings must reject archived templates. Future preview is bounded and
non-reserving; manual switch re-enters the original replace/Runtime lifecycle,
with honest interruption/drain/rollback constraints. This slice introduces no
empty binding API or placeholder alternate executor.

## Verification and Consequences

Port regressions, real MySQL/API concurrent CAS/quota and SELECT-only history,
Console controller regressions and the existing 3/4/8-Agent Chromium fixture
are authored and wired to Actions. The browser deliberately loses an already
committed reply, replays the same command, creates a no-op and second immutable
revision, and archives while preserving history. Original source revision/spec,
resources and real TCP/UDP are checked separately after metadata authoring.

Local verification is syntax/types/contracts/boundaries/docs only. No exact-SHA
functional result, physical-host proof, complete C1, automatic routing, physical
tunnel pooling, production enablement or project completion is claimed.
