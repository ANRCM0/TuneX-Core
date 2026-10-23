import { MySqlControlBootstrapStore } from './infrastructure/mysql-control-bootstrap.ts';
import { checkControlServerPreflight } from './modules/control-startup-owner/public.ts';
import { nativeProtectedNotificationRoot } from './compatibility/public.ts';
import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { getRequestListener } from '@hono/node-server';
import { MySqlUnitOfWork } from './infrastructure/mysql.ts';
import { createMySqlRuntimeResources, MySqlRuntimeResourceStore } from './infrastructure/mysql-runtime-resources.ts';
import { MySqlNodeAuthorityStore } from './infrastructure/mysql-node-authority.ts';
import { NodePortLimitPolicy } from './modules/node-owner/public.ts';
import { NodeCertificateAuthority } from './infrastructure/pki.ts';
import { Identity } from './modules/identity.ts';
import { Nodes } from './modules/nodes.ts';
import { ControlApplication } from './application/control.ts';
import { RuntimeController } from './modules/runtime/controller.ts';
import { createControlApp } from './api/public.ts';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { Policy } from '@tunex/contracts/shared';
import { AuthorityStore,trustDigest } from './infrastructure/authority.ts';
import { MySqlTelemetryDatabase, MySqlTelemetryStore } from './infrastructure/mysql-telemetry.ts';
import { NodeTelemetry } from './modules/telemetry-owner/public.ts';
import { ForwardTelemetry } from './modules/telemetry-owner/public.ts';
import { MySqlForwardTelemetryStore } from './infrastructure/mysql-forward-telemetry.ts';
import { MySqlForwardTelemetryMapping } from './infrastructure/mysql-forward-telemetry-mapping.ts';
import { HostTelemetry } from './modules/telemetry-owner/public.ts';
import { MySqlHostTelemetryStore } from './infrastructure/mysql-host-telemetry.ts';
import { ProbeTelemetry } from './modules/telemetry-owner/public.ts';
import { MySqlProbeTelemetryStore } from './infrastructure/mysql-probe-telemetry.ts';
import { MySqlProbeTelemetryMapping } from './infrastructure/mysql-probe-telemetry-mapping.ts';
import { MySqlTelemetryRollupStorage } from './infrastructure/mysql-telemetry-rollup-storage.ts';
import { telemetryRollupStorageValues } from './modules/telemetry-owner/public.ts';
import { TelemetryRollups } from './modules/telemetry-owner/public.ts';
import { ForwardDiagnostics } from './modules/forward-diagnostic-owner/public.ts';
import { MySqlForwardDiagnosticReadStore } from './infrastructure/mysql-forward-diagnostic-read-store.ts';
import { AuditEvents } from './modules/audit-owner/public.ts';
import { MySqlAuditReadStore } from './infrastructure/mysql-audit-read-store.ts';
import { AuditReadModels, auditStoragePolicy } from './modules/audit-owner/public.ts';
import { StationAlerts } from './modules/station-alert-owner/public.ts';
import { MySqlStationAlertStorage } from './infrastructure/mysql-station-alert-storage.ts';
import { MySqlStationAlertFactStore } from './infrastructure/mysql-station-alert-fact-store.ts';
import { stationAlertStorageValues, stationAlertFactValues } from './modules/station-alert-owner/public.ts';
import { NotificationEndpoints } from './modules/notification-owner/public.ts';
import { MySqlNotificationEndpointStore } from './infrastructure/mysql-notification-endpoint-store.ts';
import { notificationEndpointStorageValues } from './modules/notification-owner/public.ts';
import { notificationOutboxStorageValues } from './modules/notification-owner/public.ts';
import { FileNotificationSecrets } from './infrastructure/notification-secrets.ts';
import { digest } from '@tunex/contracts/shared';
import { NotificationDeliveries } from './modules/notification-owner/public.ts';
import { MySqlNotificationOutboxStore } from './infrastructure/mysql-notification-outbox-store.ts';
import { ControlledNotificationHttps } from './infrastructure/notification-https.ts';
import { ProbeRuns } from './modules/probe-history-owner/public.ts';
import { MySqlProbeHistoryStore } from './infrastructure/mysql-probe-history-store.ts';
import { probeRunStorageValues } from './modules/probe-history-owner/public.ts';
import { ProbePlans } from './modules/probe-plan-owner/public.ts';
import { MySqlProbePlanStore } from './infrastructure/mysql-probe-plan-store.ts';
import { probePlanStorageValues } from './modules/probe-plan-owner/public.ts';
import { ObservationServices } from './modules/observation-service-owner/public.ts';
import { MySqlObservationServiceStore } from './infrastructure/mysql-observation-service-store.ts';
import { observationServiceStorageValues } from './modules/observation-service-owner/public.ts';
import { BackgroundTasks } from './framework/public.ts';
import { nativeBackgroundTaskEffects } from './compatibility/public.ts';
import { RequestLifecycle } from './framework/public.ts';

