# ADR-0043: Typed Same-Agent Direct Ingress TCP Probes

Date: 2026-10-18 (Asia/Shanghai). Status: local source implementation, unverified.
See [contract](../spec/direct-ingress-probes-v1.md) and
[typed machine protocol](../protocol/probe-types-v2.md).

## Observation Point, Not Full-Path Health

Add tcp-ingress-connect at agent-local-direct-ingress as a separate measurement
from the original tcp-connect at agent-direct-egress. It connects to the CURRENT
numeric actual Direct TCP listener in the SAME Agent network namespace. The host
derives it from the active original execution instance and exact published Resource;
the caller cannot supply a target, DNS name, wildcard-to-loopback rewrite or zone.
Current listener-address/port authorization and existing destination CIDR policy
both apply. Metadata, multicast, unspecified and disallowed addresses are rejected.

This is a zero-application-payload TCP connection, not an independent external
observer, adjacent-node probe, listener-owner attestation, TLS handshake, nonce echo,
whole-path result or application health. A self-connection can cause business
accept/downstream dialing and counters despite sending zero application bytes;
the feature is therefore an active operation, not passive diagnostics.

## Typed Wire And Original Authority

Keep every old Probe v1 wire contract unchanged. Add a closed probeVersion:2 family
under /agent/v3/probe/types with instance/poll/claim/status/result endpoints.
Explicit descriptors bind measurement, taskKind, point and capability throughout
offer/claim/status/result and result digest. Qualification proves typed protocol
support on the SAME original registered Gate/slot generation; it does not mint a
second instance, budget or executable grant. Revoke is sticky for that generation;
registration cannot renew/rearm it. Recovery quarantines qualified entries.

The opted-in Agent uses ONE unified typed poll for both measurements, avoiding
parallel loops against the original shared one-second poll cooldown. Old Agents
remain eligible only for old egress tasks; unknown fields/types reject and typed
failure never falls back to v1 execution. Typed v2 can legitimately report an old
egress measurement, without changing the meaning of its observation point.

All original Scope/Node Grant, current session/instance, complete published binding,
one-use Gate burn, global at-most-256 retained budget, active/cooldown limits,
maximum two-second permit, live withdrawal watch and reporting deadlines remain.
Each new ingress issuance/claim/watch/result step rechecks current qualification
and advertised ingress capability. Same-transaction original owner acceptance,
ProbeRun history and finite plan decisions stay atomic; no separate executor owner.

## Product, Persistence And Compatibility

Existing manager routes accept the new kind; no second manager endpoint family.
Finite manual/scheduled plans add the kind without changing 32-head/16-decision/
one-hour/30-second/seven-day bounds. Creation is still preflight-only; each future
decision reauthorizes original current rights. Cancellation only stops future plan
decisions, not already accepted permits; recovery never resumes/catches up.

Schema0034 persists measurement/typed qualification. Old rows normalize to the
original measurement, while original in-memory object key absence is preserved
for unchanged old hashes/idempotency. Stored ingress records carry explicit type;
history projection never relabels old egress facts as ingress. Typed result digests
include their actual v2 descriptor/body, not an invented v1 conversion.

Ingress measurements are deliberately EXCLUDED from existing v1 Probe cumulative
counters, telemetry and rollups. Those series remain egress-only; this slice does
not claim a typed telemetry-v2 implementation or mix unlike observation points.
Retained result is historical/agent-reported and health remains unknown.

Control TUNEX_PROBE_INGRESS is default off and requires original execution and
strict one-second Probe clock opt-ins. Agent --probe-ingress is default off and
requires original registration and execution; only that opt-in advertises the new
capability. Configuration presence is not qualification, readiness or health.

## Evidence And Remaining Work

No tests, static/type/syntax checks, scripts, generators, formatters, fixtures, CI,
network, commits or pushes in this source-only slice. Final-source protocol,
authorization/concurrency, listener identity, active side effects, timing, recovery,
history/metric separation and browser acceptance remain unverified. Remote observer,
adjacent checks, TLS/controlled TCP/UDP echo, Relay/multihop and health aggregation
remain separate work; D1, C3 prerequisites and project/physical gates stay open.
