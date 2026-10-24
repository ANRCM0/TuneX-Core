# Relay Sustained Load And Unprivileged Deployment

Baseline: `a079e96`. The capacity harness adds actual deployment privilege and
sustained-load evidence to the existing Relay switch and namespace suites. It uses
two independent network namespaces and numeric UIDs/GIDs without creating system
accounts. A run-owned opaque TCP proxy preserves end-to-end Control TLS.

Each Agent runs with a 256 soft/hard FD limit, zero effective/permitted/inheritable/
bounding/ambient Linux capabilities and `NoNewPrivs=1`. The harness reads the actual
process status and limits, checks namespace inodes and verifies owner-only state,
machine private keys and journal MAC keys. Native executable and CA copies live in
owned temporary directories; the real kernel time collector also runs under those
unprivileged identities. Time synchronization and leases are never bypassed.

## Acceptance

Run `npm run test:relay-capacity` with a disposable `TUNEX_TEST_DATABASE_URL` and
the same Linux binaries and namespace prerequisites as
[Relay network isolation](relay-network-isolation.md). The Linux runner additionally
requires `setpriv`, `prlimit` and `install` (util-linux/coreutils). Windows/WSL runs
use the inspected private Control interface and project-extracted network tools.

The eight checks require:

1. Real independent non-root identities, zero capabilities, protected files, FD
   limits and synchronized native Linux clocks.
2. Both current Relay roles become active/ready through real Control/MySQL and
   authenticated Agents.
3. Sixteen TCP streams and eight UDP associations verify unique payloads for
   sixty seconds. Both Nodes publish multiple higher Snapshot generations while
   retaining the execution generation. Protected diagnostics record CPU, memory,
   goroutines, descriptors and live flow counts.
4. Both Nodes reclaim all flow counters and return descriptors near baseline.
5. A new immutable Profile revision lowers the shared per-Node connection cap to
   twelve. Ten held TCP streams and two UDP associations keep verifying payload
   while independent extra TCP and UDP clients fail to obtain checked replies.
6. The actual Control stops. Every client continues inside the remaining signed
   authorization, then fails near its real safety deadline. Both Nodes become
   unauthorized with zero flows, and both ingress listeners disappear. No clock
   or database deadline is modified.
7. Control restores its protected authority state; Agents restart under their
   original UIDs with their existing journals and higher sessions. New authenticated
   snapshots restore exact TCP/UDP payloads. A hard-cutoff Agent exits by design;
   restarting Control alone is insufficient.
8. Safe Forward deletion releases all physical reservations after authentic
   removal and historical authorization retirement.

The load fixture emits bounded per-client progress and final facts. Expected
cutoff mode requires every client to have verified payload and every socket to
fail before the configured duration; corruption cannot count as expected cutoff.
Target connection lifetime is explicitly longer than the sustained load.

Successful evidence is written only after executable/run/namespace-checked process
cleanup, verified network teardown and removal of the exact marked native temporary
directory. It records the tested SHA/tree status, binary hashes, topology, real
process limits, resource samples, renewals, individual cutoff timestamps and
recovery sessions in `.artifacts/relay-capacity/run-*/evidence.json`.

## Limits

This is a bounded local sixty-second sample. It establishes neither maximum
supported capacity nor long-duration stability, and the local Control/MySQL are
still Windows processes with native WSL Linux Agents on one physical host.

Readiness probes share the peer connection budget. At exact saturation they may
report downstream degradation while all admitted traffic remains live; evidence
records the actual health and requires the completed Operation to remain terminal.

Automatic live peer renewal, pin transitions and expired-bundle recovery have a
separate [Relay rotation](../development/relay-rotation.md) suite. Complete direct/Relay acceptance,
external deployment, product Web and release gates remain open. The CI entry is configured; a local pass
does not claim a remotely executed CI result.
