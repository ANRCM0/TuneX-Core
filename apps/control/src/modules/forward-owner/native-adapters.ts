import type { Forward } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { ForwardNodeAuthorization } from '../node-owner/public.ts';
import type { ForwardAuthorizationExecution } from './execution-contracts.ts';
import type { ForwardRelayHost, ForwardResourceHost } from './execution-contracts.ts';
import type { ForwardExecutionAdapter } from './execution-contracts.ts';
import { compileDirect } from '../../compatibility/public.ts';
import type { AuthorizedNodeFacts } from '../../framework/public.ts';
import { nativeValueDigest as digest } from '../../compatibility/public.ts';

type SharedExecution<Tx>=Pick<ForwardAuthorizationExecution<Tx>,'lock'>;

class NativeDirectForwardAdapter<Tx> implements ForwardExecutionAdapter<Tx> {
    readonly id='native.direct.v1' as const;
    readonly hostInterfaceVersion=1 as const;
    private readonly nodes:ForwardNodeAuthorization<Tx>;
    private readonly resources:ForwardResourceHost<Tx>;
    private readonly execution:SharedExecution<Tx>;
    constructor(nodes:ForwardNodeAuthorization<Tx>,resources:ForwardResourceHost<Tx>,execution:SharedExecution<Tx>) {
        this.nodes=nodes;this.resources=resources;this.execution=execution;
    }
    private validate(forward:Forward,facts:AuthorizedNodeFacts) {
        compileDirect({...forward,spec:{...forward.spec,enabled:true}},facts,forward.spec.protocols.map(protocol=>({
            nodeId:facts.nodeId,forwardId:forward.id,protocol,port:forward.spec.ingress.listen.port,bindingFence:1,deploymentGeneration:1})));
    }
    async prepareCreate(tx:Tx,actor:string,forward:Forward) {
        const facts=await this.nodes.authorized(tx,actor,forward);
        await this.resources.lockNode(tx,facts.nodeId);this.validate(forward,facts);
        const slots=await this.resources.reserve(tx,forward,actor);
        compileDirect({...forward,spec:{...forward.spec,enabled:true}},facts,slots);
    }
    async planCreate(_tx:Tx,_actor:string,_forward:Forward) {}
    async prepareUpdate(tx:Tx,actor:string,current:Forward,next:Forward) {
        if(current.spec.enabled&&!next.spec.enabled&&digest({...current.spec,enabled:false})===digest(next.spec)) {
            await this.execution.lock(tx,next);
            await this.resources.transition(tx,current,next);
            return;
        }
        const facts=await this.nodes.authorized(tx,actor,next);
        await this.execution.lock(tx,next);this.validate(next,facts);
        if(next.revision===current.revision)return;
        const slots=await this.resources.transition(tx,current,next);
        compileDirect({...next,spec:{...next.spec,enabled:true}},facts,slots);
    }
    async planUpdate(_tx:Tx,_actor:string,_forward:Forward) {}
    async lockRemoval(tx:Tx,forward:Forward) {await this.resources.lockNode(tx,forward.spec.ingress.nodeId);}
    async authorizeRetry(tx:Tx,actor:string,forward:Forward) {await this.nodes.authorized(tx,actor,forward);}
}

class NativePathForwardAdapter<Tx> implements ForwardExecutionAdapter<Tx> {
    readonly id:'native.relay.v1'|'native.multihop.v1';
    readonly hostInterfaceVersion=1 as const;
    private readonly nodes:ForwardNodeAuthorization<Tx>;
    private readonly resources:ForwardResourceHost<Tx>;
    private readonly relay:ForwardRelayHost<Tx>;
    constructor(id:NativePathForwardAdapter<Tx>['id'],nodes:ForwardNodeAuthorization<Tx>,resources:ForwardResourceHost<Tx>,relay:ForwardRelayHost<Tx>) {
        this.id=id;this.nodes=nodes;this.resources=resources;this.relay=relay;
    }
    async prepareCreate(tx:Tx,actor:string,forward:Forward) {
        if(!forward.spec.path||!forward.spec.transport)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Relay path and Transport Profile are both required');
        const path=[forward.spec.ingress.nodeId,...forward.spec.path.via];
        const uses=path.map((nodeId,index)=>({nodeId,role:index===0?'ingress' as const:index===path.length-1?'egress' as const:'transit' as const}));
        for(const {nodeId,role} of uses.sort((a,b)=>a.nodeId<b.nodeId?-1:a.nodeId>b.nodeId?1:0)) {
            await this.nodes.authorizedRelayNode(tx,actor,forward.scopeId,nodeId,role,forward);await this.resources.lockNode(tx,nodeId);
        }
    }
    async planCreate(tx:Tx,actor:string,forward:Forward) {await this.relay.acceptPlan(tx,actor,forward);}
    async prepareUpdate(tx:Tx,actor:string,current:Forward,next:Forward) {
        await this.relay.lockNodes(tx,next);
        const stopping=current.spec.enabled&&!next.spec.enabled&&digest({...current.spec,enabled:false})===digest(next.spec);
        if(stopping)return;
        if(next.spec.enabled){
            if(!await this.relay.canExecute(tx,actor,next))throw new ControlError('AUTHORIZATION_DENIED',403,'Relay execution is not authorized');
        }else{
            // Disabled intent changes require product access, without online execution readiness.
            const path=[next.spec.ingress.nodeId,...next.spec.path!.via];
            const uses=path.map((nodeId,index)=>({nodeId,role:index===0?'ingress' as const:index===path.length-1?'egress' as const:'transit' as const}));
            for(const {nodeId,role} of uses.sort((a,b)=>a.nodeId<b.nodeId?-1:a.nodeId>b.nodeId?1:0))
                await this.nodes.authorizedRelayNode(tx,actor,next.scopeId,nodeId,role,next);
        }
    }
    async planUpdate(tx:Tx,actor:string,forward:Forward) {if(forward.spec.enabled)await this.relay.acceptPlan(tx,actor,forward);}
    async lockRemoval(tx:Tx,forward:Forward) {await this.relay.lockNodes(tx,forward);}
    async authorizeRetry(tx:Tx,actor:string,forward:Forward) {
        if(!await this.relay.canExecute(tx,actor,forward))throw new ControlError('AUTHORIZATION_DENIED',403,'Whole Relay path execution is not authorized');
    }
}

export function nativeForwardAdapters<Tx>(nodes:ForwardNodeAuthorization<Tx>,resources:ForwardResourceHost<Tx>,
    relay:ForwardRelayHost<Tx>,execution:SharedExecution<Tx>):readonly ForwardExecutionAdapter<Tx>[] {
    return Object.freeze([new NativeDirectForwardAdapter(nodes,resources,execution),
        new NativePathForwardAdapter('native.relay.v1',nodes,resources,relay),
        new NativePathForwardAdapter('native.multihop.v1',nodes,resources,relay)]);
}
