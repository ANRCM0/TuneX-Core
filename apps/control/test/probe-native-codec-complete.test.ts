import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as native from '../src/compatibility/public.ts';
import * as restored from '../src/compatibility/native-probe-result-codec.ts';
import * as canonical from '../src/compatibility/native-probe-result.ts';
import * as wire from '@tunex/contracts/probe';
import * as echo from '@tunex/contracts/staged/probe-echo';
import { digest } from '@tunex/contracts/shared';
import { probeMeasurement } from '../src/modules/probe-owner/public.ts';

type FunctionMap = Record<string, (...args:any[])=>any>;
function loaded(path:string,providers:Record<string,unknown>,globals:Record<string,unknown>={}) {
    const source=readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
    const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    const exports:FunctionMap={};
    new vm.Script(javascript,{filename:path}).runInNewContext({exports,require(name:string){assert.ok(Object.hasOwn(providers,name),name);return providers[name];},...globals});
    return exports;
}
const vector=JSON.parse(readFileSync(new URL('../../../packages/contracts/fixtures/probe-result-v1.json',import.meta.url),'utf8')) as {request:wire.ProbeResultRequest};
const base=vector.request,at=Date.parse(base.measuredAt)+10;
function result(version:1|2|3|4) {
    if(version===1)return {...base};
    const description=probeMeasurement('tcp-connect-v1');
    return {...base,...description,probeVersion:version,kind:version===2?'probe-types-result':version===3?'probe-services-result':'probe-echo-result',
        ...(version>=3?{service:null,tls:null}:{}),...(version===4?{businessProtocol:'tcp',challenge:null,echo:null,requestBytes:0,responseBytes:0}:{})};
}
test('45/46/52 original restored public parsers helpers and ACKs are the same canonical functions with no new value exports',()=>{
    const names=['nativeProbeResultRequest','nativeStoredProbeResultCheck','nativeProbeResultAck','nativeProbeTypesResultAck','nativeProbeServicesResultAck'] as const;
    assert.deepEqual(Object.keys(restored).sort(),[...names].sort());
    for(const name of names){assert.equal(restored[name],canonical[name]);assert.equal(native[name],canonical[name]);}
    for(const name of ['parseProbeResult','probeResultBody','probeResultDigest','parseProbeTypes','probeTypesResultBody','probeTypesResultDigest',
        'parseProbeServices','probeServicesResultBody','probeServicesResultDigest','parseProbeServiceSelection','parseProbeServiceContext',
        'probeServiceSelection','checkProbeResult','checkProbeTypes','checkProbeServices','parseProbeDelivery','parseProbeClaim','parseProbeNegotiation','parseProbeInstance'] as const)
        assert.equal(native[name],wire[name],name);
    for(const name of ['parseProbeEcho','probeEchoResultBody','probeEchoResultDigest','parseProbeEchoServiceContext','parseProbeEchoChallenge',
        'probeEchoServiceSelection','verifyProbeEchoProof','probeEchoInvocationDigest','probeEchoRequestFrame'] as const)assert.equal(native[name],echo[name],name);
});

