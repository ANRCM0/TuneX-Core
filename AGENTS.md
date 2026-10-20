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
Keep foundation changes in a separate approved task; avoid shared composition-file
edits until integration. Do not commit, switch or discard this existing dirty
foundation worktree merely to manufacture independent branches.

## Current Development And Evidence Agreement

On 2026-10-19 the human subsequently authorized testing and pushing the complete
A5 candidate, then merging PR #111 and cleaning obsolete documents and historical
files with a further commit/push. That bounded authorization supersedes the
source-only restriction below for those tasks. It does not accept the foundation,
open parallel product development, or authorize a release.

The later complete-B task additionally authorized closing the 220-item assertion
map, the named parallel owner work, static checks, commit/push, exact-source
Actions and removal of unnecessary temporary records. The bounded B acceptance
decision is now recorded in docs/development/foundation-verification-2026-10-19.md.
Future module entry is eligible only for the accepted frozen public contracts or
a separately verified successor, with its own authorized task, public contract,
independent branch/worktree, tests and integration instructions. This task does
not authorize merging PR #112, starting C product work or publishing a release.

The current human agreement is source development first, concentrated verification
after freezing. During this phase do necessary source reads/edits; do not run tests,
type/syntax/static/boundary checks, formatters, generators, builds, acceptance CI,
network/MySQL/browser experiments, commits or pushes without later authorization.
Do not expand test/CI tooling as a substitute for the source task. Record required
acceptance cases and unresolved compatibility in the foundation readiness document.

When verification is authorized, functional/MySQL/network/container/browser evidence
belongs in GitHub Actions. Record the exact tested source revision. Historical
passes do not validate current changes. Independent physical-host gates remain
unverified when hosts are unavailable; do not replace them with same-host evidence.

Never revert unrelated existing changes. If unexpected concurrent changes appear,
stop and ask how to proceed. Do not delegate to sub-agents unless the user or an
applicable instruction explicitly authorizes delegation.
