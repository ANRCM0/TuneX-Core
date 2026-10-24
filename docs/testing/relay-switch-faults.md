# Relay Switch And Failure Acceptance

Baseline: `e7e6212`. This slice extends real Relay acceptance to target/path changes
with established TCP streams, same-client UDP route reset, partial protocol activation,
execution deadline cleanup and explicit retry. It also exposes `nodeId`, `role` and
`forwardRevision` on derived API applied observations. Machine Report schema remains
unchanged; these fields come from the accepted Assignment, not from client assertions.

An accepted new desired revision can coexist with healthy old applied execution.
The new suite waits for the exact new deployment generation, Forward revision and
both current active/ready roles. It does not interpret a generic ready health field
or 202 response as proof that the new target is executing.

The fixture supplies two distinguishable tagged targets. A held TCP client consumes
the original target identity and continuously verifies exact replies while a new
Forward target is accepted and deployed. New TCP/UDP probes must reach the successor.
Both Nodes' actual drain reports provide the enforced cutoff; the client must retain
the original stream until that bounded cutoff, and Operation cannot succeed early.
The target-switch sample verified roughly 90-100 old replies while the successor was
active. These are bounded local samples, not long-term throughput guarantees.

A UDP monitor keeps its original client socket, validates per-sequence payload and
accepts the successor tag after reset. It rejects original-target replies after the
successor is established. Lost/in-flight packets are counted and included in evidence;
the suite makes no zero-loss or transparent-association-migration promise.

The path-switch case enrolls a third independent Linux egress identity with a separate
explicit endpoint. New traffic activates tail-to-head on that egress, old TCP remains
on the former path/target until drain, and former internal port ownership is released
only after safe completion. Returning to the original egress uses fresh fences.

An external fixture really occupies the new ingress UDP port. TCP still carries exact
tagged payload, UDP reports PORT_IN_USE, desired remains both protocols and overall
Operation stays running/degraded. The test then writes an overdue execution_deadline
into its disposable database to exercise the actual scanner without waiting ten
minutes. It does not move the system clock or fabricate synchronization. Both roles
withdraw authority, and cleanup retains unreported/historical holders until their
actual lease cutoff. A prior signed Report replay gets a duplicate ACK but cannot
change the failed Operation back to success. Once the external socket is stopped,
explicit retry produces a new Operation/generation with the same desired revision
and restores both encrypted protocols.

```sh
npm run test:relay-switch
npm run check
node scripts/run-go.mjs vet ./...
node scripts/run-go.mjs test -race ./...
```

The complete expanded suite passed 19 checks on October 13, 2026. Shared verification
passed 165 TypeScript tests plus Go tests/build/vet and native Linux race. CI includes
this gate, but no remote result is claimed. Evidence under ignored
`.artifacts/relay/run-*/evidence.json` contains command, commit/dirty status, Agent
and fixture SHAs, actual old-stream reply counts/deadlines, UDP losses and topology.
Failure diagnostics contain bounded Agent errors and public deployment/Operation
state, never private keys, bearer tokens or enrollment tokens.

Local topology is Windows locked Control/MySQL plus three independent Linux Agent
processes and separate clients/targets on one WSL host. It does not establish
two-host/namespace partition behavior, production non-root limits or complete release
readiness. Remaining Phase 3 gates include failed path compensation across network
partitions, stale observations at every activation boundary and sustained resource
pressure. Peer-key/endpoint evolution, Web and release work remain outstanding.

The later [network isolation slice](relay-network-isolation.md) adds actual isolated
network partitions, activation-boundary/old-session checks and explicit failed-path
compensation. It also fixes a Runtime intent-lock deadlock found by this regression.
The current switch command includes the authentic-Report lock-contention check and
passes 20 checks; the earlier 19-check result above is historical slice evidence.
Sustained load and the other stated production/transport/Web/release gates remain open.
