import { parseNodeTelemetryAck, parseHostTelemetryAck, parseForwardTelemetryAck, parseProbeTelemetryAck } from './native-observability-codecs.ts';
import type { NodeTelemetrySample, HostTelemetrySample, ForwardTelemetrySample, ProbeTelemetrySample } from './native-observability-codecs.ts';
import { nativeIsoTime } from './native-module-values.ts';

/** Original projections only; admission, counts and storage decisions stay with each owner. */
export function nativeNodeTelemetryAck(sample:NodeTelemetrySample,receivedAt:number) {
    return parseNodeTelemetryAck({ telemetryVersion: 1, kind: 'telemetry-ack', nodeId: sample.nodeId,
        bootId: sample.bootId, sessionEpoch: sample.sessionEpoch, sampleEpoch: sample.sampleEpoch, sequence: sample.sequence,
        stored: true, receivedAt: nativeIsoTime(receivedAt), source: 'agent-reported', executionAuthorized: false });
}
export function nativeHostTelemetryAck(sample:HostTelemetrySample,receivedAt:number) {
    return parseHostTelemetryAck({ hostTelemetryVersion: 1, kind: 'host-telemetry-ack', nodeId: sample.nodeId,
        bootId: sample.bootId, sessionEpoch: sample.sessionEpoch, sampleEpoch: sample.sampleEpoch, sequence: sample.sequence,
        stored: true, receivedAt: nativeIsoTime(receivedAt), source: 'agent-reported', executionAuthorized: false });
}
export function nativeForwardTelemetryAck(sample:ForwardTelemetrySample,at:number,accepted:number,rejected:number) {
    return parseForwardTelemetryAck({ forwardTelemetryVersion: 1, kind: 'forward-telemetry-ack',
        nodeId: sample.nodeId, bootId: sample.bootId, sessionEpoch: sample.sessionEpoch,
        sampleEpoch: sample.sampleEpoch, sequence: sample.sequence, receivedAt: nativeIsoTime(at),
        stored: true, acceptedPoints: accepted, rejectedPoints: rejected, source: 'agent-reported', executionAuthorized: false });
}
export function nativeProbeTelemetryAck(sample:ProbeTelemetrySample,at:number,accepted:number,rejected:number) {
    return parseProbeTelemetryAck({ probeTelemetryVersion: 1, kind: 'probe-telemetry-ack',
        nodeId: sample.nodeId, bootId: sample.bootId, sessionEpoch: sample.sessionEpoch,
        sampleEpoch: sample.sampleEpoch, sequence: sample.sequence, receivedAt: nativeIsoTime(at),
        stored: true, acceptedPoints: accepted, rejectedPoints: rejected, source: 'agent-reported', executionAuthorized: false });
}
