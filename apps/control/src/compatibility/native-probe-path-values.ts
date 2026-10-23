import type { RuntimeAssignment } from './native-runtime-catalog.ts';

/** Decode native representation only; current route admission remains with its owners. */
export function nativeProbePathPolicyRevision(assignment:RuntimeAssignment):number|undefined {
    const config=assignment.driver.config as {egressPolicyRevision?:number;hop?:{egressPolicyRevision:number}};
    return (config.hop??config).egressPolicyRevision;
}
