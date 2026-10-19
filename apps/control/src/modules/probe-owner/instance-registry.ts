import { parseProbeInstance, nativeJsonEncode, nativeProbeInstanceAck, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbeInstanceRequest, ProbeInstanceResponse } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { ProbeInstanceOwner } from './instance-contracts.ts';
import type { ProbeInstanceApi } from './machine-api.ts';

/** Remote machine adapter; all decisions and writes remain inside the instance owner. */
export class ProbeInstanceRegistry<_Tx> implements ProbeInstanceApi {
    private readonly instances: ProbeInstanceOwner;
    constructor(instances: ProbeInstanceOwner) { this.instances = instances; }
    async handle(nodeId: string, fingerprint: string, epoch: number, input: ProbeInstanceRequest): Promise<ProbeInstanceResponse> {
        const request = parseProbeInstance('Request', nativeJsonEncode(input));
        if (request.nodeId !== nodeId || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe instance Node/session differs');
        const command = { bootId: request.bootId, instanceId: request.instanceId, expectedGeneration: request.expectedGeneration };
        const result = request.action === 'inspect' ? await this.instances.inspect(nodeId, fingerprint, epoch, request.bootId) :
            await this.instances[request.action](nodeId, fingerprint, epoch, command);
        const current = 'instance' in result ? result.instance : result;
        return nativeProbeInstanceAck(request,result,current,()=>nativeWallClockSource()());
    }
}
