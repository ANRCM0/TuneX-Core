# Recovery Owner And Native Workflow V1

Date: 2026-10-19. FR-0017 source implemented, unverified. No command mode, database,
dump, clock checker, native process, file experiment or acceptance has been run.

## Public Source And Existing Owners

| Layer/source | Public entry | Responsibility |
| --- | --- | --- |
| L1 framework/observation-recovery-storage-ports.ts | storage1, Telemetry/Station/Notification recovery stores | Supplied Tx, encoded Station state and numeric time only |
| L1 framework/publication-recovery-storage-ports.ts | storage1, Path publication/Ingress deployment/migration stores | Supplied Tx and original shared event timestamp |
| L1 framework/recovery-event-storage-ports.ts | event storage1 | Original Recovery event insert, encoded details/time supplied |
| L2 seven mysql-*-recovery-store.ts files | Each original owner store plus MySqlRecoveryEventStore | Original SQL/predicates/args; no pool, new transaction, retry, policy, clock or product imports |
| L3 telemetry/station-alert/notification owner public.ts | TelemetryRecovery1, StationAlertRecovery1, NotificationRecovery1 | Own recovery operation; mutable Station state and Notification clock stages stay product-owned |
| L3 path/ingress owner public.ts | PathPublicationRecovery1, IngressRecovery1 | Own recovery event/invalidation operation; no apply/reconcile |
| L3 recovery-owner/public.ts | RecoveryQuarantine1 and RecoveryWorkflow1 with explicit structural/generic ports | Complete original backup/restore policy and one supplied-Tx owner sequence |
| L2 compatibility/public.ts | nativeRecoveryEffects/native interface1, trustedRecoveryTime and native DTO/raw/session/type aliases | Original file/path/format/process/MySQL metadata/clock operations |
| Existing scripts/ops/recovery.ts | Same backupDatabase/restoreDatabase/trustedRecoveryTime exports | Explicit original native/owner composition, no business or inline table-write body |
| Existing infrastructure/authority.ts | Same AuthorityStore/AuthorityRecord | Protected artifact signature/binding/maintenance/high-water/rebind owner; untouched |

L3 workflow has no SQL, Node/mysql2 type, OS branch, native clock/global, subprocess
or filesystem implementation. It selects the original native BackupManifest and
AuthorityRecord formats through public L2 type aliases. Source/Database type
parameters keep actual URL/Connection/Pool types in L2. Native imports no L3.
RecoveryAuthority is a structural view of existing public read/sign/verify/rebind,
not a new implementation or an authority that can issue execution permission.

The original script is still the same operator entry. It binds public product
owners, explicit lower stores/native effects and precise existing constructor/
static bridges. It is not a new composition root created to hide business logic.
New direct product hosts require explicit providers; old functions retain their
native defaults through this composition. No untrusted-plugin boundary is claimed.

## Exact Original Transaction Chain

RecoveryWorkflow invokes the original db.transaction exactly once per original
restore workflow; its UoW still controls native transient retries. RecoveryQuarantine
opens no transaction. Every callback sees the exact supplied tx in this order:

1. Identity returns credentials, captured immediately through the original outer
   accounts assignment position; then Transport grants, Relay withdrawal, Node
   quarantine. Existing public/static implementation bindings stay lazy.
2. Telemetry10 writes in original Node, rollup, Probe, Host, Forward order. Only
   original ingestion heads/cursors reset; retained sample/bucket history suspends.
3. Station2 writes with the original9-field mutable unknown state, property order
   and explicit native encoding at the old write-argument stage. No deepFreeze or
   automatic alert resolution/replay.
4. Notification4 writes: endpoints suspended, then one original clock sample,
   delivery history flagged, queued/claimed/retry-wait cancelled, pending attempts
   finished unknown. Claimed status code/outcome changes happen before replacing
   status; terminal HTTP evidence/rate bounds/credential references remain.
5. Existing Probe history -> plan -> qualification -> Observation declaration
   recovery statics. Their original errors/time behavior is not rewritten.
