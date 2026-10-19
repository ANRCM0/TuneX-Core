import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuthorityStore,trustDigest } from '../infrastructure/authority.ts';

export const OPERATOR_COMMAND_NATIVE_INTERFACE_VERSION=1 as const;

/** Original process/file/format bindings; product commands are supplied by the old entry. */
export const nativeOperatorCommandEffects={
    arguments:()=>process.argv.slice(2),
    argument:(index:number)=>process.argv[index],
    env:(name:string)=>process.env[name],
    createAuthority:(directory:string)=>new AuthorityStore(directory),
    readCertificate:(path:string)=>readFile(path),
    trustDigest,
    resolve,
    parseClockArgs:(value:string):string[]=>JSON.parse(value),
    stringify:(value:unknown,replacer?:null,space?:number)=>JSON.stringify(value,replacer,space),
    log:(value:string|undefined)=>console.log(value),
    error:(value:string)=>console.error(value),
    exitCode:(value:number)=>{process.exitCode=value;},
};
