import { MAX_COUNTER, isCounter, isPort } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { DEFAULT_POLICY } from '@tunex/contracts';
import { ControlError } from '../../application/errors.ts';
import { rows, write } from '../../infrastructure/mysql.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
import type { TransitResource, ReservedTransitResource } from './transit-preparation.ts';
import { compilePathTopology } from './path-topology.ts';

/**
 * Offline multi-hop coordinator building block. Caller MUST authorize every
 * Scope/Node/peer/Profile first and keep this in one MySQL transaction with
 * a future durable multi-hop deployment journal; otherwise roll back.
 *
 * No production Control API, ADP/3 publisher or Agent Runner calls this.
 */
export function validateTransitReservationSet(
  forward: Forward, resources: readonly TransitResource[], generation: number,
): void {
  const route = compilePathTopology(forward);
  const sockets = resources.map(r => r.nodeId + '/' + r.physicalProtocol + '/' + r.port);
  const logical = resources.map(r => r.nodeId + '/' + r.forwardProtocol);
  if (!forward.spec.enabled || route.nodes.length < 3 || !isCounter(generation) ||
      resources.length !== route.nodes.length * forward.spec.protocols.length ||
      new Set(sockets).size !== resources.length ||
      new Set(logical).size !== resources.length ||
      resources.some(r => {
        const hop = route.nodes.find(n => n.nodeId === r.nodeId);
        return !hop || hop.role !== r.role || !forward.spec.protocols.includes(r.forwardProtocol) ||
          !isPort(r.port) || !['tcp','udp'].includes(r.physicalProtocol) ||
          (r.role === 'ingress' && (r.physicalProtocol !== r.forwardProtocol ||
            r.address !== forward.spec.ingress.listen.address ||
            r.port !== forward.spec.ingress.listen.port)) ||
          (r.role !== 'ingress' && r.physicalProtocol !== 'tcp');
      })) {
    throw new ControlError('RESOURCE_CONFLICT',409,'Incomplete, unauthorized or duplicate multi-hop reservation set');
  }
}

export async function reserveTransitResources(
  tx: Transaction, forward: Forward, resources: readonly TransitResource[],
  generation: number,
): Promise<readonly ReservedTransitResource[]> {
  validateTransitReservationSet(forward,resources,generation);
  const uniqueNodes = new Set(resources.map(r => r.nodeId));
  const ordered = [...resources].sort((a,b) =>
    a.nodeId.localeCompare(b.nodeId) ||
    a.physicalProtocol.localeCompare(b.physicalProtocol) || a.port-b.port);
  for (const nodeId of [...uniqueNodes].sort()) {
    const state = await rows<{node_id:string}>(tx,
      'SELECT node_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]);
    if (state.length !== 1)
      throw new ControlError('SESSION_SUPERSEDED',409,'Current Node session required');
  }
  const reservations: ReservedTransitResource[]=[];
  for (const resource of ordered) {
    const args=[resource.nodeId,resource.physicalProtocol,resource.port];
    await write(tx,'INSERT INTO port_slots(node_id,protocol,port) VALUES(?,?,?) ON DUPLICATE KEY UPDATE port=port',args);
    const row=(await rows<{owner_id:string|null;fence:number}>(tx,
      'SELECT owner_id,fence FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',args))[0];
    if(!row || row.owner_id!==null && row.owner_id!==forward.id)
      throw new ControlError('PORT_RESERVED',409,'Physical port owned by another Forward');
    if(!Number.isSafeInteger(row.fence) || row.fence<0 || row.fence>=MAX_COUNTER)
      throw new ControlError('RESOURCE_LIMIT',429,'Fencing counter exhausted');
    await write(tx,'UPDATE port_slots SET owner_id=?,fence=fence+1,deployment_generation=? WHERE node_id=? AND protocol=? AND port=?',
      [forward.id,generation,...args]);
    reservations.push({...resource,forwardId:forward.id,deploymentGeneration:generation,bindingFence:row.fence+1});
  }
  for (const nodeId of [...uniqueNodes].sort()) {
    const count=(await rows<{n:number}>(tx,
      'SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',[nodeId]))[0];
    if(Number(count?.n)>DEFAULT_POLICY.maxAssignmentsPerNode)
      throw new ControlError('RESOURCE_LIMIT',429,'Node capacity exceeded');
  }
  return reservations;
}
