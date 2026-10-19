import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHmac } from 'node:crypto';
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { FileNotificationSecrets } from '../src/infrastructure/notification-secrets.ts';
import type { NotificationDestination, NotificationSecretBinding, NotificationSecretLease } from '../src/framework/public.ts';

type Any=Record<string,any>;
const linux=process.platform==='linux'&&typeof process.getuid==='function',day=86400000,at=1700000000000;
const key=Buffer.alloc(32,37),binding:NotificationSecretBinding={scopeId:'scope',endpointId:'endpoint',credentialRevision:1,authorityDigest:'sha256:'+'a'.repeat(64)};
const material:NotificationDestination={url:'https://notify.tunex.org/hook',signingKey:'b'.repeat(64)};
const request=(n=0)=>'sha256:'+n.toString(16).padStart(64,'0');
const unavailable={code:'NOTIFICATION_SECRETS_UNAVAILABLE',status:503,message:'Protected notification material unavailable'};
const capacity={code:'RESOURCE_LIMIT',status:429,message:'Protected notification material capacity unavailable'};
async function fixture(action:(f:{base:string;root:string;records:string;authority:string;open:()=>Promise<FileNotificationSecrets>})=>Promise<void>) {
    // /tmp is deliberately unsuitable: ancestors reject writable directories, including sticky /tmp.
    const base=await mkdtemp(join(homedir(),'.tunex-notification-native-')),root=join(base,'vault'),records=join(root,'records'),authority=join(base,'authority-sentinel');
    const opened:FileNotificationSecrets[]=[];
    try{await chmod(base,0o700);await mkdir(root,{mode:0o700});await mkdir(records,{mode:0o700});await writeFile(join(root,'key'),key,{mode:0o600});await writeFile(authority,'unrelated authority and journal sentinel',{mode:0o600});
        await action({base,root,records,authority,async open(){const owner=await FileNotificationSecrets.open(root);opened.push(owner);return owner;}});
        assert.equal(await readFile(authority,'utf8'),'unrelated authority and journal sentinel');
    }finally{for(const owner of opened)await owner.close().catch(()=>{});await rm(base,{recursive:true,force:true});}
}
function aad(value:Any) {return Buffer.from(JSON.stringify({version:1,binding:value.binding,reference:value.reference,createdAt:value.createdAt}));}
function reseal(value:Any,plaintext:string):Any {
    const iv=Buffer.alloc(12,93),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad(value));
    return {...value,iv:iv.toString('base64url'),ciphertext:Buffer.concat([cipher.update(Buffer.from(plaintext)),cipher.final()]).toString('base64url'),tag:cipher.getAuthTag().toString('base64url')};
}

