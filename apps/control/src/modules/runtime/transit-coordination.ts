import { TransitCoordinationService } from '../transit-owner/public.ts';
import type { TransitCoordinationPhase, OfflineTransitCommand, TransitObservationProof, TransitProofVerifier } from '../transit-owner/public.ts';
import { MySqlTransitCoordinationStore } from '../../infrastructure/mysql-transit-coordination-store.ts';
import type { MySqlUnitOfWork, Transaction } from '../../infrastructure/mysql.ts';

export type { TransitCoordinationPhase, TransitCommandAction, OfflineTransitCommand, TransitObservationProof, TransitProofVerifier } from '../transit-owner/public.ts';
export { offlineTransitStep } from '../transit-owner/public.ts';

/** Legacy construction over the one offline coordinator and original journal SQL. */
export class TransitCoordinationJournal {
  private readonly db: MySqlUnitOfWork;
  private readonly coordinator: TransitCoordinationService<Transaction>;
  constructor(db: MySqlUnitOfWork) {
    this.db=db;
    this.coordinator=new TransitCoordinationService<Transaction>(
      {transaction:action=>this.db.transaction(action)},
      new MySqlTransitCoordinationStore<TransitCoordinationPhase>());
  }
  async begin(actor:string,scopeId:string,forwardId:string,generation:number):Promise<OfflineTransitCommand> {
    return this.coordinator.begin(actor,scopeId,forwardId,generation);
  }
  async peek(actor:string,scopeId:string,forwardId:string,generation:number):Promise<OfflineTransitCommand|null> {
    return this.coordinator.peek(actor,scopeId,forwardId,generation);
  }
  async confirm(actor:string,scopeId:string,forwardId:string,generation:number,
    proof:TransitObservationProof,verify:TransitProofVerifier):Promise<OfflineTransitCommand|null> {
    return this.coordinator.confirm(actor,scopeId,forwardId,generation,proof,verify);
  }
  async fail(actor:string,scopeId:string,forwardId:string,generation:number):Promise<OfflineTransitCommand|null> {
    return this.coordinator.fail(actor,scopeId,forwardId,generation);
  }
  async quarantineRecovery():Promise<number> {
    return this.coordinator.quarantineRecovery();
  }
}
