# Bounded Probe Runs v1

Later [typed Direct ingress](direct-ingress-probes-v1.md) adds explicitly retained
ingress measurement; old absent-key histories remain original egress and preserve
their digest shape. Public kind/point comes from actual measurement, not a global
relabelling. Historical accepted v2 egress results also remain egress evidence.

Date: 2026-10-18 (Asia/Shanghai). Local source implementation, unverified.
[ADR-0041](../decisions/0041-bounded-probe-run-history.md).

## Existing Workflow Only

Run history covers the existing explicitly accepted Direct TCP connect-only Probe:
point agent-direct-egress, IP-literal target, zero application payload. It is not
an independent external Probe or full-path/application test. Original authorization,
Node Grant, registered instance, current published binding, maximum2-second permit,
global256 permit budget and prune-after-expiry-plus1-second behavior are unchanged.
No DNS/TLS/UDP/Relay/multihop run or automatic plan/scheduler is introduced.
History capture itself has no separate opt-in flag: newly accepted probes use the
wired recorder. Original Probe execution/registration opt-ins remain independent
and default off; a history API never enables issuing or performing a probe.

Original permit owner records issued/consumed/revoked/withdrawn/accepted-result
after its corresponding mutation on the SAME supplied transaction. Identical
command/result replay does not manufacture another Run or result. No historical
catch-up, scan before old receipt prune, GET-generated record or source reconstruction.
Original short-lived known-ID receipt may disappear; separate retained Run can remain.

## Closed Stored Summary

Permit summary contains probeId, scopeId, actorId, original binding, instanceId,
instanceGeneration, timeoutMs, issuedAt, expiresAt, state and nullable closedAt.
State is issued/consumed/revoked/quarantined; state describes retained owner facts,
not a current executable grant. Additional fields: revision, updatedAt, nullable
withdrawnAt/result and sticky recoverySuspended. Times are numeric UTC epoch
milliseconds, safe integers0..253402300799999. Maximum record4096 UTF-8 bytes.

Complete binding retains nodeId, bootId, sessionEpoch, snapshotGeneration,
assignmentId, forwardId, forwardRevision, deploymentGeneration, bindingFence,
configDigest and egressPolicyRevision. These are ORIGINAL provenance; manager GET
does not compare them with current topology/Node/session/authorization. No current
membership or permission is inferred from an old accepted run.

Accepted result is exactly status connected/unreachable, code tcp-connected/
tcp-connect-failed, elapsedMs, measuredAt, validUntil, acceptedAt and resultDigest.
Status/code must correspond. Elapsed is0..original timeoutMs. Original consumed
permit and accepted result time bounds are retained; expired result remains history.
Missing result has no synthesized latency or failure classification.

No fingerprints, requestId, target host/address/port, config bodies, credential
material or raw protocol/result JSON. Result digest comes from the original owner
capture; raw omitted body is not rehashed by this history. Summary contentDigest
identifies content only, not cryptographic attestation or current execution safety.

## History Owner And Gaps

`ProbeRunRecorder<Tx>`/`ProbeRunStore<Tx>` are independent history ports with Scope
ownership, no FK/write path to short-lived permits/results or current execution
resources. Their success never renews a permit or consumes/creates a task; their
mutations share the original owner transaction, so SQL failure cannot create a
false separately committed history fact.

Per Scope max1024 Run heads, retention604800000ms (7 days). New insert prunes at
most16 expired histories, then if full evicts one oldest history regardless of
state. An issued/consumed Run history can be evicted without revoking its actual
permit. Later update of an absent history does NOT rebuild the head; increment
updatesWithoutHead. Counters rowsExpired/rowsEvicted/updatesWithoutHead describe
history loss, not target failure or rejected original Probe execution.

Retention is lazy and finite: no minimum full-window guarantee or physical erasure
exactly at7 days. Logical metadata caps do not prove physical disk, SQL cost or
absence of pressure on shared database hardware. No GET pruning/writes or original
global budget scans are needed merely to read history.
Detail GET logically returns only histories issued within the last7 days, even
when older rows remain physically stored awaiting lazy pruning; older IDs return404.

