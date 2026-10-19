# ADR-0028: Independent Forward Ingress Telemetry

Date: 2026-10-18 (Asia/Shanghai).
Status: implemented locally, unverified; not release approval.

## Context

D2-B1 supplies per-instance ingress payload counters and bounded local terminal tails.
Process telemetry-v1 deliberately cannot acquire payload fields. Arbitrary Agent labels
must not let a machine attribute observations to another Forward, revision or Scope.

## Decision

Use the independent closed [forward-telemetry-v1](../protocol/forward-telemetry-v1.md)
contract, mTLS intake and default-off switches. Each exporter has its own sample
epoch/sequence, ten-second loop, cloned transport and two-second deadline. No durable
queue, retry or final-tail delivery guarantee is introduced. A lost or partial ACK
increases uncertainty rather than fabricating a successful sample.

Runtime owns the read-only mapping port. Its adapter reads a current published
Snapshot, trusted Forward ownership, or an exact retirement and same-session lease.
At most three SELECTs handle a batch of 32 points. Every identity field is compared;
config digest, driver/role, resource, session and Scope bindings remain explicit.
Safe retirements retain historical provenance, not renewed execution permission.
No Runtime controller calls, publication, resource locks or status writes occur.

Observability owns only migration 0021 `forward_telemetry_heads` and
`forward_telemetry_points`. The existing process-telemetry two-connection pool is
shared, not duplicated: no waiting queue/retries, 1.5-second hard database deadline,
four pre-auth route admissions and two active service admissions. User history reads
also have a one-second actor cooldown. These are defensive limits, not capacity evidence.

Both telemetry machine routes verify TLS/fingerprint and authenticate the strict Node
claim via the existing `Nodes.credential` owner inside that observation transaction,
skipping the redundant main-pool machine lookup. Pre-auth admission also precedes
history Bearer lookup; `Identity.authenticateIn` preserves original hash/query semantics
in a short observation-pool authentication transaction, followed by a separate history
Scope/projection transaction on the same pool. Normal APIs are unchanged. Shared owner Scope/credential
`FOR SHARE` locks and shared hardware remain, so no zero-impact claim follows.

Raw logical retention is 24 hours with at most 4096 points per Node, including
restored points. Early capacity eviction is allowed. A point has at most 4 KiB body
and 2 KiB exporter metadata, hence at most 24 MiB logical JSON per Node, excluding
all database/row/index/log/backup overhead. Expiry pruning is at most 256 rows per
transaction; queries return at most 512 points. No rollups or physical-disk guarantee.

History and Console expose one latest instance, not an aggregate of a Forward's
protocols, revisions, generations or nodes. Deltas need exact identity/counter epoch,
adjacent exporter sequence, increasing uptime, no overflow or increasing exporter/tail
loss, and untruncated pages. Otherwise expose baseline/gap/reset/terminal/unavailable/
historical states, not zero rates. Source is agent-reported, health unknown,
execution authorization false; current binding is not rechecked by history reads.

Control compatibility profile `adp3-forward-telemetry-v1` has Schema ceiling 0021.
Older Control profiles are rejected after migration even with telemetry disabled.
ADP/3 and Agent Journal profiles do not change. Recovery keeps original maintenance,
credential quarantine and protected authority requirements, resets only ingestion
heads and marks restored points historical/recovery-suspended.

## Consequences And Deferred Work

See the [functional contract](../spec/forward-telemetry-v1.md). These implementations
and Console integration are wired locally but remain unverified: no tests, static checks, generators,
Compose validation or Actions run for this slice. No commit or push is performed.
Host resources, Probe cumulative attempts/successes, minute/hour rollups, physical
capacity, failure recovery and exact-source acceptance remain open; D2 is not complete.
