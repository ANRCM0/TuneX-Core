import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { NodeSecrets } from '../framework/public.ts';

export function tokenHash(token:string):string { return createHash('sha256').update(token).digest('hex'); }
export function validBearerToken(value:unknown):value is string {
    return typeof value==='string'&&value.length>=32&&value.length<=128&&
        !/[\r\n]/.test(value)&&/^[A-Za-z0-9_-]+$/.test(value);
}
export function newToken():string { return randomBytes(32).toString('base64url'); }
export const nativeNodeSecrets:NodeSecrets=Object.freeze({newID:randomUUID,newToken,tokenHash});
