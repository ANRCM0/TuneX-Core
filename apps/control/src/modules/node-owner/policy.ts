import { freezeModuleValue, invalid } from '../../framework/public.ts';
import { nativeNodeCodec } from '../../compatibility/public.ts';
import type { NodeManagementCommand } from './management-contracts.ts';
export { validateNodeNetworkPolicy as validatePolicy } from '../../compatibility/public.ts';

export function snapshotNodeCommand(input:NodeManagementCommand):NodeManagementCommand {
    if(!input||typeof input!=='object'||Array.isArray(input))invalid('Valid Node management command required');
    if(input.kind==='revoke'&&Object.keys(input).join(',')==='kind')return Object.freeze({kind:'revoke'});
    if(input.kind!=='policy'||Object.keys(input).sort().join(',')!=='expectedRevision,kind,policy'||
        !nativeNodeCodec.isCounter(input.expectedRevision))invalid('Valid Node policy command required');
    nativeNodeCodec.validateNetworkPolicy(input.policy);
    return freezeModuleValue({kind:'policy',expectedRevision:input.expectedRevision,policy:{
        ...input.policy,allowedListenerAddresses:[...input.policy.allowedListenerAddresses],
        allowedPorts:[...input.policy.allowedPorts],allowedDestinationCidrs:[...input.policy.allowedDestinationCidrs],
    }});
}
