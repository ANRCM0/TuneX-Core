import { ControlError } from './errors.ts';
import type { CommandResponse, RequestIdentity } from './application-ports.ts';
import type { IdempotencyStore, IdempotencyService, StoredValues } from './intent-store-ports.ts';

/** One original idempotency owner; storage and JSON effects are injected. */
export class IdempotencyHost<Tx,DefaultResponse extends CommandResponse=CommandResponse> implements IdempotencyService<Tx,DefaultResponse> {
    private readonly store:IdempotencyStore<Tx>;
    private readonly values:StoredValues;
    constructor(store:IdempotencyStore<Tx>,values:StoredValues){this.store=store;this.values=values;}
    async quarantineRecovery(tx:Tx):Promise<void>{await this.store.quarantine(tx);}
    async claim<R extends CommandResponse=DefaultResponse>(tx:Tx,request:RequestIdentity):Promise<R|undefined>{
        // Preserve the original key snapshot across both awaited storage operations.
        const key={scopeId:request.scopeId,actorId:request.actorId,key:request.key};
        await this.store.ensure(tx,key,request.digest);
        const record=(await this.store.currentForUpdate(tx,key))!;
        if(record.recovery_invalidated)throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW',409,'Restored request history cannot be automatically replayed');
        if(record.request_digest!==request.digest)throw new ControlError('IDEMPOTENCY_CONFLICT',409,'Idempotency key was used for another request');
        if(record.http_status!==null)return {status:record.http_status as CommandResponse['status'],body:this.values.read(record.response)} as R;
        return undefined;
    }
    async respond(tx:Tx,request:RequestIdentity,response:CommandResponse):Promise<void>{
        const status=response.status,encoded=this.values.encode(response.body);
        await this.store.respond(tx,status,encoded,{scopeId:request.scopeId,actorId:request.actorId,key:request.key});
    }
}
