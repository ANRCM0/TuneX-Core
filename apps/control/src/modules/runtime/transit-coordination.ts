import { isCounter, MAX_COUNTER } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { ControlError } from '../../application/errors.ts';
import type { MySqlUnitOfWork, Transaction } from '../../infrastructure/mysql.ts';
import { json, rows, write } from '../../infrastructure/mysql.ts';
import { verifyTransitStage } from './transit-staging.ts';
import type { TransitStageRow } from './transit-staging.ts';
import type { HopBinding, TransitPreparation } from './transit-preparation.ts';

/**
 * Offline-only durable orchestration plan. It does not publish any ADP/3
 * Snapshot, call Agent HTTP, grant a lease, or activate a real listener.
 *
 * No production Control service constructs this coordinator. Observation
 * verification is a required, external authenticated integration boundary.
 */
export type TransitCoordinationPhase =
  'preparing' | 'activating' | 'compensating' | 'sealed' | 'quarantined';
export type TransitCommandAction = 'prepare' | 'activate' | 'withdraw';
export interface OfflineTransitCommand {
  readonly kind: 'offline-transit-command-v1';
  readonly action: TransitCommandAction;
  readonly forwardId: string;
  readonly generation: number;
  readonly planDigest: string;
  readonly nodeId: string;
  readonly revision: number;
  readonly assignments: readonly {
    readonly assignmentId: string;
    readonly protocol: 'tcp' | 'udp';
    readonly sessionEpoch: number;
    readonly bindingFence: number;
    readonly physicalProtocol: 'tcp' | 'udp';
    readonly port: number;
  }[];
  readonly commandDigest: string;
}
export interface TransitObservationProof {
  readonly commandDigest: string;
  readonly nodeId: string;
  readonly action: TransitCommandAction;
  readonly reportSequence: number;
  readonly receivedAt: number;
  readonly assignments: readonly {
    readonly assignmentId: string;
    readonly sessionEpoch: number;
    readonly bindingFence: number;
    readonly deploymentGeneration: number;
    readonly condition: 'prepared' | 'ready' | 'removed';
  }[];
}
/** The caller must authenticate the source/report and check current Control authority.
 * There is no default verifier and no production call site in this batch.
 */
export type TransitProofVerifier = (proof: TransitObservationProof) => Promise<boolean>;

