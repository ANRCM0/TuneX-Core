import { nativeNodeCodec, nativeCommandRequest as requestIdentity, nativeIsoTime } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';

import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { NodeManagementCommand, NodeManagementWriter } from './management-contracts.ts';
import { snapshotNodeCommand } from './policy.ts';
import type { NodeManagementEffects } from './command-effects.ts';

import type { NodeChangeResponse, NodeManagementApi } from './command-api.ts';
export type { NodeChangeResponse } from './command-api.ts';

export class NodeManagementCommands<Tx> implements NodeManagementApi {
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
        if (!nativeNodeCodec.isId(nodeId)) invalid('Valid Node ID required');
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
            if(command.kind!=='classify') await this.nodes.audit(tx, nodeId, actorId, command.kind === 'revoke' ? 'node_revocation' : 'policy_update',
                { policyRevision, operationIds: result.operationIds, latestAuthorizationUntil: result.maximumAuthorization });
            const response: NodeChangeResponse = { status: 202, body: { nodeId, policyRevision, operationIds: result.operationIds,
                ...(change.resource?{resourceRevision:change.resource.resource_revision}:{}),
                latestAuthorizationUntil: result.maximumAuthorization ? nativeIsoTime(result.maximumAuthorization + 5000) : null } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
