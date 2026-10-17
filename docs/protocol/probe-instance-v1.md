# Probe v1 Non-executable Instance Registration

Status: implementing, 2026-10-17.
Decision: [ADR-0010](../decisions/0010-probe-registration-lifecycle.md).
Persistent ownership: [ADR-0009](../decisions/0009-probe-instance-ownership.md).

## Machine Contract

`POST /agent/v3/probe/instance` uses the existing verified mTLS machine middleware,
maintenance guard and `X-TuneX-Session-Epoch`. Body Node/session must agree with
the authenticated machine and header; the owner rechecks current boot/session,
actual certificate validity, retirement and capability facts in its transaction.
Certificate fingerprints are obtained from TLS, never from the request.

The authoritative [schema](schemas/probe-instance-v1.schema.json) generates Go
types and an embedded schema. TS/Go strictly reject unknown fields, duplicate
keys, invalid Unicode/IDs, unsafe integers, trailing data, unsupported versions
and messages over 4096 UTF-8 bytes. Thirty-seven shared
[vectors](fixtures/probe-instance-v1.json) cover accepted and rejected shapes.
Contract-sync commands compare generated files; they do not run parser tests.

All request fields are mandatory:

```json
{
  "protocolVersion": 3,
  "probeVersion": 1,
  "kind": "probe-instance",
  "action": "register",
  "nodeId": "node-a",
  "bootId": "boot-a",
  "sessionEpoch": 2,
  "instanceId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "expectedGeneration": 0
}
```

The example instance is not a usable live identity. An Agent gate generates a
fresh random 256-bit, lower-case hex instance; it must not restore or configure
the example. The action is exactly one of:

| Action | Preconditions and effect |
| --- | --- |
| `inspect` | `expectedGeneration:0`; SELECT-only view, candidate instance echoed but not stored |
| `register` | Current Direct TCP machine eligibility; current-generation CAS, first registration advances 0 to 1 |
| `revoke` | Exact current instance/generation and valid current machine identity; capability withdrawal does not block closing |

There is at most one durable slot per Node across Control processes. Different
instances cannot win the same CAS. An exact original register retry returns the
same record without incrementing or renewing, after current reauthorization.
Expired, revoked or quarantined identities cannot be revived by retry. Generation
exhaustion blocks replacement but not revocation. Every failed transaction rolls
back its owner writes, including a first-slot seed.

## Response And Binding

The response echoes every request field except `kind:probe-instance-ack`, adds
only the following fields and always sets `Cache-Control:no-store`:

```json
{
  "generation": 1,
  "state": "registered",
  "currentInstanceId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "registeredAt": "2026-10-17T00:00:00.000Z",
  "expiresAt": "2026-10-17T00:00:30.000Z",
  "serverTime": "2026-10-17T00:00:00.000Z",
  "executionEnabled": false
}
```

This fragment supplements the echoed fields; it is not a complete response.
UTC timestamps use exactly milliseconds. Request `instanceId` always identifies
the candidate/requested gate; `currentInstanceId` identifies the durable slot and
may differ on inspection. Never use the echo as proof of current ownership.

- `absent` requires generation zero and null current instance/registration/expiry.
- Other states have positive generation and non-null current identity/times,
  with a positive registration interval of at most 30 seconds.
- `register` acknowledgements require `registered`, current instance equal to
  the request and generation equal to original expected generation plus one.
- `revoke` acknowledgements require `revoked` or `quarantined`, exact instance
  and unchanged requested generation. Revocation is sticky/idempotent.
- `inspect` can return `registered`, `stale`, `revoked` or `quarantined` in
  addition to `absent`. Old boot/session/certificate, capability loss or expiry
  makes a previously registered record stale; historical timestamps are not
  renewed by the response's fresh `serverTime`.

Both clients validate full request/response echoes even for already typed
objects. The Agent additionally verifies its authorization clock, current host
identity, certificate and guard before installing a gate, and uses an earlier
monotonic local deadline. A registered response grants no target, time budget
for network work or right to reuse an old one-use permit cache.

Failures: missing machine authentication 401; revoked/expired/unregistered
credentials or Node 403; stale boot/session, capability/CAS conflict or invalid
current ownership 409; unsupported contract shape 422; duplicate JSON 409;
oversized body 413. Existing infrastructure-error sanitization and maintenance
behavior apply. Responses contain no certificate fingerprint or secrets.

## Agent Opt-in And Failure Semantics

Start a normally configured Agent with `--probe-registration` to maintain this
experimental registration. Default is off; no deployment manifest enables it
implicitly. It cannot be combined with the read-only `--inspect-journal` mode.
It creates no listener and receives no executable work. Normal ADP/3 Hello and
authorization-clock initialization still happen first.

The supervisor closes the previous local gate, performs read-only Probe Hello,
inspects current generation, then registers a new instance. Each request has a
two-second timeout and a 4 KiB response limit. Before accepting, it subtracts
configured clock uncertainty from server freshness and anchors that remaining
interval before its own register request. It rotates two seconds before the
earlier local deadline, without resetting shared executor budgets.

Context/host identity/credential/guard loss, cutoff or process shutdown closes
local admission and cancels active contexts. A failed optional registration
backs off up to 30 seconds; authentication/session rejection ends this
supervisor. Neither response loss nor an unsupported server enables execution.
After an unaccepted response, a new random instance inspects current CAS again.

Normal shutdown attempts remote revocation for at most two seconds after local
closure. Remote cleanup is best effort: a detached/replaced identity, network
failure or rejected acknowledgement can leave a server record until freshness
expiry/replacement. Remote record revocation is not an immediate push to the
Agent. No remote execution channel exists yet, and the handshake endpoint stays
strictly read-only. SQL restore still quarantines records under the existing
recovery transaction; generation is not independent rollback-proof authority.

## Acceptance And Next Slice

Actions runs the shared parsers, adapter and Go lifecycle tests, including
unsafe/oversized/late acknowledgements, replacement, monotonic expiry,
identity/context loss, rejected-ack recovery and shutdown. Real mTLS/MySQL cases
use the production API with a restricted DB user: SELECT on other tables and
INSERT/UPDATE only on `probe_instances`. They verify CAS races, no other writes,
actual certificate/session withdrawal and sticky revocation. Existing read-only
negotiation uses its separate SELECT-only account.

The real Linux Agent recovery script enables the option, observes its durable
registration while Direct TCP/UDP runs, then verifies restored quarantine.
These are authored/CI-wired; no local functional or matching-SHA Actions pass
is claimed. Hosted tests do not replace physical-host acceptance.

The subsequent [internal permit authority](../decisions/0011-probe-permit-authority.md)
adds transaction-bound actor/Forward/Node/topology reauthorization, one-use
consumption and shared issuance reservations. Its views are not wire permits.
The later [claim contract](../decisions/0012-probe-claim-contract.md) adds a closed
mTLS consume endpoint and current Agent host verification hook, not an execution
grant or a production caller. Next: bounded delivery, continuous independent
execution revocation, executable admission and results.
Do not reuse Snapshot, treat registration as a permit, or infer complete
distributed replay protection from these internal records.
