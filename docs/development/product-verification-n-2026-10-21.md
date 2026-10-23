# N Product Verification - 2026-10-21

This document preserves the source-authoring and run-by-run evidence snapshots.
Terminal outcomes after its latest documentation revision are recorded in draft
PR #114's Verification section and the checks for that exact head. Pending wording
in a dated repair section describes its authoring point; it is not a substitute
for the later run's recorded source, merge checkout and job conclusions.

## Authorization And Source

The human authorized testing with "好，开始进行测试" after the N source handoff.
The repository agreement keeps local verification to static/type/boundary,
generated parity, formatting and compilation/vet. Functional, MySQL, network,
container and browser evidence belongs in GitHub Actions. Failure repairs are
part of this verification task; commit/push, merge and release remain separate.

The working checkout is `D:/my-project/TuneX-Core`. The source handoff started
from `01b264509a0aa50a261b8cb2cf0b866c282f9818`; that historical baseline is not
N acceptance. The human subsequently approved saving and pushing the candidate to
`verify/n-product-20261021`, creating a draft PR and executing Actions, with
necessary failure repairs. Merge, image publication and release remain outside
this authorization. Candidate and actual tested revisions will be recorded
separately as the runs complete. The first saved N candidate is
`6bf8e3cf03fd4c0eff7139bac37538ff08ddbd2f`, pushed on that testing branch and
attached to draft PR #114. The fourth candidate below passed the configured
verification scope on October 21; its evidence was reconciled on October 23.
Historical B/C/D passes are not reused for N.

The October 23 documentation-head rerun exposed a Relay recovery fixture failure
described below. Its repair requires its own saved-source Actions conclusion;
the fourth candidate's earlier pass is retained with its original identity.

## Local Checks

| Check | Actual result | Scope |
| --- | --- | --- |
| `npm run typecheck` | Passed after repairs and consumer integration | Full configured TypeScript production, tests, examples and acceptance scripts; final complete run exited 0 |
| `npm run contracts:check` | Passed after regeneration | Go mirrors, schemas and existing stateless/multi-hop/Transit/Probe fixture parity; this is not network execution |
| `node scripts/check-boundaries.mjs` | Passed after repairs | 984 classified production files, source imports/types/native restrictions and existing documentation links |
| `node scripts/check-web.mjs` | Passed | Syntax of 44 production JavaScript files; no DOM or browser execution |
| `GOARCH=amd64 node scripts/run-go.mjs build ./...` | Passed | Windows production compilation |
| `GOARCH=amd64 node scripts/run-go.mjs vet ./...` | Passed | Windows production and test-source analysis; no test execution |
| Linux/macOS amd64 cross-compilation | Passed | Compilation only; no native OS or physical-host evidence |
| `git diff --check` | Passed after the trailing-space repair | Tracked candidate diff; not an acceptance test |

Runtime versions used locally: Node 24.14.1, npm 11.11.0 and Go 1.26.3.
The installed Go default is windows/386, so every Agent command explicitly sets
`GOARCH=amd64`. Exit status is recorded per check; a failed first run is not
relabelled as a pass before the corrected source is checked again.

## Repairs

- Regenerate the execution schema and Go mirrors with the existing generators.
  Handwritten formatting and declaration placement differed from their output.
- Replace unsupported TypeScript constructor parameter properties with explicit
  fields and assignments so Node's strip-only execution can load the candidate.
- Keep Runtime's stop-only canonical comparison in the existing domain decision;
  remove lower-layer JSON serialization. Validate payload identifiers by pure
  byte rules and classify the public provider example as an ordinary L3 consumer.
- Correct Ingress deployment/migration paging types, the required HTTP Probe
  capability provider, Forward's inherited record declaration and the native
  Node authorization Forward context. Retain the original Runtime ledger,
  caller transaction, ownership, authority and protected Journal histories.
- Migrate failing test consumers to the current public contracts without adding
  permissive `any` providers or removing the original rollback/error assertions.
  The original three named agents edit only their assigned independent test
  files; MAIN integrated 28 changed test files serially against current production
  source. Final integration also removed a duplicate type import and added the
  missing `resourceLimits` member to the independent Control API type assertion.
- Format changed Go files and repair the reported Web trailing space.

Public integration corrections are recorded in FR-0030/0031 and remain within
the already declared N successor versions. This verification does not widen the
historically accepted foundation or open parallel feature development.

All local checks in the table have completed successfully on the corrected dirty
candidate. The final typecheck includes all three consumer deliveries. Boundary
classification and Web syntax were checked again after their integration. No Go
source changed after the successful formatted build/vet and cross-compilation;
no schema or generated source changed after the successful parity check. The
subsequent edits only record these results. This is local static evidence, not a
functional acceptance decision or an exact-source Actions result.