test('52 actual dispatch source preserves inherited discriminant read count v4 v3 v2 v1 and exactly one JSON phase before parser body digest',()=>{
    const calls:unknown[][]=[],failure=new Error('original parser failure');let fail=false;
    const codecs:FunctionMap={};
    for(const [name,body,hash] of [['parseProbeEcho','probeEchoResultBody','probeEchoResultDigest'],['parseProbeServices','probeServicesResultBody','probeServicesResultDigest'],
        ['parseProbeTypes','probeTypesResultBody','probeTypesResultDigest'],['parseProbeResult','probeResultBody','probeResultDigest']]){
        codecs[name!]=(label,raw)=>{calls.push([name,label,raw]);if(fail)throw failure;return {measurement:'original-measurement'};};
        codecs[body!]=request=>{calls.push([body,request]);return {body};};codecs[hash!]=request=>{calls.push([hash,request]);return hash;};
    }
    const api=loaded('compatibility/native-probe-result.ts',{'../framework/public.ts':{ControlError:Error},'./native-observability-codecs.ts':codecs,
        './native-module-values.ts':{nativeJsonEncode(value:unknown){calls.push(['json',value]);return 'original-json';},nativeIsoTime(){assert.fail('dispatch must not format');}}});
    assert.equal(calls.length,0,'module initialization calls no provider');
    for(const version of [4,3,2,1,99]){
        calls.length=0;let reads=0;const input=Object.create({get probeVersion(){reads++;return version;}});
        const envelope=api.nativeProbeResultRequest!(input);
        const parser=version===4?'parseProbeEcho':version===3?'parseProbeServices':version===2?'parseProbeTypes':'parseProbeResult';
        assert.equal(reads,version===4?1:version===3?2:3);
        assert.deepEqual(calls.slice(0,2),[['json',input],[parser,version>=2&&version<=4?'ResultRequest':'Request','original-json']]);
        assert.equal(calls.length,4);assert.equal(calls[2]![1],calls[3]![1]);
        assert.deepEqual(Object.keys(envelope),['request','measurement','body','resultDigest']);
        assert.equal(Object.isFrozen(envelope),false);assert.equal(envelope.measurement,version>=2&&version<=4?'original-measurement':'tcp-connect-v1');
    }
    for(const input of [null,undefined,[],{},'value',false,2]){calls.length=0;api.nativeProbeResultRequest!(input);assert.equal(calls[1]![0],'parseProbeResult');}
    fail=true;calls.length=0;assert.throws(()=>api.nativeProbeResultRequest!({probeVersion:4}),error=>error===failure);assert.equal(calls.length,2);
    const getter=new Error('original discriminant');calls.length=0;assert.throws(()=>api.nativeProbeResultRequest!({get probeVersion(){throw getter;}}),error=>error===getter);assert.equal(calls.length,0);
});

test('46/52 real four-family request envelope keeps canonical body digest and no v4 ACK projection',()=>{
    for(const version of [1,2,3,4] as const){
        const input=result(version),envelope=native.nativeProbeResultRequest(input);
        assert.deepEqual(Object.keys(envelope),['request','measurement','body','resultDigest']);assert.equal(Object.isFrozen(envelope),false);
        assert.equal(Object.isFrozen(envelope.request),true);assert.equal(Object.hasOwn(envelope.body,'requestId'),false);
        assert.equal(envelope.measurement,'tcp-connect-v1');assert.equal(envelope.resultDigest,digest(envelope.body));
        assert.deepEqual(Object.keys(envelope.body),Object.keys(envelope.request).filter(name=>name!=='requestId'));
        assert.equal(envelope.request.probeVersion,version);
        if(version===3||version===4){const stored={...envelope, get acceptedAt():never{return assert.fail('guard must not inspect acceptedAt');}};native.nativeStoredProbeResultCheck(stored);
            assert.throws(()=>native.nativeStoredProbeResultCheck({...envelope,resultDigest:'sha256:'+'0'.repeat(64)}),{code:'INTEGRITY_FAILURE',status:409});
            const withRequest={...envelope,body:{...envelope.body,requestId:'0'.repeat(64)}};assert.throws(()=>native.nativeStoredProbeResultCheck(withRequest),{code:'INTEGRITY_FAILURE',status:409});}
    }
    assert.equal(Object.hasOwn(native,'nativeProbeEchoResultAck'),false);
    for(const body of [null,undefined,{}, {probeVersion:1,requestId:'deliberately-unchecked'}, {probeVersion:2,requestId:'deliberately-unchecked'}])
        native.nativeStoredProbeResultCheck({body,resultDigest:'unchecked'} as never);
});

