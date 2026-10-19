import type { StoredValues } from '../framework/public.ts';

/** Existing persisted JSON behavior: decode strings, otherwise retain the driver value. */
export function readStoredValue<T>(value:unknown):T {
    return (typeof value==='string'?JSON.parse(value):value) as T;
}


export const nativeStoredValues:StoredValues=Object.freeze({read:readStoredValue,encode:(value:unknown)=>JSON.stringify(value)});
