import { parseProbeInstance } from '@tunex/contracts';
import type { ProbeInstanceRequest, ProbeInstanceResponse } from '@tunex/contracts';
import { ControlError } from './errors.ts';
import type { ProbeInstances } from './probe-instances.ts';

/** Remote machine adapter; all decisions and writes remain inside the instance owner. */
export class ProbeInstanceRegistry<Tx> {
    private readonly instances: Pick<ProbeInstances<Tx>, 'register' | 'revoke' | 'inspect'>;
    constructor(instances: Pick<ProbeInstances<Tx>, 'register' | 'revoke' | 'inspect'>) { this.instances = instances; }
    async handle(nodeId: string, fingerprint: string, epoch: number, input: ProbeInstanceRequest): Promise<ProbeInstanceResponse> {
        const request = parseProbeInstance('Request', JSON.stringify(input));
        if (request.nodeId !== nodeId || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe instance Node/session differs');
        const command = { bootId: request.bootId, instanceId: request.instanceId, expectedGeneration: request.expectedGeneration };
        const result = request.action === 'inspect' ? await this.instances.inspect(nodeId, fingerprint, epoch, request.bootId) :
            await this.instances[request.action](nodeId, fingerprint, epoch, command);
        const current = 'instance' in result ? result.instance : result;
        return parseProbeInstance('Response', JSON.stringify({ ...request, kind: 'probe-instance-ack',
            generation: result.generation, state: result.state, currentInstanceId: current?.instanceId ?? null,
            registeredAt: current ? new Date(current.registeredAt).toISOString() : null,
            expiresAt: current ? new Date(current.expiresAt).toISOString() : null,
            serverTime: new Date().toISOString(), executionEnabled: false }));
    }
}
