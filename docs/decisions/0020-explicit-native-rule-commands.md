# ADR-0020: Explicit Native Rule Copy, Retry and Bounded Console Batches

Status: Accepted for incremental implementation; exact-SHA Actions acceptance pending.
Date: 2026-10-17 (Asia/Shanghai).

## Context

The native catalog and immutable Profile impact from [ADR-0019](0019-native-catalog-and-profile-impact.md)
do not complete daily rule management. The accepted product plan includes copying
configuration, retrying failed Operations and bounded enable/disable batches.
Those actions must not introduce another execution authority, generic bulk-write
endpoint or implicit deployment from a read-only preview.

## Decision

- Copy loads an editable **new-rule proposal** into the existing Direct or Relay
  editor. It defaults to disabled, clears the listener port, retains the explicit
  Profile revision and ordered path, and inherits no ID, revision, authorization,
  applied state or health. Existing builders produce the submitted ForwardSpec.
  Relay/multihop still require a fresh original plan preview; changing Profile
  selection is the existing explicit choice to use that Profile's current revision.
- A Console batch contains at most ten selected rules from one visible page.
  Configuration, expectedRevision and a distinct idempotency key per command are
  detached before dispatch. No durable Batch entity or new server batch API exists.
  Every command delegates to the existing owner-owned Forward PUT and original
  authorization, resource, capacity, CAS and Runtime ledger paths.
- Dispatch is serial with five-second request deadlines and explicit consent.
  Complete client rejection responses are retained per item and do not roll back
  other items. Unknown/server/network outcomes stop the unsent tail. Only an
  additional explicit confirmation can replay the **same key and frozen request**;
  replay never automatically dispatches the tail. A definite rejection requires a
  new reviewed selection, not silent revision refresh or replacement.
- Retry first reads the scoped Operation and its current Forward. Console requires
  a non-recovered failed source that is still the latest Operation and has the
  current desired revision, then proposes the original retry command. These reads
  are advisory, not locks. The existing server transaction is the final authority
  for source status, current revision, grants and execution preparation.
- Operation detail gains the additive `forwardId` field; retry JSON is closed to
  exactly `expectedRevision`. The API remains one command per Operation/rule.
- Stop aborts the current local request and stops subsequent dispatch, but an
  aborted request may already have committed. Closing an unresolved plan requires
  acknowledgement; disconnect aborts/discards all local state. None of these actions
  remotely cancel, revoke, roll back or delete accepted Operations.

List-time recovery-suspended rules cannot be selected for this batch. That UI check
is not a server recovery boundary: the original maintenance, recovery review,
credential invalidation and authorized command semantics remain authoritative.

## Consequences and Evidence

There is no cross-rule atomicity, automatic compensation, automatic retry,
background durable queue or shared physical tunnel claim. Accepted/unchanged
requests remain distinct from applied or healthy execution. Core, ADP, Journal,
Fence and database schema are unchanged.

Controller/API tests and real Chromium -> Control -> native Agent -> TCP fixture
coverage are authored and connected to Actions. The browser fixture explicitly
injects one terminal failed Operation to exercise retry; this is not evidence of a
spontaneous Agent failure. The fixture uses the existing ephemeral-CA-only browser
trust exception, keeps credentials out of storage, and uploads only redacted
evidence and designated screenshots. No local functional/browser/MySQL tests ran.
Real Relay/multihop copy and referenced-rule Profile editing browser evidence remain
separate pending gates. See [the contract](../spec/native-rule-management-v1.md).
