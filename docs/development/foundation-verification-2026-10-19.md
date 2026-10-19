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
with actual suites and specific remaining obligations. 184 cases have fully
identified assertions; 36 remain partial. This classification does not report
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

Candidate c60e4a0 had a new workflow indentation error; baseline39293488202
failed before creating jobs, so it supplies no functional execution. The YAML-only
fix0c51cc0859b16986c2f0bfde91085f6343da05b9 ran in baseline39293728114 at
checkout24740a29b2b35b0bdbc0cae23e9942496a2cbee4. Contracts recorded1079
TypeScript passes,2new fixture failures and89conditional skips; Web153/153.
The two failures assumed a plain TLS JSON prototype and omitted two real value
imports in a source-type expectation. Linux/Windows Agent found a malformed
new Probe timestamp fixture. phase1 found a new test incorrectly asserted the
session default isolation rather than current transaction behavior. All four
fixture corrections are authored for the next candidate. Packaging39293728031,
deployment tools, Probe, Relay isolation and3/4-node integration passed.

The8-node browser path batch timed out after its ingress Agent safely expired.
Sanitized snapshots show generation47issued17:38:44.783Z, validUntil17:39:29.783Z,
Agent exit17:39:24.807Z and generation48issued17:39:29.789Z. FR-0026 records the
queued-publication hold repair: honor the configured renewal lead before the
Agent's existing skew cutoff. Tests cover exact boundaries and authority/persist
failure ordering. No lease/guard relaxation is made. This source repair and the
new HTTP, Node/Identity, observation, recovery and bootstrap/channel suites require
the next frozen candidate's own full Actions. No complete B baseline is green.

Candidate `5b44eec5fdfe7f45bbce9ec721d517aeb1724c62` ran in baseline
`39297576207` at checkout `a43e1be8bb5a48e2d677659ab4cd57a334b7c1cc`.
Deployment tools, Windows Agent, Probe, Relay isolation and all 3/4/8-node
integration jobs passed. The 8-node job includes renewal, Control restart,
namespace partition/delay/loss, each intermediate restart, prior-generation
report replay, grant withdrawal/restoration and deletion after offline lease
expiry. Packaging `39297576289` passed at the same checkout. This supplies
configured integration evidence for FR-0026, not complete B acceptance.

Contracts recorded 1193 TypeScript passes, six failures and 98 conditional skips.
Four new expectations mishandled bearer terminal newlines, an observed validation
call, the captured mock clock proxy and a null-prototype historical proof. Two prior
Runtime hold assertions still expected holding inside the renewal lead changed
by FR-0026. phase1 stopped on a new inventory helper ordering a one-column table
by a nonexistent second column. All seven fixture corrections are authored in
the next batch; no production behavior is changed for these fixture repairs.

The following authored batch adds original scheduler/CLI, Transport, Transit
reservation/stage/abort/negotiation, PathTemplate and Notification storage/Vault
assertions. MySQL cases are explicitly routed to phase1; native Linux Vault runs
through the ordinary Linux contracts suite. Local TypeScript and the 950-file
boundary check passed during integration; no local functional tests ran. Its
saved-source Actions remain required. The map now distinguishes 122 complete
assertion requirements from 98 partial requirements; neither count is an
execution pass or a foundation/physical-host/release decision.

Candidate `c8c358f66ddfecc0a2268ae251c07d138b142ded` ran baseline
`39301514084` at checkout `291cfd4` (the logged merge of that candidate into
`4c2fabdb9ab102614eed31c2808bea5a72227904`). Contracts recorded 1305 TypeScript
passes, seven failures and 109 conditional skips; Web passed 153/153. The failures
were new Notification policy-version consistency and Transit fake-row aliasing
and native versus parsed JSON prototype expectations. Windows found a new
scheduling fixture checked a deferred ticker Stop before its notification. phase1
found a new negotiation clock fault escaped into mysql2's subsequent connection
timestamp and inventory. Source fixture repairs preserve the original production
contracts and their denial/order assertions; they require the next candidate's
Actions. Native PathTemplate SQL and per-write canonical rollback cases passed
before the negotiation failure. Deployment tools, Probe, Relay isolation and
three/four-node integration passed. Packaging `39301514062` passed at the same
logged checkout; eight-node execution is still pending at this record update.

The next authored batch adds complete Runner, forward-counter/time-guard, offline
Transit coordination and Notification sender/admission/lifecycle assertions.
PathBinding now has native SQL, exact projection/default-time and canonical
append/detach rollback assertions; full create/group/publication caller coverage
remains explicitly partial. The maintained map identifies 130 complete assertion
requirements and 90 partial requirements. This source classification is separate
from execution success. No local functional or MySQL tests ran.

