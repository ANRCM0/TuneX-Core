# P Product Verification - 2026-10-24

The human selected GitHub and requested Actions testing and acceptance of the
prepared P candidate. This authorizes saving/pushing the testing branch, a draft
PR, Actions execution and necessary failure repairs. Merge, image publication,
release and delegation are outside this task. Independent-host and long-run
environments remain unavailable under the human's preceding answer.

## Current Decision

The current tested source is `aae0632f20c1ffc333433b67c72beafc29605e2a`,
tree `9c6efb22ff514d3da22c108377a036c660539da2`. Actions checked out PR test
merge `686f8b9b5e37fb4b029378722b773db0c562cdaf`, whose tree is identical to
the candidate and whose parents are base `b729a5b` and that candidate.
This test merge is not a merge into main.

Baseline run `40052868559` completed successfully on 2026-10-24 at
02:44:54 UTC (10:44:54 Asia/Shanghai): all ten jobs passed, with no failed,
cancelled or skipped jobs. Packaging run `40052868553` also passed. The final
eight-node job includes native/browser main scenarios and separate same-host
namespace partition, delay/loss, every-intermediate restart, report replay,
grant withdrawal and safe resource release. Actions-covered cases on this
frozen source are accepted within the coverage table below. The complete P
goal is not accepted without its remaining independent-environment evidence.

The complete contract collector, vet and Linux Go race passed. Its principal
TypeScript run recorded 2299 tests: 2149 passed, 150 database-conditional skips,
zero failures. Web recorded 231 passes and zero skips/failures. Deployment
preflight/setup recorded 30 passes and zero skips/failures. All 150 skipped
names have matching passed test names in the same candidate's native MySQL
job `120749449908`; missing matches, native skips and failures are all zero.
The new shared-budget observer concurrency case passed, including both reader
releases before the original exclusive writer and clock update can proceed.

Downloaded P artifacts confirm actual desktop/mobile membership, self Token
rotation and old-token refusal, six GET rounds and cancellation on page change.
Direct and two-node Relay each completed TCP/UDP signed round trips with their
first independent command per protocol. Each permit reached the responder once,
and its expired same-key replay did not execute again. Direct's accepted-report
Journal sample was fresh: used `1024`, remaining `1047552` of `1048576` bytes,
retaining the conservative-precharge and upper-bound-at-sample labels through
SQL/API/Chromium.

Three-node TCP's first independent permit was consumed without an accepted
result or responder arrival; its second independent new command succeeded.
UDP's first succeeded. All successful results are stored signed original-owner
results. No consumed permit is retried as new authority. This is functional
success, not a first-command success-rate, latency or capacity guarantee.

Packaging produced local images, SBOMs, Compose checks and scan reports; it did
not publish registry images. The downloaded scan reports contain zero CRITICAL
findings and 11 Control / 17 Agent HIGH observations. These observations remain
visible; a passing packaging gate does not mean vulnerability-free images.

The detailed earlier attempts below retain failed/superseded evidence. They
are not combined into a successful successor revision.

## Exact Run And Job Index

All baseline rows refer to run `40052868559` on the source/test merge above.

| Job | Job ID | Current conclusion |
| --- | --- | --- |
| deployment-tools | 120749449795 | success |
| contracts | 120749449831 | success |
| windows-agent | 120749449747 | success |
| unsupported-platform | 120749449768 | success |
| phase1 | 120749449908 | success |
| probe-workflow | 120749449635 | success |
| relay-isolation | 120749449777 | success |
| multihop (3) | 120749449759 | success |
| multihop (4) | 120749449982 | success |
| multihop (8) | 120749449800 | success |
| containers (run 40052868553) | 120749174361 | success |

