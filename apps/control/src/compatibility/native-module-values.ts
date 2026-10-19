export { randomUUID as nativeModuleId } from 'node:crypto';
import { createHash, randomBytes } from 'node:crypto';
import { digest } from '@tunex/contracts/shared';
import { buildRequestIdentity } from '../framework/public.ts';
import type { RequestIdentity } from '../framework/public.ts';
export { digest as nativeValueDigest };
export { parseJson as nativeParseJson, compareTimes as nativeCompareTimes } from '@tunex/contracts/shared';

export function nativeCommandRequest(actorId:string,scopeId:string,key:string|undefined,
    method:string,path:string,input:unknown):RequestIdentity {
    return buildRequestIdentity(actorId,scopeId,key,method,path,input,digest);
}

/** Capture the original default function at constructor evaluation, without reading time. */
export function nativeWallClockSource():()=>number {return Date.now;}
export function nativeWallClockNow():number {return Date.now();}
export function nativeMonotonicNow():number {return performance.now();}
export function jsonUtf8Bytes(value:unknown):number {return Buffer.byteLength(JSON.stringify(value),'utf8');}
export function jsonUtf8DefaultBytes(value:unknown):number {return Buffer.byteLength(JSON.stringify(value));}
export function nativeParseTime(value:string):number {return Date.parse(value);}
export function nativeIsoTime(value:number):string {return new Date(value).toISOString();}
export function nativeJsonEncode(value:unknown):string {return JSON.stringify(value);}
export function nativeJsonBase64Url(value:unknown,explicitUtf8=false):string {
    const text=JSON.stringify(value);
    return (explicitUtf8?Buffer.from(text,'utf8'):Buffer.from(text)).toString('base64url');
}
export function nativeBase64UrlText(value:string):string {return Buffer.from(value,'base64url').toString('utf8');}
export function nativeBase64Fingerprint(value:string):string {
    return `sha256:${createHash('sha256').update(Buffer.from(value,'base64')).digest('hex')}`;
}
export function nativeHexBytes(value:string):Uint8Array {return Buffer.from(value,'hex');}
export function nativeUtf8Bytes(value:string):number {return Buffer.byteLength(value,'utf8');}
export function nativeJsonEncoderBytes(value:unknown):number {return new TextEncoder().encode(JSON.stringify(value)).byteLength;}
export function nativeJsonClone<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}
export function nativeCanonicalBase64Bytes(value:unknown,bytes:number):boolean {
    if (typeof value!=='string') return false;
    const raw=Buffer.from(value,'base64');return raw.length===bytes&&raw.toString('base64')===value;
}
export function nativeBytesFingerprint(value:Uint8Array):string {
    return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
export function nativeRandomBytes(size:number):Uint8Array {return randomBytes(size);}
