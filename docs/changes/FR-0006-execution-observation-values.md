# FR-0006: Common Execution Observation Values

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: L1 execution observation facts, under the human's standing
2026-10-19 source authorization. Recorded before implementation, now source-authored
and unverified; no verification,
Git, release or parallel-feature authorization follows.

## Task Proposal

1. Layers: L1 common execution fact declarations; L2 native report/wire aliases.
2. Public interfaces: new @tunex/contracts/execution-observation leaf and framework
   public exports; original runtime/index/legacy Observation/Drain/Condition aliases.
3. Foundation impact: additive public contract entry, canonical declaration move;
   no L0 Core/kernel, execution/wire/state semantics or existing shape change.
4. Contracts: interface1 owns Condition, ExecutionPhase, Observation and Drain;
   old native Assignment uses the same ExecutionPhase union, old report types alias
   the same facts. No new protocol fields, brands, optionality or validation.
5. Acceptance: planned exact-source type/alias/export checks and authorized Actions
   report/drain/fence/replay behavior; no tests/checks/CI/generation executed now.
6. Parallel impact: current L1 runtime contracts/host ports/Relay imports migrate
   together; old wire/native/product clients keep their public paths and types.

## Why Current Extensions Are Insufficient

Observation and Drain carry instance identity/fence, execution phase/condition,
error code/retryability and drain evidence. Neither declares a protocolVersion,
schema/parser, native driver config, transport nor storage. Their current home
types.ts mixes these facts with legacy ADP envelopes and default policy. L1 source
references them through the outer runtime entry. Extract the existing facts into
one lower public leaf rather than copy schemas, grow L0, re-export outer types
through L1 or declare the entire contracts package a lower layer.

## Exact Contract And Migration

Move the original Condition/Observation/Drain declarations. ExecutionPhase is the
existing prepared|active|draining union, extracted from legacy Assignment.phase;
Observation.phase stays that union plus absent. Every original mutable required
field, null errorCode and condition union stays. The new leaf has no imports,
default values, I/O or validation and exposes EXECUTION_OBSERVATION_INTERFACE_VERSION=1.
types.ts imports/re-exports exact aliases and uses ExecutionPhase in Assignment.
Its ReportRequest continues using the same Observation[]/Drain[] declarations.
framework public exports the types/version; native runtime/shared/index/legacy
paths retain all original names without duplicating declarations.

L1 runtime-contracts, runtime-host-ports and runtime-relay take Observation directly
from the lower leaf. All other raw RuntimeMessages/Assignment/Snapshot/Relay native
types remain separate unresolved ownership work; aliasing facts does not resolve
wire envelopes. Host interface versions stay unchanged for this type relocation.

## Impact And Compatibility

No parser/schema/default/error/SQL/clock/authority/Journal body changes. No change
to report sequence, observation matching, drain lease checks, accepted generation,
resource fence or sanitized error handling. Invalid input is still refused by the
original wire/native validators and owner policy. Unknown input is not made valid
by moving a TypeScript interface. Exact source symbol/tool consumers still need A5
and later authorized acceptance; source search is not whole-repository proof.

## Acceptance And Known Limits

Readiness125 planned: compare old/new field/union/mutability/nullability and report
array signatures, public exports and version, shared source declaration consumers,
native parse/validation/error behavior and same-Tx observation/drain/replay rules.
No package installation, dependency/lockfile change, generator or data migration.
No tests/checks/builds/CI/experiments/Git writes executed. Full runtime wire/type
closure, public example, physical/long-run/release gates remain unverified.

## Source Authorization And Acceptance Gate

Proceed under the standing source authorization after recording this concrete scope;
no repeated confirmation. Source authorship is not acceptance or a frozen candidate.
