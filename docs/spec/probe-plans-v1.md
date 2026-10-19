# Bounded Probe Plans v1

Later [typed Direct ingress](direct-ingress-probes-v1.md) extends config.kind to
tcp-connect or tcp-ingress-connect without changing finite plan bounds. Current
qualification/capability is rechecked per new ingress decision. The read envelope
adds ingressExecutionEnabled as configuration only; original egress intent and
historical hashes are not rewritten into another observation point.

Date: 2026-10-18 (Asia/Shanghai). Local source implementation, unverified.
[ADR-0042](../decisions/0042-bounded-probe-plans.md).

## Existing Probe Only

A plan stores finite immutable intent for the existing Direct TCP connect-only
Probe, point agent-direct-egress, numeric IP target, zero application payload.
It is not a long-lived execution credential, independent external probe, full-path
test, health policy or new Agent protocol. The original permit owner alone issues
each short-lived task after current checks. Registration/discovery/claim/watch/
execution/result handling and global issuance budgets remain unchanged.

Creation requires current manager permission and original-owner preflight for the
selected Forward and Node Grant. It stores config and original binding provenance,
but does not issue a permit or contact the target. No user-supplied target,
fingerprint, instance credential, raw driver config or raw result body is stored.
Original binding is historical provenance, not proof it matches the current world.

## Closed Configuration And Retained Facts

Configuration contains exactly version:1, kind:tcp-connect, forwardId,
expectedForwardRevision, timeoutMs, mode, intervalSeconds, maxRuns and expiresAt.
Timeout is an integer 100..2000 milliseconds. Mode is manual or scheduled; manual
requires null intervalSeconds, scheduled requires an integer 30..3600 seconds.
maxRuns is 1..16 issuance decisions, not actual network attempts or successes.
The end must be more than one second in the future at preview/create and no later
than one hour from that current time. Scheduled first due time (now plus interval)
must be strictly before the end; scheduled creation does not issue immediately.
HTTP end times use canonical UTC ISO milliseconds; stored times use numeric UTC
epoch milliseconds. No silent Forward revision rebase or plan editing is allowed.

Head contains id, scopeId, createdBy, createdAt, config/configDigest, originBinding,
revision, state, decisionCount, acceptedCount, nextRunAt, updatedAt, cancelledBy,
cancelledAt, lastCode and recoverySuspended. State is active/completed/cancelled/
expired/suspended. Nullable cancellation identity/time travel together. A completed
head has consumed every configured decision slot; completion does not mean every
task ran or produced a result. Head maximum is 4096 UTF-8 bytes.

Each retained decision contains position, actorId, source manual/scheduled,
decidedAt and a closed outcome. Accepted outcome is accepted:true plus the original
202 ProbeAcceptance receipt: probeId, forwardId, issuedAt, expiresAt, dispatch:
agent-poll, executionEnabled:false. Rejected outcome is accepted:false plus a closed
code/status, never raw exception text. Maximum decision size is 2048 UTF-8 bytes.
There are at most 16 decisions per plan, ordered by position. Receipt expiry is
at or before the plan end and remains at most two seconds after issuance.

Config/content digests identify normalized content; they are not signatures,
attestations or authority. Public head adds expired, remainingRuns, health:unknown,
executionAuthorized:false, originBindingCurrent:not-evaluated, configStoredOnly:true
and contentDigest. expired is a read-time evaluation and does not write a transition.

## Current Authority Per Decision

Manual run is allowed only for manual mode. Its current caller must be a Scope
manager and must possess the original Node Grant for current original-owner
issuance. The creator must also still be a current Scope manager; another current
manager cannot silently replace a revoked creator's continuing authority.
Scheduled runs act as the original creator, rechecking current Scope and Node
Grant. Both modes pin Forward revision while resolving current execution instance,
published binding/session and timing through the original owner again.

