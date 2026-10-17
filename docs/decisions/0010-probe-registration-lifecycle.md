# ADR-0010: Remote non-executable Probe registration and host lifecycle

Date: 2026-10-17. Status: Accepted for registration only.
Predecessors: [ADR-0008](0008-probe-contract-negotiation.md),
[ADR-0009](0009-probe-instance-ownership.md).

## Decision

Expose the existing transaction-bound instance owner through a separate closed
machine contract at `POST /agent/v3/probe/instance`. Its three actions are
`inspect`, `register` and `revoke`; every acknowledgement requires
`executionEnabled:false`. The existing `/agent/v3/probe/hello` remains read-only.
Neither contract accepts a target, permit, arbitrary command or executable work.
The [instance protocol](../protocol/probe-instance-v1.md) specifies the wire rules.

The adapter supplies the verified mTLS Node and actual peer certificate
fingerprint, checks the session header/body agreement, and delegates to
`ProbeInstances`. The owner still reauthorizes machine evidence and changes only
its own table in the same transaction. A request cannot substitute a claimed
fingerprint, bypass maintenance or use a Bearer token as machine authentication.
Inspection is not a reservation; replacement uses the observed generation CAS.
An exact original registration retry does not renew freshness.

## Opt-in Agent Lifecycle

Add default-off `--probe-registration`. Only after normal ADP/3 Hello and
authorization-clock initialization does a separate supervisor maintain a current
gate. It does not enter the Forward reconciliation or execution driver path.
An unsupported endpoint keeps this optional feature pending, not a fallback to
Snapshot commands or permission to probe. Authentication/session rejection ends
the supervisor. Ordinary forwarding retains its existing authority checks.

- Serialize remote rotations. Detach and synchronously close the predecessor
  before negotiating or registering a fresh cryptographic random gate. Join its
  monitor outside the Runner lock; never hold that lock across network I/O.
- Inspect current durable generation, then register with CAS. Accept only exact
  Node/boot/session/action/instance/generation echoes, strict 4 KiB messages,
  valid authorization time and a still-current host identity/guard/certificate.
  Cancellation, stop or a late response cannot reinstall a closed identity.
- Derive a conservative monotonic local deadline from server expiry minus
  server response time and configured clock skew, anchored before the register
  request. Reject two seconds or less of remaining freshness. Registration is
  at most 30 seconds and is rotated before this earlier local cutoff.
- Close the gate on context cancellation, identity/guard loss, credential
  replacement, deadline or shutdown. The 25 ms monitor is cooperative, not a
  real-time guarantee. It does not extend any execution permit or ticket.
- Normal supervisor shutdown closes locally before attempting a bounded remote
  revoke. Network failure, lost acknowledgements or a previously detached slot
  may leave a durable record until its freshness expires or a new CAS replaces
  it. No local gate survives because remote cleanup failed.
- A rejected/lost registration acknowledgement never creates an accepted gate.
  A subsequent attempt creates a new identity and inspects current ownership,
  rather than assuming the earlier write failed or reusing a replay cache.

Closing a gate cancels its active contexts; existing executor admission remains
held until actual network/monitor work finishes. Rotation cannot reset shared
process/Node budgets. The registry and host lifecycle do not mutate Forward
intent, Snapshot, Journal, leases, reservations or protected authorization state.
No Core or existing ADP/3 schema/capability change, new migration or Journal
format is introduced. Control still needs migration 0014 and the compatibility
profile from ADR-0009; the Agent flag remains off in default deployments.

## Explicit Non-goals

Registration is not a Probe permit, actor authorization or proof of applied
topology. There is still no live permit issuer, durable permit claim, remote
execution receiver, result ingestion or actor/cluster issuance quota. No
production path invokes the connect executor from these endpoints.

Remote SQL revocation alone does not immediately notify an Agent or cancel its
gate; the protocol is not a push revocation channel. Future issuance/consumption
must recheck current slot and actor/Forward/Node authority with complete binding,
define in-flight withdrawal and intersect all deadlines. SQL generation is not
rollback-proof; recovery still quarantines restored instances and revokes old
credentials through the existing recovery owner. Neither a registered row nor
the one-use in-memory gate completes distributed replay protection.

## Evidence

Thirty-seven shared TS/Go vectors, five TS contract/adapter test groups, nine Go
parser/lifecycle groups and two additional real HTTPS/mTLS/MySQL groups are
authored and explicitly wired into Actions. The actual Linux Agent backup and
recovery acceptance now enables the flag, waits for its persisted registration,
checks Direct TCP/UDP and verifies restored quarantine. This is hosted CI, not
physical-host acceptance. Local checks remain static and no matching-commit
functional pass is claimed.

## Subsequent Internal Authority

[ADR-0011](0011-probe-permit-authority.md) subsequently implements internal
Control issuance, durable consumption and shared issuance reservations, with
migration 0015 and its own compatibility/recovery review. The non-goals above
describe this registration slice. No remote permit/claim protocol, executable
Agent receiver, continuous execution revocation or dispatch/result loop is
delivered by either slice. Registration acknowledgements remain non-executable.

The following [ADR-0012](0012-probe-claim-contract.md) separately exposes an
authenticated consume endpoint and a non-executable host receipt hook. It still
does not deliver remote issuance/discovery, continuous independent execution
authority, a production Agent caller or dispatch/results.
