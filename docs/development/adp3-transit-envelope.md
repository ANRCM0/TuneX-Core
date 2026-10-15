# ADP/3 Transit extension v1 — offline resource envelope

**Status: contract-only; NOT published by Control, NOT executable by the deployed Agent Runner.** Introduced after PR #104.

The authoritative schema is [adp-v3-transit.schema.json](../protocol/schemas/adp-v3-transit.schema.json); the Go parser embeds a byte-identical copy. New parsers:

- TypeScript: `parseTransitAdpAssignment`, `parseTransitAdpSnapshot` in `packages/contracts/src/adp3-transit.ts`.
- Go: `adp3transit.ParseAssignment`, `adp3transit.ParseSnapshot` in `agent/internal/adp3transit`.
- Both validate a strictly versioned ADP/3 extension, then independently parse the nested Transit v1 intent, check its JCS config digest, node/session/assignment/deployment/Fence identity, physical TLS/TCP resource and snapshot JCS digest, lease bound, order, and tombstone high-water.

The extension deliberately uses a **separate envelope** (`protocolVersion:3`, `extensionVersion:1`, `kind:"transit-snapshot"`) rather than modifying existing `adp-v3-runtime.schema.json`. A Transit Assignment has `role:"relay-transit"`, `driver.id:"native.transit.v1"`, and `driver.config.intent` containing a strict Transit v1 intent. Even logical UDP uses a physical `resource.protocol:"tcp"` listener. Unknown fields in the nested intent are forbidden by the reused Transit v1 parser.

The snapshot requires, in exact order, `["adp.multihop.1","transit.wire.1","native.transit.v1"]`. The explicit helpers `requireTransitAdpCapabilities` and `RequireCapabilities` reject a missing capability. Parsing an envelope **does not** establish that this Node advertised capabilities, that the peer credential is live, that a MySQL Fence is current, or that an execution lease is authorized. Those are online Control/Runner responsibilities still to be implemented.

## Isolation and release gates

1. Existing ADP/3 Runtime Schema, Go Runner, publisher, Hello and Report handling are unchanged. Old Agents reject the extension and cannot interpret it as Relay; this PR does **not** turn on Multi-hop.
2. The new standalone Snapshot is a **conformance format**, not yet the production complete mixed Direct/Relay/Transit Snapshot. A future deployment coordinator must design atomic mixed-role publishing and state migrations; never inject this envelope into live Snapshot storage.
3. Both parsers must reject the same negative class: unsupported versions/roles, unknown fields, different identity/session/Fence, wrong physical port or protocol, wrong digest, duplicate/conflicting slots, out-of-window authorizations, and retired Fence resurrection.
4. `npm run check` / `npm run contracts:check` checks that the embedded Go Schema is identical and the old Runtime Schema remains fail-closed; Go and TypeScript tests cover offline semantics. Real MySQL staging acceptance is separate, already in PR #104.
5. Next: versioned capability negotiation on actual Agent Hello, durable downstream-first coordinator, Go Runner/Journal integration with live lease and fencing checks, and three independent Agent TCP/UDP E2E + partition/revocation tests **before** enabling runtime execution.

Do not equate contract conformance with production authorization, liveness, or availability.
