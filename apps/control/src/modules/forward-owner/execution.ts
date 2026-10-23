import type { Forward } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { ForwardNodeAuthorization } from '../node-owner/public.ts';
import type { ForwardAuthorizationExecution } from './execution-contracts.ts';
import type { ForwardCommandPreparation } from './command-ports.ts';
import type { ForwardRelayHost, ForwardResourceHost } from './execution-contracts.ts';
import type { ForwardExecutionAdapter } from './execution-contracts.ts';
import { ForwardExecutionRegistry } from './execution-registry.ts';
import { nativeForwardAdapters } from './native-adapters.ts';

type Execution<Tx> = Pick<ForwardAuthorizationExecution<Tx>, 'lock' | 'transition' | 'assertCapacity'>;

/** Shared host rules surround the selected compiler; adapters do not accept Operations. */
export class ForwardCommandExecutor<Tx> implements ForwardCommandPreparation<Tx> {
    private readonly nodes: ForwardNodeAuthorization<Tx>;
    private readonly resources: ForwardResourceHost<Tx>;
    private readonly execution: Execution<Tx>;
    private readonly adapters:ForwardExecutionRegistry<Tx>;

    constructor(nodes: ForwardNodeAuthorization<Tx>, resources: ForwardResourceHost<Tx>,
        relay: ForwardRelayHost<Tx>, execution: Execution<Tx>,
        adapters:readonly ForwardExecutionAdapter<Tx>[]=nativeForwardAdapters(nodes,resources,relay,execution)) {
        this.nodes = nodes; this.resources = resources; this.execution = execution;
        this.adapters=new ForwardExecutionRegistry(adapters);
    }

    async prepareCreate(tx: Tx, actor: string, forward: Forward): Promise<void> {
        await this.adapters.select(forward).prepareCreate(tx,actor,forward);
    }

    async planCreate(tx: Tx, actor: string, forward: Forward): Promise<void> {
        await this.adapters.select(forward).planCreate(tx,actor,forward);
    }

    async prepareUpdate(tx: Tx, actor: string, current: Forward, next: Forward, recoverySuspended: boolean): Promise<void> {
        if (next.spec.ingress.nodeId !== current.spec.ingress.nodeId) {
            const oldNode = await this.nodes.state(tx, current.spec.ingress.nodeId);
            if (!recoverySuspended || !oldNode.revoked)
                throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Live Node moves require the later multi-node coordinator');
            for (const nodeId of [current.spec.ingress.nodeId, next.spec.ingress.nodeId].sort())
                await this.resources.lockNode(tx, nodeId);
        }
        await this.adapters.select(next).prepareUpdate(tx,actor,current,next);
    }

    async planUpdate(tx: Tx, actor: string, forward: Forward): Promise<void> {
        await this.adapters.select(forward).planUpdate(tx,actor,forward);
    }

    async lock(tx: Tx, forward: Forward): Promise<void> { await this.execution.lock(tx, forward); }

    async lockOwnership(tx: Tx, forward: Forward): Promise<void> { await this.resources.lockOwnership(tx, forward); }

    async lockRemoval(tx: Tx, forward: Forward): Promise<void> {
        await this.adapters.select(forward).lockRemoval(tx,forward);
    }

    async prepareRetry(tx: Tx, actor: string, forward: Forward): Promise<void> {
        await this.adapters.select(forward).authorizeRetry(tx,actor,forward);
        await this.lock(tx, forward);
        if (forward.spec.enabled) await this.execution.transition(tx, actor, forward);
    }

    async assertCapacity(tx: Tx, forward: Forward): Promise<void> { await this.execution.assertCapacity(tx, forward); }

}
