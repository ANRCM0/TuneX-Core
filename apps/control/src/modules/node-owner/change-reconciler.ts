import { ControlError } from '../../framework/public.ts';
import type { RequestIdentity } from '../../framework/public.ts';
import type { NodeForwardReferences } from '../forward-owner/public.ts';
import type { NodeManagementChange } from './management-contracts.ts';
import type { NodeManagementExecution } from './execution-ports.ts';
import type { AccessExecutionResult } from '../identity-owner/public.ts';
import type { NodeManagementEffects } from './command-effects.ts';

export class NodeChangeReconciler<Tx> implements NodeManagementEffects<Tx> {
    private readonly forwards: NodeForwardReferences<Tx>;
    private readonly execution: NodeManagementExecution<Tx>;

    constructor(forwards: NodeForwardReferences<Tx>, execution: NodeManagementExecution<Tx>) {
        this.forwards = forwards; this.execution = execution;
    }

    async reconcile(tx: Tx, request: RequestIdentity, change: NodeManagementChange): Promise<AccessExecutionResult> {
        if (change.facts.nodeId !== change.nodeId || change.facts.scopeId !== request.scopeId)
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Node management facts differ from their owner context');
        const operationIds: string[] = [], affectedNodes = new Set([change.nodeId]);
        for (const forward of await this.forwards.forReferencedNode(tx, change.nodeId)) {
            if (forward.scopeId !== request.scopeId)
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Node reference belongs to another scope');
            await this.execution.lock(tx, forward);
            if (forward.spec.path) for (const id of await this.execution.nodeIDs(tx, forward)) affectedNodes.add(id);
            const sourceActor = await this.forwards.authorizer(tx, forward.id);
            const canRun = change.kind !== 'revoke' && Boolean(sourceActor && await this.execution.allowed(tx, sourceActor, forward));
            if (canRun && forward.spec.enabled) await this.execution.transition(tx, sourceActor!, forward);
            const operationId = await this.execution.accept(tx, forward, request, canRun ? 'policy' : 'revoke');
            operationIds.push(operationId);
            if (canRun && forward.spec.enabled) await this.execution.assertCapacity(tx, forward);
            if (change.kind !== 'revoke' && !canRun) await this.execution.denyIntent(tx, operationId);
        }
        // Whole-Node revocation must commit even when removal Snapshots cannot fit.
        if (change.kind !== 'revoke') await this.execution.assertNodeCapacity(tx, change.facts);
        let maximumAuthorization: number | null = null;
        for (const nodeId of affectedNodes) {
            const until = await this.execution.maximumAuthorization(tx, nodeId);
            if (until !== null) maximumAuthorization = Math.max(maximumAuthorization ?? 0, until);
        }
        return { operationIds, maximumAuthorization };
    }
}
