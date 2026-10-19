import { parseTransitDelivery } from '@tunex/contracts/experimental/transit';
import type { TransitDeliveryReport, TransitDeliveryAck, TransitPreviewCommand } from '@tunex/contracts/experimental/transit';
import { digest } from '@tunex/contracts/shared';
import { readStoredValue } from './stored-value.ts';

export interface NativeTransitPreviewFacts {
    nodeId:string; bootId:string; sessionEpoch:number; forwardId:string; deploymentGeneration:number;
    coordinationRevision:number; previewAction:'prepare'|'activate'|'withdraw'; commandDigest:string;
    issuedAt:number; validUntil:number;
}

export function nativeTransitDeliveryCommand(value:unknown):TransitPreviewCommand {
    return parseTransitDelivery('Command',JSON.stringify(readStoredValue(value)));
}

/** Pure preview framing; the caller retains all reservation and deadline decisions. */
export function nativeTransitPreviewCommand(facts:NativeTransitPreviewFacts):TransitPreviewCommand {
    const envelope={
        protocolVersion:3 as const,extensionVersion:1 as const,
        kind:'transit-command-preview-v1' as const,executionEnabled:false as const,
        nodeId:facts.nodeId,bootId:facts.bootId,sessionEpoch:facts.sessionEpoch,
        forwardId:facts.forwardId,deploymentGeneration:facts.deploymentGeneration,
        coordinationRevision:facts.coordinationRevision,previewAction:facts.previewAction,
        commandDigest:facts.commandDigest,
        issuedAt:new Date(facts.issuedAt).toISOString(),validUntil:new Date(facts.validUntil).toISOString(),
    };
    return parseTransitDelivery('Command',JSON.stringify({...envelope,envelopeDigest:digest(envelope)}));
}

/** Format the transport-only receipt ACK after all owner checks have succeeded. */
export function nativeTransitDeliveryAck(report:TransitDeliveryReport,status:'accepted'|'duplicate'):TransitDeliveryAck {
    return parseTransitDelivery('Ack',JSON.stringify({
        protocolVersion:3,extensionVersion:1,kind:'transit-delivery-ack-v1',
        executionEnabled:false,nodeId:report.nodeId,bootId:report.bootId,
        sessionEpoch:report.sessionEpoch,commandDigest:report.commandDigest,
        envelopeDigest:report.envelopeDigest,reportSequence:report.reportSequence,status,
    }));
}
