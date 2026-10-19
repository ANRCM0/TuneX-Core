import { freezeModuleValue, invalid, parseForwardIntent } from '../framework/public.ts';
import type { ForwardImportAdapter, ForwardIntent } from '../framework/public.ts';

const fields=['version','nodeId','enabled','protocol','listenAddress','listenPort','targetHost','targetPort'];

/** Explicit demonstration format; it is not TuneX V2 or another product's importer. */
export const flatForwardAdapter:ForwardImportAdapter=freezeModuleValue({
    formatId:'tunex-flat-forward',formatVersion:1,
    parse(input:unknown):ForwardIntent {
        if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))
            invalid('Flat Forward v1 object required');
        const value=input as Record<string,unknown>;
        if(Object.keys(value).sort().join(',')!==[...fields].sort().join(',')||value.version!==1||
            !['TCP','UDP','BOTH'].includes(value.protocol as string))invalid('Closed flat Forward v1 format required');
        return parseForwardIntent({enabled:value.enabled,protocols:value.protocol==='BOTH'?['tcp','udp']:[String(value.protocol).toLowerCase()],
            ingress:{nodeId:value.nodeId,listen:{address:value.listenAddress,port:value.listenPort}},target:{host:value.targetHost,port:value.targetPort}});
    },
});
