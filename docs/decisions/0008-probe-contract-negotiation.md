# ADR-0008: Independent Probe contract negotiation and one-use admission

Date: 2026-10-17. Status: Accepted for read-only negotiation and internal admission.
Predecessor: [ADR-0007](0007-bounded-agent-probe.md).

## Decision

The next additive slice introduces only a session-bound read-only handshake:
`POST /agent/v3/probe/hello`. Its separate Probe v1 schema recognizes the
`probe.tcp-connect.v1` contract at `agent-direct-egress`, with one attempt,
zero application bytes and a maximum 2000 ms timeout.

Reuse the HTTPS machine mTLS middleware, maintenance gate, current ADP/3 session
and boot identity. Recheck the actual certificate's credential row, Node
revocation/expiry, overlap retirement and existing Direct TCP capabilities within
one supplied read transaction. The response must echo the Agent's random instance
identifier and return `state:contract-only`, `executionEnabled:false`.

This protocol does NOT add fields or capability values to the existing ADP/3
Hello, Snapshot, Report or Journal. Unknown fields, versions, capabilities,
payload or retry changes are rejected in TS and Go against the shared schema.
Acknowledging the Probe parsing contract does not persist negotiated state, issue
a grant, allocate resources, renew execution, dispatch work or measure a target.

## One-use Agent Gate

Add an internal `probe.Gate` ahead of the existing independent-authority executor.
It generates a fresh cryptographically random 256-bit instance ID; callers cannot
select or restore that identity. A trusted internal `Grant` supplies a permit ID,
the exact instance ID, the previously defined independently authorized `Permit`
and timeout. These are not remotely accepted permit types or authentication proof.

Require exact Node/boot/session/instance binding and initial independent
authorization before admission. Atomically consume a permit ID before invoking
the executor. Never remove consumed IDs or permit retries after busy, denied,
failed or canceled attempts. Cap the lifetime set at 256 IDs, fail closed when
full, and require a fresh separately negotiated instance instead of clearing the
set under the old identity. This avoids time-based eviction accidentally enabling
replay after a wall-clock rollback.

Closing a gate denies new work and cancels contexts of in-flight measurements.
Executor admission remains held until its underlying network work and authority
monitor actually finish. Fresh gate construction cannot reset the executor's
shared Node cooldown or global concurrency budgets.

The Runner has an internal HTTPS negotiation hook, with a two-second context
deadline, strict acknowledgement/instance checks, current host session recheck
and authorization clock verification. It is not called by `Run`/`poll`; a
contract-only acknowledgement cannot provide an independent Permit authorizer.

## Deferred Authority And Lifecycle

The following are still absent: an execution-permit wire schema/signature or
authenticated online issuer, durable current-instance association, grant
revocation, actor/cluster quotas, dispatch/receive loops, results, Console and
automatic scheduling. No production path remotely invokes the executor.

At live integration, the host must own exactly the current negotiated gate,
close its predecessor before replacement and close it on session loss/shutdown.
Control must persist/verify the active instance before issuing a bounded
single-use permit, reauthorize the actor/Forward/Node and revalidate the full
binding. The in-memory gate is defense in depth, not a replacement for durable
issuer identity, authenticated transport, distributed replay protection or
current execution authorization. Reusing a boot/session after restart cannot
make old-instance permits eligible at a new random gate.

These remain trusted process-internal ports, not a sandbox against a malicious
module that creates arbitrary gates or supplies a fake authorizer.

## Evidence

Thirty shared parser vectors, TS contract/read-transaction regressions, Go
parser/echo/gate/concurrency/client regressions and real HTTPS/mTLS SELECT-only
MySQL/API cases are authored and wired into Actions. Tests prove their specific
scope only when run for the matching commit. Local checks are static; no
matching-commit functional acceptance or production release is claimed.

See [Probe negotiation v1](../protocol/probe-negotiation-v1.md).

Follow-up: [ADR-0009](0009-probe-instance-ownership.md) adds internal durable
instance ownership/revocation/recovery quarantine. It does not change this
read-only endpoint or complete remote registration, permits or gate lifecycle.

Later follow-up: [ADR-0010](0010-probe-registration-lifecycle.md) implements the
separate remote registry and opt-in Runner gate lifecycle. It calls this hook
only with `--probe-registration` and preserves the read-only handshake. The
deferred lists above describe this ADR's original slice, not the later registry;
executable permits, dispatch and results remain absent.
