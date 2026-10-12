# Phase 2: direct lifecycle slice

This slice adds the direct TCP/UDP lifecycle to the Phase 1 HTTPS/MySQL/Go path.
It does not claim completion of all Phase 2 security, credential or release gates.

## Control behavior

- PUT requires a complete Core spec and expectedRevision. Canonical no-ops return
  200 without a new revision/Operation; stale CAS conflicts before no-op handling.
- DELETE persists a tombstone revision. Ordinary GET becomes 404 and later PUT or
  retry cannot revive the identity. Idempotent writes replay their original response.
- A failed current Operation can be retried with a new Operation ID without changing
  Forward revision. Retry creates fresh execution generation/fence and retains audit.
- Disable retains logical reservations. Port changes temporarily hold both slots;
  old reservations are released only after successor readiness and safe old drain.
- TCP+UDP reservations commit together. Actual bind remains per protocol: working
  TCP survives UDP failure, desired protocols stay intact, health is degraded and
  Operation cannot succeed until all requested protocols are ready.

Runtime owns durable retirements, tombstones and execution leases keyed by session.
A removed report from the current Agent cannot override an unexpired historical
holder. Cleanup requires the latest authoritative snapshot to exclude stopped
intent and all corresponding leases to have safe retirement. Worker scanning also
withdraws failed assignments and advances cleanup independently of Agent polling.

Migration `0002-lifecycle.sql` adds this ledger. A migration lock and version table
serialize startup; historical Phase 1 snapshots backfill lease maxima. MySQL DDL
is not transactional: partial migration failure stops startup for operator repair.
This is VNext schema evolution; legacy V2 remains unsupported.

## Agent behavior

TCP listener ownership and execution instances have separate lifetimes. Same-port
target change routes new accepts to the new config, while old streams hold their
original config and drain. Old cleanup cannot close successor listeners. Port moves
bind the successor before retiring old accepts. Binding-address replacement that
cannot share a listener stops old accepts and rebuilds explicitly.

UDP uses one connected target socket per client address/port. Every new association
resolves and validates destination IPs before numeric-IP dialing. Idle expiry,
queue/data-size/association limits and reply credit bound resources. Configuration
replacement resets associations; in-flight packets and transparent migration are
not promised. Old cleanup does not release a successor socket.

Process-wide limits are 4096 TCP streams and 4096 UDP associations. Generation
replacements share these limits. Maximum 1000 assignments bounds listening sockets.
Configured per-assignment limits remain additional restrictions; these numerical
bounds are not measured throughput, latency or a production memory/fd guarantee.

Drains report original assignment/generation/fence, remaining streams and a deadline
clipped to the old authorization cutoff. Lease renewal does not renew retired drain
instances. Reports retain exact bytes until a durable matching ACK; completed drain
records are removed only after ACK. Journal is persisted before runtime mutation.

All retirement high-water is retained per current ADP/2. Capacity checks include
prospective tombstones before accepting work; overload fails explicitly. Safe GC
requires a future protocol/ADR and must not erase protection against old owners.

## Commands and evidence

Use the Phase 1 trusted HTTPS setup and run:

```sh
npm run control:cli -- update scope-dev forward-id 1 changed-spec.json stable-key
npm run control:cli -- delete scope-dev forward-id 2 stable-delete-key
npm run control:cli -- retry scope-dev failed-operation-id 1 stable-retry-key
npm run check
node scripts/run-go.mjs vet ./...
npm run test:phase1
npm run test:phase2
```

`test:phase2` needs a built Agent binary in `.artifacts/`, OpenSSL, and disposable
MySQL access through `TUNEX_TEST_DATABASE_URL`. It creates its own database/PKI and
independent Agent, TCP/UDP target and client sockets. Logs/evidence are ignored in
`.artifacts/phase2/run-*/`; certificates and bearer secrets are not committed.
Historical holder expiry and scanner deadline tests explicitly inject isolated
database facts rather than claiming a five-minute host-network partition rehearsal.

Covered cases include target/port switch, old-stream preservation, disable/enable,
delete/reuse, pre-publication late-ready reports, no-op/CAS/replay, UDP isolation,
partial bind, explicit retry, both-protocol release and historical-session fencing.
Go socket tests additionally cover races in ownership transfer, failed-dial budget
recovery, UDP idle/oversize/amplification and process-wide limits.

Remaining Phase 2 work: credential rotation/revocation and target-policy withdrawal,
clock/suspend faults, restart recovery and report failure scenarios, full capacity
measurement, and Linux namespace/host verification. Phase 3 Relay security ADR,
transport contracts, Web product surface and release operations remain later work.
