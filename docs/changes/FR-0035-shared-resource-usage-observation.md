# FR-0035: Shared Resource Usage Observation

Date: 2026-10-24. Status: Actions contract/native scope verified at `aae0632f`; independent-host/load/long-run unverified.
Owner: original resource-limit owner. Authorization: P implementation request and
2026-10-19 standing source authorization. No verification/publication permission.

## Task Proposal

1. L1 injected observation storage; L2 authenticated SQL/HTTP and native Journal
   read adapter; L3 resource-limit usage projection and existing Web view.
2. Consume framework transaction/Node credential ports, Identity authorization,
   resource-limit public API and the original state Journal loader/file lock.
3. Add an observation port and migration 0043. Do not change L0, ReportRequest,
   Snapshot, Journal encoding, Runtime ledger or payload admission semantics.
4. Optional POST /agent/v3/resource-usage, version 1, binds node/boot/epoch/report
   sequence/accepted generation to an already accepted current Runtime report.
   GET payload-limits adds optional typed consumption details; old command receipt
   bodies retain unavailable consumption. No execution permission derives from it.
5. Author cases for closed input, bounds, session fencing, accepted-report binding,
   monotonic counters, transaction rollback, grants, stale/missing data and Web.
   Execution remains gated; functional/MySQL/browser cases belong in Actions.
6. Serial composition, schema catalog, HTTP substitutions and asset integration.
   Existing Runtime host and old Agent/Control wire remain usable independently.

## Decision And Compatibility

A separate observation extension avoids sending new fields into old closed ADP
ReportRequest readers. Agent samples the authenticated Journal under its original
file lock after an ACK and sends at most 1024 retained buckets in 512 KiB. Failure
of this optional observation does not fail the original report or grant execution.
Old Control 404 and a lost observation mean unavailable/stale data, never zero.
The observation is separate from the Runtime report transaction; accepted report
reference validation and every projection update share one new original DB
transaction under the Runtime node lock. No partial projection is published.

Each row carries immutable bucket/scope/actor/node/period, policy revision and exact
decimal consumed bytes (safe-counter ceiling 9007199254740991). Control verifies
each retained policy bucket and refuses counter/revision rollback. It never sums
across revisions or machines, refunds, resets history or infers delivered bytes.
The original Journal retains all buckets; omitted rows are not deleted. Same
report/identical payload replay is harmless; changed payload at that sequence is
refused. Higher session alone never permits lowering an existing bucket counter.

Only a same-policy fresh observation displays remaining-at-sample, explicitly an
upper bound on currently available payload allowance (usage may grow afterward).
No sample is a current balance. Lowered policies may be exceeded conservatively;
display remaining zero. Old Agents, policy not yet observed, previous revisions,
future periods and stale reports remain distinguishable in the typed view.

## Migration And Acceptance

Apply 0043, upgrade Control then Agent; old Control may ignore the new path.
Old profiles retain their migration ceilings. Add resource-usage-v1 Control
profile, observation-store version 1, resource-limit module version 2 and HTTP
version 4 for the required API collaborator. Runtime interfaces stay unchanged.
Direct SharedResourceLimits constructors can omit the reader and keep legacy
unavailable views; production explicitly binds it. Persisted old command receipts
remain valid. Old state/native constructors and original modules aliases remain.
No pruning is added; table rows are bounded by the protected policy history.

Source-authored cases are not passes. Frozen-source boundary/type, HTTP/Go,
MySQL rollback, old reader, browser and long-running debit/report evidence are
required separately. Backup/restore must include the new projection but it never
replaces the authenticated Journal or permits clearing original protected state.

## Verification Update - 2026-10-24

The current [P verification record](../testing/verification-status.md)
binds executed contracts, native MySQL and hosted-runner functional evidence to
`aae0632f20c1ffc333433b67c72beafc29605e2a`. Earlier planned/unexecuted
wording in this source proposal records its authoring snapshot. Whole-workflow
conclusions and independent-host/load/long-run limits remain in that record;
this update does not open merge, publication, release or parallel-feature gates.
