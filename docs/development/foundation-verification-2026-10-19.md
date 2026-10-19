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

### B Candidate Update - 2026-10-20

PR #112 candidate `4bb399f34600fca3e16613ef8a1d09fc93c06330` ran at actual
Actions checkout `807983784be96861ae9f7b5c636dfec5d8d96e6d` in baseline run
`39280558322`. The contracts job failed one newly added Identity audit assertion:
it read SQL argument index 7 (details) instead of index 6 (created_at). The next
candidate corrects the assertion. This run reported 922 TypeScript passes, one
failure and 78 conditional skips; Go full tests/vet/race and Web suites passed
within that job. Windows Agent, deployment tools, Probe and Relay isolation jobs
and packaging run `39280558321` passed. The remaining integration jobs also
completed successfully; the failed contracts job keeps this baseline failed.

The following saved candidate `8c114b99a8ec50685adea9a512c1f5a1d56a2743`
ran at PR merge checkout `7b0b2ec` in baseline `39284689909`. Contracts found
two server fixture continuation waits, one missing Web fixture method in three cases and
three Agent test/vet expectations; those are corrected in the next test batch.
Windows Agent also failed the same Agent expectations. Packaging `39284690233`,
deployment tools, Probe/Relay isolation and 3/4-node integration passed. The
8-node browser path batch timed out awaiting an Operation and remains under
investigation; no passing full baseline is recorded for this candidate.

The next source batch adds original Control composition callbacks, HTTP query
families, reconciliation and Transport formatting, native recovery/upgrade/operator
effects, notification request/response cancellation drain, native Relay browser
flows, Agent time projection, Ledger SQL rollback and competing claim locks.
The new Ledger MySQL groups and Relay owner groups are explicitly routed to the
disposable MySQL phase1 job. Local TypeScript and 950-source boundaries passed.
No local functional tests ran. All appended tests require their saved head's Actions.

Candidate `51070461f9172bd964a143a1e39300a4a14ddd42` ran at checkout
`bb66c203539b68c5ab7ee3ded672a9878dd72f15` in baseline `39289305414`.
Its contracts result was 1037 TypeScript passes, five failures and 84 conditional
skips. Three notification fixtures used a query-string destination that the
existing parser refuses before dispatch; two recovery/upgrade fixtures expected
the domain error instead of the earlier exact-integer JSON error. Linux/Windows
Agent found an uninitialized timing policy in a new guard fixture. phase1 found
the claim-competition fixture mixed expiry UPDATE scan locks into selector locks;
the next fixture isolates SKIP LOCKED while retaining real expiry/claim checks.
These corrections are authored in the following batch. Packaging, Probe, Relay
isolation, deployment tools and 3/4/8-node integration passed. No full passing baseline is claimed. Next failure artifacts retain
sanitized snapshot windows/instance identifiers and plan authorization deadlines,
plus policy, local diagnostics and Agent error/exit timestamps, to distinguish
short publication windows from delayed Agent progress without uploading wire or
credential bodies.

The B [assertion map](foundation-b-assertion-coverage.md) associates all 220 cases
with actual suites and specific remaining obligations. 98 cases have fully
identified assertions; 122 remain partial. This classification does not report
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

The next authored batch adds explicit resource SQL/rollback, native MySQL advisory
lock and partial-DDL/uncertain-commit, Forward SQL, runtime machine/time codec,
Agent pending-response recovery and observation provider/type witnesses. MySQL
examples are routed to phase1. Local TypeScript passed; cached-only Go vet was
blocked by two missing modules with GOPROXY=off, so no Go static pass is inferred.
These tests require their own saved-source Actions and do not inherit 5107046.
