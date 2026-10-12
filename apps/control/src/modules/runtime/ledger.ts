import { randomUUID } from 'node:crypto';
import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ControlError, notFound } from '../../application/errors.ts';
import { rows, write } from '../../infrastructure/mysql.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
import type { RequestIdentity } from '../idempotency.ts';
import type { ReservedSlot } from './planner.ts';
import { compileDirect,compileSnapshot } from './planner.ts';
import type { AuthorizedNodeFacts } from './planner.ts';
import type { Assignment } from '@tunex/contracts';
import type { Forwarding } from '../forwarding.ts';

export interface Operation {
  id: string; scope_id: string; forward_id: string; target_revision: number;
  status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'superseded';
  execution_deadline: number; claim_token: string | null; claim_until: number | null;
  cleanup_pending: number; last_error: unknown;
}
export class RuntimeLedger {
  async assignments(tx:Transaction,forwarding:Forwarding,facts:AuthorizedNodeFacts,includeAccepted=false):Promise<Assignment[]>{
    const forwards=await forwarding.forNode(tx,facts.nodeId);
    if(!forwards.length)return [];
    const placeholders=forwards.map(()=>'?').join(',');
    const operations=await rows<Operation>(tx,`SELECT * FROM operations WHERE forward_id IN (${placeholders}) ORDER BY id FOR UPDATE`,forwards.map(forward=>forward.id));
    const slots=await rows<{owner_id:string;protocol:'tcp'|'udp';port:number;fence:number;deployment_generation:number}>(tx,'SELECT * FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',[facts.nodeId]);
    const assignments:Assignment[]=[];
    for(const forward of forwards){
      const op=operations.find(op=>op.forward_id===forward.id&&op.target_revision===forward.revision);
      if(!op||!(op.status==='succeeded'||((op.status==='running'||(includeAccepted&&op.status==='accepted'))&&op.execution_deadline>Date.now())))continue;
      const reservations:ReservedSlot[]=slots.filter(slot=>slot.owner_id===forward.id).map(slot=>({nodeId:facts.nodeId,forwardId:forward.id,protocol:slot.protocol,port:slot.port,bindingFence:slot.fence,deploymentGeneration:slot.deployment_generation}));
      assignments.push(...compileDirect(forward,facts,reservations));
    }
    return assignments.sort((a,b)=>a.assignmentId<b.assignmentId?-1:1);
  }
  async assertCapacity(tx:Transaction,forwarding:Forwarding,facts:AuthorizedNodeFacts):Promise<void>{
    const now=Date.now();const assignments=await this.assignments(tx,forwarding,facts,true);
    compileSnapshot({nodeId:facts.nodeId,sessionEpoch:MAX_COUNTER,snapshotGeneration:MAX_COUNTER,issuedAt:new Date(now).toISOString(),validUntil:new Date(now+300000).toISOString(),assignments,tombstones:[]});
  }
  async verifyPublishable(tx:Transaction,assignments:readonly Assignment[]):Promise<void>{
    for(const assignment of assignments){const op=(await rows<Operation>(tx,'SELECT * FROM operations WHERE forward_id=? AND target_revision=? FOR UPDATE',[assignment.forwardId,assignment.forwardRevision]))[0];if(!op||!(op.status==='succeeded'||(op.status==='running'&&op.execution_deadline>Date.now())))throw new ControlError('STALE_CLAIM',409,'Operation expired during compilation');}
  }
  async lockNode(tx:Transaction,nodeId:string):Promise<void>{await rows(tx,'SELECT node_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]);}
  async latest(tx:Transaction,forwardId:string):Promise<Operation|undefined>{return(await rows<Operation>(tx,'SELECT * FROM operations WHERE forward_id=? ORDER BY created_at DESC,id DESC LIMIT 1',[forwardId]))[0];}
  async reserve(tx: Transaction, forward: Forward): Promise<ReservedSlot[]> {
    const slots: ReservedSlot[] = [];
    for (const protocol of [...forward.spec.protocols].sort()) {
      const args = [forward.spec.ingress.nodeId, protocol, forward.spec.ingress.listen.port];
      await write(tx, 'INSERT INTO port_slots(node_id,protocol,port) VALUES(?,?,?) ON DUPLICATE KEY UPDATE port=port', args);
      const record = (await rows<{ owner_id: string | null; fence: number }>(tx, 'SELECT owner_id,fence FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE', args))[0]!;
      if (record.owner_id !== null) throw new ControlError('PORT_RESERVED', 409, 'Listener port is reserved');
      if (record.fence >= MAX_COUNTER) throw new ControlError('RESOURCE_LIMIT', 429, 'Resource counter exhausted');
      await write(tx, 'UPDATE port_slots SET owner_id=?,fence=fence+1,deployment_generation=1 WHERE node_id=? AND protocol=? AND port=?', [forward.id, ...args]);
      slots.push({ nodeId: args[0] as string, forwardId: forward.id, protocol, port: args[2] as number, bindingFence: record.fence+1, deploymentGeneration: 1 });
    }
    const count = (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL', [forward.spec.ingress.nodeId]))[0]!.n;
    if (count > 1000) throw new ControlError('RESOURCE_LIMIT', 429, 'Node assignment capacity exceeded');
    return slots;
  }
  async accept(tx: Transaction, forward: Forward, request: RequestIdentity): Promise<string> {
    const operationId = randomUUID(), now = Date.now();
    await write(tx, "INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline) VALUES(?,?,?,?,'create','accepted',?,?,?,?,?,?)", [operationId, forward.scopeId, forward.id, forward.revision, request.actorId, request.key, request.digest, now, now, now+600000]);
    return operationId;
  }
  async get(tx: Transaction, scope: string, id: string): Promise<Operation> {
    const op = (await rows<Operation>(tx, 'SELECT * FROM operations WHERE id=? AND scope_id=? FOR UPDATE', [id, scope]))[0];
    if (!op) notFound(); return op;
  }
  async claim(tx: Transaction): Promise<Operation | undefined> {
    const now = Date.now();
    await write(tx, "UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE status IN ('accepted','running') AND execution_deadline<=?", [JSON.stringify({ code: 'EXECUTION_DEADLINE', retryable: false }), now, now]);
    const op = (await rows<Operation>(tx, "SELECT * FROM operations WHERE status IN ('accepted','running') AND (claim_until IS NULL OR claim_until<=?) AND execution_deadline>? ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED", [now, now]))[0];
    if (!op) return undefined;
    const token = randomUUID();
    await write(tx, "UPDATE operations SET status='running',claim_token=?,claim_until=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?", [token, now+15000, now, op.id]);
    return { ...op, status: 'running', claim_token: token, claim_until: now+15000 };
  }
}
