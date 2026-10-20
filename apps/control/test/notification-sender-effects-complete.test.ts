import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { ipBytes, isId } from '@tunex/core';
import { parseNotificationDestinationUrl } from '../src/compatibility/public.ts';
import type { NotificationSender } from '../src/framework/public.ts';

type Any=Record<string,any>;
type Answer={address:string;family:number};
const input=():Parameters<NotificationSender['send']>[0]=>({destination:'https://notify.tunex.org/hook',deliveryId:'delivery',body:'{"event":"bounded"}',secret:new Uint8Array(32).fill(7),beforeDispatch:async()=>true});
const source=readFileSync(new URL('../src/infrastructure/notification-https.ts',import.meta.url),'utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function harness(){
    const state:Any={now:0,lookupThrow:false,requestThrow:false,hmacThrow:false,autoClose:true};
    const dns:Array<{host:string;options:Any;callback:(error:Error|null,answers?:Answer[])=>void}>=[],requests:Any[]=[],timers:Array<{callback:()=>void;delay:number;cleared:boolean}>=[],keys:Buffer[]=[];
    const exports:Any={};
    new vm.Script(javascript,{filename:'actual-notification-https.cjs'}).runInNewContext({exports,Buffer,Uint8Array,performance:{now:()=>state.now},
        setTimeout(callback:()=>void,delay:number){const timer={callback,delay,cleared:false};timers.push(timer);return timer;},clearTimeout(timer:typeof timers[number]){timer.cleared=true;},
        require(name:string){const providers:Any={
            'node:crypto':{createHmac(algorithm:string,key:Buffer){keys.push(key);if(state.hmacThrow)throw new Error('private HMAC failure');return createHmac(algorithm,key);}},
            'node:dns':{lookup(host:string,options:Any,callback:typeof dns[number]['callback']){if(state.lookupThrow)throw new Error('private DNS failure');dns.push({host,options,callback});}},
            'node:https':{request(options:Any,callback:(response:Any)=>void){if(state.requestThrow)throw new Error('private request failure');const req=new EventEmitter() as EventEmitter&Any,socket=new EventEmitter() as EventEmitter&Any;const capture:Any={options,req,socket,callback,body:null,reqDestroyed:0,socketDestroyed:0};
                req.destroy=()=>{capture.reqDestroyed++;if(state.autoClose)req.emit('close');return req;};socket.destroy=()=>{capture.socketDestroyed++;if(state.autoClose)socket.emit('close');return socket;};
                req.end=(payload:Buffer)=>{capture.body=Buffer.from(payload);req.emit('socket',socket);return req;};requests.push(capture);return req;}},
            '@tunex/core':{ipBytes,isId},'../compatibility/public.ts':{parseNotificationDestinationUrl}};
            assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});
    const sender:NotificationSender=new exports.ControlledNotificationHttps();
    const answer=(answers:Answer[]=[{address:'1.1.1.1',family:4}],index=dns.length-1)=>dns[index]!.callback(null,answers);
    const respond=(statusCode:number|undefined=204,complete=true,index=requests.length-1)=>{const response=new EventEmitter() as EventEmitter&Any;response.statusCode=statusCode;response.complete=complete;response.destroyed=0;response.destroy=()=>{response.destroyed++;return response;};requests[index]!.callback(response);return response;};
    const timer=(delay:number)=>{const item=timers.find(value=>value.delay===delay&&!value.cleared);assert.ok(item);item.callback();};
    assert.equal(dns.length+requests.length+timers.length+keys.length,0,'module initialization performs no DNS TLS timer or HMAC');
    return {state,dns,requests,timers,keys,sender,answer,respond,timer};
}
const reject=(code:string)=>({outcome:'rejected',code,statusCode:null});
const unknown=(code:string)=>({outcome:'unknown',code,statusCode:null});
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));