Baseline artifacts: `probe-workflow-acceptance` (`12544177859`),
`phase1-acceptance` (`12544349649`), `relay-isolation-acceptance` (`12544142284`),
`multihop-3-node-acceptance` (`12544019499`) and
`multihop-4-node-acceptance` (`12544133799`) and
`multihop-8-node-acceptance` (`12544744070`). Packaging artifacts include
`tunex-vnext-vulnerability-reports` (`12544535332`), Agent SBOM (`12543689358`)
and Control SBOM (`12543664379`). These are Actions artifacts, not registry
publication or independent-host evidence.

Documentation closure is recorded separately from the tested source. Any later
documentation-only commit does not inherit an exact-head CI pass: the accepted
execution remains bound to the explicit source/tree/test merge and run IDs here.
No executable source, schema, public version or source-to-layer path mapping
changes during that closure. A future changed candidate requires its own
verification evidence.

## P Requirement Coverage And Limits

This table maps executed cases to the P plan; a green workflow does not broaden
their assertions or close each requirement's independent environment scope.
Contract tests, real SQL, selected real browser flows and hosted-runner native
process/namespace results are distinct evidence.

| P cases | Executed coverage | Remaining limit |
| --- | --- | --- |
| PP-01/02 | deployment-tools: 30 preflight/setup-plan cases; packaging: role/container refusal, Compose and protected startup checks | No independent fresh-install/operator campaign |
| PP-03/04 | account-credentials contract/HTTP/MySQL and member-console Web cases; real desktop/mobile creation, viewer self rotation and old-token refusal; original Identity/Node/Runtime transaction suites | Selected real browser flows; no new authentication or identity authority |
| PP-05/06 | original Agent Journal/resource usage Go cases, wire/owner contracts, native usage receipt/projection rollback, original shared-resource CAS/history and revoked credential refusal | No long-running debit/report or billing accuracy claim |
| PP-07 | resource-usage Web/HTTP cases for freshness/unknown/legacy states; actual 1024-byte Journal sample through accepted Report, SQL/API and mobile Chromium | Remaining is an upper bound at sample time, never execution authority |
| PP-08 | Echo command/qualification/permit/result contracts, original Go owner/executor cases, native permit/claim/instance MySQL and mTLS, actual Direct TCP/UDP signed round trips | Two-second permit and original exchange/result bounds retained; no availability guarantee |
| PP-09 | actual two-node Relay and three-node signed TCP/UDP Echo; native 3/4/8-node payload/browser main scenarios; same-runner namespace fault cases tracked in the multihop jobs | Signed P Echo is sampled on three nodes, not eight; independent physical hosts remain unavailable |
| PP-10 | resource/path condition and original-principal/transaction bridge contracts; native resource Station event/handoff rollback/dedup in shared-resource MySQL suite; original Station/notification SQL suites | Recent-path new condition is a contract/bridge proof; no actual external notification destination certification |
| PP-11 | task-workflow and Web lifecycle cases, selected real desktop/mobile account/usage flows, six actual GET rounds and page-change cancellation | No exhaustive accessibility/device/offline certification from those selected flows |
| PP-12 | original Path/Ingress/MySQL owner suites, Web batch uncertainty/replay/cancel cases, real Profile batch CAS/lost-response and multihop ordered-copy flows | No cross-rule atomicity, automatic retry or lossless-cutover guarantee |
| PP-13 | setup/container/upgrade/native recovery cases executed in existing Actions | Independent empty-install/retained-state deployment campaign unavailable |
| PP-14 | native process and same-host namespace partition/loss/delay/restart/renewal/revocation cases | No reviewed independent-host fault proof |
| PP-15 | existing hosted-runner bounded capacity/resource samples | No approved topology/load ladder, deployment capacity envelope or 24/72-hour evidence |
| PP-16 | original native backup/recovery, protected Journal/authority, old-reader and partial-migration refusal cases | Independent deployment/backup/restore operator campaign remains unavailable |

The persistent P goal remains active. This verification task does not authorize
merge, image publication, release or unrelated parallel feature development.

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

## Post-Acceptance Coverage Follow-Up

