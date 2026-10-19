# Foundation Verification Candidate - 2026-10-19

## Authorization And Scope

The human authorized organizing the complete A5 candidate, testing and pushing on
2026-10-19 ("整理一下。进行一下测试和推送"). This opens the verification and
commit/push gates for this candidate. The earlier explicit authorization for
parallel agents continues for bounded verification repairs. Product-module
parallel development, merge, image publication and release are separate gates.

The six-part task proposal is:

1. Layers: existing L0/L1/L2/L3 foundation candidate, compatibility consumers,
   public example, tests and boundary tooling.
2. Consumed interfaces: the declared public entries and source versions in the
   candidate index, including FR-0023 through FR-0025.
3. Foundation impact: compilation/compatibility repairs and acceptance adaptation
   touch foundation source; the domain Core API remains protected.
4. Contracts: no new public contract change is planned in verification. A newly
   discovered semantic change requires its own FR before implementation.
5. Acceptance: local static type/syntax/boundary/generated-artifact/build/vet
   checks; functional, MySQL, network, container, browser and race tests run in
   GitHub Actions. Planned and executed results remain distinct.
6. Concurrent work: agents have disjoint Control/Agent/Web/tool scopes; one owner
   integrates shared inventories, workflows and evidence. No new product features.

## Candidate And Evidence Identity

The complete candidate includes the pre-existing tracked changes, intentional
deletions and untracked source/docs/assets classified by A5. Local credentials,
state, caches, generated execution evidence and the Forwardx reference checkout
are excluded by the repository ignore rules.

The pre-candidate baseline is `8f35889e13b09a19d215dc10bc6855a3ca98b366`.
That revision does not identify the working candidate. The verification branch
commit and PR Actions run identify the saved candidate after this record is
committed. For PR workflows, record both the PR head and the tested merge SHA;
they are distinct identities. A subsequent fix invalidates earlier-head evidence
for the changed candidate and requires the applicable checks again.

## Verification Adaptation

- Compile the public foundation extension in the root TypeScript project and run
  it through its declared entrypoints in Actions.
- Load canonical Web owner/native factories in existing VM tests, retaining
  browser effects, denial and lifecycle assertions without production test hooks.
- Check every production Web JavaScript file instead of a historical fixed list.
- Move old source-based safety checks to the actual owner/adapter implementations;
  cover source and type imports, private module boundaries and unclassified files,
  including the example and operator/upgrade command consumers. Eleven exact
  existing type/API forwarders are declared as compatibility bridges; their
  canonical owners retain strict public-entrypoint checks.
- Update upgrade assessment harnesses to canonical readonly sources and the
  current schema profile, retaining explicit old-reader refusal cases.
- Add synchronization/native JSON/credential/provider and cancellation/example
  contract cases; existing full-suite/race steps execute them in Actions.
- Collect independent type/test/Web/Go/generated/boundary groups even if another
  group fails, with a final failing exit status. Vet and race still run after a
  group failure when dependencies installed successfully. This avoids a stale
  Web harness preventing any evidence from later independent Go checks.

Static validation has already found real compilation failures, including unused
Go imports, an invalid variable redeclaration, unsupported TypeScript parameter
properties and incomplete union narrowing. Repairs preserve the existing safety
owners and refusal paths. The L2 inventory now explicitly includes multihop
release adaptation and Transit delivery/negotiation validation leaves already
classified in the manual source ledger.

## Evidence Status And Limits

At authoring time, verification is in progress. Local TypeScript (including the
public example), Windows amd64 Go build/vet, Linux amd64 Go cross-build, Web syntax
and generated contract/fixture synchronization have passed on the working
candidate. After the migration repair, the static boundary check passes over
950 production TS/JS/Go files
plus the original authority/table/readonly/documentation safeguards. Eleven
boundary regression tests are authored for Actions; they have only been parsed
locally. No local functional test or integration experiment has run. Actions
results are pending until push.

The TS/JS checker follows AST module/type references; Go imports/tags/calls use
lexical scanning. This is not full type resolution or an algorithm/serializer
equivalence proof. Native restrictions cover L0/L1 and independent Web owners;
the historical mixed Control/Agent L3 native views retain their declared debt.

### First Saved Candidate

