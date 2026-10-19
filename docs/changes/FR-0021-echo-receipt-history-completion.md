# FR-0021: Complete Existing Echo Receipt And History Projections

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified.
Owner and authorization: original Probe permit/history and browser native receipt
owners, under the human's standing2026-10-19 source scope. The proposal and filter
scope amendment were recorded before their corresponding source edits.

## Task Proposal

1. Layers: private L3 permit-to-original-history capture/inspection selection;
   L2 browser receipt/history native format projections and read-only status filter.
2. Consumed public contracts: existing ProbeEcho v4 schema/native codec, current
   ProbePermitInspection, ProbeRunPermit/Result, service selection and original
   browser request/manager history API. No new protocol or authority interface.
3. Foundation impact: private completion of existing declared source contracts;
   no L0/L1/public method/field/schema/version change. This FR records the concrete
   behavioral correction and history invariants, not a breaking interface request.
4. Changes: implement the already called but undefined echoReceiptView; route
   Echo service context through its existing native selection; retain already
   declared challenge/proof/byte fields in original same-Tx history capture;
   let existing browser history decode/display those declared native summaries.
5. Acceptance: planned185-187 and browser adapter inventory188, all unexecuted.
   Later exact-source Actions cover real API/history/transaction/browser cases.
   No test/check/tool/fixture expansion or run now.
6. Other modules: keep old v1/v2/v3 branches and finite-plan kinds, issue controls,
   worker flags, Agent/engine, single authority/Journal/ledger unchanged. No new
   Echo issuance UI, timer, automatic Probe, retry, trust or health capability.

## Source Evidence And Existing Contract

probe.js calls echoReceiptView for an existing native Echo taskKind but has no
definition/import. Probe permit inspect already exposes four measurement descriptor
fields plus public service selection, not a top-level businessProtocol/challenge.
The new private display helper must consume that actual shape and the existing
stored v4 result envelope, without changing the inspection response contract.

Two existing permit projection sites call the v1-only probeServiceSelection with
a union containing Echo v2 context. Keep the exact old legacy call for non-Echo;
select existing probeEchoServiceSelection only for existing Echo measurements.
The current declared ProbeRunPermit requires Echo challenge and ProbeRunResult
already includes Echo proof/requestBytes/responseBytes. Their omission in current
capture conflicts with the existing original history parser. Supply those values
from the same permit/request at the same original capture call, without a new
transaction, clock sample, history algorithm or validation bypass.

## Compatibility And Scope

No exported method/type/old browser init signature changes. Non-Echo service paths
still use their original parser. Old native receipt branches remain; Echo helper
checks actual closed descriptor/service/scope/envelope/result/body relationships,
machine/binding, times, status/code and bounded256-byte request/response semantics.
It returns a historical agent-reported display with health unknown and no execution
authorization. A stored verified marker is not independent browser signature/trust
verification; only the original server owner has the pinned service context.

Browser Probe run history gains only the existing Echo summary family. Its native
closed schema, lifecycle/query/cursor/content-digest rules stay, with Echo fields
included in the original stored-digest projection and invocation binding. Existing
v1/v2/v3 paths preserve their code/validation. Display actual controlled Echo byte
counts and allow the existing echoed history-status filter; do not manufacture a
zero-payload or health claim. Finite plans remain their original three TCP kinds.

Before filter implementation, source reading also finds that both native HTTP
query decoding and history-owner filter checks omit echoed although the existing
ProbeRunQuery result-status type already includes it. Add that declared value to
those two original closed lists and the matching browser list/select. SQL already
uses the same supplied binary-equality parameter for every non-missing status;
no SQL/schema/index/query expansion, new filter name or new outcome is introduced.

History capture retains challenge from the original permit; result summary retains
validated Echo evidence and byte counts, or TLS evidence for existing v3/v4 TLS.
Same original transaction/locks/callback position precede clock/check/commit stages.
No records are deleted/reset/backfilled/replayed or accepted without existing
history validation. Already failed/missing history has no invented recovery path.

## Migration And Acceptance

This corrects source implementation to the already declared native contracts,
without public version increments or new static modules/assets. Root/old export
paths stay; known earlier VM source-layout tooling debt remains separate.

185: receipt absent/pending/consumed/revoked/quarantined, TCP/UDP Echo outcomes,
closed keys/service/scope/binding/time/byte/proof rejection and historical/unknown
display; old receipt families and bounded wait/revoke/issue controls unchanged.
186: correct original native service parser per family, challenge/proof/byte/TLS
capture in the supplied transaction, existing history digest/lifecycle and all
old failures/clock/refusal/commit paths; no state/authority reset or new writer.
187: native browser run summary families/digests/invocation/status filters/UI,
malformed/unknown data, cursor/query/Scope/abort/error/no hidden request and legacy
paths.188 separately maps actual browser adapter public/default/consumer roles.
All planned/unexecuted. No tests/type/syntax/static/boundary checks/formatter/
generator/build/CI/network/MySQL/browser experiment/Git writes/delegation.

Full A5 source/type/private/default/consumer/asset/candidate and all subsequent
foundation/physical/release gates remain open. This does not approve Echo operation.

## Implemented Source And Remaining Consumers

Source edits cover probe-owner/permits.ts, probe-history-owner/service.ts,
compatibility/native-http-queries.ts and the existing browser probe.js,
probe-runs.js and index.html. Old function exports and fixed asset routes remain.
The complete source chain and acceptance limits are recorded in
../architecture/browser-echo-receipt-history-v1.md.

Manual source reading of migrations/0037-probe-echo.sql and the original
MySqlProbeHistoryStore finds the existing Echo status/code, challenge, evidence and
byte columns, constraints, JSON projection and supplied transaction writes. Those
files are not changed and this is not evidence that the migration or data roundtrip
works on MySQL. Existing retention/loss/immutable-head behavior remains the owner.

The declared machine APIs and public ProbePermitOwner.receiveResult input still
cover only v1/v2/v3. Native stored-result parsing has a v4 branch, and the original
owner's private history projection now retains its declared fields when that branch
is reached; this does not add a typed v4 ingestion API, route, qualification or live
execution capability. That staged compatibility boundary remains explicit for
later source and acceptance work rather than silently widening the public union.

This slice fixes two read projections. Subsequent FR-0022 completes the manual
22-leaf public/default/native/consumer/asset map and actual Rule owner/native split;
see ../architecture/browser-native-leaf-inventory-v1.md.188 acceptance remains
planned/unexecuted. Console VM source-layout adaptation remains deferred. No checks ran.