## First Actions Candidate

The pull-request baseline run `39537586934` reports head
`6bf8e3cf03fd4c0eff7139bac37538ff08ddbd2f` and concluded failure. The separate
container packaging run `39537586882` on that candidate passed. Deployment
tooling and unsupported-platform jobs passed. Contracts, Windows Agent,
phase1/MySQL, Probe workflow, multihop (3/4/8) and Relay isolation failed.
These results do not accept N; later repairs require a new saved source/run.

The first failure analysis identified:

- Forward state projection included `ownerActorId` in domain-only readers.
  The closed Core parser correctly rejected it during Direct capacity checks,
  updates, retry/removal and Transit staging. Restore pure Forward values for
  writer/runtime/reference ports and retain ownership on public `get`/`record`
  reads. Keep Core validation and original success/rollback assertions.
- Exact SQL, public interface/version, Node ownership, purpose and limit policy
  consumers still described the pre-N contracts. Migrate those consumers with
  explicit ownership and authorization fixtures, preserving transaction receivers,
  argument order, original error identity, rejection and rollback checks.
- Go dispatch assertions still targeted unmetered native engines and omitted the
  new payload gate/Journal host members. Check the actual metered calls and gate
  identity; an empty datagram still checks policy with a zero-byte debit.
- Browser login still filled the former scope input. Authenticate first, discover
  the account's legal workspaces, then select the requested workspace. Shared
  Node withdrawal fixtures must explicitly provision shared Nodes and grant use;
  private ownership is not a grant-compatible shortcut.

The first repair set is integrated on the testing branch. Full TypeScript
typecheck, Windows amd64 Go vet, the 984-file boundary check, 44 production Web
script syntax checks and `git diff --check` passed after integration. Generated
sources and schemas did not change in this repair set. No functional pass is
claimed before the next saved-source Actions run. Functional/MySQL/network/browser
tests remain Actions only.

## Second Actions Candidate

The repaired source `7854ad76ac7df5016bad09e75f28a9b5dbfdb852` was pushed to
draft PR #114. Baseline run `39540041708` reports that head and checks out the
temporary PR merge `5ad65786cc0945f0717e2cbce81df84aba911992`, joining it to
`bc8507b765a84ef6a9607df8c2ea8531a71a71c9`. Container run `39540041645`
passed on this candidate. This is a subsequent source, not a relabelling of
the first run.

The contracts job completed with 2,255 tests: 2,105 passed, three failed and
147 were skipped in the no-database job. All three failures came from the
3/4/8-Node coordinator consumer missing `reservationPorts`. Its replacement
fixture now asserts the original transaction, actor, scope, endpoint ports,
purpose role and full stored Forward context while retaining the pure domain
projection and original denial assertions. The 206 Web tests, Linux Go tests
and race run, static checks and offline parser integration passed in Actions.
Windows Agent, unsupported-platform, deployment tooling, Probe browser workflow,
Relay isolation/capacity/rotation and the 3/4-Node multi-hop jobs passed.

The completed MySQL job failed only in Path binding acceptance and the legacy
phase1 script; all its other acceptance steps completed successfully. Path
binding exposed a production regression: an N authorization change required
online execution readiness even for disabled path edits. The native L3 adapter
now checks every Node's product use, role and port policy for disabled edits,
without an online Relay check or plan publication. Enabled edits retain full
execution validation, and pure stop-only changes retain their existing path.
The original MySQL success/rollback assertions remain, with an added adapter
regression for offline edits, exact context and every provider failure cutoff.

The legacy capacity fixture inserted a Node with the old defaults, which now
means unclassified; Actions confirmed a 404 before the expected 429 byte-capacity
refusal. The fixture now declares the intended private owner explicitly,
preserving the original capacity refusal and rollback checks. Full local
typecheck, the 984-file boundary check and diff checks passed after these repairs.
The repaired source still requires the next Actions revision. No N acceptance
is declared while these failures or their retests remain unresolved.

## Third Actions Candidate

Source `3168f87a2f120bb2623f8b5a7813d3b19370c810` was pushed for baseline run
`39542864180`, whose checkout is PR merge
`0ec319c667d66c0f3764ecc8107076470970bec4` against the same
`bc8507b765a84ef6a9607df8c2ea8531a71a71c9` base. Container packaging run
`39542864333` passed. The contracts job passed: 2,256 TypeScript tests, 2,109
passed, zero failed and 147 conditional database skips; all 206 Web tests and
Linux Go/race checks also passed. The added offline-edit adapter regression and
the coordinator consumer tests passed. These conclusions belong to this source.