The P completion audit found an achievable PP-10 evidence gap: the resource
Station SQL case used a declared handoff replacement, while the actual
Notification outbox SQL was verified separately. The successor case now joins
the original Station, resource-limit observation and NotificationDeliveries
owners using their real native MySQL stores in the existing invocation.

The authored case throws the original Error after the actual outbox insertion,
checks rollback of the Station event/state and all seven notification tables,
and permits only the original separately committed Station deferral. Success
must persist the real new-rule payload once; replay of that same event must
return the native duplicate outcome. Deactivating the recorded owner membership
must cancel the queued delivery with zero attempts, secret accesses or sender
calls. No Runtime/Journal/foundation/interface changes or new CI framework are
introduced. Local type/boundary checks passed; this successor still needs
Actions. The accepted execution above remains bound to `aae0632f`, not these
new test assertions. Independent environments and actual external delivery
remain separate requirements.

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

## Second Candidate Findings

Head `3ebe3d87770b12dccb8eb961f8335402e341d1d1`, tree
`285a82da718019cebe01f042a49c5c998d208b16`: baseline `40041851092` failed;
container packaging `40041851130` completed successfully. This packaging result
applies only to that head and is not image publication or acceptance of later
repairs. The superseded first baseline concluded cancelled after its failures.

The baseline exposed a remaining parameter property in ForwardProbePlans,
type narrowing/import issues, independently declared HTTP/observation/Station
types and composition fixtures needing explicit P migration, two missing L2
source classifications, and a five-row renderer for the new seven-row matrix.
Repairs retain the independent declarations and old failure/transaction cases.
The native upgrade marker parser now recognizes 0045's equivalent MODIFY COLUMN
ENUM syntax; old schema reader ceilings stay unchanged. The 0041 Agent fixture
uses the current Control profile for the full current schema, without upgrading
the Agent Journal profile or weakening older-reader refusal.

Windows/Linux payload-owner fixtures now provide the one-second usage timeout
and simulate the old Control's missing usage endpoint, so the original Journal,
renewal and drain tests exercise extension failure without changing report ACKs.
No P functional/MySQL/network/browser/container tests ran locally.

## Third Candidate Findings And P Execution Coverage

Head `77a408ace73a11d725360d43fa27f9f5b9af77d8`, tree
`04995cd9c02c0dce9e2928e58cbe703c119da2b3`: packaging `40042838827` passed.
Baseline `40042838357` has a failed contract job `120717639608`; other jobs were
still running at this repair snapshot. Types, generated parity, Web and source
boundaries passed. Five contract failures remained: the distinct node-store
instance expected by the updated composition, a changed sample fixture needing
a coherent invocation digest, and old assertions treating qualified v4 as an
unknown marker or refusing it before current authority checks. Native MySQL
also exposed old successor-migration counts and a Control profile ceiling in the
SELECT-only upgrade fixture. Repairs keep the original transactional refusal,
CHECK replacement and old-reader/executor rules.

P-specific execution coverage now extends the original Actions fixtures:

- `scripts/phase2/product-p-console.ts`: real HTTPS/SQL/Chromium member creation,
  viewer-only visibility, self Token rotation and old-token refusal, desktop and
  mobile screenshots, six actual ten-second GET rounds and page-change cancel.
- `scripts/phase2/product-p-observation.ts`: fixed-size loopback signed responder
  with one published context, current expiry and nonce identity, real original
  permit/Agent/Forward TCP and UDP exchange, historical proof and non-executing
  same-key replay; Direct, two-node Relay and three-node multihop separately.
- Direct shared-node quota: original policy/Journal precharge -> accepted report
  -> optional mTLS usage endpoint -> native SQL projection -> real API and mobile
  Chromium view, retaining sample freshness and conservative accounting labels.

The P fixtures run only under explicit `TUNEX_PRODUCT_P_ACCEPTANCE=1` on the
existing hosted Actions jobs; the independent namespace variants keep their old
scope. Exact redacted P JSON/screenshot paths are included in original artifact
allowlists. Their responder is a test fixture, not standalone Responder delivery,
physical-host proof or long-run/load acceptance. The new result-ACK case also
catches a real closed-v4 codec defect: an extra checkedAt and missing health
field after persistence. The adapter now matches the existing response schema.