test('71 native vault stages immutable exclusive AES256GCM records with keyed deterministic reference and canonical AAD independent of Authority',
    {skip:!linux,timeout:60000},async t=>fixture(async f=>{
        let now=at;t.mock.method(Date,'now',()=>now);const vault=await f.open(),retainedKey=(vault as unknown as Any).key as Buffer;
        const destination={url:'https://Notify.TuneX.org:443/a/../hook',signingKey:material.signingKey};
        const reference=await vault.stage(binding,request(),destination,null),file=join(f.records,reference+'.json');
        assert.equal(reference,createHmac('sha256',key).update(JSON.stringify({binding,requestDigest:request()})).digest('hex'));
        assert.deepEqual((await readdir(f.root)).sort(),['key','records','writer.lock']);assert.deepEqual(await readdir(f.records),[reference+'.json']);
        assert.equal((await lstat(file)).mode&0o7777,0o600);assert.equal((await lstat(file)).nlink,1);assert.equal((await lstat(f.root)).mode&0o7777,0o700);assert.equal((await lstat(f.records)).mode&0o7777,0o700);
        assert.deepEqual(JSON.parse(await readFile(join(f.root,'writer.lock'),'utf8')),{pid:process.pid});
        const raw=await readFile(file),envelope=JSON.parse(raw.toString()) as Any;assert.deepEqual(Object.keys(envelope),['version','reference','binding','createdAt','iv','ciphertext','tag']);assert.equal(envelope.createdAt,at);
        assert.equal(raw.includes(Buffer.from(material.signingKey)),false);assert.equal(raw.includes(Buffer.from(material.url)),false);
        const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64url'));decipher.setAAD(aad(envelope));decipher.setAuthTag(Buffer.from(envelope.tag,'base64url'));
        assert.equal(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64url')),decipher.final()]).toString(),JSON.stringify(material));
        const first=await lstat(file);now+=1000;assert.equal(await vault.stage(binding,request(),material,null),reference);assert.deepEqual(await readFile(file),raw);const second=await lstat(file);assert.equal(first.ino,second.ino);assert.equal(first.mtimeMs,second.mtimeMs);
        await assert.rejects(vault.stage(binding,request(),{...material,signingKey:'c'.repeat(64)},null),unavailable);assert.deepEqual(await readFile(file),raw);
        const lockBefore=await readFile(join(f.root,'writer.lock'));await assert.rejects(FileNotificationSecrets.open(f.root),unavailable);assert.deepEqual(await readFile(join(f.root,'writer.lock')),lockBefore);
        const read=await vault.read(binding,reference);assert.deepEqual(read,material);read.url='mutated caller value';assert.deepEqual(await vault.read(binding,reference),material);
        await vault.close();assert.ok(retainedKey.every(value=>value===0));await assert.rejects(readFile(join(f.root,'writer.lock')),{code:'ENOENT'});await assert.rejects(vault.read(binding,reference),unavailable);
        const reopened=await f.open();assert.deepEqual(await reopened.read(binding,reference),material);
    }));

test('71 native vault refuses every binding request reference and destination mismatch before publishing or replacing protected bytes',
    {skip:!linux,timeout:60000},async()=>fixture(async f=>{
        const vault=await f.open(),reference=await vault.stage(binding,request(),material,null),original=await readFile(join(f.records,reference+'.json'));
        for(const change of [{scopeId:'other'},{endpointId:'other'},{credentialRevision:2},{authorityDigest:'sha256:'+'d'.repeat(64)}])await assert.rejects(vault.read({...binding,...change},reference),unavailable);
        for(const value of [{...binding,credentialRevision:0},{...binding,credentialRevision:NaN},{...binding,authorityDigest:binding.authorityDigest+'\n'},{...binding,extra:true},{...binding,scopeId:''}])await assert.rejects(vault.stage(value as never,request(),material,null),unavailable);
        for(const value of ['',reference+'\n','A'.repeat(64),'0'.repeat(63),null])await assert.rejects(vault.read(binding,value as never),unavailable);
        for(const value of ['',request()+'\n','SHA256:'+'a'.repeat(64),null])await assert.rejects(vault.stage(binding,value as never,material,null),unavailable);
        for(const value of [{...material,extra:true},{...material,url:'http://notify.tunex.org'},{...material,signingKey:'B'.repeat(64)},{...material,signingKey:material.signingKey+'\n'}])await assert.rejects(vault.stage(binding,request(1),value as never,null),unavailable);
        await assert.rejects(vault.stage(binding,request(1),material,reference+'\n'),unavailable);assert.deepEqual(await readdir(f.records),[reference+'.json']);assert.deepEqual(await readFile(join(f.records,reference+'.json')),original);
    }));

test('71 native open fails closed for noncanonical paths insecure ancestors root records key size mode symlinks links and unknown root entries',
    {skip:!linux,timeout:120000},async()=>{
        await assert.rejects(FileNotificationSecrets.open('relative'),unavailable);
        const cases:Array<(f:{base:string;root:string;records:string})=>Promise<string|void>>=[
            async f=>f.root+'/.',async f=>{await chmod(f.base,0o770);},async f=>{await chmod(f.root,0o755);},async f=>{await chmod(f.records,0o750);},
            async f=>{await chmod(join(f.root,'key'),0o640);},async f=>{await writeFile(join(f.root,'key'),Buffer.alloc(31));},async f=>{await writeFile(join(f.root,'key'),Buffer.alloc(33));},
            async f=>{await rename(join(f.root,'key'),join(f.base,'real-key'));await symlink(join(f.base,'real-key'),join(f.root,'key'));},
            async f=>{await link(join(f.root,'key'),join(f.base,'hard-key'));},
            async f=>{await writeFile(join(f.root,'unexpected'),'protected unknown',{mode:0o600});},async f=>{await writeFile(join(f.root,'writer.lock'),'existing writer sentinel',{mode:0o600});},
            async f=>{const target=join(f.base,'alias');await symlink(f.root,target);return target;},
            async f=>{await rename(f.records,join(f.base,'original-records'));await writeFile(f.records,'not a directory',{mode:0o600});},
        ];
        for(const configure of cases)await fixture(async f=>{const path=await configure(f);await assert.rejects(FileNotificationSecrets.open(path??f.root),unavailable);});
    });

test('71 native envelope corruption duplicate keys canonical base64 AAD authentication and decrypted destination schema never return material',
    {skip:!linux,timeout:120000},async()=>fixture(async f=>{
        const vault=await f.open(),reference=await vault.stage(binding,request(),material,null),file=join(f.records,reference+'.json'),original=await readFile(file),envelope=JSON.parse(original.toString()) as Any;
        const variants:Array<string|Any>=[
            '{','[]',{...envelope,extra:true},{...envelope,version:2},{...envelope,reference:'0'.repeat(64)},{...envelope,createdAt:-1},{...envelope,createdAt:1.5},
            {...envelope,createdAt:envelope.createdAt+1},{...envelope,binding:{...binding,endpointId:'other'}},{...envelope,binding:{...binding,extra:true}},
            {...envelope,iv:''},{...envelope,iv:envelope.iv+'='},{...envelope,iv:'A'.repeat(15)},{...envelope,tag:'A'.repeat(21)+'B'},{...envelope,tag:'A'.repeat(22)},
            {...envelope,ciphertext:''},{...envelope,ciphertext:envelope.ciphertext.slice(0,-1)+'+'},
            JSON.stringify(envelope).replace('"version":1','"version":1,"version":1'),
            reseal(envelope,JSON.stringify({...material,extra:true})),reseal(envelope,JSON.stringify({...material,url:'https://Notify.TuneX.org/hook'})),
            reseal(envelope,JSON.stringify({...material,url:'http://notify.tunex.org/hook'})),reseal(envelope,JSON.stringify({...material,signingKey:'B'.repeat(64)})),
            reseal(envelope,'{"url":"'+material.url+'","signingKey":"'+material.signingKey+'","url":"'+material.url+'"}'),reseal(envelope,JSON.stringify({...material,extra:'x'.repeat(4096)})),
            'x'.repeat(8193),
        ];
        for(const value of variants){await writeFile(file,typeof value==='string'?value:JSON.stringify(value));await assert.rejects(vault.read(binding,reference),unavailable);assert.deepEqual((await readdir(f.records)).sort(),[reference+'.json']);}
        await writeFile(file,original);assert.deepEqual(await vault.read(binding,reference),material,'serialized queue recovers after every rejected operation');
        await writeFile(join(f.records,'unclassified'),'sentinel',{mode:0o600});await assert.rejects(vault.stage(binding,request(1),material,null),unavailable);assert.equal(await readFile(join(f.records,'unclassified'),'utf8'),'sentinel');
    }));

test('71 native parent identity permissions key replacement and record type/link tampering preserve impostor lock and sanitize failure',
    {skip:!linux,timeout:120000},async()=>{
        const cases:Array<(f:{base:string;root:string;records:string},reference:string)=>Promise<void>>=[
            async f=>{await chmod(f.root,0o755);},async f=>{await chmod(f.records,0o755);},async f=>{await writeFile(join(f.root,'key'),Buffer.alloc(32,99));},
            async f=>{await rename(join(f.root,'key'),join(f.base,'old-key'));await writeFile(join(f.root,'key'),key,{mode:0o600});},
            async f=>{await rename(f.records,join(f.base,'old-records'));await mkdir(f.records,{mode:0o700});},
            async f=>{await writeFile(join(f.root,'extra'),'unknown',{mode:0o600});},
            async(f,r)=>{await chmod(join(f.records,r+'.json'),0o640);},
            async(f,r)=>{await unlink(join(f.records,r+'.json'));await symlink(join(f.root,'key'),join(f.records,r+'.json'));},
            async(f,r)=>{await link(join(f.records,r+'.json'),join(f.base,'alias-one'));await link(join(f.records,r+'.json'),join(f.base,'alias-two'));},
        ];
        for(const tamper of cases)await fixture(async f=>{const vault=await f.open(),reference=await vault.stage(binding,request(),material,null);await tamper(f,reference);await assert.rejects(vault.read(binding,reference),unavailable);});
        await fixture(async f=>{const vault=await f.open(),retainedKey=(vault as unknown as Any).key as Buffer;await rename(join(f.root,'writer.lock'),join(f.base,'owned-old-lock'));await writeFile(join(f.root,'writer.lock'),'impostor sentinel',{mode:0o600});await assert.rejects(vault.close(),unavailable);assert.equal(await readFile(join(f.root,'writer.lock'),'utf8'),'impostor sentinel');assert.ok(retainedKey.every(value=>value===0));});
    });

test('71 native stage exact one-day prune boundary maximum16 and endpoint reserved-slot quota preserve authenticated old files',
    {skip:!linux,timeout:120000},async t=>fixture(async f=>{
        let now=at;t.mock.method(Date,'now',()=>now);const vault=await f.open(),references:string[]=[];
        for(let i=0;i<31;i++)references.push(await vault.stage(binding,request(i),material,null));assert.equal((await readdir(f.records)).length,31);
        const before=(await readdir(f.records)).sort();await assert.rejects(vault.stage(binding,request(31),material,null),capacity);assert.deepEqual((await readdir(f.records)).sort(),before);
        now=at+day;await assert.rejects(vault.stage(binding,request(31),material,null),capacity);assert.deepEqual((await readdir(f.records)).sort(),before,'equality is retained');
        now++;const added=await vault.stage(binding,request(31),material,null),removed=[...references].sort().slice(0,16);const found=await readdir(f.records);assert.equal(found.length,16);assert.ok(found.includes(added+'.json'));for(const reference of removed)assert.equal(found.includes(reference+'.json'),false);for(const reference of references.filter(v=>!removed.includes(v)))assert.deepEqual(await vault.read(binding,reference),material);
        // A surviving temporary name counts independently; an authenticated pair may have two links.
        const keep=references.find(v=>!removed.includes(v))!,temporary=join(f.records,keep+'.'+'c'.repeat(32)+'.tmp');await link(join(f.records,keep+'.json'),temporary);assert.deepEqual(await vault.read(binding,keep),material);
        await vault.close();const reopened=await f.open();assert.deepEqual(await reopened.read(binding,keep),material,'startup authenticates retained two-link temporary/final pair');
        now+=day+1;await reopened.stage(binding,request(32),material,null);assert.ok((await readdir(f.records)).includes(keep+'.json'));assert.ok((await readdir(f.records)).includes(keep+'.'+'c'.repeat(32)+'.tmp'));
    }));

test('71 native leases cap2 freeze data pin both references through pruning and close waits final idempotent release before scrubbing key',
    {skip:!linux,timeout:120000},async t=>fixture(async f=>{
        let now=at;t.mock.method(Date,'now',()=>now);const vault=await f.open(),reference=await vault.stage(binding,request(),material,null),keep=await vault.stage(binding,request(1),material,null),leases:NotificationSecretLease[]=[];
        try{leases.push(await vault.acquire(binding,reference),await vault.acquire(binding,reference));assert.ok(Object.isFrozen(leases[0]));assert.ok(Object.isFrozen(leases[0]!.destination));await assert.rejects(vault.acquire(binding,reference),capacity);
            now+=day+1;await vault.stage(binding,request(2),material,keep);assert.deepEqual(await vault.read(binding,reference),material);assert.deepEqual(await vault.read(binding,keep),material);
            leases[0]!.release();leases[0]!.release();await vault.stage(binding,request(3),material,keep);assert.deepEqual(await vault.read(binding,reference),material);
            const retainedKey=(vault as unknown as Any).key as Buffer;let closed=false;const closing=vault.close().then(()=>{closed=true;});await Promise.resolve();await Promise.resolve();assert.equal(closed,false);assert.equal((await lstat(join(f.root,'writer.lock'))).isFile(),true);await assert.rejects(vault.stage(binding,request(4),material,null),unavailable);await assert.rejects(vault.acquire(binding,reference),unavailable);
            leases[1]!.release();leases[1]!.release();await closing;assert.ok(retainedKey.every(value=>value===0));await vault.close();await assert.rejects(readFile(join(f.root,'writer.lock')),{code:'ENOENT'});
        }finally{for(const lease of leases)lease.release();}
    }));
