# ADR-0007: Bounded Agent-side active Probe foundation

Date: 2026-10-17. Status: Accepted for the preflight/internal-executor slice only.

## Context

The [classified extension contracts](0006-classified-extension-contracts.md)
separate passive observations from deployments. A stored ready report is not
an independent network measurement. Control must not become a general network
scanner, and a Probe must not create a second deployment authority.

## Decision

1. Place TCP measurements at the Agent's Direct egress, not at Control or the
   Forward ingress. A successful connect proves only that observation point's
   TCP connect, not listener reachability, forwarding correctness, application
   health or an Applied deployment.
2. Start with IP-literal Direct TCP targets of existing enabled, non-deleting,
   non-quarantined Forwards. Callers cannot supply destinations. No DNS, HTTP,
   UDP payload, Relay/multi-hop or arbitrary scripts. Always deny metadata,
   link-local metadata ranges, unspecified, multicast and IPv4 addresses >=224,
   even when the existing Forward policy permits metadata.
3. Introduce only a read-only Control preflight API and internal Go ports now.
   The plan explicitly says `executable:false`, `dispatch:not-implemented` and
   `independentProbe:false`; it is not a token or authorization grant.
4. Require a separate, short-lived Probe permit AND current execution authority
   for any internal Agent measurement. Probe grants cannot be replaced by a
   Snapshot ticket; a Probe permit cannot revive an expired execution ticket.
   Bind Node/boot/session/Snapshot/Assignment/Forward revision/deployment/Fence/
   config digest/egress revision. The host rechecks live state, not saved output.
5. Execute exactly one numeric TCP connect per invocation, close immediately,
   never read/write application payload. Timeout 100..2000 ms, additionally
   clipped by caller cancellation, Probe permit and execution expiry. Recheck
   authorities before/after resolution and dialing, and every 25 ms while
   dialing. Retain admission until dialing and the authority monitor stop.
6. Share budgets across executor instances: four active process-wide, one per
   Node, one-second Node cooldown after completion, at most 128 cooldown/active
   entries. There are no queues, retries, periodic scheduling or auto-switches.
7. Keep Core, ADP/3 messages/capabilities, schemas, migrations and Journal format
   unchanged. No new Agent endpoint or advertised capability. Extract the
   existing numeric egress predicate into an internal pure helper without
   changing Direct/UDP semantics.

These are trusted in-process ports, not a malicious-plugin sandbox. The Probe
resolver and authority checks must be bounded, concurrent-safe and side-effect
free. The host never holds the Runner lock across network dialing.

## Explicitly Deferred

Remote dispatch, transport authentication/capability negotiation, an independent
permit issuer, permit IDs/single-use replay protection, per-actor and cluster
quotas, protocol/result schemas, result collection/storage, Console UI, DNS and
additional observation points are NOT implemented by this ADR slice. Production
cannot remotely execute the internal executor. Future work needs a separate,
versioned machine protocol; do not put Probe commands in complete Snapshots or
pretend the preflight plan is a permit. Capability is not authorization.

Preflight reads use the existing authorized transaction. They are a conservative
preview, not a serializable execution reservation. Future grant issuance and
dispatch must reauthorize/revalidate against current state; a successful plan
does not reserve or guarantee later eligibility.

## Evidence

Actions owns all functional, MySQL and network tests. The slice adds Control
preflight contracts, real SELECT-only MySQL/API non-mutation cases, Go TCP
zero-payload/close/cancel/revocation/budget tests and host binding/expiry tests.
Local type/contract/boundary/format/vet checks are static evidence only. There is
no matching-commit Actions acceptance yet.

See [Forward probe v1 foundation](../spec/forward-probe-v1.md).

Subsequent additive work is scoped separately in
[ADR-0008](0008-probe-contract-negotiation.md): a non-executable machine handshake
and internal one-use admission, not a remote execution grant or dispatcher.