All new/changed cases require another exact-source run. No local functional,
MySQL, network, browser or container execution has been substituted for Actions.

## Fourth Candidate Findings

Head `3169b7dd30df0a812f6a97871794ad5cda0c9bc4`: packaging `40044185621`
passed; baseline `40044185486` was cancelled after confirmed failures. The
independent Windows, unsupported-platform, deployment-tools, Relay-isolation
and four-node multihop jobs passed before cancellation; these results do not
accept later source. The contract collector found UUID default-parameter type
inference narrower than the shared fixture's string key contract. Explicit key
annotations preserve the original request and replay values.

Real Probe found original TCP connect results missing after enabling v4:
the result builder required nonce evidence for every measurement. Native v4
projection now retains original connect/ingress/TLS evidence and delegates nonce
kinds to their original builder. Common result projection skips the old v1-only
validator for a v4 receipt; the final closed v4 validator remains mandatory.
Regression cases cover all seven measurement points, wrong family/evidence,
injected TLS clock, mismatched pin and expired service context. The original
legacy validator and existing result compatibility entry remain unchanged.

Three-node signed Echo reached no responder and timed out waiting for fresh
qualification. Its next fixture records only public qualification/poll/claim/
status/result outcomes and receipt state, preserving original method receivers
and failure identity. It stores no credential, service key, nonce or request
body. No path pass is claimed from these failed artifacts.

## Fifth And Sixth Candidate Findings

Head `b93c9fb4b964891d564425935f9494be5290db79`, tree
`0f12ecc9a3dcac4adbf848b5c062530d1ed70b7f`: baseline `40045886863`, packaging
`40045886873`. Packaging and the complete contract job passed. The baseline was
cancelled after three-node Echo failed with all six receipts still issued.
Its diagnostic SQL attempted unsigned `snapshot_generation - 7`, masking the
original failure before the failure artifact could be written. The fixture now
casts to a signed value before applying the zero floor, and independently
preserves redacted P trace metadata. Local Go test-binary
compilation passed without executing the binary. Local TypeScript checking
could not start because dependencies are absent; Actions remains the execution
source. No local functional/MySQL/network/browser/container test ran.

Head `99f5d1645025cf0319172e1f45ce433acdaebf78`, tree
`aed922d49e00e68d2bfb9ed934558fb444fc84c2`: packaging `40046394665` and contract
job `120729313245` passed; baseline `40046394624` was cancelled after failures.
The real Probe fixture passed the original zero-payload workflow, historical
Chromium receipt and non-executing replay. Its P Console JSON passed actual
member creation, owner/viewer isolation, self-token rotation with old bearer
refusal, desktop/mobile views and the six-round refresh/page-change cancellation.
Direct Echo then hit a fixture-only matrix-version mismatch: Direct deliberately
retains capabilityVersion 1 while path modes use 2. Its assertion is corrected
without changing the product matrix contract.

The three-node artifact now shows successful original qualification and
server-side nonempty poll responses but no claim. The next candidate adds only
opt-in diagnostic stage names at local v4 poll refusal, preserving failure
identity, limits and authorization. These observations are not a path pass.

## Seventh And Eighth Candidate Findings

Head `ac99932f08e5dda84b83184084f57e55723adee9`, tree
`c76e4b105df1d356900b1d4d86971aca14279cb8`: baseline `40047203942`, packaging
`40047203910`. Packaging passed; baseline was cancelled after the three-node
and Direct fixture failures. Temporary opt-in Agent stage logs narrowed the
nonempty three-node poll refusal to its existing deadline checks, without
changing error identity or limits. Direct keeps five matrix rows as well as
capabilityVersion 1; both fixture assertions now match that original contract.

