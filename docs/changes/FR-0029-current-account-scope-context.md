# FR-0029: Current Account Scope Context

Date: 2026-10-21 (Asia/Shanghai).
Status: authorized source proposal; recorded before implementation.

## Task proposal

1. Layers: L3 original Identity owner query and DTOs; L1 original Identity storage
   port addition; L2 original MySQL Identity provider. L0 and execution stay.
2. Public interfaces consumed: IdentityAccessStore, IdentityValueCodec and the
   existing transaction boundary, composed by the original Identity owner.
3. Foundation impact: additive read-only IdentityAccessStore method and raw claim
   types. Identity access interface version advances to 2. No change to existing
   bearer, membership, owner, executing, grant or protected recovery semantics.
4. Added contracts: `IdentityQueries.context(actor, query?)` returns only that
   account's effective memberships and owned Scope identities/roles. Closed
   query `{limit?: string, after?: string}` uses bounded ASCII Scope ID keyset
   pagination, default 25 and maximum 100. Storage returns at most limit + 1 raw
   records on the supplied transaction; L3 validates and projects the response.
5. Planned acceptance: only active membership or ownership visible; no cross-user
   Scope/count/token leakage; bounded cursor and malformed-provider rejection;
   original transaction and SQL bindings; no mutation or authority upgrade.
   Source cases are authored but no verification is executed under this task.
6. Parallel impact: only Identity service/contracts, original L1 storage port and
   MySQL Identity adapter, new contract cases and integration README. Main task
   owns public exports/version, HTTP `/api/v1/me/context`, composition and UI.

## Authorization and decision

The human's 2026-10-21 N stage instruction authorized named parallel source work;
this task is the named N2 current-account context slice. The standing 2026-10-19
foundation source authorization permits the additive port proposal. These source
authorizations do not open test/static/build/CI/network/commit/push/release gates.

Use the original account, Scope and membership tables. A caller-supplied actor
parameter is an internal identity claim; HTTP must supply the actor returned by
the original bearer authentication, never a request-body/query actor override.
No second account registry, session authority or resource grant is introduced.

The response carries actorId, limit, truncated, nextAfter, and Scope items with
scopeId, role (owner/manager/viewer), membership (active/inactive/absent), nullable
membershipRevision, canEnter and canManage. Role is a product identity fact;
canEnter reflects the original active-membership requirement and canManage also
requires its can_manage flag. An owned Scope with missing/inactive membership is
discoverable but explicitly cannot be entered; this query does not repair or
reactivate membership. Other inactive/nonmember Scopes are invisible. Ownership
is never inferred from membership or execution authorizer fields.

No total count is returned. Keyset pagination uses strict `scope_id > after`, a
stable binary ASCII ordering and one bounded lookahead row; the continuation is
the last returned Scope ID only when another visible row exists. Each page is a
current transaction observation, not a globally frozen multi-page snapshot.

## Compatibility and integration

IdentityQueries gains a required method. Existing implementers/test fakes must
implement it; IdentityAccessStore providers must implement scopeContext. Public
exports and the Identity module successor version are integrated by the main
task. Existing Identity subclasses inherit the same query automatically.

Existing extension points suffice: this is an injected raw read effect plus L3
projection, with no change to the L0 Core API. No schema migration is needed.
No token, token hash, other account identities, resource inventory or grant is in
the projection. Choosing a Scope still requires each command/query's original
Scope and resource authorization, including private-machine ownership and admin
resource purpose restrictions introduced by FR-0028.

## Acceptance state

Source implementation and case authoring are tracked separately from acceptance.
No new source revision has been verified here. Exact-source Actions HTTP/MySQL
acceptance remains planned, including membership removal between pages and an
owned Scope whose membership is absent/inactive. No production or release claim.

## Native Console Integration

The main source integration supplies public Identity exports, the bounded context
HTTP endpoint and four explicit native assets: account-context, line-builder,
template-reference and admin-resource-console. ConsoleModel2 rejects missing use
facts and checks ingress purpose before building Direct commands. The existing
PathTemplate initializer adds loadDraft while retaining exact Endpoint capture and
explicit immutable publication. These native/browser additions are unverified.

The line selector exposes two explicit paths. Saving uses the original template
editor; direct use calls additive initRelayConsole.loadPathDraft and needs no
template name or template publication. This operation re-reads role-aware Node
candidates and the exact selected Profile, checks the original multihop switch,
then loads a new disabled Forward draft into the original form. It fills no target,
creates no Operation and dispatches no command. Original Endpoint/Relay preview,
explicit user submission, Forward CAS/authorization/idempotency and resource
admission remain mandatory. Loading confirms replacement of existing editor state
and does not cancel or replay an earlier uncertain command. Account clear discards
pending native profile/candidate/draft responses using the original connection
guard plus local session/edit versions. Later Actions must demonstrate both routes,
purpose revocation, stale reads, exact revisions, disabled defaults and no hidden
template/Forward writes before explicit submission.
