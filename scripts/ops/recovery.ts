import { RelayCoordinator } from '../../apps/control/src/modules/runtime/relay-coordinator.ts';
import { Transport } from '../../apps/control/src/modules/transport.ts';
import type { AuthorityStore } from '../../apps/control/src/infrastructure/authority.ts';
import type { MySqlUnitOfWork,Transaction } from '../../apps/control/src/infrastructure/mysql.ts';
import { Identity } from '../../apps/control/src/modules/identity.ts';
import { Nodes } from '../../apps/control/src/modules/nodes.ts';
import { Forwarding } from '../../apps/control/src/modules/forwarding.ts';
import { RuntimeLedger } from '../../apps/control/src/modules/runtime/ledger.ts';
import { SnapshotAssignmentRegistry } from '../../apps/control/src/modules/runtime/snapshot-assignments.ts';
import { Idempotency } from '../../apps/control/src/modules/idempotency.ts';
import { MySqlProbeInstanceStore } from '../../apps/control/src/infrastructure/mysql-probe-instance-store.ts';
import { MySqlProbePermitStore } from '../../apps/control/src/infrastructure/mysql-probe-permit-store.ts';
import { MySqlProbeHistoryStore } from '../../apps/control/src/infrastructure/mysql-probe-history-store.ts';
import { MySqlProbePlanStore } from '../../apps/control/src/infrastructure/mysql-probe-plan-store.ts';
import { MySqlProbeQualificationStore } from '../../apps/control/src/infrastructure/mysql-probe-qualification-store.ts';
import { MySqlObservationServiceStore } from '../../apps/control/src/infrastructure/mysql-observation-service-store.ts';
import { RecoveryWorkflow,RecoveryQuarantine } from '../../apps/control/src/modules/recovery-owner/public.ts';
import { TelemetryRecovery } from '../../apps/control/src/modules/telemetry-owner/public.ts';
import { StationAlertRecovery } from '../../apps/control/src/modules/station-alert-owner/public.ts';
import { NotificationRecovery } from '../../apps/control/src/modules/notification-owner/public.ts';
import { PathPublicationRecovery } from '../../apps/control/src/modules/path-owner/public.ts';
import { IngressRecovery } from '../../apps/control/src/modules/ingress-owner/public.ts';
import { MySqlTelemetryRecoveryStore } from '../../apps/control/src/infrastructure/mysql-telemetry-recovery-store.ts';
import { MySqlStationAlertRecoveryStore } from '../../apps/control/src/infrastructure/mysql-station-alert-recovery-store.ts';
import { MySqlNotificationRecoveryStore } from '../../apps/control/src/infrastructure/mysql-notification-recovery-store.ts';
import { MySqlPathPublicationRecoveryStore } from '../../apps/control/src/infrastructure/mysql-path-publication-recovery-store.ts';
import { MySqlIngressDeploymentRecoveryStore } from '../../apps/control/src/infrastructure/mysql-ingress-deployment-recovery-store.ts';
import { MySqlIngressMigrationRecoveryStore } from '../../apps/control/src/infrastructure/mysql-ingress-migration-recovery-store.ts';
import { MySqlRecoveryEventStore } from '../../apps/control/src/infrastructure/mysql-recovery-event-store.ts';
import { nativeRecoveryEffects,nativeJsonEncode,nativeWallClockNow } from '../../apps/control/src/compatibility/public.ts';
import type { NativeRecoverySource } from '../../apps/control/src/compatibility/public.ts';

export { trustedRecoveryTime } from '../../apps/control/src/compatibility/public.ts';

/** Original operator entry composes the same native effects and exact owner bindings. */
function recoveryWorkflow():RecoveryWorkflow<Transaction,MySqlUnitOfWork,NativeRecoverySource> {
 return new RecoveryWorkflow<Transaction,MySqlUnitOfWork,NativeRecoverySource>({native:nativeRecoveryEffects,quarantine:async(db,tx,context)=>{
  const ingress=new IngressRecovery(new MySqlIngressDeploymentRecoveryStore(),new MySqlIngressMigrationRecoveryStore());
  const quarantine=new RecoveryQuarantine<Transaction>({owners:{
   identity:current=>new Identity(db).quarantineRecovery(current),
   transport:current=>Transport.quarantineRecovery(current),
   relay:current=>RelayCoordinator.quarantineRecovery(current),
   nodes:current=>Nodes.quarantineRecovery(current),
   telemetry:current=>new TelemetryRecovery(new MySqlTelemetryRecoveryStore()).quarantineRecovery(current),
   station:current=>new StationAlertRecovery(new MySqlStationAlertRecoveryStore(),nativeJsonEncode).quarantineRecovery(current),
   notification:current=>new NotificationRecovery(new MySqlNotificationRecoveryStore(),nativeWallClockNow).quarantineRecovery(current),
   probeHistory:current=>MySqlProbeHistoryStore.quarantineRecovery(current),
   probePlans:current=>MySqlProbePlanStore.quarantineRecovery(current),
   probeQualifications:current=>MySqlProbeQualificationStore.quarantineRecovery(current),
   observationServices:current=>MySqlObservationServiceStore.quarantineRecovery(current),
   pathPublications:(current,at)=>new PathPublicationRecovery(new MySqlPathPublicationRecoveryStore()).quarantineRecovery(current,at),
   ingressDeployments:(current,at)=>ingress.quarantineDeployments(current,at),
   ingressMigrations:(current,at)=>ingress.quarantineMigrations(current,at),
   probeInstances:current=>MySqlProbeInstanceStore.quarantineRecovery(current),
   probePermits:current=>MySqlProbePermitStore.quarantineRecovery(current),
   forwards:current=>new Forwarding().quarantineRecovery(current),
   ledger:current=>new RuntimeLedger(undefined,undefined,new SnapshotAssignmentRegistry([])).quarantineRecovery(current),
   idempotency:current=>new Idempotency().quarantineRecovery(current),
  },events:new MySqlRecoveryEventStore(),effects:{now:nativeWallClockNow,encode:nativeJsonEncode}});
  await quarantine.run(tx,context);
 }});
}

export async function backupDatabase(options:{databaseUrl:string;authority:AuthorityStore;directory:string;mysqldump:string;notificationSecretsDirectory?:string}):Promise<string> {
 return recoveryWorkflow().backupDatabase(options);
}
export async function restoreDatabase(options:{sourceDatabaseUrl:string;targetDatabase:string;manifest:string;authority:AuthorityStore;newTrustDigest:string;mysql:string;credentialsDirectory:string;issuersStopped:boolean;timeChecker:string;timeCheckerArgs?:string[];notificationSecretsDirectory?:string}):Promise<{recoveryId:string;databaseUrl:string;ownerCredentials:string}> {
 return recoveryWorkflow().restoreDatabase(options);
}
