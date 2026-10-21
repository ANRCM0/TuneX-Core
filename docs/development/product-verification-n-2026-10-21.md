# N Product Verification - 2026-10-21

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
attached to draft PR #114. There is not yet an accepted N source revision.
Historical B/C/D passes are not reused for N.

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

## Actions Preparation And Pending Evidence

The existing baseline workflow now imports the public shared resource provider
example and explicitly executes
`apps/control/test/shared-resource-limits-mysql-acceptance.test.ts` in the
disposable MySQL phase1 job. It must run with `TUNEX_TEST_DATABASE_URL`; a skip
without a database is not SQL evidence. Existing TypeScript/Web/Go globs include
the new N consumers and payload cases.

Pending on a saved and pushed N source revision:

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
publication or release has occurred in this task. The next step is to save and
push the repaired candidate for the configured Actions workflow. Container
packaging is build evidence, not image publication or release. The local checkout
baseline cannot stand in for the source actually executed there.
