import { isCounter, isPort } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import { compilePathTopology } from '../../compatibility/public.ts';
import type { TransitResource } from './preparation-contracts.ts';

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
