# Shared Resource Payload Limits v1

Date: 2026-10-21; verification status updated 2026-10-23.
FR-0032 passed the configured N candidate Actions scope and was merged through
PR #114 at `9a5f719`. Exact source identities and executed cases are recorded in
[N verification](../testing/verification-status.md).
This specification defines behavior; independent hosts, load, installation and
release acceptance remain separate from that configured functional evidence.

## Accounting And Units

The accounting subject is the immutable Forward owner on one administrator-shared
Node in the same Scope. Every rule, protocol and direction for that subject/Node
shares the bucket for the explicit period. Private Nodes consume none of this
shared quota. Traversing two shared Nodes consumes each Node's bucket separately.
Payload passing one shared Node is charged once in each direction, before its
outgoing socket write. Relay framing, TLS, handshakes and Probe control are not
application payload. This is a forwarding resource limit, not payment settlement.

`bytesPerSecond` is bytes/second, `burstBytes` and `byteLimit` are bytes. No bit
conversion or GB/GiB conversion is implicit. TCP can admit a prefix. UDP admits a
whole payload or drops/refuses it. Empty UDP still checks authority and policy.
Tokens start at zero after restart or revision change and accrue with monotonic
elapsed time, capped at burstBytes. A datagram larger than the configured burst
cannot pass that rate limit. Rate fairness between connections is not guaranteed.

Limits are nonnegative safe integers or null; null removes that dimension and
zero denies payload. At least one of rate/byte limit must be non-null. Burst is
an explicit integer in 1..65536. Original connection/session/frame/port/platform
limits and current execution authorization remain independent requirements.

The administrator supplies canonical UTC millisecond `startsAt` and `endsAt`,
with startsAt < endsAt. Periods are half-open: [startsAt, endsAt). A monthly
example is 2026-11-01T00:00:00.000Z through 2026-12-01T00:00:00.000Z. Local billing
time zones and automatic renewal are not inferred. Adjacent explicit periods
are allowed; overlapping historical periods refuse. A future configured head
does not replace an older period that is currently active. Once policy exists,
execution outside every configured period is excluded until a period is supplied.

## Public API

Both routes use the original bearer authentication and same-Scope authorization:

```text
GET /api/v1/scopes/:scope/nodes/:node/payload-limits/:actor
PUT /api/v1/scopes/:scope/nodes/:node/payload-limits/:actor
```

GET allows the subject with a current shared grant or the Scope governance owner.
PUT requires the original Scope owner check, active subject membership and an
actual grant on the admin-shared Node. Governance does not create a use grant.
Private/unclassified Nodes cannot be configured through these routes. Neither
route accepts query parameters. PUT is bounded to 8192 bytes and requires an
explicit valid `Idempotency-Key`. Its closed body is:

```json
{
  "expectedRevision": 0,
  "startsAt": "2026-11-01T00:00:00.000Z",
  "endsAt": "2026-12-01T00:00:00.000Z",
  "bytesPerSecond": 1048576,
  "burstBytes": 65536,
  "byteLimit": 10737418240
}
```

The initial revision is zero. An accepted command increments the per-subject/Node
revision; same-period edits retain the bucket identity and consumed bytes. A new
nonoverlapping period creates a new bucket while preserving history. Once a
future head has been configured, old historical periods are retained; this API
does not offer arbitrary historical-head editing or a clear-all/reset command.
To suspend the latest period, set its rate or byte limit to zero with current CAS.

The response contains nodeId, scopeId, actorId, revision, policy (or null), and:

```json
{
  "consumption": {
    "status": "unavailable",
    "source": "agent-protected-journal",
    "usedBytes": null,
    "remainingBytes": null
  }
}
```

Policy describes the latest configured head for CAS; it may be a future period.
It is not an acknowledgement of Agent execution or a consumption measurement.
Agent journal totals have no new online aggregation/export here. Telemetry must
not fill those null balances. Unknown command outcomes retain exactly the same
body, identity and key for replay; account/Scope changes clear client state.

## Owners And Execution

