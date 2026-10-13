# Relay Agent And Prepared Plan

Current Control acceptance and real two-Agent flow supersede the prerequisite-only
status below; see [Relay Control](relay-control.md). This document retains the scope
of the Agent/compiler slice and its original evidence.

Baseline: `f05d187`. Standard Agent has an explicit `--relay` option that advertises
`native.relay.v1` and `relay.wire.1` together with `adp.3`. Without it, a Relay
assignment is rejected before persistent acceptance or socket changes. User-facing
Relay Forward acceptance still requires the pending Control coordinator.

After online Hello and actual OS clock validation, Relay Agent requests its dedicated
peer leaf through the authenticated current machine session. The CSR/request/key
survives a lost response. The returned keypair must match the Node URI, trusted CA,
dual EKU, fingerprint, leaf expiry and effective database validity. The bundle is
stored with a MAC using the Agent protection key outside its state directory.
Changing effective expiry, corrupting the bundle or substituting an identity refuses
startup; it does not trigger replacement issuance. An existing valid bundle is
reused on restart. Expired/corrupt peer state requires operator repair or explicit
rotation; automatic peer rotation is not part of this slice.

Complete ADP/3 snapshots persist before execution. Prepared egress binds only its
authenticated internal TLS resource. Prepared ingress keeps the client listener
closed. Ingress activation checks the real active peer and exact deployment binding;
reconciliation probes again to report downstream loss. Prepared rejection retains
`DOWNSTREAM_NOT_ACTIVE` as retryable. Network unavailability is distinguished from
policy denial. Credential authorization and execution tickets jointly bound IO.
Snapshot renewal reuses execution instances; removal retires the physical fence and
drains according to the existing bounded policy. A retired instance cannot reactivate.

`compileRelayPlan` consumes already-authorized Node/Profile/endpoint facts and exact
exclusive reservations. It compiles both protocols/roles with common deployment
generation, both current session epochs/fences, locked Profile digest, peer pins,
role-specific target policy and an authorization bound covering both Nodes' machine
and peer credentials. Every output is strictly parsed as ADP/3 and immutable. It
does not reserve resources, issue authority, advance readiness or publish a Snapshot.
Persistent allocation and prepare/activate coordination remain required.

Verification has two distinct scopes:

- Go tests run two Agent Runner reconcilers against simulated Control endpoints and
  real mutually authenticated TLS/TCP/UDP sockets. They check persistence, prepared
  rejection, active recovery, large half-close payload, UDP reply, renewal, downstream
  loss, disabled capability and retirement. This is not a real Control acceptance test.
- `npm run test:relay-agent` runs an independent Linux Agent against real MySQL/HTTPS
  Control. Nine checks validate actual peer issuance/MAC bundle, direct TCP/UDP,
  hard cutoff, offline/online restart, identity reuse without reissuance and cleanup.
  This does not send cross-node Relay user traffic through the Control coordinator.

The harness supports native Linux and Windows/WSL through the existing native adapter.
Local evidence uses Windows locked Control/MySQL plus Linux Agent/client/target; CI
is configured but no remote run is claimed. Logs and evidence exclude peer keys and
tokens. Evidence remains in ignored `.artifacts/linux-agent/run-*/evidence.json`.

```sh
npm run check
node scripts/run-go.mjs vet ./...
node scripts/run-go.mjs test -race ./...
npm run test:relay-agent
```

Next: durable multi-Node allocation and readiness coordination, authorized Forward
acceptance, actual two-process Relay traffic and failure/replacement cleanup. Phase 3
and project completion remain open until those and the release gates are verified.
