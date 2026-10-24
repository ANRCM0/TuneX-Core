import type { ForwardProbeCapabilityView } from './capability-contracts.ts';

export const FORWARD_PROBE_CAPABILITY_API_INTERFACE_VERSION = 3 as const;

/** Explains original Probe support; never issues or reserves a Probe permit. */
export interface ForwardProbeCapabilitiesApi {
    get(actor: string, scope: string, forward: string): Promise<ForwardProbeCapabilityView>;
}
