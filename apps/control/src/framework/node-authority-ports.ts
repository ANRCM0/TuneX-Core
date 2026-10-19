import type { AuthorizedNodeFacts } from './node-facts.ts';
import type { ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary } from './application-ports.ts';
import type { RuntimeNodeResources } from './runtime-resource-ports.ts';

export const NODE_AUTHORITY_INTERFACE_VERSION=3 as const;

export interface NodeAuthorityRecord {
    id:string;
    scope_id:string;
    credential_until:number|null;
    facts:unknown;
    revoked:number;
}
export interface NodeEnrollmentRecord extends NodeAuthorityRecord {
    enrollment_until:number;
    csr_digest:string|null;
    enrollment_response:unknown;
}
export interface NodeCurrentCredentialRecord extends NodeAuthorityRecord { credential_fingerprint:string|null }
export interface NodeCredentialRecord {
    fingerprint:string;
    valid_until:number;
    retire_after:number|null;
    revoked:number;
}
export interface NodeRelayCredentialRecord {
    fingerprint:string;
    certificate:string;
    valid_until:number;
    retire_after:number|null;
}
export interface NodeCredentialReplay { request_digest:string;response:unknown }
export interface SignedNodeCredential { certificate:string;ca:string;fingerprint:string;until:number }
export interface NodeCertificateSigner {
    sign(nodeId:string,csr:string,purpose?:'control'|'relay'):Promise<SignedNodeCredential>;
}
export type NodeSecurityEventKind='credential_rotation'|'policy_update'|'node_revocation'|'relay_endpoint_update'|'relay_credential_issue';

/** All owner mutations and locked reads use the supplied transaction. */
export interface NodeAuthorityStore<Tx> {
    quarantine(tx:Tx):Promise<void>;
    create(tx:Tx,nodeId:string,scopeId:string,actor:string,enrollmentHash:string,until:number,facts:AuthorizedNodeFacts):Promise<void>;
    enrollment(tx:Tx,nodeId:string,enrollmentHash:string):Promise<NodeEnrollmentRecord|undefined>;
    acceptEnrollment(tx:Tx,nodeId:string,csrDigest:string,signed:SignedNodeCredential,response:unknown):Promise<void>;
    insertCredential(tx:Tx,nodeId:string,signed:SignedNodeCredential,at:number):Promise<void>;
    credential(tx:Tx,nodeId:string,fingerprint:string):Promise<{valid_until:number;retire_after:number|null}|undefined>;
    state(tx:Tx,nodeId:string):Promise<NodeAuthorityRecord|undefined>;
    currentForUpdate(tx:Tx,nodeId:string):Promise<NodeCurrentCredentialRecord|undefined>;
    scopeGrant(tx:Tx,nodeId:string,actor:string,scopeId:string):Promise<boolean>;
    relayGrant(tx:Tx,nodeId:string,scopeId:string,actor:string):Promise<boolean>;
    hasGrant(tx:Tx,nodeId:string,actor:string):Promise<boolean>;
    setFacts(tx:Tx,nodeId:string,facts:AuthorizedNodeFacts):Promise<void>;
    relayReplay(tx:Tx,nodeId:string,requestId:string):Promise<NodeCredentialReplay|undefined>;
    rotationReplay(tx:Tx,nodeId:string,requestId:string):Promise<NodeCredentialReplay|undefined>;
    activeRelayCredentials(tx:Tx,nodeId:string,at:number,retireAt:number):Promise<{fingerprint:string;valid_until:number}[]>;
    retireRelayCredentials(tx:Tx,nodeId:string,overlap:number):Promise<void>;
    insertRelayCredential(tx:Tx,nodeId:string,signed:SignedNodeCredential,at:number,until:number):Promise<void>;
    saveRelayRequest(tx:Tx,nodeId:string,requestId:string,requestDigest:string,fingerprint:string,response:unknown):Promise<void>;
    relayCredentials(tx:Tx,nodeId:string,at:number,retireAt:number,currentOnly:boolean):Promise<NodeRelayCredentialRecord[]>;
    retireCredential(tx:Tx,nodeId:string,fingerprint:string,overlap:number):Promise<void>;
    setCurrentCredential(tx:Tx,nodeId:string,signed:SignedNodeCredential):Promise<void>;
    saveRotation(tx:Tx,nodeId:string,requestId:string,requestDigest:string,fingerprint:string,response:unknown):Promise<void>;
    securityEvent(tx:Tx,eventId:string,nodeId:string,actor:string|null,kind:NodeSecurityEventKind,at:number,details:unknown):Promise<void>;
    grantRevisionForUpdate(tx:Tx,nodeId:string):Promise<{grant_revision:number}|undefined>;
    grantRevision(tx:Tx,nodeId:string,scopeId:string):Promise<{grant_revision:number}|undefined>;
    grantActors(tx:Tx,nodeId:string):Promise<{actor_id:string}[]>;
    insertGrant(tx:Tx,nodeId:string,actor:string):Promise<void>;
    deleteGrant(tx:Tx,nodeId:string,actor:string):Promise<void>;
    setGrantRevision(tx:Tx,nodeId:string,revision:number):Promise<void>;
    visible(tx:Tx,nodeId:string,scopeId:string):Promise<boolean>;
    scopedNode(tx:Tx,nodeId:string,scopeId:string,lock:boolean):Promise<NodeAuthorityRecord|undefined>;
    markRevoked(tx:Tx,nodeId:string):Promise<void>;
    credentials(tx:Tx,nodeId:string):Promise<NodeCredentialRecord[]>;
}
/** The pre-existing pool-backed TLS lookup is separate from transaction-bound commands. */
export interface NodeMachineLookup {
    machine(fingerprint:string,at:number,retireAt:number):Promise<{node_id:string}|undefined>;
}
export interface NodeScopeAuthority<Tx> extends ScopeAuthorization<Tx>, ScopeOwnerAuthorization<Tx> {
    executing(tx:Tx,actor:string,scopeId:string):Promise<boolean>;
    audit(tx:Tx,scopeId:string,actor:string,subject:string,kind:'node_grant_change',revision:number,details:unknown):Promise<void>;
}
export interface NodeSecrets {
    newID():string;
    newToken():string;
    tokenHash(token:string):string;
}
export interface NodeAuthorityCodec {
    validEnrollmentToken(value:unknown):value is string;
    validCredentialRequest(value:unknown):value is string;
    supportsDirectRuntime(facts:AuthorizedNodeFacts):boolean;
    relayFingerprint(fingerprint:string):string;
    formatTime(at:number):string;
    digest(value:unknown):string;
    readValue<T>(value:unknown):T;
    isId(value:unknown):boolean;
    isCounter(value:unknown,allowZero?:boolean):boolean;
    targetAllowed(host:string,facts:AuthorizedNodeFacts):boolean;
    validateNetworkPolicy(policy:Omit<AuthorizedNodeFacts,'nodeId'|'scopeId'|'capabilities'>):void;
}
export interface NodeAuthorityOptions<Tx> {
    readonly db:TransactionBoundary<Tx>;
    readonly identity:NodeScopeAuthority<Tx>;
    readonly store:NodeAuthorityStore<Tx>;
    readonly machine:NodeMachineLookup;
    readonly signer:NodeCertificateSigner;
    readonly resources:RuntimeNodeResources<Tx>;
    readonly secrets:NodeSecrets;
    readonly codec:NodeAuthorityCodec;
    readonly now:()=>number;
    readonly overlapSeconds:number;
    readonly relayCredentialSeconds:number;
}
