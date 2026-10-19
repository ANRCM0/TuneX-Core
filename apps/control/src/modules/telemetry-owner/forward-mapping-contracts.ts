import type { ForwardTelemetryPoint } from '../../compatibility/public.ts';
import type { TelemetryPublishedMapping, TelemetryForwardMappingSource, TelemetryPublishedMappingPort } from '../../framework/public.ts';

export interface ForwardTelemetryMapping extends TelemetryPublishedMapping<ForwardTelemetryPoint['identity'],TelemetryForwardMappingSource> {}

/** Published provenance only: resolving telemetry does not grant or renew execution. */
export interface ForwardTelemetryMappingPort<Tx> extends TelemetryPublishedMappingPort<Tx,
    {nodeId:string;bootId:string;sessionEpoch:number},ForwardTelemetryPoint,ForwardTelemetryMapping> {}
