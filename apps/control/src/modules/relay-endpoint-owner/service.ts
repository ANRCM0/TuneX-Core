import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { RelayEndpointOwner, RelayEndpointOptions, RelayEndpointResponse, ResolvedEndpoint, RelayEndpointView } from './contracts.ts';

export class RelayEndpointService<Tx> implements RelayEndpointOwner<Tx> {
    private readonly db:RelayEndpointOptions<Tx>['db'];private readonly identity:RelayEndpointOptions<Tx>['identity'];
    private readonly nodes:RelayEndpointOptions<Tx>['nodes'];private readonly idempotency:RelayEndpointOptions<Tx>['idempotency'];
    private readonly forwarding:RelayEndpointOptions<Tx>['forwarding'];private readonly store:RelayEndpointOptions<Tx>['store'];
    private readonly codec:RelayEndpointOptions<Tx>['codec'];private readonly now:RelayEndpointOptions<Tx>['now'];
    constructor(options:RelayEndpointOptions<Tx>){this.db=options.db;this.identity=options.identity;this.nodes=options.nodes;
        this.idempotency=options.idempotency;this.forwarding=options.forwarding;this.store=options.store;this.codec=options.codec;this.now=options.now;}
    async change(actor:string,scopeId:string,nodeId:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<RelayEndpointResponse>{
        if(!this.codec.isId(nodeId)||!this.codec.isCounter(expectedRevision,true)||!key||!this.codec.validRequestKey(key))invalid('Valid endpoint command required');
        const config=this.codec.endpoint(input);
        const request={actorId:actor,scopeId,key,digest:this.codec.digest({method:'PUT',path:`/api/v1/scopes/${scopeId}/nodes/${nodeId}/relay-endpoint`,expectedRevision,config})};
        return this.db.transaction(async tx=>{
            await this.identity.owner(tx,actor,scopeId);
            const replay=await this.idempotency.claim<RelayEndpointResponse>(tx,request);if(replay)return replay;
            const node=await this.nodes.management(tx,actor,scopeId,nodeId);
            if(node.revoked)throw new ControlError('AUTHORIZATION_DENIED',403,'Revoked Node endpoint cannot be changed');
            const current=await this.store.forUpdate(tx,nodeId);
            if((current?.revision??0)!==expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Relay endpoint revision conflict');
            const changed=!current||this.codec.digest(this.codec.readStored(current.config))!==this.codec.digest(config),revision=expectedRevision+(changed?1:0);
            if(revision>this.codec.maxRevision)throw new ControlError('REVISION_EXHAUSTED',409,'Relay endpoint revision exhausted');
            if(changed){
                const live=await this.forwarding.hasLiveRelay(tx,undefined,nodeId);
                if(live)throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Active Relay endpoint changes require withdrawal coordinator');
                await this.store.save(tx,nodeId,revision,this.codec.encode(config),actor,this.now());
                await this.nodes.audit(tx,nodeId,actor,'relay_endpoint_update',{revision,config});
            }
            const response={status:changed?202 as const:200 as const,body:{nodeId,revision,changed}};
            await this.idempotency.respond(tx,request,response);return response;
        });
    }
    async resolve(tx:Tx,nodeId:string):Promise<ResolvedEndpoint>{
        const record=await this.store.resolve(tx,nodeId);if(!record)notFound();
        return {nodeId,revision:record.revision,config:this.codec.endpoint(this.codec.readStored(record.config))};
    }
    async get(actor:string,scopeId:string,nodeId:string):Promise<RelayEndpointView>{
        return this.db.transaction(async tx=>{await this.identity.scope(tx,actor,scopeId);await this.nodes.cleanupFacts(tx,nodeId,scopeId);
            return {...await this.resolve(tx,nodeId),executionSupported:false};});
    }
}
