# Foundation Verification - 2026-10-19

## Scope And Authorization

The human authorized organizing, testing and pushing the complete A5 candidate,
then merging PR #111 and cleaning obsolete documents and historical files with
a further commit/push. Local checks remain static; functional, MySQL, network,
container and browser experiments run in Actions. Public semantic changes still
require FR governance. Foundation acceptance, upper parallelism and release
remain separate gates.

## Saved Source And Passing Evidence

| Identity | Exact value |
| --- | --- |
| PR | #111 |
| Saved head | `9f1d78d939a59c1514d9bcca1591afa2e89e6754` |
| Base | `8f35889e13b09a19d215dc10bc6855a3ca98b366` |
| Actual Actions checkout / PR test merge | `91e560f83e1c121a389aa90fbafa52d31ab5c28a` |
| Merged main | `373c291a6ea4f04e5929796a6119eb3b60027c34` |
| Baseline workflow | [39253399257](https://github.com/ANRCM0/TuneX-Core/actions/runs/39253399257), success |
| Container workflow | [39253399299](https://github.com/ANRCM0/TuneX-Core/actions/runs/39253399299), success |

Both workflows and all nine checks completed successfully for the saved head.
The tested merge identity came from the actual checkout log. Merged main and
subsequent cleanup are separate revisions and require their own workflow results.

- Baseline: 630 TypeScript passes, 78 conditional skips, Web 99/99, boundary
  negatives 11/11, 950 production source checks, document links, generated parity,
  offline plan/Go parser and public extension pass.
- Go full suite/build/vet/race pass in Actions.
- Real MySQL/mTLS, lifecycle, security/faults, access/Transport, Relay switching,
  backup/recovery and capacity pass; the aggregate took 18m38s.
- Probe/Relay Chromium, Relay isolation/capacity/rotation, complete 3/4/8-node
  topology/browser and namespace fault/recovery/latency/loss pass.
- Container builds, non-root/refusal, SBOM/vulnerability and Compose gates pass.
  These PR workflows did not publish images.

Conditional skips do not stand in for the separate database/browser jobs.
Local checks are TypeScript, recursive Web syntax, boundary/generated parity,
Windows amd64 Go build/vet and Linux cross-build. No local functional or
integration experiments ran.

## Included Repairs

Compilation repairs retain strict typing and original owners. The L2 SQL splitter
handles comments, quoted/escaped semicolons, executable comments and session quote
mode without changing DDL or migration locks/order.

Tests follow canonical public owner/native implementations. VM factories, receipt
fixtures, capability waits and Tunnel routes were adapted while retaining CAS,
replay, cancellation, denial, immutable history and request-count assertions.
Restricted Probe fixtures grant only required history operations and prove original
same-transaction rollback after actual history writes. Agent fake ports prove
inspection refuses effects before enrollment, lock and Runner, including conflicting
flags. Independent CI groups retain a final failing status; the aggregate has a
bounded 30-minute budget.

Earlier failed/cancelled candidates remain in PR/Actions history and are not
evidence for this source.

## Cleanup Revision

The maintenance change removes old V2, the local reference checkout, historical
source archive, obsolete comparisons/inventories/phase plans, deployment/operator
handbooks and transient verification scratch. The untracked reference checkout
and local scratch were moved to a recoverable directory outside the project;
tracked historical files remain recoverable through Git history. Current architecture, public
contracts, ADR/FR, schemas, fixtures, migrations, compatibility parsers, tests and
packaging assets remain.

This record predates the cleanup commit and does not claim its own CI result.
Git and Actions identify that commit and its checks. Before saving this cleanup,
local TypeScript, 950 production source boundaries, 37 Web syntax checks and
generated contract/fixture parity passed. All 294 retained Markdown files passed
the local-target link scan; staged whitespace checks are required before push.
These static results do not claim a new functional CI result.

## Remaining Acceptance

The B [assertion map](foundation-b-assertion-coverage.md) associates all 220 cases
with actual suites and specific remaining obligations. 31 cases have fully
identified assertions; 189 remain partial. This classification does not report
execution success. PR #112 adds direct failure-order, owner-transaction, native
and compatibility tests, a private notification cancellation/drain fix and distinct
multi-hop fixture ports. Its first head `8ee61b1fdc952675c7a625605aa79a447ab7e65f`
is superseded by later additions; record the final exact-source Actions separately.
Later B repairs enforce native-platform refusal in non-binding Control/Go L3
source and restore the Runtime Policy type alias already specified by FR-0005.
The final suite also compares complete Probe permit validator and credential
record representation/projection matrices. Earlier 422 and invalid test-fixture
failures stay in Actions history; they are not accepted as passing evidence.

These configured A5 CI results do not sign off readiness cases 1–220. Independent physical hosts,
long-run/load, independent Responder build/publication, release and production
readiness require separate evidence. Multiple processes/namespaces on one runner
are not independent physical-host evidence. Upper product-module work stays closed.
