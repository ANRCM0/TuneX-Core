import { TransitPreviewDelivery } from '../transit-owner/public.ts';
import type { TransitDeliveryApi } from '../transit-owner/public.ts';
import type { TransitPreviewCommand, TransitDeliveryReport, TransitDeliveryAck } from '../../compatibility/public.ts';
import { MySqlTransitDeliveryStore } from '../../infrastructure/mysql-transit-delivery-store.ts';
import type { MySqlUnitOfWork, Transaction } from '../../infrastructure/mysql.ts';
import { TransitCoordinationJournal } from './transit-coordination.ts';

/** Legacy single-argument entry; the same offline planner never confirms transport receipts. */
export class TransitDeliveryService implements TransitDeliveryApi {
    private readonly db:MySqlUnitOfWork;
    private readonly coordination:TransitCoordinationJournal;
    constructor(db:MySqlUnitOfWork) {this.db=db;this.coordination=new TransitCoordinationJournal(db);}
    private service() {
        return new TransitPreviewDelivery<Transaction>({transaction:action=>this.db.transaction(action)},
            new MySqlTransitDeliveryStore(),{peek:(actor,scope,forward,generation)=>this.coordination.peek(actor,scope,forward,generation)});
    }
    async enqueuePreview(actor:string,scope:string,forward:string,generation:number):Promise<TransitPreviewCommand> {
        return this.service().enqueuePreview(actor,scope,forward,generation);
    }
    async poll(node:string,fingerprint:string,epoch:number,boot:string):Promise<TransitPreviewCommand|null> {
        return this.service().poll(node,fingerprint,epoch,boot);
    }
    async report(node:string,fingerprint:string,epoch:number,report:TransitDeliveryReport):Promise<TransitDeliveryAck> {
        return this.service().report(node,fingerprint,epoch,report);
    }
}
