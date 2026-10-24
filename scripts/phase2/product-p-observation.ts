import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createSocket } from 'node:dgram';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { digest } from '@tunex/contracts';
import type { ProbeEchoPollResponse } from '@tunex/contracts';

type Call = (method:string,path:string,input?:unknown,key?:string)=>Promise<{status:number;body:any}>;
interface Options {
    call:Call;scopeId:string;nodeId:string;listenPort:number;spec:Record<string,unknown>;
    mode:'direct'|'relay'|'multihop';directory:string;qualified:()=>Promise<boolean>;tick?:()=>Promise<void>;
    usage?:{actorId:string;display:()=>Promise<void>};
    diagnostics?:()=>unknown;
    discovery:{poll(node:string,fingerprint:string,epoch:number,input:unknown):Promise<ProbeEchoPollResponse>};
}

// Disposable loopback responder: signs only fixed-size, current requests for the
// one published fixture context. It is not the independently delivered Responder.
async function echoFixture() {
    const keys=generateKeyPairSync('ed25519'),sockets=new Set<Socket>(),seen=new Map<string,number>();
    const udp=createSocket('udp4');let contextDigest='',validUntil=0,rejected=0;
    function response(raw:Buffer,protocol:'tcp'|'udp'):Buffer|null {
        if(raw.length!==256||raw.subarray(0,8).toString()!=='TNXECHOQ'||raw[8]!==1||raw[9]!== (protocol==='tcp'?1:2)||
            raw.subarray(10,16).some(Boolean)||raw.subarray(120).some(Boolean)||
            'sha256:'+raw.subarray(56,88).toString('hex')!==contextDigest) {rejected++;return null;}
        const expires=raw.readBigUInt64BE(16),now=BigInt(Date.now());
        if(expires<=now||expires>now+2000n||expires>BigInt(validUntil)){rejected++;return null;}
        const invocation='sha256:'+raw.subarray(88,120).toString('hex');
        seen.set(invocation,(seen.get(invocation)??0)+1);
        if(seen.get(invocation)!==1){rejected++;return null;}
        const frame=Buffer.alloc(256);raw.copy(frame,0,0,120);frame.write('TNXECHOR');
        createHash('sha256').update(raw).digest().copy(frame,120);
        sign(null,Buffer.concat([Buffer.from('tunex.echo.response.v1\0'),frame.subarray(0,192)]),keys.privateKey).copy(frame,192);
        return frame;
    }
    const tcp=createServer(socket=>{
        sockets.add(socket);let buffered=Buffer.alloc(0),done=false;
        socket.setTimeout(2500,()=>socket.destroy());socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));
        socket.on('data',chunk=>{
            if(done)return socket.destroy();buffered=Buffer.concat([buffered,chunk]);
            if(buffered.length>256){done=true;rejected++;socket.destroy();return;}
            if(buffered.length===256){done=true;const frame=response(buffered,'tcp');if(frame)socket.end(frame);else socket.destroy();}
        });
    });
    await new Promise<void>((resolve,reject)=>{tcp.once('error',reject);tcp.listen(0,'127.0.0.1',resolve);});
    const port=(tcp.address() as {port:number}).port;
    try {await new Promise<void>((resolve,reject)=>{udp.once('error',reject);udp.bind(port,'127.0.0.1',resolve);});}
    catch(error){await new Promise<void>(resolve=>tcp.close(()=>resolve()));throw error;}
    udp.on('message',(raw,remote)=>{const frame=response(raw,'udp');if(frame)udp.send(frame,remote.port,remote.address,()=>{});});
    return {
        port,seen,
        publicKey:keys.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64'),
        bind(context:string,until:number){assert.equal(contextDigest,'');contextDigest=context;validUntil=until;},
        rejected:()=>rejected,
        async close(){for(const socket of sockets)socket.destroy();await Promise.all([
            new Promise<void>(resolve=>tcp.close(()=>resolve())),new Promise<void>(resolve=>udp.close(()=>resolve()))]);},
    };
}

