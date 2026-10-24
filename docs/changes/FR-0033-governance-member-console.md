# FR-0033: Governance Member Console

Date: 2026-10-24.
Status: Actions contract/native scope verified at `aae0632f`; independent-host/load/long-run unverified.
Owner and authorization: P2 browser representation and original Identity/Access
owners; direct P implementation request on 2026-10-24 and the 2026-10-19 standing
source authorization. No verification, commit/push or release permission follows.

## Task Proposal

1. Layers: L2 browser representation/static asset integration consuming existing
   L3 Identity queries and Access commands; no L0 or L1 source behavior change.
2. Public interfaces: existing `GET members`, `PUT members/:actor`, immutable
   member revision, Idempotency-Key and AccessCommand3 response; original Console
   request owner and native browser lifecycle.
3. Foundation impact: additive fixed `member-console.js` static asset name in
   `NativeControlConsoleAsset` and its explicit route. HTTP factory signatures,
   request-owner/public versions, authentication and persistence remain unchanged.
4. Contracts: owner-only member listing/editing and new-account initial Token;
   global existing-account Token replacement remains rejected by the original
   `ACCOUNT_CONFLICT` rule. No new credential endpoint is authorized by this FR.
5. Acceptance: authored view/body/receipt and asynchronous unknown-result cases,
   plus original byte-exact asset/headers, Identity/MySQL and browser cases.
   Execution is deferred to separately authorized exact-source verification.
6. Parallel impact: serial P worktree only; asset route/type/classification and
   native console integration are updated together by the main task.

## Why Current Extensions Are Insufficient

The existing Identity owner already expresses membership creation, restoration,
role change/removal, original transaction, request replay and Runtime withdrawal.
Only its owner-facing Web flow is missing. Reuse it without another account,
permission, execution or resource owner. Do not mistake membership creation's
optional initial token for permission to rotate another global account token.

## Impact And Compatibility

The new native view is available only in an enterable owner workspace. Every read
and write still authenticates through original server owners. Membership roles
remain owner/manager/viewer/removed; selecting manager does not grant another
person's private resource use or workspace governance. Owner mutation is refused.
The view reads the current member revision and never asks a user to invent CAS.
An absent member starts at revision zero; adding an existing account omits token,
while explicitly creating a new account requires a saved initial secret.

The initial secret stays only in the input/pending command memory. It is never
included in receipt/debug output, browser storage or logs. It is cleared on
navigation/input change; the original fixed pending body is retained only while
an uncertain command needs explicit replay. Account/Scope change clears it.
Sending an uncertain command again requires the original body/key. A rejection
on replay does not prove the earlier transaction did not commit. Clearing local
memory does not cancel the original member/Runtime operations.

Native asset union expansion is additive representation wiring, not a changed
HTTP factory or broadened path loader. Keep existing public counters and permit
only the newly named fixed asset path; unknown/private paths still reject.
Legacy app.js/model/request/native public entries keep their original bindings.
The existing Identity member list remains its original all-members response;
the new UI applies a 10000-record safety ceiling and renders bounded local pages.
That is not a newly accepted storage scale or a server pagination contract.

## Migration And Acceptance

No DDL, Journal/wire version, account hash, legacy constructor or existing route
changes. New file is classified L2 and served with the same no-store/CSP/security
headers. Test inputs cover invalid/duplicate members, protected owner, explicit
new/existing account mode, initial secret preservation, fixed CAS, malformed
receipts, denied governance, old reads, unknown outcomes and original-key replay.
Browser, MySQL, real Runtime withdrawal and complete public asset checks remain
planned until exact-source Actions are authorized and executed.

Self-service credential rotation is a separate forthcoming account-owner FR;
it must not give Scope governance a cross-Scope credential replacement power.

## Verification Update - 2026-10-24

The current [P verification record](../development/product-verification-p-2026-10-24.md)
binds executed contracts, native MySQL and hosted-runner functional evidence to
`aae0632f20c1ffc333433b67c72beafc29605e2a`. Earlier planned/unexecuted
wording in this source proposal records its authoring snapshot. Whole-workflow
conclusions and independent-host/load/long-run limits remain in that record;
this update does not open merge, publication, release or parallel-feature gates.
