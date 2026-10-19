# Upgrade assessment owner and native source candidate

Date: 2026-10-19. Source authored in the existing dirty tree only. No tests,
type/syntax/static/import/boundary checks, formatters, generators, builds, CI,
network/MySQL/native/filesystem/PKI experiments or Git writes ran. Main owns shared
readiness numbering, boundary/inventory and final integration. These source changes
do not accept A5, the foundation, runtime execution, upgrade permission or release.

## Public owner and full source chains

modules/upgrade-assessment-owner/public.ts exposes original parseUpgradePlan,
assessUpgrade and runUpgradeAssessment with original invocation signatures. It also
exposes the original CompatibilityProfile, JournalInspection, UpgradePlan,
SchemaMarker, DatabaseInspection and UpgradeInspection type surfaces. Build/Release
are canonical internal type leaves; their existing field shapes remain unchanged.
The plan/report product policy and complete workflow coordination live in L3.
The new owner entry declares UPGRADE_ASSESSMENT_INTERFACE_VERSION=1. Legacy script
entries do not add that new named export, preserving their former export surfaces.

compatibility/native-upgrade-format.ts owns the existing external JSON decoder,
revision/digest/MySQL-baseline native format predicates, exact SchemaMarker and
DatabaseInspection declarations and original schemaMarkers/inspectSchema functions.
They are schema/SQL format facts, not L0 domain rules. Product contracts alias the
same lower declarations through public native names. The original AuthorityRecord
stays in infrastructure/authority.ts and is exposed only as NativeUpgradeAuthorityRecord.
No new protected authority implementation or L0/L1 public semantic change is made.

compatibility/native-upgrade-inspection.ts owns the original bounded file reader,
catalog reader/hash, complete read-only native SQL inspection and original
AuthorityStore/trustDigest/mysql2 provider bindings. It imports no L3 file. The
native provider object is selected by a structural UpgradeAssessmentEffects port;
its database parameter is generic with the original native connection as the default
type. Url, native connection and catalog are explicit native types at the public
boundary rather than a private owner import from a lower adapter.

Full chain: old ops CLI consumer -> old exact script alias -> public L3 assessment
workflow -> required original file/catalog/authority/CA/connection/inspection effects
-> native filesystem/hash/SQL snapshot -> original assessment checks/report. No
UnitOfWork migration, advisory lock, owner writes, Agent network request, execution
grant or second transaction ledger enters this chain. The ordinary MySQL connection
and protected AuthorityStore remain the original providers.

The native catalog URL changed from the old scripts/ops relative path to
new URL('../../migrations/',import.meta.url) in apps/control/src/compatibility.
Both source locations identify apps/control/migrations. No directory was copied
and no path was guessed from the old file depth. Catalog filtering/sorting, exact
37-file count, final 0037-probe-echo.sql refusal, parallel original file reads/hash
and flat marker order remain unchanged.

## Rules, mutability and default compatibility

Plan parsing preserves the original parseJson limit1048576, exact closed-field
checks, object key sorting behavior and error INVALID_UPGRADE_PLAN. Native format
predicates perform the same regex tests at original short-circuit positions. Core
identity/counter rules still use public Core. Agent release profiles remain only
runtime/multihop; product profile Set construction keeps its original initial
entries plus all four later add operations: typed-probes, observation-services,
probe-services and probe-echo. No capability/profile or migration ceiling is removed
or inferred from a smaller initial Set. Ceilings retain all mappings through0037.

Plan/journal generation/digest/fence/importedTransit validation and copy/alias
behavior remain original; no additional freeze or readonly claim is introduced.
Schema markers keep original migration filename grammar, CREATE/ALTER/ADD/MODIFY
regexes, lowercase enum representation and unknown/unreviewed file refusals.
inspectSchema keeps applied/table footprints, enum latest-applied selection and
sorted unique issue output. It remains a footprint detector, not full equivalence.

assessUpgrade preserves every check order, pass/block/review classification, subject,
history prefix and pending migration calculation; authority/trust/stability/lease
bounds; multihop executor/withdrawal; journal inventory/generation/digest/profile/
downgrade checks; rollback/recover/maintenance review. It preserves decision
precedence, original source/target/journal references, report mutability, unchecked
evidence and requiredActions. runtimeReady:false and productionApproved:false stay
explicit even when compatibility decision is compatible. Assessment grants no
runtime, recovery or upgrade authorization.

runUpgradeAssessment still has one required options object and no added optional
argument. It binds the existing native provider locally, then reads planPath and
plan, catalog, stateDirectory/authority before record, caPath with65536 limit/trust,
and only then databaseUrl/connection. The same options object is read lazily in
that order, without snapshotting getters. Database inspection precedes authority
after-read, sequence stability/trust comparison and final report. Connection end
remains in the same finally after successful connection construction; earlier
plan/catalog/authority/CA/connect failures get no newly invented cleanup.

