# Probe result v1

Status: implementing, 2026-10-17. Decision: [ADR-0016](../decisions/0016-probe-result-receipts.md).
Schema: [result v1](schemas/probe-result-v1.schema.json).
Shared fixtures: [TS/Go vectors](fixtures/probe-result-v1.json).

## Transport and request

`POST /agent/v3/probe/result` requires actual Node client mTLS and
`X-TuneX-Session-Epoch`. Bearer or claimed fingerprint headers do not substitute.
Maintenance and `Cache-Control:no-store` follow existing machine routes. Maximum
request/response body is 4096 bytes. Strict duplicate-key/integer/Unicode parsing,
closed objects, canonical UTC millisecond timestamps and positive safe counters
apply on both TS and Go. New version/kind fields do not modify existing messages.

Required request fields:

- protocolVersion=3, probeVersion=1, kind=probe-result.
- Node/boot/session, registered instance ID/generation, permitId and fresh
  lowercase 64-hex requestId. Permit ID identifies one attempt and result.
- Complete original claim binding, timeoutMs and issuedAt/expiresAt/consumedAt.
- measuredAt, validUntil, integer elapsedMs=0..timeoutMs; timeoutMs=100..2000.
- point=agent-direct-egress, source=agent-reported, applicationPayloadBytes=0,
  applicationHealth=unknown and paired connected/tcp-connected or
  unreachable/tcp-connect-failed status/code.

No Scope, Actor, fingerprint, arbitrary target, raw network error, payload,
credentials, executable permit or inferred healthy state is accepted. The
complete binding is identical to [claim v1](probe-claim-v1.md).
Elapsed is total invocation duration, not RTT. It does not prove a timeout is a
target failure. DNS, UDP, Relay, external observation points and application
handshake results are unsupported by this version.

Semantic time ordering is 0 <= issued <= consumed <= measured < validUntil <=
expires, with expires-issued <= 2000ms. At ingestion, original receipt fields
must exactly match server authority, measured <= serverNow < validUntil, and
the original consumed, unwithdrawn permit/Actor/full binding must remain valid.
There is no reporting grace or clock-skew extension. Uncertain/future/late
measurements are discarded; reporting must not falsify/clamp measurement time.

## Receipt and duplicate semantics

The owner commits one result under the existing shared permit lock. RequestId
is removed before computing RFC 8785 JCS SHA-256; every other field is included.
This content digest is shared across TS and Go. Reordered JSON or a new requestId
does not replace the observation. An identical repeat returns the original
acceptedAt, not another measurement. Different content returns
PROBE_RESULT_CONFLICT/409, even if the requestId is new.

The response has protocolVersion=3, probeVersion=1, kind=probe-result-ack,
Node/boot/session/instance/permit/request association, resultDigest, acceptedAt,
serverTime, duplicate, health=unknown and executionEnabled=false. Consumers
validate exact association, digest, measured <= acceptedAt <= serverTime and
acceptedAt/serverTime < validUntil. Responses are constructed only after owner
commit and a fresh post-commit check; they are not execution authorization.

Expired/withdrawn/foreign/now-unauthorized original permits reject even exact
duplicates. Missing permits and unavailable bindings return 409; original
authorization failures retain 403/404 semantics. Invalid contract data is 422,
oversized body 413, unauthenticated 401, conflicting content 409, and corrupt
persisted results 503. No internal/raw errors or credential values are exposed.
Failed commits produce no success response. Lost replies may leave a committed
row, so a caller must never create another execution merely to retry reporting.

## Storage, compatibility and exclusions

Migration 0017 stores one result per retained permit, at most the existing 256
permit records. It is bounded receipt storage, not history or a health read model.
Existing pruning after permit expiry+1000ms deletes dependent results; there is
no autonomous timed GC. No duplicates advance the clock, renew expiry, refund
quotas or modify consumed/withdrawn state. Recovery preserves recorded facts but
withdraws consumed authority, so restored observations cannot become new grants.

Control-only upgrade profile `adp3-probe-results-v1` has Schema ceiling 0017.
Older profiles reject the migrated database; Agent Journal/profile does not
change. There are no target dials, Agent result HTTP caller, one-use execution
adapter, production dispatcher, user-facing run/query API, history, health
aggregation or automatic switching in this slice. Authenticated Agent reporting
is not cryptographic/physical proof of a trustworthy measurement.

Functional/MySQL/mTLS tests and TS/Go conformance are Actions-wired, not locally
executed or accepted for this working tree's SHA. See ADR-0016 for test scope.
