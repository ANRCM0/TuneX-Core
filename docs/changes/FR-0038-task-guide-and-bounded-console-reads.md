# FR-0038: Task Guide And Bounded Console Reads

Date: 2026-10-24. Status: Actions contract/native scope verified at `aae0632f`; independent-host/load/long-run unverified.

1. L2 browser representation/lifecycle only; no L0/L1/Agent/SQL changes.
2. Consume original console GETs, page selection, account connection version,
   request cancellation and original command/Operation public APIs.
3. Add one fixed browser asset; extend original list-read helpers with optional
   signal/currentness arguments while preserving their existing caller defaults.
4. Overview task guide links the existing resource, rule, operation and diagnostic
   pages. Explicit timed refresh reads only the visible supported page, at most
   six rounds ten seconds apart, stops on hidden/page/account change/error/manual
   cancellation, never overlaps its rounds and does not replay any mutation.
5. Author lifecycle cases for stale response, page/scope change, hidden document,
   bounded rounds, abort, failure, finite status mapping and batch progress.
   Source authoring only; browser/Actions/exact-source checks remain unexecuted.
6. Existing console blue/white design, module lifecycle and native asset chain;
   serial composition and public asset inventory update. No parallel features.

Guide statuses describe visible records, not accepted deployment/physical health.
Batch summaries retain per-item original keys/CAS/attempt/rollback owners. Display
accepted commands, confirmed Operation success, failures, pending and unknown
separately; no cross-rule atomicity, automatic retry, compensation or new keys.
Original source bridge/browser entry still mounts the same console. New native
asset union includes task-workflow.js, served under the existing CSP. Optional
refresh guards reject responses after abort even when the underlying GET finishes.
No tests, builds, formatters, commit/push or remote execution are authorized here.

## Verification Update - 2026-10-24

The current [P verification record](../testing/verification-status.md)
binds executed contracts, native MySQL and hosted-runner functional evidence to
`aae0632f20c1ffc333433b67c72beafc29605e2a`. Earlier planned/unexecuted
wording in this source proposal records its authoring snapshot. Whole-workflow
conclusions and independent-host/load/long-run limits remain in that record;
this update does not open merge, publication, release or parallel-feature gates.
