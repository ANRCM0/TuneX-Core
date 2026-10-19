# ADR-0029: Independent Agent-Visible Host Telemetry

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally, unverified.

## Decision

Keep process telemetry-v1 and Forward telemetry-v1 closed. Introduce the independent
[host-telemetry-v1](../protocol/host-telemetry-v1.md) wire and
[history contract](../spec/host-telemetry-v1.md), default off on Control and Agent.
No ADP/3 execution, Probe authority, Agent Journal or Core entity changes.

Linux sampling reads bounded `/proc` sources and root-filesystem `statfs('/')`.
The source is the Agent-visible OS, filesystem and network namespace, not necessarily
the physical host. Container visibility does not prove physical-host capacity;
cgroup limits, quotas, container entitlement and whole-host ownership are not collected.
Other operating systems report unsupported; failures/missing fields are explicit,
not zeros. Network shows raw bounded interface counters, never inferred rates across
an interface name that can be reused.

Each exporter uses an independent random sample epoch/sequence, ten-second loop,
cloned mTLS transport and two-second deadline. No queue/retry/final-tail guarantee.
OS sampling has a separate 500-millisecond budget and at most one non-authoritative
worker per exporter. A late uncancellable OS result is discarded; timeout cannot
accumulate workers and cancellation does not wait for OS I/O. Samples are at most
8192 bytes and ACKs at most 4096. The existing two-connection
observation pool is shared by all three telemetry families, not duplicated. Four
pre-auth admissions, two active service requests, 1.5-second database deadline and
one-second history actor cooldown bound work; shared hardware and short owner
Scope/credential `FOR SHARE` locks still need capacity/impact acceptance.

Machine TLS/fingerprint is verified before the strict Node claim is authorized by
the existing `Nodes.credential` owner in the observation transaction. History Bearer
authentication uses a short observation-pool transaction with original token semantics;
then a different transaction on the same pool does Scope authorization and projection.
Normal APIs remain unchanged. No Runtime lock/write, publication or execution renewal.

Migration 0022 owns `host_telemetry_heads` and `host_telemetry_points`: independent
intake checkpoint, logical raw TTL 24 hours, 8640 points per Node including restored
history, cleanup at most 256 rows per transaction and query at most 512 points.
The logical body cap is 67.5 MiB per Node, excluding physical database overhead;
capacity can evict before 24 hours. The 30-second cleanup worker processes the three
families serially, one bounded batch each, continuing after a family's failure.
Logical limits are not physical database capacity guarantees. The Control-only
`adp3-host-telemetry-v1` profile has ceiling 0022; older profiles reject even when
the feature is disabled. Agent ADP/Journal profiles are unchanged. Recovery resets
only ingestion heads and marks existing points recovery-suspended after original
credential quarantine, retaining raw history and all protected authorization state.

CPU utilization is a ratio of exact cumulative tick differences only across adjacent
same-session/epoch samples, stable logical CPU count, increasing uptime and no reported
drop/reset. It is not cgroup utilization or resource entitlement. Missing continuity
produces baseline/gap/counter-reset/historical, not synthetic zero CPU or network speed.

## Deferred Evidence

Code, wire/schema, Console, deployment and recovery wiring are unverified local
changes. No tests, checks, generators, browser/Compose validation or Actions were run;
no commit/push. Probe cumulative attempts/successes, rollups, physical capacity and
final exact-source acceptance remain open. D2 is not complete.
