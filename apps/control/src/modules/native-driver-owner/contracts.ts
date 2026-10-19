import type { NativeDriverDescriptor } from '../../compatibility/public.ts';

export const NATIVE_DRIVER_QUERY_INTERFACE_VERSION=1 as const;

// The implementation spreads the descriptor: outer fields become mutable, nested
// declaration arrays/objects retain their original readonly types.
export type NativeDriverView={-readonly [K in keyof NativeDriverDescriptor]:NativeDriverDescriptor[K]}&{controlEnabled:boolean};
export interface NativeDriverCatalogView {
    version:number;catalogDigest:string;source:string;authorized:boolean;reserved:boolean;
    nodeEvidence:string;platformAcceptance:string;protocolCapabilityCheck:string;probeIssuanceEnabled:boolean;
    drivers:NativeDriverView[];
}
export interface NativeDriverApi {list(actor:string,scope:string):Promise<NativeDriverCatalogView>}
