import type { NodeGrantPortLimits } from './port-limits.ts';
import type { AuthorizedNodeFacts, NodeAuthorityRecord } from '../../framework/public.ts';
import type { NodePolicy } from './management-contracts.ts';
import type { NodeResourceSource, NodeUseRole } from '../../framework/public.ts';

/** Node-owned access/audit needed by Relay endpoint commands in their transaction. */
export interface RelayEndpointNodeAccess<Tx> {
    management(tx:Tx,actor:string,scopeId:string,nodeId:string):Promise<NodeAuthorityRecord>;
    cleanupFacts(tx:Tx,nodeId:string,scopeId:string):Promise<AuthorizedNodeFacts>;
    audit(tx:Tx,nodeId:string,actor:string,kind:'relay_endpoint_update',details:unknown):Promise<void>;
}

export interface NodeProvisioned {nodeId:string;enrollmentToken:string;expiresAt:string}
export interface NodeEnrollment {certificate:string;ca:string}
export interface NodeRotation extends NodeEnrollment {fingerprint:string;validUntil:string;oldCredentialUntil:string}
export interface NodeRelayCredential extends NodeEnrollment {
    nodeId:string;fingerprint:string;validUntil:string;certificateNotAfter:string;overlapUntil:string|null;
}
export interface NodeGrantView {nodeId:string;revision:number;actorIds:string[];grants:{actorId:string;allowedRoles:readonly NodeUseRole[]|null;portLimits:NodeGrantPortLimits|null}[]}
export interface NodeBasicView {
    detail:'basic';nodeId:string;scopeId:string;resourceSource:NodeResourceSource;resourceRevision:number;
    revoked:boolean;capabilities:readonly string[];allowedRoles:readonly NodeUseRole[]|null;portLimits:NodeGrantPortLimits|null;
}
export interface NodeFullView {
    detail:'full';resourceSource:NodeResourceSource;ownerActorId:string|null;resourceRevision:number;
    nodeId:string;scopeId:string;policy:unknown;revoked:boolean;pendingRevocation:boolean;
    latestAuthorizationUntil:string|null;
    credentials:{fingerprint:string;validUntil:string;retireAfter:string|null;revoked:boolean}[];
}
export type NodeView=NodeBasicView|NodeFullView;

export const NODE_PORT_USAGE_QUERY_INTERFACE_VERSION=1 as const;

/** Personal ledger observation only; never an execution authorization receipt. */
export interface NodePortUsageView {
    readonly nodeId:string;
    readonly scopeId:string;
    readonly actorId:string;
    readonly resourceSource:'private'|'admin-shared';
    readonly portLimits:NodeGrantPortLimits|null;
    readonly occupiedBindings:number;
    readonly remainingBindings:number|null;
    readonly overLimit:boolean;
    readonly outOfRangeBindings:number;
    readonly limitApplicability:'shared-grant'|'not-applicable';
    readonly counting:{
        readonly unit:'protocol+port';
        readonly tcpUdp:'separate';
        readonly includesInternal:true;
        readonly includesDraining:true;
    };
    readonly source:'runtime-port-slots';
    readonly executionAuthorized:false;
    readonly observedAt:string;
}
export interface NodePortUsageQueries {
    portUsage(actorId:string,scopeId:string,nodeId:string):Promise<NodePortUsageView>;
}

/** Online machine and user-facing Node surface, without concrete implementations or Tx. */
export interface NodeApi extends NodePortUsageQueries {
    machine(fingerprint:string):Promise<string>;
    enroll(nodeId:string,token:string,csr:string):Promise<NodeEnrollment>;
    provision(actor:string,scope:string,policy:NodePolicy):Promise<NodeProvisioned>;
    provisionShared(actor:string,scope:string,policy:NodePolicy):Promise<NodeProvisioned>;
    listGrants(actor:string,scopeId:string,nodeId:string):Promise<NodeGrantView>;
    view(actor:string,scope:string,nodeId:string):Promise<NodeView>;
    rotate(nodeId:string,fingerprint:string,epoch:number,requestId:string,csr:string):Promise<NodeRotation>;
    relayCredential(nodeId:string,fingerprint:string,epoch:number,requestId:string,csr:string):Promise<NodeRelayCredential>;
}
