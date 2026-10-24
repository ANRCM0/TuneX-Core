import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { nativeValueDigest, probeEchoServiceSelection, probeEchoResultDigest } from '../src/compatibility/public.ts';
import { ProbePermits, ForwardProbes, ProbeEcho, ProbeEchoRegistry, parseProbeQualification } from '../src/modules/probe-owner/public.ts';

function fixture() {
    const now=Date.parse('2026-10-24T00:00:00.000Z'),tx={},fingerprint='f'.repeat(64),instanceId='1'.repeat(64);
    const publicKey=generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64');
    const config={version:2,purpose:'controlled-nonce-echo',endpoint:{address:'127.0.0.1',port:18080,protocols:['tcp','udp']},
        trust:{mode:'ed25519-echo-v1',publicKey},validFrom:now-1000,validUntil:now+60000};
    const rawContext={scopeId:'scope',serviceId:'service',revision:1,configRevision:1,configDigest:nativeValueDigest(config),config};
    const context={...rawContext,contextDigest:nativeValueDigest(rawContext)} as any;
    const reference={serviceId:'service',revision:1,configRevision:1,configDigest:context.configDigest};
    const binding={nodeId:'node',bootId:'boot',sessionEpoch:1,snapshotGeneration:2,assignmentId:'assignment',forwardId:'forward',
        forwardRevision:1,deploymentGeneration:1,bindingFence:1,configDigest:'sha256:'+'c'.repeat(64),egressPolicyRevision:1};
    const slot={nodeId:'node',bootId:'boot',sessionEpoch:1,generation:1,fingerprint,instanceId,state:'registered',registeredAt:now,expiresAt:now+30000,revokedAt:null};
    const machine={nodeId:'node',bootId:'boot',sessionEpoch:1,revoked:false,credentialRevoked:false,nodeCredentialUntil:now+60000,
        credentialUntil:now+60000,retireAfter:null,capabilities:['adp.3','native.direct.v1','tcp','udp',
            'probe.tcp-connect.v1','probe.tcp-ingress-connect.v1','probe.tcp-ingress-tls.v1','probe.tcp-ingress-echo.v1','probe.udp-ingress-echo.v1']};
    let records:any[]=[],qualification:any={nodeId:'node',bootId:'boot',sessionEpoch:1,fingerprint,instanceId,instanceGeneration:1,
        state:'qualified',qualifiedAt:now,expiresAt:now+30000,servicesVersion:1,echoVersion:1},deny=false,fail=false;
    const db={async transaction(action:any){const prior=structuredClone(records);try{return await action(tx);}catch(error){records=prior;throw error;}}};
    const identity={async scope(actual:any){assert.equal(actual,tx);}};
    const instances={async readCurrent(){return slot as any;}},machines={async read(){return machine;}};
    const types={async get(){return qualification;},async put(_tx:any,value:any){qualification=value;}};
    const store:any={async lock(){return {records:structuredClone(records),withdrawals:[],observedAt:now};},async prune(){},async clock(){},
        async insert(actual:any,record:any){assert.equal(actual,tx);records.push(structuredClone(record));if(fail)throw Error('persist failure');},
        async close(_tx:any,id:string,state:string,at:number){const item=records.find(value=>value.id===id);item.state=state;item.closedAt=at;},
        async result(){},async recordResult(){},async withdraw(){}};
    const plans={async authorize(actual:any,_actor:string,_scope:string,_forward:string,input:any){assert.equal(actual,tx);if(deny)throw Error('grant withdrawn');
        const measurement=input.kind+'-v1';
        return {version:1,kind:input.kind,measurement,point:input.kind.includes('-path-')?'agent-local-forward-ingress':'agent-local-direct-ingress',capability:'probe.'+input.kind+'.v1',
            businessProtocol:input.kind.startsWith('udp')?'udp':'tcp',serviceContext:context,binding,scopeId:'scope',timeoutMs:1000,
            plannedAt:new Date(now).toISOString(),expiresAt:new Date(now+2000).toISOString(),executable:false,dispatch:'not-implemented',
            independentProbe:false,health:'unknown',maxAttempts:1,applicationPayloadBytes:0} as any;}};
    const permits=new ProbePermits(db,identity,{} as any,plans,machines,instances,store,()=>now,undefined,types);
    const requests:any={async claim(){},async respond(){}};
    const commands=(enabled=true,path=false)=>new ForwardProbes(db,identity,requests,permits,true,true,true,enabled,path);
    const echo=new ProbeEcho(permits,()=>now),registry=new ProbeEchoRegistry(db,machines,instances,types,()=>now);
    const machineRequest={protocolVersion:3,probeVersion:4,nodeId:'node',bootId:'boot',sessionEpoch:1,instanceId,instanceGeneration:1,requestId:'2'.repeat(64)};
    const issue=(kind='tcp-ingress-echo',path=false)=>commands(true,path).create('actor','scope','forward','command',{version:1,kind,expectedRevision:1,timeoutMs:1000,service:reference});
    return {permits,echo,registry,commands,issue,context,machineRequest,reference,now,machine,slot,
        deny:()=>{deny=true;},fail:()=>{fail=true;},unqualify:()=>{delete qualification.echoVersion;},records:()=>records};
}

