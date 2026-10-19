import type { ReadProjectionValues } from '../framework/public.ts';
import { readStoredValue } from './stored-value.ts';

export const nativeReadProjectionValues:ReadProjectionValues=Object.freeze({
    read:readStoredValue,
    now:()=>Date.now(),
    iso:(at:number)=>new Date(at).toISOString(),
    currentIso:()=>new Date().toISOString(),
});