## Read-only SQL and file lifecycle

readUpgradeInput retains string|URL and maximum=1048576, open r, stat file/size
refusal, Buffer.alloc(maximum+1), the same bounded read loop, post-read limit check,
fatal utf8 decoder and finally close. No symlink/empty-file/default/timeout behavior
is added. Catalog reads still call that same reader and native SHA256 implementation.

inspectUpgradeDatabase keeps its original Connection and full catalog signature.
Repeatable-read SET precedes READ ONLY consistent-snapshot START, both before the
try. Therefore setup failures retain the original rollback behavior rather than
moving setup under a new cleanup scope. Inside try, original query timeout10000,
metadata validation, columns/legacy-table and10000 bound, migration history100
bound/grammar and footprint order are unchanged. Table/column-dependent reads
retain original conditional defaults and raw row aliases, not new fallback facts.

Node inventory remains bounded1000 with original ID/generation/digest checks;
snapshot protocol and executionExtension SQL predicates, combined lease/snapshot
bounds, nonwithdrawn multihop deployment counts and enabled Forward intents keep
their exact SQL and conditions. A second columns read and original JSON.stringify
comparison still detect visible metadata changes before return. Native decimal
string counter conversion, MAX_COUNTER bounds, null lease handling and error order
remain. Finally still awaits db.rollback, with its original error precedence.
There are no DDL/writes/migrate/lock/Agent calls in this native inspection.

## Legacy entries, consumers and integration

scripts/ops/upgrade.ts now directly aliases the two product functions and the two
canonical native schema functions, plus exactly its six former exported type names.
scripts/ops/upgrade-inspect.ts directly aliases native readUpgradeInput,
upgradeSchemaCatalog, inspectUpgradeDatabase and canonical L3 runUpgradeAssessment.
Both compatibility entries select their exact former export sets through the
public owner/native entries; neither consumes a canonical private leaf directly.
No old implementation body remains at those entries. Original named function
identity/defaults/parameter count remain canonical rather than wrapper methods.

Observed source consumers: scripts/ops/cli.ts uses runUpgradeAssessment; Control
upgrade-assessment and upgrade-mysql acceptance sources use old functions/types;
probe-instance-mysql acceptance uses catalog/inspectSchema. Those consumer files
were not changed. One existing upgrade-assessment test reads upgrade-inspect.ts
text and expects the READ ONLY SQL literal at that path. With the exact alias,
that textual assertion must be adapted after verification authorization to inspect
the canonical native source or, preferably, corresponding behavior. It was not run,
and no failing/passing claim is made. Main owns CLI and other public example edits.

The main integration added these shared compatibility/public.ts exports:

```ts
export { nativeUpgradeParseJson, nativeUpgradeFormat, schemaMarkers, inspectSchema } from './native-upgrade-format.ts';
export type { SchemaMarker as NativeUpgradeSchemaMarker, DatabaseInspection as NativeUpgradeDatabaseInspection } from './native-upgrade-format.ts';
export { readUpgradeInput, upgradeSchemaCatalog, inspectUpgradeDatabase, nativeUpgradeInspectionEffects } from './native-upgrade-inspection.ts';
export type { NativeUpgradeAuthorityRecord, NativeUpgradeConnection, NativeUpgradeSchemaCatalog } from './native-upgrade-inspection.ts';
```

No shared framework/public, Recovery/server, readiness/FR/inventory/plan/progress
file was changed. These additive L3/L2 source contracts preserve existing L0/L1
public semantics; no breaking foundation change or new FR number is introduced.

## Planned, unexecuted acceptance and remaining scope

On an authorized exact frozen revision, cover old/new function/type identity,
original parameter/default/maximum, mutable report/journal/type shapes and all
profile Set additions/ceilings/catalog37 behavior. Cover malformed JSON/key order,
native format/enum footprint cases, journal counter/fence/digest/profile rules,
check order/decision precedence/review paths and runtimeReady:false regardless of
compatible output. File cases cover bound/stale stat/read-loop/utf8/finally failures,
catalog path equivalence/read order/hash/marker order and unknown migration refusal.

SQL cases cover original timeout/statements/read-only transaction setup, rollback
failure precedence, conditional missing tables, metadata/counter/null/history limits,
legacy DB refusal, bounded inventory, protocol and lease/count predicates, concurrent
schema change comparison and no writes/migrate. Workflow cases cover lazy getters,
before/after authority stability, CA trust, connection construction/end on failure
and report projection. Functional MySQL/native filesystem/PKI evidence belongs to
GitHub Actions, not source-stage execution. Image/binary identity, backup integrity,
physical clock/host trust, fence equivalence, active runtime health and operational
approval remain explicitly unchecked. All-source/default/type/bridge classification
and this known source-text test adaptation remain overall source/acceptance work.
