# P Deployment, Recovery And Load Acceptance

Prepared: 2026-10-24. Status: independent-host/load/long-run campaigns not executed.
This runbook is P6 source delivery; it records no production capacity. The parent
ledger is [stage P](product-readiness-stage-p-2026-10-24.md), PP-13 through PP-16.

Environment decision (2026-10-24, Asia/Shanghai): the human confirmed that no
independent-host or long-run environment is currently available and requested
source and acceptance preparation first. No runner labels, host allocation or
authorized duration have been supplied. This handoff provides the source,
scenarios and inventory template; physical-host, load and long-run execution
remain pending. This decision supplies no P verification, commit/push, merge or
release authorization. The later Actions request and actual candidate execution
are recorded separately in [P verification](product-verification-p-2026-10-24.md).

To resume environment execution, supply reviewed host/runner identities and
topology, an isolated acceptance database and controlled Responder, permitted
fault/load scope, resource limits, approved thresholds and stop conditions, and
an available time window for the baseline and separate 24/72-hour campaigns.
Then bind the exact candidate and artifacts below. Keep the example inventory
unreviewed until actual identities and independence have been reviewed; do not
fabricate environment or timing evidence to complete the template.

## Bind The Candidate And Environment

Before execution authorization, fill an external evidence directory with the
exact clean source SHA, source archive digest, workflow/run/job IDs and final
conclusions, Control/Agent image digests, Agent binary digest, fixture digest,
Node/Scope/Forward IDs, public TLS endpoint and reviewed topology. Record OS,
kernel, CPU/RAM, NIC/link limits, container limits, MySQL/client versions and
network shaping. Record UTC start/end and synchronized-clock evidence separately
for each host. Do not place tokens, CA/Journal/authority keys, raw support bundles
or database dumps in source control or public CI artifacts.

Use at least three independently reviewed Linux hosts for multihop. Distinct
machine-id hashes alone do not prove different physical hosts: inventory review
must identify actual hosts and shared hypervisor/storage/network constraints.
The existing `npm run test:multihop-physical -- /secure/inventory.json` collector
requires the reviewed inventory format in `scripts/phase2/multihop-physical.ts`,
exact source/image/binary/fixture identities and SSH aliases with known host keys.
Its successful TCP/UDP sample is a functional baseline, not the fault, load or
long-run evidence below. Namespace Actions remains separately labeled same-host.

## Installation And Maintenance Scenarios

| Case | Exercise | Required observation |
| --- | --- | --- |
| Fresh Control | Run role-specific setup/preflight; original bootstrap; one explicit fresh authority start; steady restart | Correct owner login, bound authority/DB/CA, steady initialization disabled; no old state treated as fresh |
| Fresh Agent | Private/shared Node enrollment, explicit grant where shared, normal steady restart | Exact Node identity, current mTLS session/report, original authenticated Journal and independent key retained |
| First business path | Direct TCP/UDP, two-node Relay, then three/eight-node multihop | New Operation, active per-node bindings, real payload/hash and controlled Echo recorded separately from local static preflight |
| Members and quota | Owner creates membership, viewer refuses writes, owner narrows grant/limit, account rotates its own token | Original CAS/replay/transaction, current credential rejection, no old-account response applied; quota measured at sample time |
| Retained upgrade | Existing-role preflight and original assess-upgrade with actual source/target profiles; approved maintenance upgrade | Unknown/partial markers refuse; schema 0042-0046 and older reader ceilings; original authority and Agent debit history intact |
| Failed upgrade | Inject a partial DDL footprint only in a disposable acceptance database | Assessment blocks/requires review, no runtime start and no automatic reset or down-migration |

Static planning commands (run only in the authorized execution phase):

```sh
node --env-file=/secure/control.env deploy/setup.mjs --role control --phase initial --json
node --env-file=/secure/agent.env deploy/setup.mjs --role agent --phase existing --control-url https://CONTROL_HOST:41001 --json
npm run ops -- assess-upgrade /secure/tunex/upgrade-plan.json
```

These commands have different effects: setup only reports local/manual steps;
assess-upgrade reads real protected/database state through the original owner.
Do not substitute a setup pass for TLS, SQL, Agent or payload evidence.

## Fault And Recovery Scenarios

Run each fault with explicit start/restore times, unchanged source identities,
before/during/after counters and observed authorization deadlines. Capture an
actual client stream/datagram result, original Operation/cleanup status, per-node
Snapshot/report/session and quota sample freshness. A failed historical Operation
does not become successful when a later deployment recovers.

- Inject reviewed delay and loss on one real link, sever an active peer, and
  restore it. Verify bounded refusal/cleanup and original recovery convergence;
  separate TCP resets, UDP loss and controlled Echo outcomes.
