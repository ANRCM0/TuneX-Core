# Identity Owner

Public module interface 2 successor candidate, source-only and unverified. Import public.ts, not
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

## Current account context (N2 / FR-0029)

`IdentityQueries.context(actor, input?)` supplies the Scope picker with the
authenticated actor's current effective memberships and owned Scopes. The main
task integrates `GET /api/v1/me/context` and supplies `actor` from the original
bearer authentication. An HTTP actor override is not part of this contract.

The closed input accepts `limit` (canonical decimal 1-100, default 25) and `after`
(a valid Scope ID). The response contains actorId, limit, scopes, truncated and
nullable nextAfter. Each Scope carries only scopeId, role, membership state,
nullable membershipRevision, canEnter and canManage. There is no total count,
other actor identity, token/hash, resource inventory or private-resource grant.

The original IdentityAccessStore now requires `scopeContext(tx, actor, window)`.
Its raw records carry original Scope owner and the current actor's nullable
membership. The original MySQL provider selects only active memberships or owned
Scopes, orders by binary ASCII Scope ID and reads at most limit + 1 records.
IdentityService validates all raw claims, ordering, cursor and lookahead bounds
inside the original transaction before projecting the requested page. nextAfter
is the last returned Scope ID only when a visible lookahead row exists. Pages
reflect separate current reads rather than a frozen multi-page snapshot.

Ownership alone does not repair membership: an owned Scope with absent/inactive
membership appears with canEnter=false and canManage=false. All original
Scope/owner/executing and per-resource checks remain mandatory at use time.
Choosing a Scope cannot grant management, private-machine use, or admin-shared
resource purpose rights.

Main-task exports: framework public must expose IdentityScopeContextWindow and
IdentityScopeContextRecord; Identity public must expose IdentityContextQuery,
IdentityScopeView and IdentityContextView and advance its module version to 2.
IdentityAccess interface advances to 2. Existing store providers and independent
IdentityQueries fakes must implement the added methods. Constructors and original
membership/recovery command implementations do not change; the legacy Identity
subclass inherits this same query owner.

`test/identity-context.test.ts` authors role/visibility, unavailable owner,
pagination, closed input, malformed claims, transaction/provider failure and SQL
projection/binding cases. No tests, static/type/syntax/boundary checks, build,
formatting, CI, network experiment, commit or push have run for this slice. Fake
SQL assertions are statement-construction cases, not MySQL/HTTP acceptance.
Exact-source Actions should additionally cover membership removal between pages,
mixed membership/ownership across accounts, token-free HTTP projection, invalid
query rejection, and unchanged authorization after selecting a returned Scope.