The original issuer receives a trusted not-after cap equal to plan expiry. This
can shorten, never extend, the existing two-second permit. Plan lifetime and
interval do not widen per-task reporting, claim or withdrawal deadlines.

Original permit and ProbeRun capture, retained plan decision/head and outer
idempotent response commit in the same transaction. No child key or remote call
is introduced. Replaying an accepted command returns its original receipt, not
another slot/permit; a pruned original receipt is never recreated by a replay.

Only closed known original-owner rejections may be isolated by savepoint and
recorded as decisions: PROBE_DISABLED, PROBE_UNAVAILABLE, PROBE_PERMIT_UNAVAILABLE,
PROBE_PERMIT_LIMIT, AUTHORIZATION_DENIED, NOT_FOUND, REVISION_CONFLICT,
UNSUPPORTED_CAPABILITY and SESSION_SUPERSEDED; closed statuses are 403/404/409/
422/429. PROBE_PERMIT_LIMIT may be explicitly retryable/429 and is still one
consumed slot, not a scheduled retry of that decision. Temporary unavailable/
permit-unavailable/limit/session-superseded decisions can leave future slots open;
permanent permission/revision failures suspend future issuance. Unexpected SQL,
integrity and clock failures roll back the whole transaction, not a fake decision.

## Finite Scheduling And Cancellation

The scheduled worker is separate, default off and checks at most one due plan per
one-second tick. TUNEX_PROBE_SCHEDULE requires the original PROBE_EXECUTION opt-in
and explicit one-second Probe clock policy; incomplete combinations fail startup.
Agent registration and execution retain their separate original default-off flags.
Enabling a timer does not prove it is running or that agents can execute tasks.

After an actual retained decision nextRunAt follows that decision's current time
plus interval, capped at the fixed plan end (where a later tick expires it rather
than issuing). A delayed process does not iterate missed intervals, backfill probes
or produce a burst. Every accepted/rejected decision consumes one of at most 16
slots within the fixed one-hour maximum lifetime. There is no unbounded recurring
schedule, automatic extension, rearm or health-triggered retry/switching.

The worker does not overlap its own running tick. Current creator revocation or
expiry detected before issuance terminally suspends/expires the head without an
issuance decision. A whole-transaction failure can conditionally defer the exact
unchanged candidate header until the tick's cutoff plus five minutes; this is not
a decision, replay,
extension of expiry or retry of an uncertain committed permit. It rethrows the
failure. Shutdown stops future ticks and drains the current tick.

Cancellation is manager-only and prevents future decisions. It preserves prior
decision receipts, does not withdraw/revoke previously issued tasks, and does not
refund original issuance cooldown or reservations. Use the original explicit
Probe revoke endpoint separately where required; it still cannot undo a sent SYN.
No edit/resume endpoint exists; a new plan is a new explicit intention with a new
command/key and current preflight, not continuation of restored old authority.

Recovery terminally suspends active plans with sticky recovery provenance and a
history revision change, preserving decision positions/probe IDs/receipts and
cancellation facts. Terminal history remains historical. No automatic resume,
pending-permit reconstruction or restart catch-up is permitted; original execution
recovery/Journal/high-water protections remain authoritative and unchanged.

## Bounds And Read Meaning

At most 32 retained heads per Scope, including terminal history. New creation
lazily prunes terminal rows after seven days and can evict oldest terminal history
when full, never active plans. Losses are rowsExpired, rowsEvicted and
decisionsEvicted; these expose history gaps, not failed target measurements.
Logical retention/JSON sizes are not physical disk or SQL-capacity evidence, and
there is no promise of a complete minimum seven-day history.

Manager-only list/detail uses current transactional Scope authorization on the
independent two-connection observation pool, with no Runtime fallback, original
permit lock/status inspection, network probe, GET pruning or GET-generated work.
Default/max page size is 25/50; maximum response is 262144 UTF-8 bytes.

## Manager API And Receipts

