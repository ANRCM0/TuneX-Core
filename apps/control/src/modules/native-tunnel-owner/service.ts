import { deepFreeze } from '@tunex/core';
import type { PathTemplateCommandApi, PathTemplateQueryApi } from '../path-owner/public.ts';
import type { PathBindingApi } from '../path-owner/public.ts';
import type { ForwardBindingApi } from '../forward-owner/public.ts';
import type { NativeTunnelApi } from './contracts.ts';

export const NATIVE_TUNNEL_MANAGEMENT = deepFreeze({
    version: 1,
    kind: 'native-logical-tunnel',
    backingResource: 'path-template',
    configurationReuse: true,
    physicalConnectionSharing: false,
    allocationOwner: 'forward-runtime',
    health: 'not-assessed',
} as const);

/** A business view over existing owners; the legacy type parameter exposes no transaction API. */
export class NativeTunnels<_Tx> implements NativeTunnelApi {
    private readonly queries: PathTemplateQueryApi;
    private readonly commands: PathTemplateCommandApi;
    private readonly bindings: PathBindingApi;
    private readonly forwards: Pick<ForwardBindingApi, 'applyPath'>;
    constructor(
        queries: PathTemplateQueryApi,
        commands: PathTemplateCommandApi,
        bindings: PathBindingApi,
        forwards: Pick<ForwardBindingApi, 'applyPath'>,
    ) {
        this.queries = queries; this.commands = commands; this.bindings = bindings; this.forwards = forwards;
    }

    async list(...args: Parameters<PathTemplateQueryApi['list']>) {
        const page = await this.queries.list(...args);
        return deepFreeze({ ...page, items: page.items.map(item => ({ ...item, tunnelId: item.templateId })),
            management: NATIVE_TUNNEL_MANAGEMENT });
    }

    async get(...args: Parameters<PathTemplateQueryApi['get']>) {
        const record = await this.queries.get(...args);
        return deepFreeze({ ...record, tunnelId: record.templateId, management: NATIVE_TUNNEL_MANAGEMENT,
            topology: record.config.nodes.map((nodeId, index) => ({ nodeId,
                role: index === 0 ? 'ingress' : index === record.config.nodes.length - 1 ? 'egress' : 'transit',
                endpointRevision: index === 0 ? null : record.config.endpoints[index - 1]!.revision,
            })),
        });
    }

    // Preserve canonical request digests and durable receipts across both API names.
    publish(...args: Parameters<PathTemplateCommandApi['publish']>) { return this.commands.publish(...args); }
    archive(...args: Parameters<PathTemplateCommandApi['archive']>) { return this.commands.archive(...args); }
    binding(...args: Parameters<PathBindingApi['get']>) { return this.bindings.get(...args); }
    preview(...args: Parameters<PathBindingApi['preview']>) { return this.bindings.preview(...args); }
    references(...args: Parameters<PathBindingApi['references']>) { return this.bindings.references(...args); }
    apply(...args: Parameters<ForwardBindingApi['applyPath']>) { return this.forwards.applyPath(...args); }
}
