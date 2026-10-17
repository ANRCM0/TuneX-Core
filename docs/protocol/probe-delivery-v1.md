# Probe delivery v1: bounded discovery and current-authority observations

Date: 2026-10-17 (Asia/Shanghai). Working-tree implementation; Actions acceptance pending.
Decision: [ADR-0014](../decisions/0014-probe-delivery-contract.md).
Schema: [probe-delivery-v1](schemas/probe-delivery-v1.schema.json).
Shared vectors: [184 cases](fixtures/probe-delivery-v1.json), checked by TS and Go in Actions.

## Machine association

Independent POST endpoints, not new ADP Snapshot fields or capabilities:

| Endpoint | Request / response kind | Purpose |
| --- | --- | --- |
| `/agent/v3/probe/poll` | `probe-poll` / `probe-poll-ack` | Return null or at most one current issued permit offer |
| `/agent/v3/probe/status` | `probe-status` / `probe-status-ack` | Observe current authority for one already consumed, unwithdrawn permit |

Both require an actual verified client certificate. Node and fingerprint come
from the TLS socket and the current credential mapping, not caller headers.
`X-TuneX-Session-Epoch` is a positive safe integer and must equal the body epoch.
Bodies are at most 4096 UTF-8 bytes; all objects are closed. Reject duplicate
keys, malformed UTF-8/Unicode, unsafe or precision-losing numeric tokens,
trailing JSON, invalid calendars and cross-protocol messages.

Common required request fields: `protocolVersion:3`, `probeVersion:1`, `kind`,
`nodeId`, `bootId`, `sessionEpoch`, `instanceId`, `instanceGeneration`, `requestId`.
Instance and request IDs are exactly 64 lowercase hexadecimal characters.
Status additionally requires `permitId`; poll forbids caller-selected permit IDs.
Neither accepts target, binding, Actor/Scope, fingerprint, timeout, time or a
cursor/list size. All counters are positive integers no larger than 2^53-1.

`requestId` is correlation only, never authorization, issuance ID or a server
deduplication record. A future Agent client must create a new random 256-bit
value before each exchange, require an exact echo and never reuse it. The
server does not promise uniqueness or reject repeated read-only requests. Echo
validation alone does not establish freshness or prevent delayed responses.

## Poll response

Echo common machine/request fields with `kind:probe-poll-ack`, `observedAt`,
`serverTime`, `executionEnabled:false` and required `offer` (null or one object,
never an array). The offer contains only `permitId`, complete `binding`,
`timeoutMs`, `issuedAt`, `expiresAt`. The binding fields equal the
[claim contract](probe-claim-v1.md)'s complete binding.

The owner locks and authenticates the current instance/machine even for an empty
reply. Non-empty replies reauthorize the original Actor, current Forward and
Node grants, binding, credential, instance and deadlines. Ambiguous candidates
fail closed; no foreign, old-instance, consumed or closed permit is offered.
Discovery reserves nothing, does not consume or renew, and cannot promise that
a later claim will succeed. Repeated polls may return the same issued ID.

## Consumed-status response

Echo common fields and `permitId` with `kind:probe-status-ack`, complete binding,
`timeoutMs`, `issuedAt`, `expiresAt`, original `consumedAt`, `checkedAt`,
`serverTime`, `state:consumed` and `executionEnabled:false`.

The existing owner checks the exact machine/fingerprint/instance association,
consumption, independent sticky withdrawal fact and full original/current
authorization in one guarded transaction. Locks remain until commit. Repeated
status checks never consume again or change state, expiry, budget or timestamps.
Withdrawn, unknown, issued, expired or foreign permits do not receive a positive
observation. Restoring grants cannot clear explicit withdrawal. No Actor, Scope,
fingerprint, target or internal dispatch fields leave either adapter.

## Time and failure boundaries

Times are canonical UTC millisecond strings. For non-empty discovery and status:
`0 <= issuedAt <= observedAt/checkedAt <= serverTime < expiresAt`, with
`0 < expiresAt-issuedAt <= 2000 ms`; status also requires
`issuedAt <= consumedAt <= checkedAt`. Timeout is an integer in [100,2000] ms.
Empty polls still require `0 <= observedAt <= serverTime`.
In every reply `serverTime-observedAt/checkedAt <= 250 ms`. A late commit,
backwards/invalid clock or expired result suppresses the acknowledgement.

The 250 ms bound covers only the interval from the owner's final observation
through adapter construction. It does NOT bound queueing, request/response
network latency, HTTP transmission, OS scheduling or Agent cancellation. It is
NOT a renewable 250 ms lease. Successful status can be invalidated immediately
after its transaction; no instantaneous distributed revocation is claimed.

A future fail-closed monitor must bound elapsed time from a monotonic instant
BEFORE sending, clip to the original consumed receipt/instance/execution
deadlines, recheck the complete local binding and close on denial, malformed,
late, mismatched, disconnected or uncertain outcomes. It must not grant a fresh
window merely because a response arrived, retry claims, reconstruct an
executable grant from an observation or resurrect a closed work item.

No verified mTLS -> 401; unknown/revoked/expired credential -> 403; closed schema
failure -> 422; duplicate keys -> 409; request over 4096 bytes -> 413. Session
mismatch, stale/expired results and unavailable permit -> 409. Original owner
errors remain intact, including opaque 404 for withdrawn original Node grants
and 503 for maintenance/corruption. No cached positive result or fallback on
failure. Responses inherit `Cache-Control:no-store`.

These endpoints make no durable writes, including on successful observations;
they use the owner's existing locking reads. The real MySQL fixture grants
SELECT plus LOCK TABLES (needed for FOR UPDATE without DML privileges), and
separately verifies that data mutations fail. It is not described as a
SELECT-only principal. There is no new remote issue/revoke endpoint, migration,
polling rate controller, production Agent caller, execution or result ingestion.

Follow-up: [ADR-0015](../decisions/0015-probe-agent-authority-watch.md) implements
internal Agent exchange/observation hooks, process/Node admission and cooperative
fail-closed monitoring with pre-request monotonic freshness and drain-before-
release. These are not wired to the production Agent or executable grants. Its
200 ms exchange/250 ms freshness/25 ms local checking limits are not an OS
real-time guarantee or evidence of physical cancellation.
