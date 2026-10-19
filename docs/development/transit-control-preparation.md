# Transit Control preparation — stage 4.1/4.2 foundations

Status: **offline proposed path and transactional resource primitive; NOT executable ADP/3 multi-hop**.

This implementation adds the following to the independent, role-neutral multi-hop plan:

- Exact 3–8 Node, locked-Profile, same-Scope capability and adjacent destination-policy checks, rejecting non-advertised adp.multihop.1 / transit.wire.1 / native.transit.v1 capabilities.
- Strict TCP/UDP physical resource inventory. Each Transit/Egress UDP association uses a dedicated internal TLS/TCP listener; no silent port reuse.
- A fully bound and deterministic proposed hop set with current Node sessions, selected live peer certificate pins, every hop's assignment and physical Fence, one deployment generation, Profile digest, full path digest, common shortest expiry, and tail-to-head activation order. Each middle-hop payload is re-validated by the existing Transit v1 parser.
- A separate reserveTransitResources transaction primitive using the existing port_slots table, deterministic Node and port locking, unique physical sockets, owner protection, monotonic Fences, and aggregate per-Node budget.
- Negative tests for absent/foreign/mixed-generation slots, expired peers, invalid versions, scope mixing, and forbidden neighbor access.

IMPORTANT: The physical reservation primitive is deliberately not invoked by deployed Control. It requires a future coordinator that rechecks all authorization in the transaction and persists the entire deployment/operation journal in the SAME transaction, or rolls it back.

## Explicit missing work

1. Wire-version negotiation and compatible versioned ADP/3 Transit Assignment/Snapshot for both TypeScript and Go, without weakening the existing Relay parser.
2. Persistent whole-path deployment and Operation coordinator that retains historical leases/Fences, compensates partial failures, retires stale observations and prevents early ingress exposure.
3. Runner/Journal integration for the isolated Go Transit Engine and downstream-first activation based on real Prepared and Active reports.
4. Actual Control + three Go Agents + independent client/target TCP/UDP E2E across distinct hosts, revocation, restart, recovery and capacity evidence.

The existing Console and ADP/3 Runtime STILL reject any N>2 Relay. No existing Node capability advertisement is modified. Do not hand-inject the proposed intent into a Snapshot or interpret a passing unit test as a production multi-hop release.

Checks: npm run typecheck, npm test, npm run test:go, npm run contracts:check, plus mainline Phase 1, Relay isolation and container security gates.
## 2026-10-19 Foundation Source Follow-Up

Original preparation and exclusive reservations now have public Transit rules,
L2 native framing and the same Runtime resource owner through required raw ports.
The old compiler and reservation entries are precise aliases/bindings; no live
Transit execution is enabled. See [source boundary](../architecture/transit-preparation-reservations-v1.md)
and readiness items 65/66, both unexecuted. Staging/abort and protected release
still need source extraction; historical test descriptions do not verify this source.