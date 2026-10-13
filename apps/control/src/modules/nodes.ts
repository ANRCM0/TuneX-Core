import { randomUUID } from 'node:crypto';
import { isId, isCounter, isPort, normalizeIp } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { digest, validCidr } from '@tunex/contracts';
import { ControlError, invalid, notFound } from '../application/errors.ts';
import { json, rows, write } from '../infrastructure/mysql.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
import type { NodeCertificateAuthority } from '../infrastructure/pki.ts';
import { newToken, tokenHash } from './identity.ts';
import type { Identity } from './identity.ts';
import type { AuthorizedNodeFacts } from './runtime/planner.ts';
import { targetAllowed } from './target-policy.ts';
import { RuntimeLedger } from './runtime/ledger.ts';
export type NodePolicy = Omit<AuthorizedNodeFacts, 'nodeId' | 'scopeId' | 'capabilities'>;
export interface NodeRecord {
    id: string;
    scope_id: string;
    credential_until: number | null;
    facts: unknown;
    revoked: number;
}
export class Nodes {
    static async quarantineRecovery(tx:Transaction):Promise<void>{await write(tx,'UPDATE nodes SET revoked=TRUE');await write(tx,'UPDATE node_credentials SET revoked=TRUE');}
    private readonly db: MySqlUnitOfWork;
    private readonly identity: Identity;
    private readonly ca: NodeCertificateAuthority;
    private readonly overlapSeconds: number;
    private readonly runtime = new RuntimeLedger();
    constructor(db: MySqlUnitOfWork, identity: Identity, ca: NodeCertificateAuthority, overlapSeconds = 120) {
        if (!Number.isInteger(overlapSeconds) || overlapSeconds < 1 || overlapSeconds > 300)
            throw new Error('Credential overlap must be 1..300 seconds');
        this.db = db;
        this.identity = identity;
        this.ca = ca;
        this.overlapSeconds = overlapSeconds;
    }
    async provision(actor: string, scope: string, policy: NodePolicy): Promise<{
        nodeId: string;
        enrollmentToken: string;
        expiresAt: string;
    }> {
        validatePolicy(policy);
        const nodeId = randomUUID(), token = newToken(), until = Date.now() + 600000;
        await this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actor, scope, true);
            const facts: AuthorizedNodeFacts = { ...policy, nodeId, scopeId: scope, capabilities: [] };
            await write(tx, 'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)', [nodeId, scope, tokenHash(token), until, JSON.stringify(facts)]);
            await write(tx, 'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', [nodeId, actor]);
            await this.runtime.initializeNode(tx, nodeId);
        });
        return { nodeId, enrollmentToken: token, expiresAt: new Date(until).toISOString() };
    }
    async enroll(nodeId: string, token: string, csr: string): Promise<{
        certificate: string;
        ca: string;
    }> {
        if (!isId(nodeId) || typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token) || typeof csr !== 'string' || csr.length > 16384 || !csr.startsWith('-----BEGIN CERTIFICATE REQUEST-----'))
            invalid('Invalid enrollment input');
        const csrDigest = digest({ csr });
        return this.db.transaction(async (tx) => {
            const node = (await rows<NodeRecord & {
                enrollment_until: number;
                csr_digest: string | null;
                enrollment_response: unknown;
            }>(tx, 'SELECT * FROM nodes WHERE id=? AND enrollment_hash=? FOR UPDATE', [nodeId, tokenHash(token)]))[0];
            if (!node || node.revoked || node.enrollment_until <= Date.now())
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Enrollment rejected');
            if (node.csr_digest) {
                if (node.csr_digest !== csrDigest)
                    throw new ControlError('ENROLLMENT_USED', 409, 'Token already exchanged');
                return json(node.enrollment_response);
            }
            const signed = await this.ca.sign(nodeId, csr);
            const response = { certificate: signed.certificate, ca: signed.ca };
            if (node.enrollment_until <= Date.now())
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Enrollment token expired before acceptance');
            await write(tx, 'UPDATE nodes SET csr_digest=?,credential_fingerprint=?,credential_until=?,enrollment_response=? WHERE id=?', [csrDigest, signed.fingerprint, signed.until, JSON.stringify(response), nodeId]);
            await write(tx, 'INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)', [signed.fingerprint, nodeId, Date.now(), signed.until]);
            return response;
        });
    }
    async machine(fingerprint: string): Promise<string> {
        const row = (await rows<{
            node_id: string;
        }>(this.db.pool, 'SELECT c.node_id FROM node_credentials c JOIN nodes n ON n.id=c.node_id WHERE c.fingerprint=? AND c.revoked=FALSE AND n.revoked=FALSE AND c.valid_until>? AND (c.retire_after IS NULL OR c.retire_after>?)', [fingerprint, Date.now(), Date.now()]))[0];
        if (!row)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node credential rejected');
        return row.node_id;
    }
    async credential(tx: Transaction, nodeId: string, fingerprint: string): Promise<number> {
        const row = (await rows<{
            valid_until: number;
            retire_after: number | null;
        }>(tx, 'SELECT c.valid_until,c.retire_after FROM node_credentials c JOIN nodes n ON n.id=c.node_id WHERE c.fingerprint=? AND c.node_id=? AND c.revoked=FALSE AND n.revoked=FALSE FOR SHARE', [fingerprint, nodeId]))[0];
        const until = row ? Math.min(row.valid_until, row.retire_after ?? row.valid_until) : 0;
        if (until <= Date.now())
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node credential expired or withdrawn');
        return until;
    }
    async state(tx: Transaction, nodeId: string): Promise<{
        facts: AuthorizedNodeFacts;
        credentialUntil: number;
        revoked: boolean;
    }> {
        const node = (await rows<NodeRecord>(tx, 'SELECT * FROM nodes WHERE id=? FOR SHARE', [nodeId]))[0];
        if (!node)
            notFound();
        return { facts: json(node.facts), credentialUntil: node.credential_until ?? 0, revoked: Boolean(node.revoked) };
    }
    async facts(tx: Transaction, nodeId: string): Promise<{
        facts: AuthorizedNodeFacts;
        credentialUntil: number;
    }> {
        const state = await this.state(tx, nodeId);
        if (state.revoked || state.credentialUntil <= Date.now())
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node authorization expired');
        return state;
    }
    async cleanupFacts(tx: Transaction, nodeId: string, scopeId: string): Promise<AuthorizedNodeFacts> {
        const state = await this.state(tx, nodeId);
        if (state.facts.scopeId !== scopeId)
            notFound();
        return state.facts;
    }
    async authorized(tx: Transaction, actor: string, forward: Forward): Promise<AuthorizedNodeFacts> {
        await this.identity.scope(tx, actor, forward.scopeId, true);
        const grant = (await rows(tx, 'SELECT g.node_id FROM node_grants g JOIN nodes n ON n.id=g.node_id WHERE g.node_id=? AND g.actor_id=? AND n.scope_id=? FOR SHARE', [forward.spec.ingress.nodeId, actor, forward.scopeId]))[0];
        if (!grant)
            notFound();
        const { facts } = await this.facts(tx, forward.spec.ingress.nodeId);
        if (!this.intentAllowed(facts, forward))
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Forward violates Node network policy');
        return facts;
    }
    async hasGrant(tx: Transaction, nodeId: string, actorId: string): Promise<boolean> { return (await rows(tx, 'SELECT node_id FROM node_grants WHERE node_id=? AND actor_id=? FOR SHARE', [nodeId, actorId])).length === 1; }
    async canExecute(tx: Transaction, actorId: string, forward: Forward): Promise<boolean> {
        if (!await this.identity.executing(tx, actorId, forward.scopeId) || !await this.hasGrant(tx, forward.spec.ingress.nodeId, actorId))
            return false;
        const node = await this.state(tx, forward.spec.ingress.nodeId);
        return !node.revoked && node.credentialUntil > Date.now() && this.intentAllowed(node.facts, forward);
    }
    async changeGrant(tx: Transaction, owner: string, scopeId: string, nodeId: string, subject: string, expectedRevision: number, allowed: boolean): Promise<{
        nodeId: string;
        actorId: string;
        revision: number;
        allowed: boolean;
        changed: boolean;
    }> {
        if (!isId(subject) || !isCounter(expectedRevision) || typeof allowed !== 'boolean')
            invalid('Valid grant subject, revision and allowed flag required');
        await this.identity.owner(tx, owner, scopeId);
        const node = await this.management(tx, owner, scopeId, nodeId);
        const current = (await rows<{
            grant_revision: number;
        }>(tx, 'SELECT grant_revision FROM nodes WHERE id=? FOR UPDATE', [nodeId]))[0]!;
        if (current.grant_revision !== expectedRevision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Node grants revision conflict');
        if (allowed) {
            if (node.revoked)
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Cannot grant a revoked Node');
            await this.identity.scope(tx, subject, scopeId, true);
        }
        const previous = await this.hasGrant(tx, nodeId, subject);
        const changed = previous !== allowed;
        const revision = current.grant_revision + (changed ? 1 : 0);
        if (revision > Number.MAX_SAFE_INTEGER)
            throw new ControlError('REVISION_EXHAUSTED', 409, 'Node grant revision exhausted');
        if (changed) {
            if (allowed)
                await write(tx, 'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', [nodeId, subject]);
            else
                await write(tx, 'DELETE FROM node_grants WHERE node_id=? AND actor_id=?', [nodeId, subject]);
            await write(tx, 'UPDATE nodes SET grant_revision=? WHERE id=?', [revision, nodeId]);
            await this.identity.audit(tx, scopeId, owner, subject, 'node_grant_change', revision, { nodeId, allowed });
        }
        return { nodeId, actorId: subject, revision, allowed, changed };
    }
    async listGrants(actor: string, scopeId: string, nodeId: string) { return this.db.transaction(async (tx) => { await this.identity.owner(tx, actor, scopeId); const node = (await rows<{
        grant_revision: number;
    }>(tx, 'SELECT grant_revision FROM nodes WHERE id=? AND scope_id=?', [nodeId, scopeId]))[0]; if (!node)
        notFound(); const grants = await rows<{
        actor_id: string;
    }>(tx, 'SELECT actor_id FROM node_grants WHERE node_id=? ORDER BY actor_id', [nodeId]); return { nodeId, revision: node.grant_revision, actorIds: grants.map(g => g.actor_id) }; }); }
    intentAllowed(facts: AuthorizedNodeFacts, forward: Forward): boolean {
        return facts.nodeId === forward.spec.ingress.nodeId && facts.scopeId === forward.scopeId && facts.allowedListenerAddresses.includes(forward.spec.ingress.listen.address) && facts.allowedPorts.includes(forward.spec.ingress.listen.port) && facts.capabilities.includes('native.direct.v1') && forward.spec.protocols.every(protocol => facts.capabilities.includes(protocol)) && targetAllowed(forward.spec.target.host, facts);
    }
    async capabilities(tx: Transaction, nodeId: string, capabilities: string[]): Promise<void> { const { facts } = await this.facts(tx, nodeId); await write(tx, 'UPDATE nodes SET facts=? WHERE id=?', [JSON.stringify({ ...facts, capabilities }), nodeId]); }
    async management(tx: Transaction, actor: string, scope: string, nodeId: string): Promise<NodeRecord> {
        await this.identity.scope(tx, actor, scope, true);
        const visible = (await rows(tx, 'SELECT id FROM nodes WHERE id=? AND scope_id=?', [nodeId, scope]))[0];
        if (!visible)
            notFound();
        await this.runtime.lockNode(tx, nodeId);
        const record = (await rows<NodeRecord>(tx, 'SELECT * FROM nodes WHERE id=? AND scope_id=? FOR UPDATE', [nodeId, scope]))[0];
        if (!record)
            notFound();
        return record;
    }
    async storePolicy(tx: Transaction, nodeId: string, policy: NodePolicy, expectedRevision: number): Promise<AuthorizedNodeFacts> {
        const current = await this.facts(tx, nodeId);
        if (current.facts.egressPolicyRevision !== expectedRevision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Node policy revision conflict');
        validatePolicy(policy);
        if (policy.egressPolicyRevision !== expectedRevision + 1 || !isCounter(policy.egressPolicyRevision))
            invalid('Policy revision must increment exactly once');
        const facts = { ...policy, nodeId, scopeId: current.facts.scopeId, capabilities: current.facts.capabilities };
        await write(tx, 'UPDATE nodes SET facts=? WHERE id=?', [JSON.stringify(facts), nodeId]);
        return facts;
    }
    async markRevoked(tx: Transaction, nodeId: string): Promise<void> { await write(tx, 'UPDATE nodes SET revoked=TRUE WHERE id=?', [nodeId]); await write(tx, 'UPDATE node_credentials SET revoked=TRUE WHERE node_id=?', [nodeId]); }
    async audit(tx: Transaction, nodeId: string, actor: string | null, kind: 'credential_rotation' | 'policy_update' | 'node_revocation', details: unknown): Promise<void> { await write(tx, 'INSERT INTO node_security_events(id,node_id,actor_id,kind,created_at,details) VALUES(?,?,?,?,?,?)', [randomUUID(), nodeId, actor, kind, Date.now(), JSON.stringify(details)]); }
    async view(actor: string, scope: string, nodeId: string) {
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actor, scope);
            const record = (await rows<NodeRecord>(tx, 'SELECT * FROM nodes WHERE id=? AND scope_id=?', [nodeId, scope]))[0];
            if (!record)
                notFound();
            const until = await this.runtime.maximumAuthorization(tx, nodeId);
            const credentials = await rows<{
                fingerprint: string;
                valid_until: number;
                retire_after: number | null;
                revoked: number;
            }>(tx, 'SELECT fingerprint,valid_until,retire_after,revoked FROM node_credentials WHERE node_id=? ORDER BY issued_at', [nodeId]);
            return { nodeId, scopeId: scope, policy: json(record.facts), revoked: Boolean(record.revoked), pendingRevocation: Boolean(record.revoked && until && until + 5000 > Date.now()), latestAuthorizationUntil: until ? new Date(until + 5000).toISOString() : null, credentials: credentials.map(c => ({ fingerprint: c.fingerprint, validUntil: new Date(c.valid_until).toISOString(), retireAfter: c.retire_after ? new Date(c.retire_after).toISOString() : null, revoked: Boolean(c.revoked) })) };
        });
    }
    async rotate(nodeId: string, fingerprint: string, epoch: number, requestId: string, csr: string): Promise<{
        certificate: string;
        ca: string;
        fingerprint: string;
        validUntil: string;
        oldCredentialUntil: string;
    }> {
        if (!isId(requestId) || typeof csr !== 'string' || csr.length > 16384 || !csr.startsWith('-----BEGIN CERTIFICATE REQUEST-----'))
            invalid('Valid request ID and CSR required');
        const requestDigest = digest({ csr });
        return this.db.transaction(async (tx) => {
            await this.runtime.lockNode(tx, nodeId, epoch);
            const current = (await rows<NodeRecord & {
                credential_fingerprint: string | null;
            }>(tx, 'SELECT * FROM nodes WHERE id=? FOR UPDATE', [nodeId]))[0];
            if (!current || current.revoked)
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node revoked');
            await this.credential(tx, nodeId, fingerprint);
            const replay = (await rows<{
                request_digest: string;
                response: unknown;
            }>(tx, 'SELECT * FROM credential_rotations WHERE node_id=? AND request_id=?', [nodeId, requestId]))[0];
            if (replay) {
                if (replay.request_digest !== requestDigest)
                    throw new ControlError('IDEMPOTENCY_CONFLICT', 409, 'Rotation request changed');
                return json(replay.response);
            }
            if (current.credential_fingerprint !== fingerprint)
                throw new ControlError('CREDENTIAL_SUPERSEDED', 409, 'Only current credential may initiate another rotation');
            const signed = await this.ca.sign(nodeId, csr);
            await this.credential(tx, nodeId, fingerprint);
            const now = Date.now();
            const overlap = Math.min(current.credential_until ?? now, now + this.overlapSeconds * 1000);
            await write(tx, 'INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)', [signed.fingerprint, nodeId, now, signed.until]);
            await write(tx, 'UPDATE node_credentials SET retire_after=? WHERE node_id=? AND fingerprint=?', [overlap, nodeId, fingerprint]);
            await write(tx, 'UPDATE nodes SET credential_fingerprint=?,credential_until=? WHERE id=?', [signed.fingerprint, signed.until, nodeId]);
            const response = { certificate: signed.certificate, ca: signed.ca, fingerprint: signed.fingerprint, validUntil: new Date(signed.until).toISOString(), oldCredentialUntil: new Date(overlap).toISOString() };
            await write(tx, 'INSERT INTO credential_rotations(node_id,request_id,request_digest,source_fingerprint,response) VALUES(?,?,?,?,?)', [nodeId, requestId, requestDigest, fingerprint, JSON.stringify(response)]);
            await this.audit(tx, nodeId, null, 'credential_rotation', { oldFingerprint: fingerprint, newFingerprint: signed.fingerprint, overlapUntil: overlap });
            return response;
        });
    }
}
export function validatePolicy(policy: NodePolicy): void {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy) || Object.keys(policy).sort().join(',') !== ['allowedDestinationCidrs', 'allowedListenerAddresses', 'allowedPorts', 'allowMetadataTargets', 'egressPolicyRevision'].sort().join(',') || !Array.isArray(policy.allowedListenerAddresses) || policy.allowedListenerAddresses.length === 0 || policy.allowedListenerAddresses.length > 256 || policy.allowedListenerAddresses.some(a => typeof a !== 'string' || normalizeIp(a) !== a) || new Set(policy.allowedListenerAddresses).size !== policy.allowedListenerAddresses.length || !Array.isArray(policy.allowedPorts) || policy.allowedPorts.length === 0 || policy.allowedPorts.length > 65535 || policy.allowedPorts.some(p => !isPort(p)) || new Set(policy.allowedPorts).size !== policy.allowedPorts.length || !isCounter(policy.egressPolicyRevision) || !Array.isArray(policy.allowedDestinationCidrs) || policy.allowedDestinationCidrs.length === 0 || policy.allowedDestinationCidrs.length > 256 || policy.allowedDestinationCidrs.some(c => typeof c !== 'string' || !validCidr(c)) || new Set(policy.allowedDestinationCidrs).size !== policy.allowedDestinationCidrs.length || typeof policy.allowMetadataTargets !== 'boolean')
        invalid('Invalid Node policy');
}
