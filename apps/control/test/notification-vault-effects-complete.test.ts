import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as posix from 'node:path/posix';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { isId } from '@tunex/core';
import { parseJson } from '@tunex/contracts/shared';
import { ControlError } from '../src/framework/public.ts';
import { parseNotificationDestinationUrl } from '../src/compatibility/public.ts';

type Any=Record<string,any>;
interface Node {kind:'file'|'directory'|'symlink';ino:number;uid:number;mode:number;nlink:number;mtimeMs:number;ctimeMs:number;data:Buffer;dev:number}
const flags={O_RDONLY:0,O_WRONLY:1,O_CREAT:64,O_EXCL:128,O_NOFOLLOW:131072,O_DIRECTORY:65536};
const key=Buffer.alloc(32,37),binding={scopeId:'scope',endpointId:'endpoint',credentialRevision:1,authorityDigest:'sha256:'+'a'.repeat(64)},material={url:'https://notify.tunex.org/hook',signingKey:'b'.repeat(64)},request='sha256:'+'c'.repeat(64);
const unavailable={code:'NOTIFICATION_SECRETS_UNAVAILABLE',status:503,message:'Protected notification material unavailable'};
const capacity={code:'RESOURCE_LIMIT',status:429,message:'Protected notification material capacity unavailable'};
const source=readFileSync(new URL('../src/infrastructure/notification-secrets.ts',import.meta.url),'utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
function harness() {
    const nodes=new Map<string,Node>(),events:string[]=[],buffers:Array<{value:Buffer;initial:Buffer}>=[],writes:Array<{path:string;value:Buffer}>=[];let inode=0,tick=0,random=0;
    const state:Any={now:1700000000000,failAt:0,failure:new Error('private/native/path or signing bytes must not escape'),onEvent:null,onStat:null,directoryEntries:null,cipherFail:'',destinationFail:false};
    const processValue:Any={platform:'linux',pid:42,getuid:()=>1000};
    const add=(path:string,kind:Node['kind']='file',data=Buffer.alloc(0),mode=kind==='directory'?0o700:0o600,uid=1000)=>{const node={kind,ino:++inode,uid,mode:(kind==='directory'?0o40000:kind==='symlink'?0o120000:0o100000)|mode,nlink:1,mtimeMs:++tick,ctimeMs:tick,data:Buffer.from(data),dev:1};nodes.set(path,node);return node;};
    add('/','directory',undefined,0o755,0);add('/vault','directory');add('/vault/records','directory');add('/vault/key','file',key);
    const absent=()=>Object.assign(new Error('private ENOENT'),{code:'ENOENT'});
    const statCounts=new Map<string,number>();
    const info=(path:string,node:Node,kind:string)=>{const counter=kind+':'+path,index=(statCounts.get(counter)??0)+1;statCounts.set(counter,index);const value={...node,size:node.data.length,isFile:()=>node.kind==='file',isDirectory:()=>node.kind==='directory',isSymbolicLink:()=>node.kind==='symlink'};return {...value,...state.onStat?.(path,kind,index,value)};};
    const event=async(label:string)=>{events.push(label);await state.onEvent?.(label);if(state.failAt===events.length){state.failAt=0;throw state.failure;}};
    const fs={async lstat(path:string){await event('lstat:'+path);const node=nodes.get(path);if(!node)throw absent();return info(path,node,'lstat');},
        async opendir(path:string){await event('opendir:'+path);const names=[...nodes.keys()].filter(value=>value!==path&&posix.dirname(value)===path).map(value=>posix.basename(value)).sort(),entries=state.directoryEntries?.(path,names)??names;
            return {async *[Symbol.asyncIterator](){for(const name of entries)yield {name};},async close(){await event('directory.close:'+path);}};},
        async open(path:string,options:number,mode?:number){await event('open:'+path+':'+options+':'+mode);let node=nodes.get(path);if((options&flags.O_EXCL)&&node)throw Object.assign(new Error('private EEXIST'),{code:'EEXIST'});if(!node){if(!(options&flags.O_CREAT))throw absent();node=add(path,'file',Buffer.alloc(0),mode);}
            const held=node;let offset=0,closed=false;
            return {async stat(){await event('stat:'+path);return info(path,held,'stat');},async read(target:Buffer,start:number,length:number){await event('read:'+path);const bytesRead=Math.max(0,Math.min(length,held.data.length-offset));held.data.copy(target,start,offset,offset+bytesRead);offset+=bytesRead;return {bytesRead,buffer:target};},
                async writeFile(value:Buffer|string){const bytes=typeof value==='string'?Buffer.from(value):value;writes.push({path,value:bytes});await event('write:'+path);held.data=Buffer.from(bytes);held.mtimeMs=++tick;held.ctimeMs=tick;},async sync(){await event('sync:'+path);},async close(){assert.equal(closed,false,'native handle closes once');closed=true;await event('close:'+path);}};},
        async link(from:string,to:string){await event('link:'+from+'>'+to);if(nodes.has(to))throw Object.assign(new Error('private EEXIST'),{code:'EEXIST'});const node=nodes.get(from);if(!node)throw absent();node.nlink++;node.ctimeMs=++tick;nodes.set(to,node);},
        async unlink(path:string){await event('unlink:'+path);const node=nodes.get(path);if(!node)throw absent();nodes.delete(path);node.nlink--;node.ctimeMs=++tick;}};
    const tracked=(value:Buffer)=>{buffers.push({value,initial:Buffer.from(value)});return value;};
    const NativeBuffer={from:(...args:any[])=>tracked((Buffer.from as any)(...args)),alloc:(...args:any[])=>tracked((Buffer.alloc as any)(...args)),concat:(...args:any[])=>tracked((Buffer.concat as any)(...args))};
    const nativeCrypto={...crypto,randomBytes(size:number){return Buffer.alloc(size,++random);},createCipheriv(...args:any[]){const cipher=(crypto.createCipheriv as any)(...args);return new Proxy(cipher,{get(target,member){if(member==='update')return (value:Buffer)=>{if(state.cipherFail==='update')throw state.failure;return target.update(value);};if(member==='final')return ()=>{if(state.cipherFail==='final')throw state.failure;return target.final();};const value=Reflect.get(target,member,target);return typeof value==='function'?value.bind(target):value;}});}};
    const exports:Any={};new vm.Script(javascript,{filename:'actual-notification-secrets.cjs'}).runInNewContext({exports,Buffer:NativeBuffer,process:processValue,Date:{now:()=>state.now},
        require(name:string){const providers:Any={'node:fs':{constants:flags},'node:fs/promises':fs,'node:path':posix,'node:crypto':nativeCrypto,'@tunex/core':{isId},'@tunex/contracts/shared':{parseJson},'../framework/public.ts':{ControlError},'../compatibility/public.ts':{parseNotificationDestinationUrl(value:string){if(state.destinationFail)throw state.failure;return parseNotificationDestinationUrl(value);}}};assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});
    assert.equal(events.length,0,'module initialization has no native filesystem or crypto calls');
    return {Class:exports.FileNotificationSecrets as any,state,processValue,nodes,events,buffers,writes,add,fs,async open(){return exports.FileNotificationSecrets.open('/vault');},reset(){events.length=0;buffers.length=0;writes.length=0;statCounts.clear();}};
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}
const blank=(value:Buffer)=>value.every(byte=>byte===0);

test('71 actual vault module has no eager I/O refuses platform getuid relative/canonical path before effects and owns exact exclusive writer lifecycle',async()=>{
    for(const configure of [(h:ReturnType<typeof harness>)=>{h.processValue.platform='win32';},(h:ReturnType<typeof harness>)=>{h.processValue.getuid=undefined;}]){const h=harness();configure(h);await assert.rejects(h.open(),unavailable);assert.equal(h.events.length,0);}
    for(const path of ['relative','/vault/.','/vault/../vault']){const h=harness();await assert.rejects(h.Class.open(path),unavailable);assert.equal(h.events.length,0);}
    const h=harness(),vault=await h.open();assert.deepEqual(h.events.slice(0,4),['lstat:/vault','lstat:/','lstat:/vault','lstat:/vault/records']);
    const open=h.events.find(v=>v.startsWith('open:/vault/writer.lock:'));assert.equal(open,'open:/vault/writer.lock:'+(flags.O_WRONLY|flags.O_CREAT|flags.O_EXCL|flags.O_NOFOLLOW)+':384');
    assert.ok(h.events.indexOf('read:/vault/key')<h.events.indexOf(open!));assert.ok(h.events.indexOf('write:/vault/writer.lock')<h.events.indexOf('sync:/vault/writer.lock'));assert.ok(h.events.indexOf('sync:/vault/writer.lock')<h.events.indexOf('sync:/vault'));
    assert.equal(h.nodes.get('/vault/writer.lock')!.data.toString(),'{"pid":42}');const retained=vault.key;await vault.close();assert.ok(blank(retained));assert.equal(h.nodes.has('/vault/writer.lock'),false);assert.equal(h.events.filter(v=>v==='close:/vault/writer.lock').length,1);
});

test('71 open failures scrub captured key close owned handle unlink only matching lock identity and preserve allowed resource refusal',async()=>{
    for(const label of ['write:/vault/writer.lock','sync:/vault/writer.lock','sync:/vault','opendir:/vault/records']){
        const h=harness();h.state.onEvent=(event:string)=>{if(event===label){h.state.onEvent=null;throw h.state.failure;}};await assert.rejects(h.open(),unavailable);assert.equal(h.nodes.has('/vault/writer.lock'),false);assert.equal(h.events.filter(v=>v==='close:/vault/writer.lock').length,1);
        const retained=h.buffers.filter(v=>v.initial.equals(key));assert.ok(retained.length>0);assert.ok(retained.every(v=>blank(v.value)));
    }
    const replaced=harness();replaced.state.onEvent=(label:string)=>{if(label==='sync:/vault/writer.lock'){replaced.state.onEvent=null;replaced.add('/vault/writer.lock','file',Buffer.from('impostor'));throw replaced.state.failure;}};await assert.rejects(replaced.open(),unavailable);assert.equal(replaced.nodes.get('/vault/writer.lock')!.data.toString(),'impostor');assert.equal(replaced.events.includes('unlink:/vault/writer.lock'),false);
    const resource=harness();resource.state.onEvent=(label:string)=>{if(label==='opendir:/vault/records')throw new ControlError('RESOURCE_LIMIT',429,'original resource refusal');};await assert.rejects(resource.open(),{code:'RESOURCE_LIMIT',status:429,message:'original resource refusal'});assert.equal(resource.nodes.has('/vault/writer.lock'),false);
    const unidentified=harness();unidentified.state.onEvent=(label:string)=>{if(label==='stat:/vault/writer.lock'){unidentified.state.onEvent=null;throw unidentified.state.failure;}};await assert.rejects(unidentified.open(),unavailable);assert.ok(unidentified.nodes.has('/vault/writer.lock'),'failure before captured inode must not delete an unidentified path');assert.equal(unidentified.events.filter(v=>v==='close:/vault/writer.lock').length,1);assert.ok(unidentified.buffers.filter(v=>v.initial.equals(key)).every(v=>blank(v.value)));
});

test('71 actual bounded read pins original inode device owner mode size timestamp links across initial fd and named views and scrubs every failure buffer',async()=>{
    const normal=harness();normal.add('/vault/data','file',Buffer.from('abc'));const read=await normal.Class.readFile('/vault/data',3,1);assert.equal(read.toString(),'abc');assert.ok(normal.events.includes('open:/vault/data:'+(flags.O_RDONLY|flags.O_NOFOLLOW)+':undefined'));assert.equal(normal.events.filter(v=>v==='read:/vault/data').length,2);assert.ok(normal.buffers.filter(v=>v.initial.length===4).every(v=>blank(v.value)));
    for(const phase of ['before','after','named'])for(const field of ['dev','ino','uid','mode','size','mtimeMs','ctimeMs','nlink']){
        const h=harness();h.add('/vault/data','file',Buffer.from('secret'));h.state.onStat=(path:string,kind:string,index:number,value:Any)=>{if(path==='/vault/data'&&((phase==='before'&&kind==='stat'&&index===1)||(phase==='after'&&kind==='stat'&&index===2)||(phase==='named'&&kind==='lstat'&&index===2)))return {[field]:value[field]+1};return {};};await assert.rejects(h.Class.readFile('/vault/data',10),unavailable);assert.equal(h.events.filter(v=>v==='close:/vault/data').length,1);assert.ok(h.buffers.filter(v=>v.initial.length===11).every(v=>blank(v.value)),phase+field);
    }
    for(const [actual,reported,maximum] of [[4,3,3],[3,4,5],[11,11,10]] as const){const h=harness();h.add('/vault/data','file',Buffer.alloc(actual,83));h.state.onStat=(path:string)=>path==='/vault/data'?{size:reported}:{};await assert.rejects(h.Class.readFile('/vault/data',maximum),unavailable);assert.ok(h.buffers.filter(v=>v.initial.length===maximum!+1).every(v=>blank(v.value)));assert.equal(h.events.filter(v=>v==='close:/vault/data').length,1);}
});

test('71 parent guards distinguish key complete identity from lock identity and enforce uid ancestor modes type links and exact root inventory',async()=>{
    for(const configure of [(h:ReturnType<typeof harness>)=>{h.nodes.get('/')!.uid=2000;},(h:ReturnType<typeof harness>)=>{h.nodes.get('/')!.mode|=0o020;},(h:ReturnType<typeof harness>)=>{h.nodes.get('/vault')!.kind='symlink';}]){const h=harness();configure(h);await assert.rejects(h.open(),unavailable);}
    for(const [path,field] of [['/vault','ino'],['/vault/records','dev'],['/vault/key','size'],['/vault/key','mtimeMs'],['/vault/key','ctimeMs'],['/vault/key','nlink'],['/vault/writer.lock','ino'],['/vault/writer.lock','nlink'],['/vault/records','uid']] as const){const h=harness(),owner=await h.open();if(field==='size')h.nodes.get(path)!.data=Buffer.alloc(33);else (h.nodes.get(path)! as unknown as Any)[field]++;await assert.rejects(owner.parents(),unavailable);await owner.close().catch(()=>{});}
    const h=harness(),owner=await h.open();h.nodes.get('/vault/writer.lock')!.data=Buffer.from('changed lock bookkeeping');h.nodes.get('/vault/writer.lock')!.mtimeMs++;h.nodes.get('/vault/writer.lock')!.ctimeMs++;await owner.parents();h.state.directoryEntries=(path:string,names:string[])=>path==='/vault'?[...names,'key']:names;await assert.rejects(owner.parents(),unavailable);h.state.directoryEntries=null;await owner.close();
});

test('71 actual stage durable write close exclusive link directory sync unlink directory sync order and all failed publication boundaries scrub bytes',async()=>{
    const baseline=harness(),original=await baseline.open();baseline.reset();const reference=await original.stage(binding,request,material,null),events=[...baseline.events],temporary=[...baseline.nodes.keys()].find(v=>v.endsWith('.tmp'));assert.equal(temporary,undefined);
    const file=events.find(v=>v.startsWith('write:/vault/records/')&&v.endsWith('.tmp'))!.slice('write:'.length),final='/vault/records/'+reference+'.json';
    const index=(label:string)=>events.indexOf(label);assert.ok(index('write:'+file)<index('sync:'+file));assert.ok(index('sync:'+file)<index('close:'+file));assert.ok(index('close:'+file)<index('link:'+file+'>'+final));
    const linked=index('link:'+file+'>'+final),unlinked=index('unlink:'+file);assert.ok(events.slice(linked+1,unlinked).includes('sync:/vault/records'));assert.ok(events.slice(unlinked+1).includes('sync:/vault/records'));
    assert.equal(baseline.nodes.get(final)!.nlink,1);assert.ok(baseline.buffers.filter(v=>v.initial.includes(Buffer.from(material.signingKey))||v.initial.includes(Buffer.from('"ciphertext"'))).every(v=>blank(v.value)));
    const selected=events.map((label,i)=>({label,i})).filter(({label})=>label==='write:'+file||label==='sync:'+file||label==='close:'+file||label.startsWith('link:')||label==='sync:/vault/records'||label==='unlink:'+file);
    for(const {i} of selected){const h=harness(),owner=await h.open();h.reset();h.state.failAt=i+1;await assert.rejects(owner.stage(binding,request,material,null),unavailable);assert.ok(h.buffers.filter(v=>v.initial.includes(Buffer.from(material.signingKey))||v.initial.includes(Buffer.from('"ciphertext"'))).every(v=>blank(v.value)));const record=h.nodes.get(final);if(record)assert.ok(record.nlink===1||record.nlink===2);const durable=record?Buffer.from(record.data):null;await owner.close();if(i>=linked){const reopened=await h.open();assert.equal(await reopened.stage(binding,request,material,null),reference);if(durable)assert.deepEqual(h.nodes.get(final)!.data,durable);assert.deepEqual(JSON.parse(JSON.stringify(await reopened.read(binding,reference))),material);await reopened.close();}}
    await original.close();
    const collision=harness(),owner=await collision.open();collision.state.onEvent=(label:string)=>{if(label.startsWith('link:'))collision.add(final,'file',Buffer.from('exclusive existing sentinel'));};await assert.rejects(owner.stage(binding,request,material,null),unavailable);assert.equal(collision.nodes.get(final)!.data.toString(),'exclusive existing sentinel');await owner.close();
});

test('71 actual cipher and decrypted parser failures zero plaintext read buffers and encoded bytes while serial failures remain recoverable',async()=>{
    for(const phase of ['update','final']){const h=harness(),owner=await h.open();h.reset();h.state.cipherFail=phase;await assert.rejects(owner.stage(binding,request,material,null),unavailable);assert.ok(h.buffers.some(v=>v.initial.includes(Buffer.from(material.signingKey))));assert.ok(h.buffers.filter(v=>v.initial.includes(Buffer.from(material.signingKey))).every(v=>blank(v.value)));h.state.cipherFail='';await owner.stage(binding,request,material,null);await owner.close();}
    const h=harness(),owner=await h.open(),reference=await owner.stage(binding,request,material,null);h.reset();h.state.destinationFail=true;await assert.rejects(owner.read(binding,reference),unavailable);assert.ok(h.buffers.some(v=>v.initial.includes(Buffer.from(material.signingKey))));assert.ok(h.buffers.filter(v=>v.initial.includes(Buffer.from(material.signingKey))||v.initial.includes(Buffer.from('"ciphertext"'))).every(v=>blank(v.value)));h.state.destinationFail=false;assert.deepEqual(JSON.parse(JSON.stringify(await owner.read(binding,reference))),material);await owner.close();
});

test('71 actual inventory counts every authenticated final/temp name caps4096 globally32 per endpoint and stage reserves two temporary slots',async()=>{
    for(const [size,sameEndpoint,accepted] of [[4096,false,true],[4097,false,false],[32,true,true],[33,true,false]] as const){const h=harness(),owner=await h.open();owner.parents=async()=>{};owner.envelope=async(_name:string,reference:string)=>({value:{binding:{...binding,endpointId:sameEndpoint?'endpoint':'endpoint-'+reference},reference,createdAt:h.state.now}});for(let i=0;i<size;i++)h.add('/vault/records/'+i.toString(16).padStart(64,'0')+'.json');if(accepted)assert.equal((await owner.inventory()).length,size);else await assert.rejects(owner.inventory(),capacity);assert.equal(h.nodes.size,5+size);await owner.close();}
    for(const retained of [4094,4095]){const h=harness(),owner=await h.open();owner.inventory=async()=>Array.from({length:retained},(_,i)=>({name:i.toString(16).padStart(64,'0')+'.json',reference:i.toString(16).padStart(64,'0'),identity:{nlink:1},envelope:{binding:{...binding,endpointId:'other-'+i},createdAt:h.state.now}}));if(retained===4094)assert.equal(typeof await owner.stage(binding,request,material,null),'string');else await assert.rejects(owner.stage(binding,request,material,null),capacity);await owner.close();}
    for(const name of ['unknown','a'.repeat(64)+'.JSON','a'.repeat(64)+'.'+'a'.repeat(31)+'.tmp','a'.repeat(64)+'.json\n']){const h=harness(),owner=await h.open();h.add('/vault/records/'+name);await assert.rejects(owner.inventory(),unavailable);assert.ok(h.nodes.has('/vault/records/'+name));await owner.close();}
});

test('71 actual pruning rechecks captured file identity before unlink and never consumes leased kept or concurrently changed records',async()=>{
    const h=harness(),owner=await h.open(),pinned=await owner.stage(binding,request,material,null),kept=await owner.stage(binding,'sha256:'+'d'.repeat(64),material,null),changed=await owner.stage(binding,'sha256:'+'e'.repeat(64),material,null),lease=await owner.acquire(binding,pinned);
    try{h.state.now+=86400001;const inventory=owner.inventory.bind(owner);owner.inventory=async()=>{const entries=await inventory();h.nodes.get('/vault/records/'+changed+'.json')!.ctimeMs++;return entries;};h.reset();await assert.rejects(owner.stage(binding,'sha256:'+'f'.repeat(64),material,kept),unavailable);for(const reference of [pinned,kept,changed])assert.ok(h.nodes.has('/vault/records/'+reference+'.json'));assert.equal(h.events.some(v=>v.startsWith('unlink:/vault/records/')),false);}
    finally{lease.release();await owner.close();}
});

test('71 close waits original pending publication and final pin before unlink/key zeroing rejects new work and closes writer once',async()=>{
    const h=harness(),owner=await h.open(),reference=await owner.stage(binding,request,material,null),lease=await owner.acquire(binding,reference),entered=deferred(),gate=deferred();
    h.state.onEvent=async(label:string)=>{if(label.startsWith('sync:/vault/records/')&&label.endsWith('.tmp')){entered.resolve();await gate.promise;}};
    const stage=owner.stage(binding,'sha256:'+'d'.repeat(64),material,null);await entered.promise;const retained=owner.key;let done=false;const close=owner.close().then(()=>{done=true;});const second=owner.close();await assert.rejects(owner.read(binding,reference),unavailable);assert.equal(done,false);assert.equal(blank(retained),false);gate.resolve();await stage;await Promise.resolve();assert.equal(done,false);assert.ok(h.nodes.has('/vault/writer.lock'));lease.release();lease.release();await Promise.all([close,second]);assert.equal(done,true);assert.ok(blank(retained));assert.equal(h.nodes.has('/vault/writer.lock'),false);assert.equal(h.events.filter(v=>v==='close:/vault/writer.lock').length,1);
});
