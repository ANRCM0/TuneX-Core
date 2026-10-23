# FR-0030: Shared Node Port Limits

Date: 2026-10-21.
Status: authorized-under-standing-source-scope; implementation candidate unverified.
Owner and authorization: Node policy and original Runtime resource owners. The
human's 2026-10-21 N-stage instruction authorizes this named parallel source task;
the 2026-10-19 standing source authorization covers this foundation proposal.

## Task Proposal

1. Layers: L1 Runtime reservation/Node use ports, L2 original MySQL projections,
   L3 Node grant policy, Identity grant effects and Forward/Transit adapters.
2. Public interfaces: Node authority v4, Runtime resources v1, exclusive reservation
   v1, Node module v2, Forward execution host v1 and original supplied transaction.
3. Foundation impact: additive policy ports, breaking fail-closed construction,
   persisted grant JSON, optional Forward context on Node use authorization. L0
   Forward, Agent authority/Journal and wire schemas remain unchanged.
4. Contracts: RuntimePortReservationPolicy is mandatory at production reservation
   hosts. Grant portLimits is optional: undefined preserves, null clears; an object
   contains allowedPorts and maxBindings, independently nullable. Node-owned policy
   checks original slots under original Node locks, and reduces execution eligibility.
5. Acceptance: authored cases and documented transaction/replay/cleanup vectors;
   no checks or tests executed. Functional/MySQL/network evidence requires later
   authorized Actions on the exact frozen source. Physical/release gates separate.
6. Parallel impact: root owns exports, composition, HTTP, schema catalogs/DDL and
   byte policy. This slice owns only named Node/Identity/Runtime/Forward/Transit
   leaves and documentation. additionalUseAuthorization is conjunctive injection.

## Why Current Extensions Are Insufficient

Node network policy restricts a whole machine, not a user's shared grant. Existing
Runtime capacity counts all occupied ports, not an immutable product owner's use.
A late telemetry check cannot atomically refuse reservations. Inject a Node-owned
policy into the existing reservation owner rather than copying its ledger.

## Impact And Compatibility

One occupied port_slots physical protocol+port row counts as one binding: TCP and
UDP count separately; internal Relay listeners, obsolete slots and draining slots
count until their original owner releases them. Same Forward slot reuse adds no
binding. Transit exclusive reservations still reject every occupied slot, including
the same Forward's slot. Private Nodes do not consume shared-grant limits.

Node grant allowedPorts is null or a nonempty distinct integer subset of 1..65535;
maxBindings is null or a nonnegative safe integer. Unknown/malformed fields refuse.
Limits never expand Node network policy or purpose permissions. Count is from
port_slots joined to forwards.owner_actor_id, never authorization_actor, current
grant possession or Scope owner. Creation passes its explicit product actor before
the Forward row exists. Existing resources resolve immutable product ownership.
Unclassified ownership fails closed for execution; old rows are not guessed.

Narrowing runs original grant effects and whole-route eligibility. An over-limit
owner cannot acquire or renew execution until usage is released or limits grow;
range failures affect the Forward retaining the offending physical slot. Cleanup,
exact disable and removal remain possible without acquiring execution or extra
slots. No policy decision changes authorization_actor or clears protected history.

## Migration And Version Plan

Root integration adds immutable migration 0040-shared-node-port-limits.sql and
the reviewed adp3-shared-node-port-limits-v1 Control profile (UpgradeAssessment4).
Older profile ceilings and Agent profiles remain unchanged. Existing grants get
SQL NULL, preserving their former lack of per-user port restriction.

Original Forward owner classification serializes the Forward row and all actual
occupied Runtime Node rows before assigning its previously unknown product owner.
RuntimeResourceAccess.lockOwnership and ForwardCommandPreparation.lockOwnership
are additive methods in this unverified successor. Classification is inventory
accounting only: no new reservation, authorization_actor change, renewal or
Operation. Existing slots can make the newly classified owner visibly exceed a
limit; new acquisitions and execution renewal then fail closed until original
cleanup releases usage or the administrator raises the limit. This explicit
migration state does not promise automatic eviction or grant extra execution.

The legacy Nodes, RuntimeLedger and Transit construction entries preserve their
old argument shapes by explicitly constructing the same Node policy over the
original MySQL providers when omitted; the low-level factories still require
policy injection. These provider objects create no connection, independent
transaction or duplicate ledger. The production server shares one policy instance.