test('52 actual stored guard reads v4 before v3 keeps own requestId refusal zero temporary identity and exact corruption mapping',()=>{
    const calls:unknown[][]=[];
    class Failure extends Error {readonly code:string;readonly status:number;constructor(code:string,status:number,message:string){super(message);this.code=code;this.status=status;}}
    const codecs:FunctionMap={};let reject=false;
    for(const [parse,hash] of [['parseProbeEcho','probeEchoResultDigest'],['parseProbeServices','probeServicesResultDigest']]){
        codecs[parse!]=(label,raw)=>{calls.push([parse,label,raw]);if(reject)throw new Error('native');return {parsed:parse};};
        codecs[hash!]=request=>{calls.push([hash,request]);return 'expected-digest';};
    }
    const api=loaded('compatibility/native-probe-result.ts',{'../framework/public.ts':{ControlError:Failure},'./native-observability-codecs.ts':codecs,
        './native-module-values.ts':{nativeJsonEncode(value:unknown){calls.push(['json',value]);return 'json';}}});
    for(const version of [4,3]){
        const body=Object.create({requestId:'inherited-allowed'});body.probeVersion=version;body.first='original';calls.length=0;
        api.nativeStoredProbeResultCheck!({body,resultDigest:'expected-digest',get acceptedAt():never{return assert.fail('acceptedAt');}});
        assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),['json',{probeVersion:version,first:'original',requestId:'0'.repeat(64)}]);
        assert.deepEqual(Object.keys(calls[0]![1] as object),['probeVersion','first','requestId']);assert.equal(calls[1]![0],version===4?'parseProbeEcho':'parseProbeServices');
        calls.length=0;assert.throws(()=>api.nativeStoredProbeResultCheck!({body:{...body,requestId:undefined},resultDigest:'expected-digest'}),
            {code:'INTEGRITY_FAILURE',status:409,message:version===4?'Invalid stored Probe echo result':'Invalid stored Probe services result'});assert.equal(calls.length,0);
        reject=true;assert.throws(()=>api.nativeStoredProbeResultCheck!({body,resultDigest:'expected-digest'}),{code:'INTEGRITY_FAILURE',status:409});reject=false;
    }
});

test('45/52 real v1 v2 v3 ACKs retain independent ordered keys UTC receipt duplicate and disabled unknown fields',()=>{
    const receipt={resultDigest:'',acceptedAt:at,duplicate:true};
    for(const version of [1,2,3] as const){
        const envelope=native.nativeProbeResultRequest(result(version));receipt.resultDigest=envelope.resultDigest;
        const ack=version===1?native.nativeProbeResultAck(envelope.request as wire.ProbeResultRequest,receipt,at+10):version===2?
            native.nativeProbeTypesResultAck(envelope.request as wire.ProbeTypesResultRequest,receipt,at+10,probeMeasurement('tcp-connect-v1')):
            native.nativeProbeServicesResultAck(envelope.request as wire.ProbeServicesResultRequest,receipt,at+10,probeMeasurement('tcp-connect-v1'));
        assert.deepEqual(Object.keys(ack),version===1?['protocolVersion','probeVersion','kind','nodeId','bootId','sessionEpoch','instanceId','instanceGeneration','permitId','requestId','resultDigest','acceptedAt','serverTime','duplicate','health','executionEnabled']:
            ['measurement','taskKind','point','capability','protocolVersion','probeVersion','kind','nodeId','bootId','sessionEpoch','instanceId','instanceGeneration','requestId','permitId',...(version===3?['service']:[]),'resultDigest','acceptedAt','serverTime','duplicate','health','executionEnabled']);
        assert.equal(ack.acceptedAt,new Date(at).toISOString());assert.equal(ack.serverTime,new Date(at+10).toISOString());assert.equal(ack.duplicate,true);
        assert.equal(ack.health,'unknown');assert.equal(ack.executionEnabled,false);assert.ok(Object.isFrozen(ack));
    }
});

