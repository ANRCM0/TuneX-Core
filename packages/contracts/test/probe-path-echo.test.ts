import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { digest } from '../src/digest.ts';
import { parseProbeEcho, probeEchoInvocationDigest, probeEchoRequestFrame, probeEchoServiceSelection, verifyProbeEchoProof } from '../src/probe-echo.ts';
import type { ProbeEchoInvocation, ProbeEchoServiceContext } from '../src/probe-echo.ts';

function fixture(measurement:ProbeEchoInvocation['measurement']) {
    const now=Date.parse('2026-10-24T00:00:00.000Z'),keys=generateKeyPairSync('ed25519');
    const config={version:2 as const,purpose:'controlled-nonce-echo' as const,endpoint:{address:'127.0.0.1',port:8080,protocols:['tcp','udp'] as const},
        trust:{mode:'ed25519-echo-v1' as const,publicKey:keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64')},validFrom:now-1000,validUntil:now+30000};
    const raw={scopeId:'scope',serviceId:'service',revision:1,configRevision:1,configDigest:digest(config),config};
    const context:ProbeEchoServiceContext={...raw,contextDigest:digest(raw)};
    const invocation:ProbeEchoInvocation={domain:'tunex.probe.echo.invocation.v1',probeVersion:4,measurement,permitId:'permit',
        binding:{nodeId:'node',bootId:'boot',sessionEpoch:1,snapshotGeneration:1,assignmentId:'assignment',forwardId:'forward',forwardRevision:1,deploymentGeneration:1,bindingFence:1,configDigest:'sha256:'+'a'.repeat(64),egressPolicyRevision:1},
        instanceId:'1'.repeat(64),instanceGeneration:1,timeoutMs:1000,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+2000).toISOString(),
        service:probeEchoServiceSelection(context),nonce:Buffer.alloc(32,1).toString('base64')};
    const challenge={nonce:invocation.nonce,invocationDigest:probeEchoInvocationDigest(invocation)},request=probeEchoRequestFrame(invocation,challenge);
    const hash=createHash('sha256').update(request).digest(),response=Buffer.alloc(192);
    request.copy(response,0,0,120);response.write('TNXECHOR');hash.copy(response,120);
    const proof={algorithm:'Ed25519' as const,requestDigest:'sha256:'+hash.toString('hex'),signature:sign(null,Buffer.concat([Buffer.from('tunex.echo.response.v1\0'),response]),keys.privateKey).toString('base64'),verified:true as const};
    return {context,invocation,challenge,request,proof};
}
test('P4 path Echo proof binds distinct measurement and immutable invocation while retaining TCP/UDP wire framing',()=>{
    for(const measurement of ['tcp-path-echo-v1','udp-path-echo-v1'] as const){
        const f=fixture(measurement);assert.equal(f.request.length,256);assert.equal(f.request[9],measurement.startsWith('tcp')?1:2);
        assert.equal(verifyProbeEchoProof(f.context,f.invocation,f.challenge,f.proof),true);
        const direct={...f.invocation,measurement:measurement.startsWith('tcp')?'tcp-ingress-echo-v1' as const:'udp-ingress-echo-v1' as const};
        assert.notEqual(probeEchoInvocationDigest(direct),f.challenge.invocationDigest);
        assert.equal(verifyProbeEchoProof(f.context,direct,f.challenge,f.proof),false);
        assert.equal(verifyProbeEchoProof(f.context,{...f.invocation,binding:{...f.invocation.binding,bindingFence:2}},f.challenge,f.proof),false);
    }
});
test('P4 legacy and extended v4 lists are closed and path descriptors cannot claim a Direct observation point',()=>{
    const machine={protocolVersion:3,probeVersion:4,nodeId:'node',bootId:'boot',sessionEpoch:1,instanceId:'1'.repeat(64),instanceGeneration:1,requestId:'2'.repeat(64)};
    const legacy=['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1'];
    for(const measurements of [legacy,[...legacy,'tcp-path-echo-v1','udp-path-echo-v1']])
        assert.doesNotThrow(()=>parseProbeEcho('PollRequest',JSON.stringify({...machine,kind:'probe-echo-poll',measurements})));
    assert.throws(()=>parseProbeEcho('PollRequest',JSON.stringify({...machine,kind:'probe-echo-poll',measurements:[...legacy,'tcp-path-echo-v1']})));
    const f=fixture('tcp-path-echo-v1'),claim={...machine,kind:'probe-echo-claim',permitId:'permit',measurement:'tcp-path-echo-v1',taskKind:'tcp-path-echo',
        point:'agent-local-forward-ingress',capability:'probe.tcp-path-echo.v1',businessProtocol:'tcp',service:f.invocation.service,challenge:f.challenge};
    assert.doesNotThrow(()=>parseProbeEcho('ClaimRequest',JSON.stringify(claim)));
    assert.throws(()=>parseProbeEcho('ClaimRequest',JSON.stringify({...claim,point:'agent-local-direct-ingress'})));
});