Head `de5285b639903d10fa827713200c7c7d69710267` was pushed to
`verify/foundation-a5-20261019` in draft PR #111. The PR test merge was
`2c3c617a5ba3cd77a7b1f78d3955eb2854a3fbc4` against the baseline above.
Contract run `39246628891` and container run `39246628762` both failed.

- Deployment preflight passed; container packaging stopped at an outdated
  Agent CLI source-text assertion before image builds.
- The public extension and targeted contract steps passed. The full TypeScript
  test step reported 624 passing, one failing and 78 skipped cases; its Operation
  detail fixture/projection failure prevented later sequential checks.
- MySQL/Probe/Relay/multihop jobs stopped at the same migration error: the old
  SQL semicolon splitter treated semicolons in standalone comments as statements.
- Skips in the no-database contract job are not MySQL evidence. Later Web, Go
  full-suite/race, boundary negative and image checks were not reached.

These failures require fixes and a new saved revision. They do not validate that
later revision. Run conclusions for the latest PR head remain authoritative.

### First Failure Repairs

The subsequent revision fixes the private L2 SQL splitter with native comment,
quote/escape and session quote-mode handling while retaining the original DDL
and migration lock/ordering. Pure regression cases include the four actual
migration headers, executable comments, escaped/doubled quoted semicolons and
unterminated input. MySQL acceptance still requires Actions.

The Operation fixture now supplies the real public ControlQueries owner over
typed same-transaction fake ports; authorization-before-ledger-read and denial
assertions remain. Container inspection checks follow main/command/native owners,
with new Agent fake-port cases proving readonly inspection never reaches
enrollment, instance locks or Runner creation, including every conflicting flag.

### Second Saved Candidate

Head `873dcecc54b0b6174d306d7b589c7efa48e6faf0` used test merge
`be95f5d07e8cd02ca63d9ea9a4192c70bea283fb`. Container run `39247922694`
passed. In baseline run `39247922674`, the TypeScript suite reported 630 passing,
zero failing and 78 skipped cases, including the SQL splitter regressions.
Deployment tools and Relay isolation/capacity/rotation passed on this revision.

The run then exposed stale Web consumers: a VM wrapper combined destructured
parameters with a strict directive; a historical receipt fixture lacked the
closed native record fields; browser waits expected old capability text and
PathTemplate routes while the canonical UI used Tunnel routes. These are being
adapted without production credential hooks or weaker assertions.

The phase1 database job passed the preceding MySQL cases, then stopped at a
restricted Probe fixture missing explicit history-owner table grants. The fix
keeps public recordIn on the caller transaction, grants only the required history
operations, retains unrelated-table write denials and whole-database digests for
reads/refusals/rollback, and tests a failure after history writes. No broad database
grant or production-owner bypass is intended.

### Third Saved Candidate

Head `d846de1056c46b2a1f92c261fdc1c20194e40525` used test merge
`0592ff483c83d4ac713c5d110b4e29b6ac1568a2`. Container run `39249781749`
passed. Baseline run `39249781664` passed all 99 Web tests, all 630 applicable
TypeScript tests (78 conditional cases skipped), the real Probe/Relay browser
workflow and the preceding targeted MySQL acceptance groups. The long-running
jobs were still in progress when the next repair was prepared; their partial
results are not a final foundation acceptance result.

The independent Go full-suite and race groups found the same faulty new test:
a byte substring search confused the value `certificate` with a JSON field key.
The repair checks parsed object keys while retaining native byte vectors and
fact round trips; it changes no production credential encoding. Go vet passed.

The static graph covered 950 production files, but documentation checking found
links into the ignored local Forwardx reference checkout. Research evidence links
are now pinned to that report's original upstream SHA instead of requiring an
untracked directory in a clean checkout. The checker is not exempted or weakened.
The boundary negative tests were not reached before this link failure.

Use the saved revision's Actions job logs and final run conclusions for actual
passing/failing/skipped cases. This record does not mark readiness cases 1-220 as
passed, certify all migration equivalence or open the upper module gate.
Independent physical-host, long-run/load, backup/recovery, independent Responder
build/publication, release and production readiness remain separate unverified
requirements. A same-host runner does not replace independent physical hosts.