Candidate `c8c358f66ddfecc0a2268ae251c07d138b142ded` subsequently finished its
eight-node Chromium lifecycle and namespace partition/loss job successfully.
The baseline still failed Contracts, Windows and phase1 as recorded above.

Candidate `ef9f84002ce3a98a7e7e2d7fbbe9a7bf4fb5f711` runs baseline
`39305091289` at checkout `04bcf03a4322233c12ad332c9c93fb510c4b8f7a`.
Windows, deployment tools, Probe, Relay isolation and three/four/eight-node
integration passed. Packaging `39305091229` also passed on this candidate. Contracts recorded
1374 TypeScript passes, two failures and112conditional skips; Web153/153.
The failures were new Notification expectations for the native parser's
null-prototype records and synchronous request-creation rejection. phase1 stopped
on a new Node grant fixture whose subject was a viewer, correctly denied by the
original management check. Corrections retain that refusal and unchanged-state
proof before seeding a manager for the three-write rollback case. No production
behavior is changed by these fixture repairs; their next-source execution is pending.

The following authored batch adds Echo bounded-exchange, Audit populated native
attribution/HTTP, Station retention/transaction, Forward command/native execution
and PathGroup owner/SQL assertions. The actual Forward/Executor/Path/Group chain
shares one caller transaction through capacity then both immutable provenance
owners. Outer publication/Ingress batch callers remain explicitly partial.
The maintained map identifies136complete assertion requirements and84partial
requirements across336source suites. Native MySQL cases are explicitly routed to
phase1. This classification supplies no execution pass or foundation acceptance.

The next authored batch completes the outer PathPublications owner chain and
IngressGroups, Diagnostics, ObservationServices, Probe instance/qualification
registries and native Journal format/loader/Bootstrap assertions. Publication
uses actual ForwardCommands, native execution, PathBindings and PathGroups in one
transaction, including grant refusal, every late owner/attempt/response rollback
and pointer-only compensation retaining immutable history. Original native SQL
and canonical MySQL batch/refusal/CAS/quota tests are explicitly routed to phase1.
The maintained map now identifies 145 complete assertion requirements and 75
partial requirements across 350 source suites. This is assertion-source coverage,
not a completion percentage or passing execution. No local functional or MySQL
tests ran. Later candidate Actions must execute these additions and the three
ef9 fixture corrections on their exact source; historical integration success
does not validate them.

Integrated TypeScript and staged whitespace checks passed before saving this batch.
Go test/build/vet/race and all functional/native MySQL execution remain Actions-owned.

Candidate `a2c82d14856650c8bfb11293ab1b4b88175b2377` ran baseline
`39311005424` at exact checkout `323040af75cd728a71ea56fce413aa603a112cd2`
against main `4c2fabdb9ab102614eed31c2808bea5a72227904`. Deployment, Probe,
Relay isolation and three/four/eight-node integration passed.
Packaging `39311005410` passed. Contracts and
Windows were blocked by the new Echo frame test combining equivalent constant
checks in a Go-vet suspect-or expression; its assertions are now independent.
phase1 exposed cross-realm arrays in the Station fixture and two populated
Audit historical Node-attribution queries returning no rows. Station now executes
its unchanged source in one realm. Audit retains the original immutable Scope,
revision/digest and exact Node predicates while using correlated scalar counts
for the two JSON_TABLE query builders; this avoids the EXISTS semijoin shape
implicated by the failure. Original failing fixtures/expectations remain and a
multi-row, cross-Scope canonical MySQL baseline independently uses direct joins
and JSON containment. The root-cause diagnosis and correction still require
execution on the next exact source; they are not accepted from source inspection.

The next authored batch closes original Ingress Deployment/Migration and
Probe history/finite-plan owner and SQL matrices, plus Agent Transit controller
and durable native preparation/TLS refusal. New actual-route matrices cover
all management read/write registration and body bounds, machine/parser/session
ordering and telemetry lookup exclusions, all Console assets/bytes/headers,
request UUID before lifecycle and client-abort drain behavior. Complete outer
Forward/Path/Group/Publication/Ingress caller coverage reconciles the former
aggregate Path and Ingress source obligations. The maintained source map now
identifies 169 complete and 51 partial requirements across 373 suites. Functional,
MySQL, native socket and lifecycle execution remains Actions-only on the later
saved candidate. Foundation acceptance, physical-host, parallel product and
release gates remain separate.

