# ADR-0042: Bounded Existing Direct TCP Probe Plans

Subsequent [ADR-0043](0043-typed-direct-ingress-probes.md) extends the immutable
kind choice to same-Agent Direct ingress, preserving all finite bounds/current
authority and cancellation/recovery semantics. Original egress plans do not change
meaning; no plan or completed counter becomes target-health evidence.

Date: 2026-10-18 (Asia/Shanghai). Status: local source implementation, unverified.
See [contract](../spec/probe-plans-v1.md).

## Scope And Immutable Intent

Add a finite persistent application plan for the existing Direct TCP/IP-literal,
agent-direct-egress, zero-application-payload Probe. A plan is immutable stored
intent, not a permit, execution credential, current binding or target-health fact.
It fixes creator, Scope, Forward revision, timeout, manual/scheduled mode, interval,
maximum decisions and end time. Creation performs original-owner current preflight
and stores its original binding provenance but does not issue a Probe.

No DNS/TLS/UDP/Relay/multihop/external-observer protocol, new Agent worker or
long-lived executable grant is introduced. Original short-lived permits,
registration, claim, watched one-use execution, result acceptance, budgets and
pruning remain the only execution path. A trusted owner-supplied plan end cap can
shorten a newly issued permit, never extend its original maximum two seconds.

## Authorization And Atomic Decision

Each manual decision requires the caller's current Scope manager permission and
original Node Grant through the original issuer. The creator must still be a
current Scope manager. Scheduled decisions use the original creator's current
Scope manager permission and original Node Grant, not the worker's service identity.
Pinned Forward revision is never silently rebased. Current instance/session and
published execution authority are resolved again by the original permit owner.

Original permit acceptance, ProbeRun capture, plan decision/head and outer command
idempotency response share one supplied transaction. There is no child idempotency
key or post-commit manufacture of a missing plan receipt. A savepoint may classify
only known original-owner rejection codes into a retained decision, including the
explicit retryable PROBE_PERMIT_LIMIT/429. SQL, integrity and uncertain-clock errors
fail the whole transaction rather than becoming invented rejected execution facts.

Accepted and classified rejected issuance decisions both consume a finite plan
slot. They do not count actual sockets, completed measurements or success/failure
samples. Temporary rejection does not refund a slot. Permanent authorization or
pinned-revision loss suspends future decisions; no second actor/service can take
over the creator's delegated scheduled authority.

## Bounds, Cancellation And Recovery

Plans last at most one hour and have 1..16 issuance-decision slots. Scheduled
intervals are 30..3600 seconds; manual interval is null. The independent scheduled
worker is default off, checks one item per one-second tick, and requires explicit
TUNEX_PROBE_SCHEDULE plus the original execution opt-in and one-second clock policy.
Incomplete enablement rejects startup. Next due time follows decision time plus
interval capped at the fixed end: late ticks are not replayed, accumulated or
issued in a catch-up burst. An unchanged candidate header can be deferred after
whole-transaction failure to the tick cutoff plus five minutes; this is not a
decision, expiry extension or retry of an uncertain committed permit.

Cancellation only prevents future plan decisions. It neither withdraws already
issued permits nor refunds their original reservations; original explicit Probe
revocation remains separate. A current manager may cancel after original grants
are lost. Plans have no edit, rearm, automatic resume or continuation by cloning
old authority; a new intention requires a new explicit create command/key.

At most 32 heads per Scope, including retained terminal plans. New creation lazily
prunes terminal history older than seven days and may evict oldest terminal rows,
never active plans. Loss counters describe omitted history, not target failures or
capacity evidence. Recovery terminally suspends active plans and marks provenance
sticky while preserving decision IDs/receipts and cancellation facts. It does not
resume scheduling, recreate permits or catch up missed ticks.

## Read Model And Evidence

Manager-only bounded list/detail reads use the independent two-slot observation
pool and current transactional Scope authorization, with no Runtime fallback,
permit inspection, network action or GET-generated work. Accepted probe IDs can
link to separate lossy ProbeRun history; plan storage does not duplicate result
bodies or aggregate health. Plan state, acceptedCount and worker configuration do
not prove execution, delivery, liveness, completeness or current target health.

No tests, static/type/syntax checks, scripts, formatters, fixtures, CI, network,
commits or pushes are performed in this source-only slice. Final-source atomicity,
concurrency, creator/grant revocation, finite scheduling, recovery, retention and
browser acceptance remain open. D1, C3 prerequisites and project completion are
not declared complete.
