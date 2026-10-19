import type { NodeReportObservation } from './contracts.ts';

export const NODE_OBSERVATION_API_INTERFACE_VERSION=1 as const;

export interface NodeObservationApi {
    observe(actorId:string,scopeId:string,nodeId:string,input:unknown,signal?:AbortSignal):Promise<NodeReportObservation>;
}
