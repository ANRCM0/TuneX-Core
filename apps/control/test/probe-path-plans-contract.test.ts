import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForwardPathProbePlans } from '../src/modules/probe-owner/public.ts';

function fixture(count=2,protocol:'tcp'|'udp'='tcp') {
    const now=Date.now(),tx={},route=Array.from({length:count},(_,index)=>`node-${index}`),calls:string[]=[],heads=new Map<string,any>(),assignments=new Map<string,any[]>();
    const forward:any={id:'forward',scopeId:'scope',revision:3,spec:{enabled:true,protocols:[protocol],ingress:{nodeId:route[0],listen:{address:'127.0.0.1',port:18080}},
        target:{host:'127.0.0.2',port:18081},path:{via:route.slice(1)},transport:{profileId:'profile',configRevision:1}}};
    const context:any={scopeId:'scope',config:{version:2,endpoint:{address:'127.0.0.2',port:18081},validUntil:now+60000}};
    let deny:string|undefined,capable=true,localAllowed=true;
    for(const [index,node] of route.entries()) {
        const role=index===0?'ingress':index===count-1?'egress':'transit';
        const policy={egressPolicyRevision:1},a={forwardId:'forward',forwardRevision:3,protocol,phase:'active',role:(count===2?'relay-':'multihop-')+role,
            assignmentId:`assignment-${index}`,deploymentGeneration:2,bindingFence:4,resource:{address:'127.0.0.1',port:18080+index,protocol},
            driver:{configDigest:'sha256:'+'c'.repeat(64),config:count===2?policy:{hop:policy}}};
        assignments.set(node,[a]);heads.set(node,{bootId:'boot',sessionEpoch:1,credentialUntil:now+30000,snapshot:{nodeId:node,sessionEpoch:1,snapshotGeneration:5,
            issuedAt:new Date(now-100).toISOString(),validUntil:new Date(now+10000).toISOString(),assignments:[structuredClone(a)]}});
    }
    const nodes:any={async authorizedRelayNode(actual:any,_actor:string,_scope:string,node:string){assert.equal(actual,tx);calls.push(node);if(deny===node)throw Error('grant withdrawn');
        return {nodeId:node,scopeId:'scope',capabilities:capable?['probe.tcp-path-echo.v1','probe.udp-path-echo.v1']:[],egressPolicyRevision:1,
            allowedDestinationCidrs:!localAllowed&&node===route[0]?['192.0.2.0/24']:['127.0.0.0/8'],allowMetadataTargets:false};}};
    const relay:any={async assignments(actual:any,node:string){assert.equal(actual,tx);return assignments.get(node);}},reader:any={async read(actual:any,_scope:string,node:string){assert.equal(actual,tx);return heads.get(node);}};
    const service:any={async resolveEcho(actual:any){assert.equal(actual,tx);return context;}};
    const planner=new ForwardPathProbePlans(nodes,relay,reader,service,0);
    return {route,calls,heads,assignments,forward,context,deny:(node:string)=>{deny=node;},disable:()=>{capable=false;},denyLocal:()=>{localAllowed=false;},
        plan:()=>planner.authorize(tx,'actor',forward,protocol==='tcp'?'tcp-path-echo':'udp-path-echo',1000,{} as any)};
}

test('P4 path planner consumes original route and same transaction for every Relay/multihop node and protocol',async()=>{
    for(const count of [2,3,8])for(const protocol of ['tcp','udp'] as const){
        const f=fixture(count,protocol),plan=await f.plan();assert.deepEqual(f.calls,f.route);
        assert.equal(plan.point,'agent-local-forward-ingress');assert.equal(plan.measurement,protocol+'-path-echo-v1');
        assert.equal(plan.binding.forwardRevision,3);assert.equal(plan.executable,false);assert.equal(plan.health,'unknown');
    }
});
test('P4 path planner rejects missing opt-in and downstream authorization before returning a plan',async()=>{
    const off=fixture();off.disable();await assert.rejects(off.plan(),{code:'UNSUPPORTED_CAPABILITY'});
    const denied=fixture(3);denied.deny(denied.route[1]!);await assert.rejects(denied.plan(),/grant withdrawn/);
});
test('P4 drift prepared snapshots session mismatch and missing hops cannot reuse path observation authority',async()=>{
    for(const mutate of [
        (f:ReturnType<typeof fixture>)=>{f.heads.get(f.route[1]!)!.snapshot.assignments[0].bindingFence++;},
        (f:ReturnType<typeof fixture>)=>{f.heads.get(f.route[1]!)!.snapshot.assignments[0].phase='prepared';},
        (f:ReturnType<typeof fixture>)=>{f.heads.get(f.route[1]!)!.sessionEpoch++;},
        (f:ReturnType<typeof fixture>)=>{f.assignments.set(f.route[1]!,[]);},
        (f:ReturnType<typeof fixture>)=>{f.context.config.endpoint.port++;},
        (f:ReturnType<typeof fixture>)=>{delete f.forward.spec.transport;},
    ]){const f=fixture(3);mutate(f);await assert.rejects(f.plan(),{code:'PROBE_UNAVAILABLE'});}
});

test('P4 Control path preflight rejects local ingress destinations the original Agent endpoint checks cannot execute',async()=>{
    for(const address of ['0.0.0.0','::','169.254.169.254','224.0.0.1']) {
        const f=fixture();f.forward.spec.ingress.listen.address=address;
        await assert.rejects(f.plan(),{code:'AUTHORIZATION_DENIED'});
    }
    const denied=fixture();denied.denyLocal();await assert.rejects(denied.plan(),{code:'AUTHORIZATION_DENIED'});
    for(const field of ['address','port'] as const) {
        const f=fixture();
        for(const assignments of [f.assignments.get(f.route[0]!)!,f.heads.get(f.route[0]!)!.snapshot.assignments])
            assignments[0].resource[field]=field==='address'?'127.0.0.3':18081;
        await assert.rejects(f.plan(),{code:'PROBE_UNAVAILABLE'});
    }
});
