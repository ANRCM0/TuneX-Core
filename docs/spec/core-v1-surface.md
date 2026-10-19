# Core v1 Protected Source Surface

Date: 2026-10-18 (Asia/Shanghai).
Status: development baseline frozen by source scope; concentrated acceptance pending.
The semantic specifications remain [Core v1](core-v1.md) and [Forward v1](forward-v1.md).

Under [ADR-0048](../decisions/0048-foundation-layer-boundaries.md), L0 also has a
separate minimal runtime decision kernel. That is not an expansion of this domain
package. The [complete foundation DoD](../development/foundation-readiness.md)
remains unmet; this protected surface alone does not permit upper parallel work.

## Public package boundary

`packages/core/src/index.ts` is the public entrypoint. Modules use this surface,
without importing internal files or adding I/O. Package version remains `0.1.0`;
this record does not declare a release version.

| Export group | Protected names |
| --- | --- |
| Identifiers and protocol | `NodeId`, `ForwardId`, `ScopeId`, `Revision`, `CapabilityId`, `NetworkProtocol` |
| Entities and intent | `Node`, `Forward`, `ForwardSpec`, `ForwardChange` |
| Values | `ListenEndpoint`, `TargetEndpoint`, `PathSpec`, `TransportRef` |
| Results | `Issue`, `Result`, `ValidationResult` |
| Parsers and decision | `parseNode`, `parseForward`, `parseForwardSpec`, `validateForwardSpec`, `decideForwardChange` |
| Value primitives | `isId`, `isCounter`, `isPort`, `MAX_COUNTER`, `ipBytes`, `normalizeIp`, `normalizeTargetHost`, `deepFreeze` |

The model remains one ingress/target, nonempty TCP/UDP protocols, optional fixed
ordered path and exact locked Transport reference. Successful parsing returns
detached immutable values. Revision decisions preserve no-change behavior,
expected-revision checks and safe-integer exhaustion; storage supplies atomic CAS.
Input closure, normalization and error/result behavior are compatibility surfaces,
not just TypeScript signatures. Semantic specs define the exact constraints.

## Change placement

Application owns authorization, quota, current Node/Profile facts and idempotency.
Runtime owns reservations, assignments, deployment and recovery. Agent owns actual
resources and authority. Feature owners keep their metadata, pure rules, stores
and observations; reuse alone does not make a feature part of Core.

A new engine/configuration format adapts to current intent first. A necessary
change to what Forward means needs an ADR, explicit surface/semantic revision,
affected parser/consumer changes and compatibility/acceptance work. New optional
fields are not automatically safe with a closed parser. No inheritance hierarchy,
dynamic registry, database, socket, clock, credential, worker or protocol manager
is added to Core.

## Meaning of frozen

This freezes the intended development surface for subsequent features. It does
not assert that the unverified worktree builds, passed Actions or is approved for
release. Concentrated verification fixes must preserve the declared semantics or
explicitly revise the decision. Feature work is not permission to grow Core
opportunistically.
