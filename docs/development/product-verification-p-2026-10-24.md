# P Product Verification - 2026-10-24

The human selected GitHub and requested Actions testing and acceptance of the
prepared P candidate. This authorizes saving/pushing the testing branch, a draft
PR, Actions execution and necessary failure repairs. Merge, image publication,
release and delegation are outside this task. Independent-host and long-run
environments remain unavailable under the human's preceding answer.

## Latest Complete Verification - 69dcaa7

The tested source is `69dcaa710ee0298adde0656674b99c5cb6e1f2b8`, tree
`62cd28b39e8e7e37cce2745c4781827186cac403`. Baseline `40069707791`
completed with all ten jobs successful at 2026-10-24 06:44:01 UTC (14:44:01
Asia/Shanghai); packaging `40069707745` also completed successfully. Actions
checked out PR test merge `62b0b98022dd804c8e1b6fafbc3cec0111b4d405`, whose
tree is identical and whose parents are base `b729a5b` and the tested source.
This is not a merge into main. The cases below are accepted within the PP
coverage/limits table; the complete P goal remains unaccepted.

The full contract collector, generated parity, boundary/type/compile checks,
Linux Go vet/race, Windows and unsupported-platform jobs pass. The principal
contract run has 2307 tests: 2157 passes and 150 database-conditional skips.
Every skipped name matches a passed test in this source's complete native MySQL
job, with zero missing matches, native skips or failures. Web has 231 passes;
deployment-tools has 30. Six-rule Notification target regression, three new
Relay progress parity/input/freshness/expiry/error/override cases and the native
public-port binding case pass. Unchanged Snapshot source-failure and resource-
conflict rollback cases, actual resource Station/outbox membership-revocation
cancellation and the two-observer/exclusive-writer SQL case also pass.

The new PP-10 path case now has actual native SQL evidence, beyond its earlier
bridge contracts. An accepted signed three-node UDP sample (47ms) passes through
the original history reader and locking planner's current binding/issuer
reauthorization, then Station schema3 and original Notification owners. Artifact
`product-p-path-alert.json` in `12550529868` records all four checks passed:

- Failure after actual outbox insertion rolls back Station event/state and all
  seven Notification tables in the same original transaction.
- The valid Forward-target payload persists; immutable-event replay deduplicates
  the original outbox. Recorded outcomes are inserted, inserted, duplicate.
- Advancing only the case's controlled clock by 301000ms makes the latest
  observation unknown while retaining the firing incident, with no recovered
  event or new Probe issuance. This is not an actual five-minute or long-run test.
- Original policy disable cancels the queued delivery with POLICY_CHANGED and
  zero attempts, secret acquisitions or sender calls. This is policy cancellation;
  membership-revocation cancellation is covered separately in native SQL.

The case exposed and repaired the private Notification parser's incorrect Node
requirement for the already declared recent-path Forward rule. No public payload
version, field/order, byte limit or schema is relaxed. FR-0044 separately adds
RelayProgressCoordinator1: original native Runtime explicitly selects same-call,
same-transaction locked input reuse while old advance entries/overrides remain.
Contract evidence verifies three complete reads/four Node-fact passes become
one each on the unchanged-plan case; this is not a latency/SLO certificate.

Actual Direct and two-node Relay TCP/UDP each succeed on their first independent
command with one responder arrival and non-executing expired same-key replay.
Three-node TCP succeeds on its first command. UDP commands one through three
each reach the responder once but have no accepted result; the fourth independent
command succeeds. Status/result calls still reach 236/222ms, with zero connection
acquisition wait in those samples. Do not infer first-command reliability or
production latency improvement. Original deadlines, retry/permit/authority bounds
and failed predecessor observations remain in force and recorded below.

The current Direct Journal sample is used 1024, remaining 1047552 of 1048576
bytes through accepted Report, SQL/API and Chromium, with conservative precharge
and upper-bound-at-sample semantics. Actual desktop/mobile member creation,
self-credential rotation/old-token refusal, six GET rounds and page-change
cancellation pass. Native 3/4/8-node main/browser and separate same-host namespace
fault jobs pass. Signed P Echo remains a three-node sample, not an eight-node
signed Echo or independent-host result.

