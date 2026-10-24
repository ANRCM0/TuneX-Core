# Native PathTemplate Metadata v1

Status (2026-10-17): first C1 metadata slice implemented and Actions acceptance
authored; not yet functionally verified for its exact commit.
Decision: [ADR-0023](../decisions/0023-immutable-native-path-metadata.md).
Subsequent exact bindings, reference/impact preview and explicit single-rule
switching are implemented separately in [Path bindings v1](native-path-bindings-v1.md),
with exact-commit acceptance still pending. This metadata API itself stays non-executable.

## Configuration

```json
{
  "version": 1,
  "protocols": ["tcp", "udp"],
  "nodes": ["ingress", "transit", "egress"],
  "endpoints": [
    { "nodeId": "transit", "revision": 3 },
    { "nodeId": "egress", "revision": 4 }
  ],
  "transport": { "profileId": "native-profile", "configRevision": 1 }
}
```

Objects are closed and reject unknown fields. IDs follow existing ASCII ID
rules (1-128 characters); all revisions are positive safe integers. `nodes`
contains 2-8 distinct ordered IDs, including ingress and egress. Each downstream
Node has exactly one Endpoint lock in the same order. Protocols contain TCP,
UDP or both, normalized TCP before UDP; duplicate values are rejected. Input is
detached/frozen before awaiting a transaction. There is no target, listener,
enabled flag, partial topology, latest-revision alias or fallback path.

The digest is the existing SHA256/JCS digest of `{config,profileDigest}`, where
`profileDigest` comes from the original immutable Transport resolver. Requirements
are computed from path length/protocols, not accepted from user-supplied claims.

## Management API

All paths are under `/api/v1/scopes/:scope`, cookie-free Bearer authentication,
`Cache-Control:no-store`. Template IDs are case-sensitive and scoped, unlike the
existing global Profile IDs. Missing scope membership remains an opaque 404;
a current viewer cannot mutate (403). Node/Profile grants are not implied by
Scope ownership. Mutation bodies are limited to 8 KiB, reject duplicate JSON keys
and unknown fields, require `Idempotency-Key`, and allow no query parameters.

| Method / path | Input / behavior |
| --- | --- |
| `GET /path-templates` | Only canonical `page`, `limit`, `prefix`; default 1/25, maximum limit 100, existing console offset bounds; literal ASCII ID prefix, no wildcard search |
| `GET /path-templates/:id` | Current config and current head |
| `GET /path-templates/:id?revision=N` | Exact positive immutable revision plus current head and archive flag; missing revision is 404, never latest fallback |
| `PUT /path-templates/:id` | Closed `{expectedRevision,config}`; CAS 0 creates, current CAS updates; normalized unchanged content returns 200, changed content returns 202/new revision |
| `DELETE /path-templates/:id` | Closed `{expectedRevision}` with existing positive CAS; terminal archive returns 202, already archived returns 200, never physical deletion |

Unknown or duplicate query keys, ambiguous numbers (`01`, decimals, exponent,
zero/negative read revision) and wildcard prefixes are 422 (`INVALID_CONFIG`),
matching the existing Control error boundary. Duplicate JSON body keys remain
409 (`INTEGRITY_FAILURE`); this does not introduce a new API error mapping. Lists return bounded
`items:[{templateId,currentRevision,archived}]`, `page`, `limit`, `offset`, `total`,
`source:"persisted-control-state"`, `executionAuthorized:false`. No config arrays
are hidden in this listing, and archived IDs remain visible and count toward
the permanent 128-ID Scope limit.

Exact config reads include `templateId`, `currentRevision`, `revision`, `archived`,
`config`, `configDigest`, `profileDigest`, `createdBy`, ISO `createdAt`, computed
`capabilityRequirements`, and these non-authority labels:

```json
{
  "source": "persisted-control-state",
  "referenceAuthorization": "not-rechecked-by-this-query",
  "executionAuthorized": false,
  "reserved": false,
  "bindingCreated": false
}
```

Scope-authorized reads preserve historical IDs/configuration after reference
grants or credentials change. They verify the stored digest and shape, but are
not proof of current deployability, reachability, TLS validity, health or capacity.

Mutation response is `{templateId,revision,configDigest,archived,changed}`.
There is no Operation ID: it accepts metadata, not deployment. A new publication
checks all original Node grants/current credentials/capability declarations,
exact Profile grant/revision/digest/protocol support and current downstream
Endpoint revisions, in one transaction. Even a no-op rechecks references.
Archive needs scope management/CAS, not continuing reference grants. No template
command changes a Forward, port slot, lease, Snapshot, credential or deployment.

Limits are 128 identifiers per Scope (including archives) and 64 immutable
revisions per identifier. A changed 65th publication or concurrent quota loser
is 429; no-op/archive remain available at the revision ceiling. CAS conflict or
stale Endpoint is 409. Archived IDs reject all new publications, even with a
matching CAS; use a deliberately new identifier. No reset, compaction, ID reuse,
automatic cleanup or archive-to-revoke operation is supplied.

The existing actor/Scope idempotency owner returns the original status/body for
an identical replay after current Scope management authorization; changed
normalized request content conflicts. Replay does not redo reference resolution
and does not grant current execution. Restored keys require the original recovery
review. Audit events record only changed publication/archive with actor, config
revision and time in the same transaction; no-op/replay does not add an event.

## Console and Acceptance

The Relay view exposes a structured metadata panel separate from the original
Forward editor. Explicit capture reads at most seven current Endpoint revisions,
with a five-second deadline per request. It does not check a full execution plan.
Editing invalidates locks; exact historical inspection can populate an explicit
new proposal using the current head as CAS, never overwrite an old revision.

Publish/archive require confirmation. Unknown outcomes lock the proposal and
retain only tab-memory key/body for explicit identical replay. A current replay
denial remains uncertain. Discard/disconnect aborts local reads and drops memory,
not a committed command; no browser storage, hidden retries or automatic switch.

Actions runs `path-template-ports.test.ts`,
`path-template-mysql-acceptance.test.ts` and `path-template-flow.test.mjs`.
The [multi-hop browser fixture](../testing/native-multihop-console.md) adds real
form publication with Profile r1 while current is r2, committed-response loss /
same-key replay, no-op, immutable r2, r1 inspection and terminal archive. It then
rechecks the unchanged original Forward/resources and real TCP/UDP.
All are authored, not local execution evidence or physical-host acceptance.

## Upgrade and Remaining Scope

Migration 0018 adds only the three metadata tables. Control-only compatibility
profile `adp3-path-templates-v1` has schema ceiling 0018; Agent profiles/Journal,
machine wire contracts and Core do not change. Full SQL backups preserve history
and archival state. Recovery retains non-executable metadata, quarantines old
request keys and applies the original identity/grant/intent isolation; it must
not materialize fresh bindings. See [upgrade assessment](../operations/upgrade-recovery.md).

Subsequent [Path bindings v1](native-path-bindings-v1.md) pins the exact template
revision/digest outside Core and persists the actual expanded ForwardSpec in
the same transaction as original Forward acceptance/current reference checks.
It supplies bounded references and explicit single-rule switching through the
original Runtime. Multi-rule path publication remains a follow-up; no zero-downtime
or cross-host-atomic claim is made. The two metadata mutation routes still do
not execute those commands, groups, backup paths or automatic failover.
