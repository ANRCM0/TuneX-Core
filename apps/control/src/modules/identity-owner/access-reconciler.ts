import type { Forward } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { RequestIdentity } from '../../framework/public.ts';
import type { ActorForwardReferences } from '../forward-owner/public.ts';
import type { MemberChangeState } from './contracts.ts';
import type { NodeGrantState } from '../node-owner/public.ts';
import type { AccessChangeEffects, AccessExecutionResult } from './command-effects.ts';
import type { AccessExecution } from './execution-ports.ts';

/** Two explicit policies over the existing Runtime host, not another execution owner. */
export class AccessChangeReconciler<Tx> implements AccessChangeEffects<Tx> {
    private readonly forwards: ActorForwardReferences<Tx>;
    private readonly execution: AccessExecution<Tx>;

    constructor(forwards: ActorForwardReferences<Tx>, execution: AccessExecution<Tx>) {
        this.forwards = forwards; this.execution = execution;
    }

    private checkScope(request: RequestIdentity, forward: Forward): void {
        if (forward.scopeId !== request.scopeId)
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Actor reference belongs to another scope');
    }

    private async cutoff(tx: Tx, nodeIds: Iterable<string>): Promise<number | null> {
        let maximum: number | null = null;
        for (const nodeId of nodeIds) {
            const until = await this.execution.maximumAuthorization(tx, nodeId);
            if (until !== null) maximum = Math.max(maximum ?? 0, until);
        }
        return maximum;
    }

    async member(tx: Tx, request: RequestIdentity, member: MemberChangeState): Promise<AccessExecutionResult> {
        const operationIds: string[] = [];
        let maximumAuthorization: number | null = null;
        if (member.changed) {
            for (const candidate of await this.forwards.forActor(tx, request.scopeId, member.actorId)) {
                this.checkScope(request, candidate);
                await this.execution.lock(tx, candidate);
                const forward = await this.forwards.record(tx, request.scopeId, candidate.id);
                this.checkScope(request, forward);
                if (forward.deleting || await this.forwards.authorizer(tx, forward.id) !== member.actorId) continue;
                const allowed = member.role === 'manager' && await this.execution.allowed(tx, member.actorId, forward);
                if (allowed && forward.spec.enabled) await this.execution.transition(tx, member.actorId, forward);
                operationIds.push(await this.execution.accept(tx, forward, request, allowed ? 'policy' : 'revoke'));
                // Even disabled intents may have outstanding cleanup to fit in a Snapshot.
                if (allowed) await this.execution.assertCapacity(tx, forward);
                const until = await this.cutoff(tx, forward.spec.path ?
                    await this.execution.nodeIDs(tx, forward) : [forward.spec.ingress.nodeId]);
                if (until !== null) maximumAuthorization = Math.max(maximumAuthorization ?? 0, until);
            }
        }
        return { operationIds, maximumAuthorization };
    }

    async nodeGrant(tx: Tx, request: RequestIdentity, grant: NodeGrantState): Promise<AccessExecutionResult> {
        const operationIds: string[] = [], affectedNodes = new Set([grant.nodeId]);
        if (grant.changed) {
            for (const forward of await this.forwards.forActor(tx, request.scopeId, grant.actorId)) {
                this.checkScope(request, forward);
                if (forward.spec.ingress.nodeId !== grant.nodeId && !forward.spec.path?.via.includes(grant.nodeId)) continue;
                await this.execution.lock(tx, forward);
                if (forward.spec.path) for (const id of await this.execution.nodeIDs(tx, forward)) affectedNodes.add(id);
                if (grant.allowed && forward.spec.enabled) await this.execution.transition(tx, grant.actorId, forward);
                operationIds.push(await this.execution.accept(tx, forward, request, grant.allowed ? 'policy' : 'revoke'));
                if (grant.allowed && forward.spec.enabled) await this.execution.assertCapacity(tx, forward);
            }
        }
        await this.execution.validateNode(tx, grant.nodeId, request.scopeId, grant.allowed);
        return { operationIds, maximumAuthorization: await this.cutoff(tx, affectedNodes) };
    }
}
