import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { TLSSocket } from 'node:tls';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import * as Contracts from '@tunex/contracts/shared';
import * as Runtime from '@tunex/contracts/runtime';
import * as Transit from '@tunex/contracts/experimental/transit';
import * as Probe from '@tunex/contracts/probe';
import * as Observation from '@tunex/contracts/observability';
import * as Public from '../src/compatibility/public.ts';
import * as Http from '../src/compatibility/native-control-http.ts';
import * as Codec from '../src/compatibility/native-http-codecs.ts';
import { ControlError } from '../src/framework/public.ts';
import * as NativeApp from '../src/compatibility/native-control-app.ts';
import * as HttpPublic from '../src/compatibility/control-http/public.ts';
import { createControlApp } from '../src/api/public.ts';

test('136 native session header keeps exact decimal counter grammar and original conversion errors',()=>{
    assert.equal(Public.nativeControlSessionEpoch,Http.nativeControlSessionEpoch);
    for(const value of ['1','9','10',String(MAX_COUNTER)])assert.equal(Http.nativeControlSessionEpoch(value),Number(value));
    for(const value of [undefined,'','0','00','01','-1','+1',' 1','1 ','1\t','1\n','1\r','1.0','1e0','0x10','Infinity','NaN','１','١',String(MAX_COUNTER+1),'9'.repeat(500)])
        assert.throws(()=>Http.nativeControlSessionEpoch(value),{code:'SESSION_SUPERSEDED',status:409,message:'Valid session header required'});
    const trace:string[]=[],error=new Error('original coercion');
    for(const failAt of [1,2,3]){
        let calls=0;trace.length=0;
        const input={ [Symbol.toPrimitive](hint:string){trace.push(hint);if(++calls===failAt)throw error;return '1';} };
        assert.throws(()=>Http.nativeControlSessionEpoch(input as unknown as string),failure=>failure===error);
        assert.deepEqual(trace,['string','number','number'].slice(0,failAt));
    }
    let calls=0;
    const changing={ [Symbol.toPrimitive](){return ['1',1,2][calls++];} };
    assert.equal(Http.nativeControlSessionEpoch(changing as unknown as string),2);assert.equal(calls,3);
});

type Chunk={done:boolean;value?:Uint8Array};
function bodyFixture(chunks:Chunk[]){
    const events:string[]=[],errors:{read?:unknown;release?:unknown;get?:unknown}={};
    let index=0;
    const reader={async read(){assert.equal(this,reader);events.push('read');if(errors.read)throw errors.read;return chunks[index++]??{done:true};},
        releaseLock(){assert.equal(this,reader);events.push('release');if(errors.release)throw errors.release;}};
    const body={getReader(){assert.equal(this,body);events.push('get');if(errors.get)throw errors.get;return reader;}};
    return {request:{body} as unknown as Request,events,errors};
}

test('136 native body reader accumulates bytes across split UTF8 then releases before fatal decoding without parsing JSON',async()=>{
    assert.equal(Public.nativeControlRequestBody,Http.nativeControlRequestBody);
    const bytes=new TextEncoder().encode('A€𐍈');
    const f=bodyFixture(Array.from(bytes,byte=>({done:false,value:Uint8Array.of(byte)})));
    assert.equal(await Http.nativeControlRequestBody(f.request,bytes.length),'A€𐍈');
    assert.deepEqual(f.events,['get',...Array(bytes.length+1).fill('read'),'release']);
    const malformed=bodyFixture([{done:false,value:Uint8Array.of(0xc3)}]);
    await assert.rejects(Http.nativeControlRequestBody(malformed.request),TypeError);assert.deepEqual(malformed.events,['get','read','read','release']);
    const notJSON=bodyFixture([{done:false,value:new TextEncoder().encode('{invalid-json')}]);
    assert.equal(await Http.nativeControlRequestBody(notJSON.request),'{invalid-json');
    const empty=bodyFixture([]);assert.equal(await Http.nativeControlRequestBody(empty.request,0),'');assert.deepEqual(empty.events,['get','read','release']);
    for(const request of [{}, {body:null}])await assert.rejects(Http.nativeControlRequestBody(request as Request),{code:'INVALID_CONFIG',status:422,message:'Request body required'});
});