test('71 native sender validates destination identity JSON object exact UTF8 bytes and signing key before capacity DNS or HMAC',async()=>{
    const cases:Any[]=[{destination:'http://notify.tunex.org/'},{destination:'https://127.0.0.1/'},{deliveryId:''},{deliveryId:'bad\nid'},{body:7},{body:'null'},{body:'[]'},{body:'"text"'},{body:'false'},{body:'{'},{body:'{"v":"'+'你'.repeat(5460)+'"}'},{secret:new Uint8Array(31)},{secret:new Uint8Array(33)},{secret:new Array(32).fill(7)},{beforeDispatch:null}];
    for(const patch of cases){const h=harness();assert.deepEqual(plain(await h.sender.send({...input(),...patch})),reject('destination'in patch?'DESTINATION_DENIED':'REQUEST_INVALID'));assert.equal(h.dns.length+h.requests.length+h.timers.length+h.keys.length,0);await h.sender.close();}
    const h=harness(),request=input();request.body='{"v":"'+'a'.repeat(16376)+'"}';assert.equal(Buffer.byteLength(request.body),16384);const pending=h.sender.send(request);assert.equal(h.dns.length,1);h.answer();await flush();h.respond().emit('end');assert.equal((await pending).code,'HTTP_ACCEPTED');await h.sender.close();
    const over=harness();assert.equal((await over.sender.send({...request,body:request.body+' '})).code,'REQUEST_INVALID');assert.equal(over.dns.length,0);
    const aborted=harness(),controller=new AbortController();controller.abort();assert.equal((await aborted.sender.send({...input(),signal:controller.signal})).code,'ABORTED');assert.equal(aborted.keys.length+aborted.dns.length+aborted.timers.length,0);await aborted.sender.close();
    const failed=harness();failed.state.hmacThrow=true;assert.equal((await failed.sender.send(input())).code,'REQUEST_INVALID');assert.equal(failed.dns.length,0);assert.ok(failed.keys[0]!.every(byte=>byte===0));await failed.sender.close();await over.sender.close();
});

test('71 native DNS refuses every forbidden IPv4 and IPv6 class malformed family empty overflow and mixed answers before authorization',async()=>{
    const denied:Array<Answer>=[...['0.1.1.1','10.0.0.1','127.0.0.1','100.64.0.1','100.127.255.255','169.254.1.1','172.16.0.1','172.31.255.255','168.63.129.16','192.0.1.1','192.168.1.1','192.88.99.1','192.31.196.1','192.52.193.1','192.175.48.1','198.18.0.1','198.19.255.255','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255'].map(address=>({address,family:4})),
        ...['::','::1','::ffff:1.1.1.1','64:ff9b::101:101','100::1','fc00::1','fe80::1','ff02::1','2001::1','2001:1ff::1','2001:db8::1','2002::1','3ffe::1','3fff:fff::1','2620:4f:8000::1','4000::1'].map(address=>({address,family:6})),{address:'not-an-ip',family:4},{address:'1.1.1.1',family:6},{address:'2606:4700::1111',family:4},{address:'1.1.1.1',family:0}];
    for(const answer of denied)for(const answers of [[answer],[{address:'1.1.1.1',family:4},answer]]){const h=harness();let guarded=0;const pending=h.sender.send({...input(),beforeDispatch:async()=>{guarded++;return true;}});h.answer(answers);assert.equal((await pending).code,'DNS_DENIED',JSON.stringify(answers));assert.equal(guarded+h.requests.length,0);await h.sender.close();}
    for(const answers of [[],Array.from({length:9},()=>({address:'1.1.1.1',family:4}))]){const h=harness(),pending=h.sender.send(input());h.answer(answers);assert.equal((await pending).code,'DNS_DENIED');await h.sender.close();}
    for(const answers of [null,{},'1.1.1.1']){const h=harness(),pending=h.sender.send(input());h.dns[0]!.callback(null,answers as unknown as Answer[]);assert.equal((await pending).code,'DNS_DENIED');await h.sender.close();}
    const full=harness(),pending=full.sender.send(input());full.answer(Array.from({length:8},()=>({address:'1.1.1.1',family:4})));await flush();full.respond().emit('end');assert.equal((await pending).code,'HTTP_ACCEPTED');await full.sender.close();
});

