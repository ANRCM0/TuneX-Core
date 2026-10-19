import type { StationAlertCommandResponse, StationAlertEvent, StationAlertLosses, StationAlertPolicy,
    StationAlertPolicyAudit, StationAlertReason, StationAlertState, StationEventQuery } from './contracts.ts';
import type { STATION_ALERT_LIMITS } from './policy.ts';

export const STATION_ALERT_API_INTERFACE_VERSION=1 as const;

export interface StationAlertEnvelope {
    stationAlertsVersion:number;scopeId:string;capturedAt:number;observerEnabled:boolean;
    source:'persisted-station-alerts';readOnly:true;executionAuthorized:false;health:'unknown';
    networkCheck:'not-performed';consistency:'read-committed-not-global-snapshot';limits:typeof STATION_ALERT_LIMITS;
}
export type StationAlertPolicySummary=Omit<StationAlertPolicy,'state'>&{
    condition:StationAlertState['condition'];evaluatedAt:number|null;lastReason:StationAlertReason|null;
};
export interface StationAlertPolicies extends StationAlertEnvelope {items:StationAlertPolicySummary[]}
export interface StationAlertPolicyDetail extends StationAlertEnvelope {
    policy:StationAlertPolicy;audit:{items:StationAlertPolicyAudit[];truncated:boolean};
}
export interface StationAlertEventDetail extends StationAlertEnvelope {event:StationAlertEvent}
export interface StationAlertHistory extends StationAlertEnvelope {
    window:{from:number;to:number};filters:Pick<StationEventQuery,'policyId'|'targetId'|'rule'|'kind'|'acknowledged'>;
    limit:number;items:StationAlertEvent[];hasMore:boolean;nextCursor:string|null;losses:StationAlertLosses;
}
export interface StationAlertsApi {
    admitRequest<T>(action:()=>Promise<T>):Promise<T>;
    listPolicies(actor:string,scope:string):Promise<StationAlertPolicies>;
    getPolicy(actor:string,scope:string,id:string):Promise<StationAlertPolicyDetail>;
    publish(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<StationAlertCommandResponse>;
    history(actor:string,scope:string,input:Record<string,string|undefined>):Promise<StationAlertHistory>;
    getEvent(actor:string,scope:string,id:string):Promise<StationAlertEventDetail>;
    acknowledge(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<StationAlertCommandResponse>;
    silence(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,until:number|null):Promise<StationAlertCommandResponse>;
}