The same authored batch now also covers original Access/Node command effects and
native driver catalog construction, Console/Transport/Tunnel read projections,
Agent native control construction and offline execution, and real TLS handshake
defaults and refusal behavior. These assertions reuse original owners and current
public contracts. TypeScript and the 950-file production boundary scan passed
locally; Go formatting and whitespace checks are static only. The Audit private
SQL correction is included in this batch, so earlier production boundary evidence
is supplemented by the current scan rather than treated as unchanged-source proof.

Candidate `fff3a91d8de003aa804420613663b72fb4e7b35b` ran baseline
`39315559804` at checkout `f7dd50e3cca628fe9da23d622e2fb0f71fff1acc`.
Contracts and Windows exposed native TLS fixture full-duplex pipe blocking;
contracts also exposed frozen shared limits, duplicate path fixture digests,
an overlong seven-day validity fixture, a cross-realm SQL fixture, an out-of-range
cancel CAS and the native Promise thenable lookup in a getter trace. Their next
source corrections preserve the original assertions and strict input boundaries.
phase1 proved the earlier Audit scalar-count correction insufficient: both
original populated cases and the independent canonical comparison still failed.
The next candidate retains those expectations and adds failure-only prepared/text
SQL, lateral/scalar phase and plan diagnostics before another production repair.
Passing jobs from this head do not prove those unresolved cases or later changes.

The next authored batch identifies 184 complete and 36 partial requirements across
382 suites. It adds real original Probe public/machine/permit bridge order and
postcommit late-ACK refusal, native Enrollment including actual HTTPS and protected
file failures, complete four-family raw/rollup Telemetry with per-write canonical
MySQL rollback, NativeTunnels/RelayPlans delegation and passive NodeObservations
native clocks/timers/cleanup/projection boundaries. Local TypeScript passed;
functional, database and native execution remain pending the saved candidate's
own Actions. Foundation acceptance and independent physical-host gates remain
unverified; upper product parallelism and release stay closed.

Candidate `927181f22c1ec545629bc64d2398352d500714b6` ran baseline
`39317712487` at checkout `ba86298cbd3e9b45c27364419061d031438e7f04`.
Container workflow `39317711018` passed. Windows, deployment, Probe, Relay
isolation and all 3/4/8-node jobs passed. Contracts recorded 1777 TypeScript passes, 66 failures and 136
conditional skips; Web passed 153/153. The failures identify HTTP expected JSON
record prototypes and malformed-input status, repeated native-global mock
restoration, immutable capacity fixtures and Direct terminal phase/parser inputs.
The next source fixes retain raw parsed prototypes, original error/status mapping,
independent global restoration and all target business assertions.

The same revision's phase1 diagnostics show the scalar JSON_TABLE predicate can
be evaluated before its historical revision owner joins. The original prepared
and text queries both omit expected events, while direct lateral and scalar SELECT
projections match the unchanged populated fixtures. The next private L2 query
repair places JSON table dependencies in the direct join graph and deduplicates
event projections before the existing stable order and limit. Scope, historical
revision/digest and strict STRING/BINARY node predicates remain. Additional native
cases pin multiple matching members/items, empty OR branches and invalid JSON
types. This correction still requires its own exact-source Actions.

The next authored batch identifies 190 complete and 30 partial requirements across
389 suites. It adds original Runtime time/policy/native specialization and SQL
matrices, pure Transit compiler/validator/projector ordering and Agent codec/CLI/
standalone Responder tests. TypeScript checking awaits the active, separate Probe
and Runtime test slices; the 950-file production boundary scan passed. Go formatting
completed; local vet of the two new Agent packages stopped at unavailable cached
dependencies with GOPROXY=off, before a successful analysis result. Functional and
native evidence remains Actions-only. No foundation, physical-host, product
parallelism or release acceptance is inferred from authored assertions.

The next integrated batch identifies 197 complete and 23 partial requirements
across 396 suites. Runtime related-Node closure and Relay historical authority
now include native MySQL lock, limit, credential cutoff and statement rollback
assertions. Probe storage/evidence/permit/qualification matrices pin native SQL,
sentinels, synchronous callbacks, recovery and current value/wire boundaries.
The complete TypeScript check and 950-file production boundary/document-link scan
passed locally. Functional, MySQL and native execution of this batch remains
pending its own saved candidate Actions. No B acceptance, independent physical-host
acceptance, product parallelism or release approval follows from this source map.

The final authored assertion batch identifies 217 complete and 3 partial requirements
across 406 evidence sources. Full structural HTTP provider substitution, all twelve native
management-read SQL methods, disabled optional owner HTTP composition, native
Observation certificate policy, Probe scheduler savepoints and Agent network
fixture roots/load/refusals now have concrete cases. Requirements 7, 192 and 220
remain partial until the final frozen candidate and its applicable execution
evidence are reconciled. The complete TypeScript check, 950-file production
boundary/document-link scan and whitespace check passed locally after freezing
these files. No local functional, database, network or browser test ran.

