import { parseForward } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { NATIVE_DRIVER_CATALOG } from '../../compatibility/public.ts';
import type { NativeDriverDescriptor } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import { EXECUTION_HOST_VERSION } from './execution-contracts.ts';
import type { ForwardExecutionAdapter, NativeDriverId } from './execution-contracts.ts';

/** Classification of the existing intent model, never a caller-selected unvalidated driver. */
export function nativeDriverFor(forward:Forward):NativeDriverId {
    const parsed=parseForward(forward);
    if(!parsed.ok)throw new ControlError('INVALID_CONFIG',422,'Valid native Forward intent required');
    const count=parsed.value.spec.path?.via.length??0;
    return count===0?'native.direct.v1':count===1?'native.relay.v1':'native.multihop.v1';
}

const methods=['prepareCreate','planCreate','prepareUpdate','planUpdate','lockRemoval','authorizeRetry'] as const;

/** Static registration routes existing compilers; catalog declarations do not authorize execution. */
export class ForwardExecutionRegistry<Tx> {
    private readonly adapters:ReadonlyMap<NativeDriverId,ForwardExecutionAdapter<Tx>>;
    constructor(adapters:readonly ForwardExecutionAdapter<Tx>[]) {
        if(!Array.isArray(adapters)||adapters.length!==NATIVE_DRIVER_CATALOG.drivers.length)
            throw new Error('Complete native execution adapter registration required');
        const entries=new Map<NativeDriverId,ForwardExecutionAdapter<Tx>>();
        for(const adapter of adapters) {
            const descriptor=adapter&&NATIVE_DRIVER_CATALOG.drivers.find(item=>item.id===adapter.id);
            if(!descriptor||adapter.hostInterfaceVersion!==EXECUTION_HOST_VERSION||entries.has(adapter.id)||
                methods.some(method=>typeof adapter[method]!=='function'))throw new Error('Invalid or duplicate native execution adapter');
            entries.set(adapter.id,Object.freeze({id:adapter.id,hostInterfaceVersion:EXECUTION_HOST_VERSION,
                prepareCreate:adapter.prepareCreate.bind(adapter),planCreate:adapter.planCreate.bind(adapter),
                prepareUpdate:adapter.prepareUpdate.bind(adapter),planUpdate:adapter.planUpdate.bind(adapter),
                lockRemoval:adapter.lockRemoval.bind(adapter),authorizeRetry:adapter.authorizeRetry.bind(adapter)}));
        }
        this.adapters=entries;
    }
    descriptor(id:NativeDriverId):NativeDriverDescriptor {
        const descriptor=NATIVE_DRIVER_CATALOG.drivers.find(item=>item.id===id);
        if(!descriptor||!this.adapters.has(id))throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Native execution adapter is not installed');
        return descriptor;
    }
    select(forward:Forward):ForwardExecutionAdapter<Tx> {
        const id=nativeDriverFor(forward),descriptor=this.descriptor(id),adapter=this.adapters.get(id);
        if(!adapter||forward.spec.protocols.some(protocol=>!descriptor.businessProtocols.includes(protocol)))
            throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Native execution adapter does not support this business protocol');
        return adapter;
    }
}
