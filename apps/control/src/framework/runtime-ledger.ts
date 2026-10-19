import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import type { RuntimeValueFamily, RuntimeAssignmentFor as Assignment, RuntimeSnapshotFor as Snapshot, RuntimeTombstoneValue as Tombstone, RuntimeReportRequestFor as ReportRequest } from '@tunex/contracts/execution-values';
import type { Policy } from '@tunex/contracts/policy';
import { ControlError, notFound } from './errors.ts';
import type { RequestIdentity } from './application-ports.ts';
import type { AuthorizedNodeFacts } from './node-facts.ts';
import type { RuntimeLedgerAuthorization, RuntimeLedgerCompiler, RuntimeLedgerForwards, RuntimeLedgerOptions,
    RuntimeLedgerStore, RuntimeOperation as Operation } from './runtime-ledger-ports.ts';
import type { SnapshotAssignmentCollector } from './runtime-assignment-ports.ts';
import type { ReservedSlot, RelayResource, ReservedRelayResource, RuntimeResourceAccess, RuntimeSlotKey } from './runtime-resource-ports.ts';



/** One ledger's coordination logic, with caller-owned transactions and injected I/O. */
export class RuntimeLedgerHost<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    private readonly policy:Policy;
    private readonly authorization:RuntimeLedgerAuthorization<Tx>|undefined;
    private readonly assignmentSources:SnapshotAssignmentCollector<Tx,F>;
    private readonly resources:RuntimeResourceAccess<Tx>;
    private readonly store:RuntimeLedgerStore<Tx,F>;
    private readonly compiler:RuntimeLedgerCompiler<F>;
    private readonly now:()=>number;
    private readonly newID:()=>string;

    constructor(options:RuntimeLedgerOptions<Tx,F>) {
        if(!options.assignments||typeof options.assignments.merge!=='function')throw new Error('Snapshot assignment collector is required');
        if(typeof options.compiler?.parseTime!=='function'||typeof options.compiler?.formatTime!=='function')
            throw new Error('Runtime ledger time codec is required');
        this.policy={...options.policy};this.authorization=options.authorization;this.assignmentSources=options.assignments;
        this.resources=options.resources;this.store=options.store;this.compiler=options.compiler;this.now=options.now;this.newID=options.newID;
    }
    async quarantineRecovery(tx:Tx):Promise<void> {
        const previous=await this.store.beginQuarantine(tx);
        for(const row of previous) {
            const snapshot=this.compiler.decodeSnapshot(row.body);
            for(const assignment of snapshot.assignments) {
                const operation=await this.latest(tx,assignment.forwardId);
                if(operation)await this.store.quarantineRetirement(tx,row.node_id,assignment,operation.id,Math.min(MAX_COUNTER,row.generation+1));
            }
        }
    }
    async assignments(tx:Tx,forwarding:RuntimeLedgerForwards<Tx>,facts:AuthorizedNodeFacts,includeAccepted=false):Promise<Assignment<F>[]> {
        const forwards=(await forwarding.forNode(tx,facts.nodeId)).filter(forward=>!forward.spec.path);
        if(!forwards.length)return this.assignmentSources.merge(tx,{nodeId:facts.nodeId,includeAccepted},[]);
        const operations=await this.store.assignmentOperations(tx,forwards.map(forward=>forward.id));
        const slots=await this.store.assignmentSlots(tx,facts.nodeId);
        const assignments:Assignment<F>[]=[];
        for(const forward of forwards) {
            const op=operations.find(op=>op.forward_id===forward.id&&op.target_revision===forward.revision);
            if(!op||op.recovery_invalidated||!(op.status==='succeeded'||((op.status==='running'||(includeAccepted&&op.status==='accepted'))&&op.execution_deadline>this.now())))continue;
            if(!forward.spec.enabled)continue;
            if(op.kind==='revoke')continue;
            const sourceActor=await forwarding.authorizer(tx,forward.id);
            if(!sourceActor||!this.authorization||!await this.authorization.canExecute(tx,sourceActor,forward))continue;
            if(!facts.allowedListenerAddresses.includes(forward.spec.ingress.listen.address)||!facts.allowedPorts.includes(forward.spec.ingress.listen.port)||!this.compiler.targetAllowed(forward.spec.target.host,facts))continue;
            const reservations:ReservedSlot[]=slots.filter(slot=>slot.owner_id===forward.id).map(slot=>({nodeId:facts.nodeId,forwardId:forward.id,protocol:slot.protocol,port:slot.port,bindingFence:slot.fence,deploymentGeneration:slot.deployment_generation}));
            assignments.push(...this.compiler.direct(forward,facts,reservations.filter(slot=>slot.port===forward.spec.ingress.listen.port)));
        }
        return this.assignmentSources.merge(tx,{nodeId:facts.nodeId,includeAccepted},assignments);
    }
    async assertCapacity(tx:Tx,forwarding:RuntimeLedgerForwards<Tx>,facts:AuthorizedNodeFacts):Promise<void> {
        const now=this.now();
        const assignments=await this.assignments(tx,forwarding,facts,true);
        const tombstones=await this.tombstones(tx,facts.nodeId,MAX_COUNTER);
        const previousRow=await this.store.latestSnapshot(tx,facts.nodeId);
        for(const old of previousRow?this.compiler.decodeSnapshot(previousRow.body).assignments:[]) {
            if(!assignments.some(a=>a.assignmentId===old.assignmentId&&a.deploymentGeneration===old.deploymentGeneration&&a.bindingFence===old.bindingFence)&&!tombstones.some(t=>t.assignmentId===old.assignmentId&&t.bindingFence===old.bindingFence&&t.port===old.resource.port&&t.protocol===old.protocol))
                tombstones.push({assignmentId:old.assignmentId,forwardId:old.forwardId,role:old.role,protocol:old.protocol,physicalProtocol:old.resource.protocol,port:old.resource.port,bindingFence:old.bindingFence,retirementGeneration:MAX_COUNTER});
        }
        const runtime=await this.store.nodeSession(tx,facts.nodeId);
        this.compiler.snapshot({nodeId:facts.nodeId,sessionEpoch:runtime?.session_epoch||MAX_COUNTER,snapshotGeneration:MAX_COUNTER,issuedAt:this.compiler.formatTime(now),validUntil:this.compiler.formatTime(now+this.policy.leaseSeconds*1000),assignments,tombstones,policy:this.policy});
    }
    async verifyPublishable(tx:Tx,assignments:readonly Assignment<F>[]):Promise<void> {
        for(const assignment of assignments) {
            const op=await this.store.operationForRevision(tx,assignment.forwardId,assignment.forwardRevision);
            if(!op||op.recovery_invalidated||!(op.status==='succeeded'||(op.status==='running'&&op.execution_deadline>this.now())))
                throw new ControlError('STALE_CLAIM',409,'Operation expired during compilation');
        }
    }
    initializeNode(tx:Tx,nodeId:string):Promise<void> { return this.resources.initializeNode(tx,nodeId); }
    lockNode(tx:Tx,nodeId:string,epoch?:number):Promise<void> { return this.resources.lockNode(tx,nodeId,epoch); }
    maximumAuthorization(tx:Tx,nodeId:string):Promise<number|null> { return this.resources.maximumAuthorization(tx,nodeId); }
    latest(tx:Tx,forwardId:string):Promise<Operation|undefined> { return this.store.latestOperation(tx,forwardId); }
    reserve(tx:Tx,forward:Forward):Promise<ReservedSlot[]> { return this.resources.reserve(tx,forward); }
    reserveRelay(tx:Tx,forward:Forward,resources:readonly RelayResource[],generation:number):Promise<ReservedRelayResource[]> {
        return this.resources.reserveRelay(tx,forward,resources,generation);
    }
    transition(tx:Tx,current:Forward,next:Forward):Promise<ReservedSlot[]> { return this.resources.transition(tx,current,next); }
    releaseForwardSlots(tx:Tx,forwardId:string):Promise<void> { return this.resources.releaseForwardSlots(tx,forwardId); }
    retainSlots(tx:Tx,forwardId:string,desired:readonly RuntimeSlotKey[]):Promise<void> { return this.resources.retainSlots(tx,forwardId,desired); }
    recordRelayError(tx:Tx,operationId:string,error:unknown):Promise<void> { return this.store.recordRelayError(tx,operationId,error,this.now()); }
    failRelayOperation(tx:Tx,operationId:string,error:unknown):Promise<void> { return this.store.failRelayOperation(tx,operationId,error,this.now()); }
    succeedRelayOperation(tx:Tx,operationId:string):Promise<void> { return this.store.succeedRelayOperation(tx,operationId,this.now(),this.now()); }
    clearTerminalRelayCleanup(tx:Tx,forwardId:string):Promise<void> { return this.store.clearTerminalRelayCleanup(tx,forwardId,this.now()); }
    denyIntent(tx:Tx,operationId:string):Promise<void> { return this.store.denyIntent(tx,operationId,this.now()); }
    async accept(tx:Tx,forward:Forward,request:RequestIdentity,kind:Operation['kind']='create',previousSpec:unknown=null,sourceOperationId:string|null=null):Promise<string> {
        const operationId=this.newID(),prior=await this.latest(tx,forward.id),now=Math.max(this.now(),(prior?.created_at??0)+1);
        await this.store.acceptOperation(tx,{id:operationId,forward,request,kind,at:now,executionDeadline:now+600000,sourceOperationId,previousSpec});
        return operationId;
    }
    async retireChanged(tx:Tx,nodeId:string,previous:Snapshot<F>|undefined,next:readonly Assignment<F>[],generation:number):Promise<void> {
        for(const old of previous?.assignments??[]) {
            if(next.some(a=>a.assignmentId===old.assignmentId&&a.deploymentGeneration===old.deploymentGeneration&&a.bindingFence===old.bindingFence))continue;
            const operation=await this.latest(tx,old.forwardId);
            if(!operation)throw new Error('Missing retirement owner');
            await this.store.retireAssignment(tx,nodeId,old,operation.id,generation);
        }
    }
    recordLeases(tx:Tx,snapshot:Snapshot<F>):Promise<void> { return this.store.recordLeases(tx,snapshot); }
    async previousLeasesSafe(tx:Tx,forwardId:string,desired:readonly {nodeId:string;assignments:readonly Assignment<F>[]}[]):Promise<boolean> {
        const current=new Set(desired.flatMap(node=>node.assignments.map(a=>`${node.nodeId}/${a.assignmentId}/${a.deploymentGeneration}/${a.bindingFence}`)));
        const leases=await this.store.previousUnsafeLeases(tx,forwardId,this.now());
        return leases.every(l=>current.has(`${l.node_id}/${l.assignment_id}/${l.deployment_generation}/${l.binding_fence}`));
    }
    async sessionAuthoritySafe(tx:Tx,nodeId:string,epoch:number):Promise<boolean> {
        return await this.store.unsafeSessionLeaseCount(tx,nodeId,epoch,this.now())===0;
    }
    async tombstones(tx:Tx,nodeId:string,generation:number):Promise<Tombstone[]> {
        const retired=await this.store.retirements(tx,nodeId);
        return retired.map(r=>{const a=this.compiler.decodeAssignment(r.body);return {assignmentId:a.assignmentId,forwardId:a.forwardId,role:a.role,protocol:a.protocol,physicalProtocol:a.resource.protocol,port:a.resource.port,bindingFence:a.bindingFence,retirementGeneration:Math.min(r.retirement_generation,generation)};}).sort((a,b)=>(a.physicalProtocol<b.physicalProtocol?-1:a.physicalProtocol>b.physicalProtocol?1:0)||a.port-b.port||a.retirementGeneration-b.retirementGeneration||(a.assignmentId<b.assignmentId?-1:a.assignmentId>b.assignmentId?1:0));
    }
    async observeDrains(tx:Tx,nodeId:string,epoch:number,report:ReportRequest<F>):Promise<void> {
        for(const drain of report.drains) {
            const key={node_id:nodeId,assignment_id:drain.assignmentId,deployment_generation:drain.deploymentGeneration,binding_fence:drain.bindingFence};
            const record=await this.store.retirement(tx,key);
            if(!record||record.retirement_generation>report.acceptedSnapshotGeneration)throw new ControlError('FENCING_REJECTED',409,'Unknown or unaccepted draining instance');
            const lease=await this.store.instanceLease(tx,key,epoch);
            if(drain.condition==='draining'&&(!lease?.until||this.compiler.parseTime(drain.deadline)>lease.until))throw new ControlError('LEASE_EXPIRED',409,'Drain exceeds its execution authorization');
            if(drain.condition==='removed'&&drain.remainingConnections===0)await this.store.markRemoved(tx,key,epoch);
        }
    }
    async complete(tx:Tx,nodeId:string,forwarding:RuntimeLedgerForwards<Tx>,report?:ReportRequest<F>,snapshot?:Snapshot<F>):Promise<void> {
        const authoritative=await this.store.latestSnapshot(tx,nodeId);
        const retired=await this.store.unsafeRetirementsForUpdate(tx,nodeId);
        for(const r of retired) {
            const outstanding=await this.store.outstandingRetirementLeases(tx,r,this.now());
            if(outstanding===0)await this.store.markRetirementSafe(tx,r);
        }
        // Preserve Node -> Operation order; the Forward intent read must not acquire its lock.
        const operations=await this.store.completionOperations(tx,nodeId);
        for(const op of operations) {
            const forward=await forwarding.record(tx,op.scope_id,op.forward_id);
            if(forward.spec.path)continue;
            const pending=await this.store.pendingRetirementCount(tx,op.forward_id);
            if(pending!==0)continue;
            const stopped=forward.deleting||!forward.spec.enabled||op.kind==='revoke';
            const currentReady=Boolean(report&&snapshot&&op.execution_deadline>this.now()&&this.compiler.parseTime(snapshot.validUntil)>this.now()+5000&&forward.spec.protocols.every(protocol=>{const a=snapshot.assignments.find(a=>a.forwardId===forward.id&&a.forwardRevision===forward.revision&&a.protocol===protocol);return a&&report.observations.some(o=>o.assignmentId===a.assignmentId&&o.deploymentGeneration===a.deploymentGeneration&&o.bindingFence===a.bindingFence&&o.phase==='active'&&o.condition==='ready');}));
            const latest=authoritative?this.compiler.decodeSnapshot(authoritative.body):undefined;
            const noCurrentAssignment=Boolean(latest&&!latest.assignments.some(a=>a.forwardId===forward.id));
            const unsafe=await this.store.unsafeLeaseCount(tx,forward.id);
            if(stopped&&noCurrentAssignment&&unsafe===0) {
                if(forward.deleting)await this.releaseForwardSlots(tx,forward.id);
                else await this.resources.releaseObsoleteSlots(tx,forward);
                await this.store.completeOperation(tx,op.id,this.now(),false);
                await this.store.clearFailedSupersededCleanup(tx,forward.id);
            } else if(op.status==='failed'&&noCurrentAssignment&&unsafe===0) {
                await this.resources.releaseObsoleteSlots(tx,forward);
                await this.store.clearOperationCleanup(tx,op.id,this.now());
            } else if(!stopped&&currentReady) {
                if(!await this.previousLeasesSafe(tx,forward.id,[{nodeId,assignments:snapshot!.assignments.filter(a=>a.forwardId===forward.id)}]))continue;
                await this.resources.releaseObsoleteSlots(tx,forward);
                await this.store.completeOperation(tx,op.id,this.now(),true);
                await this.store.clearFailedSupersededCleanup(tx,forward.id);
            }
        }
    }
    async get(tx:Tx,scope:string,id:string):Promise<Operation> {
        const op=await this.store.getOperation(tx,scope,id,true);
        if(!op)notFound();
        return op;
    }
    async read(tx:Tx,scope:string,id:string):Promise<Operation> {
        const op=await this.store.getOperation(tx,scope,id,false);
        if(!op)notFound();
        return op;
    }
    async claim(tx:Tx):Promise<Operation|undefined> {
        const now=this.now();
        await this.store.expireOperations(tx,now);
        const op=await this.store.claimableOperation(tx,now);
        if(!op)return undefined;
        const token=this.newID();
        await this.store.claimOperation(tx,op.id,token,now,now+15000);
        return {...op,status:'running',claim_token:token,claim_until:now+15000};
    }
}
