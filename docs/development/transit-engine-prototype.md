# Transit execution prototype (isolated behind Go package API)

This slice adds `agent/internal/transit` as a **non-registered, explicit API prototype** for the future `native.transit.v1` driver. Existing `control.Runner`, ADP/3 Snapshot, the persisted Agent journal and the Relay v1 transport are **unchanged**. A user cannot activate it from Console or the shipped Agent process. It is not a production multi-hop feature.

## What this prototype tests

- A trusted caller supplies a valid `TransitIntent`, a single registered local `NodeId`, currently valid mutually trusted Relay peer certificate, and a revocable `authorized()` function.
- `Prepare` confirms exact local URI SAN, trusted CA/pinned local certificate and expiration, validates the separate Transit contract, then installs an active deadline watchdog. `Activate` is **manual and not wired to the Runner**.
- On each upstream connection, TLS 1.3 mTLS requires the exactly specified previous Node and certificate fingerprint, ALPN `tunex-transit/1`; a distinct `hop-open` binds Forward, Scope, Generation, Path/Profile Digest, two Assignment IDs, two Session Epochs, Fences, protocol and hop position.
- The Transit instance then connects to the configured next-hop endpoint only after allowlisted CIDR resolution and the exact downstream mTLS URI SAN/fingerprint have been checked; the next-hop must echo the matching digest, rather than replying as an existing `relay.wire.1` peer.
- TCP and UDP application data are conveyed in existing bounded Relay frame format, one independent authenticated downstream connection per upstream flow, preserving TCP FIN and UDP datagram boundaries. Resource counts share the Agent process-wide TCP/UDP budgets, and revocation/expiry closes listeners and active connections.
- Test-only fake upstream/downstream endpoints exercise real loopback TLS sockets and exact payload; wrong Node, invalid local cert, legacy ALPN, old deployment and revoked authority fail closed.

## Boundaries and next gate

- The end-to-end Control-signed/authorized Transit **Assignment and Journal/Fence state machine are not implemented**. An arbitrary caller cannot be used as a substitute for a real authenticated Control Runtime provenance check. Production `control.Runner` must only construct this engine after recording a fenced, fully authorized, version-negotiated Snapshot.
- A real three-node `A → B → C` Forward is **not implemented**: this slice tests the B engine between synthetic certificate-bound peers. A and C production Agents do not yet speak the versioned hop-open handshake, and the Control planner cannot publish three-node Deployment.
- The prototype uses `tunex-transit/1` TLS ALPN so existing `tunex-relay/1` cannot silently downgrade. The frame envelope is reused, but the application control handshake is separate and must eventually get cross-language TS/Go fixtures.
- Service startup is not an operational endorsement; no production 1Panel instructions, raw credentials or unbounded public listeners are shipped for Transit. Existing multi-hop plans stay rejected at the ADP/3 boundary.

Next implementation step: committed Transit Assignment + durable Fences, per-hop runtime authorization, exact counterpart hop-open contract for A/C, downsteam-first deployment, recovery/drain tests, then actual A→B→C UDP/TCP.
