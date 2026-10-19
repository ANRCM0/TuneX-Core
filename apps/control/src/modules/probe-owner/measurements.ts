import { PROBE_INGRESS_MEASUREMENT, PROBE_SERVICE_MEASUREMENT, PROBE_TCP_ECHO_MEASUREMENT, PROBE_UDP_ECHO_MEASUREMENT } from './measurement-contracts.ts';
import type { ProbeMeasurement, ProbeMeasurementDescription } from './measurement-contracts.ts';
export { PROBE_EGRESS_MEASUREMENT, PROBE_INGRESS_MEASUREMENT, PROBE_SERVICE_MEASUREMENT, PROBE_TCP_ECHO_MEASUREMENT, PROBE_UDP_ECHO_MEASUREMENT,
    PROBE_TYPED_MEASUREMENTS, PROBE_SERVICE_MEASUREMENTS, PROBE_ECHO_MEASUREMENTS } from './measurement-contracts.ts';
export type { ProbeMeasurement, ProbeMeasurementDescription, ProbeTypeQualification, ProbeTypeQualifications } from './measurement-contracts.ts';
export const isEchoMeasurement = (value:unknown) => value===PROBE_TCP_ECHO_MEASUREMENT||value===PROBE_UDP_ECHO_MEASUREMENT;
export function probeMeasurement(measurement:ProbeMeasurement):ProbeMeasurementDescription {
    if(measurement===PROBE_TCP_ECHO_MEASUREMENT||measurement===PROBE_UDP_ECHO_MEASUREMENT) {
        const tcp=measurement===PROBE_TCP_ECHO_MEASUREMENT;
        return {measurement,taskKind:tcp?'tcp-ingress-echo' as const:'udp-ingress-echo' as const,
            point:'agent-local-direct-ingress' as const,capability:tcp?'probe.tcp-ingress-echo.v1' as const:'probe.udp-ingress-echo.v1' as const};
    }
    if(measurement===PROBE_SERVICE_MEASUREMENT)return {measurement,taskKind:'tcp-ingress-tls' as const,
        point:'agent-local-direct-ingress' as const,capability:'probe.tcp-ingress-tls.v1' as const};
    return measurement===PROBE_INGRESS_MEASUREMENT?
        {measurement,taskKind:'tcp-ingress-connect' as const,point:'agent-local-direct-ingress' as const,capability:'probe.tcp-ingress-connect.v1' as const}:
        {measurement,taskKind:'tcp-connect' as const,point:'agent-direct-egress' as const,capability:'probe.tcp-connect.v1' as const};
}
export function probeEchoMeasurement(measurement:typeof PROBE_TCP_ECHO_MEASUREMENT|typeof PROBE_UDP_ECHO_MEASUREMENT):
    Extract<ProbeMeasurementDescription,{measurement:'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'}>&{businessProtocol:'tcp'|'udp'};
export function probeEchoMeasurement(measurement:ProbeMeasurement):ProbeMeasurementDescription&{businessProtocol:'tcp'|'udp'};
export function probeEchoMeasurement(measurement:ProbeMeasurement) {
    return {...probeMeasurement(measurement),businessProtocol:measurement===PROBE_UDP_ECHO_MEASUREMENT?'udp' as const:'tcp' as const};
}