Node authority moves to v5, Runtime resources and exclusive reservation to v2,
Node module to v3, Identity access commands to v3 and Runtime Relay to v7.
Runtime hosts/factories require the policy; no production alias
silently creates unrestricted reservations. Existing purpose-only grant calls keep
limits because omitted portLimits is distinct from explicit null in the command
digest. Add node_grants.port_limits JSON NULL after current immutable migrations;
NULL retains unrestricted grant semantics. Update DTOs, examples, fakes and
composition before acceptance. No Agent wire migration is required.

## Acceptance And Known Limits

Planned: private exemption; range intersection; TCP+UDP count; zero limit; two
competing transactions; pre-insert owner; immutable owner versus authorizer; retained
drain/obsolete/internal ports; same-owner reuse versus Transit refusal; automatic
Relay selection skips disallowed candidates; narrowing and original grant effects;
retry/renew/recovery fail closed; exact stop/removal cleanup; omitted versus null
grant replay; malformed JSON; factory/alias injection; rollback of complete mutation.
Public example: create one NodePortLimitPolicy from NodeAuthorityStore and the
original Runtime usage projection, inject it into Runtime hosts and NodeService,
then reserve(tx,forward,creatingActorId) inside the original transaction.

Source authored status is not contract acceptance. Root integration, exact-source
Actions, independent environments, long-run and release remain outstanding.

## Source Authorization And Acceptance Gate

This record precedes implementation. Proceed under the standing source decision
and named N-stage assignment without additional human confirmation. It does not
authorize verification, commits, pushes, merges or releases. Preserve the single
Runtime ledger, original transactions, Agent authority/Journal and protected history.

## Personal Port Usage Query Successor

The N-stage source authorization additionally covers the L3 Node owner read-only
`NodePortUsageQueries` interface version 1. This consumes the existing original
transaction, Scope membership, Node claims/grants and Runtime port-usage projection;
it changes no frozen L1 contract, allocator, clock, Agent or wire behavior.

`NodeService.portUsage(actorId,scopeId,nodeId)` reads only the actor's immutable-owner
physical bindings. Private Nodes require their owner; admin-shared Nodes require
the caller's own grant, including for a Scope governance actor. Unclassified and
ungranted resources refuse; query access does not infer product use rights.
The query does not invoke Node credential validity, runtime execution eligibility
or the optional byte-policy gate, so revoked/over-limit users with remaining read
access can see their own retained occupation. Backend errors propagate unchanged.

Return the grant limits, occupied count, remaining count clamped at zero, boolean
`overLimit` flag, aggregate `outOfRangeBindings`, applicability and the physical
protocol+port counting declaration including internal and draining rows. Private
Nodes return `not-applicable`, null remaining and null grant limits. Counts and
range violations contain no Forward identities or slot details. Metadata is
`source: runtime-port-slots`, `executionAuthorized: false` and observedAt from the
existing injected Node clock/codec. Shared grants with no numeric maximum have
null remaining without claiming private not-applicability.

This additive public query remains a source candidate alongside Node module v3.
Root integrates HTTP/UI separately. Planned/authored cases cover original
transaction and clock, private versus shared visibility, revoked retained usage,
numeric/range overage, caller-only aggregates and exact backend-error propagation;
no checks or tests are executed by this task.

Root source integration registers GET nodes/:id/port-usage through the existing
NodeService instance. It rejects query parameters and supplies only the actor from
the original bearer authentication. The console labels private not-applicability,
shared unlimited and zero maximum separately, validates caller/Scope/Node identity,
and never turns the view into execution permission. HTTP/browser acceptance remains
planned on the exact frozen source; integration is not verification.

The original HTTP-facing `NodeApi` extends the already declared
`NodePortUsageQueries`, so `ControlApi.nodes` exposes the routed query through its
public structural contract. No extra concrete service type or new Control field
is required. Node module3 and query1 cover this integration; API substitutes must
provide `portUsage` along with the existing provision/view/credential methods.

N verification preparation also synchronizes `ForwardNodeAuthorization` with the
already implemented `authorizedRelayNode` optional Forward context. Native path
adapters pass that same Forward to check retained physical slots under its
immutable owner; callers without a Forward still use the existing explicit
purpose checks. The declaration now matches the Node owner and its L1 contract;
this does not add another reservation policy or bypass the Runtime ledger.