export async function verifyControlledEcho(options:Options) {
    if(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true')throw Error('Product P network acceptance is Actions-only');
    const fixture=await echoFixture(),attempts:Record<string,unknown>[]=[],checks:string[]=[];
    const discovery=options.discovery,originalPoll=discovery.poll;
    let emptySequence=0,emptyAt=0;
    discovery.poll=async(...args)=>{
        const result=await originalPoll.apply(discovery,args);
        if(args[0]===options.nodeId&&result.offer===null){emptySequence++;emptyAt=Date.now();}
        return result;
    };
    let usageSample:unknown=null;
    let forwardId='',created=false,scenarioPassed=false,conclusion:'passed'|'failed'='failed';
    const serviceId='p-echo-'+options.mode,call=options.call;
    async function wait(check:()=>Promise<boolean>,label:string,timeout=120000) {
        const started=Date.now();while(Date.now()-started<timeout){await options.tick?.();if(await check())return;await sleep(150);}
        throw Error('P controlled Echo timed out: '+label);
    }
    try {
        const now=Date.now(),config={version:2,purpose:'controlled-nonce-echo',endpoint:{address:'127.0.0.1',port:fixture.port,protocols:['tcp','udp']},
            trust:{mode:'ed25519-echo-v1',publicKey:fixture.publicKey},validFrom:now-1000,validUntil:now+600000};
        if(options.usage){
            const policy=await call('PUT',`nodes/${options.nodeId}/payload-limits/${options.usage.actorId}`,{expectedRevision:0,
                startsAt:new Date(now-60000).toISOString(),endsAt:new Date(now+600000).toISOString(),bytesPerSecond:null,burstBytes:65536,byteLimit:1048576});
            assert.ok([200,202].includes(policy.status),JSON.stringify(policy.body));assert.equal(policy.body.revision,1);
        }
        const published=await call('PUT','observation-services/'+serviceId,{expectedRevision:0,config});
        assert.equal(published.status,202,JSON.stringify(published.body));
        const service={serviceId,revision:published.body.revision,configRevision:published.body.configRevision,configDigest:published.body.configDigest};
        assert.equal(service.configDigest,digest(config));
        fixture.bind(digest({scopeId:options.scopeId,...service,config}),config.validUntil);
        const spec={...options.spec,enabled:true,protocols:['tcp','udp'],
            ingress:{nodeId:options.nodeId,listen:{address:'127.0.0.1',port:options.listenPort}},target:{host:'127.0.0.1',port:fixture.port}};
        const accepted=await call('POST','forwards',spec);assert.equal(accepted.status,202,JSON.stringify(accepted.body));
        forwardId=accepted.body.forwardId;created=true;
        await wait(async()=>{const result=await call('GET','forwards/'+forwardId);return result.body.lastOperation?.status==='succeeded'&&result.body.health?.condition==='ready';},'actual Forward activation');
        await wait(options.qualified,'current Echo qualification');
        const matrix=await call('GET','forwards/'+forwardId+'/probe-capabilities');
        assert.equal(matrix.status,200);assert.equal(matrix.body.capabilityVersion,options.mode==='direct'?1:2);assert.equal(matrix.body.items.length,options.mode==='direct'?5:7);assert.equal(matrix.body.mode,options.mode);
        for(const protocol of ['tcp','udp'] as const) {
            const kind=protocol+(options.mode==='direct'?'-ingress-echo':'-path-echo');
            let success=false;
            for(let ordinal=0;ordinal<6;ordinal++) {
                await wait(options.qualified,'fresh Echo qualification');
                // Align a new explicit command with the next original one-second
                // poll. Keep the two-second permit and clock-skew deduction intact.
                const previous=emptySequence,observeUntil=Date.now()+5000;
                while(emptySequence===previous&&Date.now()<observeUntil)await sleep(10);
                assert.ok(emptySequence>previous,'No actual empty Echo poll observed before the next explicit command');
                await sleep(Math.max(0,emptyAt+650-Date.now()));
                const key=randomUUID(),input={version:1,kind,expectedRevision:1,timeoutMs:1000,service};
                const issued=await call('POST','forwards/'+forwardId+'/probes',input,key);
                if(issued.status!==202){
                    assert.ok(['PROBE_UNAVAILABLE','PROBE_PERMIT_UNAVAILABLE','PROBE_PERMIT_LIMIT'].includes(issued.body.code),JSON.stringify(issued.body));
                    attempts.push({protocol,ordinal,refused:issued.body.code});await sleep(1100);continue;
                }
                assert.deepEqual(await call('POST','forwards/'+forwardId+'/probes',input,key),issued);
                let receipt:any;
                do {
                    const result=await call('GET','probes/'+issued.body.probeId);assert.equal(result.status,200,JSON.stringify(result.body));receipt=result.body;
                    if(receipt.result)break;await sleep(50);
                }while(Date.now()<Date.parse(issued.body.expiresAt)+100);
                const received=fixture.seen.get(issued.body.challenge.invocationDigest)??0;
                attempts.push({protocol,ordinal,probeId:issued.body.probeId,received,state:receipt.state,resultAccepted:!!receipt.result});
                assert.ok(received<=1,'The same consumed permit reached the responder more than once');
                if(receipt.result) {
                    const result=receipt.result.body;
                    assert.equal(receipt.state,'consumed');assert.equal(receipt.health,'unknown');assert.equal(receipt.result.historical,true);
                    assert.equal(result.measurement,kind+'-v1');assert.equal(result.point,options.mode==='direct'?'agent-local-direct-ingress':'agent-local-forward-ingress');
                    assert.equal(result.status,'echoed');assert.equal(result.code,'nonce-echo-verified');assert.equal(result.echo.verified,true);
                    assert.equal(result.requestBytes,256);assert.equal(result.responseBytes,256);assert.equal(result.applicationPayloadBytes,512);assert.equal(received,1);
                    success=true;
                }
                await sleep(Math.max(0,Date.parse(issued.body.expiresAt)+1100-Date.now()));
                assert.deepEqual(await call('POST','forwards/'+forwardId+'/probes',input,key),issued);
                assert.equal(fixture.seen.get(issued.body.challenge.invocationDigest)??0,received,'Lost-response replay caused another network request');
                if(success)break;
            }
            assert.ok(success,'No independent '+kind+' permit completed the actual signed workflow');
            checks.push(protocol+' signed original permit/Agent/Forward/responder/result round trip and non-executing replay');
        }
        assert.equal(fixture.rejected(),0);
        if(options.usage){
            await wait(async()=>{
                const value=await call('GET',`nodes/${options.nodeId}/payload-limits/${options.usage!.actorId}`);
                assert.equal(value.status,200);const sample=value.body.consumption;
                if(sample.status!=='fresh'||typeof sample.usedBytes!=='string'||BigInt(sample.usedBytes)<1024n)return false;
                assert.equal(sample.source,'agent-protected-journal');assert.equal(sample.accounting,'conservative-precharge');
                assert.equal(sample.remainingMeaning,'upper-bound-at-sample');assert.equal(sample.periodStatus,'active');
                assert.equal(BigInt(sample.remainingBytes),1048576n-BigInt(sample.usedBytes));usageSample=sample;return true;
            },'actual accepted Report and Journal usage projection',20000);
            await options.usage.display();checks.push('Actual Journal precharge reaches the accepted-report-bound usage API and Chromium view');
        }
        scenarioPassed=true;
    } finally {
        try {
            if(created){
                const removed=await call('DELETE','forwards/'+forwardId,{expectedRevision:1});assert.equal(removed.status,202,JSON.stringify(removed.body));
                await wait(async()=> (await call('GET','operations/'+removed.body.operationId)).body.status==='succeeded','original cleanup Operation');
            }
            if(scenarioPassed)conclusion='passed';
        } finally {
            discovery.poll=originalPoll;
            await fixture.close();
            await writeFile(options.directory+'/product-p-echo-'+options.mode+'.json',JSON.stringify({conclusion,mode:options.mode,checks,attempts,usageSample,diagnostics:options.diagnostics?.(),
                topology:'native Agent processes and a disposable signed responder on one hosted Actions runner',physicalHosts:false,
                responder:'test fixture only; no standalone delivery claim'},null,2));
        }
    }
    return checks;
}
