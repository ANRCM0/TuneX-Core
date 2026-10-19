# Identity Owner

Public module interface 1, source candidate and unverified. Import public.ts, not
service.ts or the legacy Identity constructor as a module contract. IdentityQueries
is the independent bearer/member-list surface used by HTTP. IdentityOwner<Tx> joins
the existing Scope/owner/executing/member/audit contracts without deriving them
from an implementation class. Member roles, command/recovery/view DTOs and policy
remain here, not in generic L1 or a database adapter.

IdentityService consumes L1 IdentityAccessHost, transaction/store/account-lookup,
secret and value-codec ports. Composition binds MySqlIdentityStore, the explicitly
separate pool lookup, existing native secrets/codec and clock. The old Identity(db)
constructor and helper exports remain a compatibility bridge for the same owner.

Bootstrap still inserts account -> scope -> owner membership in one transaction.
Membership change still validates -> owner checks -> scope update lock -> member
update lock/revision -> shared account lookup/create -> changed/revision bound ->
membership write -> access audit. Duplicate-account native errors are mapped only
for membership creation; bootstrap retains its original error path. A no-op keeps
its revision and emits no member/audit write. The caller supplies the transaction
for changeMember/audit/recovery so Runtime reconciliation stays atomic with access
changes. Do not add an event, nested transaction or retry here to replace that.

Recovery remains an explicitly invoked protected recovery command: read ordered
locked accounts, rotate every token, then deactivate non-owner memberships. It
does not reset Runtime, Journal or authority history. This extraction does not run
recovery or create accounts. All original tables, bearer grammar, token hashes,
errors and lock ordering require later exact-source acceptance (readiness item 20).
