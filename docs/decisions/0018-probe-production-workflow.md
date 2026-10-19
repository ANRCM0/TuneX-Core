# ADR-0018: Default-off Probe management and serial Agent workflow

Historical scope note: [ADR-0043](0043-typed-direct-ingress-probes.md) later adds
an explicitly typed same-Agent Direct ingress point and unified v2 poll. This
document's original v1 egress wire/authority remains unchanged; self-connect does
not add external/full-path/application-health evidence.

Date: 2026-10-17 (Asia/Shanghai).
Status: accepted incremental direction, working-tree implementation;
functional acceptance pending matching-SHA Actions.

## Decision and scope

Connect the existing bounded TCP Probe components, rather than invent another
queue, execution owner or authorization source. An explicit Scope manager command
accepts a short-lived task. A separately opted-in Agent discovers and claims it,
uses the original consumed-authority watch and registered one-use Gate, performs
one numeric TCP connection with zero application data, and submits one immutable
reported observation. The manager can inspect or revoke the retained task.

This is experimental production-path wiring, not a claim of production readiness,
guaranteed task completion, independent physical attestation or application health.
The detailed [management contract](../spec/forward-probe-management-v1.md) defines
the request/response and operator boundaries. Direct TCP/IP literals only;
DNS, UDP, Relay, multihop probes, durable history, Console controls, telemetry,
health aggregation and automatic switching remain separate work.

Historical slice boundary: [ADR-0041](0041-bounded-probe-run-history.md) subsequently
adds independent bounded Run history through same-owner transaction capture and
manager reads. It does not change this short-lived permit authority or retroactively
validate the original workflow; scheduling/new Probe types remain separate work.

Later [ADR-0042](0042-bounded-probe-plans.md) adds finite immutable plans for THIS
existing Direct TCP type, using original-owner per-decision issuance. That limited
default-off schedule does not change this workflow's permit lifetime/authority or
add other Probe types, current-health aggregation or automatic routing.

## Single authority and atomic management acceptance

`ForwardProbes` requires current Scope management permission and a valid
Idempotency-Key. It normalizes and freezes the closed command before awaiting.
Authorization, idempotency claim, permit issuance and saved acceptance share one
caller-owned transaction. `ProbePermits.issueCurrentIn` locks the existing permit
budget first, then authorizes the original Actor/Forward/Node Grant and complete
published execution binding, and selects and validates the current registered
instance under lock. No target, instance or authority fields come from the user.
There is no network call in this transaction or second acceptance owner.

Replay returns the original acceptance after checking current Scope management
permission. It never recreates a pruned task, renews expiry, refunds a reservation
or bypasses recovery-invalidated idempotency. A conflicting command/key rejects.
An acknowledgement is acceptance, not proof of execution or delivery. All existing
issuance/claim/withdrawal/result budgets and original-Actor rechecks stay intact.

Historical inspection and idempotent revocation remain available with issuance
disabled. Any current Scope manager can use them even after the original Node
Grant was removed. They never grant new execution or disclose targets/credentials.
Inspection validates the stored result digest, original permit/binding/instance,
consumption times and acceptance window before returning a detached historical
receipt. Unknown or cross-Scope IDs return 404. This is the existing bounded,
short-lived permit store, not a new long-term history table or retention promise.

## Explicit opt-ins and timing policy

The Control process needs both `TUNEX_PROBE_EXECUTION=1` and
`TUNEX_PROBE_CLOCK_SKEW_SECONDS=1`. The second setting explicitly selects the
cluster's stricter one-second ADP timing/OS synchronization policy; it is not a
one-second execution or revocation SLA. Enabling only the first fails startup.
Embedded `startControl` callers must supply a Policy with maximum clock skew
exactly one second when enabling issuance. Ordinary default-off deployments keep
the existing five-second default. Agents must reconnect/restart to negotiate a
changed Hello policy and satisfy independent OS clock evidence; no fake proof or
automatic time correction is introduced. Old sessions with a wider policy fail
Probe admission rather than silently widening the two-second permit window.

The real Agent additionally requires BOTH `--probe-registration` and
`--probe-execution`, each default false. Execution without registration rejects
before opening protected state. Registration alone still never polls or executes
tasks. Journal inspection rejects either state-changing option. Execution does
not imply Relay or multihop enablement and does not alter Journal format.

