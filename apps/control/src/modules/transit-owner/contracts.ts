import type { TransitNegotiationRequest, TransitNegotiationResponse, TransitPreviewCommand, TransitDeliveryReport, TransitDeliveryAck } from '../../compatibility/public.ts';

export const TRANSIT_API_INTERFACE_VERSION=1 as const;
export interface TransitNegotiationApi {
    hello(nodeId:string,fingerprint:string,epoch:number,request:TransitNegotiationRequest):Promise<TransitNegotiationResponse>;
}
/** Preview transport only: no enqueue, coordinator confirmation or executor. */
export interface TransitDeliveryApi {
    poll(node:string,fingerprint:string,epoch:number,boot:string):Promise<TransitPreviewCommand|null>;
    report(node:string,fingerprint:string,epoch:number,report:TransitDeliveryReport):Promise<TransitDeliveryAck>;
}
