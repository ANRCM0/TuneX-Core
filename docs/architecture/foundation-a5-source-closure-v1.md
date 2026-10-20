# A5 Foundation Source Closure v1

Date: 2026-10-20 (Asia/Shanghai).
Status: **A5 source classification closed, PR #111 merged; later B accepted in
its frozen public-interface/configured-Actions scope**.

A5 saved head `9f1d78d` merged as `373c291`. B is frozen at
`e208a3abf17129b0c2898ba2022c69f60f45445a`, actual tested PR checkout
`c3ce8a67b901f61234b4116190409854818cb6c7`. See the
[verification record](../development/foundation-verification-2026-10-19.md) for
the acceptance decision and separate merge/environment/release gates. PR #112
was later merged as `5a764f7`; future product work still needs its own authorization
and accepted base.

The no-check/no-commit/unverified statements below are the original A5 source
handoff. Its later B assertions and execution are now reconciled in the maintained
[map](../development/foundation-b-assertion-coverage.md); those historical words
do not invalidate that identified evidence or accept any later source change.

## A5 Exit Scope And Records

The A5 scope, now summarized in development/development-plan.md, was to assign
remaining source/type references, document actual compatibility consumers and
defaults/removal conditions, and join the candidate source/version/acceptance
records. A5 does not authorize running source checks, generating a snapshot,
committing or creating a tested revision. The following integrated records close
that manual source scope for the current working tree:

| Source requirement | Current record and disposition |
| --- | --- |
| Protected L0 and common L1/L2/L3 boundaries | foundation-source-root-catalog-v1.md, foundation-layers-v1.md, foundation-boundaries-v1.json; Core remains its original public package, Runtime kernel remains separate |
| Old top-level Control module leaves | control-legacy-module-leaves-v1.md: all59 bodies, six construction/static bindings and53 exact forwarders |
| Old nested Runtime leaves | control-runtime-legacy-leaves-v1.md: all34 bodies, eight construction/callable bindings, one retained native ledger interface and25 forwarders |
| Old application leaves and actual root policies | control-application-legacy-leaves-v1.md: all99 bodies, original Control composition, request wrapper, versioned read aggregate and96 forwarders; actual deferred/field/default/transaction callbacks recorded |
| Remaining Control source | foundation-control-source-closure-v1.md: named kernel/framework/native/storage/HTTP leaves,31 product owners and original server/main/bootstrap/CLI/client roots, precise legacy MySQL/API bridges and actual consumers |
| Agent source and representation ownership | foundation-agent-source-closure-v1.md: named lower/native/Runner/Probe/state/engine/codec/command/auxiliary/test leaves, default/private/serializer consumers, embedded schemas and existing authority owner chains |
| Packages, Web, support and distributions | foundation-assets-consumers-closure-v1.md plus contract-assets-source-map-v1.md and browser-native-leaf-inventory-v1.md: eleven package exports, native/private leaves,21 schemas/actual loaders/copies/generator roles,22 old Web leaves/new owner-native entries, fixed assets, fixtures, tests, ops, example, locks/config/deploy/workflows |
| Public versions and acceptance handoff | foundation-candidate-index-v1.md and development/foundation-readiness.md: actual independent source counters, FR-0001-0025, retained bridges/removal conditions and planned cases1-220; all current-source execution remains unverified |

The leaf/family ledgers use source navigation, direct public/import reads and
targeted full bodies together with the existing owner/FR records. This does not
mean every algorithm was audited again or a recursive import graph was executed.
There is no source-directory exemption: legacy native construction entries stay
named as such rather than being reclassified as pure adapters. Type references
count as dependencies; an injected callback invoking the original outer provider
does not create a reverse source import.

## Concrete Residuals Resolved In This Integration

Application reference cleanup uses existing public declarations for nineteen
named type-export sets and Control's Policy/Accepted imports. Earlier five Runtime
type-forwarding and three Policy reference changes are retained. Narrow type-star
sets, value leaf imports, old aliases/signatures/versions and constructor bodies
are preserved. These references do not create new contract declarations.

The parallel source reading found three actual lower representation/type residuals.
They were recorded before implementation under the human's 2026-10-19 standing
source authorization and explicit parallel-agent instruction:

| Change request | Implemented source boundary | Intentional compatibility impact |
| --- | --- | --- |
| FR-0023-agent-synchronization-facts.md | executiontime2 has tagless parsed synchronization facts; platformclock2 owns original native SyncStatus and SynchronizationFacts; authorization retains native aliases/proof/OS bindings | Direct lower native literals/serializers and custom Evidence providers must migrate. Native canonical type owner changes. RFC3339 parsing now occurs after Evidence and caches facts, instead of each lower Validate; pure computation timing/frequency changes explicitly, while invalid facts do not introduce an earlier validation error |
| FR-0024-agent-credential-native-records.md | executionidentity2 facts have no native tags; agentidentity2 owns four exact native records and eight explicit bidirectional projections; nativeexecution2 Relay response codec receives native RelayResponse | Lower direct JSON is no longer a credential file/wire representation. Native canonical type identity changes. Old Control JSON-sensitive aliases and protected decode destinations remain native; Provider methods convert at existing boundaries |
| FR-0025-control-cancellation-port.md | common CancellationSignal1 replaces two lower platform-global AbortSignal types; Node report read2 and Notification effects2 name the changed views | Native objects/listeners are retained without wrapping/casting. Through the lower view, platform-only EventTarget/onabort/dispatch methods and native-API assignability are no longer promised |

