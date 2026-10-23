# Account Credentials v1

Date: 2026-10-24. P2 / FR-0034 source candidate, unverified.

## Account Boundary

GET and PUT `/api/v1/me/credentials` use the original Bearer authentication,
no cookies, maintenance admission and no-store response. Neither endpoint accepts
query parameters, a caller-selected actor/Scope, nor a credential in the URL.
The identity is global to the authenticated account. Scope governance cannot
rotate another account's token; original member commands still enforce that rule.
An active Scope membership is not needed to manage one's own login credential.

GET returns the following shape, without any credential or hash:

```json
{
  "credentialVersion": 1,
  "actorId": "account-a",
  "kind": "bearer",
  "scope": "account-global",
  "history": {
    "source": "self-service-rotation",
    "retained": 0,
    "limit": 1024,
    "lastSelfRotatedAt": null
  },
  "agentCredentialsChanged": false
}
```

The history describes only this self-service rotation owner. Protected operator
recovery retains its original audit and may change credentials independently.
`lastSelfRotatedAt` is a nullable UTC epoch-millisecond timestamp; it is not an
assertion that no other credential operation has occurred.

## Rotation And Unknown Results

PUT accepts a closed JSON body of at most 1024 bytes:

```json
{"credentialVersion":1,"newToken":"THE_SAVED_RANDOM_NEW_BEARER_TOKEN"}
```

The value must satisfy the original 32..128-character Bearer grammar. A user
prepares and securely saves the new random credential before submitting it.
The endpoint never generates or returns the secret. It reauthenticates through
the original account owner, locks that account in the original transaction and
requires the presented token's hash to equal its current stored hash. The SQL
update additionally compares the same current hash. Concurrent requests carrying
an old token cannot overwrite a successor that committed after authentication.

A changed credential and one account-owned audit record commit together. The old
Bearer stops authenticating after commit; existing Agent certificates, membership,
grants and already accepted Runtime execution are not changed by this command.
The response is GET metadata plus `changed:true`. Choosing another account's
credential produces a generic conflict, without revealing its identity.

If the authenticated current token already equals the requested new token,
return `changed:false` without another event. This is the explicit verification
path after a lost response. It needs no fake Scope or second request authority.
The client does not automatically retry or switch credentials. It can explicitly:

1. Submit the identical new-token body using the saved new Bearer to confirm it
   is currently active. A no-op response confirms current validity.
2. Submit the identical body using the saved old Bearer if it is still current.

A refusal after an uncertain result does not prove the original write rolled
back. Another rotation/recovery may have superseded the credential. Preserve
both saved secrets and inspect the original account/recovery path. Closing or
clearing the local UI does not cancel a remote transaction.

## Storage, Compatibility And Consumers

The Identity account remains `accounts.token_hash`. Migration 0042 adds only
`account_credential_events`: event ID, account ID, fixed kind and timestamp.
No token, hash, request body or credential fingerprint enters the event or view.
The per-account history ceiling is 1024 under the same account lock. Exhaustion
refuses a changed token transaction; no history is silently evicted. A same-current
verification remains permitted at capacity.

Public chain: `IdentityCredentials` from identity-owner/public -> original Identity
authentication + TransactionBoundary -> L1 AccountCredentialStore -> explicit L2
MySqlAccountCredentialStore -> original accounts row and own event. Control's
existing composition supplies native codec/secrets/clock and the same database.
Old Identity/Member/Recovery constructors keep their original bindings. Identity
module3, Control HTTP3 and AccountCredentialApi1 identify the new public surface.
UpgradeAssessment6 adds Control profile adp3-account-credentials-v1 at 0042;
older ceilings and all Agent profiles remain unchanged.

The native `account-credentials.js` view uses this unscoped route independently
of the workspace picker. Password fields/pending secrets live only in the current
tab. Unknown writes freeze preparation, with explicit old/new verification buttons.
A confirmed change replaces the tab's current Bearer and clears local scoped
operation contexts without cancelling their remote actions. Receipts/metadata
never export the secret. Account/Scope reset discards late results and local
credential memory; the user must retain the saved copy outside the page.

Source cases: account-credentials-contract, account-credentials-http-contract,
account-credentials-mysql-acceptance and Web account-credentials-flow. All are
authored/unexecuted. The native SQL case requires disposable MySQL in Actions;
its no-database skip is not acceptance. Full public versions/assets, security
headers, original recovery and real deployment remain separately verified gates.
