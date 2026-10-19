import type { ForwardIntent } from '../../framework/public.ts';
import type { ConsolePaging } from '../console-query-owner/public.ts';

export const TRANSPORT_QUERY_INTERFACE_VERSION=1 as const;
export interface ProfileReferenceQuery {page?:string|undefined;limit?:string|undefined;revision?:number|undefined;targetRevision?:number|undefined}
export interface ProfileReference {forwardId:string;revision:number;configRevision:number;spec:ForwardIntent;recoverySuspended:boolean}
export interface TransportReferenceReader<Tx> {
    profile(tx:Tx,scope:string,profile:string):Promise<{currentRevision:number}|null>;
    references(tx:Tx,scope:string,profile:string,paging:ConsolePaging,revision?:number):Promise<{total:number;items:ProfileReference[]}>;
}
type Mutable<T>={-readonly [K in keyof T]:T[K]};
export type ProposedProfileSpec=Mutable<Omit<ForwardIntent,'transport'>>&{transport:{profileId:string;configRevision:number}};
export interface ProfileReferenceItem extends ProfileReference {
    expectedRevision:number;proposedSpec:ProposedProfileSpec|null;changed:boolean|null;
}
export interface ProfileReferenceView {
    profileId:string;currentRevision:number;page:number;limit:number;total:number;items:ProfileReferenceItem[];
    target:{revision:number;configDigest:string}|null;referenceRevision:number|null;source:string;
    previewOnly:boolean;reserved:boolean;fullPlanAuthorization:boolean;observedAt:string;consistency:string;
}
export interface TransportQueryApi {
    references(actor:string,scope:string,profile:string,input?:ProfileReferenceQuery):Promise<ProfileReferenceView>;
}
