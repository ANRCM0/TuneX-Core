# FR-0031: Forward Probe Capability Query

Date: 2026-10-21.
Status: implemented-unverified.
Owner and authorization: original L3 Probe owner; the human authorized named N product source work on 2026-10-21, and the coordinating owner approved this isolated N4 query slice. Source and necessary contract cases only; no executed verification or publication.

## Task Proposal

1. Layers: L3 Probe owner and its documentation only.
2. Consumed public interfaces: framework ScopeAuthorization, ResourceReadAccess and TransactionBoundary; original ProbeIntents and ForwardProbePlanApi; existing passive diagnostics URL contract.
3. Foundation impact: none. No framework, database, native execution wire, Agent authority or Journal changes.
4. Contract: additive ForwardProbeCapabilitiesApi v1, get(actor, scope, forward). Return a bounded five-measurement matrix, transport support, command issuance state, read-only preflight state, human-readable reason, actual observation point, endToEnd:false and passive diagnostic links. Probe module export version advances from integrated v2 to v3; existing command contracts remain unchanged.
5. Acceptance: author contract cases for ownership, Direct preflight, Relay/multihop refusal, disabled issuance, controlled-service requirements, echo command limitations and integrity/error propagation. No test or check is executed in this source phase. Exact-source Actions acceptance remains planned.
6. Parallel impact: isolated product-node-ownership tree; no Node/N3, framework, composition root or shared development-document edits. Main owner serially integrates public exports, HTTP route and constructor wiring.

## Why Existing Interfaces Are Insufficient

The original planner rejects unsupported transports correctly but exposes no authenticated support matrix. A local connect result must not be presented as end-to-end business health. A read query can explain original limits without adding a permit, operation, execution authority or network probe.

## Impact And Compatibility

Ownership and scope authorization run before intent classification. Direct basic preflights call the original planner; this query never replaces its authorizer. Controlled service probes require an exact service declaration submitted to the original planner/command, so the generic query reports that requirement rather than fabricating successful preflight. Echo planning exists but the original ForwardProbes command does not dispatch echo kinds. Relay and multihop report unsupported active execution and point to existing passive diagnostics.

Only known non-authorization business refusals become matrix reasons. Authorization changes, resource invisibility, integrity failures and unknown/internal errors propagate. Issuance-disabled, unsupported transport and authorization denial remain separate outcomes. Query success authorizes no subsequent action; original commands recheck their original policy and permit budget.

## Migration And Version Plan

Export the standalone v1 query API from probe-owner/public.ts; the integrated module version becomes 3. Main integrates against the current module v2 exports, preserving all current changes. The route is proposed as GET /api/v1/scopes/:scope/forwards/:id/probe-capabilities with no query/body parameters. This work does not register the route or modify existing create/plan semantics. Existing command/permit clients require no migration.

## Acceptance And Known Limits

The response is a read-committed projection, not an atomic cross-request snapshot or permission token. A successful basic plan is only current read-only preflight; it does not guarantee permit availability or Agent execution. Disabled commands can still have successful preflight. All observations remain health unknown and endToEnd false. Passive diagnostics are persisted evidence and do not independently establish listening sockets or traffic reachability. HTTP/UI integration, current-source contract execution, browser acceptance and physical-host evidence remain unverified.

## Main Source Integration

The original Control composition now creates this query over the same Identity,
ResourceAccess, MySqlProbeReader and ForwardProbePlans providers. The existing HTTP
adapter serves the proposed GET route, rejects query parameters and passes the
authenticated actor. All Forward rows expose an independent readonly support
action through initProbeConsole.openCapabilities. Existing open still selects
only the original Direct TCP command path. The matrix distinguishes actual command
switches, read-only preflight and the absence of a new network observation, erases
old results on errors and rejects late Forward/Scope responses. See the native
integration record N4-probe-capability-console-2026-10-21.md. Both backend and
browser cases are authored only; no source revision or runtime behavior is accepted.

The integrated owner bounds concurrent get calls to four, including the initial
transaction and both original planner calls. Overflow returns retryable
PROBE_CAPABILITY_BUSY/429 before storage. A finally block releases capacity after
completion or failure; there is no queue, timer, retry or new execution authority.
The public get signature and candidate v1 remain unchanged. Concurrency and exact
error/capacity recovery cases are authored but unexecuted under the same N source
authorization; this private admission is not a fleet-wide rate limit.

During N verification preparation the HTTP structural aggregate was corrected to
require `probeCapabilities: ForwardProbeCapabilitiesApi`. The original production
composition and route already used this provider; its absence in `ControlApi` was
an integration defect. Complete independent HTTP substitutes now supply it and
retain the original receiver, refusal mapping and request cleanup assertions.
This is covered by the N candidate's Control HTTP version2, not a change to the
standalone query version1 or a new execution permission.
