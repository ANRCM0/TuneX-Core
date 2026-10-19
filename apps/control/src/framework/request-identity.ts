import { isId } from '@tunex/core';
import { invalid } from './errors.ts';
import type { RequestIdentity } from './application-ports.ts';

/** The outer digest is synchronous; no clock, storage or protocol implementation belongs here. */
export function buildRequestIdentity(actorId:string,scopeId:string,key:string|undefined,
    method:string,path:string,input:unknown,digest:(value:unknown)=>string):RequestIdentity {
    if (!isId(actorId) || !isId(scopeId) || !key || key.length>128 || /[^\x21-\x7e]/.test(key))
        invalid('Valid identity, scope and Idempotency-Key required');
    return Object.freeze({actorId,scopeId,key,digest:digest({method,path,input})});
}