- Restart Control/Worker, then each Agent independently, during active traffic.
  Verify the original lease cutoff, retained Journal/fence, no stale binding
  revival, no debit reset and no duplicate work from uncertain command replies.
- Rotate/revoke credentials and remove shared-resource authorization. Capture
  failure before any new execution, plus the original maximum old authorization
  cutoff. Do not increase production deadlines to accommodate the fixture.
- Exercise port conflict, quota exhaustion, next-period policy and missing/stale
  usage reports. No missing measurement is zero, and no stale quota sample is an
  execution grant. Verify Station unknown/firing/recovered/invalidation behavior
  and original notification outbox rollback/deduplication.
- Issue explicit path Echo samples and evaluate the recent-sample condition at
  its configured age/elapsed threshold. Current-issuer revocation, service or
  binding changes, missing latest results and stale samples cannot recover an
  incident. Preserve original result validUntil and label this historical sample
  condition separately from current path health or a measured failure/loss rate.

Restore follows [the original maintenance workflow](recovery-and-capacity.md)
and [owner invariants](upgrade-recovery-development.md). Use original `ops status`,
`maintenance`, `backup`, `restore` and explicit `resume`; stop and isolate every
issuer, retain independent authority/keys, verify real clock proof, restore only
into a new database, and review recovery quarantine before resuming. Preserve
Agent protected high-water/debit history, original audit and new credential events.
Capture corrupt dump/MAC, wrong CA/database, older history, missing keys and
premature cutoff refusal in a disposable environment. Never use deletion,
re-enrollment or a new authority directory as a compatibility repair.

## Load And Long-Run Campaign

Reuse the [D1 measurements and decision rules](load-baseline-2026-10-20.md).
Before starting, record approved limits and stop conditions for the actual host
class. The following is a proposed workload, not a certified capacity claim:

| Axis | Proposed stages | Observe |
| --- | --- | --- |
| Rules | 1, 10, 50, 100, then only reviewed higher steps | Publish/report convergence, SQL lock/transaction latency, retained rows/bytes, no unbounded per-rule task growth |
| Concurrent payload | 1, 10, 50, 100 per tested protocol within actual configured caps | Goodput, accepted/rejected connections, p50/p95/p99 RTT, TCP errors, UDP delivery/loss and exact byte/hash agreement |
| Control reads | One then multiple visible consoles, current page refresh enabled/stopped, account/page changes | Request rate/size, SQL calls, abort/late-response fencing, latency and finite six-round refresh bound |
| Churn | Bounded reconnects, explicit rule changes and one Agent restart at a time | Instance/session/fence convergence, cleanup/drain time, receipt replay and no authority/debit regression |
| DB pressure | Reviewed slow SQL/short disconnect windows in the disposable test DB | Fail-closed commands, unknown reads, bounded queues/pools and recovery without deadline relaxation |
| Duration | 15-minute warmup, 60-minute steady baseline; separate 24-hour and 72-hour campaigns | RSS/heap/goroutine/FD/connection/SQL trends after warmup, cleanup plateaus, errors, unavailable samples and restart intervals |

Record actual offered/accepted/completed work, elapsed duration, sampling period,
counter resets, missing samples and every interruption. Use interval counters for
rates, not cumulative totals divided by an invented duration. Summaries must
retain raw series and the tool/version/config digest needed to reproduce them.
Set thresholds before the campaign; if none were approved, report measurements
without assigning pass/fail or inventing a safe operating envelope. A stopped
24-hour run is an incomplete 24-hour run even if its short baseline passed.

## Evidence Record And Handoff

Each case records: case ID; source/tree/image/fixture identities; environment and
independence scope; planned and actual start/end; exact redacted command/config;
offered load; thresholds/stop conditions; expected behavior; observed behavior;
raw artifact paths/digests; final conclusion (`passed`, `failed`, `skipped`,
`incomplete`, `unavailable`); reviewer and remaining limitations. Retain every
failed attempt rather than replacing it with a later green sample.

Acceptance proceeds separately: source review -> authorized local static/type/
boundary/parity/format/compilation -> exact-source Actions functional/MySQL/
network/container/browser -> independently reviewed physical hosts -> actual
duration load/long-run -> release decision. The saved P Actions source is
`245d438ace32e1a58c39f00c9dca0a5d1d8cc7d4`; executed contracts, native SQL,
hosted-runner functional/recovery/capacity samples and container packaging are
recorded separately in the verification record. Those bounded samples are not
the reviewed topology, offered load, thresholds or 24/72-hour campaigns required
here. No main merge or published image follows from this task. PP-13 through
PP-16 retain their independent-environment obligations, and the persistent P
goal is not achieved by these preparations or the hosted-runner samples.
