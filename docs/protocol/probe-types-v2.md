# Typed Probe Machine Messages v2

Date: 2026-10-18 (Asia/Shanghai). Local source implementation, unverified.
[Closed Schema](schemas/probe-types-v2.schema.json).

The exact host target, opt-ins, original authority and historical/metric separation
are specified in [Direct ingress probes](../spec/direct-ingress-probes-v1.md).
The HTTP family is /agent/v3/probe/types/instance, /poll, /claim, /status and /result;
qualification binds the original Gate slot, not a new Hello or execution budget.

This is an explicitly separate machine family: protocolVersion 3, probeVersion 2.
It does not relax or reinterpret any existing Probe v1 message. Parsers reject
duplicate keys, unknown fields, unsupported descriptors and messages over 4096
UTF-8 bytes. Root messages and nested offers are closed with JSON Schema 2020-12
unevaluatedProperties:false; shared binding objects use additionalProperties:false.
No failed v2 parse/exchange may fall back to executing the same task as v1.

Every message carries nodeId, bootId, positive sessionEpoch, 64-lowercase-hex
instanceId, positive instanceGeneration and 64-lowercase-hex requestId. Responses
must echo exact machine identity and correlation. These are non-executable
receipts; executionEnabled is always false wherever present.

Closed descriptor pairs are:
- measurement tcp-connect-v1; taskKind tcp-connect; point agent-direct-egress;
  capability probe.tcp-connect.v1.
- measurement tcp-ingress-connect-v1; taskKind tcp-ingress-connect;
  point agent-local-direct-ingress; capability probe.tcp-ingress-connect.v1.

Qualification and unified poll messages require exactly the ordered measurements
tuple [tcp-connect-v1,tcp-ingress-connect-v1], not a free-form capability list.
Qualification recognizes an already registered original instance; it does not
allocate a Gate, renew original instance authority or issue a permit. Action is
inspect/register/revoke. A qualified response has both qualifiedAt/expiresAt;
unqualified has neither. Qualified interval is positive and at most 30 seconds;
serverTime must be at or after qualification and strictly before its expiry.

The unified poll serves both kinds through one discovery stream rather than
running two poll loops against the existing shared cooldown. Poll response has
observedAt/serverTime and null or one typed offer. Claim/status requests bind
descriptor plus permitId. Their responses preserve descriptor, original binding,
timeout and permit times; consumed state is a receipt, never a reusable grant.
Polling/status observations are at most 250 milliseconds old at serverTime and
must still be clipped by the original task expiry and local elapsed-time guard.

An offer contains descriptor, permitId, original complete ProbeClaimBinding,
timeoutMs 100..2000 and issuedAt/expiresAt. Binding node/boot/session must match
the outer machine, and positive lifetime never exceeds two seconds. Claim time
is between issue and server time, and server time is strictly before expiry.

Typed result preserves original binding, timeout/issue/expiry/consumption facts,
measurement time, validUntil and integer elapsedMs. It is connected/tcp-connected
or unreachable/tcp-connect-failed, with applicationHealth unknown, source
agent-reported and applicationPayloadBytes 0. Elapsed cannot exceed timeout;
measuredAt follows consumption; validUntil is after measurement and no later than
permit expiry. The result digest hashes the complete normalized result body except
requestId, so it includes descriptor and v2 identity. A matching acknowledgement
echoes descriptor/permit/correlation and digest; acceptance and server time must
remain before validUntil. Digest identity does not prove application health.

Type qualification, target derivation, current authorization, one-use local Gate,
withdrawal watch and report acceptance remain original application/Agent owners'
responsibility. Old instances without explicit typed qualification are not eligible
for ingress tasks. A schema-valid receipt alone cannot authorize a socket.

No tests, static/type/syntax checks, generators, formatters, fixtures, network,
CI, commit or push performed. This protocol source is unverified and does not
declare existing/new Probe execution or physical acceptance complete.
