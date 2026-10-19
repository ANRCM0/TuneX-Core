import { request } from 'node:https';
import { readFile } from 'node:fs/promises';
import { parseJson } from '@tunex/contracts/shared';

function nativeControlClientRequest(url:URL,method:string,ca:Buffer,token:string,requestKey:string|undefined,body:string|undefined):Promise<string> {
return new Promise<string>((resolve, reject) => {
    const req = request(url, { method, ca, timeout: 10000, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(requestKey ? { 'idempotency-key': requestKey } : {}), ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}) } }, res => {
        const chunks: Buffer[] = [];
        res.on('data', value => chunks.push(value));
        res.on('end', () => {
            const text = Buffer.concat(chunks).toString();
            if (res.statusCode! >= 200 && res.statusCode! < 300)
                resolve(text);
            else
                reject(new Error(`HTTP ${res.statusCode}: ${text}`));
        });
    });
    req.on('timeout', () => req.destroy(new Error('Control request timeout')));
    req.on('error', reject);
    req.end(body);
});
}

export const nativeControlClientEffects = {
    arguments:()=>process.argv.slice(2),
    env:(name:string)=>process.env[name],
    readText:(path:string)=>readFile(path,'utf8'),
    readBytes:(path:string)=>readFile(path),
    parseJson,
    stringify:(value:unknown,replacer?:null,space?:number)=>JSON.stringify(value,replacer,space),
    encodeComponent:(value:string)=>encodeURIComponent(value),
    url:(path:string,base:string)=>new URL(path,base),
    request:nativeControlClientRequest,
    log:(value:string|undefined)=>console.log(value),
};
