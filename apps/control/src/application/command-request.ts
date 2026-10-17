import { isId } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { invalid } from './errors.ts';
import type { RequestIdentity } from './ports.ts';

export function requestIdentity(actorId: string, scopeId: string, key: string | undefined,
    method: string, path: string, input: unknown): RequestIdentity {
    if (!isId(actorId) || !isId(scopeId) || !key || key.length > 128 || /[^\x21-\x7e]/.test(key))
        invalid('Valid identity, scope and Idempotency-Key required');
    return Object.freeze({ actorId, scopeId, key, digest: digest({ method, path, input }) });
}
