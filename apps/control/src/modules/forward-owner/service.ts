import { isId } from '@tunex/core';
import { ControlError, notFound } from '../../framework/public.ts';
import type { ForwardValue as Forward, StoredForwardIntent } from '../../framework/public.ts';
import type { ForwardStateOptions, ForwardStateOwner } from './contracts.ts';

/** Original intent state owner; execution publication remains with the Runtime ledger. */
export class ForwardStateService<Tx> implements ForwardStateOwner<Tx> {
    private readonly store:ForwardStateOptions<Tx>['store'];
    private readonly values:ForwardStateOptions<Tx>['values'];
    constructor(options:ForwardStateOptions<Tx>){this.store=options.store;this.values=options.values;}
    private project(row:StoredForwardIntent):Forward {
        if(row.owner_actor_id!==null&&!isId(row.owner_actor_id))throw new ControlError('INTEGRITY_FAILURE',409,'Invalid persisted Forward ownership');
        return {id:row.id,scopeId:row.scope_id,revision:row.revision,spec:this.values.read<Forward['spec']>(row.spec)};
    }
    async revisions(tx:Tx,id:string):Promise<{revision:number;spec:unknown}[]>{return this.store.revisions(tx,id);}
    async quarantineRecovery(tx:Tx):Promise<void>{await this.store.quarantine(tx);}
    async hasLiveRelay(tx:Tx,profileId?:string,nodeId?:string):Promise<boolean>{
        if(profileId)return await this.store.liveProfileCount(tx,profileId)>0;
        if(nodeId)return await this.store.liveNodeCount(tx,nodeId)>0;
        throw new Error('Explicit Relay reference required');
    }
    async forNode(tx:Tx,id:string):Promise<Forward[]>{const records=await this.store.forNode(tx,id);return records.map(row=>this.project(row));}
    async forReferencedNode(tx:Tx,id:string):Promise<Forward[]>{const records=await this.store.forReferencedNode(tx,id);return records.map(row=>this.project(row));}
    async forProfileActor(tx:Tx,id:string,actor:string):Promise<Forward[]>{const records=await this.store.forProfileActor(tx,actor,id);return records.map(row=>this.project(row));}
    async insert(tx:Tx,forward:Forward,actor:string):Promise<void>{
        await this.store.insertCurrent(tx,forward.id,forward.scopeId,forward.revision,this.values.encode(forward.spec),actor);
        await this.store.insertRevision(tx,forward.id,forward.revision,this.values.encode(forward.spec));
    }
    async classifyOwner(tx:Tx,scope:string,id:string,expectedRevision:number,actor:string,ownerActorId:string,eventId:string,at:number):Promise<void>{
        const row=await this.store.record(tx,id,scope,true);if(!row)notFound();
        if(row.owner_actor_id!==null&&!isId(row.owner_actor_id))throw new ControlError('INTEGRITY_FAILURE',409,'Invalid persisted Forward ownership');
        if(row.revision!==expectedRevision||row.owner_actor_id!==null)
            throw new ControlError('REVISION_CONFLICT',409,'Forward revision changed or ownership is already classified');
        if(await this.store.classifyOwner(tx,id,scope,expectedRevision,ownerActorId)!==1)
            throw new ControlError('REVISION_CONFLICT',409,'Forward ownership classification raced');
        await this.store.auditOwnership(tx,eventId,id,scope,expectedRevision,actor,ownerActorId,at);
    }
    async authorizer(tx:Tx,id:string):Promise<string|null>{return (await this.store.authorizer(tx,id))?.authorization_actor??null;}
    async setAuthorizer(tx:Tx,id:string,actor:string):Promise<void>{await this.store.setAuthorizer(tx,actor,id);}
    async forActor(tx:Tx,scope:string,actor:string):Promise<Forward[]>{const records=await this.store.forActor(tx,scope,actor);return records.map(row=>this.project(row));}
    async get(tx:Tx,scope:string,id:string):Promise<Forward&{ownerActorId:string|null}>{const row=await this.store.get(tx,id,scope);if(!row)notFound();return {...this.project(row),ownerActorId:row.owner_actor_id};}
    async ownershipForUpdate(tx:Tx,scope:string,id:string):Promise<Forward>{const row=await this.store.record(tx,id,scope,true);if(!row)notFound();return this.project(row);}
    async currentForUpdate(tx:Tx,scope:string,id:string):Promise<Forward>{const row=await this.store.currentForUpdate(tx,id,scope);if(!row)notFound();return this.project(row);}
    async record(tx:Tx,scope:string,id:string):Promise<Forward&{ownerActorId:string|null;deleting:boolean;recoverySuspended:boolean}>{
        const row=await this.store.record(tx,id,scope);if(!row)notFound();
        return {...this.project(row),ownerActorId:row.owner_actor_id,deleting:Boolean(row.deleting),recoverySuspended:Boolean(row.recovery_suspended)};
    }
    async replace(tx:Tx,current:Forward,next:Forward):Promise<void>{
        const changed=await this.store.replaceCurrent(tx,next.revision,this.values.encode(next.spec),current.id,current.revision);
        if(changed!==1)throw new ControlError('REVISION_CONFLICT',409,'Concurrent intent change');
        await this.store.insertRevision(tx,next.id,next.revision,this.values.encode(next.spec));
    }
    async markDeleting(tx:Tx,current:Forward,nextRevision:number):Promise<void>{
        const changed=await this.store.markDeleting(tx,nextRevision,current.id,current.revision);
        if(changed!==1)throw new ControlError('REVISION_CONFLICT',409,'Concurrent intent change');
        await this.store.insertRevision(tx,current.id,nextRevision,this.values.encode(current.spec));
    }
}
