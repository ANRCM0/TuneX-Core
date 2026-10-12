# VNext Go Agent workspace

Fresh Go 1.26.3 module; old Agent is read-only under `legacy/v2/agent/`.

`internal/contracts` validates ADP/2 direct structural/stateless semantic rules,
exact safe integers, duplicate keys, JCS digests, resource collisions and report
conditions. Schema and Go structs are generated from the authoritative JSON
Schema. Run `npm run contracts:generate` at repository root after contract changes.

`go run ./cmd/adp-validate Snapshot < snapshot.json` inspects an offline message.
It does not authenticate, grant execution, load cached leases or forward traffic.
The online `cmd/tunex-agent` now implements Phase 1 enrollment, mTLS Hello,
Snapshot/Report/ACK, protected persistent high-water state and direct TCP. It does
not restore listeners offline. Renewal keeps the same socket; authorization and
certificate expiry stop tracked connections. DNS results are checked before
numeric-IP dialing. This is an internal direct-TCP milestone, not a production
release. The Phase 2 direct slice adds UDP client associations, TCP listener ownership
transfer, bounded old-stream drain and per-instance cleanup reports. TCP is capped
at 4096 streams per process, UDP at 4096 associations; each also obeys assignment
limits. UDP queues have depth 4 and datagrams are capped at 16 KiB.
Full fault/security and platform release gates remain outstanding.

Setup and network verification: [Phase 1](../docs/development/phase1.md).

Credential rotation and trusted atomic keypair reload: [Node security](../docs/development/node-security.md).
Use `--rotate` after online Hello; counters and current listener state are preserved.
