# Forward Probe Capability Query v1

Status: implemented source, unverified. This document describes the additive L3 owner query recorded in FR-0031. Main-owner HTTP and console source integration is present; its acceptance remains unexecuted.

## Public Owner Query

`ForwardProbeCapabilitiesApi.get(actor, scope, forward)` returns one bounded matrix for the current Forward revision. Export `ForwardProbeCapabilities` and `FORWARD_PROBE_CAPABILITY_API_INTERFACE_VERSION = 1` through `modules/probe-owner/public.ts`. The integrated Probe module interface version is 3; existing command and permit contracts retain their versions and semantics.

The integrated HTTP mapping is `GET /api/v1/scopes/:scope/forwards/:id/probe-capabilities`, without request body or query parameters. The route authenticates the actor as usual and calls the owner query. It must not issue a Probe request, create an Operation or contact an Agent. The query performs at most two original planner calls and returns exactly five measurement entries. Its owner admits at most four concurrent reads, holding each slot through initial storage and both planner calls. Overflow returns retryable `PROBE_CAPABILITY_BUSY` with HTTP 429 before storage; success and failure release the slot without queueing or automatic retry. This is an owner-local limit, not a fleet-wide rate limit.

The original ScopeAuthorization runs with the original Probe management requirement. ResourceReadAccess.owned checks the Forward before its intent is read or its transport is explained. A permission rejection fails the request. A successful query is a temporary read projection, never a permission token or assurance that a later command can issue a permit.

## Support Matrix

| Measurement | Observation point | Generic Direct preflight | Original command |
| --- | --- | --- | --- |
| tcp-connect-v1 | Agent Direct egress to configured target | Calls original planner | Available subject to original enabled switch and permit authorization |
| tcp-ingress-connect-v1 | Agent-local Direct ingress listener | Calls original planner | Available subject to original ingress switch and permit authorization |
| tcp-ingress-tls-v1 | Agent-local Direct ingress using controlled service | Exact registered service reference required; not checked by this generic query | Subject to original controlled-service switch and original service authorization |
| tcp-ingress-echo-v1 | Agent-local Direct ingress using controlled echo service | Exact registered service reference required; not checked here | Not dispatchable by current ForwardProbes command |
| udp-ingress-echo-v1 | Agent-local Direct ingress using controlled echo service | Exact registered service reference required; not checked here | Not dispatchable by current ForwardProbes command |

All five measurements reject Relay, multihop and configured transport profiles in this command family. The query does not substitute Agent-local connect, peer TCP connect or TLS handshake for an active business-path test across those transports. An explicitly configured path, including an empty path, preserves the original planner refusal. The displayed mode can still be `direct` when a configured transport profile prevents original Direct Probe support.

`transportSupport` describes the original transport restriction. The entry also contains protocol availability in its preflight reason. An unsupported protocol is not an assertion that the whole transport is unsupported.

`issuance` is independent from preflight: `enabled` means only that the original command switch is enabled; `disabled` reports its original off switch; `not-dispatchable` identifies echo kinds absent from the original command parser. Neither an enabled switch nor an available plan implies remaining permit budget, a running Agent consumer or eventual execution.

## Response Semantics

The response contains `capabilityVersion:1`, authenticated identifiers, current Forward revision, `mode`, and five measurement entries. Each entry preserves the original measurement/task-kind/capability/point classification and adds:

- `protocol`: TCP or UDP business protocol.
- `transportSupport`: supported or unsupported by this Probe command family.
- `issuance` and `issuanceReason`: original switch or command-parser limitation.
- `preflight.state`: available, unavailable, unsupported or requires-controlled-service.
- `preflight.reason`: a stable code and human-readable explanation.
- `preflight.expiresAt`: only the original accepted basic plan expiry; null when no plan was accepted.
- `endToEnd:false` and `health:unknown`.

