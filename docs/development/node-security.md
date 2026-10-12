# Node credentials and policy withdrawal

The direct-runtime security slice adds credential rotation, Node revocation and
versioned policy updates to the existing single-node TCP/UDP lifecycle. Full
Phase 2 fault/platform and release gates remain outstanding.

## Credential lifecycle

Enrollment records the initial certificate fingerprint in `node_credentials`.
Every machine request uses the actual verified TLS peer certificate; credentials
and the Node revocation flag are checked again inside the runtime transaction.
The certificate subject or a user-controlled identity header alone cannot grant
authority. Existing enrolled Phase 1/2 certificates backfill through migration
`0003-node-security.sql`; this does not migrate historical V2 identity.

`POST /agent/v2/credentials/rotate` requires the current session epoch and a
verified active Node credential. Input is exactly `{requestId,csr}`. A P-256 CSR
is verified and signed for the same Node. The request ID and CSR digest persist
with the certificate response: concurrent retries return one certificate and a
changed CSR conflicts. Only the current credential may start a new rotation;
an earlier credential may replay its accepted request during the overlap.

Old and new credentials overlap for 120 seconds by default, with an absolute
upper configuration bound of 300 seconds. After the overlap, the old credential
cannot fetch/report/rotate. Every fetched snapshot, including an empty one, is
bounded by the authenticated credential's effective expiry. The max issued
authorization records remain unchanged; offline execution cannot be instantly
revoked and remains bounded by its original hard cutoff.

Agent `--rotate` performs the exchange after online Hello. The request/private key
is written before sending and reused on retry. Returned cert identity, trust chain
and key pairing are checked. An atomic protected `credential.json` contains the
new keypair; current execution generation/fence and journal are not reset.
The running client reloads this bundle, closes idle TLS connections and updates
its certificate expiry guard without restarting listener sockets. An incomplete
or malformed bundle fails closed rather than falling back to another identity.
Certificate responses must be recovered within the permitted overlap; loss of
all still-valid credentials requires the documented administrative retirement.

## Owner policy and revocation

- GET `/api/v1/scopes/{scope}/nodes/{id}` exposes policy, credential expiry and
  the latest historical authorization cutoff. It never returns tokens/private keys.
- PUT `/api/v1/scopes/{scope}/nodes/{id}/policy` requires `{expectedRevision,policy}`
  and `Idempotency-Key`; policy revision advances exactly once. Scope management
  authority is checked before the owner command runs in the shared transaction.
- POST `/api/v1/scopes/{scope}/nodes/{id}/revoke` accepts `{}` plus a stable key.
  It irreversibly revokes all that Node's credentials, enumerates affected intents,
  persists withdrawal Operations and causes Runtime to publish removal snapshots.

Allowed policy changes create new deployment generation/fence and config digest;
Forward revision remains the user's intent revision. Literal destination IPs are
checked in Control. Agent checks every resolved address against the CIDR policy at
actual dial, including IPv4-mapped normalization and explicit metadata permission.
Denied intents get an audited failed withdrawal Operation; desired config is not
silently rewritten. A later authorized policy can explicitly deploy them again.

The owner can still delete a Forward after its Node is revoked. Safe resource
release depends on the existing retirement/per-session lease ledger, not merely
on credential rejection. Node status reports `pendingRevocation` and the latest
possible cutoff while unexpired historical leases remain. Revocation is not a
claim that an offline or cloned holder already stopped.

## Commands

Use the trusted TLS/account setup in [Phase 1](phase1.md):

```sh
npm run control:cli -- node-get scope-dev node-id
npm run control:cli -- node-policy scope-dev node-id 1 policy-v2.json stable-policy-key
npm run control:cli -- node-revoke scope-dev node-id stable-revocation-key
.artifacts/tunex-agent --rotate --control "$TUNEX_CONTROL_URL" --node "$NODE_ID" \
  --ca "$TUNEX_CA_CERT" --state /secure/agent/state \
  --journal-key /secure/agent/secrets/journal.key
npm run test:security
```

The Agent state directory remains OS-locked to one CLI process. Stop/restart using
the service supervisor when adding `--rotate` to a previously running command;
the online runtime does not recreate sockets before Hello and a new snapshot.
The same keypair reload code also supports an externally completed trusted
rotation, demonstrated with a held TCP stream in the security harness.

## Evidence and remaining scope

The real MySQL/HTTPS/Agent harness verifies concurrent rotation, conflicting CSR,
old-credential expiry, live TCP preservation, policy CAS/replay, denied-target
withdrawal, Agent CLI installation, revocation, owner cleanup and secret-free audit.
Redacted evidence records commit, dirty status, binary SHA and environment under
ignored `.artifacts/security/run-*/evidence.json`. Original Phase 1 and Phase 2
network suites remain regression gates. CI runs all three suites on Linux/MySQL.

Policy denial and revocation tests prove durable withdrawal and no new authority.
They do not substitute for a full offline lease-duration/clock-suspend rehearsal,
capacity measurement, PKI security audit or database rollback recovery. These,
Relay transport contracts, Web and release operations remain active project work.
