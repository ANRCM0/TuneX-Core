# Bounded Audit Events v1

Date: 2026-10-18 (Asia/Shanghai). D3-A2: local implementation, unverified.
Decision: [ADR-0037](../decisions/0037-bounded-audit-query.md).

## Endpoint And Authorization

Bearer `GET /api/v1/scopes/:scope/audit-events` is manager-only, not viewer access.
Every page checks current manager permission and reads its projections in the same
supplied transaction. Bearer identity lookup occurs first on the existing bounded
observation pool; do not claim atomic authentication-plus-projection. Two-slot,
1.5-second pool admission and actor cooldown have no main Runtime-pool fallback.
The read invokes no original owner mutations, execution, active network check or notification.

Closed query parameters are `from`, `to`, `limit`, `cursor`, `actorId`, `nodeId`,
`forwardId`, `operationId`, `errorCode` and `source`. Unknown or duplicate parameters
are invalid. Default window24 hours; maximum31 days. Default limit25, maximum50.
`from`/`to` are strict canonical UTC timestamps with milliseconds (`.sssZ`),
forming a half-open `[from,to)` interval. Responses use the same canonical ISO
representation. Maximum window is2678400000ms; default is86400000ms.
Filters are conjunctive, exact source-supported associations, never fuzzy search.
Error codes and source names are closed allowlists, not SQL or arbitrary JSON paths.

## Source Coverage

| Source | Owner facts and limits |
| --- | --- |
| `access` | Membership and Node grant events; subject is not initiator |
| `node-security` | Node security events, including unattributed machine actions |
| `transport` | Profile grant events, not all Profile publication history |
| `path-template` | Template publish/archive owner events |
| `path-binding` | Immutable Forward path-binding provenance |
| `path-group` | Group publish/archive owner events |
| `path-group-binding` | Immutable Forward group-binding provenance |
| `path-publication` | Durable publication lifecycle events |
| `path-publication-attempt` | Original apply/compensate acceptance or rejection |
| `ingress-group` | Ingress definition publish/archive owner events |
| `ingress-deployment` | Ingress deployment lifecycle events |
| `ingress-deployment-attempt` | Original create/compensate acceptance or rejection |
| `ingress-migration` | Explicit migration lifecycle events |
| `ingress-migration-attempt` | Original apply/compensate acceptance or rejection |
| `operation` | Latest mutable Operation state, not transition event history |

No global `recovery_events`: it has no persisted Scope attribution. No synthetic
historical facts for missing sources, unrecorded requests, status transitions or
past associations. Lifecycle and attempt rows may concern the same action; item
count is not command count. Coverage does not promise full historical retention.

## Ordering And Pagination

Order descending by `(occurredAt,source,key)`. `key` is derived from the complete
source primary-key tuple, including composite position/kind/revision dimensions;
it is not merely entity ID. Each source applies all requested filters, window and
cursor predicates before its bounded limit+1 read. The application merges at most
those source windows; no total COUNT or full-history materialization is required.

Cursor is at most1024 base64url characters, containing only version, query digest
and position. Its digest binds Scope, fixed `from`/`to`, filters and limit; changes
are rejected. Continuation requests MUST explicitly send the same `from` and `to`
instead of silently choosing a new default current time.
Unsigned cursor is untrusted pagination state: validate it, and reauthorize every
page. It cannot grant access, attest authenticity or freeze a snapshot. Concurrent
insertion or Operation update may alter later pages; `hasMore`/`nextCursor` do not
prove global completeness or a consistent cross-page historical snapshot.

## Public Record Semantics

Records contain `occurredAt`, `source`, `key`, `kind`, `recordType`, `timeMeaning`,
nullable `actorId`, `actorAttribution`, nullable `subjectId`, `entityKind`, `entityId`,
nullable `revision`, `revisionKind`, `sequence`, `position`, `nodeId`,
`nodeAssociation`, `forwardId`, `operationId`, `errorCode`, `retryable` and
`recoveryInvalidated`, plus closed `outcome`.

