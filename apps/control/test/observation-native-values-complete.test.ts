import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as native from '../src/compatibility/public.ts';
import * as observation from '../src/modules/observation-service-owner/public.ts';
import { ProbeObservationServices } from '../src/modules/probe-owner/public.ts';
import * as echo from '@tunex/contracts/staged/probe-echo';
import * as wire from '@tunex/contracts/probe';
import * as shared from '@tunex/contracts/shared';
import * as telemetry from '@tunex/contracts/observability';
import { ControlError, invalid } from '../src/framework/public.ts';

type FunctionMap=Record<string,(...args:any[])=>any>;
function loaded(path:string,providers:Record<string,unknown>,globals:Record<string,unknown>={}) {
    const javascript=ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    const exports:FunctionMap={};new vm.Script(javascript,{filename:path}).runInNewContext({exports,require(name:string){assert.ok(Object.hasOwn(providers,name),name);return providers[name];},...globals});return exports;
}
const at=Date.parse('2026-10-17T00:00:00.000Z'),scope='scope-a',id='service-a';
function echoConfig() {
    const keys=generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64');
    return {version:2 as const,purpose:'controlled-nonce-echo' as const,endpoint:{address:'127.0.0.1',port:9000,protocols:['tcp','udp'] as const},
        trust:{mode:'ed25519-echo-v1' as const,publicKey},validFrom:at,validUntil:at+2000};
}

test('40/41/42 native helper aliases preserve public parser digest and original clock function capture without eager sampling',t=>{
    assert.equal(observation.observationObject,native.observationObject);assert.equal(observation.observationAddress,native.observationAddress);
    assert.equal(observation.observationServerName,native.observationServerName);assert.equal(native.parseObservationEchoConfig,echo.parseProbeEchoServiceConfig);
    assert.equal(native.nativeValueDigest,shared.digest);assert.equal(native.nativeParseJson,shared.parseJson);assert.equal(native.nativeCompareTimes,shared.compareTimes);
    assert.equal(native.parseProbeServiceContext,wire.parseProbeServiceContext);assert.equal(native.parseProbeEchoServiceContext,echo.parseProbeEchoServiceContext);
    for(const name of ['parseNodeTelemetryAck','parseNodeTelemetrySample','parseHostTelemetryAck','parseHostTelemetrySample','parseForwardTelemetryAck','parseForwardTelemetryCoverage','parseForwardTelemetryIdentity','parseForwardTelemetryPoint','parseForwardTelemetrySample','parseProbeTelemetryAck','parseProbeTelemetryCoverage','parseProbeTelemetryIdentity','parseProbeTelemetryPoint','parseProbeTelemetrySample','telemetryUint64'] as const)assert.equal(native[name],telemetry[name],name);
    let reads=0;const original=()=>{reads++;return 7;};t.mock.method(Date,'now',original);
    const captured=native.nativeWallClockSource();assert.equal(captured,original);assert.equal(reads,0);
    t.mock.method(Date,'now',()=>9);assert.equal(captured(),7);assert.equal(native.nativeWallClockNow(),9);assert.equal(reads,1);
});

