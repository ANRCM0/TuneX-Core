import { ControlError } from '../application/errors.ts';
import type { ForwardNodeAuthorization } from './node-execution-ports.ts';
import type { TransportProfileResolver } from './transport-ports.ts';
import type { ResolvedEndpoint } from './relay-endpoint-contract.ts';
import type { PathTemplateReferences } from './path-template-ports.ts';
import type { PathTemplateConfig } from './path-template-contract.ts';
import { pathRequirements } from './path-template-contract.ts';

/** Metadata authoring checks existing grants/declarations, never online readiness or Runtime authority. */
export class NativePathReferences<Tx> implements PathTemplateReferences<Tx> {
    private readonly nodes: Pick<ForwardNodeAuthorization<Tx>, 'authorizedRelayNode'>;
    private readonly profiles: TransportProfileResolver<Tx>;
    private readonly endpoints: { resolve(tx: Tx, node: string): Promise<ResolvedEndpoint> };
    constructor(nodes: Pick<ForwardNodeAuthorization<Tx>, 'authorizedRelayNode'>, profiles: TransportProfileResolver<Tx>,
        endpoints: { resolve(tx: Tx, node: string): Promise<ResolvedEndpoint> }) {
        this.nodes = nodes; this.profiles = profiles; this.endpoints = endpoints;
    }
    async validate(tx: Tx, actor: string, scope: string, config: PathTemplateConfig) {
        const required = pathRequirements(config);
        for (const id of [...config.nodes].sort()) {
            const node = await this.nodes.authorizedRelayNode(tx, actor, scope, id);
            if (node.nodeId !== id || node.scopeId !== scope || required.some(capability => !node.capabilities.includes(capability)))
                throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Every template Node must declare the required native capabilities');
        }
        const profile = await this.profiles.resolve(tx, actor, scope, config.transport.profileId, config.transport.configRevision);
        if (profile.profileId !== config.transport.profileId || profile.revision !== config.transport.configRevision ||
            config.protocols.some(protocol => !profile.config.protocols.includes(protocol)))
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Template Profile binding or business protocols differ');
        for (const binding of [...config.endpoints].sort((a, b) => a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0)) {
            const endpoint = await this.endpoints.resolve(tx, binding.nodeId);
            if (endpoint.nodeId !== binding.nodeId || endpoint.revision !== binding.revision)
                throw new ControlError('REVISION_CONFLICT', 409, 'Template Endpoint revision changed; prepare an explicit new template proposal');
        }
        return { profileDigest: profile.configDigest };
    }
}
