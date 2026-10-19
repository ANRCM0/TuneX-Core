# Same-Agent Direct Ingress TCP Probes v1

Date: 2026-10-18 (Asia/Shanghai). Local source implementation, unverified.
[ADR-0043](../decisions/0043-typed-direct-ingress-probes.md).

## Exact Scope And Side Effects

New taskKind tcp-ingress-connect has measurement tcp-ingress-connect-v1, point
agent-local-direct-ingress and capability probe.tcp-ingress-connect.v1. Original
tcp-connect/tcp-connect-v1/agent-direct-egress/probe.tcp-connect.v1 remains distinct.
businessProtocol is tcp, independentProbe false and health unknown for both.

Ingress target is the CURRENT actual Direct TCP listener in the SAME Agent network
namespace, not a remote user vantage point. Host-owned driver/execution facts must
match the exact active assignment Resource address/port and current execution
instance, complete binding/revision/config/session/fence and original authorization.
Numeric resource and actual socket address must match; wildcard addresses are not
rewritten to loopback and caller target overrides are not accepted. DNS, zones,
metadata/link-local, multicast and unspecified addresses are unsupported/rejected.
Both original Node listener-address/port authorization and existing allowed
destination CIDRs apply; ingress does not bypass the network policy.

Probe sends zero application bytes, but the TCP handshake can trigger business
accept, downstream connection establishment and ordinary business counters.
It is not a side-effect-free check, proof that the intended process alone owns a
listener, public/NAT/client reachability, external independent evidence, end-to-end
business path, TLS/application protocol result or controlled responder echo.

## Original Execution Authority And Qualification

Original Gate/registration slot remains the only local instance authority. Typed
qualification uses that exact node/boot/session/fingerprint/instance/generation;
it neither creates another Gate nor allocates/renews execution budget. Qualification
is at most 30 seconds and no later than original slot/credential limits. Inspect
does not renew; repeated registration of the same qualified generation preserves
the original interval, while revoked/quarantined/expired generations cannot rearm.
Recovery quarantines qualified history while preserving its original times/identity.

New issuance and subsequent consumed/status/result checks require current matching
qualification plus current ingress capability. Manager permission and original
Node Grant, current published Direct TCP assignment, numeric policy and Agent-local
actual listener checks all remain required; a descriptor is not authorization.
Permission/instance/binding withdrawal cannot be repaired by a stored preview.

Original maximum-two-second permit and reporting cutoff, global at-most-256
retained permits, active/actor/Node/cooldown admission, one-use burn, cooperative
watch/revocation and no-retry result reporting remain unchanged. Cancellation or
network failure does not refund reservations or cause another execution.

## Typed Machine Family

See [typed machine messages v2](../protocol/probe-types-v2.md) and its closed Schema.
Endpoints are POST /agent/v3/probe/types/instance, /poll, /claim, /status and /result.
All use protocolVersion:3/probeVersion:2; qualification is not a replacement Hello
or standalone executable authorization. Identity/correlation, binding, descriptor,
time/code relationships and result digest are verified as a whole, within 4096
UTF-8 bytes. Responses remain executionEnabled:false receipts.

The opted-in Agent performs one unified typed poll with exact ordered measurements
[tcp-connect-v1,tcp-ingress-connect-v1]. It does not run a second poll loop that
could starve either kind against the shared original one-second cooldown. Old
v1 poll cannot receive ingress offers; old unqualified Agents cannot claim them.
Unknown keys/descriptors reject; typed failure closes/rejects that workflow rather
than retrying it as v1. Every original v1 wire schema/parser stays unchanged.
Typed v2 old-egress reports are valid and keep the old observation-point meaning.

## Manager API And Finite Plans

Use the existing manager routes:
- POST /api/v1/scopes/:scope/forwards/:id/probe-plan performs read-only preflight.
- POST /api/v1/scopes/:scope/forwards/:id/probes accepts one task with original
  Idempotency-Key semantics.
- GET /api/v1/scopes/:scope/probes/:id and POST /:id/revoke retain original
  receipt-inspection and explicit withdrawal behavior.

The first two bodies remain closed version:1, kind, expectedRevision and optional
timeoutMs; kind now accepts tcp-connect or tcp-ingress-connect. Default timeout is
1000 milliseconds, bounded 100..2000. No target/address/instance input is added.
Ingress preflight retains original common fields and adds its explicit kind/point/
measurement/capability; it remains executable:false and dispatch:not-implemented.
Ingress acceptance retains the original receipt plus probeVersion:2 and complete
descriptor measurement/taskKind/point/capability. Ingress receipt inspection adds
the four descriptor keys, not probeVersion. Original egress receipts do not gain
invented mandatory keys; unknown/missing historical results never imply failure.

The independent immutable ProbePlan config accepts both kinds; all original
32-head Scope/16 accepted-or-rejected decision/one-hour lifetime/30..3600-second
scheduled interval/seven-day terminal retention rules stay unchanged. Creator and
manual/scheduled actor rights are rechecked per decision through the original
issuer, now including current ingress qualification/capability. Preflight/create
does not issue; no plan edit/rearm/resume, refund or catch-up is added. Read envelope
adds ingressExecutionEnabled as configuration only, not readiness/health evidence.
The existing execution-capabilities response separately exposes
probeIngressIssuanceEnabled; it is also only the Control opt-in, not proof of an
Agent qualification or listener readiness. Original egress acceptance has six
body keys; ingress has those six plus probeVersion and the four descriptor keys.

## Persistence And Measurement Separation

Schema0034 stores explicit ingress measurement and typed qualification, defaulting
old database rows to the original egress measurement. Original old application
objects keep absent measurement keys when canonical hashing/idempotency requires
the historical shape; do not reinterpret old digest bodies with added defaults.
ProbeRun capture/persistence and finite-plan accepted receipts retain actual
measurement identity. Historical current-binding match is not inferred. Captured
result digest is the original owner-accepted v1/v2 body digest, not a reconstructed
wire body or attestation from the redacted history.

Existing v1 Probe CounterSet/export/telemetry/rollup are explicitly egress-only.
Ingress actual dials do not enter those series: absence from v1 counters is not
zero ingress attempts or missing network failure. No new typed telemetry v2 or
health aggregation is delivered. Business counters caused by an accepted TCP
connection remain ordinary business activity and are not substituted Probe results.

## Opt-Ins And Evidence

Control TUNEX_PROBE_INGRESS defaults off and requires original
TUNEX_PROBE_EXECUTION plus TUNEX_PROBE_CLOCK_SKEW_SECONDS=1; invalid combinations
reject startup. Agent --probe-ingress defaults off and requires both
--probe-registration and --probe-execution. Only explicit ingress opt-in advertises
probe.tcp-ingress-connect.v1 and attempts typed qualification/unified polling.
Disabling a flag is not retrospective cancellation of an already issued permit.

All source is unverified. No tests, static/type/syntax checks, scripts, generators,
formatters, fixtures, network/CI, commits or pushes in this slice. Remote/adjacent
vantage points, TLS, nonce echo, UDP, Relay/multihop and current health remain open;
same-Agent self-connect does not complete D1/C3 or physical/production acceptance.
