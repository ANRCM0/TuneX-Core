# P Product Verification - 2026-10-24

The human selected GitHub and requested Actions testing and acceptance of the
prepared P candidate. This authorizes saving/pushing the testing branch, a draft
PR, Actions execution and necessary failure repairs. Merge, image publication,
release and delegation are outside this task. Independent-host and long-run
environments remain unavailable under the human's preceding answer.

## Candidate And Execution

Base: `b729a5be8ef98164d3de515e37e424741ad83608`.
Branch: `source/p-product-readiness-20261024`.
Initial saved head: `78ecd721e4477d0121c76e78b8abba811007156f`.
Initial tree: `5fca07b348d7e70f83b68c3fbc8e051f6d063eca`.
PR: #118, draft, against the above base.
Initial actual PR test merge: `82a41ffef4c8b14b6e524f3e208bc4d8737e1913`.

Planned execution uses the original baseline and container packaging workflows:
deployment tools; TypeScript contracts/types/boundaries/generated parity; Linux,
Windows and unsupported-platform Go/build/vet/race; native MySQL acceptance;
real mTLS/Chromium Probe and Relay; 3/4/8-node multihop and same-runner namespace
faults; container packaging and advisory SBOM/vulnerability reports.

P adds authored account credential, usage, resource/path alert, controlled Echo,
path preflight, Web and setup cases to those existing invocation lists/globs.
Whether these cases prove each PP requirement must be reconciled with actual
execution and failure logs, not inferred solely from a workflow conclusion.

Record exact head,
test merge checkout, tree, workflow/run/job identities, final conclusions and
artifacts for each candidate. Database-conditional skips require same-candidate
native MySQL matches. Record failed attempts and subsequent repairs separately.

## First Candidate Findings

Baseline run `40041418761` and container run `40041418834` tested the initial
saved head. The candidate failed; no acceptance is inferred from partial passes.
Deployment-tools job `120713131191` reported 29 passes and one failure: its
unsafe-command assertion matched Docker `--rm`. The repair requires a separate
`rm` token and retains an explicit dangerous-command match. The same assertion
blocked packaging before any image build.

Relay-isolation `120713131304`, multihop `120713131141` and multiple real MySQL
invocations failed to load Control due to TypeScript parameter properties, which
Node 24 strip-only execution does not support. Seven new classes now declare
and initialize their fields explicitly without changing constructor arguments.

Windows job `120713130927` found a native registry initialization panic: Relay
path hooks were installed as legacy Direct Probe hooks without corresponding
declarations. The repair retains the original descriptor/hooks and calls the
explicit L2 path-listener adapter only after original current assignment, driver,
ticket and path opt-in checks. Original registry/catalog cases remain intact.
These repairs require a new exact-source Actions run; no local functional tests
were executed.

## Acceptance Limits

Source preparation is delivered in the [P ledger](product-readiness-stage-p-2026-10-24.md).
The [deployment runbook](product-p-deployment-acceptance.md) retains PP-13 through
PP-16 environment obligations. Same-host namespaces and hosted-runner containers
cannot prove independent physical hosts, real deployment capacity or 24/72-hour
stability. No such result is claimed; no main merge or registry publication is
part of this verification task.
