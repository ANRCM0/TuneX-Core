# ADR-0005: Complete mixed execution and one physical ownership journal

- Status: Accepted for implementation; execution remains default-off.
- Date: 2026-10-16.
- Predecessor: [ADR-0004](0004-role-neutral-agent-multihop.md).
- Validation status: implementation and acceptance tooling exist; runtime and
  external-host acceptance have not been run for this working tree.

## Decision

Production multi-hop uses `native.multihop.v1` and explicit roles
`multihop-ingress`, `multihop-transit`, and `multihop-egress`. A path contains
three to eight distinct Node identities. The existing two-Node Relay driver
retains its original contract and `tunex-relay/1` ALPN.

The independently developed Transit v1 modules remain offline components. They
do not become a second production Runner with a competing physical journal.
Their protected high-water can be imported as retired history. The production
adapter reuses the bounded Relay stream and UDP machinery for all three roles,
with a distinct validated contract and `tunex-multihop/1` handshake. Its private
Relay-shaped engine configuration is not an externally accepted legacy command.

This avoids extending one side of the existing two-Node handshake while the
other side still accepts its old meaning. It also avoids implementing a second
TCP half-close, UDP association and drain subsystem for the same Agent.

## Contract and authority

[Execution extension 1](../protocol/agent-deployment-execution-v1.md) is a complete
Node Snapshot that can contain Direct, Relay and multi-hop assignments together.
It requires `executionExtension: 1`. Old Runtime schemas reject it. Capability
negotiation requires `adp.execution.1`, `native.multihop.v1`, and
`multihop.wire.1` on every path Node.

The path digest covers the ordered Node identities, adjacent endpoints,
assignment IDs, sessions, physical fences, target, deployment and Profile.
Each TLS connection verifies the exact neighboring Node URI, current pinned peer
certificate, TLS 1.3, ALPN and adjacent deployment binding. A probe continues
through subsequent Transit nodes. No fallback to legacy Relay or plaintext is
permitted.

A digest is not execution authority. Publication rechecks current grants,
policies, endpoints, sessions, capabilities and credentials, records its maximum
lease in protected Authority, and commits the Snapshot and execution leases.
An Agent persists the complete Snapshot and physical high-water before preparing
or activating sockets. Receipt acknowledgments remain distinct from execution.

## Shared ownership and migration

The production Runtime journal owns all Direct, Relay and multi-hop physical
resources. A physical key is protocol/port, independent of listen address and
Forward role. UDP carried over an internal TLS listener owns TCP.

An owner, role or deployment change requires a higher physical Fence. Unchanged
execution configuration is immutable within an instance. Session and execution
phase cannot regress. Retired high-water survives omission and restart.

`--multihop` requires `--relay` and atomically adds the durable extension marker
to the existing journal. A pre-extension binary rejects the added fields.
Disabling the new Runner option does not erase this marker.
`--import-transit-journal` imports a separate protected journal for the same Node
and key, retires its maximum fences, refuses overlapping current ownership, and
records the imported digest. It cannot import changed history a second time.

Old-session leases must expire or be confirmed safe before a new multi-hop
session receives execution assignments. Cached snapshots never restart sockets.
Normal lease renewal keeps an unchanged engine and its established connections.
Credential or session replacement receives a fresh plan, generation and fences.

## Coordination and recovery

Preparation and activation advance one Node at a time from egress to ingress.
Each cursor requires fresh observations for the exact published Snapshot,
session, assignment, generation, Fence, configuration digest and phase.
The multi-hop cursor is persisted in MySQL, so Control restart does not require
inventing execution reports.

Withdrawal stops renewal for the entire path; worker publication prioritizes
ingress. Remote polling remains asynchronous and existing authority ends at its
original bounded deadline. Historical sessions and detached path Nodes remain
in retirement scans. Resource release and Operation completion wait for all
relevant old leases to become safe.

The Console displays desired topology, actual reports, lease bounds, errors and
isolated resources separately. Restoring a historical Forward configuration
creates a new revision through the normal authorization and reservation path.

## Release boundary

Development execution requires an explicit Control option and Agent opt-in.
Production Control enablement additionally requires an operator-reviewed,
digest-checked evidence bundle for the built source revision. This bundle is
not a cryptographic attestation and does not execute tests itself.

Contract, MySQL, security, existing Relay isolation, three/four/eight-Node
execution, isolated-network faults, physical-host traffic, containers, exact-main
CI, Dev images, and the existing three P0 operational gates remain separate
requirements. A successful compile or same-host namespace run cannot satisfy
physical-host or production-readiness gates.
