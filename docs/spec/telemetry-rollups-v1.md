# Telemetry Minute/Hour Aggregates v1

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally, unverified.
[ADR-0031](../decisions/0031-bounded-telemetry-rollups.md) defines ownership and budgets.

## Enablement And Atomicity

Control-only `TUNEX_TELEMETRY_ROLLUPS=1`, default 0, enables aggregates for newly
accepted process/Host/Forward/Probe observations. Their independent intake switches
still apply. There is no Agent flag or wire change and no backfill of older raw rows.
Disabling aggregation leaves legacy raw behavior and existing aggregate history intact.

Both minute and hour rows, bounded predecessor cursors, raw append and raw ingestion
checkpoint commit in the same original transaction. Raw append may prune raw rows
before aggregate folding; cursors are separate durable observations, not pointers into
raw rows. Fold failure rolls back the whole observation transaction, not execution.
Retries returning an existing raw receipt do not aggregate again. Execution authority,
Probe permit/result owners, Journal and protected high-water are unchanged.

## Exact Series And Statistics

One row identifies Scope, Node, family, resolution, UTC receipt bucket start and exact
seriesKey. Series includes boot/session/exporter epoch/counter epoch and applicable
immutable execution or Probe binding/instance. Forward ID alone is never a continuity
key or a whole-rule total. No arbitrary labels or unbounded per-Forward quota namespace.

Bucket body contains series identity, start/end, sampleCount, received/captured bounds,
quality, coverage, gauges, cumulative observations and valid increments. Gauge stats
retain count/sum/min/max and applicable elapsed interval. Cumulative values retain
count/first/last/min/max; they are not summed as usage. Increments use exact eligible
differences, not interval estimates through missing samples. Source counters and
decimal sums stay exact; unsafe Number conversion is forbidden.

Gauge and increment stats use closed `{count,sum,min,max,elapsedMs}` objects;
gauge elapsedMs is zero and its mean is an arithmetic observation mean, not a
time-weighted average. Increment elapsedMs includes only that metric's eligible
continuous intervals, so missing CPU does not dilute its denominator. Cumulative
stats use `{count,first,last,min,max}`, without sum or an inferred delta. Source
values/min/max use canonical uint64 decimal strings; sums use canonical uint128
decimal strings, since even valid uint64 observations can sum beyond uint64.
Counts are bounded by 1000000 per bucket and persisted numeric timestamps/elapsed
values remain safe integers. API bucket timestamps are UTC Unix milliseconds;
query and observedAt timestamps are canonical UTC ISO millisecond strings.

Fixed metric names are family-specific; Host network long history contains only
interface coverage counts, not interface-name labels or byte totals/rates. Process
CPU derives from eligible cpuTimeNanos/elapsed, while Host CPU uses eligible tick
increments with a stable logical-processor context. Probe completed valid outcomes
can exceed new attempts when work started earlier; any displayed completed-result
subset ratio excludes unknown/inFlight and is not the bucket's attempt failure rate.

Valid intervals belong entirely to the END receipt bucket. Coverage may begin before
that bucket's start; boundaryIntervals exposes this. Whole-bucket queries are not raw
time clipping, and increments must not be interpolated into uniform rates. First
observation is baseline; identity/epoch/reset, exporter loss, tail loss, sequence gaps,
unavailable/overflow/terminal and truncated pages retain explicit quality. No zeros
are fabricated for absent observations or evicted series. Host network is raw only;
CPU ticks, Probe valid-result/unknown and inFlight meanings retain their source contracts.
No p95, health, packet-loss probability, settlement or complete history claim.

## History API

```text
GET /api/v1/scopes/{scope}/nodes/{node}/telemetry/aggregates?family=process|host&resolution=minute|hour
GET /api/v1/scopes/{scope}/forwards/{id}/telemetry/aggregates?family=forward|probe&resolution=minute|hour
```

Closed query also permits `from`, `to`, `limit`, `seriesKey`, `after`; unknown,
duplicate or empty values reject. UTC canonical millisecond from/to must align to
the selected bucket width. Selection is half-open `[from,to)` over bucket starts;
to may include the next aligned boundary so the open current bucket is visible.
Span is bounded by minute seven days/hour thirty days; limit is at most 512.
`family` is required; omitted resolution defaults to minute. Default window is one
hour for minute resolution or seven days for hour resolution, ending at the next
aligned boundary; default limit is 128. Times select whole buckets, not clipped
within-bucket raw data.
Optional seriesKey selects one exact series. There is no global snapshot across pages.

