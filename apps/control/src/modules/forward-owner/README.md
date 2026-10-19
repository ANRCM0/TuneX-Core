# Forward Intent State Owner

Public state interface 1, source candidate and unverified. Import public.ts for
ForwardStateOwner, existing read/write/reference contracts and ForwardStateService.
Old Forwarding() and forwarding-ports/forward-query-ports exports remain native
provider/type bridges to this one owner. This is the original intent state owner,
not a new Forward command API, compiler, execution ledger or authorization issuer.
The existing ForwardCommands and Runtime application coordination remain in place.

Composition supplies ForwardIntentStore and StoredValues. L3 retains explicit
Profile-before-Node reference selection, missing intent errors, affected-row
revision conflicts, flag projection and ordered current/revision writes. L2 owns
original MySQL predicates/locks/argument order and JSON representation. Every
operation uses the supplied transaction, with no pool, nested transaction, retry,
clock/ID read, extra validation or authority fallback.

Keep forActor's original inclusion of recovery-suspended intents distinct from
forNode/forReferencedNode/forProfileActor filtering. record includes deleted and
recovery state; get/currentForUpdate exclude deleted rows. revisions returns the
original raw stored spec values, newest first and limited to 25. Intent reads use
the old lazy decoder, not a newly introduced closed Forward parser or clone.

insert/replace/markDeleting keep current-row write -> revision-row write, including
separate encoding at each original point. Replace clears deleting/recovery flags;
deletion only changes its original fields. Quarantine sets the original flag and
never clears protected Runtime/Agent history. Existing higher commands keep
authorization, idempotency and Runtime reconciliation in the same transaction.
Required default/injected/SQL/codec/rollback/alias traces are in readiness item 22;
none have been executed.