test('40 native closed objects IP hostname identity and base64 helpers retain complete refusal boundaries and null prototype identity',()=>{
    const plain={a:1},nullProto=Object.assign(Object.create(null),{a:1});
    assert.equal(native.observationObject(plain,['a']),plain);assert.equal(native.observationObject(nullProto,['a']),nullProto);
    for(const value of [null,undefined,[],{},Object.create({a:1}),new Date(),{a:1,b:2}])assert.throws(()=>native.observationObject(value,['a']),{code:'INVALID_CONFIG'});
    for(const address of ['127.0.0.1','10.0.0.1','100.64.0.1','223.255.255.255','::1','2001:db8::1','fc00::1'])assert.equal(native.observationAddress(address),true,address);
    for(const address of ['',1,'localhost','127.000.0.1','0.1.2.3','224.0.0.1','255.255.255.255','169.254.1.1','100.100.100.200','::','::ffff:127.0.0.1','ff02::1','fe80::1','febf::1','fd00:ec2::254','2001:0db8::1','2001:DB8::1','fe80::1%eth0'])
        assert.equal(native.observationAddress(address),false,String(address));
    for(const name of ['probe.example','a-b.example','0.example'])assert.equal(native.observationServerName(name),true,name);
    for(const name of ['localhost','Probe.example','a_.example','-a.example','a-.example','a..example','127.0.0.1','a.example\n','a'.repeat(64)+'.example'])assert.equal(native.observationServerName(name),false,name);
    assert.equal(native.observationIdentityURN('a:/ ?','service-a'),'urn:tunex:observation-service:a%3A%2F%20%3F:service-a');
    for(const value of ['AA==','AAA=','AAAA'])assert.equal(native.nativeCanonicalBase64Bytes(value,Buffer.from(value,'base64').length),true);
    for(const value of ['AA','AA===','AB==',' AA==',null,{}])assert.equal(native.nativeCanonicalBase64Bytes(value,1),false);
    const config=echoConfig(),raw=Buffer.from(config.trust.publicKey,'base64');
    assert.equal(native.observationEchoFingerprint(config.trust.publicKey),'sha256:'+createHash('sha256').update(raw).digest('hex'));
    assert.throws(()=>native.observationEchoFingerprint(Buffer.alloc(31).toString('base64')));
});

test('40 real certificate preflight rejects lexical size canonical DER and parse failures before either outer callback',()=>{
    for(const [encoded,maximum] of [['',8192],['!!!!',8192],['AQ==\n',8192],['AB==',8192],['AAAA',1],['AQ==',8192]] as const){
        assert.throws(()=>native.readObservationLeaf(encoded,maximum,()=>assert.fail('expected SAN must wait for native parse'),()=>assert.fail('policy must wait for native parse')),{code:'INVALID_CONFIG'});
    }
});

test('40 actual native X509 projection preserves date usage SAN expected-key policy hash order and all strong-key boundaries',()=>{
    const calls:string[]=[],raw=Buffer.from([1,2,3]);let keyType='rsa',details:{modulusLength?:number;namedCurve?:string}|undefined={modulusLength:2048};
    const leaf={get validFrom(){calls.push('validFrom');return 'before';},get validTo(){calls.push('validTo');return 'after';},
        get keyUsage(){calls.push('usage');return ['server'];},get subjectAltName(){calls.push('sans');return 'URI:b, DNS:a';},
        get publicKey(){calls.push('key');return {get asymmetricKeyDetails(){calls.push('details');return details;},get asymmetricKeyType(){calls.push('keyType');return keyType;}};},
        get raw(){calls.push('raw');return raw;},get ca(){calls.push('ca');return false;}};
    const api=loaded('compatibility/native-observation-values.ts',{'node:crypto':{X509Certificate:class {constructor(value:Buffer){calls.push('x509');assert.deepEqual(value,raw);return leaf;}},
        createHash(name:string){calls.push('hash');return createHash(name);},createPublicKey(){assert.fail('not echo');}},'node:net':{isIP:()=>0},
        '../framework/public.ts':{invalid},'@tunex/contracts/staged/probe-echo':{}},{Buffer,Date:{parse(value:string){calls.push('parse:'+value);return value==='before'?100:200;}},URL});
    assert.equal(calls.length,0);
    for(const [type,value,strong] of [['rsa',{modulusLength:2048},true],['rsa',{modulusLength:8192},true],['rsa',{modulusLength:1024},false],['rsa',{modulusLength:8193},false],['rsa',undefined,false],
        ['ec',{namedCurve:'prime256v1'},true],['ec',{namedCurve:'secp384r1'},true],['ec',{namedCurve:'secp521r1'},true],['ec',{namedCurve:'secp256k1'},false],['ed25519',undefined,true],['dsa',undefined,false]] as const){
        keyType=type;details=value;calls.length=0;
        const output=api.readObservationLeaf!(raw.toString('base64'),8192,()=>{calls.push('expected');return ['DNS:a','URI:b'];},(facts:any,expected:unknown)=>{
            calls.push('accept');assert.equal(facts.strongKey,strong);assert.deepEqual(Array.from(facts.sans),['DNS:a','URI:b']);assert.deepEqual(expected,['DNS:a','URI:b']);
            assert.equal(facts.matchesDer,true);assert.equal(facts.ca,false);
        });
        assert.deepEqual(calls.slice(0,9),['x509','validFrom','parse:before','validTo','parse:after','usage','sans','expected','key']);
        assert.ok(calls.indexOf('accept')<calls.indexOf('raw'));assert.ok(calls.indexOf('ca')<calls.indexOf('hash'));
        assert.deepEqual(JSON.parse(JSON.stringify(output)),{fingerprint:'sha256:'+createHash('sha256').update(raw).digest('hex'),before:100,after:200});
    }
    const failure=new Error('outer policy');calls.length=0;assert.throws(()=>api.readObservationLeaf!(raw.toString('base64'),8192,()=>[],()=>{throw failure;}),error=>error===failure);assert.equal(calls.includes('hash'),false);
});

