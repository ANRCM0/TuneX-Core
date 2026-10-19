import type { NodeTelemetrySample } from '../../compatibility/public.ts';
import type { TelemetryStoredNode, TelemetryStoredHead, TelemetryStoredPoint, TelemetryStorage } from '../../framework/public.ts';

export interface TelemetryNode extends TelemetryStoredNode {}
export interface TelemetryHead extends TelemetryStoredHead {}
export interface TelemetryPoint extends TelemetryStoredPoint {}
export interface TelemetryStore<Tx> extends TelemetryStorage<Tx,NodeTelemetrySample> {}
export interface TelemetryMachineAuthorization<Tx> {
    credential(tx:Tx,nodeId:string,fingerprint:string):Promise<number>;
}