The top-level flags are `readOnly:true`, `networkCheck:not-performed`, `executionAuthorized:false`, `endToEnd:false` and `health:unknown`. The query returns no permit ID, claim, execution budget or Agent request. It omits native binding identifiers and network endpoints from the accepted basic plans.

A successful `tcp-connect` preflight describes Agent-to-target connect capability. It bypasses the Forward ingress. A successful `tcp-ingress-connect` preflight describes a connection from the Agent to its local Direct listener. It cannot establish client reachability from outside the host. TLS and echo have exact controlled-service requirements; this generic query supplies no service context. None of these labels asserts end-to-end business health.

Reads use `read-committed-not-global-snapshot`: initial intent classification and the two original planner calls can observe different committed moments. Each planner call uses the initially observed revision and repeats original authorization. `REVISION_CONFLICT` becomes unavailable preflight; the caller can refresh the query. No stale result exempts the later command from its original checks.

## Error Boundaries

Scope and ownership failures always propagate before intent disclosure. The original planner rechecks its original target, Node grant, current Snapshot, credential, capability and policy requirements for the basic kinds. `AUTHORIZATION_DENIED`, resource invisibility, integrity failures and unknown/internal failures propagate; they do not become an unsupported badge.

Only `PROBE_UNAVAILABLE` and `REVISION_CONFLICT` with status 409, and `UNSUPPORTED_CAPABILITY` with status 409 or 422, become per-measurement reasons. Invalid identities fail with the existing INVALID_CONFIG response. Invalid or mismatched stored Forward identity fails with INTEGRITY_FAILURE. A query implementation defect must not silently downgrade to unavailable.

## Passive Diagnostics

The query returns `/api/v1/scopes/:scope/forwards/:id/diagnostics` for the same authorized Forward. The existing diagnostic owner independently authenticates that read. It explains persisted operations, per-node binding observations, adjacent segments, target configuration and historical Probe results. It remains passive, uses persisted Control/Agent state and reports health unknown. It does not independently verify listeners, remote reachability, every hop or live application traffic.

Relay/multihop users can open that diagnostic view and inspect the exact persisted evidence and unknowns. They are not directed to an unauthorized synthetic end-to-end probe.

## Constructor Integration

Construct the query from the same original read and Probe owners; no new store is needed:

```ts
import { ForwardProbeCapabilities } from './modules/probe-owner/public.ts';

const probeCapabilities = new ForwardProbeCapabilities(
    db,
    identity,
    resourceReadAccess,
    probeIntents,
    forwardProbePlans,
    forwardProbes,
);
```

`forwardProbePlans` is the current original ForwardProbePlanApi instance, including its latest resource-ownership authorization. `forwardProbes` structurally supplies only readonly `enabled`, `ingressEnabled` and `servicesEnabled` values. The query never receives its create/issue/inspect/revoke methods in its declared port. These flags must reflect the same original command instance registered by HTTP.

Main integrates the owner through the existing Control composition and registers the GET route serially. Every Forward row exposes a separate support action through `initProbeConsole.openCapabilities`; the original Direct TCP command entry remains separate. The isolated query slice changed no shared composition or routes itself; main supplied that wiring. SQL, framework, Agent authority, Journal, Snapshot, lease and telemetry behavior remain under their original owners.

## Planned Acceptance

Source cases are authored in `apps/control/test/forward-probe-capabilities-contract.test.ts` for authorization order, invalid identities, complete bounded matrix, exact measurement positions, no endpoint/binding disclosure, Relay/multihop/profile refusal without planner substitution, disabled issuance, exact service requirements, non-dispatchable echo, inactive Forward, protocol mismatch, planner business refusal and propagation of changed permissions/integrity/internal errors.

No test, type/static/boundary check, formatter, generator, build, network experiment, browser run, CI, commit or push has been executed for this slice. Exact-source Actions contract acceptance and HTTP/console acceptance remain planned. Source completion does not claim execution readiness or release acceptance.