test('53 actual machine codecs initialize without effects and preserve every request-spread response order and lazy callback boundary',()=>{
    const calls:unknown[][]=[],parsers:FunctionMap={};
    for(const name of ['parseProbeInstance','parseProbeClaim','parseProbeDelivery','parseProbeTypes','parseProbeServices'])
        parsers[name]=(label,raw)=>{calls.push([name,label]);return JSON.parse(raw);};
    parsers.parseProbeServiceContext=value=>{calls.push(['service',value]);return {parsedService:value};};
    for(const name of ['checkProbeTypes','checkProbeServices'])parsers[name]=(...args)=>{calls.push([name,...args]);};
    const api=loaded('compatibility/native-probe-machine.ts',{'@tunex/core':{deepFreeze(value:unknown){calls.push(['freeze']);return value;}},
        './native-observability-codecs.ts':parsers,'./native-module-values.ts':{nativeJsonEncode(value:unknown){calls.push(['json',value]);return JSON.stringify(value);},nativeIsoTime(value:number){calls.push(['iso',value]);return 'iso:'+value;}}});
    assert.equal(calls.length,0);
    const request={first:'original',kind:'request',last:'original'},permit={binding:{binding:true},timeoutMs:1000,issuedAt:1,expiresAt:2000,closedAt:10,checkedAt:11};
    for(const prefix of ['Types','Services']){
        for(const offer of [null,{permitId:'permit-a',...permit}, {permitId:'permit-a',...permit,serviceContext:{context:true}}]){
            calls.length=0;let descriptions=0;
            const ack=api['nativeProbe'+prefix+'PollAck']!(request,12,13,offer,()=>{descriptions++;calls.push(['describe']);return {measurement:'m',taskKind:'k',point:'p',capability:'c'};});
            assert.equal(descriptions,offer?1:0);assert.deepEqual(Object.keys(ack),['first','kind','last','observedAt','serverTime','executionEnabled','offer']);
            assert.equal(ack.executionEnabled,false);assert.equal(ack.offer===null,offer===null);
            if(offer){assert.deepEqual(Object.keys(ack.offer),['measurement','taskKind','point','capability','permitId','binding','timeoutMs','issuedAt','expiresAt',...(prefix==='Services'?['serviceContext']:[])]);
                assert.ok(calls.findIndex(value=>value[0]==='describe')<calls.findIndex(value=>value[0]==='iso'&&value[1]===1));}
            assert.equal(calls.filter(value=>value[0]==='service').length,prefix==='Services'&&offer&&'serviceContext'in offer?1:0);
            assert.equal(calls.at(-1)![0],'checkProbe'+prefix);
        }
        for(const suffix of ['Claim','Status']){
            calls.length=0;const ack=api['nativeProbe'+prefix+suffix+'Ack']!(request,permit,13);
            assert.deepEqual(Object.keys(ack),['first','kind','last','binding','timeoutMs','issuedAt','expiresAt','consumedAt',...(suffix==='Status'?['checkedAt']:[]),'serverTime','state','executionEnabled']);
            assert.equal(ack.state,'consumed');assert.equal(ack.executionEnabled,false);assert.equal(calls.at(-1)![0],'checkProbe'+prefix);
        }
    }
    calls.length=0;const instance=api.nativeProbeInstanceAck!(request,{generation:2,state:'registered'},null,()=>{calls.push(['serverTime']);return 20;});
    assert.deepEqual(Object.keys(instance),['first','kind','last','generation','state','currentInstanceId','registeredAt','expiresAt','serverTime','executionEnabled']);
    assert.equal(instance.currentInstanceId,null);assert.equal(instance.registeredAt,null);assert.equal(instance.expiresAt,null);
    assert.equal(calls[0]![0],'serverTime');
    calls.length=0;const qualification=api.nativeProbeServicesQualificationAck!(request,{qualified:false,qualifiedAt:null,expiresAt:null},()=>{calls.push(['serverTime']);return 20;});
    assert.deepEqual(Object.keys(qualification),['first','kind','last','qualified','qualifiedAt','expiresAt','serverTime','executionEnabled']);assert.equal(calls[0]![0],'serverTime');
    const failure=new Error('description');calls.length=0;assert.throws(()=>api.nativeProbeTypesPollAck!(request,12,13,{permitId:'p',...permit},()=>{throw failure;}),error=>error===failure);
    assert.deepEqual(calls,[['iso',12],['iso',13]],'descriptor failure precedes offer ISO JSON parser check');
    calls.length=0;const negotiation=api.nativeProbeNegotiationAck!(request,20);
    assert.deepEqual(Object.keys(negotiation),['first','kind','last','serverTime','state','executionEnabled']);assert.equal(negotiation.state,'contract-only');assert.deepEqual(calls,[['iso',20],['freeze']]);
    for(const suffix of ['Claim','Status']){
        calls.length=0;const ack=api['nativeProbe'+suffix+'Ack']!(request,permit,13);
        assert.deepEqual(Object.keys(ack),['first','kind','last','binding','timeoutMs','issuedAt','expiresAt','consumedAt',...(suffix==='Status'?['checkedAt']:[]),'serverTime','state','executionEnabled']);
        assert.equal(ack.executionEnabled,false);assert.equal(calls.at(-1)![0],suffix==='Claim'?'parseProbeClaim':'parseProbeDelivery');
    }
    for(const offer of [null,{permitId:'p',...permit}]){
        const ack=api.nativeProbePollAck!(request,12,13,offer);assert.equal(ack.offer===null,offer===null);
        if(offer)assert.deepEqual(Object.keys(ack.offer),['permitId','binding','timeoutMs','issuedAt','expiresAt']);
    }
    calls.length=0;const current=api.nativeProbeInstanceAck!(request,{generation:2,state:'registered'},{instanceId:'current',registeredAt:2,expiresAt:30},()=>{calls.push(['serverTime']);return 20;});
    assert.equal(current.currentInstanceId,'current');assert.deepEqual(calls.slice(0,4),[['iso',2],['iso',30],['serverTime'],['iso',20]]);
    calls.length=0;api.nativeProbeTypesQualificationAck!(request,{qualified:true,qualifiedAt:2,expiresAt:30},20);assert.deepEqual(calls.slice(0,3),[['iso',2],['iso',30],['iso',20]]);
    calls.length=0;api.nativeProbeServicesQualificationAck!(request,{qualified:true,qualifiedAt:2,expiresAt:30},()=>{calls.push(['serverTime']);return 20;});assert.deepEqual(calls.slice(0,4),[['iso',2],['iso',30],['serverTime'],['iso',20]]);
});

