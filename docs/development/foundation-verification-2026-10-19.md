# Foundation Verification - 2026-10-20

## Current Decision And Source

B is **accepted for the frozen current public interfaces and configured Actions
environments**. All 220 readiness requirements have complete mapped assertions
and applicable exact-source execution; the
[map](foundation-b-assertion-coverage.md) contains 406 evidence sources, including
scenario/configuration/assets, rather than 406 executed test suites.

| Identity | Exact value |
| --- | --- |
| PR | #112, open; no merge or release in this task |
| Saved and pushed source | `e208a3abf17129b0c2898ba2022c69f60f45445a` |
| Actual Actions checkout / PR test merge | `c3ce8a67b901f61234b4116190409854818cb6c7` |
| Saved source and tested tree | `3078437e718bc308444f15e056e1a1397ed87796` |
| Baseline | [39341589653](https://github.com/ANRCM0/TuneX-Core/actions/runs/39341589653), success |
| Container packaging | [39341589509](https://github.com/ANRCM0/TuneX-Core/actions/runs/39341589509), success; no image publication |
| Source status at freeze | Tracked tree clean; only the three temporary evidence JSONs scheduled for cleanup remained untracked |

The actual checkout is read from completed job logs, separately from the workflow
head SHA. All baseline and packaging jobs belong to this source and checkout;
older passing jobs are not combined to accept this candidate. The acceptance and
cleanup commit following this record changes documentation only and requires its
own final workflows, reported externally after completion to avoid self-reference.

## Applicable Execution

| Job | Job ID | Conclusion |
| --- | --- | --- |
| contracts | 118364174142 | success |
| deployment-tools | 118364174200 | success |
| probe-workflow | 118364174256 | success |
| multihop (8) | 118364174349 | success |
| unsupported-platform | 118364174355 | success |
| windows-agent | 118364174356 | success |
| multihop (3) | 118364174390 | success |
| phase1 | 118364174456 | success |
| relay-isolation | 118364174470 | success |
| multihop (4) | 118364174590 | success |
| containers | 118364173890 | success |

Every applicable named step completed successfully. Setup/post-cleanup outcomes
are distinguished from functional assertions. The native database fixture job
executes the 45 database-conditional TypeScript files, including populated
rollback/competition and migration0038 cases. Generic-contract database skips
are not database passes; their native route is separately reconciled. Linux
getuid/Actions-only native cases use Ubuntu; Windows runs the full Agent suite,
build and vet; macOS exercises five named unsupported-platform packages, including
actual synchronization provider selection and native execution registry refusal.

Contracts: 1946 TypeScript passes, zero failures and 143 database-conditional skips;
Web 153/153, boundary negative cases 18/18 and deployment preflight 24/24 passed.
Every native MySQL test group reports zero skips and failures in its completed
log, including fresh 0038 and populated reconstructed 0037 upgrade/refusal cases.

The public extension compiles and runs on this same revision. Its authorization,
immutable non-executable preview, error/log conventions and drain are covered;
it is not a Runtime deployment demonstration. Go full tests/build/vet/race,
generated schema/fixture parity and source/type/private boundary negatives pass.
MySQL/mTLS, security, failure recovery, capacity, Probe/Relay Chromium and same-runner
3/4/8-node browser/namespace scenarios pass. Container build/non-root/refusal,
SBOM/scan and Compose checks pass; PR packaging publishes no image.

The original native IPv6 UDP test may skip when its loopback is unavailable;
aggregate Go success does not establish that individual environment branch.
Windows POSIX-only cases retain their intended conditions and corresponding Linux
execution. macOS is refusal evidence, not support for native execution drivers.

## Accepted Contract Scope And Compatibility

Accepted scope is the current public declarations, their independent counters,
classified callers, legacy/native aliases, defaults/receiver/error/lifetime
behavior and owner transaction/refusal paths in the configured environments.
The candidate index and assertion map explicitly bind public counter/type/default
witnesses and the public example to the same source. Source changes disclosed in
FR-0001–0027 remain source changes; acceptance does not promise native serialization
of lower tagless types, private imports or hypothetical external callers.

B's repairs retain original owners: notification cancellation releases admission
capacity, populated Audit reads join native dependencies, queued Runtime publication
respects the existing renewal lead (FR-0026), and migration0038 accepts MySQL's
valid INTEGER/UNSIGNED INTEGER plan expiry (FR-0027). UpgradeAssessment2 adds the
explicit0038 Control profile, retaining all26 older ceilings, Agent profiles and
plan/report1. Its reviewed CHECK-only catalog entry has no table/column footprint
and does not establish full schema/CHECK metadata equivalence.

The0037 upgrade test reconstructs an isolated native fixture, seeds populated
plans/decisions and unrelated protected history, then invokes the actual migrator.
It preserves exact original raw bytes, all old rows/receipts/other CHECKs and
replay behavior; this is not a captured historical production database. Fresh
INSERT and a genuinely revision-changing UPDATE reject same-numeric DOUBLE.
The original UPDATE cases separately reject string/null/missing/mismatched and
time-bound inputs. A numerically equal native JSON UPDATE can be a no-op; it is
separately proved to retain integer type, exact bytes and every table. No
additional production change was made to force CHECK on native no-ops.

## Acceptance Decision And Remaining Gates

Under the explicit complete-B task, the bounded acceptance decision closes
requirements 7/192/220 with the exact saved source, complete execution and
public example. Subsequent modules may consume these accepted public contracts
from this frozen revision or a separately verified successor, with an authorized
module task, independent branch/worktree, public entry, tests and integration
instructions. Shared foundation/composition changes remain serial and follow FR
governance. No new product slice starts here. Current main remains the prior A5
integration line; PR #112 has not been merged.

Independent physical-host topology, long-running/load and resource baselines,
standalone Responder build/delivery, image publication, release and production
readiness remain unmet where independent evidence is absent. Same-host namespaces
are not independent physical hosts. This acceptance does not approve release.

## Authorization, Local Checks And Cleanup

The human authorized A5 testing/push, PR #111 merge and historical cleanup, then
complete B assertion work, parallel owner work, static checks, commit/push and
removal of unnecessary temporary records. B acceptance follows development-plan
B.3 after the applicable evidence closes. This authorization does not merge
PR #112, start C product work or approve release.

The frozen source passed local TypeScript and 950 production-boundary/document-link
checks. The final documentation/metadata changes receive boundary/document-link
and whitespace checks plus their own full Actions. No local functional, MySQL,
network, browser or container test ran.

All durable regression suites, migrations, schemas/fixtures, public examples,
contracts, FRs and owner records remain. The three untracked repository evidence
JSONs, 238 scratch files and four downloaded-artifact directories were moved to
a recoverable archive outside the project and temporary directory:
`C:/Users/mn139/.codex/archived_task_scratch/tunex-b-20261020-e208a3a`.
The final status checkpoint and PR-body scratch stay only until final CI, then
join that archive. Protected authority/Journal
history, credentials, dependency caches and unrelated project files are outside
cleanup. Historical failed/cancelled run chronology is condensed here; immutable
Git/Actions records retain its original source and results.

## Historical A5 Milestone

A5 saved head `9f1d78d939a59c1514d9bcca1591afa2e89e6754` passed baseline
[39253399257](https://github.com/ANRCM0/TuneX-Core/actions/runs/39253399257) and
packaging [39253399299](https://github.com/ANRCM0/TuneX-Core/actions/runs/39253399299)
at actual PR checkout `91e560f83e1c121a389aa90fbafa52d31ab5c28a`, then merged
by PR #111 as `373c291a6ea4f04e5929796a6119eb3b60027c34`. Its630 TypeScript/
99 Web passes were that revision's configured evidence, not acceptance of later B.
Old V2/reference copies, historical archives, obsolete comparisons and operator
handbooks were removed from the current tree under the earlier cleanup task.
Tracked history remains recoverable in Git; current contracts, assets and tests
remain in the development tree.
