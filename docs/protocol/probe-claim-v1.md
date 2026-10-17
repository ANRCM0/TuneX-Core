# Probe claim v1

Decision: [ADR-0012](../decisions/0012-probe-claim-contract.md).
Schema: [probe-claim-v1.schema.json](schemas/probe-claim-v1.schema.json).
Shared conformance vectors: [probe-claim-v1.json](fixtures/probe-claim-v1.json).

## Endpoint and authority

`POST /agent/v3/probe/claim` is an independent optional mTLS machine endpoint.
It is not ADP/3 Forward execution or a Probe issuance API. All responses have
`Cache-Control: no-store`. Successful responses are still non-executable.
The middleware supplies actual verified Node identity and credential fingerprint;
Bearer tokens and caller-supplied identity/fingerprint headers cannot substitute.
`X-TuneX-Session-Epoch` must be a positive safe integer equal to the body session.

The closed request has exactly `protocolVersion:3`, `probeVersion:1`,
`kind:probe-claim`, `nodeId`, `bootId`, `sessionEpoch`, `instanceId`,
`instanceGeneration` and `permitId`. Instance ID is 64 lowercase hex digits;
instance generation is a positive safe integer. No target, binding, Actor,
fingerprint, timeout or time is accepted. A known ID comes from the internal
issuer; discovery/delivery and remote issuance are not implemented.

After full owner authorization the stored permit changes issued -> consumed in
one guarded transaction. Repeated consumption, unknown IDs and stale/foreign
instance/machine associations are unavailable, not idempotent success. Original
Actor rights and exact current Forward/Snapshot/network policy are rechecked.

## Receipt

The closed response echoes every request identity with `kind:probe-claim-ack`,
plus `binding`, `timeoutMs`, `issuedAt`, `expiresAt`, `consumedAt`, `serverTime`,
`state:consumed` and `executionEnabled:false`. It does not return a credential,
signature, target, actor/scope identity, result or application-health claim.

Binding contains exactly Node/boot/session, Snapshot generation, assignment,
Forward/revision, deployment generation, binding Fence, config digest and egress
policy revision. IDs use the common strict ASCII identity rules, all counters
are positive safe integers and digest is `sha256:` plus 64 lowercase hex digits.
Binding Node/boot/session must equal the response envelope. `timeoutMs` is
100..2000. Times are real UTC calendar dates with exactly millisecond precision;
issue is at/after Unix epoch and the positive issue/expiry window is at most two
seconds. Require `issuedAt <= consumedAt <= serverTime < expiresAt`.

Strict TS/Go parsers reject duplicate keys, unknown/missing fields, trailing JSON,
invalid Unicode, unsafe integers, invalid dates, over-4-KiB bodies and any attempt
to enable execution. Typed response checking revalidates shapes and exact echo.
Host verification additionally compares every binding field with current local
execution facts, applies the existing clock Guard and a conservative monotonic
deadline, and checks local authority before and after the exchange.

## Failure and replay

No verified mTLS -> 401; unknown/revoked/expired credential -> 403. Bad schema ->
422; duplicate keys -> 409; body over 4096 bytes -> 413. Header/body mismatch ->
409. Owner authorization, maintenance and current-state errors retain their
existing semantics (including opaque 404 when the original Actor lost a grant).
An error or disconnected request does not prove that consumption rolled back.

The acknowledgement is built after commit. Late/invalid/lost replies never
refund reservations or resurrect a consumed ID; server replay is denied. Agent
burns known IDs before sending, retains up to 256 per registered instance without
eviction and does not auto-retry uncertain outcomes. Rotation does not change
server one-use semantics or permit-to-instance binding. No new on-disk format is
introduced. A consumed receipt alone cannot authorize a socket or substitute for
continuous independent revocation checks.

No new migration or ADP capability. Use the existing 0015 compatibility and
recovery boundaries. There is no production Agent caller, remote issue/poll loop,
actual probe execution, result endpoint or Console health integration yet.
