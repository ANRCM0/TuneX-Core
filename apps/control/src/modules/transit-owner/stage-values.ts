import { deepFreeze, isCounter } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { TransitStoredStage } from '../../framework/public.ts';
import { readStoredValue as json, nativeValueDigest as digest } from '../../compatibility/public.ts';
import type { TransitPreparation } from './preparation-contracts.ts';

function integrity(message:string):never { throw new ControlError('INTEGRITY_FAILURE',409,message); }
export function verifyTransitStage(row: TransitStoredStage): TransitPreparation {
  let plan:TransitPreparation;
  try { plan=json<TransitPreparation>(row.body); }
  catch { integrity('Malformed retained Transit JSON'); }
  if (!plan || typeof plan!=='object' || plan.executable!==false ||
      !Array.isArray(plan.assignments) || !Array.isArray(plan.intents) ||
      !Array.isArray(plan.activationOrder) || !isCounter(row.generation) ||
      !isCounter(row.target_revision) || !Number.isSafeInteger(row.expires_at) || row.expires_at<=row.created_at ||
      !['reserved','aborted'].includes(row.state) ||
      !Number.isSafeInteger(plan.authorizationUntil))
    integrity('Invalid retained Transit plan');
  const {planDigest,...body}=plan;
  if (planDigest!==row.plan_digest || digest(body)!==row.plan_digest ||
      plan.forwardId!==row.forward_id || plan.scopeId!==row.scope_id ||
      plan.forwardRevision!==row.target_revision || plan.deploymentGeneration!==row.generation ||
      row.expires_at>plan.authorizationUntil) integrity('Transit journal digest or identity differs');
  const ids=new Set(plan.assignments.map(a=>a.nodeId));
  const uniqueResources=new Set(plan.assignments.map(a=>a.nodeId+'/'+a.resource.physicalProtocol+'/'+a.resource.port));
  const logical=new Set(plan.assignments.map(a=>a.nodeId+'/'+a.protocol));
  if (ids.size<3 || ids.size>8 || uniqueResources.size!==plan.assignments.length ||
      logical.size!==plan.assignments.length || plan.activationOrder.length!==ids.size ||
      new Set(plan.activationOrder).size!==ids.size ||
      plan.activationOrder.some(id=>!ids.has(id)) ||
      plan.assignments.some(a=>!isCounter(a.bindingFence) || !isCounter(a.sessionEpoch) ||
        a.resource.nodeId!==a.nodeId || a.resource.role!==a.role ||
        a.resource.forwardProtocol!==a.protocol ||
        (a.role==='ingress' ? a.resource.physicalProtocol!==a.protocol : a.resource.physicalProtocol!=='tcp')))
    integrity('Transit journal topology or physical Fence differs');
  return deepFreeze(plan);
}