Head `714830f56bf06751e746e2bffbbb532f150b0735`, tree
`2d73e1ec0a2b83f21bf8e0d7f69e275259170d8f`: baseline `40047738714`, packaging
`40047738592`. Packaging and Probe/Relay job `120733322522` passed before
baseline cancellation. The P Console artifact passed; Direct and Relay each
completed TCP and UDP signed original-permit/Agent/Forward/responder/result
round trips on their first independent command per protocol. Each responder
received exactly one request; the expired same-key replay caused none.

Direct's actual accepted-report-bound Journal sample was fresh, used `1024`
bytes and retained `1047552` of the `1048576` byte limit, with the conservative
precharge/upper-bound-at-sample labels. The API and real Chromium usage view
passed. These are hosted-runner process results, not external reachability,
physical-host, billing accuracy or long-run proof.

The fixture now observes one real empty poll and issues a new explicit command
before its next original one-second discovery round. The two-second permit,
clock-skew subtraction, once-only claims and result windows remain unchanged.
Three-node Echo still failed with six issued/unconsumed permits, so it is not
accepted. Its next diagnostic records only numeric remaining/freshness/elapsed
timing; the earlier verbose stage instrumentation was removed.

## Ninth Candidate Findings And FR-0041

Head `7f95504190e8b9b979465019a8ea802f388b36a8`, tree
`f01bb65cfcd48a681cf99757cbc9a2199a36699b`: baseline `40048385560`, packaging
`40048385271`. Packaging, contracts, Probe/Relay, Windows, unsupported platform,
deployment tools, Relay isolation and four-node jobs passed. Three-node Echo
failed, so the candidate is not accepted; remaining jobs were still running at
the corrective-source snapshot.

Three-node public timing metadata shows permit lifetimes of 1569-1736ms and
server-side nonempty discovery with only 1042-1298ms remaining on early offers.
The old node-scoped Relay read revalidates every related Forward's whole path
for each of the planner's nodes. This duplicates complete path authorization
and SQL reads inside the original 200ms transport/250ms observation windows.
No deadline or authority bypass is introduced to make this scenario pass.

[FR-0041](../changes/FR-0041-relay-forward-assignment-read.md) records the additive
original-owner Forward read and optional native Probe binding before source
implementation. The old entrypoint retains its original projection via one
private shared helper; each new call authorizes one original plan and still
checks every node's original session and deployment stage. No cross-call cache
or unrelated Forward scan is added. Public owner/provider and legacy-parity
cases are authored. The final candidate retains opt-in numeric Agent timing
diagnostics for P troubleshooting: only with Diagnostics and ProbePathEcho,
only at existing refusal paths, without keys, IDs, bodies or extra authority.
They do not alter deadlines or error handling. Fixture metadata remains redacted.

After dependency installation, local TypeScript checking, source/type/private
boundary classification and Web syntax checking passed on the corrective
worktree; generated parity remains separately recorded when complete. No local
functional, database, network, container or browser test ran. The successor
requires a new exact-source Actions run, including the three-node round trip.

## Tenth And Eleventh Candidate Findings

Head `6ab606186d393d6ac492a882d73c2955edc23a5a`, tree
`bb7730500867edc4a3f6b4248a09159592a7e31d`: baseline `40049516529`, packaging
`40049516450`. Packaging passed. The new owner/provider contract cases passed
inside the collector, but the exhaustive public-version inventory omitted the
new independent counter and failed; its explicit entry is now added rather
than weakening the exhaustive comparison. The baseline was superseded after
three-node failure; its shorter new permit planning retained 1815-1874ms life
but still produced no accepted result.

Head `646d749d3b66c89a88551b8f62ccfec7799c3e84`, tree
`5c628e367f20480a61d076e9b32a9238777279b1`: baseline `40049988705`, packaging
`40049988660`. Three-node numeric evidence confirms 458-651ms server poll
handlers and Agent exchange refusal at 200-201ms. Faster calls reached original
claim and status, but status also sometimes exceeded the transport bound, so
there is still no signed path pass. The empty-poll observation wait is bounded
to 15 seconds to allow original registration rotation; it sends no command or
permit during that wait and changes no production deadline.