test('40 actual outer TLS trust keeps native short-circuit getters exact SAN EKU validity policy and frozen projection',()=>{
    const calls:string[]=[];let patch:Record<string,unknown>={};
    const values=loaded('modules/observation-service-owner/values.ts',{'@tunex/core':{deepFreeze:(v:unknown)=>Object.freeze(v),isCounter:()=>true,isId:()=>true},
        '../../compatibility/public.ts':{observationIdentityURN:()=>{calls.push('identity');return 'urn:identity';},
            readObservationLeaf(_encoded:string,_maximum:number,expected:()=>string[],accept:(facts:unknown,sans:string[])=>void){calls.push('leaf');const sans=expected();calls.push('expected');
                accept({get matchesDer(){calls.push('matchesDer');return patch.matchesDer??true;},get ca(){calls.push('ca');return patch.ca??false;},
                    get strongKey(){calls.push('strongKey');return patch.strongKey??true;},before:100,after:300,usage:['1.3.6.1.5.5.7.3.1'],sans:['DNS:probe.example','URI:urn:identity'],...patch},sans);
                return {fingerprint:'sha256:'+'1'.repeat(64),before:100,after:300};}},'../../framework/public.ts':{invalid},
        './contracts.ts':{OBSERVATION_SERVICE_ALPN:'tunex-observation/1',OBSERVATION_SERVICE_LIMITS:{certificateBytes:8192}}});
    const config={version:1,trust:{serverName:'probe.example',certificateDer:'original'},validFrom:100,validUntil:300};
    const accepted=values.observationTrust!(config,scope,id);assert.ok(Object.isFrozen(accepted));assert.equal(accepted.chainValidation,'not-used-exact-leaf-pin');
    for(const change of [{matchesDer:false},{ca:true},{strongKey:false},{usage:undefined},{usage:[]},{usage:['1.3.6.1.5.5.7.3.1','other']},{sans:['DNS:other','URI:urn:identity']},{before:301},{after:99}]){
        patch=change;calls.length=0;assert.throws(()=>values.observationTrust!(config,scope,id),{code:'INVALID_CONFIG'});
    }
    patch={};for(const change of [{validFrom:99},{validUntil:301}])assert.throws(()=>values.observationTrust!({...config,...change},scope,id),{code:'INVALID_CONFIG'});
});

