# FR-0034: Account Self Credential Rotation

Date: 2026-10-24.
Status: authorized-under-standing-source-scope; implementation in progress, unverified.
Owner and authorization: original Identity account owner. The human requested P
implementation on 2026-10-24; the standing 2026-10-19 source authorization permits
this concrete additive foundation proposal. Verification and publication are separate.

## Task Proposal

1. Layers: additive L1 account credential storage effects; L2 original accounts SQL
   and HTTP/browser representation; L3 Identity credential command/query.
2. Public interfaces: original Identity authenticate/codec/secrets, transaction,
   explicit credential-store port and Identity owner public entry.
3. Foundation impact: new injected storage port, additive Control HTTP member,
   migration 0042 for account-owned audit only. L0, Agent, authority, Journal,
   Runtime ledger and membership/grant execution semantics are unchanged.
4. Contracts: authenticated GET/PUT `/api/v1/me/credentials`; PUT closed body
   `{credentialVersion:1,newToken:string}`. Actor derives only from bearer identity.
5. Acceptance: source cases for own-account isolation, inside-transaction current
   credential check, competing rotations, same-current-token replay, audit failure
   rollback, duplicate credential, bounded history and uncertain browser responses.
   Exact-source HTTP/MySQL/Web/Actions execution remains separately gated.
6. Parallel impact: serial P source tree; public exports, native composition,
   schema/profile catalog and UI integrate together. Existing Identity constructors
   and Scope membership consumers remain bound to their original behavior.

## Why Existing Extensions Are Insufficient

`changeMember` intentionally cannot rotate an existing account's global token.
Scope ownership must never grant that right, including an account shared across
Scopes. The original bearer hash/account remains the only authentication owner.
Add a self-service use case, not another login system, credential issuer or
recovery override. Lost credentials continue through the original protected
operator recovery procedure; this endpoint requires a valid current credential.

## Chosen Semantics

The original Identity authenticator derives the actor. Within the caller's original
transaction the credential owner locks that account, compares the presented bearer
hash against its currently stored hash, then changes it with a SQL hash CAS. This
second check prevents a request authenticated before another rotation from changing
the new credential. No caller-supplied account/Scope identity is accepted.

If the authenticated current hash already equals the requested new hash, return
`changed:false` without another write or audit. Otherwise update the original
accounts row and append an account-owned `credential_rotated` event atomically.
The old token stops authenticating after commit; Agent certificates and existing
Forward grants/membership are unaffected. A new credential cannot duplicate an
existing account credential. Errors disclose no token, hash or other account ID.

This use case needs no fake Scope or second idempotency ledger. On an uncertain
response, the user retains both saved credentials and the original new-token body.
Explicit replay using the new token returns a no-op success if it is already
active, or the original request using the old token can commit if it is still
current. No automatic retry/credential switching occurs. A 401 cannot prove the
earlier request never committed; another rotation/recovery may have superseded it.
Closing/resetting the UI clears local secrets, without cancelling a remote write.

GET returns own-account metadata only: fixed credential version/type, global
account scope, retained event count/limit and nullable `lastSelfRotatedAt`.
The history source is explicitly self-service rotation, not a complete log of
operator recovery token changes, whose audit remains with the recovery owner.
Neither response returns credentials or hashes. Events contain only ID, account,
kind and time; no old/new token or token fingerprint. History has a 1024-event
per-account ceiling under the account lock. Exhaustion refuses the whole command;
there is no source-stage pruning or protected-history deletion workaround.

## Migration, Consumers And Version Plan

0042 creates only `account_credential_events` with the original account foreign
key. Existing tokens/accounts stay unchanged. Append a reviewed Control profile
`adp3-account-credentials-v1`, preserving all older migration ceilings and Agent
profiles. Account rotation adds no Agent persisted/wire field.

Export AccountCredentialStore from framework/public and IdentityCredentials plus
AccountCredentialApi from identity-owner/public; Identity module version 3 and
Control HTTP version 3 describe the additive account surface. Existing
IdentityQueries/IdentityOwner signatures, MemberChange and recovery aliases remain.
Control application explicitly supplies the original Identity, native secrets,
codec, clock and the new same-accounts SQL adapter. Required Control API fakes,
public version assertions and schema catalog consumers must migrate, not use
permissive optional providers or silently bypass the endpoint.

The new fixed `account-credentials.js` asset uses the unscoped account routes,
with no cookie or actor override, ten-second reads/writes, current-tab secrets
and explicit old/new verification controls. Native console lifecycle clears
pending account credentials on account/Scope reset; after a confirmed change it
replaces the current in-memory bearer and rereads ordinary scoped data. No
automatic retry or fallback credential switching is introduced.

## Acceptance And Known Limits

Cases remain authored/unexecuted until source freeze. SQL integration must prove
the same account lock/transaction, hash CAS, single audit, duplicate-token refusal,
commit uncertainty and rollback at every statement. Browser cases distinguish
saved new token, fixed uncertain command, old/new explicit verification, account
reset and late responses. Cross-Scope owners cannot rotate someone else's account.
Do not claim physical immediate revocation of previously accepted operations or
existing Agent execution merely because the login credential was changed.
