import type { ProbeQualificationStoredRecord } from '../../framework/public.ts';

export const PROBE_EGRESS_MEASUREMENT = 'tcp-connect-v1' as const;
export const PROBE_INGRESS_MEASUREMENT = 'tcp-ingress-connect-v1' as const;
export const PROBE_SERVICE_MEASUREMENT = 'tcp-ingress-tls-v1' as const;
export const PROBE_TCP_ECHO_MEASUREMENT = 'tcp-ingress-echo-v1' as const;
export const PROBE_UDP_ECHO_MEASUREMENT = 'udp-ingress-echo-v1' as const;
export type ProbeMeasurement = typeof PROBE_EGRESS_MEASUREMENT | typeof PROBE_INGRESS_MEASUREMENT | typeof PROBE_SERVICE_MEASUREMENT |
    typeof PROBE_TCP_ECHO_MEASUREMENT | typeof PROBE_UDP_ECHO_MEASUREMENT;
export const PROBE_TYPED_MEASUREMENTS = [PROBE_EGRESS_MEASUREMENT,PROBE_INGRESS_MEASUREMENT] as const;
export const PROBE_SERVICE_MEASUREMENTS = [PROBE_EGRESS_MEASUREMENT,PROBE_INGRESS_MEASUREMENT,PROBE_SERVICE_MEASUREMENT] as const;
export const PROBE_ECHO_MEASUREMENTS = [...PROBE_SERVICE_MEASUREMENTS,PROBE_TCP_ECHO_MEASUREMENT,PROBE_UDP_ECHO_MEASUREMENT] as const;

// The existing helper returns paired unions for echo, not a stronger per-protocol correlation.
export type ProbeMeasurementDescription =
    {measurement:'tcp-connect-v1';taskKind:'tcp-connect';point:'agent-direct-egress';capability:'probe.tcp-connect.v1'} |
    {measurement:'tcp-ingress-connect-v1';taskKind:'tcp-ingress-connect';point:'agent-local-direct-ingress';capability:'probe.tcp-ingress-connect.v1'} |
    {measurement:'tcp-ingress-tls-v1';taskKind:'tcp-ingress-tls';point:'agent-local-direct-ingress';capability:'probe.tcp-ingress-tls.v1'} |
    {measurement:'tcp-ingress-echo-v1'|'udp-ingress-echo-v1';taskKind:'tcp-ingress-echo'|'udp-ingress-echo';point:'agent-local-direct-ingress';capability:'probe.tcp-ingress-echo.v1'|'probe.udp-ingress-echo.v1'};

export interface ProbeTypeQualification extends ProbeQualificationStoredRecord<'qualified'|'revoked'|'quarantined',1,1> {
    /** Explicit v3 proof; absence remains the unchanged v2-only qualification. */
    servicesVersion?:1;
}
/** Qualifies an already registered original Gate; never allocates an instance or execution budget. */
export interface ProbeTypeQualifications<Tx> {
    get(tx:Tx,node:string,lock?:boolean):Promise<ProbeTypeQualification|null>;
    put(tx:Tx,value:ProbeTypeQualification):Promise<void>;
}