interface CoordinationBody {
  forwardId: string;
  generation: number;
  planDigest: string;
  phase: TransitCoordinationPhase;
  position: number;
  revision: number;
  receiptHighwater: Record<string, number>;
}
interface CoordinationRow {
  forward_id: string;
  generation: number;
  plan_digest: string;
  phase: TransitCoordinationPhase;
  position: number;
  revision: number;
  receipt_highwater: unknown;
  journal_digest: string;
  created_at: number;
  updated_at: number;
}
const phases = new Set<TransitCoordinationPhase>([
  'preparing', 'activating', 'compensating', 'sealed', 'quarantined',
]);
function reject(code: string, message: string): never {
  throw new ControlError(code,409,message);
}
function bodyOf(row: CoordinationRow, plan: TransitPreparation): CoordinationBody {
  const receiptHighwater = json<Record<string, number>>(row.receipt_highwater);
  const body: CoordinationBody = {
    forwardId: row.forward_id, generation: row.generation,
    planDigest: row.plan_digest, phase: row.phase,
    position: row.position, revision: row.revision, receiptHighwater,
  };
  if (!phases.has(row.phase) || !isCounter(row.revision) ||
      !Number.isSafeInteger(row.position) || row.position < 0 ||
      row.plan_digest !== plan.planDigest ||
      row.forward_id !== plan.forwardId ||
      row.generation !== plan.deploymentGeneration ||
      !receiptHighwater || Array.isArray(receiptHighwater) ||
      typeof receiptHighwater !== 'object' ||
      Object.entries(receiptHighwater).some(([nodeId, sequence]) =>
        !plan.activationOrder.includes(nodeId) || !isCounter(sequence)) ||
      (row.phase === 'sealed' || row.phase === 'quarantined'
        ? row.position !== plan.activationOrder.length
        : row.position >= plan.activationOrder.length) ||
      digest(body) !== row.journal_digest)
    reject('INTEGRITY_FAILURE', 'Transit coordination journal integrity differs');
  return body;
}
export function offlineTransitStep(
  plan: TransitPreparation, body: CoordinationBody,
): OfflineTransitCommand | null {
  if (body.phase === 'sealed' || body.phase === 'quarantined') return null;
  const order = body.phase === 'compensating'
    ? [...plan.activationOrder].reverse() : plan.activationOrder;
  const nodeId = order[body.position];
  if (!nodeId) reject('INTEGRITY_FAILURE', 'Missing Transit coordination step');
  const action: TransitCommandAction = body.phase === 'preparing'
    ? 'prepare' : body.phase === 'activating' ? 'activate' : 'withdraw';
  const assignments = plan.assignments.filter(a => a.nodeId === nodeId)
    .map((a: HopBinding) => ({
      assignmentId: a.assignmentId, protocol: a.protocol,
      sessionEpoch: a.sessionEpoch, bindingFence: a.bindingFence,
      physicalProtocol: a.resource.physicalProtocol, port: a.resource.port,
    })).sort((a,b) => a.assignmentId.localeCompare(b.assignmentId));
  if (!assignments.length) reject('INTEGRITY_FAILURE', 'Transit Node lacks resource bindings');
  const command = {
    kind: 'offline-transit-command-v1' as const,
    action, forwardId: plan.forwardId, generation: plan.deploymentGeneration,
    planDigest: plan.planDigest, nodeId, revision: body.revision, assignments,
  };
  return {...command,commandDigest:digest(command)};
}
function checkProof(command: OfflineTransitCommand, proof: TransitObservationProof,
  highwater: Record<string, number>, now: number): void {
  if (proof.nodeId !== command.nodeId || proof.action !== command.action ||
      proof.commandDigest !== command.commandDigest ||
      !isCounter(proof.reportSequence) ||
      proof.reportSequence <= (highwater[proof.nodeId] ?? 0) ||
      !Number.isSafeInteger(proof.receivedAt) ||
      proof.receivedAt > now + 5000 || now - proof.receivedAt > 30000 ||
      proof.assignments.length !== command.assignments.length)
    reject('FENCING_REJECTED', 'Transit observation not bound to pending command');
  const expectedCondition = command.action === 'prepare' ? 'prepared'
    : command.action === 'activate' ? 'ready' : 'removed';
  const reported = new Set<string>();
  for (const observation of proof.assignments) {
    const expected = command.assignments.find(a => a.assignmentId === observation.assignmentId);
    if (!expected || reported.has(observation.assignmentId) ||
        observation.sessionEpoch !== expected.sessionEpoch ||
        observation.bindingFence !== expected.bindingFence ||
        observation.deploymentGeneration !== command.generation ||
        observation.condition !== expectedCondition)
      reject('FENCING_REJECTED', 'Transit observation identity/Fence/condition differs');
    reported.add(observation.assignmentId);
  }
}
export class TransitCoordinationJournal {
  private readonly db: MySqlUnitOfWork;
  constructor(db: MySqlUnitOfWork) { this.db=db; }

  private async stage(tx: Transaction, actor: string, scopeId: string,
    forwardId: string, generation: number): Promise<{row: TransitStageRow; plan: TransitPreparation}> {
    if (!isCounter(generation)) reject('INVALID_CONFIG', 'Transit generation required');
    const row = (await rows<TransitStageRow>(tx,
      'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? AND scope_id=? FOR UPDATE',
      [forwardId,generation,scopeId]))[0];
    if (!row) throw new ControlError('NOT_FOUND',404,'Transit staging proposal not found');
    if (row.created_by !== actor)
      throw new ControlError('AUTHORIZATION_DENIED',403,'Only original Transit actor may coordinate');
    const plan = verifyTransitStage(row);
    if (row.state !== 'reserved')
      reject('FENCING_REJECTED', 'Aborted Transit stage cannot be coordinated');
    return {row,plan};
  }