test('136 native body limit counts bytes and stops before another read while release errors keep original finally precedence',async()=>{
    for(const limit of [0,1,1048576]){
        const f=bodyFixture([{done:false,value:new Uint8Array(limit+1)},{done:false,value:Uint8Array.of(1)}]);
        await assert.rejects(Http.nativeControlRequestBody(f.request,limit),{code:'RESOURCE_LIMIT',status:413,message:'Request body too large'});
        assert.deepEqual(f.events,['get','read','release']);
    }
    const exact=bodyFixture([{done:false,value:new Uint8Array(1048576)}]);assert.equal((await Http.nativeControlRequestBody(exact.request)).length,1048576);
    const defaultOverflow=bodyFixture([{done:false,value:new Uint8Array(1048577)}]);await assert.rejects(Http.nativeControlRequestBody(defaultOverflow.request),{status:413});
    for(const mode of ['read','decode','limit','success'] as const){
        const f=bodyFixture([{done:false,value:Uint8Array.of(mode==='decode'?0xc3:65)}]),readError=new Error('read'),releaseError=new Error('release');
        if(mode==='read')f.errors.read=readError;f.errors.release=releaseError;
        await assert.rejects(Http.nativeControlRequestBody(f.request,mode==='limit'?0:10),error=>error===releaseError);
        assert.equal(f.events.at(-1),'release');assert.equal(f.events.filter(event=>event==='release').length,1);
    }
    const f=bodyFixture([]),readError=new Error('original read failure');f.errors.read=readError;
    await assert.rejects(Http.nativeControlRequestBody(f.request),error=>error===readError);assert.deepEqual(f.events,['get','read','release']);
    const acquisition=bodyFixture([]),getError=new Error('getReader failure');acquisition.errors.get=getError;
    await assert.rejects(Http.nativeControlRequestBody(acquisition.request),error=>error===getError);assert.deepEqual(acquisition.events,['get']);
    const malformed=bodyFixture([{done:false}]);await assert.rejects(Http.nativeControlRequestBody(malformed.request),TypeError);assert.deepEqual(malformed.events,['get','read','release']);
    for(const limit of [NaN,Infinity]){const permissive=bodyFixture([{done:false,value:Uint8Array.of(65)}]);assert.equal(await Http.nativeControlRequestBody(permissive.request,limit),'A');}
});

test('43 native HTTP parser aliases preserve every canonical version-family implementation identity',()=>{
    assert.equal(Codec.nativeRequestId,randomUUID);assert.equal(Codec.nativeJsonParse,Contracts.parseJson);
    const parsers={parseNodeTelemetrySample:Observation.parseNodeTelemetrySample,parseForwardTelemetrySample:Observation.parseForwardTelemetrySample,
        parseHostTelemetrySample:Observation.parseHostTelemetrySample,parseProbeTelemetrySample:Observation.parseProbeTelemetrySample,
        parseRuntimeMessage:Runtime.parseRuntimeMessage,parseTransitNegotiation:Transit.parseTransitNegotiation,parseTransitDelivery:Transit.parseTransitDelivery,
        parseProbeNegotiation:Probe.parseProbeNegotiation,parseProbeInstance:Probe.parseProbeInstance,parseProbeClaim:Probe.parseProbeClaim,
        parseProbeDelivery:Probe.parseProbeDelivery,parseProbeResult:Probe.parseProbeResult,parseProbeTypes:Probe.parseProbeTypes,parseProbeServices:Probe.parseProbeServices};
    for(const [name,parser] of Object.entries(parsers)){assert.equal(Codec[name as keyof typeof parsers],parser);assert.equal(Public[name as keyof typeof parsers],parser);}
    assert.equal(Public.nativeRequestId,randomUUID);assert.equal(Public.nativeJsonParse,Contracts.parseJson);assert.equal(Public.decodeUtf8Chunks,Codec.decodeUtf8Chunks);
});

test('136 native HTTP request error mapping retains ControlError identity and exact status/code boundaries',()=>{
    const original=new ControlError('RESOURCE_LIMIT',413,'original',true);assert.equal(Http.nativeControlRequestError(original),original);
    const statuses={INVALID_CONFIG:422,RESOURCE_LIMIT:429,INTEGRITY_FAILURE:409,AUTHORIZATION_DENIED:403,UNSUPPORTED_CAPABILITY:409,RESOURCE_CONFLICT:409,FENCING_REJECTED:409,LEASE_EXPIRED:409};
    for(const [code,status] of Object.entries(statuses)){const mapped=Http.nativeControlRequestError(new Error(code+': private detail'));assert.equal(mapped.code,code);assert.equal(mapped.status,status);assert.equal(mapped.message,'Request violates Node or deployment policy');assert.equal(mapped.retryable,false);}
    for(const error of [new SyntaxError('private'),new TypeError('private')])assert.deepEqual(Object.assign({},Http.nativeControlRequestError(error)),{code:'INVALID_CONFIG',status:400,retryable:false});
    const unknown=Http.nativeControlRequestError(new Error('unknown: private'));assert.equal(unknown.code,'INTERNAL_ERROR');assert.equal(unknown.status,503);assert.equal(unknown.retryable,true);assert.equal(unknown.message,'Control request failed');
});

