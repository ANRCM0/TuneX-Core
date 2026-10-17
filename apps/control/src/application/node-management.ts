import { isId } from '@tunex/core';
import { invalid } from './errors.ts';
import { requestIdentity } from './command-request.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from './ports.ts';
import type { NodeManagementCommand, NodeManagementWriter } from '../modules/node-management-ports.ts';
import { snapshotNodeCommand } from '../modules/node-policy.ts';
import type { NodeManagementEffects } from '../modules/runtime/node-change-ports.ts';

export interface NodeChangeResponse {
    status: 202;
    body: { nodeId: string; policyRevision: number; operationIds: string[]; latestAuthorizationUntil: string | null };
}

export class NodeManagementCommands<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly idempotency: IdempotentRequests<Tx>;
    private readonly nodes: NodeManagementWriter<Tx>;
    private readonly effects: NodeManagementEffects<Tx>;

    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, idempotency: IdempotentRequests<Tx>,
        nodes: NodeManagementWriter<Tx>, effects: NodeManagementEffects<Tx>) {
        if (!effects || typeof effects.reconcile !== 'function') throw new Error('Whole-Node execution effects are required');
        this.db = db; this.identity = identity; this.idempotency = idempotency; this.nodes = nodes; this.effects = effects;
    }

    async change(actorId: string, scopeId: string, nodeId: string, key: string | undefined,
        input: NodeManagementCommand): Promise<NodeChangeResponse> {
        if (!isId(nodeId)) invalid('Valid Node ID required');
        const command = snapshotNodeCommand(input);
        const request = requestIdentity(actorId, scopeId, key, command.kind === 'policy' ? 'PUT' : 'POST',
            `/api/v1/scopes/${scopeId}/nodes/${nodeId}/${command.kind}`, command);
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId, true);
            const replay = await this.idempotency.claim<NodeChangeResponse>(tx, request);
            if (replay) return replay;
            const change = await this.nodes.applyManagement(tx, actorId, scopeId, nodeId, command);
            const result = await this.effects.reconcile(tx, request, change);
            const policyRevision = change.facts.egressPolicyRevision;
            await this.nodes.audit(tx, nodeId, actorId, command.kind === 'policy' ? 'policy_update' : 'node_revocation',
                { policyRevision, operationIds: result.operationIds, latestAuthorizationUntil: result.maximumAuthorization });
            const response: NodeChangeResponse = { status: 202, body: { nodeId, policyRevision, operationIds: result.operationIds,
                latestAuthorizationUntil: result.maximumAuthorization ? new Date(result.maximumAuthorization + 5000).toISOString() : null } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