| Job on 69dcaa7 | Job ID | Final conclusion |
| --- | --- | --- |
| deployment-tools | 120800501332 | success |
| contracts | 120800501493 | success |
| windows-agent | 120800501449 | success |
| unsupported-platform | 120800501223 | success |
| phase1 | 120800501333 | success |
| probe-workflow | 120800501408 | success |
| relay-isolation | 120800501409 | success |
| multihop (3) | 120800501433 | success |
| multihop (4) | 120800501404 | success |
| multihop (8) | 120800501453 | success |
| containers (run 40069707745) | 120800308716 | success |

Artifacts: phase1 `12551660420`, probe `12551520038`, Relay isolation
`12551076754`, multihop 3/4/8 `12550529868`/`12551096683`/`12551660652`,
scan reports `12550766211`, Control/Agent SBOMs `12550243434`/`12550612262`.
The existing scanner gate reports fixable CRITICAL=0 and 11 Control / 17 Agent
HIGH observations. Packaging/refusal/Compose checks pass; no registry image is
published. Main remains `b729a5b`; PR #118 remains open and draft.

Any later documentation-only head is distinct from this tested source/tree;
no exact-head functional CI pass is asserted for that documentation closure.
Independent physical hosts, installation/restore campaigns, reviewed load,
external notification delivery and 24/72-hour environments remain unavailable
or unverified. Parallel features, merge, image publication and release remain
outside the authorized verification task.

## Historical Follow-Up - Path Sample SQL Integration

The continuing P completion audit found that PP-10's recent-path condition had
contract/bridge evidence while the real native Station/outbox rollback case
covered a resource rule. The new existing three-node Actions scenario consumes
an actual signed UDP path result through the original public history reader and
locking planner, then original Station facts/policy/event and Notification SQL
owners. A 15ms delay only in the disposable signed responder makes the sample
exceed a declared 1ms condition threshold; no production deadline is relaxed.

The new case requires actual post-outbox-insert failure to roll back event/state
and all seven notification tables, native payload persistence and immutable-event
deduplication, stale history to stay unknown without recovery or Probe issuance,
and original policy disable to cancel a queued delivery before any attempt,
secret acquisition or sender call. Policy disable is not described as membership
revocation; the separate original native membership-revocation case remains.
Artifacts use the existing `product-p-*.json` upload glob. No new CI framework,
public contract, production owner, network grant or parallel feature is added.

Source/cases and local type/boundary checks are complete; this follow-up is not
functionally accepted until its own exact-source Actions jobs complete. The
deployment handoff now names the last completed source below instead of the
older aae0632f candidate. It still requires actual independent environments.

Initial follow-up `a9e1c4c` ran baseline `40064942481` and packaging
`40064942592`. Packaging/contracts passed, but three-node job `120786090358`
failed before reaching the new alert case: all six TCP commands had zero
responder arrivals (three consumed without a result, three still issued).
Shared JOIN waiting reached 714ms; accepted claims took 348/289/240ms, with
208-306ms in shared Node reads and zero acquisition wait. This failed workflow
attempt is retained, not accepted as a reliability result. A same-job rerun
request was rejected while the containing workflow was still running.

Source review also corrected the new stale-sample assertion before its first
execution: original Station state retains the firing incident while `last.status`
becomes unknown; neither a stale sample nor a missing result recovers it. The
successor asserts both original behaviors without changing production semantics.

Corrected fixture `ecbfa9e` ran baseline `40066060443` and packaging
`40066060549`. The three-node signed TCP/UDP workflows reached accepted results
(TCP third command, UDP sixth), and the original history reader/locking planner
accepted the actual 37ms UDP sample. The new Station/outbox case then exposed a
production defect before insertion: Notification allowed the recent-path rule
but still required every non-operation rule to target a Node. Its valid Forward
target failed with `Invalid bounded notification payload`; the deliberately
injected post-insert error was never reached. Artifact `12548969414` and job
`120789570934` retain this failed evidence, not acceptance.