6. One publicationRecoveryAt sample -> Path event/update -> Ingress deployment
   event/update -> Ingress migration event/update. Event precedes invalidation for
   each family, with the same supplied timestamp. No reconciliation, new current
   binding, rollback compensation or provenance/history deletion.
7. Existing Probe instance -> permit -> Forward -> RuntimeLedger -> Idempotency.
   Preserve instance sample and permit's two independent samples, consumed IDs,
   withdrawn/issued reservations and budget clocks. The one original ledger still
   decodes snapshots and adds capped retirements through its original store.
8. Recovery event last: separate original dynamic now, then original ordered details
   JSON. newTrustDigest remains a getter of the original restore options at this
   stage. No eager snapshot changes its original read/error position.

The legacy construction wrappers still appear only in this original composition
and bind the same existing owners. They are real public compatibility consumers;
do not remove them before their tests/tool/default contracts migrate. No framework,
ledger, Authority, credential issuer, Probe Gate or Journal is copied/replaced.

## Complete Backup And Restore Workflow

Backup retains output resolve -> protected key/vault separation -> mkdir -> vault
separation recheck -> original database construction. Inside its try: raw metadata
read -> authority binding check -> random ID/dump file wx600 -> native dump -> file/
directory sync -> authority binding/trust recheck -> independent lease bound ->
original timestamp/manifest fields/streaming SHA -> original signature/pretty JSON/
durable manifest. Database closes in the original finally. No failed dump accepts
a manifest and no cleanup claims a partial SQL file is a valid backup.

Restore retains stopped-issuer/target-format checks -> original protected maintenance
read -> native manifest read/strict parse -> original artifact verification ->
version/binding/trust/fresh-trust policy -> safe SQL path/hash -> original trusted
OS clock and historical authority exhaustion. Output directory protection/mkdir/
recheck precedes source URL/admin/ID. Native source/database-name methods receive
the original options object, preserving repeated source/target/executable/manifest
getters at original inner operation sites instead of eagerly capturing primitives.

Fresh target refusal/create and dump restore precede target UoW construction and
migrate. Restored lease bound is checked before the one quarantine transaction.
After successful commit: raw target binding -> original durable credentials with
all accounts plus owner subset -> original protected AuthorityStore.rebind ->
same result. Target pool closes inside admin-source finally lifetime; admin end
still runs afterward. Rebind remains in maintenance until explicit review resume.

The native trustedRecoveryTime is the same function exposed by effects.trustedTime
and the old script export, including args validation, started clock, --check process,
bounded parser, skew and later dynamic clock short-circuit stages. Manifest/native
hash/target formats stay in L2; matching trust/authority/time decisions stay in L3.

## Failure, Compatibility And Acceptance Limits

Target creation, dump/pipeline and implicit migration DDL can leave a partial fresh
database before quarantine. No new target deletion, process kill/timeout, rollback
or retry is added. UoW retains rollback/transient retry and uncertain commit outcome.
Credentials can fail after database commit; protected rebind can fail after durable
credentials. Neither proves the whole restore rolled back or accepts a guessed
authority state. Preserve maintenance/high-water and original operator review.

Old backup/restore return types and option signatures still name the original
AuthorityStore; new direct hosts use its exact native record view. No canonical
record/type identity moves, serializer fallback, schema/protocol/feature changes or
release permission. New direct generic/provider method sets and legacy function/
type consumers require later acceptance; source reading is not passing evidence.

Readiness161-166 covers every raw owner statement, state/time/JSON stage, same-Tx
callbacks/defaults/aliases, manifest/backup/native process, trusted time and restore
partial external-state failures on complete frozen source.159-160 separately cover
server/native contracts. All cases remain planned and unexecuted. Further ops CLI/
upgrade/public type/default/consumer and packages native format/asset/full repository
inventory, example/candidate content identity and foundation acceptance remain open.
Functional/MySQL/native/network evidence belongs to later authorized Actions;
physical/long-run/backup safety/release acceptance remains independent and unproven.
