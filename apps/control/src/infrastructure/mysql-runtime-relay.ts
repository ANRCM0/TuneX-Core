import type { Forward } from '@tunex/core';
import type { RuntimeRelayDeployment, RuntimeRelayStore, RuntimeRelayObservations,
    RuntimeRelayNodeView, RuntimeRelayIsolation } from '../framework/public.ts';
import type { NativeRuntimeFamily, NativeRuntimeRelayPlan as RuntimeRelayPlan } from '../compatibility/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlRelayDeploymentStore implements RuntimeRelayStore<Transaction,NativeRuntimeFamily> {
    async quarantine(tx:Transaction,at:number):Promise<void> {
        await write(tx,"UPDATE relay_deployments SET stage='withdrawn',updated_at=?",[at]);
    }
    async latest(tx:Transaction,forwardId:string,lock:boolean):Promise<RuntimeRelayDeployment|undefined> {
        return (await rows<RuntimeRelayDeployment>(tx,`SELECT * FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1${lock?' FOR UPDATE':''}`,[forwardId]))[0];
    }
    forForward(tx:Transaction,forwardId:string):Promise<RuntimeRelayDeployment[]> {
        return rows(tx,'SELECT * FROM relay_deployments WHERE forward_id=?',[forwardId]);
    }
    allDeployments(tx:Transaction):Promise<RuntimeRelayDeployment[]> { return rows(tx,'SELECT * FROM relay_deployments'); }
    forNode(tx:Transaction,nodeId:string):Promise<RuntimeRelayDeployment[]> {
        return rows(tx,'SELECT d.* FROM relay_deployments d WHERE (d.ingress_node_id=? OR d.egress_node_id=? OR JSON_CONTAINS(d.path_nodes,JSON_QUOTE(?))) AND d.generation=(SELECT MAX(generation) FROM relay_deployments WHERE forward_id=d.forward_id) ORDER BY d.forward_id',[nodeId,nodeId,nodeId]);
    }
    async insertRelay(tx:Transaction,forward:Forward,generation:number,plan:RuntimeRelayPlan,createdAt:number,updatedAt:number):Promise<void> {
        await write(tx,'INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',[forward.id,generation,forward.revision,forward.spec.ingress.nodeId,forward.spec.path!.via[0]!,JSON.stringify(plan),createdAt,updatedAt]);
    }
    async insertMultihop(tx:Transaction,forward:Forward,generation:number,plan:RuntimeRelayPlan,createdAt:number,updatedAt:number):Promise<void> {
        await write(tx,'INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,path_nodes,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',[forward.id,generation,forward.revision,plan.path![0]!,plan.path!.at(-1)!,JSON.stringify(plan.path),JSON.stringify(plan),createdAt,updatedAt]);
    }
    async withdraw(tx:Transaction,forwardId:string,generation:number,at:number):Promise<void> {
        await write(tx,"UPDATE relay_deployments SET stage='withdrawn',updated_at=? WHERE forward_id=? AND generation=?",[at,forwardId,generation]);
    }
    async touch(tx:Transaction,forwardId:string,generation:number,at:number):Promise<void> {
        await write(tx,'UPDATE relay_deployments SET updated_at=? WHERE forward_id=? AND generation=?',[at,forwardId,generation]);
    }
    async setStage(tx:Transaction,forwardId:string,generation:number,stage:RuntimeRelayDeployment['stage'],at:number):Promise<void> {
        await write(tx,'UPDATE relay_deployments SET stage=?,updated_at=? WHERE forward_id=? AND generation=?',[stage,at,forwardId,generation]);
    }
    async activate(tx:Transaction,forwardId:string,generation:number,at:number):Promise<void> {
        await write(tx,"UPDATE relay_deployments SET stage='active',updated_at=? WHERE forward_id=? AND generation=?",[at,forwardId,generation]);
    }
    async setPreparation(tx:Transaction,forwardId:string,generation:number,prepared:number,stage:RuntimeRelayDeployment['stage'],activated:number,at:number):Promise<void> {
        await write(tx,'UPDATE relay_deployments SET prepared_count=?,stage=?,activated_count=?,updated_at=? WHERE forward_id=? AND generation=?',[prepared,stage,activated,at,forwardId,generation]);
    }
    async incrementActivation(tx:Transaction,forwardId:string,generation:number,at:number):Promise<void> {
        await write(tx,'UPDATE relay_deployments SET activated_count=activated_count+1,updated_at=? WHERE forward_id=? AND generation=?',[at,forwardId,generation]);
    }
    forwardIDsForNode(tx:Transaction,nodeId:string):Promise<{forward_id:string}[]> {
        return rows(tx,'SELECT DISTINCT forward_id FROM relay_deployments WHERE ingress_node_id=? OR egress_node_id=? OR JSON_CONTAINS(path_nodes,JSON_QUOTE(?)) ORDER BY forward_id',[nodeId,nodeId,nodeId]);
    }
    pendingDeployments(tx:Transaction):Promise<RuntimeRelayDeployment[]> {
        return rows(tx,"SELECT d.* FROM relay_deployments d WHERE d.generation=(SELECT MAX(generation) FROM relay_deployments WHERE forward_id=d.forward_id) AND (d.stage<>'withdrawn' OR EXISTS(SELECT 1 FROM operations o WHERE o.forward_id=d.forward_id AND o.recovery_invalidated=FALSE AND (o.status IN ('accepted','running') OR o.cleanup_pending=TRUE))) ORDER BY d.updated_at,d.forward_id LIMIT 100");
    }
}

