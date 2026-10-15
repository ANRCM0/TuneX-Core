# ADP/3 complete execution extension 1

Status: implementation prepared, default-off, awaiting unified runtime acceptance.

The authoritative schema is
[adp-v3-execution.schema.json](schemas/adp-v3-execution.schema.json).
Shared TypeScript/Go vectors are
[adp-v3-execution.json](fixtures/adp-v3-execution.json).
The design decision is [ADR-0005](../decisions/0005-mixed-multihop-execution.md).

## Negotiation

The base machine protocol remains ADP/3. A complete Snapshot containing a
multi-hop assignment or retirement includes `executionExtension: 1`.
An extension-aware Agent advertises:

```text
adp.3
adp.execution.1
native.multihop.v1
multihop.wire.1
tcp and/or udp
```

The production Agent enables these capabilities only with `--relay --multihop`.
Control requires the extension on every path participant before accepting the
plan. Legacy Runtime and Relay schemas are unchanged and reject the extension.
It is never delivered as an executable offline Transit preview.

## Complete Node state

The Snapshot retains the existing Node/session/generation, complete-set flag,
issued/valid-until times, digest, assignments and tombstones. Direct and Relay
assignments keep their existing shapes. Multi-hop assignments have:

```text
driver.id = native.multihop.v1
driver.schemaVersion = 1
driver.config = { hop: HopConfig }
role = multihop-ingress | multihop-transit | multihop-egress
```

HopConfig contains the Scope/Forward/revision/deployment, immutable Profile and
digest, protocol, target, local hop index, local destination policy, ordered
three-to-eight-Node path and path digest.

Each path entry binds Node ID, assignment ID, session epoch, physical Fence,
peer certificate fingerprint, local listen address, advertised host and port.
Ingress's host field is not dialed by another path participant; an unspecified
ingress listen address uses canonical `localhost` in that unused field.

Ingress owns a TCP or UDP user listener matching the business protocol.
Transit and egress own internal TCP/TLS listeners, including for UDP business
traffic. Physical collisions consider protocol/port across all drivers and
listen addresses.

There is no partial transit-only Snapshot. Omitted assignments retire through
the normal complete-set lifecycle. Renewal changes the enclosing lease without
changing an execution instance's configuration or reopening listeners.

## Peer handshake and data

Multi-hop ALPN is `tunex-multihop/1`. TLS is mutually authenticated TLS 1.3,
without session resumption or plaintext downgrade. Node URI and exact peer pin
checks remain mandatory in both directions.

The bounded length-prefixed Open message retains the Relay wire-v1 fields and
adds `pathDigest`. Its adjacent binding matches the two neighbors' assignment,
session and Fence values. Accept binds the digest of:

```json
{"binding": "<adjacent binding object>", "pathDigest": "<full path digest>"}
```

These placeholders describe the shape; the actual binding is an object.
Legacy peers cannot negotiate this ALPN or accept the additional field.

Transit relays the existing bounded TCP/FIN/close/UDP frames over a separately
authenticated downstream connection. Frame, datagram, session and connection
limits apply at each hop. Each UDP client has an independent association;
drain and hard expiry close UDP associations. TCP half-close is carried in both
directions and established traffic cannot outlive its authorization or drain
deadline.

## Report and ACK

The existing ADP/3 execution Report and durable ACK remain authoritative for
receipt and observation. Reports carry assignment/generation/Fence/phase and
prepared, ready, draining, absent or error conditions. They do not grant
execution permission and cannot extend an earlier instance's lease.

Control advances only with current session, exact current published Snapshot,
fresh observation, unexpired lease and matching assignment configuration.
Duplicate Report sequence/body pairs receive duplicate ACK. Changed bodies,
foreign instances, stale sessions and unissued generations are rejected.

Control authorization, Agent execution and verified end-to-end traffic are
three independent facts. A ready Report does not certify traffic acceptance.
