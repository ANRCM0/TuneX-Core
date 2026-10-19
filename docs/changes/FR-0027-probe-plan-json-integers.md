# FR-0027: Native JSON Integer Probe Plan Expiry

Date: 2026-10-20 (Asia/Shanghai).
Status: accepted in the recorded B public-contract/configured-Actions scope;
proposal recorded before implementation. Independent environments and release
remain separate gates.
Owner and authorization: L2 MySQL/upgrade adapters and L3 UpgradeAssessment owner.
The human's 2026-10-19 standing foundation source authorization covers this
proposal; explicit full-B parallel work, verification and commit/push instructions
supply the separate execution gate. PR merge and release remain outside this task.

## Task Proposal

1. Layers: L2 database migration/native upgrade inspection and L3 upgrade profile
   interpretation. L0 and L1 contracts retain their declarations and semantics.
2. Consumed interfaces: original MySqlUnitOfWork/migrate, Probe plan storage values
   and UpgradeAssessment public entry/inspection ports. Existing transactions,
   locks, authority and protected Journal/history owners remain authoritative.
3. Foundation impact: additive persisted CHECK migration and new compatibility
   profile. UpgradeAssessment interface counter advances from 1 to 2 because the
   exported CompatibilityProfile union grows; exhaustive source consumers adapt.
4. Contracts: expiry accepts MySQL's INTEGER and UNSIGNED INTEGER categories,
   retaining non-null, column equality and every other existing CHECK. Add
   adp3-probe-plan-json-integers-v1 with schema ceiling 0038. All old ceilings,
   aliases, Agent release profiles and plan/report payload version 1 remain.
5. Planned acceptance: fresh migration; populated 0037 upgrade; exact old plan,
   decision and unrelated authority/history preservation; idempotent replay;
   valid large timestamp; malformed, double/string/null/missing/mismatched expiry
   refusal; all old profile ceilings and unknown-migration refusal. Authored
   assertions and local static checks are separate from exact-source MySQL Actions.
   The populated upgrade fixture reconstructs native 0037 CHECK/receipt state in a
   disposable fresh database before seeding and invoking the actual migrator.
   It is not a historical deployed-database capture or permission to roll back
   production schema/receipts.
6. Parallel impact: the Control agent owns only 0038 and its existing Probe
   integration suite; the assets agent owns upgrade rules/adapters and their
   named tests. Root integrates this FR, readiness, version inventory and evidence.
   No product module parallel-development gate is opened by this coordination.

## Why Current Extensions Are Insufficient

Candidate 8a807f8b72e3854cd2748878f2590fa935b63232, baseline Actions
39324943013, phase1 job 118308201883, reports the actual inserted config expiry
1800000060000 as JSON_TYPE UNSIGNED INTEGER. SHOW CREATE TABLE and the failing
probe_plans_chk_7 both require INTEGER. Three finite-plan integration cases fail
before reaching their intended later-write and scheduler assertions. This is a
native database representation incompatibility with already-valid public input;
changing fixture clocks would conceal the fault.

No injected provider can change an enforced persisted CHECK. Preserve immutable
0033 and all historical receipts; append one atomic ALTER in 0038. Upgrade's
native catalog currently deliberately refuses anything beyond reviewed 0037,
so catalog and profile review must accompany the migration.

## Impact And Compatibility

Only probe_plans_chk_7 is replaced with named probe_plan_expiry_json_integer.
Other CHECKs, bounds, raw config bytes, digest rules, row readers, scheduler and
public parser limits retain their existing behavior. In particular the public
parser's independent maximum expiry bound and the SQL created-at/one-hour bounds
remain distinct; this change does not claim SQL duplicates every public rule.
maxRuns remains under its original INTEGER and 1..16 constraints.

Control schema catalog becomes exactly 38 ordered files ending in
0038-probe-plan-json-integers.sql; missing, altered and unknown inputs refuse.
The native schema footprint reader explicitly reviews only this exact filename
and complete approved SQL, normalizing whitespace and line comments. It returns
no table/column markers because a pure CHECK replacement creates no such footprint.
Inventing a marker for the already-existing probe_plans table would incorrectly
classify a legitimate pre-0038 database as interrupted migration.

All other markerless SQL continues to refuse. Original SQL/hash/order remain in
the catalog. This exception does not inspect CHECK metadata or prove full schema
equivalence; existing unchecked limitations remain explicit. Native MySQL tests
provide evidence for the actual constraint behavior.

## Migration And Version Plan

Apply original migrations through 0037, then one ALTER dropping the old CHECK and
adding the named two-category non-null CHECK. Do not rewrite rows or receipts.
Original migrator locking/order and its receipt insertion remain unchanged. MySQL
DDL may commit before a later receipt error: startup must stop for operator-led
repair, preserving history. No automatic rollback, silent repair, fake receipt or
protected-history reset is introduced; forward recovery is the supported path.

All 26 original compatibility profiles preserve their schema ceilings. Add the
27th Control profile for 0038; old profiles block on 0038, new profile on 0037
reports pending 0038, and Agent release target restrictions remain unchanged.
UpgradeAssessment public version 2 records the source union extension; old export
names remain available. Wire/schema package versions and Agent Journal version,
authority counters and the single Runtime ledger are unchanged.

## Acceptance And Known Limits

The failure above is executed evidence for the old source, not acceptance of this
proposal. New source needs local type/boundary/document checks and Actions for
all frozen B assertions, native MySQL upgrade/refusal, Windows Agent, public
example, configured 3/4/8-node/browser/network and container jobs. Record saved
head and actual PR test-merge checkout separately. Physical independent hosts,
long-running/load gates, standalone Responder delivery and release remain separate.

Candidate798a9ab, baseline39329900881 at checkout
a55c12c1313df2f75c4c10f9382b068f26ac3cae, passed all original finite-plan
transaction/quota/scheduler cases after0038. Its two new tests incorrectly expected
a same-numeric JSON UPDATE to evaluate CHECK: MySQL compares records first and
can retain the existing integer without a row change. The revised assertions
first prove the input parses as DOUBLE, then require a fresh INSERT and an UPDATE
with a real revision change to refuse. The original equal-value UPDATE separately
must preserve stored integer type, exact bytes and every table. The correction
changes test evidence, not the schema or public parser; new exact-source execution
remains required.

## Source Authorization And Acceptance Gate

Chosen under the standing source authorization: implement the narrow additive
migration plus explicit reviewed catalog/profile extension, preserving all old
compatibility bounds. Source compatibility impact and the original uncertain-DDL
outcome are documented above. Explicit full-B authorization permits the named
parallel test work and subsequent static checks/commit/push, but does not itself
mark the foundation accepted. The final B decision requires its own source-bound
evidence and declared scope.

## Final B Execution And Decision - 2026-10-20

Source `e208a3abf17129b0c2898ba2022c69f60f45445a`, actual checkout
`c3ce8a67b901f61234b4116190409854818cb6c7`: baseline 39341589653 and
packaging 39341589509 passed. All applicable steps, including this proposal's
native/transaction/refusal and full integration assertions, are reconciled in
[verification](../development/foundation-verification-2026-10-19.md). This closes
the earlier pending exact-source acceptance in the declared B scope. The public
compatibility impact and independent physical/long-run/Responder/release limits
above remain; PR #112 is not merged by this task.