test('45/53 real typed/service nullable offers and every supported measurement retain schema checks disabled state and exact 250ms boundary',()=>{
    const identity={protocolVersion:3,nodeId:base.nodeId,bootId:base.bootId,sessionEpoch:base.sessionEpoch,instanceId:base.instanceId,instanceGeneration:base.instanceGeneration,requestId:base.requestId};
    const observed=Date.parse(base.issuedAt)+100,permit={permitId:base.permitId,binding:base.binding,timeoutMs:1000,issuedAt:Date.parse(base.issuedAt),expiresAt:Date.parse(base.expiresAt)};
    const typed=wire.parseProbeTypes('PollRequest',JSON.stringify({...identity,probeVersion:2,kind:'probe-types-poll',measurements:['tcp-connect-v1','tcp-ingress-connect-v1']}));
    const services=wire.parseProbeServices('PollRequest',JSON.stringify({...identity,probeVersion:3,kind:'probe-services-poll',measurements:['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1']}));
    assert.equal(native.nativeProbeTypesPollAck(typed,observed,observed+250,null,()=>assert.fail('null offer')).offer,null);
    assert.equal(native.nativeProbeServicesPollAck(services,observed,observed+250,null,()=>assert.fail('null offer')).offer,null);
    assert.throws(()=>native.nativeProbeTypesPollAck(typed,observed,observed+251,null,()=>assert.fail('null offer')),/typed Probe v2/);
    assert.throws(()=>native.nativeProbeServicesPollAck(services,observed,observed+251,null,()=>assert.fail('null offer')),/service-bound Probe v3/);
    for(const measurement of ['tcp-connect-v1','tcp-ingress-connect-v1'] as const){
        const description=probeMeasurement(measurement);let calls=0;
        const typedAck=native.nativeProbeTypesPollAck(typed,observed,observed+1,permit,()=>{calls++;return description;});
        const serviceAck=native.nativeProbeServicesPollAck(services,observed,observed+1,permit,()=>{calls++;return description;});
        assert.equal(calls,2);assert.equal(typedAck.offer!.measurement,measurement);assert.equal(serviceAck.offer!.measurement,measurement);
        assert.equal(serviceAck.offer!.serviceContext,null);assert.ok(Object.isFrozen(typedAck.offer));assert.ok(Object.isFrozen(serviceAck.offer));
    }
    const config={version:1,purpose:'direct-ingress-tls-handshake',endpoint:{address:'127.0.0.1',port:9000},trust:{mode:'pinned-leaf-v1',serverName:'probe.example',certificateDer:'AQ=='},validFrom:permit.issuedAt,validUntil:permit.expiresAt};
    const context={scopeId:'scope-a',serviceId:'service-a',revision:1,configRevision:1,configDigest:digest(config),config};
    const serviceContext={...context,contextDigest:digest(context)};
    const ack=native.nativeProbeServicesPollAck(services,observed,observed+1,{...permit,serviceContext},()=>probeMeasurement('tcp-ingress-tls-v1'));
    assert.equal(ack.offer!.measurement,'tcp-ingress-tls-v1');assert.deepEqual(JSON.parse(JSON.stringify(ack.offer!.serviceContext)),serviceContext);
    assert.throws(()=>native.nativeProbeServicesPollAck(services,observed,observed+1,permit,()=>probeMeasurement('tcp-ingress-tls-v1')),/service-bound Probe v3/);
    assert.equal(ack.executionEnabled,false);
});

