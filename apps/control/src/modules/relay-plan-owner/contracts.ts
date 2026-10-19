import type { RelayResource } from '../../framework/public.ts';

export const RELAY_QUERY_INTERFACE_VERSION=1 as const;

interface RelayPreviewFields {
    profile:{profileId:string;revision:number;configDigest:string};
    resources:readonly RelayResource[];
    executionSupported:boolean;
    runtimeEnabled:boolean;
    reserved:boolean;
}
// Preserve the two existing response shapes without promising new literal flags.
export type RelayPreview=RelayPreviewFields&(
    {endpointRevision:number;endpointRevisions?:undefined;path?:undefined}|
    {endpointRevision?:undefined;endpointRevisions:Record<string,number>;path:string[]}
);

export interface RelayPlanApi {
    readonly planRelay:(actorId:string,scopeId:string,input:unknown)=>Promise<RelayPreview>;
}