`after` is the application-produced keyset cursor `(start,nodeId,seriesKey)`. One extra
bounded row determines truncation/nextAfter. Concurrent intake, pruning, expiry and
capacity eviction can change later pages; no offset pagination or complete-range claim.
Scope authorization and exact target ownership precede projection. History authentication
uses the existing short observation-pool Bearer transaction, then a separate Scope/read
transaction on that same pool; normal API semantics remain unchanged.

Response identifies resolution/window, source/false execution authorization, policy,
loss counters, exact bucket records and sticky recovery flags. Forward history loss
annotations are Scope-family totals, not losses solely attributable to that Forward.
Node reads use Node-family losses. Source health and current binding are not rechecked
or improved by aggregation. Console is explicit manual history and must retain identity,
open-bucket, coverage, loss/recovery and non-completeness labels.

## Hard Budgets And Capacity View

| Budget | Minute | Hour | Cursors / Heads |
| --- | --- | --- | --- |
| Node-family | 10081 rows | 721 rows | 512 cursors |
| Scope, all families | 500000 rows | 50000 rows | 16384 cursors / 4096 Node-family heads |
| Body | 8192 bytes | 8192 bytes | 8192 bytes per cursor |

Hard counts include expired and recovered rows. Identity churn can shorten observed
coverage even inside seven/thirty days. Own Node-family overflow deletes its oldest
rows in bounded batches (at most 32 minute + 32 hour + 32 cursor per append); Scope
overflow rejects the observation transaction with capacity unavailable rather than
evicting another Node. Persistent heads/loss markers remain and count toward head slots.

Cursor TTL is 24 hours. Prune visits one oldest eligible Scope, locks only its telemetry
budget and deletes at most 128 expired cursors, then uses the remaining budget for
expired buckets, at most 256 cursor/bucket rows total, including cursorExpired
loss updates. Bucket expiry is ordinary retention; early capacity eviction is separate.
Loss heads saturate uint64; Scope-family sums use uint128 strings. Cleanup is eventual,
and saturated/busy maintenance may defer it. Existing two pool slots/1.5-second deadline,
admission limits/cooldown and no queue/retry remain; database hardware/owner locks are shared.

Scope capacity reporting returns actual rows plus policy and logical JSON budgets.
Counts remain inspectable above policy caps after restore/operator modifications;
that does not permit append to exceed its hard limits. Background cleanup can lag
arbitrarily while maintenance, saturation or worker disablement persists; logical
query windows are not physical TTL deletion or complete-window guarantees. Scope
aggregate caps bound only these rollup rows, not raw telemetry or whole-database disk.
`GET /api/v1/scopes/{scope}/telemetry/capacity` accepts no query parameters and uses
the same bounded read authorization/admission path. It returns enabled/observedAt,
policy, actual minuteRows/hourRows/cursorRows/nodeFamilies and logicalBudget with
`scopeRawHardCap:false`, `physicalBytesMeasured:false`; no throughput benchmark or
production capacity approval is implied. Aggregate history returns target/family,
enabled/source/unknown health/false execution authorization, observedAt, window with
nextAfter/truncated, retention policy, scoped losses and body/recoverySuspended items.
Each Node-family max bucket JSON is 84.390625 MiB plus 4 MiB cursors; all four Node
families permit 337.5625 MiB bucket JSON plus 16 MiB cursors. Scope aggregate-only
limits permit 4296.875 MiB bucket JSON plus 128 MiB cursors. These exclude loss heads,
raw rows, indexes, SQL JSON representation, binlogs, temporary space and backups.
Existing raw per-Node bounds do not impose a raw Scope hard cap, and physical bytes
have not been measured. This is a finite logical policy, not tested disk sizing.

## Recovery And Evidence

Schema 0024/Control-only profile `adp3-telemetry-rollups-v1` retains older rejection
even with feature off; Agent profiles unchanged. Original recovery keeps aggregate
Scope heads/loss heads, clears only cursors and marks old buckets recovery-suspended.
The flag is sticky under later updates; imported data never becomes a current baseline.
No deletion of raw, Probe claim/results, Runtime, Authority, Journal or Fence/Generation
history to enable this feature or bypass partial DDL/version rejection.

No tests/checks/scripts/generators/new fixtures/browser/Compose/CI or commit/push in
this slice. Raw replay/rollback, four-family identity/interval quality, cardinality,
capacity rejection, keyset concurrent reads, recovery, sustained disk and Runtime
interference require concentrated final-source acceptance. D2 remains unverified/open.