/** These original cross-owner reads remain read-only in the same authorized transaction. */
export class MySqlRelayObservations implements RuntimeRelayObservations<Transaction> {
    async nodeSession(tx:Transaction,nodeId:string):Promise<{session_epoch:number}|undefined> {
        return (await rows<{session_epoch:number}>(tx,'SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[nodeId]))[0];
    }
    async runtimeNode(tx:Transaction,nodeId:string):Promise<RuntimeRelayNodeView|undefined> {
        return (await rows<RuntimeRelayNodeView>(tx,'SELECT * FROM runtime_nodes WHERE node_id=?',[nodeId]))[0];
    }
    async snapshot(tx:Transaction,nodeId:string,generation:number,epoch:number):Promise<{body:unknown}|undefined> {
        return (await rows<{body:unknown}>(tx,'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',[nodeId,generation,epoch]))[0];
    }
    async latestSnapshot(tx:Transaction,nodeId:string):Promise<{body:unknown;valid_until:number}|undefined> {
        return (await rows<{body:unknown;valid_until:number}>(tx,'SELECT body,valid_until FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1',[nodeId]))[0];
    }
    async portOwner(tx:Transaction,nodeId:string,port:number):Promise<{owner_id:string|null}|undefined> {
        return (await rows<{owner_id:string|null}>(tx,"SELECT owner_id FROM port_slots WHERE node_id=? AND protocol='tcp' AND port=?",[nodeId,port]))[0];
    }
    isolation(tx:Transaction,forwardId:string):Promise<RuntimeRelayIsolation[]> {
        return rows(tx,'SELECT node_id,assignment_id,binding_fence,removed_epoch FROM retirements WHERE forward_id=? AND safe=FALSE ORDER BY node_id,assignment_id',[forwardId]);
    }
    async pendingRetirementCount(tx:Transaction,forwardId:string):Promise<number> {
        return (await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM retirements WHERE forward_id=? AND safe=FALSE',[forwardId]))[0]!.n;
    }
    async unsafeLeaseCount(tx:Transaction,forwardId:string):Promise<number> {
        return (await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND (r.safe IS NULL OR r.safe=FALSE)',[forwardId]))[0]!.n;
    }
    leaseNodes(tx:Transaction,forwardId:string):Promise<{node_id:string}[]> {
        return rows(tx,'SELECT DISTINCT node_id FROM execution_leases WHERE forward_id=?',[forwardId]);
    }
}
