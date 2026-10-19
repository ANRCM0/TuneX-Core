import { TransitNegotiationService } from '../transit-owner/public.ts';
import type { TransitNegotiationApi } from '../transit-owner/public.ts';
import type { TransitNegotiationRequest, TransitNegotiationResponse } from '../../compatibility/public.ts';
import { MySqlTransitMachineReader } from '../../infrastructure/mysql-transit-machine.ts';
import type { MySqlUnitOfWork, Transaction } from '../../infrastructure/mysql.ts';

/** Legacy one-argument entry over the original session lock and negotiation rules. */
export class TransitNegotiator implements TransitNegotiationApi {
    private readonly db:MySqlUnitOfWork;
    constructor(db:MySqlUnitOfWork){this.db=db;}
    async hello(nodeId:string,fingerprint:string,epoch:number,request:TransitNegotiationRequest):Promise<TransitNegotiationResponse> {
        return new TransitNegotiationService<Transaction>({
            transaction:action=>this.db.transaction(action),
        },new MySqlTransitMachineReader()).hello(nodeId,fingerprint,epoch,request);
    }
}
