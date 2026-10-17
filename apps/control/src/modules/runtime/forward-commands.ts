import type { Forward } from '@tunex/core';
import { ControlError } from '../../application/errors.ts';
import type { ForwardNodeAuthorization } from '../node-execution-ports.ts';
import type { AuthorizedNodeFacts } from '../node-management-ports.ts';
import type { ForwardAuthorizationExecution } from './authorization-ports.ts';
import type { ForwardCommandPreparation, ForwardRelayHost, ForwardResourceHost } from './forward-command-ports.ts';
import { compileDirect } from './planner.ts';

type Execution<Tx> = Pick<ForwardAuthorizationExecution<Tx>, 'lock' | 'transition' | 'assertCapacity'>;

export class ForwardCommandExecutor<Tx> implements ForwardCommandPreparation<Tx> {
    private readonly nodes: ForwardNodeAuthorization<Tx>;
    private readonly resources: ForwardResourceHost<Tx>;
    private readonly relay: ForwardRelayHost<Tx>;
    private readonly execution: Execution<Tx>;

    constructor(nodes: ForwardNodeAuthorization<Tx>, resources: ForwardResourceHost<Tx>,
        relay: ForwardRelayHost<Tx>, execution: Execution<Tx>) {
        this.nodes = nodes; this.resources = resources; this.relay = relay; this.execution = execution;
    }

    async prepareCreate(tx: Tx, actor: string, forward: Forward): Promise<void> {
        const spec = forward.spec;
        let facts: AuthorizedNodeFacts | undefined;
        if (spec.path || spec.transport) {
            if (!spec.path || !spec.transport)
                throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Relay path and Transport Profile are both required');
            for (const nodeId of [spec.ingress.nodeId, ...spec.path.via].sort()) {
                await this.nodes.authorizedRelayNode(tx, actor, forward.scopeId, nodeId);
                await this.resources.lockNode(tx, nodeId);
            }
        } else {
            facts = await this.nodes.authorized(tx, actor, forward);
            await this.resources.lockNode(tx, facts.nodeId);
            this.validateDirect(forward, facts);
        }
        const slots = (spec.path || spec.transport) ? [] : await this.resources.reserve(tx, forward);
        if (facts) compileDirect({ ...forward, spec: { ...spec, enabled: true } }, facts, slots);
    }

    async planCreate(tx: Tx, actor: string, forward: Forward): Promise<void> {
        if (forward.spec.path || forward.spec.transport) await this.relay.acceptPlan(tx, actor, forward);
    }

    async prepareUpdate(tx: Tx, actor: string, current: Forward, next: Forward, recoverySuspended: boolean): Promise<void> {
        if (next.spec.ingress.nodeId !== current.spec.ingress.nodeId) {
            const oldNode = await this.nodes.state(tx, current.spec.ingress.nodeId);
            if (!recoverySuspended || !oldNode.revoked)
                throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Live Node moves require the later multi-node coordinator');
            for (const nodeId of [current.spec.ingress.nodeId, next.spec.ingress.nodeId].sort())
                await this.resources.lockNode(tx, nodeId);
        }
        let facts: AuthorizedNodeFacts | undefined;
        if (next.spec.path || next.spec.transport) {
            await this.relay.lockNodes(tx, next);
            if (next.spec.enabled && !await this.relay.canExecute(tx, actor, next))
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Relay execution is not authorized');
        } else {
            facts = await this.nodes.authorized(tx, actor, next);
            await this.lock(tx, next);
            this.validateDirect(next, facts);
        }
        // Authorization still runs for no-op updates; only changed intents allocate a new generation.
        if (next.revision === current.revision) return;
        const slots = (next.spec.path || next.spec.transport) ? [] : await this.resources.transition(tx, current, next);
        if (facts) compileDirect({ ...next, spec: { ...next.spec, enabled: true } }, facts, slots);
    }

    async planUpdate(tx: Tx, actor: string, forward: Forward): Promise<void> {
        if ((forward.spec.path || forward.spec.transport) && forward.spec.enabled)
            await this.relay.acceptPlan(tx, actor, forward);
    }

    async lock(tx: Tx, forward: Forward): Promise<void> { await this.execution.lock(tx, forward); }

    async lockRemoval(tx: Tx, forward: Forward): Promise<void> {
        if (forward.spec.path) await this.relay.lockNodes(tx, forward);
        else await this.resources.lockNode(tx, forward.spec.ingress.nodeId);
    }

    async prepareRetry(tx: Tx, actor: string, forward: Forward): Promise<void> {
        if (forward.spec.path) await this.nodes.authorizedRelayNode(tx, actor, forward.scopeId, forward.spec.ingress.nodeId);
        else await this.nodes.authorized(tx, actor, forward);
        await this.lock(tx, forward);
        if (forward.spec.enabled) await this.execution.transition(tx, actor, forward);
    }

    async assertCapacity(tx: Tx, forward: Forward): Promise<void> { await this.execution.assertCapacity(tx, forward); }

    private validateDirect(forward: Forward, facts: AuthorizedNodeFacts): void {
        compileDirect({ ...forward, spec: { ...forward.spec, enabled: true } }, facts,
            forward.spec.protocols.map(protocol => ({ nodeId: facts.nodeId, forwardId: forward.id, protocol,
                port: forward.spec.ingress.listen.port, bindingFence: 1, deploymentGeneration: 1 })));
    }
}