`SharedResourceLimits` consumes public Identity, Node, Runtime Node lock, immutable
Forward-owner read and its own policy-store ports. Set locks original identity,
Runtime Node, then policy head in the original transaction. Policy, audit and
receipt commit atomically; request-key conflicts and CAS failures refuse. The L2
adapter writes only the four shared_resource_limit_* tables from migration 0041.

`RuntimeHostOptions.payloadPolicy` is required. Publication calls it in the locked
original transaction before retirement, compile, protected authority and save.
It excludes unsupported, zero and out-of-period assignments; policy changes
prevent ordinary Snapshot reuse and queued publication hold. The original codec
places optional resourceLimits version 1 inside the ADP/3 digest. The public
wire validates closed fields, Node/reference identity, ordering and period.

Limited execution requires `shared-resource-limits.v1` in the Agent/driver
capabilities. The Runner binds each assignment to a shared gate before starting
sockets. Original proof/lease checks remain conjunctive with payload admission.
Changed binding closes/restarts the active instance; ordinary generation changes
retain the original drain behavior. A control-only bucket with no assignmentIds
can update a retained drain's policy and grants no new execution. Runner's
original 100ms watch closes gate-bound active/draining instances at zero, expiry
or exhaustion. Policy edits to an already retained bucket update its old drains.

Offline Transit staging cannot enforce this policy and refuses any configured
shared resource before reserving ports. Its original abort/release path remains.
Already issued authority is bounded by its original lease/hard cutoff: saving
policy in Control cannot instantly revoke an unreachable Agent's old Snapshot.
An old unmetered execution has no bucket to revise. If first configuration is
zero/out-of-period/unsupported, publication removes its assignment and the
original stop/drain path applies; already accepted unmetered connections may
continue within their old drain/lease deadline. No retrospective charge or
retroactive gate binding to another subject is invented. A supported nonzero
binding change closes/restarts the active instance with the new explicit gate.
Period ends are independently checked on the Agent. No physical immediate-stop
guarantee is inferred from a successful configuration request.

## Durable History And Recovery

The gate asks the original executionstate RuntimeHost to precharge before a
socket write. Native state persists under the original authenticated Journal,
MAC and file lock, with an instance mutex serializing in-process writers.
Snapshot acceptance reloads durable consumption so a cached Snapshot cannot
overwrite a concurrent debit. Save failures deny payload. A crash, cancellation
or short write after Save can consume bytes that were never delivered. Those
ambiguous precharges are never refunded and are labelled conservative usage.

History survives reboot, Snapshot replacement, protocol/role changes, revision
updates and expiry. New periods do not delete old buckets. Control permits at
most 1024 periods per subject/Node, Agent history at most 1024 globally, and a
wire extension at most 1000 buckets; existing file-size limits also apply.
Capacity exhaustion refuses new history rather than evicting protected records.

UpgradeAssessment5 includes reviewed migration 0041, Control profile
adp3-shared-resource-limits-v1, its explicit Agent profile and JournalInspection2.
The inspection exports only budget version/count and an exact decimal sum.
Old readers reject the new protected field. Downgrades or restored policies that
contradict retained Agent revisions fail closed; never delete the Journal to
make them load. Whole-database backup must retain policy heads, buckets, receipts
and audit alongside original Runtime rows; preserve AuthorityStore/key and Agent
Journal/key under the existing recovery procedure. Database restoration alone
does not establish safe rollback or recover missing protected history.

## Source Consumers And Verification Scope

The [public example](../../examples/shared-resource-limits/README.md) consumes only
public owner/framework interfaces and does not execute itself. Authored source
cases cover policy CAS/replay/history, original transaction, publication/reuse,
offline refusal, TS/Go wire/digest, precharge/concurrency/restart, native TCP/UDP
and all Relay roles, inspection/downgrade, HTTP, audit and UI unknown outcomes.
Configured N Actions exercised these consumers through MySQL race/rollback,
native socket, Journal/restart, HTTP, Web and browser cases; exact results and
platform scope are in the verification record. That evidence is not a blanket
filesystem-durability or cross-platform certificate. Physical hosts, long-run
load, deployment usability, release and production readiness keep separate gates.
