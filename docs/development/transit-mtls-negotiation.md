# Transit ADP/3 contract negotiation — live mTLS boundary, NO execution grant

This stage adds a **real authenticated HTTP endpoint** `POST /agent/v3/transit/hello` using existing Node machine certificate middleware and `X-TuneX-Session-Epoch`. It does not enable multi-hop.

## Protocol

`docs/protocol/schemas/adp-v3-transit-negotiation.schema.json` is authoritative; the Go package `agent/internal/transitnegotiation` embeds a byte-identical schema. The TS parser is `parseTransitNegotiation`.

Requests require:

- ADP/3 `protocolVersion:3`, `extensionVersion:1`, the exact three ordered `requiredCapabilities`.
- Node/Boot/Session identity matching the **current** stored ADP/3 Hello.
- `lastStoredTransitGeneration:0`. An Agent with historical Transit Journal data is rejected until the future durable cross-role reconciliation procedure exists. The caller MUST NOT erase its journal.
- Authenticated machine mTLS certificate still valid and not revoked or retired, with Node not revoked, and the capabilities already advertised in the Node's authoritative ADP/3 Hello.

The Control response is immutable in meaning: `state:"contract-only"`, `executionEnabled:false`, same Node/Boot/Session/capabilities, server UTC time. No token, port binding, lease, next hop, Runner grant or executable Snapshot is returned. A client must reject attempts to inject any execution authority or change the session. Strict TS and Go parsers reject unknown properties, wrong versions, reordered/missing capabilities, malformed IDs and any `executionEnabled:true`.

The production Go Agent currently only advertises Direct/Relay. It does **not** call this new endpoint or advertise these three capabilities; this is intentional until a safe runtime capability gate and the first real authorized command/receipt transport exist. The endpoint can be exercised through authenticated fixture clients but must not be presented as multi-hop support in the Console.

## Required follow-ups

1. Implement explicitly enabled, rollbackable **live** full-path authorization and resource ownership across Direct/Relay/Transit before a real Transit command is issued. An existing Relay lease/Hello is insufficient.
2. Use authenticated, durable, **acknowledged** Transit command and report transport; bind each operation to immutable per-hop assignment/Fence/Session, current credentials and journal generation.
3. Integrate the Go Runner with a new combined resource owner; use the existing offline TransitController only after successful live feature negotiation.
4. Validate three independent hosts for UDP/TCP traffic, partition, restart, replay, credential revocation and report delivery failures.
5. Keep `executionEnabled:false` and leave old `/agent/v3/snapshot` Direct/Relay-only until **all** above gates pass.

## Acceptance

Run `npm run contracts:check`, `npm run check`, `node scripts/run-go.mjs test -race ./...`, and CI's real MySQL `transit-negotiation.test.ts`. This test covers valid read-only acknowledgement, stale Boot, wrong Epoch, wrong/revoked/retired certificate, absent advertised capabilities, and nonzero cached generation. It must not mutate any Transit deploy/coordination journal or create sockets.
