import { randomUUID } from 'node:crypto';
import { parseJson } from '@tunex/contracts/shared';
import { parseNodeTelemetrySample, parseForwardTelemetrySample, parseHostTelemetrySample,
    parseProbeTelemetrySample } from '@tunex/contracts/observability';
import { parseRuntimeMessage } from '@tunex/contracts/runtime';
import { parseTransitNegotiation, parseTransitDelivery } from '@tunex/contracts/experimental/transit';
import { parseProbeNegotiation, parseProbeInstance, parseProbeClaim, parseProbeDelivery, parseProbeResult,
    parseProbeTypes, parseProbeServices } from '@tunex/contracts/probe';

export const nativeRequestId=randomUUID;
export const nativeJsonParse=parseJson;
export { parseNodeTelemetrySample, parseForwardTelemetrySample, parseHostTelemetrySample, parseProbeTelemetrySample,
    parseRuntimeMessage, parseTransitNegotiation, parseTransitDelivery, parseProbeNegotiation, parseProbeInstance,
    parseProbeClaim, parseProbeDelivery, parseProbeResult, parseProbeTypes, parseProbeServices };
export function decodeUtf8Chunks(chunks:readonly Uint8Array[]):string {
    return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
}
