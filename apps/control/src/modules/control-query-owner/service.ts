import { isId } from '@tunex/core';
import { invalid } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import type { ForwardReadPort } from '../forward-owner/public.ts';
import type { DeploymentReader, OperationReader, RuntimeObservationReader } from '../../framework/public.ts';

import type { ExecutionCapabilities, ControlDetailApi } from './contracts.ts';
export type { ExecutionCapabilities } from './contracts.ts';

/** Management detail reads share the authorization transaction and expose no executable host. */
export class ControlQueries<Tx> implements ControlDetailApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly auth:ScopeAuthorization<Tx>;
    private readonly access:ResourceReadAccess<Tx>;
    private readonly forwards:ForwardReadPort<Tx>;
    private readonly observations:RuntimeObservationReader<Tx>;
    private readonly operations:OperationReader<Tx>;
    private readonly deployments:DeploymentReader<Tx>;
    private readonly features:Readonly<ExecutionCapabilities>;
    constructor(db:TransactionBoundary<Tx>,auth:ScopeAuthorization<Tx>,forwards:ForwardReadPort<Tx>,
        observations:RuntimeObservationReader<Tx>,operations:OperationReader<Tx>,deployments:DeploymentReader<Tx>,features:ExecutionCapabilities,access:ResourceReadAccess<Tx>) {
        this.db=db;this.auth=auth;this.access=access;this.forwards=forwards;this.observations=observations;this.operations=operations;
        this.deployments=deployments;this.features=Object.freeze({...features});
    }
    private authorized<T>(actor:string,scope:string,id:string|undefined,read:(tx:Tx)=>Promise<T>):Promise<T> {
        if(!isId(actor)||!isId(scope)||id!==undefined&&!isId(id))invalid('Valid scoped query identity required');
        return this.db.transaction(async tx=>{await this.auth.scope(tx,actor,scope);return read(tx);});
    }
    async capabilities(actor:string,scope:string) {
        return this.authorized(actor,scope,undefined,async()=>({...this.features}));
    }
    async deployment(actor:string,scope:string,id:string) {
        return this.authorized(actor,scope,id,async tx=>{
            await this.access.forward(tx,actor,scope,id);
            const forward=await this.forwards.get(tx,scope,id);
            return {deployment:await this.deployments.status(tx,forward)};
        });
    }
    async revisions(actor:string,scope:string,id:string) {
        return this.authorized(actor,scope,id,async tx=>{
            await this.access.forward(tx,actor,scope,id);
            const forward=await this.forwards.get(tx,scope,id);
            return {revisions:await this.forwards.revisions(tx,forward.id)};
        });
    }
    async forward(actor:string,scope:string,id:string) {
        return this.authorized(actor,scope,id,async tx=>{
            await this.access.forward(tx,actor,scope,id);
            const forward=await this.forwards.get(tx,scope,id),state=await this.observations.status(tx,forward);
            const operation=await this.operations.latest(tx,forward.id),metadata=await this.forwards.record(tx,scope,forward.id);
            return {desired:{revision:forward.revision,spec:forward.spec,deleting:false,recoverySuspended:metadata.recoverySuspended},...state,
                lastOperation:operation?{id:operation.id,kind:operation.kind,status:operation.status,
                    recoveryInvalidated:Boolean(operation.recovery_invalidated),cleanupPending:Boolean(operation.cleanup_pending)}:null};
        });
    }
    async operation(actor:string,scope:string,id:string) {
        return this.authorized(actor,scope,id,async tx=>{
            const op=await this.operations.get(tx,scope,id);
            await this.access.forward(tx,actor,scope,op.forward_id);
            return {id:op.id,forwardId:op.forward_id,kind:op.kind,requestedBy:op.requested_by,sourceOperationId:op.source_operation_id,
                status:op.status,recoveryInvalidated:Boolean(op.recovery_invalidated),targetRevision:op.target_revision,
                cleanupPending:Boolean(op.cleanup_pending),lastError:op.last_error};
        });
    }
}
