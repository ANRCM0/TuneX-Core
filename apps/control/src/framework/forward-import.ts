import { deepFreeze, isId, parseForwardSpec } from '@tunex/core';
import type { ForwardSpec } from '@tunex/core';
import { invalid } from './errors.ts';

export type ForwardIntent=ForwardSpec;
export interface ForwardImportAdapter {
    readonly formatId:string;
    readonly formatVersion:number;
    /** Pure conversion to a detached immutable intent; no I/O or current authority reads. */
    parse(input:unknown):ForwardIntent;
}
export function parseForwardIntent(input:unknown):ForwardIntent {
    const parsed=parseForwardSpec(input);
    if(!parsed.ok)invalid('Valid Forward intent required');
    return parsed.value;
}
export function requireScopedIdentity(actor:string,scope:string):void {
    if(!isId(actor)||!isId(scope))invalid('Valid actor and Scope required');
}
export function freezeModuleValue<T>(value:T):T {return deepFreeze(value);}
