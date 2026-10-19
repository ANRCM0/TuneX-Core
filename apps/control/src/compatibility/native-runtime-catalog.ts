export { NATIVE_DRIVER_CATALOG, NATIVE_DRIVER_CATALOG_DIGEST } from '@tunex/contracts/runtime';
export type { RuntimeAssignment } from '@tunex/contracts/runtime';

/** Retain the native clone boundary before awaiting the next assignment owner. */
export function nativeCloneSnapshotAssignments<T>(value:T):T {return structuredClone(value);}
