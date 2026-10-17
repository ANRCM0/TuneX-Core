# Probe v1 Read-only Machine Negotiation

Status: implementing, 2026-10-17.
Decision: [ADR-0008](../decisions/0008-probe-contract-negotiation.md).
This contract is a recognition handshake, NOT permission to execute a Probe.

## Endpoint And Strict Contract

`POST /agent/v3/probe/hello`, HTTPS with a verified machine client certificate.
Bearer tokens, headers alone, unregistered certificates and old session/boot
identities are insufficient. Existing maintenance mode applies.

The authoritative [schema](schemas/probe-negotiation-v1.schema.json) generates
the embedded Go schema/types. TS and Go accept at most 4096 UTF-8 bytes, reject
duplicate keys, unsafe integers, invalid Unicode, trailing data, unknown fields,
unsupported constants and invalid IDs. Thirty shared
[vectors](fixtures/probe-negotiation-v1.json) cover valid and rejected messages.
Check commands synchronize files; they do not execute those functional vectors.

The request is closed:

```json
{
  "protocolVersion": 3,
  "probeVersion": 1,
  "kind": "probe-hello",
  "nodeId": "node-a",
  "bootId": "boot-a",
  "sessionEpoch": 2,
  "instanceId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "capability": "probe.tcp-connect.v1",
  "point": "agent-direct-egress",
  "maxTimeoutMs": 2000,
  "maxAttempts": 1,
  "applicationPayloadBytes": 0
}
```

The repeated `a` instance is a parser example only. Actual Agent gates generate a
new 32-byte cryptographic random value, lower-case hex encoded. Do not configure,
reuse or restore the example value as a live identity.

The `X-TuneX-Session-Epoch` header must equal the body and current stored ADP/3
session. Node and boot must match the authenticated machine and current Hello.
The separate capability is not added to the existing ADP/3 capability enum.

Response echoes all contract/identity/budget fields, changes kind to
`probe-hello-ack` and adds only:

```json
{
  "serverTime": "2026-10-17T00:00:00.000Z",
  "state": "contract-only",
  "executionEnabled": false
}
```

Time uses UTC milliseconds. `executionEnabled:true`, a lease/permit/target field,
another version/capability or a changed budget is invalid. A valid structural
response must also match the exact Node, boot, session and instance of the
original request. The Agent additionally checks its authorization clock and
that its host session did not change while waiting.

The response is small, immutable in TS and `Cache-Control:no-store`. There is no
negotiated-state row, Probe task, grant, result or execution lease written.
The same read transaction rechecks Node/credential expiry/revocation, certificate
overlap retirement and existing `adp.3`, `native.direct.v1`, `tcp` facts.
The response says only that both sides recognize this contract. It neither
proves an applied Forward nor permits network work.

Failures: unauthenticated machine 401; unregistered/revoked/retired/expired
credential or Node 403; superseded Node/boot/session or unavailable Direct TCP
capability 409; unsupported shape/version/budget 422; duplicate JSON key 409;
oversized request 413. Infrastructure errors remain sanitized. Normal user
preflight remains the [non-executable Forward API](../spec/forward-probe-v1.md).

## Internal Gate And Runner Hook

`probe.NewGate` binds one fresh instance to Node/boot/session and the existing
executor. The trusted `Grant` port is not serialized by this protocol and has
no issuer in production. An independently authorized `Permit.Check` remains
mandatory; the handshake output cannot substitute for it.

The gate atomically burns a validated permit ID before the single invocation.
Retries of that ID are rejected even if the attempt failed, was busy, canceled
or denied by current target checks. At 256 consumed IDs the gate refuses new
IDs; it never evicts replay entries while retaining the same instance identity.
No cached permit resumes after construction of a fresh random instance.

Gate closure cancels active contexts and denies new work. Current Forward
execution and independent Probe checks still apply before/after dialing and
during its 25 ms monitor. Existing shared process/Node concurrency and cooldown
limits cannot be reset by constructing another gate.

`Runner.negotiateProbe` is an internal integration hook, not a live execution
receiver. The later default-off `--probe-registration` supervisor calls it before
using the separate [registration protocol](probe-instance-v1.md); ordinary
`Run`/`poll` does not negotiate when that option is off. It uses the existing
verifying HTTPS client, session header and a two-second context limit; parsing
enforces 4 KiB response size after the generic machine HTTP reader's existing
bounded read. Failure closes the unaccepted gate. Tests or registration of this
client hook are not proof of live remote dispatch.

## Acceptance And Next Slice

Actions explicitly runs shared TS/Go vectors, Control port tests, Go one-use/
concurrent replay/cancellation/capacity tests and client negative cases. A
separate real HTTPS/mTLS test fixture uses production middleware/composition,
valid CA-issued client/server certificates, an unregistered client, and a
SELECT-only MySQL account. It hashes all persisted tables around negotiation and
checks credential/session/capability withdrawal, unknown fields and payload size.
This hosted fixture is not independent physical-host evidence.

All functional cases remain authored/CI-wired pending matching-commit execution;
local type/format/vet/contract-sync/boundary checks are static only.

The subsequent [internal ownership slice](../decisions/0009-probe-instance-ownership.md)
adds a durable instance table with CAS/revocation/recovery quarantine. It is not
called by this endpoint: the handshake remains read-only and no current-instance
record is created by its acknowledgement.

The separate [registration/rotation contract and host lifecycle](probe-instance-v1.md)
are subsequently implemented under ADR-0010, default off and still non-executable.
The later [internal permit authority](../decisions/0011-probe-permit-authority.md)
adds current actor authorization, one-use consumption and shared issuance quotas,
without a wire permit or dispatch. The subsequent [claim contract](../decisions/0012-probe-claim-contract.md)
adds a non-executable consumed receipt and current host verification hook only.
Next: bounded delivery, continuous independent execution revocation and result
messages. Bind dispatch/result to the issued
permit/current topology. Do not reuse Snapshot or treat this acknowledgement as
an executable grant. Remote replay protection is not complete merely because
the internal gate is implemented.
