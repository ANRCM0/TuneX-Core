import { ControlError } from '../../application/errors.ts';
import type { RequestIdentity } from '../../application/ports.ts';
import type { ProfileForwardReferences } from '../forwarding-ports.ts';
import type { TransportGrantEffects, TransportGrantState } from '../transport-ports.ts';
import type { ForwardAuthorizationExecution } from './authorization-ports.ts';

/** Reuses the existing Runtime host; it never owns another ledger or transaction. */
export class ProfileGrantReconciler<Tx> implements TransportGrantEffects<Tx> {
    private readonly forwards: Pick<ProfileForwardReferences<Tx>, 'forProfileActor'>;
    private readonly execution: ForwardAuthorizationExecution<Tx>;

    constructor(forwards: Pick<ProfileForwardReferences<Tx>, 'forProfileActor'>, execution: ForwardAuthorizationExecution<Tx>) {
        this.forwards = forwards; this.execution = execution;
    }

    async reconcile(tx: Tx, request: RequestIdentity, grant: TransportGrantState): Promise<string[]> {
        const operations: string[] = [];
        for (const forward of await this.forwards.forProfileActor(tx, grant.profileId, grant.actorId)) {
            if (forward.scopeId !== request.scopeId)
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Profile reference belongs to another scope');
            await this.execution.lock(tx, forward);
            const canRun = grant.allowed && await this.execution.allowed(tx, grant.actorId, forward);
            if (canRun && forward.spec.enabled) await this.execution.transition(tx, grant.actorId, forward);
            operations.push(await this.execution.accept(tx, forward, request, canRun ? 'policy' : 'revoke'));
            if (canRun && forward.spec.enabled) await this.execution.assertCapacity(tx, forward);
        }
        return operations;
    }
}
