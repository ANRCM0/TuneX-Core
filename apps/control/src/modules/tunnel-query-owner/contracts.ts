import type { ReadPrincipal, ForwardIntent, RuntimeRelayEndpointConfig } from '../../framework/public.ts';
import type { ConsolePaging } from '../console-query-owner/public.ts';

export const TUNNEL_QUERY_INTERFACE_VERSION=2 as const;
export interface TunnelNodeRecord {
    nodeId:string;revoked:boolean;credentialUntil:number|null;capabilities:unknown;
    sessionEpoch:number;snapshotGeneration:number;lastReportAt:number|null;
}
export interface TunnelPeerRecord {fingerprint:string;issuedAt:number;validUntil:number;retireAfter:number|null;revoked:boolean}
export interface TunnelReference {forwardId:string;revision:number;spec:ForwardIntent;recoverySuspended:boolean}
export interface TunnelPaging {page?:string|undefined;limit?:string|undefined}
export interface TunnelReadPort<Tx> {
    node(tx:Tx,scope:string,node:string):Promise<TunnelNodeRecord|null>;
    endpoint(tx:Tx,node:string):Promise<{revision:number;config:unknown}|null>;
    peers(tx:Tx,node:string,now:number):Promise<{total:number;windowCount:number;items:TunnelPeerRecord[]}>;
    references(tx:Tx,scope:string,principal:ReadPrincipal,node:string,paging:ConsolePaging):Promise<{total:number;items:TunnelReference[]}>;
}
export interface TunnelPeerView {
    fingerprint:string;issuedAt:string;validUntil:string;retireAfter:string|null;revoked:boolean;
    effectiveUntil:string|null;recordedWindowOpen:boolean;
}
export interface TunnelStatusView {
    nodeId:string;source:string;observedAt:string;health:string;executionAuthorized:boolean;reserved:boolean;
    networkCheck:string;certificateVerification:string;
    node:{revoked:boolean;credentialUntil:string|null;recordedMachineWindowOpen:boolean;capabilities:string[];
        sessionEpoch:number;snapshotGeneration:number;lastReportAt:string|null};
    endpoint:{revision:number;config:RuntimeRelayEndpointConfig}|null;
    peerCredentials:{total:number;recordedWindowCount:number;limit:number;truncated:boolean;selection:string;items:TunnelPeerView[]};
    consistency:string;
}
export interface TunnelReferenceItem {
    forwardId:string;revision:number;enabled:boolean;recoverySuspended:boolean;protocols:ForwardIntent['protocols'];
    profileId:string;configRevision:number;role:'ingress'|'egress'|'transit';endpointRequired:boolean;
    previousNodeId:string|null;nextNodeId:string|null;path:string[];
}
export interface TunnelReferenceView {
    nodeId:string;page:number;limit:number;total:number;items:TunnelReferenceItem[];source:string;
    previewOnly:boolean;reserved:boolean;executionAuthorized:boolean;historicalReferencesIncluded:boolean;
    deletionSafety:string;consistency:string;
}
export interface TunnelQueryApi {
    status(actor:string,scope:string,node:string):Promise<TunnelStatusView>;
    references(actor:string,scope:string,node:string,input?:TunnelPaging):Promise<TunnelReferenceView>;
}
