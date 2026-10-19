import type { AuthorizedNodeFacts, NodeAuthorityRecord } from '../../framework/public.ts';
import type { NodePolicy } from './management-contracts.ts';

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
export interface NodeGrantView {nodeId:string;revision:number;actorIds:string[]}
export interface NodeView {
    nodeId:string;scopeId:string;policy:unknown;revoked:boolean;pendingRevocation:boolean;
    latestAuthorizationUntil:string|null;
    credentials:{fingerprint:string;validUntil:string;retireAfter:string|null;revoked:boolean}[];
}
/** Online machine and user-facing Node surface, without concrete implementations or Tx. */
export interface NodeApi {
    machine(fingerprint:string):Promise<string>;
    enroll(nodeId:string,token:string,csr:string):Promise<NodeEnrollment>;
    provision(actor:string,scope:string,policy:NodePolicy):Promise<NodeProvisioned>;
    listGrants(actor:string,scopeId:string,nodeId:string):Promise<NodeGrantView>;
    view(actor:string,scope:string,nodeId:string):Promise<NodeView>;
    rotate(nodeId:string,fingerprint:string,epoch:number,requestId:string,csr:string):Promise<NodeRotation>;
    relayCredential(nodeId:string,fingerprint:string,epoch:number,requestId:string,csr:string):Promise<NodeRelayCredential>;
}