The private L3 parser repair adds the already declared recent-path rule to the
Forward-target branch. It changes no public version/schema, wire field/order,
payload size, transaction, authority or deadline. A regression checks correct
and opposite target kinds for all six rules, closed fields and exact v1 wire
order; the unchanged new native SQL case must now reach the real outbox insert.

Repair `b6b8627` ran baseline `40066530381` and packaging `40066530200`.
Three-node job `120791098697` accepted the actual signed 35ms UDP sample and
the corrected parser reached real outbox insertion. The deliberate first
post-insert error rolled back event/state and all seven notification tables;
the next transaction inserted successfully. The following duplicate replay
then failed the fixture's transaction identity assertion because that replay
called deliveries directly without entering the tracing handoff wrapper.
Artifact `12549458114` records both inserts and the completed rollback check;
this partial result does not accept the whole candidate. The fixture repair
routes replay through the same handoff wrapper and uses a boolean identity
assertion so a failure never expands a database connection in the public log.
The original native insert/dedup, policy and transaction assertions remain.

Fixture correction `a4d9cff` ran baseline `40066964954` and packaging
`40066964957`. Three-node job `120792371854` again failed its original six-command
TCP workflow before the new alert case. This is retained as an unresolved
availability/locking observation, not hidden by another blind rerun.

The next bounded Actions diagnostic labels original Runtime hello/snapshot/report/
tick and Node relay-credential operations through public method wrappers, keeping
their receivers, arguments and result/errors. It uses public connection thread
IDs and the existing separate fixture admin connection to observe at most 32
lock-wait snapshots after a Probe SQL call has waited 75ms, at most 12 edges per
snapshot. Only closed owner/table/index/mode labels enter the existing 100-entry
trace; SQL text/values, lock data, credentials and raw connections do not.
Timers are cleared on query completion and sampling is enabled only during the
controlled Echo case. Metadata reads do not change authorization or lock modes;
their timing overhead is not a performance improvement or capacity proof. The
diagnostic must identify the blocking owner before a production repair is chosen.
An operation label is emitted only when the same connection-borrow identity
exists before and after the metadata query; released/reused connections are
reported as unobserved, never attributed using a later borrow's owner label.

The 3983abb lock metadata now identifies the actual blocking owners: Probe's
shared runtime_nodes PRIMARY read waits for original Runtime tick, report and
snapshot transactions holding exclusive record locks. Runtime operations also
queue behind each other. The failed candidate's artifact `12549564916` records
these edges; its original TCP workflow failed before the new path-alert case.

[FR-0044](../changes/FR-0044-relay-locked-progress-input.md) was recorded before
adding RelayProgressCoordinator1.progressForNode to the original Relay owner.
It reuses one locked input per multihop deployment/call through original progress,
refresh and plan checks, while rechecking current credential/peer/plan time
bounds. Old advance/advanceForNode and overrides retain the old flow. The native
server explicitly selects the new entry through the existing five-method public
RuntimeRelay port; RuntimeHost4 is unchanged. The compatibility constructor's
optional Relay source type widens to that existing public port without changing
argument positions or valid old calls. No lock, transaction, capacity, authority,
wire, schema, deadline, heartbeat or retry bound changes.

New/old state/write parity, three-versus-one complete inputs, four-versus-one Node
fact passes, next-call freshness, expiry/errors/overrides and deferred native
public binding cases are authored. Local type/boundary checks pass. This new
foundation successor still requires its own complete exact-source Actions;
fewer reads do not establish a latency or first-command reliability improvement.

## Previous Complete Verification - 245d438