Recovery adds sticky recoverySuspended and advances the history revision once for
each previously unsuspended row, preserving recorded state/closedAt/withdrawnAt/
result/updatedAt facts. Repeated recovery does not advance already suspended rows.
Do not invent history transitions when
original execution recovery quarantines/revokes old authority. Never clear original
Journal, high-water, budgets or protected state to retain or query a Run.

## Manager API And Historical Meaning

Manager Bearer reads:
- `GET /api/v1/scopes/:scope/probe-runs`
- `GET /api/v1/scopes/:scope/probe-runs/:id` (no query)

Closed unique list parameters: from/to, limit, cursor, forwardId, nodeId, probeId,
state and resultStatus. Result status filter connected/unreachable/missing treats
missing as NULL historical result, not unsuccessful TCP. Exact original Forward/
Node IDs select the Run's own binding, never current Forward configuration.
Default24-hour window, maximum7 days, default25/max50 rows. HTTP times use canonical
UTC ISO milliseconds; response times remain numeric epoch milliseconds.
Window is half-open `[from,to)` by issuedAt; from must be at/after now-retention,
to cannot exceed now+configured clock skew. Unknown/duplicate query keys reject.

Ordering is descending issuedAt/probeId keyset. Cursor is unsigned query position,
not authorization or frozen cross-page snapshot; continuation retains fixed window,
filters/limit/Scope. Every page checks current manager Scope permission with source
projection in one transaction. Bearer authentication precedes it separately on
existing observation pool; no atomic authentication/projection claim or Runtime
fallback. Read admission2 active requests,128 actor keys and1000ms cooldown.
Maximum response262144 UTF-8 bytes. Details read no original execution authority.
Cursor is canonical base64url, at most1024 characters, with version/queryDigest/
position{issuedAt,probeId}; continuation must explicitly send from/to matching the
bound query. Filter predicates apply before bounded limit+1 projection.

Envelope contains probeRunsVersion1, scopeId, numeric epoch capturedAt,
source:persisted-probe-run-history,
coverage:new-accepted-probes-since-history-enabled, historyComplete:false,
readOnly:true, executionAuthorized:false, health:unknown,
networkCheck:not-performed-by-read, consistency:read-committed-not-global-snapshot
and limits. Coverage names the rollout/capture boundary, not a separate history
feature flag or proof of all accepted runs. Detail adds run and losses; list adds
numeric window{from,to}, normalized filters{forwardId,nodeId,probeId,state,resultStatus}
with null absent values, limit/items/hasMore/nextCursor and losses. Losses is exactly
rowsExpired/rowsEvicted/updatesWithoutHead, never an execution failure count.

Public run labels kind tcp-connect, businessProtocol tcp, point agent-direct-egress,
independentProbe:false, applicationPayloadBytes:0, health:unknown,
executionAuthorized:false, historical:true, bindingMatchCurrent:not-evaluated and
resultDigestVerification:captured-from-original-owner-not-recomputed. permitExpired
and nullable resultExpired are evaluations at capture time, not live authority or
health. resultSource is not-received/agent-reported. Full closed retained summary
and contentDigest remain manager-only provenance, not target/address disclosure.
The closed retained summary permits result acceptance and later withdrawal in the
same wall-clock millisecond; original transaction ordering establishes sequencing,
not a fabricated strictly increasing timestamp. Captured withdrawal cannot erase
an already recorded result, and missing source history is never reconstructed.

Console reads explicitly on user action, not polling/issuing/retrying/revoking from
the history panel. A Run ID is not a reusable execution credential. History cannot
claim success ratio, current health, complete samples, physical independence or
automatic switching readiness. D2 Probe cumulative series remain separate metrics.

Subsequent [Probe plans v1](probe-plans-v1.md) provides finite intent for the same
Direct TCP type and links accepted decision probe IDs to this separate history.
Plan decisions are not dial/result counts; missing Run history remains unknown.
No plan read rebuilds a pruned Run or copies result health into plan state.

No tests/static/type/syntax checks, scripts/formatters, new fixtures, feature network,
CI, commit or push performed. All source-only behavior remains unverified pending
final-source concentrated acceptance. C3 prerequisites and project completion remain open.