test('136 Console headers preserve exact ordered values receiver and first throw without later header calls',()=>{
    const expected=[['Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"],
        ['X-Content-Type-Options','nosniff'],['X-Frame-Options','DENY'],['Referrer-Policy','no-referrer']];
    const calls:string[][]=[],owner={header(name:string,value:string){assert.equal(this,owner);calls.push([name,value]);}};
    Http.nativeControlConsoleHeaders(owner);assert.deepEqual(calls,expected);assert.equal(Public.nativeControlConsoleHeaders,Http.nativeControlConsoleHeaders);
    for(let index=0;index<4;index++){
        calls.length=0;const error=new Error('header failure'),failing={header(name:string,value:string){assert.equal(this,failing);calls.push([name,value]);if(calls.length===index+1)throw error;}};
        assert.throws(()=>Http.nativeControlConsoleHeaders(failing),failure=>failure===error);assert.deepEqual(calls,expected.slice(0,index+1));
    }
});

test('136 Probe withdrawal preserves result getter order nullability false literal and original ISO failures',()=>{
    assert.equal(Public.nativeControlProbeWithdrawal,Http.nativeControlProbeWithdrawal);
    for(const value of [undefined,null,'0',false,{},0,-0,1.25,-1]){
        const input={id:'probe',state:'withdrawn',withdrawnAt:value},result=Http.nativeControlProbeWithdrawal(input);
        assert.deepEqual(Object.keys(result),['probeId','state','executionEnabled','withdrawnAt']);
        assert.equal(result.executionEnabled,false);assert.equal(result.probeId,'probe');assert.equal(result.state,'withdrawn');
        assert.equal(result.withdrawnAt,typeof value==='number'?new Date(value).toISOString():null);
    }
    assert.equal(Http.nativeControlProbeWithdrawal({id:'probe',state:'withdrawn'}).withdrawnAt,null);
    const events:string[]=[];let reads=0;
    const changing={get id(){events.push('id');return 'probe';},get state(){events.push('state');return 'withdrawn';},get withdrawnAt(){events.push('time');return ++reads===1?1:2;}};
    assert.equal(Http.nativeControlProbeWithdrawal(changing).withdrawnAt,'1970-01-01T00:00:00.002Z');assert.deepEqual(events,['id','state','time','time']);
    for(const value of [NaN,Infinity,-Infinity,8640000000000001]){const invalid={id:'probe',state:null,withdrawnAt:value};assert.throws(()=>Http.nativeControlProbeWithdrawal(invalid),RangeError);}
    const error=new Error('withdrawal time getter'),throwing={id:'probe',state:null,get withdrawnAt():number{throw error;}};assert.throws(()=>Http.nativeControlProbeWithdrawal(throwing),failure=>failure===error);
    const inherited=Object.create({withdrawnAt:0}) as {id:string;state:null};inherited.id='probe';inherited.state=null;
    assert.equal(Http.nativeControlProbeWithdrawal(inherited).withdrawnAt,'1970-01-01T00:00:00.000Z');
});

test('136 native query helpers reevaluate original URL each call and preserve search params duplicates empty values and exceptions',()=>{
    assert.equal(HttpPublic.nativeControlQueryString,NativeApp.nativeControlQueryString);assert.equal(HttpPublic.nativeControlQueryParams,NativeApp.nativeControlQueryParams);
    const url='https://example.test/path?name=%E2%82%AC&name=&bare#ignored';
    assert.equal(NativeApp.nativeControlQueryString(url),'?name=%E2%82%AC&name=&bare');
    const first=NativeApp.nativeControlQueryParams(url),second=NativeApp.nativeControlQueryParams(url);assert.notEqual(first,second);
    assert.equal(first.size,3);assert.deepEqual([...first],[['name','€'],['name',''],['bare','']]);first.set('name','changed');assert.deepEqual(second.getAll('name'),['€','']);
    assert.equal(NativeApp.nativeControlQueryString('https://example.test/?'),'');assert.equal(NativeApp.nativeControlQueryParams('https://example.test/?').size,0);
    let count=0;const original={toString(){return `https://example.test/?n=${++count}`;}};
    assert.equal(NativeApp.nativeControlQueryString(original as unknown as string),'?n=1');assert.equal(NativeApp.nativeControlQueryParams(original as unknown as string).get('n'),'2');
    for(const helper of [NativeApp.nativeControlQueryString,NativeApp.nativeControlQueryParams]){
        assert.throws(()=>helper('relative-only'),TypeError);const error=new Error('URL coercion');assert.throws(()=>helper({toString(){throw error;}} as unknown as string),failure=>failure===error);
    }
});

test('136 original Console asset helper performs fresh per-request UTF8 reads at the exact URL and preserves read failure',async()=>{
    const url=new URL('../src/compatibility/native-control-http.ts',import.meta.url),source=(await readFile(url,'utf8')).replaceAll('import.meta.url','__originalModuleURL');
    const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    const calls:unknown[][]=[],exports:any={};let failure:unknown;
    new vm.Script(javascript).runInContext(vm.createContext({exports,URL,__originalModuleURL:url.href,require(name:string){
        if(name==='node:fs/promises')return {async readFile(...args:unknown[]){calls.push(args);if(failure)throw failure;return 'read-'+calls.length;}};
        if(name==='node:tls')return {TLSSocket};if(name==='@tunex/core')return {};if(name==='../framework/public.ts')return {};
        if(name==='./native-http-codecs.ts')return {};if(name==='./native-module-values.ts')return {};throw new Error(name);
    }}));
    assert.deepEqual(calls,[]);assert.equal(await exports.nativeControlConsoleAsset('index.html'),'read-1');assert.equal(await exports.nativeControlConsoleAsset('index.html'),'read-2');
    assert.notEqual(calls[0]![0],calls[1]![0]);assert.equal(String(calls[0]![0]),new URL('../../../web/index.html',url).href);assert.equal(calls[0]![1],'utf8');
    failure=new Error('asset read');await assert.rejects(exports.nativeControlConsoleAsset('app.js'),error=>error===failure);assert.equal(calls.length,3);
});

test('137 native fingerprint checks actual authorized TLSSocket before peer certificate and retains original peer getter error',()=>{
    for(const value of [undefined,null,{}, {authorized:true,getPeerCertificate(){assert.fail('non TLS peer');}}])assert.throws(()=>Http.nativeControlClientFingerprint(value),{code:'UNAUTHENTICATED',status:401,message:'Verified Node client certificate required'});
    const socket=Object.create(TLSSocket.prototype) as TLSSocket;Object.defineProperty(socket,'authorized',{value:false,configurable:true});
    Object.defineProperty(socket,'getPeerCertificate',{value(){assert.fail('unauthorized peer certificate read');},configurable:true});
    assert.throws(()=>Http.nativeControlClientFingerprint(socket),{status:401});Object.defineProperty(socket,'authorized',{value:true});
    Object.defineProperty(socket,'getPeerCertificate',{value(){assert.equal(this,socket);return {fingerprint256:'AA:bB:01'};},configurable:true});assert.equal(Http.nativeControlClientFingerprint(socket),'aabb01');
    Object.defineProperty(socket,'getPeerCertificate',{value(){return {};},configurable:true});assert.throws(()=>Http.nativeControlClientFingerprint(socket),{code:'UNAUTHENTICATED',status:401,message:'Node certificate required'});
    const error=new Error('peer certificate failure');Object.defineProperty(socket,'getPeerCertificate',{value(){throw error;}});assert.throws(()=>Http.nativeControlClientFingerprint(socket),failure=>failure===error);
});

test('136 actual Probe revoke route projects withdrawal only after successful original owner and never after refusal',async()=>{
    const events:string[]=[],failure=new ControlError('AUTHORIZATION_DENIED',403,'original owner refusal');let fail=false;
    const result={get id(){events.push('id');return 'probe-a';},get state(){events.push('state');return 'revoked';},get withdrawnAt(){events.push('time');return 0;}};
    const identity={async authenticate(header:string|undefined){assert.equal(this,identity);assert.equal(header,'Bearer original');events.push('authenticate');return 'actor-a';}};
    const probes={async revoke(...args:string[]){assert.equal(this,probes);assert.deepEqual(args,['actor-a','scope-a','probe-a']);events.push('revoke');if(fail)throw failure;return result;}};
    const app=createControlApp({control:{identity,probes} as never,runtime:{} as never,authority:{async allow(){events.push('authority');},async read(){return {maintenance:false};}}});
    const invoke=(body:string)=>app.request('/api/v1/scopes/scope-a/probes/probe-a/revoke',{method:'POST',headers:{authorization:'Bearer original'},body});
    let response=await invoke('{}');assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{probeId:'probe-a',state:'revoked',executionEnabled:false,withdrawnAt:'1970-01-01T00:00:00.000Z'});
    assert.deepEqual(events,['authority','authenticate','revoke','id','state','time','time']);
    events.length=0;fail=true;response=await invoke('{}');assert.equal(response.status,403);assert.deepEqual(events,['authority','authenticate','revoke']);
    assert.equal((await response.json() as {message:string}).message,failure.message);
    events.length=0;response=await invoke('{"extra":true}');assert.equal(response.status,422);assert.deepEqual(events,['authority','authenticate']);
});
