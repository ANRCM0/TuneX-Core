import { ControlError } from '../../framework/public.ts';
import { nativeValueDigest as digest } from '../../compatibility/public.ts';
import type { HopBinding, TransitPreparation } from './preparation-contracts.ts';
import type { TransitCoordinationBody, TransitCommandAction, OfflineTransitCommand } from './coordination-contracts.ts';

function reject(code:string,message:string):never { throw new ControlError(code,409,message); }
export function offlineTransitStep(
  plan: TransitPreparation, body: TransitCoordinationBody,
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
