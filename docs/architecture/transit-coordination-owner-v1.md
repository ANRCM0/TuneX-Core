# Transit Offline Coordination Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, the original offline journal, not live Transit execution.

## Public Chain And Original Storage

Public TransitCoordinationService consumes required TransactionBoundary and
TransitCoordinationStorage contracts. The lower contract retains raw mutable
journal fields, opaque receipt_highwater, missing undefined and parameterized
phase strings; it neither validates a product phase nor supplies an authority.
MySqlTransitCoordinationStore owns the original SQL using the caller transaction,
with no new pool, transaction, retry or product decision. Scope-filtered stage and
Scope-less recovery-stage queries remain separate. Runtime session projection
still reads only session_epoch; physical slots retain owner/Fence/generation.

Both journal lookup and recovery retain original FOR UPDATE locks. Recovery
selects preparing/activating/sealed in forward_id,generation order. Insert keeps
the original columns and literal empty high-water JSON. Update keeps exact
revision AND journal_digest CAS and returns affected rows to the product owner.
The owner encodes high-water before digest/time as in original argument evaluation;
the adapter does not encode it later or eagerly parse a retained row.

Control binds the public service and lower store explicitly as the preview
planner. This does not add a confirmation route. Delivery still consumes the
peek-only public port and never treats received ACK as authenticated execution.

## Complete Original State And Proof Chains

- Stage admission checks generation before the scoped row lock, then missing row,
  original actor, retained plan integrity and reserved state. There is no current
  membership/Forward read added in place of the original authorizing actor.
- Ownership locks unique Node sessions in sorted order, then physical resources
  sorted by Node/protocol/port. Every original session/owner/Fence/generation
  comparison and refusal remains with the product, not in SQL.
- Begin performs stage, freshness, ownership and prior-journal lock/refusal before
  constructing preparing/revision 1. Digest precedes TWO separate dynamic clock
  samples for created_at and updated_at. Insert and offline-step construction stay
  inside the original transaction; a later step error rolls back that insert.
- Peek locks stage then journal and decodes/verifies the body. Freshness/ownership
  run only for preparing/activating. Compensation and terminal paths do not gain
  new admission checks; terminal planned step remains null.
- Confirm refuses an absent verifier before opening the transaction. Stage/body
  admission and conditional freshness/ownership precede the pending step. Original
  proof identity, action/digest, monotonic report sequence, receivedAt future/age
  windows, assignment count/uniqueness/session/Fence/generation/condition checks
  run at the original clock point BEFORE awaiting the explicit verifier. No
  default verifier or later reinterpretation of a transport receipt is added.
  Only authenticated proof advances high-water, position and original phase
  transitions; revision limit and affected-row CAS remain enforced in the Tx.
- Fail intentionally does not require freshness or current physical ownership.
  Quarantined returns null; compensating returns its existing step; other phases,
  including sealed, enter compensating at position zero with retained high-water.
- Recovery locks the original phase set, loads each stage without a new Scope
  filter/actor admission, verifies plan/body and persists compensating. It does
  not repeat live freshness/ownership, issue requests or free physical ports.

bodyOf retains original phase/revision/position, plan identity, object/high-water
membership and counter checks and full digest comparison. Malformed JSON and
unexpected shapes keep their original refusal/exception ordering; this extraction
does not silently harden or normalize historical evidence. persist still refuses
MAX_COUNTER before encoding, hashing, time sampling and writing. The dynamic
native clock calls do not capture Date.now at construction.

## Legacy Entries And Location Inventory

modules/runtime/transit-coordination.ts retains the one-argument constructor, db
field and own public async begin/peek/confirm/fail/quarantineRecovery methods. A
lazy transaction bridge reads its existing db at the original call phase. Original
type and offlineTransitStep exports directly alias public owner entries. There
is one state-machine implementation and one coordination SQL implementation.
Remove legacy entries only after caller inventory and exact-frozen-source
compatibility acceptance, not because the new constructor exists.

The earlier missing-file interruption used an incorrect src/runtime path. Current
source is under src/modules/runtime and did not need restoration. See the scoped
[current Control source map](foundation-control-source-closure-v1.md). No new
directory or competing legacy implementation was created to mask that error.

## Remaining Work And Evidence

Readiness item 64 is planned only. Staging/abort and reservation writes still need
source ownership work, as do preparation format/private dependencies, A1 residuals,
Agent/native, Runner and whole-source classification. There is no new protocol,
schema, feature, issuer, Runtime ledger, Agent authority/Journal or history reset.
No tests/type/syntax/static/boundary checks, formatters, generators, builds,
experiments, CI, commits/pushes or delegation ran. Functional/MySQL/network
acceptance waits for later authorization and Actions on the same frozen source.
No A2/foundation acceptance or upper-module gate is established.