`kind` uses a source-specific static allowlist, not arbitrary persisted text.
`recoveryInvalidated` on batch lifecycle/attempt rows is the current original
batch-head flag at read time; on Operation rows it is the latest original state
flag. It is null where unsupported, and never a claimed event-time snapshot.

`recordType` is `owner-event`, `immutable-provenance`, `owner-attempt` or
`latest-operation-state`. `timeMeaning` is `recorded-at` or
`latest-operation-update`. Operation requester uses `requester-not-status-actor`:
current status/error is observed at its latest update, never backdated as an
immutable transition or attributed to the original requester as status initiator.

`actorAttribution` also permits `initiator`, `unattributed` and
`unattributed-recovery`. Batch recovery event actor columns hold the old creator,
not recovery operator; expose no invented initiator. A filter must not manufacture
an actor for such an event. Unsupported associations remain null. Batch lifecycle
events do not acquire member Forward/Operation links from mutable current state.

`nodeAssociation` is `explicit-node`, `immutable-forward-spec`,
`immutable-template-config`, `immutable-group-definition` or `none`. Historical
Node association must come from that source's own immutable saved content, never
the current Forward configuration. A source without a requested association
cannot match that filter by inference.
Node-security detail arrays such as `operationIds` are not flattened into scalar
Forward/Operation associations: that family's `forwardId` and `operationId` remain
null. This endpoint is explicit single-value association search, not exhaustive
reverse relationship discovery.

## Response And Safety Boundaries

The envelope includes `auditVersion:1`, `scopeId`, canonical ISO `capturedAt`, fixed
canonical ISO `window:{from,to}`, normalized `filters`, top-level `limit`, bounded
`items` (with ISO `occurredAt`), `nextCursor`, `hasMore`, `coverage` and `limits`.
Fixed flags are `source:'persisted-owner-records'`, `readOnly:true`,
`executionAuthorized:false`, `health:'unknown'`, `networkCheck:'not-performed'` and
`consistency:'read-committed-not-global-snapshot'`. Capture time is query context,
not a global database snapshot timestamp. Coverage distinguishes source facts and
limitations, not an exhaustive ledger or health/safety proof.

`coverage` contains the actually selected `sources` (all fifteen or the one source
filter), and these fixed declarations:

| Coverage field | Value |
| --- | --- |
| `completeness` | `existing-owner-records-only` |
| `retention` | `source-owned-no-common-retention` |
| `operationHistory` | `latest-state-not-transition-log` |
| `relatedRows` | `not-independent-command-count` |
| `nodeFilter` | `explicit-node-or-immutable-owned-config` |
| `associations` | `explicit-single-value-only-not-exhaustive-relations` |
| `globalRecovery` | `excluded-no-scope-attribution` |
| `ordering` | `occurredAt-desc-source-desc-key-desc` |
| `queryCost` | `bounded-output-not-verified-sql-cost` |

`limits` declares `defaultWindowMs:86400000`, `maxWindowMs:2678400000`,
`maxPageSize:50`, `maxResponseBytes:131072`, `activeRequests:2`, `actorKeys:128`
and `cooldownMs:1000`. The response byte cap and per-source rows bound projected
output, not verified execution cost on existing tables/indexes. Actor bookkeeping
is bounded and does not imply unlimited per-actor queues or Runtime fallback.

Return only server-built allowlisted metadata. Never return raw details, config,
spec, plan or outcome JSON; free-text errors; request/idempotency keys or digests;
fingerprints, credential material, certificates/private keys, policies, environment,
database URLs, authentication headers or protected recovery state. Authorized
original identifiers are retained here; this is not a redacted support export.

No DDL, audit writer, retention/GC change, export, station event, webhook queue,
notification or auto-execution is introduced. Those remain separate slices. No
tests, static checks, syntax/type checks, formatters, generated fixtures, CI,
commit or push were run in this source-only slice. D3/project completion and
physical/production acceptance are not claimed.
