import type { ProbeTelemetryPoint } from '../../compatibility/public.ts';
import type { TelemetryProbeMapping, TelemetryObservedMappingPort } from '../../framework/public.ts';

export interface ProbeTelemetryMapping extends TelemetryProbeMapping<ProbeTelemetryPoint['identity']> {}

/** Published observation provenance only, never proof that a permit executed. */
export interface ProbeTelemetryMappingPort<Tx> extends TelemetryObservedMappingPort<Tx,
    {nodeId:string;bootId:string;sessionEpoch:number;fingerprint:string},ProbeTelemetryPoint,ProbeTelemetryMapping> {}