The run completed with eight jobs passed and two failed: MySQL phase1 and the
8-Node Console job. All MySQL integration scripts, including capacity, security,
faults, recovery and the real Relay paths, passed. Its test invocations totalled
411: 410 passed, one failed and zero skipped. Matching all 147 skipped test names
from contracts against MySQL's passed names accounts for 146; the remaining name
is exactly the failed Path binding acceptance, not an accepted skip.

Path binding reached its SELECT-only viewer assertion at line 167. The exact
failure was 403 versus the expected 404: a `targetRevision` reference query first
requires management permission. The successor fixture expects 403 for that
query and separately asserts 404 for an ordinary reference read, preserving
hidden-resource coverage, the SELECT-only inventory check and prior concurrent
CAS, quota and rollback assertions.

The 8-Node browser failed while enabling its second Forward after 120 seconds.
The uploaded failure evidence contains a running Operation with no error and
the same deployment generation advancing through ordered preparation and
activation. In particular, egress prepared at 04:28:33Z, ingress prepared at
04:29:35Z, egress active at 04:29:45Z, then three further Nodes became active
through 04:30:11Z before the 04:30:21Z observation timeout. This is not evidence
of a 120-second stall or a production safety defect. The isolated 8-Node step was
skipped after the browser failure and cannot be counted as passing.

The repair leaves production authorization, fresh-report and tail-to-head
activation unchanged. Only the 8-Node browser Operation observation uses a
four-minute total ceiling, capped by that Operation's original execution
deadline, while retaining a 120-second no-topology-progress ceiling. Only higher
prepared/activated counters on the same Operation, revision and deployment
generation refresh that progress ceiling; renewed Snapshots do not. Other path
sizes keep their two-minute observation limit. Terminal refusal, full readiness,
actual TCP/UDP, reservation and cleanup assertions remain. Per-Operation elapsed
times and cursor samples are retained in successful evidence; failure evidence
now includes safe Operation/deployment timing and counters. This does not accept
latency or replace the separate load baseline gate. The next saved-source run
must verify both repairs and every configured job again.

## Fourth Candidate: Configured Verification Complete

Evidence reconciliation date: 2026-10-23 (Asia/Shanghai). The runs completed on
2026-10-21. No newer source is substituted for these tested revisions.

| Identity | Verified value |
| --- | --- |
| Candidate branch | `verify/n-product-20261021`, draft PR #114 |
| Saved source | `6c514989820beee0a3387c5368df81e9b4fc2410` |
| Actual PR merge checkout | `b2a82e02ac072b71486e0e5d611f4fb0e69e6c3e` |
| Base | `bc8507b765a84ef6a9607df8c2ea8531a71a71c9` |
| Baseline run | `39545757485`, success, all 10 jobs passed |
| Container packaging run | `39545757607`, success, no image publication |

All job steps completed successfully without a skipped acceptance step:
contracts, phase1, Windows Agent, unsupported-platform, deployment-tools,
Probe workflow, Relay isolation and the 3/4/8-Node multi-hop jobs. The container
packaging job also passed. Full logs confirm the same merge checkout in
contracts, MySQL and the 8-Node job.

- The full TypeScript suite reports 2,256 tests: 2,109 passed, zero failed and
  147 conditional database skips. All 147 names were matched individually to
  passing tests in this run's MySQL job; none remains unaccounted for.
- MySQL test invocations total 411 passed, zero failed and zero skipped. The
  original Path binding case now passes through its concurrent CAS, rollback,
  quota, archive, permission ordering and SELECT-only assertions.
- All 206 Web tests pass without skips. Public examples, complete configured
  static/generated checks, Linux Go tests/vet/race and the Windows Agent checks
  pass. Compilation on another target is not execution on that physical OS.
- The phase1/phase2, security, faults, access, transport, native Relay, switching,
  recovery and capacity integration scripts pass. The shared-limit MySQL case
  runs explicitly with a disposable database, including CAS/replay/history and
  post-write rollback. Payload gate, Journal and Runner cases run in the Go suite.
- The 8-Node browser completes ordered copy, immutable Profile selection,
  explicit enable/disable/delete, fresh preview, actual bidirectional TCP/UDP,
  reservations and cleanup. Its following isolated-namespace step also passes:
  interior partition/loss/delay, intermediate restarts, old Report replay,
  grant withdrawal and offline-lease deletion. These use one Linux runner.

Decision: the repaired N candidate is verified within the existing configured
Actions scope at the saved source and merge checkout above. This closes the
authorized candidate verification task, not every deployment or performance
claim in the product roadmap. The previous three failed runs remain historical
failure evidence. This documentation follow-up changes no production, contract,
test or workflow source; it records the tested candidate rather than relabelling
the documentation commit as that candidate.

## October 23 Follow-up: Peer-expiry Recovery Fixture

