import { isCounter, MAX_COUNTER } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { TransactionBoundary, TransitCoordinationStorage, TransitStoredCoordination, TransitStoredStage } from '../../framework/public.ts';
import { nativeValueDigest as digest, readStoredValue as json, nativeJsonEncode, nativeWallClockNow } from '../../compatibility/public.ts';
import { verifyTransitStage } from './stage-values.ts';
import { offlineTransitStep } from './coordination-step.ts';
import type { TransitPreparation } from './preparation-contracts.ts';
import type { TransitCoordinationPhase, OfflineTransitCommand, TransitObservationProof, TransitProofVerifier, TransitCoordinationBody as CoordinationBody } from './coordination-contracts.ts';

type CoordinationRow = TransitStoredCoordination<TransitCoordinationPhase>;
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

/** Offline planned steps only; never publishes, grants a lease or releases a port. */
export class TransitCoordinationService<Tx> {
  private readonly db: TransactionBoundary<Tx>;
  private readonly store: TransitCoordinationStorage<Tx,TransitCoordinationPhase>;
  constructor(db: TransactionBoundary<Tx>,store: TransitCoordinationStorage<Tx,TransitCoordinationPhase>) {
    this.db=db;this.store=store;
  }

  private async stage(tx: Tx, actor: string, scopeId: string,
    forwardId: string, generation: number): Promise<{row: TransitStoredStage; plan: TransitPreparation}> {
    if (!isCounter(generation)) reject('INVALID_CONFIG', 'Transit generation required');
    const row = await this.store.stage(tx,scopeId,forwardId,generation);
    if (!row) throw new ControlError('NOT_FOUND',404,'Transit staging proposal not found');
    if (row.created_by !== actor)
      throw new ControlError('AUTHORIZATION_DENIED',403,'Only original Transit actor may coordinate');
    const plan = verifyTransitStage(row);
    if (row.state !== 'reserved')
      reject('FENCING_REJECTED', 'Aborted Transit stage cannot be coordinated');
    return {row,plan};
  }

  /** Repeat the original per-Node session and physical ownership checks under locks. */
  private async ownership(tx: Tx, plan: TransitPreparation): Promise<void> {
    for (const nodeId of [...new Set(plan.assignments.map(a => a.nodeId))].sort()) {
      const runtime = await this.store.session(tx,nodeId);
      if (!runtime || plan.assignments.some(a =>
        a.nodeId === nodeId && a.sessionEpoch !== runtime.session_epoch))
        reject('SESSION_SUPERSEDED', 'Transit Node session changed since staging');
    }
    for (const a of [...plan.assignments].sort((x,y)=>
      x.nodeId.localeCompare(y.nodeId) ||
      x.resource.physicalProtocol.localeCompare(y.resource.physicalProtocol) ||
      x.resource.port-y.resource.port)) {
      const slot = await this.store.slot(tx,a.nodeId,a.resource.physicalProtocol,a.resource.port);
      if (!slot || slot.owner_id !== plan.forwardId ||
          slot.fence !== a.bindingFence ||
          slot.deployment_generation !== plan.deploymentGeneration)
        reject('FENCING_REJECTED', 'Transit physical port owner/Fence no longer matches staging');
    }
  }
  private async locked(tx: Tx, forwardId: string, generation: number,
    plan: TransitPreparation): Promise<{row: CoordinationRow; body: CoordinationBody}> {
    const row = await this.store.journal(tx,forwardId,generation);
    if (!row) throw new ControlError('NOT_FOUND',404,'Transit coordination not started');
    return {row,body:bodyOf(row,plan)};
  }
  private async persist(tx: Tx,row: CoordinationRow,body: CoordinationBody,
    changed: Pick<CoordinationBody,'phase'|'position'|'receiptHighwater'>):Promise<CoordinationBody> {
    if (body.revision >= MAX_COUNTER) throw new ControlError('RESOURCE_LIMIT',429,'Transit journal revision exhausted');
    const next:CoordinationBody = {
      ...body, phase: changed.phase, position: changed.position,
      receiptHighwater: changed.receiptHighwater,revision:body.revision+1,
    };
    // Keep encoding before digest/time, as in the original SQL argument evaluation.
    const updated = await this.store.update(tx,{
      phase:next.phase,position:next.position,revision:next.revision,
      receipt_highwater:nativeJsonEncode(next.receiptHighwater),
      journal_digest:digest(next),updated_at:nativeWallClockNow(),
      forward_id:row.forward_id,generation:row.generation,
      previous_revision:body.revision,previous_journal_digest:row.journal_digest,
    });
    if (updated !== 1) reject('FENCING_REJECTED','Concurrent Transit coordination writer');
    return next;
  }
  private fresh(stage: TransitStoredStage, plan: TransitPreparation):void {
    const now=nativeWallClockNow();
    if (stage.expires_at<=now+5000 || plan.authorizationUntil<=now+5000)
      reject('LEASE_EXPIRED','Transit stage must have a current authorization window');
  }

  async begin(actor:string,scopeId:string,forwardId:string,generation:number)
    :Promise<OfflineTransitCommand> {
    return this.db.transaction(async tx=>{
      const {row,plan}=await this.stage(tx,actor,scopeId,forwardId,generation);
      this.fresh(row,plan);
      await this.ownership(tx,plan);
      const previous=await this.store.journal(tx,forwardId,generation);
      if (previous) reject('RESOURCE_CONFLICT','Transit coordination already started');
      const body:CoordinationBody={
        forwardId,generation,planDigest:plan.planDigest,phase:'preparing',
        position:0,revision:1,receiptHighwater:{},
      };
      await this.store.insert(tx,{
        forward_id:forwardId,generation,plan_digest:plan.planDigest,phase:body.phase,
        position:0,revision:1,receipt_highwater:'{}',journal_digest:digest(body),
        created_at:nativeWallClockNow(),updated_at:nativeWallClockNow(),
      });
      return offlineTransitStep(plan,body)!;
    });
  }
  /** Deterministic preview only, never an actual outgoing Agent command. */
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
  /** A production authenticated execution observation is still unavailable. */
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
      checkProof(command,proof,body.receiptHighwater,nativeWallClockNow());
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
  /** Retain all reservations while planning ingress-first withdrawal. */
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
  /** Recovery plans withdrawal only; it never releases ports or sends requests. */
  async quarantineRecovery():Promise<number> {
    return this.db.transaction(async tx=>{
      const pending=await this.store.recovering(tx);
      for (const row of pending) {
        const stage=await this.store.recoveryStage(tx,row.forward_id,row.generation);
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
