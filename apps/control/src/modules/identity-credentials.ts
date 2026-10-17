import { createHash } from 'node:crypto';

export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function validBearerToken(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 32 && value.length <= 128 &&
        !/[\r\n]/.test(value) && /^[A-Za-z0-9_-]+$/.test(value);
}
