# Forward Ingress Telemetry And History v1

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally,
unverified local changes. [ADR-0028](../decisions/0028-independent-forward-telemetry.md)
and [wire contract](../protocol/forward-telemetry-v1.md) describe the D2-B2 boundary.
This does not complete D2 or establish production readiness.

## Ownership And Scope

Only Direct/Relay/multihop client ingress cumulative payload and TCP/UDP events
are collected. Every point carries full Node/boot/session/assignment/Forward revision/
deployment generation/fence/role/driver/config/resource identity and counter epoch.
Transit and egress never add another hop's copy. Source remains `agent-reported`;
machine authentication and trusted mapping do not make a remote measurement trusted
financial evidence. Health is unknown, execution authorization false.

The Runtime-owned mapping port reads current published assignments or retained
retirements and same-session leases. Its adapter performs at most three SELECTs
for a batch: current Snapshot, trusted Forward ownership batch, exact retirement
tuple batch. It does not compile desired state, publish, acquire Runtime locks,
change readiness or modify the Operation ledger. Safe retirement only establishes
historical provenance. No second Runtime authority or arbitrary Agent Forward label.

## Independent Opt-In And Loss

Control `TUNEX_FORWARD_TELEMETRY=1` and Agent `--forward-telemetry=true` are default
off and separate from process telemetry-v1. Ten-second exporter sampling uses its
own epoch/sequence and cloned mTLS client with a two-second deadline. No queue,
retry, guaranteed final upload or historical replay spool is added. Partial rejects
and failed/missing ACKs increase exporter uncertainty on the next sample.
At most 32 points fit one 64 KiB batch; local tails remain 128 items/ten minutes.
Rotation, eviction, expiry, crashes and outage can omit terminal counters forever.

## Storage And Budgets

Migration 0021 owns per-Node `forward_telemetry_heads` and normalized
`forward_telemetry_points`, separate from 0020 process telemetry. Checkpoint replay,
body conflict, sequence and uptime validation occur before new data replace a head.
Per-Node new-batch intake has a persistent nine-second minimum to allow jitter around
the ten-second Agent interval. The existing two-connection
telemetry pool is shared, without a waiting queue or retries, with a 1.5-second hard
database deadline. Route admission is four pre-auth requests; service admission is
two active requests, and history uses a one-second actor cooldown.

TLS/fingerprint checks precede the existing `Nodes.credential` owner check on the
observation transaction using the strictly parsed Node claim; the redundant main-pool
machine lookup is skipped. History is admission-capped before Bearer authentication,
using `Identity.authenticateIn` with the original hash/query semantics in a short
authentication transaction on the observation pool. After it completes, history opens
a separate Scope-authorization/projection transaction on that same pool; these are
not one atomic transaction. Normal API authentication stays unchanged. Scope/credential `FOR SHARE`
owner locks and database hardware are still shared; no zero-impact guarantee.

Raw logical TTL is 24 hours; per Node at most 4096 points, including restored rows.
Capacity can evict before 24 hours. Per point body is at most 4 KiB and exporter
metadata at most 2 KiB: at most 24 MiB logical JSON per Node, not total physical
database size. Row/index/JSON representation/log/backup overhead needs separate
capacity evidence. Expired physical pruning is at most 256 rows per transaction;
logical retention excludes expired rows even when physical cleanup lags. Queries
return at most 512 points. There are no minute/hour aggregates or percentile estimates.

## History And Console Semantics

```text
GET /api/v1/scopes/{scope}/forwards/{id}/telemetry?from=<canonical-UTC-ms>&to=<canonical-UTC-ms>&limit=128
```

Unknown/duplicate query parameters reject. `from`/`to` are canonical millisecond UTC
ISO strings; default is the last 15 minutes, maximum span 24 hours with a five-minute
clock allowance. `limit` is a canonical positive integer from 1 through 512, default
128. Bearer/Scope authorization and exact trusted Forward-in-Scope lookup apply.

Scope-authorized read-only history uses server receipt time for bounded selection,
explicit UTC times and a bounded limit. Latest describes **one execution instance**,
not whole-Forward totals across protocols, revisions, generations, resources or nodes.
Historical reads do not recheck current binding (`currentBinding:not-rechecked`) or
promise a continuous current machine session; they cannot authorize use of a Node.
Recovery suspension, deleting Forward, disabled intake, closed credential window or
mismatching boot/session make observations historical. A `retired-published` source
can still match the current machine session and be receipt-fresh for up to 30 seconds;
that is not current binding, readiness, a live engine or execution authority. Otherwise
matching-session observations are stale outside the 30-second receipt freshness window.
Unknown counters remain missing, not zero.

The response contains `forwardTelemetryVersion`, `forwardId`, `enabled`, `source`,
`health`, `executionAuthorized`, `observedAt`, `forward`, `window`, `retention`,
`latest` and `items`. Each view has `point`, `exporter`, `receivedAt`, `mapping`
(`source`, `publishedUntil`, `currentBinding`), `recoverySuspended`, `currentSession`,
`nodeRevoked`, `credentialWindowOpen`, `sessionCurrent`, `freshness` and `delta`.
An independent latest query uses an exact-instance/time index for its predecessor;
it does not scan all rule history or create a whole-Forward aggregate.

Rate/delta eligibility requires the same full identity, same counter and sample
epochs, adjacent exporter sequence, increasing uptime and no counter decrease,
overflow, exporter-drop increase, tail eviction/expiry increase or truncated page.
Otherwise use explicit `baseline`, `gap`, `counter-reset`, `terminal`, `unavailable`,
`overflowed` or `historical` states rather than a `continuous` delta.
Terminal data is not live throughput; missing graph points are not zero traffic.
No cross-instance summing, fake p95, UDP delivery success, TCP network loss rate,
host-interface volume or settlement is inferred. Coverage always says history is
incomplete even when a particular selected query is not truncated.

Console integration is a bounded user-requested history view, not background polling
or automatic execution advice. It must display source, timezone, instance identity,
coverage and discontinuity states; loading, empty, disabled and failed reads differ.
Manual windows are 15 minutes / 1 hour / 24 hours with limits 128 / 256 / 512 and
five-second cancellation. Implementation is wired locally but unverified; source
existence is not browser acceptance.

## Upgrade, Recovery And Acceptance

Control-only profile `adp3-forward-telemetry-v1` recognizes Schema 0021. Older Control
ceilings are blocked after migration even with both flags off. Agent ADP/Journal
profiles are unchanged. New Compose flags need matching new Agent images; unknown
false-valued flags do not make old binaries compatible. Never reenroll or erase state
to enable telemetry. See [deployment](../../deploy/README.md) and
[upgrade/recovery responsibilities](../operations/upgrade-assessment.md).

Recovery retains the original maintenance/credential quarantine and protected-state
requirements; then clears only ingestion heads and marks old points
`recovery_suspended`. Original samples remain historical, never a fresh continuous
baseline. New authenticated session/publication provenance is required for new data.
No clearing Journal, Authority, Fence/Generation high-water or historical source maps.

No test, static check, new fixture/generator, database/browser/Compose validation,
Actions run, commit or push is performed in this slice. Later concentrated acceptance
must cover mapping, late tails, replay/conflict/reset, uint64/overflow, partial ACK,
timeouts/admission, bounded cleanup/capacity, restore and Console. Functional evidence
remains Actions-only and must name the final matching SHA. Host resources, Probe
attempt/success counters, aggregates and physical capacity remain open.