The corrected FR-0043 Node Snapshot reader candidate is
`245d438ace32e1a58c39f00c9dca0a5d1d8cc7d4`, tree
`750d32fdd962e7fa7bda4abbb468cf7509f8bf43`. Baseline `40062014210` completed
with all ten jobs successful on 2026-10-24; the last job finished at 04:49:20 UTC
(12:49:20 Asia/Shanghai). Packaging `40062014243` also completed successfully.
The actual PR checkout is `2a66270b73595d135d0a86fb0b20e1128b3c43b4`, with
that identical tree against base `b729a5b`. Its three new Node reader cases
passed, including original projection/input counts, once-only legacy override
dispatch and refusal/error propagation. The principal contract run records
2302 tests: 2152 passes and 150 database-conditional skips. All 150 names match
passed tests in this candidate's native MySQL job, with zero missing matches,
native skips or failures. Web records 231 passes; deployment-tools records 30.
The complete collector, generated parity, boundaries, compile/vet and Linux Go
race jobs passed. This acceptance covers the cases and limits in the PP matrix;
it does not close the complete P goal or independent-environment requirements.

The unchanged native Snapshot source-failure and resource-conflict rollback
cases both pass on this corrected candidate. The new reader's three cases also
pass in the native job. Actual original Station-to-Notification SQL rollback,
immutable-event deduplication and membership-revocation cancellation with zero
sends pass. Two shared budget observers coexist while the original exclusive
writer waits for both transactions to release. These are complete-job outcomes,
not early-step conclusions from the failed predecessor.

Downloaded current-candidate artifacts confirm Direct and two-node Relay each
complete TCP/UDP on the first independent command, one responder arrival per
permit and non-executing expired replay. The current three-node sample needs
three independent TCP commands: the first two each reach the responder once
but have no accepted result; the third succeeds. UDP's first request is refused
with `PROBE_PERMIT_UNAVAILABLE`; its next independent command succeeds. These
are distinct new commands, never repeat consumption of the same permit.

Current three-node SQL attribution still records a 749ms empty poll, including
746ms in the original shared machine-evidence JOIN and zero connection-acquisition
wait. Other samples record 272/230/220ms in that JOIN. The new reader removes
the measured duplicate input read by contract, but these samples do not establish
an improvement in latency or first-command reliability. Retain this limitation
despite every applicable workflow job succeeding. Snapshot input reuse has
contract acceptance; a production latency or first-command reliability gain
has not been demonstrated. Original permit, exchange and result bounds remain.

The actual desktop/mobile Console artifact records member creation, self Token
rotation with old-token refusal, six GET rounds with no seventh read/mutation,
and cancellation on page change. Selected saved screenshots were inspected.
The fresh Direct Journal sample reaches accepted-report-bound SQL/API/Chromium:
used 1024 and remaining 1047552 of 1048576 bytes, conservative precharge and
upper-bound-at-sample semantics retained. This is not an execution grant.

| Job on 245d438 | Job ID | Final conclusion |
| --- | --- | --- |
| deployment-tools | 120777638125 | success |
| contracts | 120777638144 | success |
| windows-agent | 120777638075 | success |
| unsupported-platform | 120777638063 | success |
| phase1 | 120777638081 | success |
| probe-workflow | 120777637895 | success |
| relay-isolation | 120777638074 | success |
| multihop (3) | 120777638044 | success |
| multihop (4) | 120777638056 | success |
| multihop (8) | 120777638080 | success |
| containers (run 40062014243) | 120777364151 | success |

Artifacts: phase1 `12548820243`, probe `12547876577`, Relay isolation
`12548226093`, multihop 3/4/8 `12548540099`/`12548550367`/`12547894728`,
scan reports `12547827046`, Control/Agent SBOMs `12548066313`/`12547911751`.
Scans under the existing policy report fixable CRITICAL=0 and 11 Control /
17 Agent HIGH observations. Container builds, refusal and Compose checks pass;
no registry image is published. Main remains `b729a5b`; PR #118 remains draft.
The actual PR test merge above is not a merge into main. Any subsequent
documentation-only head is distinct from this exact tested source/tree.

Independent physical hosts, reviewed deployment/load campaigns, actual external
notification delivery and 24/72-hour environments remain unverified. Namespace
fault evidence is from the same Actions host. No release or parallel-feature
gate is opened by this bounded case acceptance.

## Previous Complete Verification - fe531cb

