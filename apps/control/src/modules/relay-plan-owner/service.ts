import { parseForwardSpec } from '@tunex/core';
import { ControlError, invalid } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { RelayPlanApi } from './contracts.ts';
import type { RelayPreviewProvider } from './ports.ts';

/** Read-only product coordination over the original Runtime Relay preview owner. */
export class RelayPlans<Tx> implements RelayPlanApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly identity:ScopeAuthorization<Tx>;
    private readonly relay:RelayPreviewProvider<Tx>;
    constructor(db:TransactionBoundary<Tx>,identity:ScopeAuthorization<Tx>,relay:RelayPreviewProvider<Tx>) {
        this.db=db;this.identity=identity;this.relay=relay;
    }
    async planRelay(actorId:string,scopeId:string,input:unknown){
        const parsed=parseForwardSpec(input);if(!parsed.ok)invalid('Valid Forward spec required');const spec=parsed.value;if(!spec.path||!spec.transport)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Path and locked Transport Profile required');
        return this.db.transaction(async tx=>{await this.identity.scope(tx,actorId,scopeId,true);return this.relay.preview(tx,actorId,{id:'preview',scopeId,revision:1,spec:{...spec,enabled:true}});});
    }
}
