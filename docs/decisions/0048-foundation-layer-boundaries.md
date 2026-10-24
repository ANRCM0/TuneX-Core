# ADR-0048: Explicit Foundation Layers And Parallel Development Gate

Date: 2026-10-18 (Asia/Shanghai).
Status: authorized source implementation; acceptance pending.
Predecessor: [ADR-0047](0047-classified-integration-framework-v1.md).
Change record: [FR-0001](../changes/FR-0001-foundation-layer-boundaries.md).

## Decision

Adopt the human's L0/L1/L2/L3 development model and DoD. Existing framework source
closure is not proof that the stricter foundation gate has passed.

L0 contains the existing pure domain Core and a separate small runtime decision
kernel. `packages/core` is not expanded to include the entire Control/Agent.
Database coordination, timers and machine request orchestration belong to L1 hosts,
with current authorization/resource/Journal ownership preserved. L2 implements
storage, wire and platform differences through lower-owned ports. L3 composes
product behavior through public services. Source/type dependency direction is down;
runtime invocation of injected providers is not a reverse source dependency.

Extract the existing RuntimeController orchestration into a generic L1 RuntimeHost
and its state/Node/Forward/ledger/Relay/authority/codec/observation ports. Keep SQL in
the MySQL adapter and ADP validation/compilation in the protocol adapter. Preserve
the old constructor as an explicit composition bridge and preserve old public
method signatures. Extract only the existing publication hold/reuse/deadline rules
into the pure L0 kernel; do not invent new scheduling, retry or authority behavior.

Move shared transaction/authorization/idempotency contracts, errors and task/request
lifecycle into L1. Preserve old import paths by re-exporting the same definitions.
Isolate process-usage and file-descriptor OS differences in the Agent platform
observation adapter. Other mixed legacy implementations remain explicit debt.

Document public version scopes, error/log/config conventions, the supported
compatibility targets, extension example, approved change process and parallel gate.
New product modules use only public contracts. They require their own directory,
branch/worktree, interface, tests and integration instructions after the gate opens.

## Scope And Compatibility

This is an additive source/ownership reorganization under the approved next step.
No existing Core public shape, REST/ADP wire field, driver ID, database migration,
permit duration, Journal format or protected high-water is changed. No state is
recreated, execution authorization renewed or old command retried by this change.

The flat import example is a new explicit demonstration format, not promised
compatibility with TuneX V2 or a third-party product. The sample performs authorized
preview only. It does not publish a Forward or prove real deployment.

## Acceptance

All new interfaces remain source candidates. No checks/tests/example/build/CI have
executed in this development slice. Required behavioral equivalence, boundary and
contract cases are in [foundation readiness](../testing/verification-status.md).
The whole-repository layer migration and the parallel gate remain open until their
listed debt and exact-source acceptance are resolved. Do not label them complete
because a source map or example file exists.
