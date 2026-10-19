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
candidate. The static boundary check passes over 949 production TS/JS/Go files
plus the original authority/table/readonly/documentation safeguards. Eleven
boundary regression tests are authored for Actions; they have only been parsed
locally. No local functional test or integration experiment has run. Actions
results are pending until push.

The TS/JS checker follows AST module/type references; Go imports/tags/calls use
lexical scanning. This is not full type resolution or an algorithm/serializer
equivalence proof. Native restrictions cover L0/L1 and independent Web owners;
the historical mixed Control/Agent L3 native views retain their declared debt.

Use the saved revision's Actions job logs and final run conclusions for actual
passing/failing/skipped cases. This record does not mark readiness cases 1-220 as
passed, certify all migration equivalence or open the upper module gate.
Independent physical-host, long-run/load, backup/recovery, independent Responder
build/publication, release and production readiness remain separate unverified
requirements. A same-host runner does not replace independent physical hosts.