test('42/46 staged native and retained history echo invocation keep exact ISO service nonce bytes frame hash and Ed25519 proof',()=>{
    const keys=generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64');
    const issuedAt=Date.parse(base.issuedAt),expiresAt=Date.parse(base.expiresAt),nonce=Buffer.alloc(32,7).toString('base64');
    const config={version:2,purpose:'controlled-nonce-echo',endpoint:{address:'127.0.0.1',port:9000,protocols:['tcp','udp']},trust:{mode:'ed25519-echo-v1',publicKey},validFrom:issuedAt,validUntil:expiresAt};
    const contextFields={scopeId:'scope-a',serviceId:'service-a',revision:1,configRevision:1,configDigest:digest(config),config};
    const context=echo.parseProbeEchoServiceContext({...contextFields,contextDigest:digest(contextFields)}),selection=echo.probeEchoServiceSelection(context);
    for(const measurement of ['tcp-ingress-echo-v1','udp-ingress-echo-v1'] as const){
        const events:string[]=[],source={id:base.permitId,measurement,binding:base.binding,instanceId:base.instanceId,instanceGeneration:base.instanceGeneration,timeoutMs:1000,issuedAt,expiresAt};
        const invocation=native.nativeProbeEchoInvocation(source,()=>{events.push('context');return context;},()=>{events.push('nonce');return nonce;});
        assert.deepEqual(events,['context','nonce']);assert.deepEqual(Object.keys(invocation),['domain','probeVersion','measurement','permitId','binding','instanceId','instanceGeneration','timeoutMs','issuedAt','expiresAt','service','nonce']);
        assert.equal(invocation.binding,source.binding);assert.equal(Object.isFrozen(invocation),false);assert.equal(invocation.issuedAt,base.issuedAt);
        const challenge={nonce,invocationDigest:digest(invocation)};assert.equal(native.probeEchoInvocationDigest(invocation),challenge.invocationDigest);
        const history=native.nativeProbeHistoryEchoInvocation({...source,probeId:source.id,service:selection,echoChallenge:challenge});
        assert.deepEqual(history,invocation);assert.equal(history.service,selection);
        const expected=Buffer.alloc(256);expected.write('TNXECHOQ',0,'ascii');expected[8]=1;expected[9]=measurement.startsWith('tcp')?1:2;
        expected.writeBigUInt64BE(BigInt(expiresAt),16);Buffer.from(nonce,'base64').copy(expected,24);Buffer.from(selection.contextDigest.slice(7),'hex').copy(expected,56);Buffer.from(challenge.invocationDigest.slice(7),'hex').copy(expected,88);
        const frame=native.probeEchoRequestFrame(invocation,challenge);assert.deepEqual(frame,expected);assert.deepEqual(frame.subarray(120),Buffer.alloc(136));
        const hash=createHash('sha256').update(expected).digest(),response=Buffer.alloc(192);expected.copy(response,0,0,120);response.write('TNXECHOR',0,'ascii');hash.copy(response,120);
        const proof={algorithm:'Ed25519' as const,requestDigest:'sha256:'+hash.toString('hex'),signature:sign(null,Buffer.concat([Buffer.from('tunex.echo.response.v1\0','ascii'),response]),keys.privateKey).toString('base64'),verified:true as const};
        assert.equal(native.verifyProbeEchoProof(context,invocation,challenge,proof),true);
        for(const changed of [{...proof,requestDigest:'sha256:'+'0'.repeat(64)},{...proof,signature:Buffer.alloc(64).toString('base64')}])assert.equal(native.verifyProbeEchoProof(context,invocation,challenge,changed),false);
        assert.throws(()=>native.probeEchoRequestFrame(invocation,{...challenge,nonce:Buffer.alloc(32,8).toString('base64')}));
        const failure=new Error('context');let nonceCalls=0;assert.throws(()=>native.nativeProbeEchoInvocation(source,()=>{throw failure;},()=>{nonceCalls++;return nonce;}),error=>error===failure);assert.equal(nonceCalls,0);
    }
});
