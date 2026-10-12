import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isId, isCounter, MAX_COUNTER } from '@tunex/core';
import { ControlError, invalid, notFound } from '../application/errors.ts';
import { rows, write } from '../infrastructure/mysql.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function newToken(): string { return randomBytes(32).toString('base64url'); }
export function validBearerToken(value: unknown): value is string { return typeof value === 'string' && value.length >= 32 && value.length <= 128 && !/[\r\n]/.test(value) && /^[A-Za-z0-9_-]+$/.test(value); }
export class Identity {
    private readonly db: MySqlUnitOfWork;
    constructor(db: MySqlUnitOfWork) { this.db = db; }
    async bootstrap(scopeId: string, actorId: string, token: string): Promise<void> {
        if (!isId(scopeId) || !isId(actorId) || !validBearerToken(token))
            throw new Error('Bootstrap requires valid IDs and a random bearer token');
        await this.db.transaction(async (tx) => {
            await write(tx, 'INSERT INTO accounts(id,token_hash) VALUES(?,?)', [actorId, tokenHash(token)]);
            await write(tx, 'INSERT INTO scopes(id,owner_id) VALUES(?,?)', [scopeId, actorId]);
            await write(tx, 'INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE)', [scopeId, actorId]);
        });
    }
    async authenticate(header: string | undefined): Promise<string> {
        const token = header?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];
        const account = token ? (await rows<{
            id: string;
        }>(this.db.pool, 'SELECT id FROM accounts WHERE token_hash=?', [tokenHash(token)]))[0] : undefined;
        if (!account)
            throw new ControlError('UNAUTHENTICATED', 401, 'Valid bearer identity required');
        return account.id;
    }
    async scope(tx: Transaction, actorId: string, scopeId: string, manage = false): Promise<void> {
        const member = (await rows<{
            can_manage: number;
        }>(tx, 'SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE FOR SHARE', [scopeId, actorId]))[0];
        if (!member)
            notFound();
        if (manage && !member.can_manage)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Scope management permission required');
    }
    async owner(tx: Transaction, actorId: string, scopeId: string): Promise<void> {
        await this.scope(tx, actorId, scopeId, true);
        const scope = (await rows<{
            owner_id: string;
        }>(tx, 'SELECT owner_id FROM scopes WHERE id=? FOR SHARE', [scopeId]))[0];
        if (scope?.owner_id !== actorId)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Scope owner permission required');
    }
    async executing(tx: Transaction, actorId: string, scopeId: string): Promise<boolean> { return (await rows(tx, 'SELECT actor_id FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE AND can_manage=TRUE FOR SHARE', [scopeId, actorId])).length === 1; }
    async changeMember(tx: Transaction, owner: string, scopeId: string, subject: string, expectedRevision: number, role: 'manager' | 'viewer' | 'removed', token?: string): Promise<{
        actorId: string;
        revision: number;
        role: string;
        active: boolean;
        changed: boolean;
    }> {
        if (!isId(subject) || !isCounter(expectedRevision, true) || !['manager', 'viewer', 'removed'].includes(role) || token !== undefined && !validBearerToken(token))
            invalid('Valid member ID, expectedRevision, role and optional bearer token required');
        await this.owner(tx, owner, scopeId);
        const scope = (await rows<{
            owner_id: string;
        }>(tx, 'SELECT owner_id FROM scopes WHERE id=? FOR UPDATE', [scopeId]))[0]!;
        if (subject === scope.owner_id)
            throw new ControlError('OWNER_PROTECTED', 409, 'The scope owner cannot be removed or demoted');
        const current = (await rows<{
            revision: number;
            active: number;
            can_manage: number;
        }>(tx, 'SELECT revision,active,can_manage FROM scope_members WHERE scope_id=? AND actor_id=? FOR UPDATE', [scopeId, subject]))[0];
        if ((current?.revision ?? 0) !== expectedRevision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Member revision conflict');
        const account = (await rows<{
            token_hash: string;
        }>(tx, 'SELECT token_hash FROM accounts WHERE id=? FOR SHARE', [subject]))[0];
        if (!account) {
            if (!token || role === 'removed')
                invalid('New accounts require a bearer token and active role');
            try {
                await write(tx, 'INSERT INTO accounts(id,token_hash) VALUES(?,?)', [subject, tokenHash(token)]);
            }
            catch (error) {
                if ((error as {
                    code?: string;
                }).code === 'ER_DUP_ENTRY')
                    throw new ControlError('ACCOUNT_CONFLICT', 409, 'Account identity or bearer credential already exists');
                throw error;
            }
        }
        else if (token && account.token_hash !== tokenHash(token))
            throw new ControlError('ACCOUNT_CONFLICT', 409, 'Existing account credential cannot be replaced by a membership command');
        const active = role !== 'removed', manage = role === 'manager';
        const changed = !current || Boolean(current.active) !== active || Boolean(current.can_manage) !== manage;
        const revision = changed ? expectedRevision + 1 : expectedRevision;
        if (revision > MAX_COUNTER)
            throw new ControlError('REVISION_EXHAUSTED', 409, 'Member revision exhausted');
        if (changed) {
            await write(tx, 'INSERT INTO scope_members(scope_id,actor_id,can_manage,active,revision) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE can_manage=VALUES(can_manage),active=VALUES(active),revision=VALUES(revision)', [scopeId, subject, manage, active, revision]);
            await this.audit(tx, scopeId, owner, subject, 'member_change', revision, { role });
        }
        return { actorId: subject, revision, role, active, changed };
    }
    async audit(tx: Transaction, scopeId: string, actor: string, subject: string, kind: 'member_change' | 'node_grant_change', revision: number, details: unknown): Promise<void> { await write(tx, 'INSERT INTO access_events(id,scope_id,actor_id,subject_id,kind,revision,created_at,details) VALUES(?,?,?,?,?,?,?,?)', [randomUUID(), scopeId, actor, subject, kind, revision, Date.now(), JSON.stringify(details)]); }
    async listMembers(actor: string, scopeId: string) { return this.db.transaction(async (tx) => { await this.owner(tx, actor, scopeId); const members = await rows<{
        actor_id: string;
        can_manage: number;
        active: number;
        revision: number;
        owner_id: string;
    }>(tx, 'SELECT m.*,s.owner_id FROM scope_members m JOIN scopes s ON s.id=m.scope_id WHERE m.scope_id=? ORDER BY m.actor_id', [scopeId]); return { members: members.map(m => ({ actorId: m.actor_id, revision: m.revision, active: Boolean(m.active), role: m.actor_id === m.owner_id ? 'owner' : !m.active ? 'removed' : m.can_manage ? 'manager' : 'viewer' })) }; }); }
}
