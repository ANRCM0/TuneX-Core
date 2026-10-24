# Relay Control Coordination

Baseline: `56895c3`. Control now accepts a two-Node Relay Forward through the same
Forward API and transaction as direct intent. A path must contain exactly one egress
Node and lock an immutable `native.relay.v1`/mutual-TLS Profile revision. Both Nodes
must have current machine/peer credentials, online ADP/3 sessions, exact Relay/wire
capabilities and explicit use grants; the execution actor also needs Profile use.

`relay_deployments` is Runtime-owned state introduced by migration
`0009-relay-deployments.sql`. It records generation, target revision, both Node IDs,
an immutable checked plan and durable stage. Client ingress reserves actual TCP/UDP
slots; each egress protocol reserves a distinct internal TLS TCP slot. All use the
existing physical `node/protocol/port` allocator/fence and assignment capacity. The
Forward, slots, deployment, Operation and replay response commit together. Shared
Node direct/Relay sets are capacity-checked before acceptance and every publication.

Stages persist as `preparing -> egress_active -> ingress_active -> active`. Both
current prepared reports are required before activating egress; only a current,
fresh, published active/ready egress report permits ingress activation. Report checks
cover accepted full Snapshot generation, assignment generation/fence/config digest,
phase and current Node session. Agent independently authenticates and probes the
actual downstream before opening ingress. Prepared status cannot be interpreted as
ready. The final Operation succeeds only when both protocols/roles are active/ready
and all necessary old retirements are safe.

The scheduled Worker and per-Node reconcile rediscover stages from MySQL. Node locks
are acquired in deterministic order for connected Relay peers. The stage scanner
uses a bounded rotating batch; publication still uses the shared independent
authority recorder. Whole-Node leases are bounded by both Nodes' machine and peer
effective validity, not just one Node or certificate NotAfter. A new boot causes a
fresh internal deployment/Operation with higher fences and current sessions, without
rewriting user revision or clearing historical Agent/Control high-water.

Port updates and re-enable use a new immutable plan. Disable retains desired resource
ownership after drain; delete releases both Nodes' resources only after publication,
retirement and all historical per-session authorization are safe. Old observations
cannot release a new owner or complete a new deployment. Execution deadline/permanent
failures remove authority and retain cleanup work; retry remains a new Operation.
Endpoint changes while referenced by live Relay remain explicitly unsupported until
their compensation workflow is implemented. Automatic peer-key rotation now
creates new immutable plans and policy Operations without changing user revision;
current pins and effective authority are covered by [Relay rotation](relay-rotation.md).

Node policy/revocation, membership and Node grant workflows now enumerate ingress
and downstream references. Profile use changes invoke Runtime withdrawal/redeployment
inside the same grant/audit/replay transaction. Withdrawal stops new assignments and
persists a cleanup Operation; restoration recompiles both roles with fresh fences.
Old-backup recovery marks deployments withdrawn in addition to invalidating Operations,
Forward execution, grants, peer credentials and observations.

Forward status aggregates both Node reports and exposes `nodeId` on each applied
observation. Ready requires both Nodes' applicable protocol/role observations and
fresh leases; an old succeeded Operation stays terminal while current health changes.
The user remains responsible for permitted target reachability; ready is not a promise
that every future customer target dial will succeed.

## Real Acceptance

`npm run test:relay` launches two independent native Linux Agents plus separate
client/target fixture processes against real MySQL/HTTPS Control. It covers secure
identity setup, allocation/replay/conflict and complete rollback, held active report
keeping actual ingress closed, exact TCP/UDP payload, machine-only leaf/TLS 1.2
refusal with a valid current Open, renewal, Control/scheduled Worker restart, port
update/disable/enable, Profile and egress-Node grant withdrawal/restoration, Agent
session restart, downstream health loss and offline downstream safe deletion.

The local suite passed 14 checks on October 13, 2026. Shared gates also passed 165
TypeScript tests, Go tests/build/vet/Linux race, 13 Transport checks, 14 direct access
checks and 9 same-protocol backup recovery checks. The recovery regression establishes
that adding the deployment table does not break the existing recovery workflow; it
does not yet demonstrate restored customer Relay traffic.

The initial activation test deliberately holds a real egress ready report to inspect
the safety boundary. It does not fabricate ready or synchronization facts. Fixture
negative probes use the current immutable binding, so their rejection is not attributed
to malformed requests. Evidence records commit/dirty state, Agent SHA, kernel, policy
and topology in ignored `.artifacts/relay/run-*/evidence.json`. CI has this native
Linux gate configured; no remote CI result is claimed.

Local topology remains Windows locked Node/MySQL Control with two Linux Agents on the
same WSL host. This is real multiprocess encrypted traffic, not two physical hosts or
namespace partition testing. Full Phase 3 remains implementing pending the complete
acceptance matrix, sustained load and network isolation, target/path switch with held
streams, partial activation/deadline recovery, safe endpoint/key evolution and release
security review. Product Web, deployment/SBOM/license and release gates remain open.

Later same-host evidence now covers held target/path streams, same-client UDP reset,
partial ingress bind and injected deadline/retry; see
[Relay switch and faults](../testing/relay-switch-faults.md). Other residual gates remain open.
