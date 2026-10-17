# Forward Probe Management v1

Status: working-tree implementation, 2026-10-17; matching-SHA Actions pending.
Decision: [ADR-0018](../decisions/0018-probe-production-workflow.md).
Foundation and machine contracts remain [Probe v1](forward-probe-v1.md),
[claim](../protocol/probe-claim-v1.md), [delivery](../protocol/probe-delivery-v1.md)
and [result](../protocol/probe-result-v1.md).

## Enablement and scope

Control issuance defaults off. Process opt-in requires
`TUNEX_PROBE_EXECUTION=1` AND `TUNEX_PROBE_CLOCK_SKEW_SECONDS=1`; the latter explicitly
selects the stricter cluster ADP clock policy, not a per-Probe grace window. An
embedded server must pass `probeExecutionEnabled:true` with a one-second-maximum
clock Policy. Agents negotiate it on reconnect and need independent synchronized
OS time. The Agent additionally needs `--probe-registration --probe-execution`;
registration alone stays non-executing. Compose examples expose independent,
default-off variables `TUNEX_PROBE_REGISTRATION` and `TUNEX_PROBE_AGENT_EXECUTION`.
Changing Control timing settings is an operator-reviewed cluster change, not an
automatic clock fix. Default-off deployments retain their existing timing policy.

`GET /api/v1/scopes/:scope/execution-capabilities` adds `probeIssuanceEnabled`.
This describes Control acceptance, not each Node's opt-in, current binding,
delivery guarantee or health. All management endpoints use Bearer authentication,
reject cookies, honor maintenance and return `Cache-Control:no-store`.

## Accept one short-lived task

`POST /api/v1/scopes/:scope/forwards/:id/probes`

Required `Idempotency-Key`: 1..128 visible ASCII characters. Body limit: 1024
UTF-8 bytes. Only the following closed fields are accepted:

```json
{"version":1,"kind":"tcp-connect","expectedRevision":1,"timeoutMs":500}
```

Timeout is an integer 100..2000 milliseconds, optional with default 1000. Null,
coercion, duplicate/unknown fields, caller-selected targets/instances/bindings,
and unsupported kinds reject. Scope manager and explicit Node Grant are required,
including for the Owner. The Forward must be enabled, non-deleting/non-suspended,
Direct TCP with a policy-allowed non-metadata IP-literal target. Current published
active binding, session, credentials and registered instance must all match.

One transaction accepts idempotency and the original at-most-two-second permit,
under existing global/Actor/Node reservations. It automatically selects the current
locked instance; it does not ask the user to copy internal credentials or instance
IDs. A 202 example:

```json
{"probeId":"probe-id","forwardId":"forward-id","issuedAt":"2026-10-17T00:00:00.000Z","expiresAt":"2026-10-17T00:00:02.000Z","dispatch":"agent-poll","executionEnabled":false}
```

`executionEnabled:false` means this returned data is not an executable grant.
It does NOT mean a separately authorized/opted-in Agent cannot perform the task.
202 proves only durable acceptance; discovery/execution/reporting can expire or
fail closed without a result. There is no delivery promise or automatic task retry.

Reusing the key with the same normalized command returns the original acceptance,
even after expiry/pruning or disabling issuance, after current Scope manager
authorization. It never schedules again. A different command with that key is
409 IDEMPOTENCY_CONFLICT; recovery-invalidated records still require review.
New commands with new keys remain subject to the unchanged three-second maximum
issue-plus-cooldown reservation. Clients must not secretly replace uncertain
submissions with new keys.

## Inspect a retained receipt

`GET /api/v1/scopes/:scope/probes/:probeId`

No query parameters. Current Scope manager permission is required. Unknown,
pruned or cross-Scope IDs return 404. Node Grant is NOT required to inspect this
sanitized historical receipt; removing execution permission does not erase history
or prevent managers from finding/revoking already accepted tasks.

The immutable view contains probeId, forwardId, issuedAt/expiresAt, state
(`issued|consumed|revoked|quarantined`), expired, withdrawnAt or null,
`executionEnabled:false`, `health:unknown`, and result or null. A result contains
the original closed reported body, resultDigest, acceptedAt (epoch milliseconds),
`historical:true` and its time-expiry flag. Digest and complete permit association
are revalidated before returning it. No target, credential fingerprint, Actor
secret or request correlation ID is returned. The result body's internal binding
and instance IDs are identifiers, not reusable authorization.

The result remains `source:agent-reported`, `applicationHealth:unknown` and
`applicationPayloadBytes:0`. A not-yet-expired timestamp is not proof that current
binding/permission/health still holds. Expired or revoked results never restore
authority. A null result can mean pending, expired, denied, cancelled, unreachable
timeout or lost report; never render it as success, zero latency or healthy.

Retention is the existing maximum-256 permit/result store, not persistent monitoring
history. Eligible expired rows can be pruned on the next permit mutation after
the original expiry plus one-second cooldown. There is no guaranteed minimum
history duration beyond current retention and no new background cleanup service.
The idempotent acceptance can outlive its queryable receipt and still cannot rerun.

## Revoke retained authority

`POST /api/v1/scopes/:scope/probes/:probeId/revoke`, body exactly `{}` (1024-byte limit).

Current Scope manager permission is required; works even with issuance disabled
or the original Node Grant removed. Repeated calls are intrinsically idempotent
while the ID is retained and do not require a new idempotency record. Response:
probeId, state, executionEnabled:false and canonical withdrawnAt or null.
Issued permits become revoked; consumed permits preserve consumed/closedAt facts
and gain a sticky independent withdrawal. Neither releases issuance reservations,
revives expired authority, clears old consumption nor triggers another task.

Revocation is cooperative and cannot undo an already transmitted TCP SYN. Turning
off issuance stops new permits, not every outstanding task instantly; original
two-second deadlines and existing watch checks still apply. No process-wide stop
or destructive Journal/database cleanup is implied by this endpoint.

## Failure and evidence semantics

Existing sanitized API errors apply: authentication 401, invisible Scope/Grant/ID
404, management/policy denial 403, malformed values 422 (duplicate JSON integrity
409), body limit 413, revision/binding/disabled/conflict 409 and budget 429.
Infrastructure/clock uncertainty fails closed. No new Forward Operation or lease
is created for a Probe. The original receipt owner still reauthorizes consumption,
each status observation and ingestion; user and machine APIs cannot bypass it.

New `probe-permit-ports`, `forward-probes-api`, Go `TestProbeWorkflow*` and dedicated
`npm run test:probe` Actions coverage complement existing contracts/race/MySQL
gates. They are authored and wired, not accepted for this working-tree SHA.
Console controls, long-lived history, health aggregation, automatic switching,
physical multi-host and production-readiness gates remain outstanding.