FR-0041's pre-implementation amendment records a further single-call input
reuse for the new Forward reader: original resource validation and immutable
plan checks consume one set of original locked multihop inputs in the caller
transaction. Legacy node reads retain their old two-read/provider order. Both
paths use the original recognized-denial classification and propagate unknown
provider failures. No authority or input is cached across calls. New owner
cases assert exactly one Node authorization per path node for the new reader.
Corrective local TypeScript/boundary checks passed; Actions on the successor
must validate the changed functional behavior.

## Twelfth Candidate And FR-0042

Head `a0e5671b4004c14d8a4b3cb097edcd0ca25ea9b0`, tree
`d703449a7cb93d7e4ffb60d830874d9c9f3e9461`: baseline `40050691506`, packaging
`40050691428`. Packaging and the complete contract job passed, including the
new Relay owner/provider cases and explicit independent counter inventory.
Probe/Relay, isolation, Windows, unsupported platform, deployment tools and
four-node jobs passed; phase1/eight-node remained in progress at repair time.
Three-node Echo remained unaccepted: early poll/claim could complete, but
server-side operations still sometimes took 247-504ms and lost their original
200ms exchange window. No hard limit was expanded.

[FR-0042](../changes/FR-0042-probe-budget-observation-read.md) was recorded before
adding the original storage's separately versioned shared observation port.
Discovery/status previously used the one global exclusive budget lock even
though they reserve and mutate nothing, serializing independent Node readers.
The native root now explicitly supplies the same original lower store as the
optional observation provider; legacy constructors retain their old provider
contract and exclusive calls. Existing overridden lock methods remain honored.
Only the non-executing offer/check paths use the supplied shared reader. All
state changes, clock updates, withdrawal/history writes and recovery remain
with the original exclusive owner/lifecycle paths.

Authored cases retain exact bounded SQL/decoders, no reader fallback after
failure, untouched legacy provider lookups, exclusive writer selection and
same-object native composition. An actual migrated MySQL case in the existing
native invocation allows two shared readers, requires the writer to wait for
both releases, and then permits the original clock update. It has not run
locally. Corrective local TypeScript and source boundary checks passed; the
successor still requires exact-source Actions execution.

## Thirteenth Candidate And Historical Receipt Observation

Head `18105af38f6a8924dd8423d662fb06087d8ea4b4`, tree
`85c9d077f9f4f0a203bfc397bea390155db136d7`: baseline `40052224843`, packaging
`40052224851`. Packaging passed; the contract collector passed before Go race
finished, and Probe/Relay plus native Windows/deployment/unsupported jobs
passed. The full job conclusions remain separate. Three-node nonempty poll
timings fell to 112-161ms and original consumption occurred, but claim calls
still sometimes exceeded 200ms. No signed path pass is inferred.

The fixture was also querying historical permit receipts every 50ms during
execution. That original management read intentionally retains an exclusive
budget lock; this cadence adds active contention absent from the product's
bounded ten-second refresh flow. The next fixture waits until the unchanged
finite permit expires, then reads its retained historical receipt once. It
still requires a stored signed result, exactly one responder request and the
original expired same-key replay without reexecution. It asserts expired=true
at that read. It neither extends result acceptance nor changes the production
management read. Aggressive management-read contention is not accepted as a
load result from this functional scenario; failed earlier artifacts remain.

## Acceptance Limits

Source preparation is delivered in the [P ledger](product-readiness-stage-p-2026-10-24.md).
The [deployment runbook](product-p-deployment-acceptance.md) retains PP-13 through
PP-16 environment obligations. Same-host namespaces and hosted-runner containers
cannot prove independent physical hosts, real deployment capacity or 24/72-hour
stability. No such result is claimed; no main merge or registry publication is
part of this verification task.
