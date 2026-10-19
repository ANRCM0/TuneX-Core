# Recovery native effects source candidate

Date: 2026-10-19. Implements only the native-workflow part of the recorded FR-0017
source amendment. Source authored in the existing dirty tree; no tests, type/syntax/
static/import/boundary checks, formatters, generators, builds, CI, network/native/
MySQL experiments or Git writes ran. Main owns complete workflow integration and
acceptance numbering; these are planned cases, not evidence or gate acceptance.

## Ownership and exported source chain

compatibility/native-recovery.ts exposes one nativeRecoveryEffects object and the
original trustedRecoveryTime function. It owns the original native helpers from
scripts/ops/recovery.ts: Node filesystem/path/stream/hash/UUID/child process, mysql2
connection/raw queries, strict native backup manifest parser and native trusted-clock
format. It imports no L3 owner or product coordinator. The AuthorityRecord declaration
stays canonical in infrastructure/authority.ts and is only exported here as the
NativeRecoveryAuthorityRecord type alias, preserving its identity and semantics.

Original BackupManifest and BackupEnvelope interfaces are exported unchanged. Raw
RecoveryBackupMetadata, RecoveryLeaseBound and RecoveryDatabaseBinding interfaces
describe original SQL row fields without coercion, validation or normalization.
NativeRecoverySource retains the same URL, mysql2 Connection and recoveryId values.
The original MySqlUnitOfWork remains the database implementation; openDatabase only
constructs it and raw effects read its existing pool. No alternate authority,
transaction owner, schema, quarantine writer or Runtime ledger is introduced.

Intended complete chain after main integration: old executable/exported Recovery
composition -> L3 RecoveryWorkflow decisions -> required nativeRecoveryEffects ->
original files/processes/SQL/native formats, with original authority and owner
quarantine callbacks supplied separately by main. This leaf deliberately contains
no maintenance/trust/lease-exhaustion/owner-quarantine/credential/rebind decisions.
It does not imply old native bodies have already been removed from the script;
that integration is main-owned and must leave one implementation afterward.

## Actual public methods and compatibility

- resolve(...parts:string[]) is the original node:path resolve function.
- outsideProtectedDirectory(directory,authority:{keyPath:string}) uses the original
  relative/resolve/path predicate and reads only authority.keyPath.
- outsideNotificationDirectory(directory,protectedDirectory) keeps undefined bypass,
  lstat/ancestor/no-symlink identity resolution, parallel output/vault resolution,
  bidirectional containment and original generic error masking.
- makeDirectory(directory) retains mkdir recursive:true/mode0700.
- openDatabase(url) returns new original MySqlUnitOfWork.
- backupMetadata(db), leaseBound(db), databaseBinding(db) return the original raw
  row arrays from the exact original SQL, without copying or extra transactions.
- createEmptyDump(path) retains open wx/mode0600 then close, without a new finally.
- dump(options:{mysqldump:string;databaseUrl:string},path) keeps clientOptions before
  command selection and execute try/catch; malformed URL errors escape unchanged.
- syncDump(path,directory) retains chmod0600 -> open r+ -> sync -> finally close ->
  original non-Windows directory fsync.
- fileSHA and durableFile are the exact original helpers; durable file still opens
  wx0600, writes/syncs, finally closes, then syncs its directory.
- readManifest(path) awaits utf8 read then invokes the original strict parseManifest
  with parseJson limit16384 and the same closed fields/regex/count/time checks.
- newId is the same imported randomUUID function; createdAt dynamically performs
  new Date().toISOString(); pretty uses JSON.stringify(value,null,2).
- trustedTime is directly the same exported trustedRecoveryTime function, including
  default args=[], Array/string validation and original native time/parse behavior.
- validTargetDatabase and validTrustDigest are the exact original regex predicates;
  they decide native format only, not restore/authority eligibility.
- sqlPath(options:{manifest:string},sqlFile) preserves unsafe SQL-file refusal before
  reading options.manifest, then original resolve(dirname(...),sqlFile).
