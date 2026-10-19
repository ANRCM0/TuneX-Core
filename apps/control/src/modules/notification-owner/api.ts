import type { NotificationEndpoint, NotificationEndpointAudit, NotificationEndpointReceipt } from './endpoint-contracts.ts';
import type { NotificationDelivery, NotificationDeliveryAttempt, NotificationDeliveryLosses, NotificationPayload } from './delivery-contracts.ts';
import type { NOTIFICATION_ENDPOINT_LIMITS, NOTIFICATION_DELIVERY_LIMITS } from './policy.ts';

export const NOTIFICATION_API_INTERFACE_VERSION=1 as const;

// Deliberate public projections exclude credential references, authority material and raw destinations.
export type NotificationEndpointView=Omit<NotificationEndpoint,'authorityDigest'|'credentialRef'>&{
    credentials:{configured:boolean;verification:string};
};
export type NotificationDeliveryView=Omit<NotificationDelivery,'policyManagedBy'|'endpointManagedBy'|'authorityDigest'|'payload'>&{
    event:Omit<NotificationPayload['event'],'id'|'policyId'|'configRevision'>;
};
export interface NotificationEndpointEnvelope {
    notificationEndpointsVersion:number;scopeId:string;capturedAt:number;secretsConfigured:boolean;deliveryAvailable:boolean;
    source:string;readOnly:boolean;executionAuthorized:boolean;health:string;networkCheck:string;consistency:string;
    limits:typeof NOTIFICATION_ENDPOINT_LIMITS;
}
export interface NotificationEndpointList extends NotificationEndpointEnvelope {items:NotificationEndpointView[];auditEvicted:number}
export interface NotificationEndpointDetail extends NotificationEndpointEnvelope {
    endpoint:NotificationEndpointView;audit:{items:NotificationEndpointAudit[];truncated:boolean};auditEvicted:number;
}
export interface NotificationDeliveryEnvelope {
    notificationDeliveriesVersion:number;scopeId:string;capturedAt:number;deliveryEnabled:boolean;workerState:string;
    source:string;readOnly:boolean;executionAuthorized:boolean;health:string;networkCheck:string;consistency:string;
    limits:typeof NOTIFICATION_DELIVERY_LIMITS;
}
export interface NotificationDeliveryDetail extends NotificationDeliveryEnvelope {
    delivery:NotificationDeliveryView;attempts:{items:NotificationDeliveryAttempt[];truncated:boolean};losses:NotificationDeliveryLosses;
}
export interface NotificationDeliveryHistory extends NotificationDeliveryEnvelope {
    window:{from:number;to:number};filters:{endpointId:string|null;eventId:string|null;status:string|null};limit:number;
    items:NotificationDeliveryView[];hasMore:boolean;nextCursor:string|null;losses:NotificationDeliveryLosses;
}
export interface NotificationEndpointsApi {
    admitRequest<T>(action:()=>Promise<T>):Promise<T>;
    list(actor:string,scope:string):Promise<NotificationEndpointList>;
    get(actor:string,scope:string,id:string):Promise<NotificationEndpointDetail>;
    publish(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,input:unknown,destinationInput:unknown):Promise<NotificationEndpointReceipt>;
    disable(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<NotificationEndpointReceipt>;
}
export interface NotificationDeliveriesApi {
    admitRequest<T>(action:()=>Promise<T>):Promise<T>;
    history(actor:string,scope:string,input?:Record<string,string>):Promise<NotificationDeliveryHistory>;
    get(actor:string,scope:string,id:string):Promise<NotificationDeliveryDetail>;
}
