import { isId } from '@tunex/core';
import { ControlError } from '../framework/public.ts';
import { json } from './mysql.ts';

export type Row = Record<string, unknown>;
export const max = 9007199254740991;
export function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE',409,'Invalid station alert storage'); }
export function counter(value: unknown, positive = false): number {
    const n = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value) ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < (positive ? 1 : 0)) corrupt();
    return n;
}
export function flag(value: unknown): boolean {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    return corrupt();
}
export function id(value: unknown): string { if (!isId(value)) corrupt(); return value; }
export function text(value: unknown, size = 128): string { if (typeof value !== 'string' || value.length > size) corrupt(); return value; }
export const nullableCounter = (value: unknown) => value === null ? null : counter(value);
export const nullableId = (value: unknown) => value === null ? null : id(value);
export function stored<T>(value: unknown, limit: number): T {
    try {
        const parsed = json<unknown>(value), body = JSON.stringify(parsed);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !body || Buffer.byteLength(body,'utf8') > limit) corrupt();
        return parsed as T;
    } catch { return corrupt(); }
}
export function encoded(value: unknown, limit: number): string {
    const body = JSON.stringify(value);
    if (!body || Buffer.byteLength(body,'utf8') > limit) corrupt();
    return body;
}
