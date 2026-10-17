import { isCounter, isId } from '@tunex/core';
import { invalid } from './errors.ts';
import { requestIdentity } from './command-request.ts';
import type { IdempotentRequests, ScopeOwnerAuthorization, TransactionBoundary } from './ports.ts';
import { tokenHash, validBearerToken } from '../modules/identity-credentials.ts';
import type { MemberChangeInput, MemberChangeState, MemberWriter } from '../modules/identity-ports.ts';
import type { NodeGrantWriter } from '../modules/node-grant-ports.ts';
import type { AccessChangeEffects } from '../modules/runtime/access-ports.ts';

export interface MemberChangeResponse {
    status: 200 | 202;
    body: Omit<MemberChangeState, 'changed'> & { operationIds: string[]; latestAuthorizationUntil: string | null };
}

export interface NodeGrantResponse {
    status: 200 | 202;
    body: { nodeId: string; actorId: string; revision: number; allowed: boolean;
        operationIds: string[]; latestAuthorizationUntil: string | null };
}

function authorizationUntil(until: number | null): string | null {
    return until ? new Date(until + 5000).toISOString() : null;
}

export class AccessCommands<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeOwnerAuthorization<Tx> & MemberWriter<Tx>;
    private readonly nodes: NodeGrantWriter<Tx>;
    private readonly idempotency: IdempotentRequests<Tx>;
    private readonly effects: AccessChangeEffects<Tx>;

    constructor(db: TransactionBoundary<Tx>, identity: ScopeOwnerAuthorization<Tx> & MemberWriter<Tx>,
        nodes: NodeGrantWriter<Tx>, idempotency: IdempotentRequests<Tx>, effects: AccessChangeEffects<Tx>) {
        if (!effects || typeof effects.member !== 'function' || typeof effects.nodeGrant !== 'function')
            throw new Error('Member and Node grant execution effects are required');
        this.db = db; this.identity = identity; this.nodes = nodes;
        this.idempotency = idempotency; this.effects = effects;
    }

    async changeMember(actorId: string, scopeId: string, subject: string, key: string | undefined,
        input: MemberChangeInput): Promise<MemberChangeResponse> {
        const command = Object.freeze({ expectedRevision: input.expectedRevision, role: input.role,
            ...(input.token === undefined ? {} : { token: input.token }) });
        if (!isId(subject) || !isCounter(command.expectedRevision, true) || !['manager', 'viewer', 'removed'].includes(command.role) ||
            command.token !== undefined && !validBearerToken(command.token)) invalid('Valid member command required');
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/members/${subject}`,
            { expectedRevision: command.expectedRevision, role: command.role, tokenHash: command.token ? tokenHash(command.token) : null });
        return this.db.transaction(async tx => {
            await this.identity.owner(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<MemberChangeResponse>(tx, request);
            if (replay) return replay;
            const member = await this.identity.changeMember(tx, actorId, scopeId, subject,
                command.expectedRevision, command.role, command.token);
            const result = await this.effects.member(tx, request, member);
            const response: MemberChangeResponse = { status: member.changed ? 202 : 200, body: {
                actorId: member.actorId, revision: member.revision, role: member.role, active: member.active,
                operationIds: result.operationIds, latestAuthorizationUntil: authorizationUntil(result.maximumAuthorization),
            } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }

    async changeNodeGrant(actorId: string, scopeId: string, nodeId: string, subject: string, key: string | undefined,
        expectedRevision: number, allowed: boolean): Promise<NodeGrantResponse> {
        if (!isId(nodeId) || !isId(subject) || !isCounter(expectedRevision) || typeof allowed !== 'boolean')
            invalid('Valid Node grant command required');
        const request = requestIdentity(actorId, scopeId, key, 'PUT',
            `/api/v1/scopes/${scopeId}/nodes/${nodeId}/grants/${subject}`, { expectedRevision, allowed });
        return this.db.transaction(async tx => {
            await this.identity.owner(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<NodeGrantResponse>(tx, request);
            if (replay) return replay;
            const grant = await this.nodes.changeGrant(tx, actorId, scopeId, nodeId, subject, expectedRevision, allowed);
            const result = await this.effects.nodeGrant(tx, request, grant);
            const response: NodeGrantResponse = { status: grant.changed ? 202 : 200, body: {
                nodeId, actorId: subject, revision: grant.revision, allowed, operationIds: result.operationIds,
                latestAuthorizationUntil: authorizationUntil(result.maximumAuthorization),
            } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
