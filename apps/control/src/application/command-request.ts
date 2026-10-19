import { nativeCommandRequest } from '../compatibility/public.ts';
import type { RequestIdentity } from '../framework/public.ts';

export function requestIdentity(actorId: string, scopeId: string, key: string | undefined,
    method: string, path: string, input: unknown): RequestIdentity {
    return nativeCommandRequest(actorId,scopeId,key,method,path,input);
}