test('71 native sender accepts public policy boundary neighbors resolves once pins first answer and signs exact immutable UTF8 payload',async()=>{
    for(const address of ['1.1.1.1','100.63.255.255','100.128.0.1','172.15.255.255','172.32.0.1','168.63.129.15','192.88.98.1','192.31.195.1','198.17.255.255','198.20.0.1','203.0.112.1','223.255.255.255','2001:200::1','2001:db9::1','2606:4700::1111','2620:4f:8001::1','3fff:1000::1']){
        const h=harness(),request=input();request.body='{"v":"你\\n<>&"}';const body=request.body,secret=Buffer.from(request.secret),pending=h.sender.send(request);assert.equal(h.dns[0]!.host,'notify.tunex.org');assert.deepEqual(plain(h.dns[0]!.options),{all:true,verbatim:true});request.secret.fill(0);request.body='{"changed":true}';h.answer([{address,family:address.includes(':')?6:4},{address:'8.8.8.8',family:4}]);await flush();assert.equal(h.requests.length,1,address);
        const captured=h.requests[0]!,options=captured.options;assert.equal(options.protocol,'https:');assert.equal(options.hostname,'notify.tunex.org');assert.equal(options.servername,'notify.tunex.org');assert.equal(options.port,443);assert.equal(options.path,'/hook');assert.equal(options.method,'POST');assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,true);assert.equal(options.minVersion,'TLSv1.3');assert.equal(options.maxHeaderSize,8192);assert.equal(options.autoSelectFamily,false);
        assert.deepEqual(plain(options.headers),{Host:'notify.tunex.org','Content-Type':'application/json',Accept:'application/json','Content-Length':Buffer.byteLength(body),Connection:'close','X-TuneX-Delivery-Id':'delivery','X-TuneX-Signature':'v1='+createHmac('sha256',secret).update('delivery\n','utf8').update(body,'utf8').digest('hex')});assert.equal(captured.body.toString(),body);assert.ok(h.keys[0]!.every(byte=>byte===0));
        let pinned:unknown;options.lookup('attacker.invalid',{all:true},(...args:unknown[])=>{pinned=args;});assert.deepEqual(pinned,[null,address,address.includes(':')?6:4]);h.respond().emit('end');assert.equal((await pending).code,'HTTP_ACCEPTED');assert.equal(h.dns.length,1);await h.sender.close();
    }
});

test('71 DNS error throw timeout and late callbacks retain exact pending capacity until native callback drains',async()=>{
    for(const synchronous of [true,false]){const h=harness();h.state.lookupThrow=synchronous;const pending=h.sender.send(input());if(!synchronous)h.dns[0]!.callback(new Error('private DNS error'));assert.deepEqual(plain(await pending),reject('DNS_FAILED'));await h.sender.close();}
    const h=harness(),a=h.sender.send(input()),b=h.sender.send(input());assert.deepEqual(h.timers.map(timer=>timer.delay),[5000,2000,5000,2000]);h.timer(2000);assert.deepEqual(plain(await a),reject('DNS_TIMEOUT'));assert.equal((await h.sender.send(input())).code,'CAPACITY_UNAVAILABLE');let idle=false;const drained=h.sender.idle().then(()=>{idle=true;});await flush();assert.equal(idle,false);h.answer(undefined,0);await flush();assert.equal(idle,false);const close=h.sender.close();assert.equal((await b).code,'ABORTED');h.answer(undefined,1);await close;await drained;assert.equal(idle,true);assert.equal(h.requests.length,0);
});

test('71 monotonic total deadline covers DNS and authorization and suppresses late guard success or failure dispatch',async()=>{
    for(const phase of ['dns','guard'] as const){const h=harness();let guarded=0,allow!:(value:boolean)=>void;const held=new Promise<boolean>(resolve=>{allow=resolve;});const pending=h.sender.send({...input(),beforeDispatch:()=>{guarded++;return held;}});if(phase==='dns')h.state.now=5000;h.answer();await flush();if(phase==='guard'){assert.equal(guarded,1);h.state.now=5000;allow(true);}assert.equal((await pending).code,'DEADLINE');assert.equal(h.requests.length,0);await h.sender.close();}
    for(const fail of [false,true]){const h=harness();let allow!:(value:boolean)=>void,deny!:(error:Error)=>void;const held=new Promise<boolean>((resolve,reject)=>{allow=resolve;deny=reject;});const pending=h.sender.send({...input(),beforeDispatch:()=>held});h.answer();await flush();h.timer(5000);assert.deepEqual(plain(await pending),reject('DEADLINE'));let idle=false;const drain=h.sender.idle().then(()=>{idle=true;});await flush();assert.equal(idle,false);if(fail)deny(new Error('late private failure'));else allow(true);await drain;assert.equal(h.requests.length,0);await h.sender.close();}
    for(const behavior of ['deny','throw'] as const){const h=harness(),pending=h.sender.send({...input(),beforeDispatch:async()=>{if(behavior==='throw')throw new Error('private guard failure');return false;}});h.answer();assert.equal((await pending).code,behavior==='throw'?'GUARD_FAILED':'DISPATCH_DENIED');assert.equal(h.requests.length,0);await h.sender.close();}
});

