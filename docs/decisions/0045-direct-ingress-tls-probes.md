# ADR-0045: Controlled TLS Observations Through The Original Direct Ingress

Date: 2026-10-18 (Asia/Shanghai).
Status: Accepted for source implementation; all new source is unverified.

## Context

The existing direct-ingress TCP connect observes a live local listener, not a TLS
identity or application response. Direct forwards raw TCP and does not terminate
TLS. ADR-0044 adds manager-declared public observation-service trust and an
independent operator TLS-only responder, but declaration alone is not a remote
ownership, network or health check. A real TLS observation must traverse the
selected Forward, not dial the declared responder endpoint directly.

## Decision

Add an explicit `tcp-ingress-tls` task, measurement `tcp-ingress-tls-v1`, point
`agent-local-direct-ingress` and capability `probe.tcp-ingress-tls.v1`. Preserve
the exact meanings and absent-key objects of the two existing measurements.

Only the original Probe permit owner issues and consumes permission. The new type
shares its sole global budget, original Gate instance, one-use burn, current
authorization watch, two-second upper deadline and conservative result reporting.
No Relay business key, second Gate, budget refund or probe-owned Forward executor
is introduced. The observation registry is only a narrow current-trust resolver.

The manager supplies `service` with exactly serviceId, metadata revision,
configRevision and configDigest. Every admission/authority/result stage rechecks
the current nonarchived, nonsuspended exact service head, immutable config/digest,
manager/Node authority, source policy, Forward target and validity window. Any
metadata-changing publication invalidates old references, including an explicit
same-config recovery re-declaration. An ordinary identical-config no-op keeps the
original metadata revision and does not invalidate a still-current reference.
The original numeric Direct target must exactly equal the declared endpoint.

The Agent dials only the current physical numeric ingress listener returned by
Runner's original execution owner. On that socket it performs a bounded TLS 1.3
handshake using the selected SNI, exact dedicated serverAuth leaf pin, scoped URI,
certificate/config windows and fixed ALPN `tunex-observation/1`. Exact manual
leaf/identity verification replaces OS/public-CA chain verification; unverified
peers are not accepted. It provides no client key, application request, echo or
direct service-endpoint fallback.

TLS records are real TCP Forward payload and can cause downstream dials, byte
counters and connections. Zero TLS application bytes must not be described as
zero business traffic or proof of the whole path, external reachability or health.

Use a separate strict probeVersion 3 machine family, with explicit qualification
on the existing slot and an ordered three-measurement poll. Full public context
appears only in poll offers under a 16 KiB cap; compact selections and results remain
4 KiB. There is no v2 fallback after failure. Old wire families remain unchanged.

## Persistence And Recovery

Schema 0036 stores TLS context only on the original permit. Run history preserves
only compact service selection/context digest and whitelisted TLS evidence, never
DER or secrets. The result body remains bounded to 4096 bytes. Old objects and
hashes do not acquire null fields. The original 1024-row/seven-day history and
32-plan/16-decision/one-hour finite-plan limits remain unchanged.

Qualification adds optional servicesVersion 1 only after explicit strong
registration. Upgrade of the same current qualified identity preserves the
original qualification time/expiry; old registration cannot silently grant TLS or
erase the marker. Revoked/quarantined identities cannot be rearmed. Recovery
retains the marker, quarantines qualified proofs, suspends plans and service heads,
and preserves original permit reservations, history and protected high-water.
Counter exhaustion blocks the original recovery transaction for operator review.

## Consequences

Control and Agent opt in separately and default off. Enabling configuration is
not worker liveness, trust possession, delivery, measurement success or acceptance
evidence. Manager GET/registry publication remain no-network; actual work requires
a separate explicit Probe command or finite-plan decision through the same owner.

Missing reports, admission denial, authority loss, deadline/cancellation and
unknown commits stay unknown; do not fabricate a TLS failure or repeat an ID.
Successful evidence proves only the selected observation, service pin and TLS
handshake at that time. No automatic switching, healthy aggregate, neighbor TLS,
external observer, TCP/UDP nonce echo, Relay/multihop Probe or production approval
is delivered. Tests, checks, fixtures, network, builds, CI and Git mutations are
deferred to the user-requested concentrated acceptance phase.

Detailed contract: [Direct ingress TLS probes](../spec/direct-ingress-tls-probes-v1.md).
