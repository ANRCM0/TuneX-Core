# ADR-0041: Bounded Probe Run History

Subsequent [ADR-0043](0043-typed-direct-ingress-probes.md) adds typed ingress
history. Original absent-measurement rows remain egress; new ingress retains
explicit provenance, not a reinterpretation of old results/digests or new health.

Date: 2026-10-18 (Asia/Shanghai). Status: source implemented locally, unverified.
See [contract](../spec/probe-runs-v1.md).

## Decision And Scope

Add bounded persistent history for the EXISTING one-shot Direct TCP Probe workflow.
This implements a previously missing D1 product read surface, not a second Probe
executor, schedule or new Probe protocol. Original permit owner captures issued,
consumed, revoked, withdrawn and accepted-result facts in its SAME transaction.
One retained head per accepted Probe ID records actual owner mutations; no old
permit/result scan, inferred backfill, GET-created history or recreated execution.

Current execution remains Direct TCP/IP-literal target from agent-direct-egress,
zero application payload, maximum2-second permit, existing global256 budget and
original expiry-plus1-second pruning. No DNS/TLS handshake, UDP nonce echo,
Relay/multihop/full-path probing, external observer or persistent scheduling is added.
Known-ID ephemeral receipt API remains separate and may disappear after pruning.

## Ownership And Provenance

`ProbeRunRecorder<Tx>` receives a closed summary only after actual mutation. Its
store owns history, not permit/claim/withdrawal/result authority. Tables have Scope
ownership only and no FK to ephemeral permit/result or current Forward/Node state;
pruning old permits cannot cascade-delete retained runs. History writes do not
extend authorization, refund budget or recreate missing source rows.
New capture is wired without an additional history flag; original execution remains
default off and independently authorized. Detail reads enforce the7-day logical
window even if physical deletion is deferred.

Capture complete original binding/instance provenance, permit times/state and
bounded accepted-result summary. Omit fingerprint, requestId, targets/addresses,
driver config, credentials and raw protocol/result bodies. Manager reads require
current Scope management permission in the projection transaction, using existing
two-slot observation pool, bounded admission and no Runtime-pool fallback.

All output remains historical/agent-reported, health unknown, current binding
not evaluated. Original result digest is captured from owner acceptance, NOT
recomputed from omitted raw wire bodies. A digest of the summarized run is content
identity, not signature, attestation, current authorization or evidence of health.
Missing result is unknown, not unreachable, zero latency or successful measurement.

## Bounded Retention And Recovery

At most1024 runs per Scope, logical7-day history. New insert lazily prunes at most16
expired rows, then evicts one oldest ANY-state history row if full. It may evict an
issued/consumed history head without affecting its real permit. Missing later
update increments updatesWithoutHead rather than reconstructing the lost beginning.
Expiry/eviction/lost-update counters make gaps visible; no full-window guarantee,
physical deletion deadline or universal complete Probe history is promised.

Original recovery sets a sticky history recoverySuspended marker and advances
revision only for newly suspended rows. Preserve recorded state/closedAt/
withdrawnAt/result/updatedAt; do not synthesize new historical
quarantine/withdrawal/result transitions from restored execution rows. Current
execution still follows original recovery owner. Journal/high-water untouched.

## Remaining Scope And Evidence

Manager history API/Console is manual read-only. No current-health aggregation,
success probability, automatic Probe/retry, health-based failover or C3 acceptance.
Longer history is a C3 prerequisite component, not satisfaction of C1/C2/Probe
functional acceptance. Other D1 Probe types/plans remain separate decisions.

Subsequent [ADR-0042](0042-bounded-probe-plans.md) adds finite plans for the existing
Direct TCP type. Accepted plan decisions link Probe IDs to this independent lossy
history; they do not copy results, make history complete or turn plan state into
health. This history owner still never issues or schedules execution.

No tests, static/type/syntax checks, formatters, scripts, generated fixtures,
network feature calls, CI, commits or pushes in this source-only slice. Original
authority atomicity, pruning/capacity, concurrent update/replay, restored history,
redaction and browser behavior need final-source concentrated acceptance.
D1/D3/project and physical/production gates are not declared complete.