test('P4 original Echo permit carries immutable service and random invocation challenge; old endpoints cannot consume it',async()=>{
    for(const kind of ['tcp-ingress-echo','udp-ingress-echo']){
        const f=fixture(),reply=await f.issue(kind),body=reply.body as any;
        assert.equal(body.probeVersion,4);assert.equal(Buffer.from(body.challenge.nonce,'base64').length,32);
        assert.equal(body.measurement,kind+'-v1');assert.equal(f.records().length,1);
        assert.deepEqual(body.service,probeEchoServiceSelection(f.context));
        const input={permitId:body.probeId,bootId:'boot',instanceId:f.machineRequest.instanceId,instanceGeneration:1};
        await assert.rejects(f.permits.consume('node','f'.repeat(64),1,input,body.measurement,'services',body.service));
        assert.equal(f.records()[0].state,'issued');
        const request={...f.machineRequest,kind:'probe-echo-claim',...Object.fromEntries(['measurement','taskKind','point','capability','businessProtocol','service','challenge'].map(key=>[key,body[key]])),permitId:body.probeId};
        const accepted=await f.echo.claim('node','f'.repeat(64),1,request);assert.equal(accepted.state,'consumed');
        await assert.rejects(f.echo.claim('node','f'.repeat(64),1,request));
        f.deny();await assert.rejects(f.echo.status('node','f'.repeat(64),1,{...request,kind:'probe-echo-status'}),/grant withdrawn/);
    }
});
test('P4 disabled Echo, missing qualification and persistence failure cannot issue a new permit',async()=>{
    const off=fixture();await assert.rejects(off.commands(false).create('actor','scope','forward','key',
        {version:1,kind:'tcp-ingress-echo',expectedRevision:1,service:off.reference}),{code:'PROBE_DISABLED'});
    const unqualified=fixture();unqualified.unqualify();await assert.rejects(unqualified.issue());assert.equal(unqualified.records().length,0);
    const failed=fixture();failed.fail();await assert.rejects(failed.issue(),/persist failure/);assert.equal(failed.records().length,0);
});