All routes are under `/api/v1/scopes/:scope/probe-plans` and require current Scope
management permission:
- `POST /preview`: body is the closed config directly, expiresAt in canonical ISO.
- `POST /`: body exactly config and previewDigest; Idempotency-Key required.
- `GET /`: bounded history list.
- `GET /:id`: retained head and all its bounded decisions, no query parameters.
- `POST /:id/run` and `POST /:id/cancel`: body exactly expectedRevision, with
  Idempotency-Key and current head CAS. Run accepts only active manual plans.

Preview returns the read envelope plus normalized numeric-time config, original
non-executable preflight, previewDigest and configStoredOnly:true. Preview digest
is digest({config,originDriverDigest:preflight.binding.configDigest}), not a signed
grant or lease. Creation repeats current preflight/window checks and requires a
matching digest; stale input rejects rather than rebasing. No permit is minted by
preview or create. Creation returns 202, decision:null and initial revision 1.

The stored command receipt is `{status,body:{planId,revision,state,changed,decision}}`;
HTTP returns its body directly with that status, not the stored wrapper.
Changed commands use status 202; unchanged terminal cancel uses 200 and null
decision. Successful run means a retained decision, which can itself contain a
closed original-issuer rejection; 202 does not mean TCP success. Original current
manager authorization precedes idempotency replay, which never mints another
plan/permit or repairs deleted history. CAS mismatch rejects; cancel does not need
the creator's former Node Grant. A manual expired head is not silently mutated by
a read or failed run command.

Closed unique list query keys are from/to/limit/cursor/forwardId/mode/state.
The default window is the last 24 hours; maximum is seven days, half-open
`[from,to)` by createdAt. Bounds use canonical UTC ISO milliseconds; from cannot
precede now minus retention, to cannot exceed now plus configured clock skew.
limit is a canonical positive integer 1..50, default 25. Mode/state are closed
enums and forwardId is an exact original config identity. Unknown or duplicate
parameters reject. Detail logically excludes heads created more than seven days
ago, even if lazy physical retention has not removed them.

Order is descending createdAt/id with keyset continuation. The unsigned canonical
base64url cursor is at most 1024 characters and contains version:1, queryDigest
and position{createdAt,id}. Scope, fixed window, filters and limit bind its digest;
continuation must explicitly resend matching from/to. It is a position, not
authorization or a frozen cross-page snapshot. Filter predicates precede bounded
limit+1 projection and every page checks current permission.

The read envelope contains probePlansVersion:1, scopeId, numeric capturedAt,
source:persisted-probe-plans, readOnly:true, executionAuthorized:false,
health:unknown, networkCheck:not-performed-by-read,
consistency:read-committed-not-global-snapshot, historyComplete:false, limits,
executionEnabled, scheduleEnabled and workerState. workerState is disabled or
configured-not-liveness-proof; neither flag proves execution readiness. Detail
adds plan/decisions/losses; list adds numeric window, filters (forwardId/mode/state,
null if absent), limit/items/hasMore/nextCursor/losses. No result/status join into
the original permit store is performed.

API admission caps concurrent requests at two, with two active actor operations,
128 tracked actor keys and a one-second per-actor cooldown. PROBE_PLAN_BUSY/429
does not constitute a retained issuance decision. Authentication uses the same
independent observation pool separately; current Scope authorization and the
subsequent projection/command are transactional, not a claim of one atomic bearer
authentication plus full projection. No fallback to the Runtime pool is allowed.

Accepted probeId is a provenance link to separately retained ProbeRun history,
not a result copied into plan status. Missing/evicted/expired run history stays
unknown. decisionCount/acceptedCount are issuance facts, never dial counts,
successful measurement counts, availability percentages or current health.
Neither plan completion nor worker-enabled configuration satisfies C3 evidence.

No tests, static/type/syntax checks, scripts, formatters, fixtures, CI, feature
network, commit or push in this slice. All behavior remains source-only and
unverified until final-source concentrated acceptance; D1/project gates stay open.
