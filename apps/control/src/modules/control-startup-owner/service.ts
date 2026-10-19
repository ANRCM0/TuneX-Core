import type { ControlStartupEffects } from './contracts.ts';

export async function runControlStartup<Policy extends object>(effects:ControlStartupEffects<Policy>):Promise<void> {
function required(name:string):string{const value=effects.env(name);if(!value)throw new Error(`${name} required`);return value;}
const port=Number(effects.env('TUNEX_CONTROL_PORT')??'41001');if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid TUNEX_CONTROL_PORT');
const probeExecutionEnabled=effects.env('TUNEX_PROBE_EXECUTION')==='1';
const probeScheduleEnabled=effects.env('TUNEX_PROBE_SCHEDULE')==='1';
const probeIngressEnabled=effects.env('TUNEX_PROBE_INGRESS')==='1';
const probeServicesEnabled=effects.env('TUNEX_PROBE_SERVICES')==='1';
if(probeServicesEnabled&&(!probeIngressEnabled||!probeExecutionEnabled))throw new Error('TUNEX_PROBE_SERVICES=1 requires TUNEX_PROBE_INGRESS=1 and TUNEX_PROBE_EXECUTION=1');
if(probeIngressEnabled&&!probeExecutionEnabled)throw new Error('TUNEX_PROBE_INGRESS=1 requires TUNEX_PROBE_EXECUTION=1');
if(probeScheduleEnabled&&!probeExecutionEnabled)throw new Error('TUNEX_PROBE_SCHEDULE=1 requires TUNEX_PROBE_EXECUTION=1');
if(probeExecutionEnabled&&effects.env('TUNEX_PROBE_CLOCK_SKEW_SECONDS')!=='1')throw new Error('Probe execution requires TUNEX_PROBE_CLOCK_SKEW_SECONDS=1 and independently synchronized Agent clocks');
if(effects.env('NODE_ENV')==='production'&&effects.env('TUNEX_MULTIHOP_EXECUTION')==='1')await effects.verifyRelease(required('TUNEX_MULTIHOP_RELEASE_EVIDENCE'),required('TUNEX_SOURCE_REVISION'));
const server=await effects.start({databaseUrl:required('DATABASE_URL'),caCert:required('TUNEX_CA_CERT'),caKey:required('TUNEX_CA_KEY'),serverCert:required('TUNEX_SERVER_CERT'),serverKey:required('TUNEX_SERVER_KEY'),stateDirectory:required('TUNEX_CONTROL_STATE'),openssl:effects.env('TUNEX_OPENSSL')??'openssl',relayCredentialSeconds:Number(effects.env('TUNEX_RELAY_CREDENTIAL_SECONDS')??'86400'),port,host:effects.env('TUNEX_CONTROL_HOST')??'127.0.0.1',initializeAuthority:effects.env('TUNEX_AUTHORITY_INITIALIZE')==='1',multihopEnabled:effects.env('TUNEX_MULTIHOP_EXECUTION')==='1',probeExecutionEnabled,probeScheduleEnabled,probeIngressEnabled,probeServicesEnabled,telemetryEnabled:effects.env('TUNEX_TELEMETRY')==='1',forwardTelemetryEnabled:effects.env('TUNEX_FORWARD_TELEMETRY')==='1',hostTelemetryEnabled:effects.env('TUNEX_HOST_TELEMETRY')==='1',probeTelemetryEnabled:effects.env('TUNEX_PROBE_TELEMETRY')==='1',telemetryRollupsEnabled:effects.env('TUNEX_TELEMETRY_ROLLUPS')==='1',stationAlertsEnabled:effects.env('TUNEX_STATION_ALERTS')==='1',webhookDeliveryEnabled:effects.env('TUNEX_WEBHOOK_DELIVERY')==='1',...(effects.env('TUNEX_NOTIFICATION_SECRETS')?{notificationSecretsDirectory:effects.env('TUNEX_NOTIFICATION_SECRETS')}:{}),policy:probeExecutionEnabled?{...effects.defaultPolicy,maxClockSkewSeconds:1}:effects.defaultPolicy});
effects.log(`Control listening on https://${effects.env('TUNEX_CONTROL_HOST')??'127.0.0.1'}:${server.port}`);
let closing=false;async function close(){if(closing)return;closing=true;await server.close();}
effects.onSignal('SIGINT',()=>void close());effects.onSignal('SIGTERM',()=>void close());

}
