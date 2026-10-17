# Forward Probe v1 Foundation

Status: implementing, 2026-10-17. This describes the Control preflight and internal
Agent executor. The later default-off operational chain is specified separately
in [Probe management v1](forward-probe-management-v1.md); its matching-SHA Actions
acceptance is still pending. The
[read-only machine handshake](../protocol/probe-negotiation-v1.md) and subsequent
[non-executable registration](../protocol/probe-instance-v1.md) are separate.
Decision: [ADR-0007](../decisions/0007-bounded-agent-probe.md).

## 1. Non-executable Control Preflight

`POST /api/v1/scopes/:scope/forwards/:id/probe-plan`

Bearer authentication, no cookies, maintenance guard, `Cache-Control:no-store`.
The body is at most 1024 UTF-8 bytes, with only:

```json
{"version":1,"kind":"tcp-connect","expectedRevision":1,"timeoutMs":1000}
```

`timeoutMs` is optional, integer 100..2000, default 1000. No coercion or unknown
fields. This describes future network work, not a MySQL query timeout.

Within the same transaction, require an active Scope manager, the scoped Forward
and an explicit Node Grant even for the Owner. Reuse Node credential/revocation,
capability, listener and target policy authorization. Only enabled, non-deleting,
non-recovery-suspended Direct intents containing TCP with IP-literal targets are
eligible. Probe always disallows metadata regardless of Forward opt-in.

The read projection accepts at most a 1 MiB persisted Snapshot, validates its
schema and digest and compares its Node, session, generation and validity against
the database row. The current boot/session and a unique active Direct TCP
Assignment must match the Forward revision, listener, target and current egress
revision. A published Assignment is not proof that the Agent applied it.

Output is an immutable, small plan with:

- `version:1`, `kind:tcp-connect`, `executable:false`,
  `dispatch:not-implemented`, `independentProbe:false`, `health:unknown`.
- `point:agent-direct-egress`, Scope and binding:
  Node, boot, session, Snapshot generation, Assignment, Forward/revision,
  deployment generation, binding Fence, config digest and egress revision.
- Timeout, `maxAttempts:1`, `applicationPayloadBytes:0`, planned/expiry timestamps.
  Expiry is at most two seconds, clipped by Node credential and Snapshot hard
  cutoff minus existing clock skew.

No target address, credentials, full Snapshot, permit or issuer token is exposed.
No Operation, lease, resource, observation row, authority high-water or Snapshot
is created/renewed. It sends no network traffic to the Forward target.

Failures retain existing API semantics: invalid input 422, unauthenticated 401,
missing/invisible resource or Node Grant 404, manager/policy denial 403,
revision conflict or unavailable current binding 409, body too large 413.
Unsupported Direct/TCP/IP-literal scope is 422. Existing parser integrity errors
remain 409; infrastructure failures are sanitized. There is no idempotency claim
because this endpoint only computes a non-executable preview.

## 2. Internal Agent Executor

`internal/probe` owns `Binding`, `Permit`, `Target`, `Resolver` and `Result`.
These Go types are not JSON wire contracts. `Permit.Check` must represent
independent current Probe authorization, with at most two seconds remaining.
These internal types do not themselves provide a remote issuer or execution entrypoint. An additive
contract-only machine handshake and one-use internal gate are defined separately
in [ADR-0008](../decisions/0008-probe-contract-negotiation.md); acknowledgement
cannot supply this independent Permit.

The native host adapter resolves only a unique currently running active Direct
TCP Assignment, with both Runner and per-instance execution tickets alive.
It compares the complete binding and recomputes the config digest. Facts/CIDRs
are detached. Its check callback re-reads current host state on every invocation.
Drain, replacement, session/Snapshot change, removed instance, Fence/config/
egress change, ticket expiry or uncertain authorization clock fails closed.

Numeric IP and port come only from those host facts. The pure egress helper is
shared with existing Forward engines, with additional stricter Probe restrictions.
IPv4-mapped addresses are unmapped before filtering and dialing; no DNS lookup,
zone, proxy or payload exchange is supported. One bounded connection is closed
even on error or post-connect revocation. There is no retry.

Budgets are process-wide across executor construction: four active, one per
Node, one second of cooldown after completion, maximum 128 tracked Nodes.
Invalid/denied target work cannot dial. Cancellation and authorization failure
return no successful measurement; the monitor and dial must terminate before
admission is released. A 25 ms authorization monitor is cooperative cancellation,
not an OS scheduling or real-time guarantee.

Successful measurements return binding, observation point, measurement/expiry
time, total invocation elapsed duration and `independentProbe:true`:

| status / code | Meaning |
| --- | --- |
| connected / tcp-connected | Numeric TCP connection established at Agent Direct egress |
| unreachable / tcp-connect-failed | One connection attempt failed; original network error is not exposed |

`ApplicationHealth` always remains `unknown`. Elapsed includes local resolution/
checks and is not pure RTT. Expiry is clipped by the Probe permit, execution
ticket and a five-second freshness cap. Timeout/cancellation/revocation is an
error, never healthy/unreachable evidence. The later management flow submits
strict reported receipts to Control; they must not drive switches or alter Applied/Healthy state.

## 3. Operational Follow-up And Evidence

The separate [management contract](forward-probe-management-v1.md) and
[ADR-0018](../decisions/0018-probe-production-workflow.md) now connect explicit
idempotent issuance, bounded machine discovery/claim, the original live watch,
one-use host execution and reported result submission. Control and Agent opt-ins
are independent and default off. Neither a preflight plan, registration response,
claim receipt nor status message alone becomes executable authority.

The original foundation, negotiation, instance, permit, claim, delivery, watch,
result and admission slices remain documented in ADR-0007 through ADR-0017. Their
historical absence-of-production-caller statements describe those slices, not
the combined implementation after ADR-0018. No machine schema or Core/Journal
format is changed by that operational wiring. All original full-binding,
permission, egress, clock, single-use, freshness and resource constraints remain.

Actions coverage retains `forward-probe-plan-ports.test.ts`, SELECT-only
`forward-probe-mysql-acceptance.test.ts`, all Probe TS/Go contracts, owner/adapter/
MySQL regression suites, Go `internal/probe`, `internal/egress` and Control
`TestProbe*`, plus full Go race and existing Direct/Relay/multihop gates. The new
manager/API/workflow groups and dedicated `probe-workflow` job add the actual
built Agent + Control + MySQL + mTLS + zero-payload TCP-target path, with source
identity and explicit same-host provenance. Uploads include only redacted
`evidence.json`, never PKI, bearer credentials or protected Agent state.

This is authored/Actions-wired evidence, not matching-SHA acceptance or local
functional execution. Best-effort discovery can expire without a result. The
combined script records each bounded distinct-command attempt rather than retrying
a spent permit or treating an unreported connection as a successful observation.
Console controls, durable monitoring history, metrics, health aggregation,
DNS/UDP/Relay probes, automatic switching, physical multi-host and production
release gates remain separate work. Existing passive observations remain distinct.
