# PathBinding Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, the original exact-template binding and provenance chain.

## Public Rules And Storage

modules/path-owner/public.ts now exposes the original parsePathSelection and
expandPath from binding-values.ts and the existing Path binding contracts. The old
modules/path-binding-contract.ts is a direct function alias, not a second parser.
ForwardCommands, PathGroups and the existing group/publication/Ingress value owners
consume the public rules. Their other dependencies remain separate source work.
Closed fields/prototypes, exact digest/revision bounds, original error order and
deepFreeze behavior are retained. Expansion preserves business intent and physical
ingress; it uses the same original Core parser and ordered downstream nodes.

L1 framework/public.ts exposes the original stored selection/provenance fields,
transactional reader/writer ports, an independent sequence reader and ReadPageWindow.
It reuses the existing lower ForwardIntent/ForwardValue, not Path application types.
Original PathSelection/PathBindingRecord/Reader/Writer specialize these records and
ports without new required methods, readonly or nullable meanings. In particular,
the existing at method is a separate lower contract, not added to PathBindingWriter.

L2 MySqlPathBindingStore is the single original SQL implementation. Raw JSON
decoding, Boolean projection, double Scope predicates, optional revision filter,
deleting exclusion, count-before-page and literal bounded pagination are unchanged
in source intent. SELECT b.* and the original history query remain as before; this
slice does not claim a new projection policy or query-level history LIMIT.
The existing 64-entry invariant is enforced by append and checked by the application.

Append retains the original exact numeric/DECIMAL text conversion and corruption
error, then the 64-entry refusal before either write. It inserts immutable history
and updates the current pointer in that order, returns the same spread plus sequence
and uses the original bound arguments. Detach deletes only the current pointer
under the original Scope predicate; immutable history is never cleared. The caller
must hold the original Forward row lock on the same supplied transaction. The store
does not create a pool, acquire that lock implicitly, commit, retry or grant authority.

## Complete Original Chains

- Existing HTTP/NativeTunnel binding get -> PathBindingApi -> PathBindings ->
  original Scope authorization and public Forward record read -> lower current/
  history ports -> MySqlPathBindingStore -> original Forward/provenance
  tables. Original Path validators check selection, head/revision/digests, contiguous
  history, current pointer and expanded topology at their old call points.
- Existing applyPath -> ForwardCommands -> manager authorization/idempotency ->
  original Forward row lock/CAS/suspension checks -> public Path resolve/reference
  checks -> pure Forward decision -> original safety preparation, replacement,
  Runtime planning/Operation and capacity checks -> group detach/Path accept and
  original response, all in the same transaction. applyGroup resolves the group
  before the path and accepts group provenance after Path accept. Publication
  adapters retain their exact source/provenance comparison around these same owners.
  Unchanged intent may attach provenance without restarting the Forward.
- Ingress creation -> existing owner transaction and manager check -> exact
  template/Path resolveCreateIn and frozen-spec comparison -> original preparation,
  Forward insert, Runtime plan/Operation and capacity check -> Path accept, then
  publication-state projection. The original insert holds the new Forward row in
  that transaction; no extra currentForUpdate or nested transaction is introduced.
- Path resolve -> original current-provenance check -> exact locked template ->
  public NativePathReferences -> original Node/Profile/Endpoint contracts in that
  transaction -> expansion. Archived templates cannot receive new bindings; old
  historical provenance retains the original archive and live-reference behavior.
- Normal Forward update -> original PathGroup/Path preserve -> current provenance
  validation -> detach current pointer only when topology differs. PathGroup history
  continues reading the original sequence through at, without copying Path history.
- Preview reads use public Forward record and template/reference owners; reference
  reads authorize Scope (manager for a target), load template head/exact target and
  its original declaration checks before the lower current-reference join/page.
  Both retain their original declaration checks,
  recovery suspension/archive/unavailable reasons and read-committed consistency.
  They remain persisted metadata, reserved:false, executionAuthorized:false and
  fullPlanAuthorization:false; no read proves current health or authorizes execution.

PathBindings now uses existing public L1 pagination and L2 digest/default clock/ISO
effects at the original points. Default clock selection captures Date.now without
reading time; the reference observedAt still uses new Date() behavior through the
existing currentIso provider, not a replacement Date.now sample. Product decisions,
transaction ownership, query field order and refusal order stay with PathBindings.

## Legacy Entry And Remaining Work

MySqlPathBindings remains a stateless zero-argument class with original async
prototype methods, including at and subclass override points, delegating to one
lower store. Control explicitly assembles that lower store and passes the same
instance to PathBindings and PathGroups. Old type paths remain lower-specialized
public names. Remove the wrappers/aliases only after caller inventory and accepted
compatibility evidence on a frozen revision, not as a source-cleanup shortcut.

Readiness item 56 is planned only: public/legacy identity and type compatibility,
initialization, numeric sequence handling, exact SQL/lock/argument and rollback
behavior, provenance/no-op/detach and read-only preview must be accepted later.
Historical source-string tooling migration waits for verification authorization.
Functional/MySQL/Agent evidence belongs in Actions on the same frozen source.

The original binding adapter's previously unclassified product/paging imports are
now assigned to a precise wrapper and a lower SQL owner, not a whole-owner exception.
Remaining group/publication/Ingress SQL and format/application owners, Transit, A1
residuals, Agent/native and full repository classification stay open. There is no
L0/frozen semantic, schema, protocol, feature, auto-selection or protected-history
change. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran. Source
authorship is not equivalence, A2/foundation acceptance or an open upper-module gate.
