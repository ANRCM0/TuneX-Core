# ADR-0031: Bounded Durable Telemetry Rollups

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally, unverified.

## Decision

Add default-off Control `TUNEX_TELEMETRY_ROLLUPS=1` for independently bounded minute
and hour aggregates across process, Host, Forward and Probe telemetry. No Agent
protocol, flag, execution permission, Runtime ledger or Journal change. Original raw
APIs remain unchanged. See [aggregate contract](../spec/telemetry-rollups-v1.md).

Fold both resolutions after raw append but before the original accepted transaction
commits, under its original Node head and a new Scope-only observation budget lock.
Raw deletion may already have occurred within that transaction; durable bounded
cursors provide predecessors independently of raw retention. Rollback removes all
raw/head/aggregate changes; replayed raw head receipts never double-fold. This is not
an asynchronous raw scanner that can lose data after early raw capacity eviction.
Only new accepted observations while enabled are folded; no historical backfill.

Rows are per exact series, not per-Forward totals or a fixed small JSON summary that
hides other identities. Series identity includes family, Node/boot/session, exporter
epoch, counter epoch and applicable immutable execution/Probe identity. UTC receipt
time determines the minute/hour bucket. Valid counter intervals are attributed in
full to their ending receipt bucket, with possible coverage before bucket start and
an explicit boundaryIntervals count. No interpolation or invented uniform traffic.
Raw cumulative values are first/last/min/max observations, never sums of usage.

Gauge count/sum/min/max and valid exact increments retain coverage, baseline/gap/reset/
unavailable/overflow/terminal/truncation markers. Counter deltas require strict same-
identity/epoch/adjacent exporter sequence, increasing uptime and unchanged loss context.
CPU tick sources stay distinct; Host interface totals remain raw observations only,
never inferred rates or Forward sums. No histogram means no p95. No health or billing.

## Durable Budgets And Failure Policy

Migration 0024 owns Scope serialization rows, Node-family loss heads, bounded cursors
and aggregate buckets. JSON body is at most 8192 bytes for each bucket/cursor.
Per Node-family caps: minute 10081, hour 721, cursors 512. Per Scope across all families:
minute 500000, hour 50000, cursors 16384, Node-family heads 4096. Counts include expired
and restored rows. Four-family Node limits do not imply a new raw Scope disk budget.

Scope row serialization covers only observation writes, never Runtime resources.
Actual counts are queried in bounded bulk groups, not trusted increment-only quotas.
Own Node-family oldest rows can be evicted, at most 32 minute/32 hour/32 cursor rows
per 32-observation batch. An overflowing Scope rejects the observation transaction
instead of stealing another Node's rows. Eviction and expired cursors are distinct
saturating uint64 per-Node-family loss counters; Scope-family sums are exact uint128
decimal strings and are not losses of only the selected Forward.

Minute logical retention is seven days and hour thirty days, not guaranteed complete
windows: identity churn/capacity can evict earlier. Physical expiry is bounded, eventual
cleanup, at most 128 cursors followed by buckets within 256 total rows per prune transaction. Prune chooses
one eligible Scope, acquires that Scope's observation lock before delete/loss updates,
and never obtains a raw head or execution lock. Existing two-connection observation
pool/1.5-second deadline/no queue or retry remain. Counts and bounded work are not
measured physical capacity or a zero-contention claim.

## Recovery And Compatibility

Control-only `adp3-telemetry-rollups-v1` has Schema ceiling 0024. Agent ADP/Journal
profiles unchanged; older Control ceilings reject even with aggregation disabled.
Keep Scope heads and Node-family loss history. Original recovery clears only rollup
cursors and marks existing buckets recovery-suspended; restored bucket flags remain
sticky when later writes share a bucket. New observations start baselines, not old
counter continuity. No original raw/Probe/Runtime/Authority/Journal history is erased.

## Evidence

All code, APIs, Console and capacity reporting are local/unverified. Logical JSON
budgets exclude row/index/SQL representation/log/backup overhead. No tests, static
checks, scripts, generators, new fixtures, browser/Compose or CI; no commit/push.
Final-source capacity, contention, rollback/replay, recovery, pagination and duration
acceptance remain required after functionality freezes. D2 is not declared complete.