Disabling Control issuance is not instantaneous cancellation of outstanding tasks:
their original at-most-two-second lifetimes remain. Explicit revocation uses the
existing owner/continuous watch. It cannot undo an already sent TCP SYN. The
25/200/250 ms cooperative checks/exchanges/freshness are not real-time guarantees.

## Serial bounded workflow and uncertain outcomes

The Runner starts one serial workflow worker only with explicit execution opt-in.
It reuses the existing one-second discovery cooldown and global four-active /
one-per-Node / 128-tracked-Node budgets. A discovered offer is revalidated against
current host facts by claim and execution. The receipt deadline can only shrink
to the earlier offer/claim/current-execution deadline. The first independent
status check must succeed before the original Gate can send any packet.

One task performs poll, claim, watched one-use execution and result submission
in that order. No target override, Gate reconstruction, grant bypass or detached
replacement worker is allowed. A claim ID is burned before its request. The
result handle atomically burns its report attempt before validation/I/O. Lost,
cancelled, denied or malformed acknowledgements are not retried; no task is
re-executed to recover a result. A later poll can only discover another independently
issued ID, never convert a consumed result into fresh authority.

The fixed result body keeps the original claim clock evidence and conservative
serialization from ADR-0017. Upload uses the same bounded 200 ms / 4 KiB / HTTPS /
no-redirect exchange, clipped by the reporting cutoff and live watch. The strict
result acknowledgement must match identity, correlation, digest and acceptance
times; Guard and current authority are checked again. The handle stays alive
until upload ends; deferred Close drains HTTP/watch workers before returning or
releasing their slot. Shutdown first cancels/drains this serial worker and then
closes/revokes registration. Task failure does not modify Forward desired/applied
state, trigger retry/switching, renew a lease or synthesize an unreachable result.

Discovery, clock uncertainty and the original two-second deadline can legitimately
expire a task without a result. The new flow is best effort, not a durable job
delivery guarantee. Clients must show expired/unknown instead of healthy or zero;
a genuinely new explicit command gets a new key and the same shared cooldown.

## Compatibility and acceptance

No new migration, machine Schema, fixture, execution driver, Core entity, Authority
high-water or Journal format. The latest Control-only compatibility Profile is
still `adp3-probe-results-v1` through migration 0017. Registration/claim/delivery/
result responses remain non-executable; only the original local execution adapter
may construct a bounded Grant after current remote and local checks. Disabling a
feature never permits downgrade, clearing high-water or deleting safety history.

New regression wiring covers atomic/idempotent management, disabled defaults,
strict HTTP routes, receipt integrity, serial full workflow, uncertain claim/report
non-retry, initial withdrawal and cancellation/drain. Existing full Go race and
contract/MySQL/Direct/Relay/multihop gates remain. A dedicated `probe-workflow`
Actions job runs `npm run test:probe` with the actual built Agent, actual Control,
mTLS, disposable MySQL and a zero-application-byte TCP target. It covers independent
opt-ins, duplicate management/claim requests, explicit revocation before delivery,
original Node Grant withdrawal and graceful instance revocation.

Combined acceptance may issue at most four distinct explicit commands to observe
a completed best-effort task. Each attempt has its own ID/key, waits out the original
reservation, records whether it connected/reported, and must open at most one socket.
No Agent runtime retry is enabled to make that test pass. Expired/uncertain attempts
remain recorded, not rewritten as successful measurements. Evidence contains source
SHA/dirty state, Agent binary digest, checks and counts. The subsequent Console
slice adds real desktop/mobile Chromium to the same fixture, including a lost
committed response and explicit stable-key replay. Uploads allow only
`evidence.json` and named Console screenshots, never browser traces/HAR, private
test PKI, bearer credentials or protected state. The ephemeral browser's fixture-CA
trust bypass is test-only, not proof of production certificate trust.

Local work remains static-only. These tests are authored/Actions-wired, not run
locally or accepted for this working tree. The hosted same-host topology is not
physical multi-host, public/NAT, long-running or production evidence. Remaining
product/telemetry, remaining Console management, audit/support and release gates are not waived.
