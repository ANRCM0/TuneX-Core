# Relay Network Isolation And Activation Faults

Baseline: `8bf7fe4`. Three independent Linux Agents now run in three distinct network
namespaces attached to a uniquely named test bridge. Targets run in their respective
egress namespaces; the client runs in the ingress namespace. A bounded opaque TCP
proxy connects these isolated networks to the actual HTTPS Control. TLS and machine
authentication remain end-to-end, including normal server-name/CA validation.

The harness never changes host forwarding, NAT, firewall policy or existing services.
Only the ingress test namespace receives DROP rules for the chosen egress IP and its
two internal TLS ports. Control connectivity remains available. Actual packet counters,
namespace inodes, API observations and exact tagged TCP/UDP payloads establish the
network fault; stopping an Agent or fabricating a failed Report is not the injection.
Namespace cleanup checks recorded inodes, and host link cleanup checks run-specific
aliases. Process cleanup checks executable, state/run identity and namespace inode.

The socket experiment found that dialing an unreachable peer reused the customer
target error `TARGET_UNAVAILABLE`. Relay now reports that specific connection failure
as `DOWNSTREAM_UNAVAILABLE`, which remains retryable. Customer target refusal/outage
and authorization/lease failures retain their original classifications. A real socket
regression distinguishes a closed peer listener from an unavailable customer target.

## Acceptance

The initial `npm run test:relay-isolation` suite passed 12 checks locally on October
13, 2026, including clean-commit evidence for `132642e`. A thirteenth regression now
checks both authentic Agent Reports while another transaction holds Forward intent.
The expanded 13-check suite passed locally alongside the 20-check switch suite and
7-check direct Linux Agent regression. Each evidence file records its exact SHA and
whether the tested tree was dirty; development runs are not clean-commit claims.

| Cases | Actual assertions |
| --- | --- |
| OPS-03/07 | Holding an authentic prepared downstream Report leaves both ingress listeners closed. A current downstream ready Report cannot advance while the ingress prepared Report has actually aged past freshness. |
| OPS-08 | Downstream reports active/ready, but the real peer path is already blocked. Ingress checks fail with retryable `DOWNSTREAM_UNAVAILABLE`; neither protocol opens and Operation stays running. |
| OPS-08 recovery | Removing the scoped DROP rules restores both exact encrypted payloads without editing intent or replacing execution generation. |
| OPS-08 active fault | Blocking an already active peer path stops both checked payloads and produces degraded current health. The succeeded Operation remains terminal; restoring the link recovers the same deployment. |
| OPS-07/ADP-07 | Replay of an authentic prior-generation ready Report receives duplicate ACK while the successor is preparing. It cannot open the successor ingress or complete its Operation. |
| OPS-04/path compensation | An unreachable replacement egress leaves all six old/new physical reservations tracked. An explicitly injected overdue disposable DB execution_deadline triggers the actual scanner and safe two-role withdrawal. A new desired revision explicitly restores the old path; the failed Operation stays failed and unused replacement reservations release. |
| OPS-07/ADP-10 | A real egress reboot produces a higher session/deployment. Its old signed ready Report receives SESSION_SUPERSEDED while new readiness is held; fresh reports restore traffic without changing desired revision or resetting counters. |
| FWD-10 cleanup | Deletion closes both client protocols and releases all physical reservations after safe retirement. |
| Runtime intent contention | A separate MySQL connection holds the real Forward row FOR UPDATE. Both current Agents must durably advance Report sequence in the same sessions before that intent lock is released. |

Reports held at activation boundaries are genuine Agent observations; receiving time
still defines freshness under ADP semantics. The stale-report test waits real elapsed
time, and no system clock or lease bound is changed. Deadline injection exercises
scanner behavior rather than pretending the default ten-minute timeout elapsed.

Evidence is `.artifacts/relay-isolation/run-*/evidence.json`, including commit/dirty
state, Agent/fixture hashes, OS synchronization, kernel, policy and packet counters.
Failure diagnostics omit credentials and keys. A separate native Linux CI job is
configured; no remote CI execution is claimed.

Shared verification passed 165 TypeScript tests, all Go tests/builds, generated
contract and boundary checks, offline TS-to-Go plan parsing, Go vet and native Linux
race. Successful evidence is written only after owned process/network cleanup passes.

The clean switch regression subsequently exposed a separate pre-existing lock-order
failure. InnoDB confirmed API update held Forward while waiting on runtime_nodes,
and Runtime held runtime_nodes while its unqualified Operation/Forward locking JOIN
waited on Forward. Runtime completion now uses MySQL 8.4 `FOR UPDATE OF o`: it locks
Operation rows and reads intent under the existing Node lock. Forward CAS, Operation
locking and terminal-state/lease checks remain enforced. The authentic-Report
contention regression is also part of the switch suite; it verifies the lock boundary
without substituting a mock callback or broadening transaction retries.

## Running

Build the three Linux executables and configure the disposable MySQL URL as described
in [System time](system-time.md). Linux requires iproute2 `ip`/`ss`, iptables and
permission to create network namespaces: root or passwordless sudo on an isolated
test runner. Agent production privileges are not validated by this root test lab.

```sh
npm run test:relay-isolation
npm run check
node scripts/run-go.mjs vet ./...
node scripts/run-go.mjs test -race ./...
```

Optional `TUNEX_IP`, `TUNEX_SS` and `TUNEX_NETWORK_LIBRARY_PATH` select independently
cached tools. On the current Alpine 3.22.6 WSL host, the existing BusyBox ip lacks
netns support. Alpine-signed iproute2-minimal/ss 6.15.0-r0 and libcap2 2.78-r0 were
fetched, verified with `apk verify` and extracted into ignored `.cache/network-tools/`;
they were not installed into the system. Other environments should use their own
matching distribution tools rather than run these Alpine binaries.

The local topology is Windows locked Control/MySQL plus three isolated WSL Linux
networks on one physical host. It adds genuine namespace partition evidence to the
previous same-host multiprocess suite. It does not establish two-host WAN behavior,
sustained Relay capacity, non-root production limits, complete Linux/external-MySQL
deployment, peer-key/endpoint evolution, Web or release readiness. Those gates remain
open, and the full project goal stays active.