test('71 response cap counts cumulative bytes accepts exact4096 denies4097 and distinguishes request creation refusal from dispatched unknown errors',async()=>{
    for(const mode of ['exact','overflow','incomplete','undefined','low','high','error','aborted','request-error','request-throw'] as const){const h=harness();h.state.requestThrow=mode==='request-throw';const pending=h.sender.send(input());h.answer();await flush();if(mode!=='request-throw'){
        const response=h.respond(mode==='undefined'?undefined:mode==='low'?99:mode==='high'?600:204,mode!=='incomplete');if(mode==='undefined')response.statusCode=undefined;
        if(mode==='exact'||mode==='overflow'){response.emit('data',Buffer.alloc(2048));response.emit('data',Buffer.alloc(mode==='exact'?2048:2049));}
        if(mode==='error'||mode==='aborted')response.emit(mode,new Error('private response failure'));else if(mode==='request-error')h.requests[0]!.req.emit('error',new Error('private TLS error'));else response.emit('end');
    }const result=await pending;assert.deepEqual(plain(result),mode==='exact'?{outcome:'delivered',code:'HTTP_ACCEPTED',statusCode:204}:mode==='request-throw'?reject('NETWORK_UNKNOWN'):unknown(mode==='overflow'?'RESPONSE_LIMIT':'NETWORK_UNKNOWN'),mode);assert.equal(h.dns.length,1);assert.equal(h.requests.length,mode==='request-throw'?0:1);await h.sender.close();}
});

test('71 all HTTP class boundaries redirect and retry statuses retain one request and original public outcome',async()=>{
    for(const status of [100,199,200,204,299,300,301,302,307,308,400,408,429,500,503,599]){const h=harness(),pending=h.sender.send(input());h.answer();await flush();const response=h.respond(status);response.headers={location:'https://another.tunex.org/redirect'};response.emit('end');assert.deepEqual(plain(await pending),{outcome:status>=200&&status<300?'delivered':'rejected',code:status>=200&&status<300?'HTTP_ACCEPTED':'HTTP_REJECTED',statusCode:status});await h.sender.close();assert.equal(h.requests.length,1);assert.equal(h.dns.length,1);}
});

test('71 dispatched settlement waits independently for real request and socket close before idle releases capacity',async()=>{
    const h=harness();h.state.autoClose=false;const a=h.sender.send(input()),b=h.sender.send(input());h.answer(undefined,0);h.answer(undefined,1);await flush();h.respond(204,true,0).emit('end');assert.equal((await a).code,'HTTP_ACCEPTED');assert.equal((await h.sender.send(input())).code,'CAPACITY_UNAVAILABLE');let idle=false;const drain=h.sender.idle().then(()=>{idle=true;});h.requests[0]!.req.emit('close');await flush();assert.equal(idle,false);h.requests[0]!.socket.emit('close');await flush();assert.equal(idle,false);
    const close=h.sender.close();assert.deepEqual(plain(await b),unknown('ABORTED'));h.requests[1]!.socket.emit('close');await flush();assert.equal(idle,false);h.requests[1]!.req.emit('close');await close;await drain;assert.equal(idle,true);assert.equal((await h.sender.send(input())).code,'ABORTED');assert.ok(h.requests.every(item=>item.reqDestroyed>0&&item.socketDestroyed>0));
});

test('71 post-dispatch deadline and cancellation destroy owned response request socket and late response is destroyed',async()=>{
    for(const mode of ['deadline','cancel'] as const){const h=harness(),controller=new AbortController(),pending=h.sender.send({...input(),signal:controller.signal});h.answer();await flush();const response=h.respond();if(mode==='deadline')h.timer(5000);else controller.abort(new Error('private cancellation reason'));assert.deepEqual(plain(await pending),unknown(mode==='deadline'?'DEADLINE':'ABORTED'));assert.ok(response.destroyed>0);assert.ok(h.requests[0]!.reqDestroyed>0);assert.ok(h.requests[0]!.socketDestroyed>0);const late=h.respond();assert.equal(late.destroyed,1);await h.sender.close();assert.ok(h.timers.every(timer=>timer.cleared));}
});
