import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { RuntimeMessages, RuntimeSnapshot } from '@tunex/contracts/runtime';
import { RuntimeHost, ControlError } from '../src/framework/public.ts';
import type { RuntimeCodec, RuntimeHostOptions, RuntimeNodeState } from '../src/framework/public.ts';
import { runtimeCodec, nativeParseTime, nativeIsoTime, nativeWallClockNow } from '../src/compatibility/public.ts';
import type { NativeRuntimeFamily } from '../src/compatibility/public.ts';
import { RuntimeController } from '../src/modules/runtime/controller.ts';

type Tx = Readonly<{ identity:symbol }>;
function fixture() {
    const tx:Tx=Object.freeze({identity:Symbol('original transaction')}),events:string[]=[];
    const state:RuntimeNodeState={node_id:'node',session_epoch:2,boot_id:'boot',snapshot_generation:4,
        last_report_sequence:0,last_report:null,received_at:null};
    const facts={nodeId:'node',scopeId:'scope',capabilities:['adp.3','tcp','native.direct.v1'],allowedListenerAddresses:['127.0.0.1'],
        allowedPorts:[8080],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
    const assignment:RuntimeSnapshot['assignments'][number]={assignmentId:'assignment',forwardId:'forward',forwardRevision:1,
        deploymentGeneration:2,bindingFence:3,role:'direct',protocol:'tcp',phase:'active',
        resource:{address:'127.0.0.1',port:8080,protocol:'tcp'},drainTimeoutSeconds:DEFAULT_POLICY.drainTimeoutSeconds,
        driver:{id:'native.direct.v1',schemaVersion:1,configDigest:'sha256:'+'a'.repeat(64),config:{target:{host:'127.0.0.1',port:80},
            egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false}}};
    const data={now:10000,credentialUntil:600000,revoked:false,awaiting:0,relayUntil:500000,
        boot:{session_epoch:2} as {session_epoch:number}|undefined,previous:undefined as RuntimeSnapshot|undefined,
        prior:undefined as string|undefined,saved:undefined as RuntimeSnapshot|undefined,assignments:[] as RuntimeSnapshot['assignments'],
        digest:'request-digest'};
    const trace=(current:Tx,name:string)=>{assert.equal(current,tx);events.push(name);};
    let codec:RuntimeCodec<NativeRuntimeFamily>;
    codec={...runtimeCodec,
        validatePolicy(policy,at){assert.equal(this,codec);events.push(`validate:${at}`);return policy;},
        digest(value){assert.equal(this,codec);events.push('digest');return value&&typeof value==='object'&&'reportSequence' in value?data.digest:JSON.stringify(value);},
        parseTime(value){assert.equal(this,codec);events.push(`parse:${value}`);return Number(value);},
        formatTime(value){assert.equal(this,codec);events.push(`format:${value}`);return String(value);},
        checkHelloProtocol(input){assert.equal(this,codec);events.push('protocol');runtimeCodec.checkHelloProtocol(input);},
        checkHelloCapabilities(input){assert.equal(this,codec);events.push('capabilities');runtimeCodec.checkHelloCapabilities(input);},
        helloResponse(...args){assert.equal(this,codec);events.push('hello-response');return runtimeCodec.helloResponse(...args);},
        reportAck(...args){assert.equal(this,codec);events.push(`ack:${args[4]}`);return runtimeCodec.reportAck(...args);},
        compileSnapshot(input){assert.equal(this,codec);events.push('compile');return {protocolVersion:3,nodeId:input.nodeId,
            sessionEpoch:input.sessionEpoch,snapshotGeneration:input.snapshotGeneration,issuedAt:input.issuedAt,validUntil:input.validUntil,
            complete:true,snapshotDigest:'compiled',assignments:[...input.assignments],tombstones:input.tombstones};},
    };
    const ports:RuntimeHostOptions<Tx,NativeRuntimeFamily>={codec,now:()=>{events.push(`now:${data.now}`);return data.now;},
        db:{async transaction(action){events.push('begin');try{const result=await action(tx);events.push('commit');return result;}catch(error){events.push('rollback');throw error;}}},
        nodes:{async credential(current){trace(current,'credential');return data.credentialUntil;},async facts(current){trace(current,'facts');return {facts};},
            async state(current){trace(current,'state');return {facts,revoked:data.revoked,credentialUntil:data.credentialUntil};},
            async capabilities(current){trace(current,'save-capabilities');}},
        store:{async lockNode(current){trace(current,'lock');return state;},async boot(current){trace(current,'boot');return data.boot;},
            async beginBoot(current){trace(current,'begin-boot');},async snapshot(current){trace(current,'snapshot');return data.previous;},
            async awaitingClaim(current){trace(current,'awaiting');return data.awaiting;},async operation(){assert.fail('unexpected worker claim');},
            async saveSnapshot(current,value){trace(current,'save-snapshot');data.saved=value;},async cleanupNodeIDs(){return [];},
            async reportDigest(current){trace(current,'prior');return data.prior;},async saveReport(current){trace(current,'save-report');},
            async failExecution(current){trace(current,'fail-execution');}},
        ledger:{async assignments(current){trace(current,'assignments');return data.assignments;},async retireChanged(current){trace(current,'retire');},
            async tombstones(current){trace(current,'tombstones');return [];},async verifyPublishable(current){trace(current,'verify');},
            async recordLeases(current,value){trace(current,'leases');assert.equal(value,data.saved);},async complete(current){trace(current,'complete');},
            async claim(){return undefined;},async get(){assert.fail('unexpected worker lookup');},async observeDrains(current){trace(current,'drains');}},
        forwards:{async record(){assert.fail('unexpected Forward lookup');}},
        observations:{async status(){return {applied:[],health:{condition:'unknown',receivedAt:null,freshUntil:null}};}},
        authority:{async issue(until,lease,skew){events.push(`authority:${until}/${lease}/${skew}`);}},
        relay:{async relatedNodeIDs(current,nodeId){trace(current,'related');return [nodeId];},async advanceForNode(current){trace(current,'advance');},
            async authorizationBound(current){trace(current,'relay-bound');return data.relayUntil;},async pendingNodeIDs(){return [];},
            async executionError(current){trace(current,'execution-error');}},
    };
    const hello=():RuntimeMessages['HelloRequest']=>({protocolVersion:3,nodeId:'node',bootId:'boot',agentBuild:'test',
        capabilities:[...facts.capabilities],lastStoredSnapshotGeneration:4});
    const report=():RuntimeMessages['ReportRequest']=>({protocolVersion:3,nodeId:'node',bootId:'boot',sessionEpoch:2,reportSequence:1,
        observedAt:'10000',acceptedSnapshotGeneration:0,observations:[],drains:[]});
    const previous=():RuntimeSnapshot=>({protocolVersion:3,nodeId:'node',sessionEpoch:2,snapshotGeneration:4,complete:true,
        issuedAt:'0',validUntil:'200000',snapshotDigest:'previous',assignments:[...data.assignments],tombstones:[]});
    const host=()=>new RuntimeHost(ports);
    const ready=()=>{const value=host();events.length=0;return value;};
    return {tx,events,state,facts,assignment,data,codec,ports,hello,report,previous,host,ready};
}

function exactControlError(code:string,message:string) {
    return (error:unknown)=>{assert.ok(error instanceof ControlError);assert.equal(error.constructor,ControlError);
        assert.equal(error.code,code);assert.equal(error.status,code==='AUTHORIZATION_DENIED'?403:409);
        assert.equal(error.message,message);assert.equal(error.retryable,false);return true;};
}

test('119/128 constructor rejects every missing or wrong-kind clock time and machine method in original getter order before Now policy or effects',()=>{
    const keys=['parseTime','formatTime','checkHelloProtocol','checkHelloCapabilities','helloResponse','reportAck'] as const;
    for(const name of ['now',...keys])for(const invalid of [undefined,null,false,0,1,'function',{},[]]){
        const f=fixture(),gets:string[]=[],target={...f.codec};
        if(name==='now')Object.assign(f.ports,{now:invalid});else Object.assign(target,{[name]:invalid});
        Object.assign(f.ports,{codec:new Proxy(target,{get(value,key,receiver){gets.push(String(key));return Reflect.get(value,key,receiver);}})});
        const message=['now','parseTime','formatTime'].includes(name)?'Runtime clock and time codec are required':'Runtime machine codec is required';
        assert.throws(()=>f.host(),error=>error instanceof Error&&error.constructor===Error&&error.message===message);
        assert.deepEqual(gets,name==='now'?[]:keys.slice(0,keys.indexOf(name as typeof keys[number])+1));
        assert.deepEqual(f.events,[],'refusal precedes constructor Now, validation and provider calls');
    }
    for(const invalid of [undefined,null]){
        const f=fixture();Object.assign(f.ports,{codec:invalid});
        assert.throws(()=>f.host(),{constructor:Error,message:'Runtime clock and time codec are required'});assert.deepEqual(f.events,[]);
    }
    for(const key of keys){
        const f=fixture(),failure=new Error(`getter:${key}`),gets:string[]=[];
        Object.assign(f.ports,{codec:new Proxy(f.codec,{get(value,name,receiver){gets.push(String(name));if(name===key)throw failure;return Reflect.get(value,name,receiver);}})});
        assert.throws(()=>f.host(),error=>error===failure);assert.deepEqual(gets,keys.slice(0,keys.indexOf(key)+1));assert.deepEqual(f.events,[]);
    }
    const f=fixture(),failure=new Error('now getter');
    Object.defineProperty(f.ports,'now',{enumerable:true,get(){assert.equal(this,f.ports);throw failure;}});
    assert.throws(()=>f.host(),error=>error===failure);assert.deepEqual(f.events,[]);
});

test('128 native protocol and capability includes getters short circuit with exact original ControlError class code status and text',()=>{
    const rows:[unknown,string[],string[],string?][]=[
        [2,[],['protocol'],'UNSUPPORTED_PROTOCOL_VERSION'],[4,['adp.3'],['protocol'],'UNSUPPORTED_PROTOCOL_VERSION'],
        ...[undefined,null,'3',3.1,Infinity,NaN].map(version=>[version,[],['protocol'],'UNSUPPORTED_PROTOCOL_VERSION'] as [unknown,string[],string[],string]),
        [3,[],['protocol','capabilities','includes:adp.3'],'UNSUPPORTED_PROTOCOL_VERSION'],
        [3,['adp.3','tcp','native.direct.v1'],['protocol','capabilities','includes:adp.3','capabilities','includes:tcp','capabilities','includes:native.direct.v1']],
        [3,['adp.3','udp','native.direct.v1'],['protocol','capabilities','includes:adp.3','capabilities','includes:tcp','capabilities','includes:udp','capabilities','includes:native.direct.v1']],
        [3,['adp.3','native.direct.v1'],['protocol','capabilities','includes:adp.3','capabilities','includes:tcp','capabilities','includes:udp'],'UNSUPPORTED_CAPABILITY'],
        [3,['adp.3','tcp'],['protocol','capabilities','includes:adp.3','capabilities','includes:tcp','capabilities','includes:native.direct.v1'],'UNSUPPORTED_CAPABILITY'],
    ];
    for(const [version,present,expected,code] of rows){
        const events:string[]=[],bag={includes(value:string){assert.equal(this,bag);events.push(`includes:${value}`);return present.includes(value);}};
        const input={get protocolVersion(){events.push('protocol');return version;},get capabilities(){events.push('capabilities');return bag;}} as unknown as RuntimeMessages['HelloRequest'];
        const action=()=>{runtimeCodec.checkHelloProtocol(input);runtimeCodec.checkHelloCapabilities(input);};
        if(code)assert.throws(action,exactControlError(code,code==='UNSUPPORTED_PROTOCOL_VERSION'?'ADP/3 capability required':'Direct protocol capability required'));else action();
        assert.deepEqual(events,expected);
    }
    for(const method of ['checkHelloProtocol','checkHelloCapabilities'] as const)for(const stage of ['getter','includes-getter','includes'] as const){
        const failure=new Error(`${method}:${stage}`),input={protocolVersion:3,get capabilities(){if(stage==='getter')throw failure;
            return {get includes(){if(stage==='includes-getter')throw failure;return ()=>{throw failure;};}};}};
        assert.throws(()=>runtimeCodec[method](input as never),error=>error===failure);
    }
});

test('128 Host Hello keeps native protocol then foreign Node then capability refusal before transactions',async()=>{
    for(const mode of ['protocol','foreign','capability'] as const){
        const f=fixture(),host=f.ready(),input=f.hello();
        if(mode==='protocol')Object.assign(input,{protocolVersion:2});
        if(mode==='capability')input.capabilities=['adp.3'];
        await assert.rejects(host.hello(mode==='capability'?'node':'foreign',input),exactControlError(
            mode==='protocol'?'UNSUPPORTED_PROTOCOL_VERSION':mode==='foreign'?'AUTHORIZATION_DENIED':'UNSUPPORTED_CAPABILITY',
            mode==='protocol'?'ADP/3 capability required':mode==='foreign'?'Foreign Node identity':'Direct protocol capability required'));
        assert.deepEqual(f.events,mode==='capability'?['protocol','capabilities']:['protocol']);
    }
});

test('128 native Hello and ACK are fresh ordered mutable projections with no validation parsing cloning freezing or time sampling',t=>{
    t.mock.method(Date,'now',()=>assert.fail('machine projection must not sample time'));
    t.mock.method(Date,'parse',()=>assert.fail('machine projection must not parse time'));
    const policy=new Proxy({...DEFAULT_POLICY},{get(){assert.fail('machine projection must not read or clone policy');}});
    const hello=runtimeCodec.helloResponse('node','boot',NaN,'not-a-time',policy),again=runtimeCodec.helloResponse('node','boot',NaN,'not-a-time',policy);
    assert.deepEqual(Object.keys(hello),['protocolVersion','nodeId','bootId','sessionEpoch','serverTime','policy']);
    assert.equal(hello.protocolVersion,3);assert.ok(Number.isNaN(hello.sessionEpoch));assert.equal(hello.serverTime,'not-a-time');assert.equal(hello.policy,policy);
    assert.notEqual(hello,again);assert.equal(Object.isFrozen(hello),false);hello.bootId='changed';assert.equal(again.bootId,'boot');
    for(const status of ['accepted','duplicate'] as const){
        const ack=runtimeCodec.reportAck('node','boot',Infinity,-0,status),second=runtimeCodec.reportAck('node','boot',Infinity,-0,status);
        assert.deepEqual(Object.keys(ack),['protocolVersion','nodeId','bootId','sessionEpoch','reportSequence','status']);
        assert.deepEqual(ack,{protocolVersion:3,nodeId:'node',bootId:'boot',sessionEpoch:Infinity,reportSequence:-0,status});
        assert.equal(Object.is(ack.reportSequence,-0),true);assert.notEqual(ack,second);assert.equal(Object.isFrozen(ack),false);
        ack.bootId='changed';assert.equal(second.bootId,'boot');
    }
});

test('119/128 Host Hello preserves boot getters operation order one format and Now codec receivers and detached policy',async()=>{
    for(const fresh of [false,true]){
        const f=fixture();if(fresh)f.data.boot=undefined;const host=f.ready(),input=f.hello();
        Object.defineProperty(input,'bootId',{get(){f.events.push('get-boot');return 'boot';}});
        const heldPolicy=(host as unknown as {policy:Record<string,number>}).policy,lease=heldPolicy.leaseSeconds;
        Object.defineProperty(heldPolicy,'leaseSeconds',{enumerable:true,configurable:true,get(){f.events.push('copy-policy');return lease;}});
        let projected:RuntimeMessages['HelloResponse']|undefined;
        f.codec.helloResponse=function(...args){assert.equal(this,f.codec);f.events.push('hello-response');projected=runtimeCodec.helloResponse(...args);return projected;};
        const response=await host.hello('node',input,'fingerprint');
        const expected=['protocol','capabilities','begin','related','lock','credential','facts','get-boot','boot'];
        if(fresh)expected.push('get-boot','begin-boot','save-capabilities');else expected.push('get-boot','digest','digest');
        expected.push('get-boot','now:10000','format:10000','copy-policy','hello-response','commit');
        assert.deepEqual(f.events,expected);assert.equal(response,projected);assert.equal(response.sessionEpoch,fresh?3:2);
        assert.notEqual(response.policy,f.codec.defaultPolicy);assert.notEqual(response.policy,(host as unknown as {policy:unknown}).policy);
        response.policy.leaseSeconds=1;f.events.length=0;
        assert.equal((await host.hello('node',f.hello())).policy.leaseSeconds,DEFAULT_POLICY.leaseSeconds);
        assert.equal(f.events.filter(event=>event.startsWith('now:')).length,1);assert.equal(f.events.filter(event=>event.startsWith('format:')).length,1);
    }
});

test('119/128 custom machine time and digest methods retain receiver and original error identity at their original effect boundary',async()=>{
    for(const method of ['checkHelloProtocol','checkHelloCapabilities','helloResponse','formatTime','parseTime','reportAck','digest'] as const){
        const f=fixture(),failure=new Error(`codec:${method}`),host=f.ready();
        Object.assign(f.codec,{[method]:function(this:unknown){assert.equal(this,f.codec);f.events.push(`throw:${method}`);throw failure;}});
        const action=method==='parseTime'?(f.data.previous=f.previous(),()=>host.snapshot('node',2)):
            ['reportAck','digest'].includes(method)?()=>host.report('node',2,f.report()):()=>host.hello('node',f.hello());
        await assert.rejects(action(),error=>error===failure);
        assert.equal(f.events.includes('begin'),!['checkHelloProtocol','checkHelloCapabilities'].includes(method));
        assert.equal(f.events.at(-1),['checkHelloProtocol','checkHelloCapabilities'].includes(method)?`throw:${method}`:'rollback');
        assert.equal(f.events.includes('save-snapshot')||f.events.includes('save-report')||f.events.includes('leases'),false);
    }
});

test('128 ACK projection retains digest prior boot sequence status and key order and allocates before duplicate integrity refusal',async()=>{
    for(const mode of ['accepted','duplicate','changed','empty-prior'] as const){
        const f=fixture(),host=f.ready(),input=f.report();if(mode!=='accepted')f.data.prior=mode==='duplicate'?f.data.digest:mode==='empty-prior'?'':'changed';
        for(const [key,value] of Object.entries({nodeId:'node',sessionEpoch:2,bootId:'boot',reportSequence:1}))
            Object.defineProperty(input,key,{get(){f.events.push(`get:${key}`);return value;}});
        let ack:RuntimeMessages['ReportAck']|undefined;
        f.codec.reportAck=function(...args){assert.equal(this,f.codec);f.events.push(`project:${args[4]}`);ack=runtimeCodec.reportAck(...args);return ack;};
        const pending=host.report('node',2,input),duplicate=mode!=='accepted';
        if(mode==='changed'||mode==='empty-prior')await assert.rejects(pending,exactControlError('INTEGRITY_FAILURE','Report sequence body changed'));
        else assert.equal(await pending,ack);
        assert.ok(ack);assert.equal(ack.status,duplicate?'duplicate':'accepted');
        assert.deepEqual(Object.keys(ack),['protocolVersion','nodeId','bootId','sessionEpoch','reportSequence','status']);
        const prefix=['get:nodeId','get:sessionEpoch','begin','related','lock','facts','get:bootId','digest','get:reportSequence','prior',
            'get:bootId','get:reportSequence',`project:${duplicate?'duplicate':'accepted'}`];
        if(duplicate)assert.deepEqual(f.events,[...prefix,mode==='duplicate'?'commit':'rollback']);
        else{assert.deepEqual(f.events.slice(0,prefix.length),prefix);assert.ok(f.events.indexOf('drains')>f.events.indexOf('project:accepted'));}
        if(duplicate)assert.equal(f.events.some(event=>event==='drains'||event==='save-report'||event.startsWith('now:')),false);
    }
});

test('119 native parse and ISO codecs preserve zero fractions offsets invalid NaN Infinity and Date coercion rather than introducing validation',()=>{
    assert.equal(runtimeCodec.parseTime,nativeParseTime);assert.equal(runtimeCodec.formatTime,nativeIsoTime);
    const parses:[string,number][]=[['1970-01-01T00:00:00.000Z',0],['1970-01-01T02:30:00.250+02:30',250],
        ['1969-12-31T19:00:00.125-05:00',125],['1969-12-31T23:59:59.999Z',-1],['1970-01-01T00:00:00.123456Z',123],
        ['not-a-time',NaN],['',NaN],['NaN',NaN],['Infinity',NaN],['-Infinity',NaN]];
    for(const [text,expected] of parses)assert.ok(Object.is(runtimeCodec.parseTime(text),expected),text);
    const formats:[number,string][]=[[0,'1970-01-01T00:00:00.000Z'],[-0,'1970-01-01T00:00:00.000Z'],
        [.9,'1970-01-01T00:00:00.000Z'],[-.9,'1970-01-01T00:00:00.000Z'],[1.9,'1970-01-01T00:00:00.001Z'],
        [-1.9,'1969-12-31T23:59:59.999Z'],[8640000000000000,'+275760-09-13T00:00:00.000Z'],[-8640000000000000,'-271821-04-20T00:00:00.000Z']];
    for(const [at,expected] of formats)assert.equal(runtimeCodec.formatTime(at),expected);
    for(const invalid of [NaN,Infinity,-Infinity,8640000000000001,-8640000000000001])
        assert.throws(()=>runtimeCodec.formatTime(invalid),error=>error instanceof RangeError&&error.constructor===RangeError&&error.message==='Invalid time value');
    const hints:string[]=[],value={ [Symbol.toPrimitive](hint:string){assert.equal(this,value);hints.push(hint);return hint==='string'?'1970-01-01T00:00:00.000Z':0;} };
    assert.equal(runtimeCodec.parseTime(value as never),0);assert.equal(runtimeCodec.formatTime(value as never),'1970-01-01T00:00:00.000Z');
    assert.deepEqual(hints,['string','default']);
    const failure=new Error('coercion');const bad={[Symbol.toPrimitive](){throw failure;}};
    assert.throws(()=>runtimeCodec.parseTime(bad as never),error=>error===failure);assert.throws(()=>runtimeCodec.formatTime(bad as never),error=>error===failure);
});

test('119 explicit Host clock is captured once while legacy RuntimeController looks up replacement Date.now dynamically',t=>{
    const original=Date.now;t.after(()=>{Date.now=original;});let calls=0;Date.now=()=>{calls++;return 0;};
    const controller=new RuntimeController({} as never,{} as never,{} as never,{} as never);
    const legacy=controller as unknown as {now:()=>number};assert.equal(legacy.now,nativeWallClockNow);assert.equal(calls,1);
    Date.now=()=>123.75;assert.equal(legacy.now(),123.75);Date.now=()=>Infinity;assert.equal(legacy.now(),Infinity);
    const f=fixture(),host=f.host() as unknown as {now:()=>number};Object.assign(f.ports,{now:()=>assert.fail('captured clock must not be replaced')});
    for(const now of [0,-0,.25,-.25,NaN,Infinity,-Infinity]){f.data.now=now;assert.ok(Object.is(host.now(),now));}
    assert.equal(f.events.filter(event=>event.startsWith('validate:')).length,1,'explicit custom policy validation occurs at construction only');
});

test('119 explicit custom clocks retain zero fractional and nonfinite samples at the actual Hello projection without extra validation',async()=>{
    for(const now of [0,-0,.25,-.25,NaN,Infinity,-Infinity]){
        const f=fixture();f.data.now=now;const host=f.host();
        assert.deepEqual(f.events,[`now:${now}`,`validate:${now}`]);f.events.length=0;
        const response=await host.hello('node',f.hello());assert.equal(response.serverTime,String(now));
        assert.deepEqual(f.events.filter(event=>event.startsWith('now:')||event.startsWith('format:')),[`now:${now}`,`format:${now}`]);
    }
});

test('119 native policy time conversion retains one constructor sample and original RangeError for nonfinite values',()=>{
    for(const now of [0,-0,.25,-.25,1.9,NaN,Infinity,-Infinity]){
        const f=fixture();f.data.now=now;f.codec.validatePolicy=function(policy,at){assert.equal(this,f.codec);f.events.push(`native-policy:${at}`);return runtimeCodec.validatePolicy(policy,at);};
        if(Number.isFinite(now))f.host();else assert.throws(()=>f.host(),error=>error instanceof RangeError&&error.constructor===RangeError&&error.message==='Invalid time value');
        assert.deepEqual(f.events,[`now:${now}`,`native-policy:${now}`]);
    }
});

test('119 publication samples after original awaited state and snapshot reads and retains the publication sample through later awaits',async()=>{
    const f=fixture(),host=f.ready(),state=f.ports.nodes.state,snapshot=f.ports.store.snapshot,awaiting=f.ports.store.awaitingClaim;
    f.ports.nodes.state=async function(...args){const value=await state.apply(this,args);f.data.now=11000;return value;};
    f.ports.store.snapshot=async function(...args){const value=await snapshot.apply(this,args);f.data.now=12000;return value;};
    f.ports.store.awaitingClaim=async function(...args){const value=await awaiting.apply(this,args);f.data.now=13000;return value;};
    const result=await host.snapshot('node',2);
    assert.deepEqual(f.events.filter(event=>event.startsWith('now:')),['now:11000','now:12000']);
    assert.equal(result.issuedAt,'12000');assert.equal(result.validUntil,String(12000+DEFAULT_POLICY.leaseSeconds*1000));
    assert.deepEqual(f.events.filter(event=>event.startsWith('format:')),['format:12000',`format:${12000+DEFAULT_POLICY.leaseSeconds*1000}`]);
});

test('119 Host publication retains every hold reuse deadline time sample and authority parse ordering including revoked short circuit',async()=>{
    for(const mode of ['new','hold','hold-boundary','reuse','renewal-boundary','credential-cap','relay-cap','withdrawn','expired-credential','new-session','changed-assignments'] as const){
        const f=fixture();f.data.previous=mode==='new'?undefined:f.previous();
        if(mode==='hold'||mode==='hold-boundary'){f.data.awaiting=1;f.data.previous!.validUntil=String(f.data.now+(mode==='hold'?5001:5000));}
        if(mode==='renewal-boundary')f.data.previous!.validUntil=String(f.data.now+DEFAULT_POLICY.renewalLeadSeconds*1000);
        if(mode==='credential-cap')f.data.credentialUntil=150000;
        if(mode==='relay-cap')f.data.relayUntil=150000;
        if(mode==='withdrawn'){f.data.revoked=true;f.data.previous!.assignments=[f.assignment];}
        if(mode==='expired-credential')f.data.credentialUntil=f.data.now;
        if(mode==='new-session')f.data.previous!.sessionEpoch=1;
        if(mode==='changed-assignments')f.data.assignments=[f.assignment];
        const host=f.ready(),snapshot=await host.snapshot('node',2),held=mode==='hold',reused=mode==='reuse';
        const events=f.events,clock=events.filter(event=>event.startsWith('now:')),parses=events.filter(event=>event.startsWith('parse:'));
        assert.equal(clock.length,mode==='withdrawn'?1:2,mode);
        assert.deepEqual(events.slice(0,mode==='withdrawn'?7:8),mode==='withdrawn'?
            ['begin','related','lock','state','snapshot','now:10000','awaiting']:
            ['begin','related','lock','state','now:10000','snapshot','now:10000','awaiting']);
        if(mode==='withdrawn'||mode==='expired-credential')assert.equal(events.includes('assignments'),false);
        else assert.ok(events.indexOf('advance')<events.indexOf('assignments'));
        assert.equal(events.includes('relay-bound'),!held);
        if(held||reused){assert.equal(snapshot,f.data.previous);assert.equal(events.some(event=>event==='compile'||event==='save-snapshot'||event.startsWith('format:')||event.startsWith('authority:')),false);
            assert.deepEqual(parses,[`parse:${f.data.previous!.validUntil}`]);}
        else{
            const withdrawn=mode==='withdrawn'||mode==='expired-credential';
            const expected=withdrawn?f.data.now+DEFAULT_POLICY.leaseSeconds*1000:Math.min(f.data.now+DEFAULT_POLICY.leaseSeconds*1000,f.data.credentialUntil,f.data.relayUntil);
            assert.equal(snapshot.validUntil,String(expected),mode);assert.equal(snapshot.snapshotGeneration,5);
            assert.deepEqual(events.filter(event=>event.startsWith('format:')),[`format:${f.data.now}`,`format:${expected}`]);
            assert.deepEqual(parses,[...(f.data.previous?[`parse:${f.data.previous.validUntil}`]:[]),`parse:${expected}`]);
            const ordered=['retire','tombstones',`format:${f.data.now}`,`format:${expected}`,'compile','verify',`parse:${expected}`,
                `authority:${expected}/${DEFAULT_POLICY.leaseSeconds}/${DEFAULT_POLICY.maxClockSkewSeconds}`,'save-snapshot','leases','complete','commit'];
            assert.deepEqual(events.slice(events.indexOf('retire')),ordered);
        }
        const digests=events.filter(event=>event==='digest').length;
        assert.equal(digests,f.data.previous&&!held&&mode!=='new-session'?2:0,'session equality short circuits assignment digests');
    }
});

test('119 Host report freshness preserves snapshot/current short circuits exact skew boundary nonfinite parse and one post-drain sample',async()=>{
    for(const mode of ['none','older','boundary','fresh','nan','positive-infinity','negative-infinity','zero'] as const){
        const f=fixture(),input=f.report();
        if(mode!=='none'){input.acceptedSnapshotGeneration=4;f.data.assignments=[f.assignment];f.data.previous=f.previous();
            input.observations=[{assignmentId:'assignment',deploymentGeneration:2,bindingFence:3,phase:'active',condition:'error',errorCode:'TARGET_UNAVAILABLE',retryable:true}];}
        if(mode==='older')f.state.snapshot_generation=5;
        const until=mode==='fresh'?f.data.now+DEFAULT_POLICY.maxClockSkewSeconds*1000+1:
            mode==='positive-infinity'?Infinity:mode==='negative-infinity'?-Infinity:mode==='nan'?NaN:mode==='zero'?0:f.data.now+DEFAULT_POLICY.maxClockSkewSeconds*1000;
        if(f.data.previous)f.data.previous.validUntil=String(until);
        const host=f.ready();await host.report('node',2,input);
        assert.equal(f.events.filter(event=>event.startsWith('now:')).length,1);assert.ok(f.events.indexOf('drains')<f.events.indexOf('now:10000'));
        assert.ok(f.events.indexOf('now:10000')<f.events.indexOf('save-report'));
        assert.deepEqual(f.events.filter(event=>event.startsWith('parse:')),['none','older'].includes(mode)?[]:[`parse:${until}`]);
        assert.equal(f.events.includes('fail-execution'),mode==='fresh'||mode==='positive-infinity');
        assert.equal(f.events.includes('complete'),!['none','older'].includes(mode));
        assert.equal(f.events.at(-1),'commit');
    }
});

test('119 worker claim guards retain original Now short circuits before publication and after compilation',async()=>{
    for(const stage of ['before','after'] as const)for(const mode of stage==='before'?
        ['status','token','null-until','zero-until','equal-until','revision','valid']:['missing','status','token','clock','deadline','valid']){
        const f=fixture(),work={id:'operation',scope_id:'scope',forward_id:'forward',target_revision:1,status:'running',
            claim_token:'token' as string|null,claim_until:20000 as number|null,execution_deadline:40000},claim={...work};
        f.ports.ledger.claim=async current=>{assert.equal(current,f.tx);f.events.push('claim');return claim;};
        f.ports.ledger.get=async current=>{assert.equal(current,f.tx);f.events.push('get-operation');return work;};
        f.ports.forwards.record=async current=>{assert.equal(current,f.tx);f.events.push('forward');return {id:'forward',scopeId:'scope',revision:1,
            deleting:false,recoverySuspended:false,spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'node',listen:{address:'127.0.0.1',port:8080}},target:{host:'127.0.0.1',port:80}}};};
        f.ports.store.operation=async current=>{assert.equal(current,f.tx);f.events.push('operation');return mode==='missing'?undefined:work;};
        const mutate=()=>{if(mode==='status')work.status='failed';if(mode==='token')work.claim_token='replacement';
            if(mode==='null-until')work.claim_until=null;if(mode==='zero-until')work.claim_until=0;
            if(mode==='equal-until')work.claim_until=f.data.now;if(mode==='revision')work.target_revision++;
            if(mode==='clock')f.data.now=claim.claim_until!;if(mode==='deadline')work.execution_deadline=f.data.now;};
        if(stage==='before')mutate();else{const compile=f.codec.compileSnapshot;f.codec.compileSnapshot=function(input){const result=compile.call(this,input);mutate();return result;};}
        const host=f.ready(),pending=host.tick();
        if(stage==='after'&&mode!=='valid')await assert.rejects(pending,exactControlError('STALE_CLAIM','Worker claim expired before publication'));else await pending;
        const samples=f.events.filter(event=>event.startsWith('now:')).length;
        assert.equal(samples,stage==='before'?(mode==='valid'?5:['equal-until','revision'].includes(mode)?1:0):
            ['missing','status','token'].includes(mode)?3:mode==='clock'?4:5,`${stage}:${mode}`);
        assert.equal(f.events.includes('save-snapshot'),mode==='valid');assert.equal(f.events.includes('leases'),mode==='valid');
        if(mode!=='valid')assert.equal(f.events.some(event=>event.startsWith('authority:')),false);
        assert.ok(f.events.indexOf('lock')<f.events.indexOf('get-operation'));
    }
});
