# Foundation And Module Work Protocol

Applies to current TuneX source. Historical and third-party reference checkouts
are not implementation dependencies and are excluded from the current tree.
Read the more specific instructions for any
directory being changed, and follow the human's current task authorization.

## Layers And Public Dependencies

The source map is `docs/architecture/foundation-layers-v1.md`; the declared
boundary inventory is `docs/architecture/foundation-boundaries-v1.json`.

- L0: pure domain Core and minimal runtime decisions. No database, platform,
  application module, network, clock reads or framework dependencies.
- L1: owner-independent ports, Runtime host, common errors, lifecycle and logging
  contracts. Import L0 only through its public entrypoints; inject L2/L3 providers.
- L2: explicit platform, storage, wire and external-format adapters. Consume L1
  contracts; keep external differences inside their adapter owner.
- L3: product modules. Use public L1/L2 services and other modules' public contracts.
  New modules use their own directory and `public.ts` (or equivalent public Go API).

Dependency direction means source imports and type references. An injected callback
may execute an outer adapter without creating a reverse source dependency. Calls
need not pass through an irrelevant adapter. Composition roots assemble declared
implementations and ports; they are not a precedent for business modules to access
private implementations. Do not add composition roots to evade a boundary.

Keep one Runtime ledger and the existing Agent authority/Journal owners. Never
copy framework/kernel code, add a competing authority, or clear protected history
as a compatibility workaround. L3 must not contain platform-specific branches or
write another owner's tables. Cross-module work uses a public contract and joins
the original transaction where atomicity is required; an event is not mandatory.

Existing mixed implementations are listed as migration debt, not accepted
exceptions for new work. Report unclassified dependencies before extending them.

## Required Task Proposal

Before edits, state these six items concisely:

1. Task layer(s).
2. Public interfaces consumed.
3. Whether the foundation is touched.
4. Added/changed interface contracts.
5. Tests and acceptance method, distinguishing planned from executed.
6. Effects on other concurrently developed modules.

For L3, reuse L1/L2 first. For L1/L2, preserve existing L0 interfaces and prefer
extension points. For L0, explain why existing extension points are insufficient
and identify upper consumers. Keep the domain Core API protected.

Changes to a frozen foundation public interface or its semantics need a foundation
change request before implementation. Use
`docs/templates/foundation-change-request.md` and identify impact, migration,
compatibility and acceptance. Under the human's standing authorization of
2026-10-19, choose the best approach and implement similar foundation source
proposals autonomously; do not request separate human confirmation for each one.
Record the decision and its authorization in the change request, including any
breaking source behavior. This source authorization does not open verification,
commit/push, release or parallel-feature gates. Routine private fixes preserving
the public contract do not become breaking changes solely because a foundation
file is touched.

The current bootstrap/change scope is recorded in
`docs/changes/FR-0001-foundation-layer-boundaries.md`. It does not authorize arbitrary
future public contract changes or imply that the foundation passed acceptance.

## Parallel Module Development

The gate is documented interfaces + passing contract acceptance + a usable public
example on the frozen source revision. Source closure alone does not open it.
Once opened, each parallel module task uses an independent branch/worktree and
module directory, with a public contract, tests and integration instructions.
Keep foundation changes in a separate authorized task; integrate shared composition
files serially. Never discard existing work to manufacture independent branches.

## Stable Maintenance And Evidence

The human moved the project into stable maintenance on 2026-10-24 and requested
project-file cleanup including development-process documentation. Current entry:
docs/maintenance.md. Installation/recovery guides live in docs/operations;
acceptance requirements and exact-source evidence live in docs/testing.
Earlier stage plans, agent assignments, run-by-run logs and large assertion
worksheets are available through Git history, not active task instructions.

Keep protocol schemas/fixtures, migrations, generated assets, contract tests,
public examples, source classification, ADRs and FR compatibility obligations.
Cleanup never authorizes changes to runtime semantics or protected state.
The stable-stage designation is not independent-host/load/long-run acceptance.

Use the human's current scope for edits, verification, commit/push and release.
When verification is authorized, local execution covers static/type/boundary,
generated-parity, formatting and compilation/vet. Functional/MySQL/network/
container/browser evidence belongs in Actions. Record exact tested SHA/tree,
whole-job conclusions, conditional skips, merge and image publication separately.
Historical passes do not validate later executable changes. Never fabricate
physical-host independence or elapsed 24/72-hour evidence from same-host cases.

The human deploys real machines independently. Host topology/access and secrets
remain with the operator; do not request access merely to prepare documentation.
Diagnose shared deployment evidence within the current task authorization.

Never revert unrelated changes. If unexpected concurrent changes appear, stop
and ask how to proceed. Do not delegate without explicit human or applicable
instruction authorization. Do not publish a stable tag/release as a cleanup step.