Candidate b06bb9b3a8ba720c295ba92d4a855df18fce9eb0 ran baseline 39321329524
at checkout 94e76d9dccab16de880715c35f0a8a997f68d2ce;
packaging 39321329530 passed. Contracts reported 1905 TypeScript passes, 3 failures
and 141 conditional skips; Web passed 153/153 and Go build/vet/race passed.
Windows exposed a cancellation-fixture synchronization race. Source corrections
retain the native parsed record prototypes, Relay generation consistency and
completed target EOF before observing counters. Deployment, Probe, Relay isolation
and all 3/4/8-node jobs passed. The four phase1 group failures now have completed
logs: the original four populated Audit cases and all Station/PathGroup tests
passed, while the added Audit case used an empty items array forbidden by native
constraints. Ingress needed original online sessions/current Relay pins; history
needed a closed permit summary and persisted JSON expected prototypes. These
fixture corrections retain their original response, SQL and rollback assertions.
Probe plan inserts still violate the original expiresAt INTEGER JSON constraint
despite valid public numeric input. Failure-only read diagnostics retain the error
and will report exact native JSON types and constraint definitions in the next
candidate. No production schema repair or reduced timestamp was substituted for
that unresolved evidence. This record is not acceptance of the later candidate.

Candidate `8a807f8b72e3854cd2748878f2590fa935b63232` ran baseline
`39324943013` at actual checkout `04a93ed8b7ecc7fa98474a701ed004ac4acca29a`.
Packaging `39324943001` passed. Contracts reported 1942 TypeScript passes,
two failures and 141 conditional skips; Web passed153/153. The two assertions
need native numeric loss counters and a CA fixture with certificate-signing usage.
Windows additionally found duplicate-key canonical error expectations, a
zero-duration load fixture and a lost-ACK target-counter synchronization race.
The source fixes preserve every refusal/cleanup condition and the native zero-time
JSON Infinity error; no production throughput clock/algorithm change is made.

The same revision's phase1 completed: all other configured native SQL, transaction,
recovery, fault and capacity groups passed. Its three finite-plan failures now
have actual failure-only diagnostics: valid expiry1800000060000 is MySQL JSON
UNSIGNED INTEGER, while original probe_plans_chk_7 permits only INTEGER.
[FR-0027](../changes/FR-0027-probe-plan-json-integers.md) records the appended0038
CHECK repair, UpgradeAssessment2 and independent0038 Control profile. All old
profile ceilings/Agent restrictions and historical rows/receipts remain protected.
The new upgrade test uses a reconstructed native0037 schema in an isolated fixture,
then invokes the actual migrator against populated plans/decisions and unrelated
authority/history. It does not claim a historical production database capture.
These new assertions and source changes require their own candidate Actions.
The same old head's Probe, Relay isolation, deployment, unsupported-platform and
all3/4/8-node browser/namespace jobs completed successfully. The failed contracts,
Windows and three plan cases keep that baseline failed; their results cannot
accept the later migration/profile source.

Candidate `be7a48a9334b773b9a3af67cbc14133461e2c74e` started baseline
`39329036507` at checkout `06af13fba8484bea12103b24206283c056443555`.
Its Windows Agent and original unsupported-platform/deployment jobs passed.
A final execution-route audit found two existing unsupported-platform branches
that Linux/Windows success could not cover: actual synchronization provider
selection (case217) and the native execution registry wrapper (case215).
The next routing-only candidate adds these existing tests to the same targeted
macOS job; no production/source contract or new test body changes. This head is
superseded before complete acceptance, and its partial results do not validate
the next saved candidate.

The superseded job's completed log reports1945 TypeScript passes, one failure
and143 conditional skips; Web153/153 passed. The remaining new rejection fixture
replaced UNSIGNED INTEGER in its introductory SQL comment rather than the quoted
literal. The next source change targets the quoted literal exactly, preserving
strict SQL refusal and all original assertions. The routing-only b31a432 candidate
inherits that fixture and is also superseded; no passing result is inferred.

The same source audit confirms all45 database-conditional TypeScript files are
explicitly routed through phase1 with disposable MySQL8.4.9. Linux/getuid and
GITHUB_ACTIONS native tests run in contracts; Chromium/namespace cases have their
named jobs. Evidence IDs E1-E406 include configuration, asset and scenario sources;
they are not406 distinct executed test suites. Actual step outcomes and condition
skips must still be reconciled against the final candidate.