The last complete tested source before that successor is
`fe531cb2b55b8e78689c861526d6ef3ce5affd9c`, tree
`75524cc3f9f4fa790e60dcfeca0a093f2aebd0ee`, tested as PR merge
`74a8c5f4d51ff6f036dce7de07f9c5385fb17ffe` with the identical tree against
`b729a5b`. It is not a merge into main and does not validate the new reader.

Baseline `40058076170` completed successfully at 2026-10-24 03:52:21 UTC
(11:52:21 Asia/Shanghai), with all ten jobs successful. Packaging `40058076180`
also passed. Contracts recorded 2299 tests: 2149 passes and 150 database skips;
all 150 names match native MySQL passes on this source, with zero missing names
or native skips. Web recorded 231 passes; deployment-tools recorded 30 passes.
The real Station-to-Notification SQL integration and shared-reader/writer
concurrency cases passed in the complete native job, not just an early step.

Actual Direct/Relay/three-node signed TCP/UDP workflows, account/credential
Chromium flows, Journal-derived usage through SQL/API/Chromium and 3/4/8-node
native/browser plus same-host namespace cases passed. Three-node TCP needed two
independent commands: the first reached the responder once but had no accepted
result, the second succeeded; UDP's first succeeded. Per-permit replay did not
execute again. The retained shared JOIN delays of 676/559/426ms remain real
limitations, not an accepted latency or first-command success-rate guarantee.
Scans under the existing policy report fixable CRITICAL=0 and HIGH observations
of 11 Control / 17 Agent. No registry image, main merge or release is produced.

| Job on fe531cb | Job ID | Final conclusion |
| --- | --- | --- |
| deployment-tools | 120765690062 | success |
| contracts | 120765689946 | success |
| windows-agent | 120765690043 | success |
| unsupported-platform | 120765690021 | success |
| phase1 | 120765689810 | success |
| probe-workflow | 120765690507 | success |
| relay-isolation | 120765689956 | success |
| multihop (3) | 120765689945 | success |
| multihop (4) | 120765690189 | success |
| multihop (8) | 120765690092 | success |
| containers (run 40058076180) | 120765387050 | success |

Artifacts: probe `12545843320`, phase1 `12546423237`, Relay isolation
`12547020122`, multihop 3/4/8 `12546318177`/`12547080275`/`12546867406`,
scan reports `12546515723`, Agent/Control SBOMs `12546665182`/`12546580469`.
Their individual names remain in the Actions artifact index. FR-0043 and all
physical-host/deployment/load/24-72-hour requirements remained separately open
at that point. FR-0043's later bounded acceptance is recorded above.

## Earlier Complete Verification - aae0632f

The earlier tested source is `aae0632f20c1ffc333433b67c72beafc29605e2a`,
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

## Earlier aae0632f Run And Job Index

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
| PP-10 | resource/path contracts; real signed three-node sample through original history/reauthorization into Station and Notification SQL: post-insert rollback, dedup, controlled-clock stale unknown/no recovery, policy-disable zero-send cancellation; separate resource/native membership-revocation cancellation | Stale time is case-clock controlled, not a long run; no actual external notification destination certification |
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

## Post-Acceptance Follow-Up History

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
introduced. Local type/boundary checks passed at proposal time, before Actions.
The earlier `aae0632f` execution did not validate these new assertions. Their
later native acceptance on fe531cb and 245d438 is recorded above. Independent
environments and actual external delivery remain separate requirements.

The follow-up head `9b60b2bf00d0e712d2cb08b1a2628ad56c1d15a7` (tree
`36e59a928b773864c160f629d922cbc06d23e703`) ran baseline `40056410939`
and packaging `40056410944`. Packaging and contracts passed; the native shared
resource SQL step passed before whole-run completion. Three-node job
`120760259039` failed with three issued/unconsumed TCP permits and then no next
empty poll inside the fixture's 15-second observation wait. Numeric artifacts
retain 672-762ms nonempty server operations and original Agent 200ms refusal.
This candidate is not accepted from those partial passes.