Source intent retains original proof/credential field names/order/tags/omitempty,
pointer semantics and missing-versus-corrupt refusal; Guard/Journal/authority,
same-Tx locks/publication and save-before-bind ownership are not replaced.
No native payload/schema/SQL migration or feature default changes were added
in that A5 source slice. Later B work adds the narrow MySQL0038 CHECK repair and
UpgradeAssessment2 profile in [FR-0027](../changes/FR-0027-probe-plan-json-integers.md),
with its own compatibility and exact-source acceptance obligations.
The stated byte, sequencing and lifecycle equivalence is still planned acceptance,
not demonstrated behavior.

HostVersion1's fixed linux/windows, phase and TCP/UDP metadata vocabulary remains
the original pure descriptor contract. It performs no OS discovery; actual
runtime.GOOS selection stays in the L2 executiondriver binding. Classification
does not broaden supported descriptors, reorder their refusal or grant execution;
a new support vocabulary needs its own change request.

## Consumers, Compatibility And Removal

All observed old constructors/forwarders/private fallbacks have a disposition in
their scope ledger. Production assembly, lazy/static Recovery, phase/manual/ops,
native proof/credential/Journal serializers, package-local fakes, VM/source-text
tests, fixture generators and container import consumers are included. A value
alias can intentionally keep its old exact leaf loading even when an owner public
entry reexports the same value. No bridge is deleted because a production-only
search no longer sees a caller.

Removal requires deliberate migration of every actual consumer and matching
saved-source acceptance for export/type/object identity, constructor/default and
receiver behavior, field/tag/reflection/serializer expectations, native family
specialization, cancellation/time/cleanup and original authority/transaction
ordering. The current candidate retains these entries and states their limits.
Unknown out-of-repository consumers are not given an unsupported compatibility
guarantee by this manual ledger or the new FRs.

The independent Control/Agent/assets source work was integrated by one owner of
the shared candidate/boundary/readiness records. A separate read-only cross-review
of FR-0023/0024's actual provider/serializer/proof/credential chains found no
specific missed production conversion or branch. That review is source evidence
only; it does not replace type compilation, native byte vectors or time-boundary
tests. No claim of complete algorithm or external consumer verification follows.

## Candidate Identity And B Handoff

The candidate consists of the integrated current source, including existing
tracked edits, untracked additions and intentional deletions, together with the
classified package/SQL/schema/generated/support/config/distribution inputs.
The existing HEAD cannot identify this content. No commit, tree, digest,
generated snapshot or new frozen revision was produced in A5. The candidate
index is navigable source scope, not an immutable content manifest.

The next separately authorized stage must:

1. Save and identify the exact complete source revision, recording the public
   counters/FRs and retained compatibility boundaries from this candidate.
2. Adapt the existing checks to real source/type/private/JS/example/asset/ops
   boundaries and canonical factories. Root TypeScript currently omits examples;
   Web syntax coverage uses the old fixed list; Rule/app/Relay VM and upgrade
   source-text harnesses still depend on prior private layouts. Do not weaken
   negative or security cases or add production credential hooks to fit a test.
3. Execute applicable contract/boundary/type/example and functional acceptance
   on that same revision. Functional/MySQL/network/container/browser evidence
   belongs in GitHub Actions. If a fix changes source, update the relevant
   evidence identity rather than borrowing historical green results.
4. Record actual passing/failing/skipped/missing cases separately. Public preview
   example evidence does not demonstrate Runtime/Agent deployment; staged Echo
   history parsing does not enable live v4; offline Transit is not a live driver.
5. Keep independent physical-host, long-run/load, backup/recovery, Responder
   build/publication, release and production gates explicit. Current two-image
   workflows do not supply independent Responder evidence or physical-host proof.

Readiness206-220 joins the application, Control, assets, Agent and FR follow-up
cases to prior1-205. Every current-source executed/pass column is unverified;
case numbers are navigation, not an acceptance percentage. A newly discovered
omitted source or real dependency violation reopens its source item. Later
machine checks may find such issues; source closure does not predeclare them green.

No tests, type/syntax/static/import/boundary checks, formatters, generators,
builds, CI, network/MySQL/browser/native experiments, commits or pushes ran.
A5 source closure does not open verification, release or upper-module gates.
