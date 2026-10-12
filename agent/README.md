# VNext Go Agent workspace

Fresh Go 1.26.3 module; old Agent is read-only under `legacy/v2/agent/`.

`internal/contracts` validates ADP/2 direct structural/stateless semantic rules,
exact safe integers, duplicate keys, JCS digests, resource collisions and report
conditions. Schema and Go structs are generated from the authoritative JSON
Schema. Run `npm run contracts:generate` at repository root after contract changes.

`go run ./cmd/adp-validate Snapshot < snapshot.json` inspects an offline message.
It does not authenticate, grant execution, load cached leases or forward traffic.
Online Control Engine, durable high-water journal and the network Forward Engine
are subsequent work; this validator is not a deployable Agent daemon.
