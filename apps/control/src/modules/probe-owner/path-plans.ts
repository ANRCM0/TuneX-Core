import { deepFreeze, ipBytes } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { ForwardValue, AuthorizedNodeFacts, NodeUseRole } from '../../framework/public.ts';
import { nativeWallClockNow, nativeParseTime, nativeIsoTime, nativeValueDigest, targetAllowed, nativeProbePathPolicyRevision } from '../../compatibility/public.ts';
import type { RuntimeAssignment } from '../../compatibility/public.ts';
import type { ProbePathPlans, PublishedProbeReader, ProbeBinding } from './plan-contracts.ts';
import type { ProbeEchoServiceResolver, ProbeServiceReference } from './service-contracts.ts';

interface PathNodes<Tx> {
    authorizedRelayNode(tx:Tx,actor:string,scope:string,node:string,role:NodeUseRole,forward?:ForwardValue):Promise<AuthorizedNodeFacts>;
}
export interface ProbePathAssignments<Tx> {assignments(tx:Tx,node:string):Promise<readonly RuntimeAssignment[]>}
const unavailable=():never=>{throw new ControlError('PROBE_UNAVAILABLE',409,'Current complete active forwarding path required');};

/** Reads the original Relay owner; no duplicate route compiler or authority issuer. */
export class ForwardPathProbePlans<Tx> implements ProbePathPlans<Tx> {
    constructor(private readonly nodes:PathNodes<Tx>,private readonly relay:ProbePathAssignments<Tx>,
        private readonly published:PublishedProbeReader<Tx>,private readonly services:ProbeEchoServiceResolver<Tx>,private readonly skew:number) {}
    async authorize(tx:Tx,actor:string,forward:ForwardValue,kind:'tcp-path-echo'|'udp-path-echo',timeoutMs:number,service:ProbeServiceReference) {
        const protocol=kind==='udp-path-echo'?'udp' as const:'tcp' as const;
        const route=[forward.spec.ingress.nodeId,...(forward.spec.path?.via??[])],now=nativeWallClockNow();
        if(!forward.spec.transport||route.length<2||route.length>8||new Set(route).size!==route.length||
            !forward.spec.protocols.includes(protocol)||!ipBytes(forward.spec.target.host))unavailable();
        const context=await this.services.resolveEcho(tx,actor,forward.scopeId,service,protocol);
        if(context.config.version!==2||context.config.endpoint.address!==forward.spec.target.host||context.config.endpoint.port!==forward.spec.target.port)unavailable();
        let binding:ProbeBinding|undefined,expires=Math.min(now+2000,context.config.validUntil-this.skew),deployment:number|undefined;
        for(const [index,node] of route.entries()) {
            const role=index===0?'ingress':index===route.length-1?'egress':'transit';
            const facts=await this.nodes.authorizedRelayNode(tx,actor,forward.scopeId,node,role,forward);
            if(facts.nodeId!==node||facts.scopeId!==forward.scopeId)unavailable();
            if(index===0&&!facts.capabilities.includes(protocol==='tcp'?'probe.tcp-path-echo.v1':'probe.udp-path-echo.v1'))
                throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Explicit current path Echo capability required');
            if(index===0&&(!ipBytes(forward.spec.ingress.listen.address)||
                !targetAllowed(forward.spec.ingress.listen.address,{...facts,allowMetadataTargets:false})))
                throw new ControlError('AUTHORIZATION_DENIED',403,'Path Echo requires a concrete ingress permitted by its original network policy');
            if(index===route.length-1&&!targetAllowed(context.config.endpoint.address,{...facts,allowMetadataTargets:false}))unavailable();
            const expected=(await this.relay.assignments(tx,node)).filter(a=>a.forwardId===forward.id&&a.protocol===protocol);
            const current=await this.published.read(tx,forward.scopeId,node);
            if(!current||current.snapshot.nodeId!==node||current.snapshot.sessionEpoch!==current.sessionEpoch||expected.length!==1)unavailable();
            const snapshot=current!.snapshot,candidates=snapshot.assignments.filter(a=>a.forwardId===forward.id&&a.protocol===protocol),assignment=candidates[0];
            if(candidates.length!==1||!assignment||assignment.phase!=='active'||assignment.forwardRevision!==forward.revision||
                nativeValueDigest(assignment)!==nativeValueDigest(expected[0])||
                assignment.role!==(route.length===2?`relay-${role}`:`multihop-${role}`))unavailable();
            if(index===0&&(assignment!.resource.protocol!==protocol||assignment!.resource.address!==forward.spec.ingress.listen.address||
                assignment!.resource.port!==forward.spec.ingress.listen.port))unavailable();
            if(deployment!==undefined&&deployment!==assignment!.deploymentGeneration)unavailable();
            deployment=assignment!.deploymentGeneration;
            const issued=nativeParseTime(snapshot.issuedAt),valid=nativeParseTime(snapshot.validUntil);
            if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(valid)||issued>now+this.skew||issued>=valid)unavailable();
            expires=Math.min(expires,current!.credentialUntil,valid-this.skew);
            if(nativeProbePathPolicyRevision(assignment!)!==facts.egressPolicyRevision)unavailable();
            if(index===0)binding={nodeId:node,bootId:current!.bootId,sessionEpoch:current!.sessionEpoch,
                snapshotGeneration:snapshot.snapshotGeneration,assignmentId:assignment!.assignmentId,forwardId:forward.id,
                forwardRevision:forward.revision,deploymentGeneration:assignment!.deploymentGeneration,bindingFence:assignment!.bindingFence,
                configDigest:assignment!.driver.configDigest,egressPolicyRevision:facts.egressPolicyRevision};
        }
        if(!binding||!Number.isSafeInteger(expires)||expires<=now)unavailable();
        return deepFreeze({version:1 as const,kind,point:'agent-local-forward-ingress' as const,
            measurement:protocol==='tcp'?'tcp-path-echo-v1' as const:'udp-path-echo-v1' as const,
            capability:protocol==='tcp'?'probe.tcp-path-echo.v1' as const:'probe.udp-path-echo.v1' as const,businessProtocol:protocol,
            serviceContext:context,executable:false as const,dispatch:'not-implemented' as const,independentProbe:false as const,
            health:'unknown' as const,scopeId:forward.scopeId,binding:binding!,timeoutMs,maxAttempts:1 as const,
            applicationPayloadBytes:0 as const,plannedAt:nativeIsoTime(now),expiresAt:nativeIsoTime(expires)});
    }
}