export interface ServerOptions { databaseUrl:string; caCert:string; caKey:string; serverCert:string; serverKey:string; openssl:string; stateDirectory:string; port:number; host?:string; worker?:boolean;credentialOverlapSeconds?:number;relayCredentialSeconds?:number;policy?:Policy;initializeAuthority?:boolean;multihopEnabled?:boolean;probeExecutionEnabled?:boolean;probeScheduleEnabled?:boolean;probeIngressEnabled?:boolean;probeServicesEnabled?:boolean;telemetryEnabled?:boolean;forwardTelemetryEnabled?:boolean;hostTelemetryEnabled?:boolean;probeTelemetryEnabled?:boolean;telemetryRollupsEnabled?:boolean;stationAlertsEnabled?:boolean;notificationSecretsDirectory?:string|undefined;webhookDeliveryEnabled?:boolean }
export async function startControl(options:ServerOptions):Promise<{ port:number; db:MySqlUnitOfWork; control:ControlApplication; runtime:RuntimeController;authority:AuthorityStore; close:()=>Promise<void> }> {
  const policy=checkControlServerPreflight(options,DEFAULT_POLICY);
  const db=new MySqlUnitOfWork(options.databaseUrl); await db.migrate();
  const bootstrap=new MySqlControlBootstrapStore(db);
  const obsolete=await bootstrap.obsoleteSnapshots();if(obsolete[0]!.n>0){await db.close();throw new Error('UNSUPPORTED_PROTOCOL_VERSION: ADP/2 persisted history is unsupported; use a fresh ADP/3 deployment without resetting old Node identities');}
  const records=await bootstrap.authorityIdentity();const authority=new AuthorityStore(options.stateDirectory);
  try{await authority.initialize(records[0]!.name,trustDigest(await readFile(options.caCert)),options.initializeAuthority===true&&records[0]!.nodes===0);}catch(error){await db.close();throw error;}db.guard=()=>authority.allow();
  const identity=new Identity(db), ca=new NodeCertificateAuthority(options.openssl,options.caCert,options.caKey,options.stateDirectory);
  const portLimits=new NodePortLimitPolicy(new MySqlNodeAuthorityStore(),new MySqlRuntimeResourceStore());
  const resources=createMySqlRuntimeResources(portLimits,policy.maxAssignmentsPerNode);
  const nodes=new Nodes(db,identity,ca,options.credentialOverlapSeconds??120,options.relayCredentialSeconds??86400,resources,portLimits), control=new ControlApplication(db,identity,nodes,options.policy,options.multihopEnabled===true,options.probeExecutionEnabled===true,options.probeIngressEnabled===true,options.probeServicesEnabled===true,resources);
  const telemetryDb=new MySqlTelemetryDatabase(options.databaseUrl);telemetryDb.guard=()=>authority.allow();
  const rollupStore=new MySqlTelemetryRollupStorage(telemetryRollupStorageValues),recorder=options.telemetryRollupsEnabled===true?rollupStore:undefined;
  const nodeTelemetryStore=new MySqlTelemetryStore(),forwardTelemetryStore=new MySqlForwardTelemetryStore();
  const telemetry=new NodeTelemetry(telemetryDb,identity,control.readAccess,nodes,nodeTelemetryStore,options.telemetryEnabled===true,Date.now,recorder);
  const forwardTelemetry=new ForwardTelemetry(telemetryDb,identity,control.readAccess,nodes,forwardTelemetryStore,new MySqlForwardTelemetryMapping(),options.forwardTelemetryEnabled===true,Date.now,recorder);
  const hostTelemetry=new HostTelemetry(telemetryDb,identity,control.readAccess,nodes,new MySqlHostTelemetryStore(),options.hostTelemetryEnabled===true,Date.now,recorder);
  const probeTelemetry=new ProbeTelemetry(telemetryDb,identity,control.readAccess,nodes,new MySqlProbeTelemetryStore(),new MySqlProbeTelemetryMapping(),options.probeTelemetryEnabled===true,Date.now,recorder);
  const telemetryRollups=new TelemetryRollups(telemetryDb,identity,control.readAccess,rollupStore,
    {node:(tx,id)=>nodeTelemetryStore.node(tx,id),forward:(tx,scope,id)=>forwardTelemetryStore.forward(tx,scope,id)},options.telemetryRollupsEnabled===true);
  const diagnostics=new ForwardDiagnostics(telemetryDb,identity,control.readAccess,new MySqlForwardDiagnosticReadStore(),
    {freshnessMs:policy.observationFreshnessSeconds*1000,clockSkewMs:policy.maxClockSkewSeconds*1000});
  const audit=new AuditEvents(telemetryDb,identity,new AuditReadModels(new MySqlAuditReadStore(auditStoragePolicy)));
  const observationServices=new ObservationServices(telemetryDb,identity,control.idempotency,new MySqlObservationServiceStore(observationServiceStorageValues),Date.now,control.probes.servicesEnabled);
  const probeRuns=new ProbeRuns(telemetryDb,identity,control.readAccess,new MySqlProbeHistoryStore(probeRunStorageValues),Date.now,policy.maxClockSkewSeconds*1000);
  const probePlans=new ProbePlans({db:telemetryDb,auth:identity,access:control.readAccess,requests:control.idempotency,store:new MySqlProbePlanStore(probePlanStorageValues),
    issuer:{previewIn:(tx,actor,scope,config)=>control.probePlans.authorize(tx,actor,scope,config.forwardId,
      {version:1,kind:config.kind,expectedRevision:config.expectedForwardRevision,timeoutMs:config.timeoutMs,...(config.service?{service:config.service}:{})}),
    issueIn:(tx,actor,scope,config)=>control.probes.issueIn(tx,actor,scope,config.forwardId,
      {version:1,kind:config.kind,expectedRevision:config.expectedForwardRevision,timeoutMs:config.timeoutMs,...(config.service?{service:config.service}:{})},config.expiresAt)},
    executionEnabled:options.probeExecutionEnabled===true,scheduleEnabled:options.probeScheduleEnabled===true,ingressExecutionEnabled:control.probes.ingressEnabled,servicesExecutionEnabled:control.probes.servicesEnabled,clockSkewMs:policy.maxClockSkewSeconds*1000});
  let notificationSecrets:FileNotificationSecrets|undefined;
  try {
    if (options.notificationSecretsDirectory!==undefined) {
      const root=nativeProtectedNotificationRoot(options);
      notificationSecrets=await FileNotificationSecrets.open(root);
    }
  } catch(error) { await telemetryDb.close();await db.close();throw error; }
  const notificationStore=new MySqlNotificationEndpointStore(notificationEndpointStorageValues),stationStore=new MySqlStationAlertStorage(stationAlertStorageValues),notificationBinding=async()=>{
    const record=await authority.read();return digest({database:record.database,trustDigest:record.trustDigest,recoveryId:record.recoveryId});
  };
  const notificationDeliveries=new NotificationDeliveries({db:telemetryDb,auth:identity,store:new MySqlNotificationOutboxStore(notificationOutboxStorageValues),endpoints:notificationStore,
    policies:stationStore,secrets:notificationSecrets,sender:new ControlledNotificationHttps(),authorityBinding:notificationBinding,
    enabled:options.webhookDeliveryEnabled===true,clockSkewMs:policy.maxClockSkewSeconds*1000});
  const stationAlerts=new StationAlerts(telemetryDb,identity,control.idempotency,stationStore,new MySqlStationAlertFactStore(stationAlertFactValues),
    options.stationAlertsEnabled===true,Date.now,policy.maxClockSkewSeconds*1000,notificationDeliveries);
  const notificationEndpoints=new NotificationEndpoints(telemetryDb,identity,control.idempotency,notificationStore,stationStore,
    notificationSecrets,notificationBinding,Date.now,notificationDeliveries.enabled);
  const requests=new RequestLifecycle();
  const runtime=new RuntimeController(db,nodes,control.forwarding,control.ledger,options.policy,authority,control.relay,control.resourceLimits), app=createControlApp({control,runtime,authority,requests,
    services:{telemetry,forwardTelemetry,authenticateObservation:header=>telemetryDb.transaction(tx=>identity.authenticateIn(tx,header)),
      hostTelemetry,probeTelemetry,telemetryRollups,diagnostics,audit,stationAlerts,notificationEndpoints,notificationDeliveries,probeRuns,probePlans,observationServices}});
  const workers=options.worker!==false,backoff={initialMs:30000,maxMs:300000};
  const tasks=new BackgroundTasks([
    {id:'runtime',intervalMs:250,enabled:workers,run:async()=>{if(!(await authority.read()).maintenance)await runtime.tick();},
      onFailure:()=>console.error('Runtime tick failed')},
    {id:'telemetry-retention',intervalMs:30000,enabled:workers,run:async()=>{
      let deferred=false;
      // Families retain their serial use of the two independent observation slots.
      for(const prune of [()=>telemetry.prune(),()=>forwardTelemetry.prune(),()=>hostTelemetry.prune(),()=>probeTelemetry.prune(),()=>telemetryRollups.prune()])
        try{await prune();}catch{deferred=true;}
      if(deferred)throw new Error('Telemetry retention deferred');
    },onFailure:()=>console.error('Telemetry retention deferred')},
    {id:'station-alerts',intervalMs:5000,enabled:workers&&stationAlerts.enabled,run:()=>stationAlerts.tick(),failureDelay:backoff,
      onFailure:()=>console.error('Station alert observation deferred')},
    {id:'notification-delivery',intervalMs:1000,enabled:workers&&notificationDeliveries.enabled,run:()=>notificationDeliveries.tick(),failureDelay:backoff,
      onStop:()=>notificationDeliveries.close(),onFailure:()=>console.error('Notification delivery deferred')},
    {id:'probe-plans',intervalMs:1000,enabled:workers&&probePlans.scheduleEnabled,run:()=>probePlans.tick(),failureDelay:backoff,
      onStop:()=>probePlans.close(),onFailure:()=>console.error('Probe plan schedule deferred')},
  ],nativeBackgroundTaskEffects);
  const server=await (async()=>{
    try {
      const owned=createServer({ key:await readFile(options.serverKey),cert:await readFile(options.serverCert),ca:await readFile(options.caCert),requestCert:true,rejectUnauthorized:false,minVersion:'TLSv1.3' },getRequestListener(app.fetch));
      await new Promise<void>((resolve,reject)=>{owned.once('error',reject);owned.listen(options.port,options.host??'127.0.0.1',resolve);});
      return owned;
    } catch(error) { requests.stopAdmission();await Promise.allSettled([tasks.close(),requests.drain()]);await Promise.allSettled([notificationSecrets?.close(),telemetryDb.close(),db.close()]);throw error; }
  })();
  tasks.start();
  let closing:Promise<void>|undefined;
  const close=()=>closing??=(async()=>{
    requests.stopAdmission();tasks.stopAdmission();server.closeAllConnections();
    const stopping=await Promise.allSettled([tasks.close(),requests.drain(),
      new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))]);
    const dependencies=await Promise.allSettled([notificationSecrets?.close(),telemetryDb.close(),db.close()]);
    if([...stopping,...dependencies].some(result=>result.status==='rejected'))throw new Error('Control shutdown failed after draining');
  })();
  return {port:(server.address() as {port:number}).port,db,control,runtime,authority,close};
}
