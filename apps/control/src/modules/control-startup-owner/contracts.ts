export const CONTROL_STARTUP_INTERFACE_VERSION=1 as const;

export interface ControlStartupOptions<Policy extends object> {
    databaseUrl:string;caCert:string;caKey:string;serverCert:string;serverKey:string;
    stateDirectory:string;openssl:string;relayCredentialSeconds:number;port:number;host:string;
    initializeAuthority:boolean;multihopEnabled:boolean;probeExecutionEnabled:boolean;
    probeScheduleEnabled:boolean;probeIngressEnabled:boolean;probeServicesEnabled:boolean;
    telemetryEnabled:boolean;forwardTelemetryEnabled:boolean;hostTelemetryEnabled:boolean;
    probeTelemetryEnabled:boolean;telemetryRollupsEnabled:boolean;stationAlertsEnabled:boolean;
    webhookDeliveryEnabled:boolean;notificationSecretsDirectory?:string|undefined;
    policy:Policy|(Policy&{maxClockSkewSeconds:number});
}
export interface ControlStartupEffects<Policy extends object> {
    env(name:string):string|undefined;
    readonly defaultPolicy:Policy;
    verifyRelease(path:string,revision:string):Promise<unknown>;
    start(options:ControlStartupOptions<Policy>):Promise<{port:number;close():Promise<void>}>;
    log(message:string):void;
    onSignal(signal:'SIGINT'|'SIGTERM',callback:()=>void):unknown;
}
