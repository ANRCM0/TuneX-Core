import type { AuthorizedNodeFacts, NodeAuthorityStore, NodeAuthorityRecord, NodeEnrollmentRecord,
    NodeCurrentCredentialRecord, NodeCredentialRecord, NodeRelayCredentialRecord, NodeCredentialReplay,
    SignedNodeCredential, NodeSecurityEventKind, NodeMachineLookup } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { MySqlUnitOfWork, Transaction } from './mysql.ts';

export class MySqlNodeAuthorityStore implements NodeAuthorityStore<Transaction> {
    async quarantine(tx:Transaction):Promise<void> {
        await write(tx,'UPDATE nodes SET revoked=TRUE');
        await write(tx,'UPDATE node_credentials SET revoked=TRUE');
        await write(tx,'UPDATE node_relay_credentials SET revoked=TRUE');
    }
    async create(tx:Transaction,nodeId:string,scopeId:string,actor:string,enrollmentHash:string,until:number,facts:AuthorizedNodeFacts):Promise<void> {
        await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)',[nodeId,scopeId,enrollmentHash,until,JSON.stringify(facts)]);
        await write(tx,'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)',[nodeId,actor]);
    }
    async enrollment(tx:Transaction,nodeId:string,enrollmentHash:string):Promise<NodeEnrollmentRecord|undefined> {
        return (await rows<NodeEnrollmentRecord>(tx,'SELECT * FROM nodes WHERE id=? AND enrollment_hash=? FOR UPDATE',[nodeId,enrollmentHash]))[0];
    }
    async acceptEnrollment(tx:Transaction,nodeId:string,csrDigest:string,signed:SignedNodeCredential,response:unknown):Promise<void> {
        await write(tx,'UPDATE nodes SET csr_digest=?,credential_fingerprint=?,credential_until=?,enrollment_response=? WHERE id=?',[csrDigest,signed.fingerprint,signed.until,JSON.stringify(response),nodeId]);
    }
    async insertCredential(tx:Transaction,nodeId:string,signed:SignedNodeCredential,at:number):Promise<void> {
        await write(tx,'INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)',[signed.fingerprint,nodeId,at,signed.until]);
    }
    async credential(tx:Transaction,nodeId:string,fingerprint:string):Promise<{valid_until:number;retire_after:number|null}|undefined> {
        return (await rows<{valid_until:number;retire_after:number|null}>(tx,'SELECT c.valid_until,c.retire_after FROM node_credentials c JOIN nodes n ON n.id=c.node_id WHERE c.fingerprint=? AND c.node_id=? AND c.revoked=FALSE AND n.revoked=FALSE FOR SHARE',[fingerprint,nodeId]))[0];
    }
    async state(tx:Transaction,nodeId:string):Promise<NodeAuthorityRecord|undefined> {
        return (await rows<NodeAuthorityRecord>(tx,'SELECT * FROM nodes WHERE id=? FOR SHARE',[nodeId]))[0];
    }
    async currentForUpdate(tx:Transaction,nodeId:string):Promise<NodeCurrentCredentialRecord|undefined> {
        return (await rows<NodeCurrentCredentialRecord>(tx,'SELECT * FROM nodes WHERE id=? FOR UPDATE',[nodeId]))[0];
    }
    async scopeGrant(tx:Transaction,nodeId:string,actor:string,scopeId:string):Promise<boolean> {
        return Boolean((await rows(tx,'SELECT g.node_id FROM node_grants g JOIN nodes n ON n.id=g.node_id WHERE g.node_id=? AND g.actor_id=? AND n.scope_id=? FOR SHARE',[nodeId,actor,scopeId]))[0]);
    }
    async relayGrant(tx:Transaction,nodeId:string,scopeId:string,actor:string):Promise<boolean> {
        return Boolean((await rows(tx,'SELECT n.id FROM nodes n JOIN node_grants g ON g.node_id=n.id WHERE n.id=? AND n.scope_id=? AND g.actor_id=? FOR SHARE',[nodeId,scopeId,actor]))[0]);
    }
    async hasGrant(tx:Transaction,nodeId:string,actor:string):Promise<boolean> {
        return (await rows(tx,'SELECT node_id FROM node_grants WHERE node_id=? AND actor_id=? FOR SHARE',[nodeId,actor])).length===1;
    }
    async setFacts(tx:Transaction,nodeId:string,facts:AuthorizedNodeFacts):Promise<void> {
        await write(tx,'UPDATE nodes SET facts=? WHERE id=?',[JSON.stringify(facts),nodeId]);
    }
    async relayReplay(tx:Transaction,nodeId:string,requestId:string):Promise<NodeCredentialReplay|undefined> {
        return (await rows<NodeCredentialReplay>(tx,'SELECT request_digest,response FROM relay_credential_requests WHERE node_id=? AND request_id=?',[nodeId,requestId]))[0];
    }
    async rotationReplay(tx:Transaction,nodeId:string,requestId:string):Promise<NodeCredentialReplay|undefined> {
        return (await rows<NodeCredentialReplay>(tx,'SELECT * FROM credential_rotations WHERE node_id=? AND request_id=?',[nodeId,requestId]))[0];
    }
    activeRelayCredentials(tx:Transaction,nodeId:string,at:number,retireAt:number):Promise<{fingerprint:string;valid_until:number}[]> {
        return rows(tx,'SELECT fingerprint,valid_until FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?) ORDER BY issued_at FOR UPDATE',[nodeId,at,retireAt]);
    }
    async retireRelayCredentials(tx:Transaction,nodeId:string,overlap:number):Promise<void> {
        await write(tx,'UPDATE node_relay_credentials SET retire_after=LEAST(valid_until,?) WHERE node_id=? AND revoked=FALSE AND retire_after IS NULL',[overlap,nodeId]);
    }
    async insertRelayCredential(tx:Transaction,nodeId:string,signed:SignedNodeCredential,at:number,until:number):Promise<void> {
        await write(tx,'INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',[signed.fingerprint,nodeId,at,until,signed.certificate]);
    }
    async saveRelayRequest(tx:Transaction,nodeId:string,requestId:string,requestDigest:string,fingerprint:string,response:unknown):Promise<void> {
        await write(tx,'INSERT INTO relay_credential_requests(node_id,request_id,request_digest,source_fingerprint,response) VALUES(?,?,?,?,?)',[nodeId,requestId,requestDigest,fingerprint,JSON.stringify(response)]);
    }
    relayCredentials(tx:Transaction,nodeId:string,at:number,retireAt:number,currentOnly:boolean):Promise<NodeRelayCredentialRecord[]> {
        return rows(tx,'SELECT fingerprint,certificate,valid_until,retire_after FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?) AND (?=FALSE OR retire_after IS NULL) ORDER BY fingerprint FOR SHARE',[nodeId,at,retireAt,currentOnly]);
    }
    async retireCredential(tx:Transaction,nodeId:string,fingerprint:string,overlap:number):Promise<void> {
        await write(tx,'UPDATE node_credentials SET retire_after=? WHERE node_id=? AND fingerprint=?',[overlap,nodeId,fingerprint]);
    }
    async setCurrentCredential(tx:Transaction,nodeId:string,signed:SignedNodeCredential):Promise<void> {
        await write(tx,'UPDATE nodes SET credential_fingerprint=?,credential_until=? WHERE id=?',[signed.fingerprint,signed.until,nodeId]);
    }
    async saveRotation(tx:Transaction,nodeId:string,requestId:string,requestDigest:string,fingerprint:string,response:unknown):Promise<void> {
        await write(tx,'INSERT INTO credential_rotations(node_id,request_id,request_digest,source_fingerprint,response) VALUES(?,?,?,?,?)',[nodeId,requestId,requestDigest,fingerprint,JSON.stringify(response)]);
    }
    async securityEvent(tx:Transaction,eventId:string,nodeId:string,actor:string|null,kind:NodeSecurityEventKind,at:number,details:unknown):Promise<void> {
        await write(tx,'INSERT INTO node_security_events(id,node_id,actor_id,kind,created_at,details) VALUES(?,?,?,?,?,?)',[eventId,nodeId,actor,kind,at,JSON.stringify(details)]);
    }
    async grantRevisionForUpdate(tx:Transaction,nodeId:string):Promise<{grant_revision:number}|undefined> {
        return (await rows<{grant_revision:number}>(tx,'SELECT grant_revision FROM nodes WHERE id=? FOR UPDATE',[nodeId]))[0];
    }
    async grantRevision(tx:Transaction,nodeId:string,scopeId:string):Promise<{grant_revision:number}|undefined> {
        return (await rows<{grant_revision:number}>(tx,'SELECT grant_revision FROM nodes WHERE id=? AND scope_id=?',[nodeId,scopeId]))[0];
    }
    grantActors(tx:Transaction,nodeId:string):Promise<{actor_id:string}[]> {
        return rows(tx,'SELECT actor_id FROM node_grants WHERE node_id=? ORDER BY actor_id',[nodeId]);
    }
    async insertGrant(tx:Transaction,nodeId:string,actor:string):Promise<void> { await write(tx,'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)',[nodeId,actor]); }
    async deleteGrant(tx:Transaction,nodeId:string,actor:string):Promise<void> { await write(tx,'DELETE FROM node_grants WHERE node_id=? AND actor_id=?',[nodeId,actor]); }
    async setGrantRevision(tx:Transaction,nodeId:string,revision:number):Promise<void> { await write(tx,'UPDATE nodes SET grant_revision=? WHERE id=?',[revision,nodeId]); }
    async visible(tx:Transaction,nodeId:string,scopeId:string):Promise<boolean> {
        return Boolean((await rows(tx,'SELECT id FROM nodes WHERE id=? AND scope_id=?',[nodeId,scopeId]))[0]);
    }
    async scopedNode(tx:Transaction,nodeId:string,scopeId:string,lock:boolean):Promise<NodeAuthorityRecord|undefined> {
        return (await rows<NodeAuthorityRecord>(tx,`SELECT * FROM nodes WHERE id=? AND scope_id=?${lock?' FOR UPDATE':''}`,[nodeId,scopeId]))[0];
    }
    async markRevoked(tx:Transaction,nodeId:string):Promise<void> {
        await write(tx,'UPDATE nodes SET revoked=TRUE WHERE id=?',[nodeId]);
        await write(tx,'UPDATE node_credentials SET revoked=TRUE WHERE node_id=?',[nodeId]);
        await write(tx,'UPDATE node_relay_credentials SET revoked=TRUE WHERE node_id=?',[nodeId]);
    }
    credentials(tx:Transaction,nodeId:string):Promise<NodeCredentialRecord[]> {
        return rows(tx,'SELECT fingerprint,valid_until,retire_after,revoked FROM node_credentials WHERE node_id=? ORDER BY issued_at',[nodeId]);
    }
}

export class MySqlNodeMachineLookup implements NodeMachineLookup {
    private readonly db:MySqlUnitOfWork;
    constructor(db:MySqlUnitOfWork) {this.db=db;}
    async machine(fingerprint:string,at:number,retireAt:number):Promise<{node_id:string}|undefined> {
        return (await rows<{node_id:string}>(this.db.pool,'SELECT c.node_id FROM node_credentials c JOIN nodes n ON n.id=c.node_id WHERE c.fingerprint=? AND c.revoked=FALSE AND n.revoked=FALSE AND c.valid_until>? AND (c.retire_after IS NULL OR c.retire_after>?)',[fingerprint,at,retireAt]))[0];
    }
}
