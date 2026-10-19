import { isId, isCounter, MAX_COUNTER } from '@tunex/core';
import type { IdentityValueCodec } from '../framework/public.ts';
import { validBearerToken } from '../infrastructure/identity-secrets.ts';
export { tokenHash as nativeIdentityTokenHash } from '../infrastructure/identity-secrets.ts';

export const nativeIdentityCodec:IdentityValueCodec=Object.freeze({
    bearer:(header:string|undefined)=>header?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1],
    validBearer:validBearerToken,isId,isCounter,maxRevision:MAX_COUNTER,
});
