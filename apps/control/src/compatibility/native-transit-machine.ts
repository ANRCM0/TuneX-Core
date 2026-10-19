import { TRANSIT_NEGOTIATION_CAPABILITIES } from '@tunex/contracts/experimental/transit';
import type { TransitNegotiationResponse } from '@tunex/contracts/experimental/transit';

/** Format already-authorized facts; no clock read, state read or execution grant. */
export function nativeTransitNegotiationAck(nodeId:string,bootId:string,epoch:number,now:number):TransitNegotiationResponse {
    return {
        protocolVersion:3,extensionVersion:1,nodeId,bootId,
        sessionEpoch:epoch,requiredCapabilities:TRANSIT_NEGOTIATION_CAPABILITIES,
        serverTime:new Date(now).toISOString(),
        state:'contract-only',executionEnabled:false,
    };
}
export { TRANSIT_NEGOTIATION_CAPABILITIES };
export type { TransitIntent, TransitNegotiationRequest, TransitNegotiationResponse, TransitPreviewCommand, TransitDeliveryReport, TransitDeliveryAck } from '@tunex/contracts/experimental/transit';
