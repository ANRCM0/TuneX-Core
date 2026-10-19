# Transit Preview Delivery Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original preview outbox and received receipts, not execution.

## Public Contracts And One SQL Owner

TransitPreviewDelivery consumes the public transaction boundary, required
TransitDeliveryStorage and a required peek-only TransitPreviewPlanner. HTTP still
consumes only TransitDeliveryApi.poll/report; enqueuePreview is not a new route.
Control explicitly binds the lower SQL store and existing offline journal. The
planner exposes no confirmation, execution, lease or reservation-release method.

L1 retains raw machine, stage, outbox, coordination and receipt records, including
mutable fields, numeric/null flags, opaque JSON and missing undefined. The machine
record extends the existing raw locked-session shape. L2 owns the original
queries/writes with the caller's Tx, no pool, retry or transaction of its own.
Enqueue reads the full coordination projection FOR UPDATE; poll reads only
revision/phase without that lock, and report reads those fields FOR UPDATE. They
are separate storage calls, not one eagerly expanded projection. Pending rows
retain created_at/envelope_digest order, LIMIT 16 and FOR UPDATE. Aggregate
highwater remains a raw first row with nullable last_sequence, not a normalized
sequence authority. JSON serialization remains at the original insert boundary.

## Complete Original Chains

- Enqueue awaits the original coordinator peek in its own transaction, then opens
  the original second transaction. It locks stage and coordination, checks actor/
  reserved state, immutable plan, exact revision/digest and deterministic step,
  then samples time and enforces min(stage expiry, authorization, now+30000) with
  more than 5000ms remaining. It checks nonempty bindings, locks runtime session
  and each physical slot, and checks owner/Fence/generation before reading outbox.
  Existing entries are decoded and checked against current boot/session without
  inventing a new expiration check on that branch. A new command is formatted,
  parsed and inserted in the same transaction. No original transaction is merged.
- Poll opens its transaction before checking fingerprint/counter, locks raw
  machine evidence, checks current session/boot, samples time, and follows the
  original credential predicate order before decoding facts/capabilities. It reads
  bounded pending entries, decodes each before its own time sample, preserves
  short-circuit boot/time filtering, then reads coordination status. Only original
  revision/terminal-phase exclusions apply. No new stage/resource authorization
  read, global snapshot or cleanup is added to this read path.
- Report checks Node/session identity before the transaction; inside it repeats
  current-machine checks before hashing and replay lookup. An exact prior digest
  returns duplicate ACK before highwater/outbox/time/coordination checks; a reused
  sequence with a changed digest is an integrity refusal. New receipts retain
  highwater, pending-envelope identity, command decode, observed-time 30000ms and
  expiry checks, then lock coordination status. Receipt insert precedes pending
  acknowledgement CAS; affected rows must be one. Both writes and ACK construction
  stay inside the same original transaction and failures roll back together.

Delivery's credential predicate order differs from negotiation and remains local
to this product rule. Its SQL is retained separately rather than substituted with
a reader that normalizes flags or decodes facts earlier. Native clock reads remain
dynamic at the original points. No earlier facts error may mask identity refusal.

## Shared Values, Wire Formatting And Compatibility

Original preparation/resource/HopBinding and offline command/proof/body types now
have public Transit declarations. The old paths re-export the same shapes. The
stage verifier has one public implementation, retaining original JSON refusal,
non-executable marker, digest/identity, topology, physical protocols and Fences.
The original deterministic offline step still sorts assignments, reverses only
compensation order, preserves terminal null and computes the same command body.
These are non-authorizing values, not another state machine. Coordination's other
validation, proof authentication and SQL remain in its existing mixed owner.

After the human explicitly authorized continuing the interrupted slice, the
missing coordination-step.ts path was restored as a direct export of the existing
coordination-values.ts implementation. The existing file was neither overwritten
nor copied; the public and old runtime paths reach the same implementation. This
records the recovered route, not a conclusion about how the file went missing.

L2 decodes stored command framing and constructs original preview/ACK envelopes.
The product keeps raw-row identity checks, admission, deadlines and replay policy.
Original JSON/parser/digest/UTC order, envelope keys and parser freeze behavior
remain source-intended unchanged. Formatters take time as data and never read it.
Every command/ACK retains executionEnabled:false; received is not prepared, ready
or removed proof and never calls confirm, advances the journal, issues a lease,
publishes a Snapshot or releases a reservation.

The old TransitDeliveryService keeps its one-argument constructor, db/coordination
fields and own public async enqueuePreview/poll/report methods. Lazy transaction
and peek bridges retain original call timing and existing planner dispatch. There
is one product implementation and one SQL implementation, not copied legacy
logic. Remove precise aliases only after caller inventory and compatibility
acceptance on the same frozen source; construction alone does not certify them.

## Remaining Work And Evidence

2026-10-19 follow-up: the original offline journal now has a separate public owner
and raw lower store; see [coordination boundary](transit-coordination-owner-v1.md).
That source-only slice replaces the coordination debt described below, not the
remaining staging/preparation/reservations work or any unexecuted acceptance.

2026-10-19 follow-up: original offline coordination now has its own public service
and lower SQL store; see [coordination boundary](transit-coordination-owner-v1.md)
and planned item 64. Delivery's original peek-only contract and two transactions
are unchanged. The source-location interruption used the wrong src/runtime path;
the actual modules/runtime entries were present and needed no recovery. See the
[current Control source map](foundation-control-source-closure-v1.md).
The remaining-work paragraph below records the earlier delivery slice; this
follow-up supersedes only its coordination SQL extraction status, not acceptance.

Readiness item 63 is planned only. Staging, preparation, reservations and the rest
of offline coordination still need their own source extraction; shared types and
value aliases do not exempt those classes. A1 residuals, Agent/native, Runner and
whole-source classification remain open. No L0/frozen semantic, protocol/schema,
authority, feature, history reset or live Transit execution change is included.
No tests/checks/builds/experiments/CI/commits/pushes/delegation ran. Functional/
MySQL/network evidence waits for later authorization and Actions on the same frozen
source. This is not A2/foundation acceptance or an open upper-module gate.