The fixture had used a server's completed empty read as the timing origin even
when its completion could be later than the original client exchange. The next
candidate records bounded numeric poll samples (including slow/failed calls),
aligns only from entry of an actual empty read completed within the original
200ms bound, and rechecks fresh qualification once per new empty read. Its
command-free observation wait covers the original 30-second instance cycle;
the six independent-command limit and every production permit, exchange,
result, registration and expiry bound are unchanged. This is not an acceptance
of the failed calls or a heartbeat/load/latency guarantee. The successor needs
its own exact-source Actions result.

Head `b78d17543df25716652dd7f73a16bccbd4c3b61b`, tree
`14a6e5bfb1e0178f60b7481208b9832f55991a06`, ran baseline `40057198297`
and packaging `40057198430`. Packaging and contracts passed, and the real
shared-resource SQL step passed again. Three-node job `120762996168` failed
all six independent TCP commands: one consumed without a result, five remained
issued, and no request reached the responder. The new artifact shows empty
polls taking 241-946ms as well as a 388ms claim. Bounded empty observations did
occur, so this is not only the earlier alignment/observation-wait defect.
No signed TCP/UDP successor pass is inferred.

The next diagnostic uses the existing Actions-only native fixture and the same
public pool/connection methods. Per-call async context separates connection
acquisition wait from SQL/begin/commit/rollback duration, retaining only counts
and the five slowest closed statement families. Trace retention is capped at
100 entries. SQL values, raw statements and private pool internals are never
read into artifacts. Original methods retain their receiver, result/error
identity and original transactions. This adds no production contract, capacity,
retry, heartbeat or deadline change; it is needed to locate the measured delay
before choosing an original-owner source repair.

The fe531cb three-node job and actual TCP/UDP signed workflows passed. Its
artifact records TCP's first independent command reaching the responder once
without an accepted result, its second new command succeeding, and UDP's first
succeeding. SQL attribution shows zero connection acquisition wait on the
slowest empty polls; the machine-evidence shared JOIN consumes 676ms of a
679ms call, 559ms of 562ms, and 426ms of 428ms. This does not identify which
individual joined row is locked and does not prove a production latency bound.

[FR-0043](../changes/FR-0043-relay-node-snapshot-assignment-read.md) was recorded
before adding an original-owner Node Snapshot read. Native Snapshot collection
still called the legacy Relay node reader, which reads each multihop input
twice while the original transaction retains locks. The new separately versioned
reader reuses one input per plan, delegates the same original projection and
preserves the legacy entrypoint's double-input provider/error order. Native
composition explicitly selects the new method. No cache, new authority, table,
heartbeat, connection capacity or deadline change is added.

Public new/old stage/inclusion parity, one-versus-two input counts, typed public
binding, current next-call authority, invalid inputs, session refusal and exact
provider failure cases are authored. Local type/boundary checks pass; no local
functional or SQL test ran. The unsaved successor then required its own saved
source and Actions results; fe531cb's samples could not validate it. The later
failed and corrected successors are tracked separately below and above, without
claiming that all contention is removed.

The first Node-reader candidate `17a9c2af6801bfb94c41c4ad4ac96b4811151800`
(tree `43cc3fc1fd4bd6d45e85cce5d03d2c8ebc57e00e`) ran baseline
`40061168508` and packaging `40061168510`. Packaging/contracts and the
three-node main signed workflow passed, but native job `120774808817` failed
the multihop command/Snapshot atomicity/capacity step. It is not accepted.
The failed original cases are `Snapshot source failure during capacity rolls
back accepted owner changes, reservations, operations and replay` and
`Snapshot source ownership and resource conflicts fail before publication and
roll back preceding coordinator work`. Both report missing expected rejection.
The failed baseline was subsequently cancelled; its successful samples do not
accept it. Source inspection identified an actual compatibility gap: the existing native
rollback/conflict cases override the public legacy assignments method, which
the new entrypoint had bypassed. Keep those native cases unchanged. The FR-0043
amendment precedes a guard that captures the old method once and delegates any
override with original receiver/arguments/result/error before optimized reads.
New owner cases pin one getter access, opaque result identity, wrapped original
provider counts and unknown getter/override failures. Local type/boundary
checks pass; the corrected successor's final exact-source conclusion is tracked
at the beginning of this record.

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
