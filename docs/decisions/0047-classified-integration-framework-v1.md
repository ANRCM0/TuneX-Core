# ADR-0047: Close the classified integration framework v1

Date: 2026-10-18 (Asia/Shanghai).
Status: Source scope closed, unverified. Source closure and executed acceptance are separate.

Later [ADR-0048](0048-foundation-layer-boundaries.md) adopts the stricter four-layer
foundation DoD. Its remaining scope and parallel gate stay open; this ADR's narrower
source closure is not a stable-foundation acceptance declaration.

Implementation map and subsequent integration recipes:
[Framework v1](../architecture/framework-integration-v1.md).
Protected development surface: [Core v1](../spec/core-v1-surface.md).

## Decision

Finish the foundation before adding product features. Keep Core v1's current
public API and pure intent model. Runtime owns the one execution ledger; the
Agent Runner owns Journal, authorization deadlines, Fence and physical resources.

The framework supports three distinct integration directions:

1. Configuration/API adapters validate outside input and propose or call existing
   application commands. They receive public services, never a database pool,
   Runtime controller, secret store or arbitrary cross-owner writes.
2. Execution adapters implement the native bounded execution lifecycle. Explicit
   host contract, assignment schema and capability checks precede selection.
   Disabling new execution never discards existing cleanup or Journal obligations.
3. Observation adapters provide attributed, bounded facts and optional independent
   worker tasks. They cannot mint execution authority. Their lifecycle does not
   delay the authoritative Runtime worker or consume its database admission slots.

Static composition is explicit. Same-process public service signatures use ordinary
TypeScript/Go interfaces. Cross-process/persisted contracts remain independently
versioned and closed; the framework does not turn unknown JSON or driver IDs into
supported execution. Registration is trusted compiled code, not a plugin sandbox.

## Source completion criteria

- HTTP routes consume structural application services and machine ports. SQL,
  transaction orchestration and service construction stay behind the application
  or composition boundary. Existing command keys, receipts and authorization order
  are preserved.
- The current online, historical internal and experimental contract entrypoints
  are explicit without deleting the existing aggregate compatibility export.
- Existing native declarations are consumed by both Control selection/compilation
  and Agent execution registration, with deterministic duplicate/version/capability
  rejection. A catalog alone is not permission or a lease.
- Optional worker tasks share a bounded lifecycle helper with independent execution,
  non-overlap, stop-admission and draining before their dependencies close. The helper
  never retries business commands, owns their state or clears protected history.
- Core's frozen surface, extension recipes, ownership and compatibility-change
  requirements are documented against actual existing implementations.

Existing product modules are the reference integrations. No new echo, failover,
external engine, generic repository, event bus, dependency injection container or
universal CompatibilityManager is required to finish this scope.

## Cost and validation

An ordinary management feature should add its owner/service/adapter and one
explicit composition entry. A new execution meaning still requires schema,
compiler, authorization, lifecycle and compatibility work. The framework reduces
repeated plumbing; it cannot remove these correctness responsibilities.

During source development, preserve the user's no-tests/no-static-checks/no-CI
agreement. Record acceptance work for the frozen foundation separately. Unexecuted
checks, final-SHA Actions and physical/release evidence remain unverified. Do not
call the current dirty worktree a validated base for future development.