  /** Refuse any proposal whose current per-Node sessions or physical Fences differ.
   * Every future publication must repeat these checks under the same locks.
   */
  private async ownership(tx: Transaction, plan: TransitPreparation): Promise<void> {
    for (const nodeId of [...new Set(plan.assignments.map(a => a.nodeId))].sort()) {
      const runtime = (await rows<{session_epoch:number}>(tx,
        'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]))[0];
      if (!runtime || plan.assignments.some(a =>
        a.nodeId === nodeId && a.sessionEpoch !== runtime.session_epoch))
        reject('SESSION_SUPERSEDED', 'Transit Node session changed since staging');
    }
    for (const a of [...plan.assignments].sort((x,y)=>
      x.nodeId.localeCompare(y.nodeId) ||
      x.resource.physicalProtocol.localeCompare(y.resource.physicalProtocol) ||
      x.resource.port-y.resource.port)) {
      const slot = (await rows<{owner_id:string|null; fence:number; deployment_generation:number}>(tx,
        'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',
        [a.nodeId,a.resource.physicalProtocol,a.resource.port]))[0];
      if (!slot || slot.owner_id !== plan.forwardId ||
          slot.fence !== a.bindingFence ||
          slot.deployment_generation !== plan.deploymentGeneration)
        reject('FENCING_REJECTED', 'Transit physical port owner/Fence no longer matches staging');
    }
  }
  private async locked(tx: Transaction, forwardId: string, generation: number,
    plan: TransitPreparation): Promise<{row: CoordinationRow; body: CoordinationBody}> {
    const row = (await rows<CoordinationRow>(tx,
      'SELECT * FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',
      [forwardId,generation]))[0];
    if (!row) throw new ControlError('NOT_FOUND',404,'Transit coordination not started');
    return {row,body:bodyOf(row,plan)};
  }
  private async persist(tx: Transaction,row: CoordinationRow,body: CoordinationBody,
    changed: Pick<CoordinationBody,'phase'|'position'|'receiptHighwater'>):Promise<CoordinationBody> {
    if (body.revision >= MAX_COUNTER) throw new ControlError('RESOURCE_LIMIT',429,'Transit journal revision exhausted');
    const next:CoordinationBody = {
      ...body, phase: changed.phase, position: changed.position,
      receiptHighwater: changed.receiptHighwater,revision:body.revision+1,
    };
    const updated = await write(tx,
      'UPDATE transit_coordination SET phase=?,position=?,revision=?,receipt_highwater=?,journal_digest=?,updated_at=? WHERE forward_id=? AND generation=? AND revision=? AND journal_digest=?',
      [next.phase,next.position,next.revision,JSON.stringify(next.receiptHighwater),
        digest(next),Date.now(),row.forward_id,row.generation,body.revision,row.journal_digest]);
    if (updated !== 1) reject('FENCING_REJECTED','Concurrent Transit coordination writer');
    return next;
  }
  private fresh(stage: TransitStageRow, plan: TransitPreparation):void {
    const now=Date.now();
    if (stage.expires_at<=now+5000 || plan.authorizationUntil<=now+5000)
      reject('LEASE_EXPIRED','Transit stage must have a current authorization window');
  }

  /** Allocates no listener, operation lease, or executable Snapshot. */
  async begin(actor:string,scopeId:string,forwardId:string,generation:number)
    :Promise<OfflineTransitCommand> {
    return this.db.transaction(async tx=>{
      const {row,plan}=await this.stage(tx,actor,scopeId,forwardId,generation);
      this.fresh(row,plan);
      await this.ownership(tx,plan);
      const previous=(await rows<CoordinationRow>(tx,
        'SELECT * FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',
        [forwardId,generation]))[0];
      if (previous) reject('RESOURCE_CONFLICT','Transit coordination already started');
      const body:CoordinationBody={
        forwardId,generation,planDigest:plan.planDigest,phase:'preparing',
        position:0,revision:1,receiptHighwater:{},
      };
      await write(tx,'INSERT INTO transit_coordination(forward_id,generation,plan_digest,phase,position,revision,receipt_highwater,journal_digest,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [forwardId,generation,plan.planDigest,body.phase,0,1,'{}',digest(body),Date.now(),Date.now()]);
      return offlineTransitStep(plan,body)!;
    });
  }
  /** Read-only deterministic planned step, never an actual outgoing Agent command. */
  async peek(actor:string,scopeId:string,forwardId:string,generation:number)
    :Promise<OfflineTransitCommand|null> {
    return this.db.transaction(async tx=>{
      const {row,plan}=await this.stage(tx,actor,scopeId,forwardId,generation);
      const {body}=await this.locked(tx,forwardId,generation,plan);
      if (body.phase==='preparing'||body.phase==='activating') {
        this.fresh(row,plan);
        await this.ownership(tx,plan);
      }
      return offlineTransitStep(plan,body);
    });
  }
  /** A verified ADP/3 observation is NOT available yet. This boundary is
   * intentionally uncalled in production; a test-only verifier can simulate it.
   */
  async confirm(actor:string,scopeId:string,forwardId:string,generation:number,
    proof:TransitObservationProof,verify:TransitProofVerifier)
    :Promise<OfflineTransitCommand|null> {
    if (typeof verify!=='function')
      throw new ControlError('AUTHORIZATION_DENIED',403,'Authenticated Transit report verifier required');
    return this.db.transaction(async tx=>{
      const {row,plan}=await this.stage(tx,actor,scopeId,forwardId,generation);
      const {row:current,body}=await this.locked(tx,forwardId,generation,plan);
      if (body.phase==='preparing'||body.phase==='activating') {
        this.fresh(row,plan);
        await this.ownership(tx,plan);
      }
      const command=offlineTransitStep(plan,body);
      if (!command) reject('FENCING_REJECTED','Terminal Transit journal cannot accept observations');
      checkProof(command,proof,body.receiptHighwater,Date.now());
      if (!await verify(proof))
        throw new ControlError('AUTHORIZATION_DENIED',403,'Transit report proof not authenticated');
      const newHighwater={...body.receiptHighwater,[proof.nodeId]:proof.reportSequence};
      const size=plan.activationOrder.length;
      const done=body.position+1===size;
      const phase=done?(body.phase==='preparing'?'activating':
        body.phase==='activating'?'sealed':'quarantined'):body.phase;
      const position=done?(phase==='sealed'||phase==='quarantined'?size:0):body.position+1;
      const next=await this.persist(tx,current,body,{phase,position,receiptHighwater:newHighwater});
      return offlineTransitStep(plan,next);
    });
  }
  /** On any uncertain remote result, plan withdrawal ingress-first and leave
   * all physical reservations in place pending explicit lease/revocation proof.
   */
  async fail(actor:string,scopeId:string,forwardId:string,generation:number)
    :Promise<OfflineTransitCommand|null> {
    return this.db.transaction(async tx=>{
      const {plan}=await this.stage(tx,actor,scopeId,forwardId,generation);
      const {row,body}=await this.locked(tx,forwardId,generation,plan);
      if (body.phase==='quarantined') return null;
      if (body.phase==='compensating')return offlineTransitStep(plan,body);
      const next=await this.persist(tx,row,body,{
        phase:'compensating',position:0,receiptHighwater:body.receiptHighwater,
      });
      return offlineTransitStep(plan,next);
    });
  }
  /** Crash recovery changes unfinished journals to withdrawal-only mode.
   * It never issues an Agent request and never releases a physical port.
   */
  async quarantineRecovery():Promise<number> {
    return this.db.transaction(async tx=>{
      const pending=await rows<CoordinationRow>(tx,
        "SELECT * FROM transit_coordination WHERE phase IN ('preparing','activating','sealed') ORDER BY forward_id,generation FOR UPDATE");
      for (const row of pending) {
        const stage=(await rows<TransitStageRow>(tx,
          'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? FOR UPDATE',
          [row.forward_id,row.generation]))[0];
        if (!stage) reject('INTEGRITY_FAILURE','Transit coordination stage disappeared');
        const plan=verifyTransitStage(stage);
        const current=bodyOf(row,plan);
        await this.persist(tx,row,current,{
          phase:'compensating',position:0,receiptHighwater:current.receiptHighwater,
        });
      }
      return pending.length;
    });
  }
}
