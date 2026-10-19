# ADR-0026: Logical Tunnel Management Through Existing Owners

Date: 2026-10-18 (Asia/Shanghai). Status: accepted for incremental implementation.
The first implementation is unverified; testing and fixes follow source freeze.

## Decision

The accepted [tunnel/forward management framework](../architecture/project-framework-and-boundaries.md)
starts with a native logical-tunnel business view. `NativeTunnels<Tx>` composes
existing PathTemplate queries/commands, PathBindings and the original Forward
command. It does not own a new database table, transaction, runtime resource,
deployment, health result or execution ledger.

One logical Tunnel ID is exactly one existing same-Scope PathTemplate ID. Both
API names share the same immutable revisions, digests, archive flag, quotas,
grants, audit records and retained history. No migration or data duplication is
required. The new name does not make the old identifier reusable after archival.

The business API adds `/scopes/{scope}/tunnels` and explicit Forward
`tunnel-preview`/`tunnel-binding` names while keeping the old endpoints.
Requests and durable receipts keep the original closed fields, including
`templateId`, `template` and `pathBinding`; the old names remain the canonical
request-digest identity. A same-key/same-body request through either name is
the same command, not a second publication or a second Forward acceptance.

Reads add explicit logical configuration-reuse metadata and ordered topology;
they do not combine unrelated authorized reads into a claimed global snapshot.
Publication/archival and binding mutations return the original receipt without
an extra post-commit lookup. Reading a definition neither rechecks use grants
nor reserves resources; binding still rechecks the original full current inputs.

## Console

The existing Relay page becomes Tunnel Management. The original authoring and
path-switch controllers use the new business API names, retaining their
timeouts, connection invalidation, exact selection, per-rule CAS and uncertain
same-key/body replay. Default controller mode keeps the original API names for
other callers; it does not silently switch namespaces during a pending request.

Inspecting a definition displays its immutable path, locked Endpoint revisions,
Profile, protocols and archive/current-revision state. An explicit action loads
that exact revision into the binding panel without a network write. Draft edits,
capture, command dispatch and disconnect clear the displayed definition. A
pending binding command prevents replacing its target through this new action.

The original bounded per-rule batch queue remains unchanged. It may use the
canonical path endpoints because those are the same owners and commands. There
is no bulk transaction, automatic following of revisions or automatic rollback.

## Preserved Limits and Deferred Work

- Native paths remain 2..8 distinct ordered Nodes and one locked Profile.
- Forward ingress/protocol restrictions and explicit Endpoint checks remain.
- Each Forward retains independent runtime resources and authorization.
- Physical sharing, a separate Tunnel entity/ACL, alternate engines, group
  routing and automatic failover are not implemented by this view.
- No Core, machine protocol, Agent, Journal or recovery-format change occurs.

Deferred concentrated verification covers the aliases' shared idempotency,
authorization/CAS/archive/quota equivalence, bounded topology, disconnected
reads, pending-command protection and desktop/mobile workflows. No tests,
static checks, test scaffolding or Actions were run or added for this slice.
