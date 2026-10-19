import { MySqlForwardDiagnosticReadStore } from './mysql-forward-diagnostic-read-store.ts';
import type { DiagnosticAssignment, DiagnosticDeployment, DiagnosticForward, DiagnosticLease, DiagnosticNode,
    DiagnosticOperation, DiagnosticPage, DiagnosticProbe, DiagnosticRetirement, DiagnosticSlot,
    ForwardDiagnosticReadPort } from '../modules/forward-diagnostic-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlForwardDiagnosticReadStore();

/** Original zero-argument public prototype over one lower SELECT-only implementation. */
export class MySqlForwardDiagnostics implements ForwardDiagnosticReadPort<Transaction> {
    async forward(tx:Transaction,scope:string,id:string):Promise<DiagnosticForward|null> {return store.forward(tx,scope,id);}
    async operations(tx:Transaction,scope:string,id:string):Promise<DiagnosticPage<DiagnosticOperation>> {return store.operations(tx,scope,id);}
    async nodes(tx:Transaction,scope:string,ids:string[]):Promise<DiagnosticNode[]> {return store.nodes(tx,scope,ids);}
    async assignments(tx:Transaction,scope:string,id:string,ids:string[]):Promise<DiagnosticPage<DiagnosticAssignment>> {return store.assignments(tx,scope,id,ids);}
    async deployment(tx:Transaction,scope:string,id:string):Promise<DiagnosticDeployment|null> {return store.deployment(tx,scope,id);}
    async slots(tx:Transaction,scope:string,id:string):Promise<DiagnosticPage<DiagnosticSlot>> {return store.slots(tx,scope,id);}
    async retirements(tx:Transaction,scope:string,id:string):Promise<DiagnosticPage<DiagnosticRetirement>> {return store.retirements(tx,scope,id);}
    async leases(tx:Transaction,scope:string,id:string):Promise<DiagnosticPage<DiagnosticLease>> {return store.leases(tx,scope,id);}
    async probes(tx:Transaction,scope:string,id:string):Promise<DiagnosticPage<DiagnosticProbe>> {return store.probes(tx,scope,id);}
}
