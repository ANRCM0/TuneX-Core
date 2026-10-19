# ADR-0040: Bounded Notification Delivery

Date: 2026-10-18 (Asia/Shanghai). Status: D3-B2 second slice locally implemented,
unverified. Supersedes the deliberately unconnected delivery boundary in
[ADR-0039](0039-protected-notification-endpoints.md), not its historical status.
See [contract](../spec/notification-deliveries-v1.md).

## New-Event Handoff And Independent Ownership

New station events may hand off to the notification outbox in the SAME supplied
SQL transaction as event/condition state. No scan/catch-up of old station events.
Select at most16 configured enabled endpoint recipients by policy/event kind.
Global delivery flag off records disabled suppression instead of queueing; silenced
events record silence suppression. Recognized malformed route metadata records
routing rejection, not raw secret/error details. Unknown SQL/storage errors roll
back the WHOLE event transaction; never pretend an uncommitted event was retained.
Queue capacity rejection is separately counted per recipient and does not discard
the source event. Observability/notification failure never changes Runtime success.

Notification owns bounded outbox heads, attempt metadata, endpoint rate reservations
and losses. It does not mutate Forward/Operation/Probe, reconstruct health or own
station-alert conditions. Default-off `TUNEX_WEBHOOK_DELIVERY=1` requires the independent
protected vault; server startup rejects enabling delivery without it. Enabled is
permission to run, not proof of worker liveness; worker:false disables automatic ticks.

## Stable Identity, Claims And Uncertainty

One retained delivery per Scope/event/endpoint has a stable ID and fixed version1
summary payload. The payload excludes raw event evidence, source configs and secrets.
Canonical closed field order makes exact wire bytes stable across SQL JSON key
reordering. HMAC signs deliveryId + newline + body without per-attempt timestamp.
Receivers MUST deduplicate stable delivery IDs. Unknown network acceptance and
expired claims can lead to repeated delivery attempts: no exactly-once, ordered,
guaranteed eventual delivery or complete event-history promise.

Freeze endpoint revision/credential revision, policy config revision, both managing
actors and Authority digest. Queue stores NO URL/key/credential reference. Claim
transaction rechecks current owners/authorization/config/silence and persisted
endpoint rate, reserving at least the configured10-second interval and at most2
active claims per Scope. AttemptCount/fence advance together; lease is30 seconds.
The single host worker remains non-reentrant through actual network drain.

DNS and HTTPS run outside SQL transactions. AFTER every DNS answer is public and
BEFORE request creation, a short preflight transaction rechecks current authority,
both managers, endpoint/policy/config, silence and exact live claim/fence with at
least5 seconds remaining. Lost authorization, configuration changes or current
silence cancel old work without later catch-up. Revocation after last preflight
cannot retract a dispatched request:5-second sender budget is bounded, not zero
revocation latency or a transaction spanning remote HTTP.

Expired claimed work is first recorded unknown/ATTEMPT_EXPIRED, then backoff or
dead-letter; do not immediately send again. A response after losing the claim must
not overwrite a newer fence. HTTP 2xx means HTTP acceptance, not business processing.

## Bounds And Protected Material

Scope outbox1024 rows including terminal, attempt detail256 rows, maximum6 attempts,
event lifetime1 hour, terminal retention7 days. Prune at most16 old terminal heads
per insert, or one oldest terminal head under capacity pressure; never evict active
work. Full active queue rejects new recipients visibly. Attempt details may evict
ANY oldest entry with losses, including a pending detail; head attemptCount/fence
remains authoritative and cannot be reset by detail retention. Backoff30 seconds
through5 minutes is bounded; no unbounded automatic or manual retry loop.

Per-attempt vault acquire pins the verified current credential reference in process;
GC excludes all pins. Release only after sender.idle confirms actual DNS/guard/socket
completion. Worker holds processing ownership until then, even if send returned a
deadline result early. Uncancelable OS lookup/guard can hold bounded capacity and
shutdown indefinitely; operator stop is not silently reported as successful drain.
No queue scans infer vault references: every attempt reacquires exact current
endpoint revisions, and rotation cancels stale work. Single vault writer still applies.

UTC wall time governs stored lease/backoff/expiry and assumes trustworthy operator
clock; monotonic5-second network deadline prevents late guard/DNS dispatch.
No arbitrary clock rollback tolerance, physical host capacity or malicious root/
same-UID runtime defense is implied by these metadata limits.

## Recovery And Remaining Evidence

Original recovery quarantine cancels queued/claimed/retry-wait deliveries and
marks retained history recoverySuspended. Already terminal results remain historical;
no old queue automatically resumes or replays. Endpoint/policy explicit re-adoption
does not reconstruct or send old source events. Journal/high-water untouched.

Schema0031 owns notification metadata only. HTTPS/DNS safety and vault protections
from ADR-0039 remain, now with post-DNS preflight and actual-drain leases. This source
slice has no tests, static/type/syntax checks, formatters, generated fixtures,
network feature calls, CI, commits or pushes. All concentrated acceptance, failure/
recovery/SSRF/capacity evidence remains UNVERIFIED. D3/project not complete.
