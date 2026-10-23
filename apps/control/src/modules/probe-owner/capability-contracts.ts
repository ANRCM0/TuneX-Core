import type { ProbeMeasurementDescription } from './measurement-contracts.ts';

/** Read the original ForwardProbes switches; possession does not authorize issuance. */
export interface ForwardProbeIssuanceState {
    readonly enabled: boolean;
    readonly ingressEnabled: boolean;
    readonly servicesEnabled: boolean;
    readonly echoEnabled?: boolean; readonly pathEchoEnabled?:boolean;
}

export interface ForwardProbeCapabilityReason {
    readonly code: 'PREFLIGHT_AVAILABLE' | 'PROBE_UNAVAILABLE' | 'UNSUPPORTED_CAPABILITY' |
        'REVISION_CONFLICT' | 'CONTROLLED_SERVICE_REQUIRED';
    readonly message: string;
}

export type ForwardProbeCapabilityItem = ProbeMeasurementDescription & {
    readonly protocol: 'tcp' | 'udp';
    readonly endToEnd: false;
    readonly health: 'unknown';
    readonly transportSupport: 'supported' | 'unsupported';
    readonly issuance: 'enabled' | 'disabled' | 'not-dispatchable';
    readonly issuanceReason: string;
    readonly preflight: {
        readonly state: 'available' | 'unavailable' | 'unsupported' | 'requires-controlled-service';
        readonly reason: ForwardProbeCapabilityReason;
        readonly expiresAt: string | null;
    };
};

export interface ForwardProbeCapabilityView {
    readonly capabilityVersion: 1|2;
    readonly scopeId: string;
    readonly forwardId: string;
    readonly forwardRevision: number;
    readonly mode: 'direct' | 'relay' | 'multihop';
    readonly readOnly: true;
    readonly networkCheck: 'not-performed';
    readonly executionAuthorized: false;
    readonly endToEnd: false;
    readonly health: 'unknown';
    readonly consistency: 'read-committed-not-global-snapshot';
    readonly items: readonly ForwardProbeCapabilityItem[];
    readonly diagnostics: {
        readonly apiPath: string;
        readonly source: 'persisted-control-and-agent-state';
        readonly readOnly: true;
        readonly networkCheck: 'not-performed';
        readonly health: 'unknown';
        readonly description: string;
    };
}