test('40/44 real staged echo config trust stays inert detached frozen and resolver preserves exact authorized context digest',async()=>{
    const config=echoConfig(),parsed=observation.parseObservationServiceConfig(config,scope,id),trust=observation.observationTrust(parsed,scope,id);
    assert.notEqual(parsed,config);assert.ok(Object.isFrozen(parsed));assert.ok(Object.isFrozen(parsed.endpoint));assert.ok(Object.isFrozen(trust));assert.equal(trust.mode,'ed25519-echo-v1');
    const tx={marker:Symbol('tx')},events:string[]=[];
    const head={serviceId:id,revision:1,configRevision:1,archived:false,recoverySuspended:false};
    const revision={configRevision:1,config:parsed,configDigest:shared.digest(parsed),createdBy:'actor-a',createdAt:at};
    const reference={serviceId:id,revision:1,configRevision:1,configDigest:revision.configDigest};
    const resolver=new ProbeObservationServices({scope:async(actual,actor,actualScope,manage)=>{assert.equal(actual,tx);assert.equal(actor,'actor-a');assert.equal(actualScope,scope);assert.equal(manage,true);events.push('scope');}},
        {head:async actual=>{assert.equal(actual,tx);events.push('head');return head;},revision:async actual=>{assert.equal(actual,tx);events.push('revision');return revision;}},()=>{events.push('clock');return at+1;});
    const context=await resolver.resolveEcho(tx,'actor-a',scope,reference,'tcp');
    assert.deepEqual(events,['scope','head','revision','clock']);assert.equal(context.configDigest,revision.configDigest);
    const framed={scopeId:scope,...reference,config:parsed};assert.equal(context.contextDigest,shared.digest(framed));assert.ok(Object.isFrozen(context));
    await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'UNSUPPORTED_CAPABILITY',status:422});
    const malformed={...config,endpoint:{...config.endpoint,address:'169.254.169.254'}};
    assert.throws(()=>observation.parseObservationServiceConfig(malformed,scope,id),{code:'INVALID_CONFIG'});
});

test('44 actual resolver captures default clock once and retains reference auth head revision clock version parser refusal precedence',async()=>{
    const calls:string[]=[],clockFailure=new Error('clock'),authFailure=new Error('auth');let head:any,revision:any,now=150,parseHead=false,parseRevision=false,parseContext=false;
    const captured=()=>{calls.push('captured-clock');if(now===-1)throw clockFailure;return now;};
    const api=loaded('modules/probe-owner/observation-services.ts',{'../../compatibility/public.ts':{
        nativeWallClockSource(){calls.push('capture-clock');return captured;},nativeValueDigest(value:unknown){calls.push('digest');return shared.digest(value);},
        parseProbeServiceContext(value:unknown){calls.push('tls');if(parseContext)throw new Error('tls');return value;},
        parseProbeEchoServiceContext(value:unknown){calls.push('echo');if(parseContext)throw new Error('echo');return value;}},
        '../../framework/public.ts':{ControlError},'../observation-service-owner/public.ts':{
            parseProbeServiceReference(value:any){calls.push('reference');if(value.bad)throw new Error('reference');return value;},
            observationTime(value:number){calls.push('valid-time');return Number.isSafeInteger(value)&&value>=0;},
            parseObservationServiceHead(value:unknown){calls.push('parse-head');if(parseHead)throw new Error('head');return value;},
            parseObservationServiceRevision(value:unknown){calls.push('parse-revision');if(parseRevision)throw new Error('revision');return value;}}});
    assert.equal(calls.length,0);const tx={},reference={serviceId:id,revision:1,configRevision:1,configDigest:'digest'};
    const auth={scope:async()=>{calls.push('scope');}},store={head:async()=>{calls.push('head');return head;},revision:async()=>{calls.push('revision');return revision;}};
    const Resolver=api.ProbeObservationServices as unknown as new(auth:unknown,store:unknown,clock?:()=>number)=>ProbeObservationServices<object>;
    const resolver=new Resolver(auth,store);assert.deepEqual(calls,['capture-clock']);
    const reset=()=>{calls.length=0;now=150;parseHead=false;parseRevision=false;parseContext=false;
        head={serviceId:id,revision:1,configRevision:1,archived:false,recoverySuspended:false};
        revision={configRevision:1,configDigest:'digest',createdAt:100,config:{version:1,validFrom:100,validUntil:200}};};
    reset();await resolver.resolve(tx,'actor-a',scope,reference);assert.deepEqual(calls,['reference','scope','head','parse-head','revision','parse-revision','captured-clock','valid-time','digest','tls']);
    reset();await assert.rejects(resolver.resolve(tx,'actor-a',scope,{...reference,bad:true} as never),/reference/);assert.deepEqual(calls,['reference']);
    reset();head=null;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'PROBE_PERMIT_UNAVAILABLE',status:409});assert.deepEqual(calls,['reference','scope','head']);
    for(const change of [{archived:true},{recoverySuspended:true},{serviceId:'foreign'},{revision:2},{configRevision:2}]){
        reset();Object.assign(head,change);parseRevision=true;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(calls.includes('revision'),false);
    }
    reset();parseHead=true;head.archived=true;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'INTEGRITY_FAILURE',status:409});assert.equal(calls.includes('revision'),false);
    reset();revision=null;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(calls.includes('captured-clock'),false);
    reset();parseRevision=true;now=-1;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'INTEGRITY_FAILURE'});assert.equal(calls.includes('captured-clock'),false);
    for(const change of [{configRevision:2},{configDigest:'foreign'}]){reset();Object.assign(revision,change);now=-1;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(calls.includes('captured-clock'),false);}
    for(const sample of [NaN,Infinity,99]){reset();now=sample;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'CLOCK_UNCERTAIN'});assert.equal(calls.includes('digest'),false);}
    for(const sample of [200,201]){reset();now=sample;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(calls.includes('digest'),false);}
    reset();now=-1;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),error=>error===clockFailure);
    reset();parseContext=true;await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'INTEGRITY_FAILURE'});assert.equal(calls.at(-1),'tls');
    reset();revision.config.version=2;revision.config.endpoint={protocols:['udp']};await assert.rejects(resolver.resolve(tx,'actor-a',scope,reference),{code:'UNSUPPORTED_CAPABILITY'});assert.equal(calls.includes('tls'),false);
    await assert.rejects(resolver.resolveEcho(tx,'actor-a',scope,reference,'tcp'),{code:'UNSUPPORTED_CAPABILITY'});assert.equal(calls.includes('echo'),false);
    calls.length=0;const explicit=new Resolver({scope:async()=>{throw authFailure;}},store,()=>{calls.push('explicit');return 150;});assert.equal(calls.length,0);
    await assert.rejects(explicit.resolve(tx,'actor-a',scope,reference),error=>error===authFailure);assert.deepEqual(calls,['reference']);
});