- beginRestore(options:{sourceDatabaseUrl:string;targetDatabase:string}) keeps
  new URL(options.sourceDatabaseUrl), source-name decode/target comparison, second
  source URL read for createConnection, then randomUUID. A UUID failure after open
  still gets no newly invented cleanup, preserving the original failure behavior.
- createRestoreTarget(session,options:{targetDatabase:string}) retains the original
  target getter in SELECT args, existing-target refusal, CREATE interpolation and
  source.pathname mutation, then source.toString(). No extra validation/quoting or
  target cleanup is added; original upstream target validation remains L3-owned.
- restoreDump(options:{mysql:string},databaseUrl,path) keeps clientOptions before
  reading mysql executable, original spawn/stdio, stderr drain, child error/exit
  promise and Promise.all with pipeline(createReadStream(path),child.stdin).
- closeRestoreSource(session) directly calls the same admin.end receiver.

The options-object signatures preserve original repeated public option getter
evaluation rather than eagerly snapshotting them as positional primitives. Other
effects receive values at their original workflow expression points. Every native
method is required by the intended explicit composition; no fallback implementation,
new default clock, cancellation policy, response limit or cleanup policy is added.

## Native operation and failure details

clientOptions keeps mysql protocol and bounded simple database-name refusal,
hostname bracket removal, default port3306, decoded username/password and copied
process.env plus MYSQL_PWD. Dump retains removal of the database flag, original
single-transaction/quick/skip-comments/no-tablespaces/GTID/hex flags, result-file and
database order, timeout120000/maxBuffer1048576 and original generic dump failure.
Restore retains binary-mode and original child failure messages; it does not add
kill/timeout/partial-target deletion behavior. Filesystem identity and directory
sync retain the original platform branch and exact close/finally ordering.

trustedRecoveryTime keeps args validation before started=Date.now, execute with
copied args plus --check, timeout10000/maxBuffer8192, original parseJson limit8192,
Date.parse(checkedAt), synchronized/skew1..5/integer/finite checks and short-circuit
comparison against started then a later dynamic Date.now. It does not add a check
result cache, alternative time source or host-acceptance claim. The manifest parser
keeps its existing separate Date.parse and regex expressions without routing through
new product helpers or changing malformed-field evaluation order.

## Main integration and planned acceptance

The main agent integrated nativeRecoveryEffects/trustedRecoveryTime and exported
format/raw/session/type aliases through compatibility/public.ts with native
interface1, wired the L3 RecoveryWorkflow and removed original native bodies from
scripts/ops/recovery.ts. Existing backup/restore/trusted-time signatures remain in
that same composition entry. The complete chain is recorded in
recovery-owner-workflow-v1.md; readiness164-166 remains planned/unexecuted. The
native subtask itself wrote only this source/document; shared integration belongs
to the existing main source task, with no separate native acceptance inferred.

Planned, unexecuted cases: exact native format/type/function aliases, manifest raw
field/closed-key/time/count rejection order and byte limit; no SQL row normalization;
exact metadata/lease/binding SQL/order; operator output/protected key/vault containment
and symlink/ancestor/missing-path behavior; mkdir/open modes and wx refusal; dump URL
parse-before-execute catch and executable getter order, arguments/env/timeout/errors;
file/dir sync/close failure precedence and streaming hash; trusted args validation,
started/execute/parse/late-clock order and skew boundaries; unsafe sqlFile before
manifest getter; repeated restore URL/target getters; source overwrite/existing
target refusal, admin open/UUID failure cleanup gap; target CREATE/pathname order;
restore spawn/stderr/error/exit/pipeline/Promise.all behavior and admin end receiver.
Complete workflow acceptance must also cover authority/lease/quarantine/credential/
commit/rebind and partial external-state failures on the exact authorized frozen
revision in GitHub Actions. No case has run here; physical-host/clock trust and
release acceptance remain separately unverified.
