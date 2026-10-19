# Existing Echo Receipt And History Source Completion

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified; no foundation or operational acceptance.
Change record: [FR-0021](../changes/FR-0021-echo-receipt-history-completion.md).

## Source Roles And Public Entry

| Source | Role and actual consumer |
| --- | --- |
| apps/control/src/modules/probe-owner/permits.ts | Original L3 permit owner. Private inspect/capture projections consume existing public native service/result codecs and the public ProbeRunRecorder in the original transaction |
| apps/control/src/modules/probe-history-owner/service.ts | Original L3 history capture/read owner. Its closed result-status filter now accepts the already declared echoed member |
| apps/control/src/compatibility/native-http-queries.ts | Existing L2 HTTP query decoder. Its original closed status list accepts echoed; no new query field |
| apps/web/probe.js | Existing import-free browser native receipt/DOM adapter. Old initProbeConsole signature and returned operations remain; private receiptView now has its previously missing echoReceiptView implementation |
| apps/web/probe-runs.js | Existing browser history format/digest/DOM adapter. Old initProbeRuns({request,notify,byId,getScope,document=globalThis.document}) and returned clear remain |
| apps/web/index.html | Existing fixed served markup. The history filter select gains the declared echoed option |

The existing app composition supplies these public initializers with the same
request/UI callbacks. No BrowserNative1 export, new module, route, wildcard asset,
production hook or L0/L1 contract is added. This bounded classification describes
the two changed browser leaves, not a package exemption or the other20 leaves.

## Historical Receipt

The original inspection returns base receipt fields, four measurement descriptor
fields and public service selection. It does not return top-level businessProtocol,
challenge or probeVersion. The new private Echo projection consumes that actual
closed shape and derives TCP/UDP from the descriptor, preserving the service Scope.
It accepts absent-result receipts and the existing stored v4 result envelope.

The result projection checks closed envelope/body/binding keys; historical and
unknown-health markers; permit, Forward, machine, instance, session and service
relationships; receipt/result times and bounded timeout/elapsed; source; native
challenge/proof representation; and controlled request/response byte counts. Echoed
requires256/256 and structural Ed25519 evidence, unverified requires a256-byte
request with null evidence, and TCP-only connect failure requires0/0. UDP does not
gain a TCP-failure outcome. These checks do not verify a signature in the browser.

Display retains agent-reported/historical/health unknown/false execution and says
stored evidence was not independently reverified. The browser does not have the
owner's pinned service context. Existing server proof checking remains its owner;
neither a digest nor a stored verified marker proves current health or authority.

Old non-Echo receipt branches remain. The original request path, version fencing,
query errors, revoke, session cancellation and bounded wait remain. Init defaults
still use getScope=()=>'', delay=pause and confirm=globalThis.confirm. Wait still
has its original five-second/eight-read bound and400ms delay. Issuance controls
and finite plans still allow only their original three TCP kinds; existing
capability flags and manual consent/replay rules do not gain Echo operation.

## Original Same-Transaction Capture

Private permitServiceSelection dispatches Echo context to the already public
probeEchoServiceSelection and keeps the old probeServiceSelection call for other
service contexts. Inspect and recordHistory use it at their original positions.
Echo permit capture now carries permit.echoChallenge, which the existing history
contract/parser already requires. Result capture carries validated Echo evidence
and byte counts, or existing TLS evidence for a v3/v4 TLS result.

The original result write precedes original history capture, then the original
store clock and final freshness sample/refusal. There is no new transaction or
clock sample. History still validates the supplied capture, locks its own scope,
uses the existing immutable head/revision/loss rules and the caller's transaction.
There is no backfill, deletion/reset, alternate writer or new ledger/authority.

MySqlProbeHistoryStore already projects/persists Echo fields through the existing
native value provider; migration0037 already declares the status/code and columns
with constraints. Their source was read, not changed or executed. Filter SQL keeps
its original missing-result branch and binary equality parameter for other values.
The actual migration, JSON representation, locking, rollback and roundtrip remain
unverified. Old records missing a head retain the existing loss accounting; this
change invents no historical reconstruction.

## History Projection And Filters

The browser's Echo shape requires the declared measurement/kind/protocol/point,
same-Scope service, challenge, allowed status/code/evidence and bounded byte counts.
It delegates common record checks through the original legacy shape without
changing the received native record. Existing lifecycle, captured expiry, window,
query binding, cursor, ordering, size and full stored-content digest checks remain.
The stored-digest projection now includes Echo service and challenge. The native
invocation digest binds nonce, service, binding, identity and original ISO times.
Original resultDigest is preserved rather than recomputed from a lossy summary.

History display uses actual businessProtocol/applicationPayloadBytes and labels
Echo evidence as recorded. The existing HTTP decoder, owner filter, browser input
and select all accept the already declared echoed result status. No automatic
read, retry, pagination, execution or network health check is added.

## Explicit Staged And Acceptance Boundaries

The declared machine APIs and public receiveResult input still cover v1/v2/v3;
native storage/result parsing also has a v4 family. The corrected private capture
does not expose a typed v4 ingestion route. Future staged source closure must
review qualification, delivery, claim/status, authorization, API/type consumers and
operational gates together. This read-path fix is not that capability's acceptance.

Existing probe-flow test source imports the old public initializer; it was read
only. Later Echo browser cases need real native base64/crypto and matching closed
receipt/history fixtures, retaining older-family coverage. Earlier console-flow
private VM layout adaptation remains pending; no production state hooks are added.

Readiness185 covers receipts and old control behavior;186 covers selection, supplied
transaction/history/storage relationships and failures;187 covers native browser
summary/digest/filter/cancellation behavior. Subsequent FR-0022 provides the full
manual22-leaf map in browser-native-leaf-inventory-v1.md and Rule owner/native split.
188 acceptance and the full A5 candidate remain open. All cases and prior
current-source checks are unexecuted. No test/type/syntax/static/boundary check,
formatting, generator, build, CI, native/MySQL/network/browser experiment, Git
write or delegation ran. The full source candidate and all later gates stay open.