Documentation-only head `bdf3ed5d185a62589b0e662d535b309d6f64de69` triggered
baseline run `39954482284` and container run `39954482511`. Container packaging
and contracts passed; Relay rotation failed at `relay-capacity.ts:248` while
restoring two-Node readiness after real ingress peer expiry. This subsequent
failure is retained even though the same implementation passed the fourth run.

The uploaded evidence shows that egress received poll HTTP 403, then logged
`Agent authorization ended: LEASE_EXPIRED` and exited. Runtime Relay's original
fixed-pin bound checks every path peer; an expired ingress pin can deny egress's
next publication too. The original Runner retires its session on poll 401/403,
then its independent ticket guard closes execution at expiry and exits. Existing
contract tests explicitly require expired-pin refusal. The fixture restarted
only ingress and assumed egress was still running, so waiting longer cannot
restore the missing process.

The repair preserves that fail-closed production contract. During the bounded
recovery wait it restarts egress at most once, and only after a nonzero exit with
the explicit `LEASE_EXPIRED` guard log. It first checks that the expired peer's
Relay listeners are closed, reuses the exact original state/Journal/arguments,
and requires a higher egress session after restart. Both original real expiry
and fresh TCP/UDP assertions remain, as do the two prior live rotation windows
without restarting either Agent. Evidence records whether the peer restarted and
its before/after sessions. No certificate/time injection, expiry extension,
history reset or permissive production behavior is introduced. This repair is
pending its next exact-source Actions run.

The same documentation-head run completed with eight successful jobs, one failed
Relay job and one cancelled 8-Node job. MySQL again passed all 411 invocations
without skips; all 147 contracts database skips matched its passed test names.
The 8-Node browser completed successfully. Its following namespace step continued
through real partition/loss/recovery and every intermediate restart, then the
runner cancelled the job at its 35-minute overall ceiling. GitHub's annotation
explicitly reports that job timeout, not a scenario assertion failure. The
remaining namespace checks cannot be counted as passed for this run.

The CI follow-up assigns only the 8-Node job a 45-minute overall budget; the
3/4-Node jobs retain 35 minutes. This accommodates two sequential full lifecycle
scenarios on a shared runner. Every scenario assertion, inner observation and
no-progress deadline, actual lease/credential limit and protected-history check
remains. This is an acceptance execution budget, not a relaxed production
deadline or performance acceptance. It must be verified with the recovery fix
on the next pushed candidate; no cancelled step is relabelled as successful.

The first recovery-fix rerun at `a9f4b9d` passed Relay rotation, but its evidence
recorded `peerRestarted:false`: egress remained alive that time. That positive
case does not execute the new restart branch. The follow-up makes the same
offline-expiry scenario deterministic by holding only egress's real Snapshot
response before stopping ingress. The original 100ms guard must then expire
the actual issued lease and exit; no clock, expiry, certificate or production
authorization value is replaced. After genuine peer expiry, release the response
gate and restore the original provider, then require the confirmed restart branch
and a higher egress session. A finally block releases the gate on failure as
well. The original two live rotation windows remain untouched. A new Actions
artifact must show `peerRestarted:true` and real TCP/UDP recovery before claiming
that the previously failing branch is exercised.

## Acceptance Scope And Remaining Gates

The existing baseline workflow now imports the public shared resource provider
example and explicitly executes
`apps/control/test/shared-resource-limits-mysql-acceptance.test.ts` in the
disposable MySQL phase1 job. It must run with `TUNEX_TEST_DATABASE_URL`; a skip
without a database is not SQL evidence. Existing TypeScript/Web/Go globs include
the new N consumers and payload cases.

The fourth candidate supplies configured evidence for:

- Complete owner/contract, Web, Go, race, unsupported-platform and public example
  tests, with exact job/step conclusions and conditional skips reconciled.
- MySQL migrations 0039-0041, ownership/visibility, CAS/replay/history/rollback,
  limit policy publication and upgrade/downgrade refusal.
- Native TCP/UDP and Direct/Relay/multi-hop execution, persistent payload debit,
  restart, shared aggregation, exhaustion, period boundaries and old drain limits.
- Chromium, mTLS, security, recovery, capacity, namespace and container acceptance
  through their existing Actions jobs; independent physical hosts, long-run/load,
  actual installation, image publication and release remain separate gates.

No local functional/MySQL/network/browser/container tests, merge, image
publication or release has occurred in this task. Independent physical hosts,
long-run/load, actual installation and operational deployment remain unverified.
Online payload consumption/remaining balance remains unavailable as declared;
manual enrollment guidance is not an installer acceptance. Container packaging
is build evidence, not image publication or release. No protected Journal,
authority history or Runtime ledger was reset to obtain a pass.