test('P4 Echo result ACK conforms to the closed v4 response after original-owner persistence',async()=>{
    for(const [measurement,kind,point,capability] of [
        ['tcp-ingress-echo-v1','tcp-ingress-echo','agent-local-direct-ingress','probe.tcp-ingress-echo.v1'],
        ['tcp-path-echo-v1','tcp-path-echo','agent-local-forward-ingress','probe.tcp-path-echo.v1'],
    ] as const){
        const f=fixture();await f.issue();const permit=f.records()[0];
        const request={...f.machineRequest,kind:'probe-echo-result',measurement,taskKind:kind,point,capability,businessProtocol:'tcp',
            permitId:permit.id,binding:permit.binding,timeoutMs:1000,issuedAt:new Date(f.now).toISOString(),expiresAt:new Date(f.now+2000).toISOString(),
            service:probeEchoServiceSelection(f.context),challenge:permit.echoChallenge,tls:null,echo:null,
            consumedAt:new Date(f.now).toISOString(),measuredAt:new Date(f.now).toISOString(),validUntil:new Date(f.now+500).toISOString(),
            elapsedMs:0,status:'unreachable',code:'tcp-connect-failed',requestBytes:0,responseBytes:0,applicationPayloadBytes:0,
            applicationHealth:'unknown',source:'agent-reported'};
        // The invocation changes with the distinct measurement, so keep its challenge coherent.
        const invocation={domain:'tunex.probe.echo.invocation.v1' as const,probeVersion:4 as const,measurement,permitId:permit.id,
            binding:permit.binding,instanceId:request.instanceId,instanceGeneration:1,timeoutMs:1000,issuedAt:request.issuedAt,
            expiresAt:request.expiresAt,service:request.service,nonce:request.challenge.nonce};
        request.challenge={...request.challenge,invocationDigest:nativeValueDigest(invocation)};
        const echo=new ProbeEcho({async receiveResult(){return {resultDigest:probeEchoResultDigest(request as never),acceptedAt:f.now,checkedAt:f.now,duplicate:false};}} as never,()=>f.now);
        const ack=await echo.result('node','f'.repeat(64),1,request);
        assert.equal(ack.health,'unknown');assert.equal(ack.executionEnabled,false);assert.equal(ack.measurement,measurement);
        assert.equal(Object.hasOwn(ack,'checkedAt'),false);
    }
});
test('P4 Echo qualification extends recognition on the original slot without extending expiry and keeps revocation sticky',async()=>{
    const f=fixture(),request={...f.machineRequest,kind:'probe-echo-instance',action:'register',measurements:
        ['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1']};
    f.unqualify();const first=await f.registry.handle('node','f'.repeat(64),1,request);
    assert.equal(first.qualified,true);assert.equal(first.expiresAt,new Date(f.slot.expiresAt).toISOString());
    const second=await f.registry.handle('node','f'.repeat(64),1,request);assert.equal(second.expiresAt,first.expiresAt);
    await f.registry.handle('node','f'.repeat(64),1,{...request,action:'revoke'});
    await assert.rejects(f.registry.handle('node','f'.repeat(64),1,request));
    assert.throws(()=>parseProbeQualification({echoVersion:1} as any));
});

test('P4 path Echo needs its own switch and capability, refuses legacy polling, and rechecks capability after claim',async()=>{
    for(const kind of ['tcp-path-echo','udp-path-echo']) {
        const f=fixture();
        await assert.rejects(f.issue(kind),{code:'PROBE_DISABLED'});
        await assert.rejects(f.issue(kind,true));assert.equal(f.records().length,0);
        f.machine.capabilities.push('probe.tcp-path-echo.v1','probe.udp-path-echo.v1');
        const reply=await f.issue(kind,true),body=reply.body as any;
        assert.equal(body.point,'agent-local-forward-ingress');assert.equal(body.measurement,kind+'-v1');
        const measurements=['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1'];
        const legacy=await f.echo.poll('node','f'.repeat(64),1,{...f.machineRequest,kind:'probe-echo-poll',measurements});
        assert.equal(legacy.offer,null);assert.equal(f.records()[0].state,'issued');
        const extended=await f.echo.poll('node','f'.repeat(64),1,{...f.machineRequest,kind:'probe-echo-poll',
            measurements:[...measurements,'tcp-path-echo-v1','udp-path-echo-v1']});
        assert.equal(extended.offer?.measurement,body.measurement);
        const request={...f.machineRequest,kind:'probe-echo-claim',...Object.fromEntries(['measurement','taskKind','point','capability','businessProtocol','service','challenge'].map(key=>[key,body[key]])),permitId:body.probeId};
        await f.echo.claim('node','f'.repeat(64),1,request);
        f.machine.capabilities.splice(f.machine.capabilities.indexOf(body.capability),1);
        await assert.rejects(f.echo.status('node','f'.repeat(64),1,{...request,kind:'probe-echo-status'}));
        assert.equal(f.records()[0].state,'consumed');
    }
});
