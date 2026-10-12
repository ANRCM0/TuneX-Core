# Membership and Node grants

This slice extends the existing scope owner/member/grant model. It adds owner-only
management with CAS and persistent idempotency, and rechecks the intent's actual
execution authorizer whenever Runtime compiles a full Node snapshot.

## Roles and boundaries

- The scope owner is created through the existing explicit bootstrap. Owner
  membership cannot be removed or demoted by a member command.
- A manager can perform the existing operational scope-management use cases, but
  still needs an explicit Node grant to create/update/retry execution on that Node.
- A viewer can query resources in their scope but cannot write operational intent.
- A removed member retains identity/audit/history rows but has no scope access.
  Possessing the bearer token does not bypass the membership check.

Only the scope owner can modify member roles or Node grants. Operational managers
cannot self-grant Node use or invite/demote other members. A Node's owner/manager
authority is separate from its execution-use grant. The initial provisioning grant
is explicit and remains subject to membership and Node policy.

`authorization_actor` is Forwarding-owned metadata outside Core's domain object.
User acceptance assigns it; accepted changed user intent or explicit retry can
replace it. A canonical no-op does not silently assume someone else's authority.
Runtime policy/revocation Operations retain their audit requester but do not change
the intent's authorizer. Kernel/TLS Node identity also remains a separate dimension.

Resource and Operation queries expose the operation kind; the Operation also
reports audit requester and retry source. Policy/grant withdrawal can therefore
be distinguished from user deletion without equating requester and execution authority.

Migration `0004-access-management.sql` adds active/revision fields, Node grant
revision, authorizer metadata and access audit. Existing VNext data derives the
authorizer from the latest explicit user-write Operation. Unresolved authorizer
data fails closed; the latest system Operation requester is never a fallback.
Historical V2 remains unsupported.

Migration advisory locks use a bounded digest of the actual database name, so
valid long database names do not exceed MySQL's lock-name limit. The connection is
released even when lock acquisition or release fails.

## Commands and transactional behavior

GET `/api/v1/scopes/{scope}/members` is owner-only.
PUT `/api/v1/scopes/{scope}/members/{actor}` accepts exactly:

```json
{"expectedRevision":0,"role":"manager","token":"a-client-generated-random-bearer-token-at-least-32-characters"}
```

Role is `manager`, `viewer` or `removed`. Revision 0 is for a new membership;
updates require its current revision. The token is required only to create an
otherwise unknown account. It is supplied over trusted HTTPS from a protected
input file, stored only as a SHA-256 digest and never returned. Existing account
credentials cannot be replaced by a membership command. A previously registered
account can join another scope without changing its credential.

PUT `/api/v1/scopes/{scope}/nodes/{node}/grants/{actor}` accepts
`{expectedRevision,allowed}`. Its CAS revision belongs to the Node's whole grant
set. Granting use requires an active manager in the same scope and a non-revoked
Node. Removing a grant preserves all identity, audit and lease history.
GET `/api/v1/scopes/{scope}/nodes/{node}/grants` returns the revision and actors.

Every write requires a stable `Idempotency-Key`. Canonical no-ops preserve revision
and return 200; changed commands return 202. A replay returns the original response
after current owner permission is checked. Changed input with the same key conflicts.
Account/member/grant state, access audit, withdrawal/redeployment Operations and
replay response share one MySQL transaction. Audit/intent failure rolls back the
entire acceptance, including a newly created account and successful-key record.

Role demotion/removal and grant withdrawal enumerate affected intents and persist
withdrawal Operations. New snapshots omit unauthorized execution; old instances
follow bounded drain and historical lease rules. API responses report the latest
possible authorization cutoff, not a claim that an offline holder instantly stopped.
Other explicitly authorized actors on the same Node remain independently active.

Stopped execution also safely releases obsolete reservations when a disabled
intent changes port, while retaining the current desired reservations. It never
uses a role/grant withdrawal as a reason to release an unexpired old holder.

Explicit manager/grant restoration can create fresh execution generation/fence
without changing the user's Forward revision. It does not erase retired counters.
The owner retains logical-delete cleanup authority after another member loses
scope/Node access. Replayed accepted writes by a removed actor do not disclose data.

## CLI

```sh
npm run control:cli -- members scope-dev
npm run control:cli -- member scope-dev actor-id member-input.json stable-member-key
npm run control:cli -- node-grants scope-dev node-id
npm run control:cli -- node-grant scope-dev node-id actor-id grant-input.json stable-grant-key
npm run test:access
```

`member-input.json` should be protected when it contains a bearer secret. Prefer a
cryptographically generated token, not the illustrative string above. Audit and
idempotency responses contain no bearer plaintext. Owner token and trusted TLS/CA
configuration follow the existing Control CLI environment setup.

## Evidence and remaining scope

The acceptance suite uses real MySQL transactions, trusted HTTPS and native Linux
Agent/client/target sockets. It verifies viewer/manager boundaries, owner protection,
concurrent CAS, account credential immutability, post-member failure rollback,
idempotency, explicit Node use, grant withdrawal/restoration, preserved authorizer
under owner policy work, same-Node actor isolation, demotion/removal, owner cleanup,
secret exclusion and trusted CLI behavior. It runs natively on Linux in CI and via
WSL on the Windows development host. These topologies are labeled separately.

Redacted evidence is `.artifacts/access/run-*/evidence.json`, with commit/dirty state,
Agent SHA, actual OS synchronization status and kernel. Local Linux Agent checks
remain backed by Windows Node 24/MySQL 8.4 Control. Native Linux CI is configured,
but no remote CI result is claimed by local execution.

This is the minimal scope management model, not a complete identity product:
account recovery, interactive login, fine-grained roles, quota/capacity measurement,
database recovery, Relay, Web and production release gates remain project work.