test('41/42 native JSON UTF8 base64 cursor fingerprint hex clone and time helpers keep exact native coercion and evaluation order',()=>{
    const events:string[]=[],input={get b(){events.push('b');return '汉🙂';},get a(){events.push('a');return 1;}};
    const encoded='{"b":"汉🙂","a":1}';assert.equal(native.nativeJsonEncode(input),encoded);assert.deepEqual(events,['b','a']);
    assert.equal(native.jsonUtf8Bytes(input),Buffer.byteLength(encoded,'utf8'));assert.equal(native.jsonUtf8DefaultBytes(input),Buffer.byteLength(encoded));
    assert.equal(native.nativeJsonEncoderBytes(input),new TextEncoder().encode(encoded).byteLength);
    for(const explicit of [false,true]){const cursor=native.nativeJsonBase64Url(input,explicit);assert.equal(cursor,Buffer.from(encoded,'utf8').toString('base64url'));assert.equal(native.nativeBase64UrlText(cursor),encoded);}
    const clone=native.nativeJsonClone({b:['x'],a:undefined});assert.deepEqual(clone,{b:['x']});
    for(const value of ['00ff','abc','xx','01zz'])assert.deepEqual(native.nativeHexBytes(value),Buffer.from(value,'hex'));
    assert.equal(native.nativeBase64Fingerprint('AQ=='),'sha256:'+createHash('sha256').update(Buffer.from([1])).digest('hex'));
    assert.equal(native.nativeBytesFingerprint(Uint8Array.from([1,2])),'sha256:'+createHash('sha256').update(Buffer.from([1,2])).digest('hex'));
    assert.equal(native.nativeParseTime('2026-10-17T08:00:00+08:00'),at);assert.ok(Number.isNaN(native.nativeParseTime('invalid')));
    assert.equal(native.nativeIsoTime(at+0.9),new Date(at+0.9).toISOString());for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>native.nativeIsoTime(value),RangeError);
    const error=new Error('JSON getter');assert.throws(()=>native.nativeJsonEncode({get field(){throw error;}}),failure=>failure===error);
});
