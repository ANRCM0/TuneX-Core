import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import type { ForwardSpec } from '@tunex/core';
import { parseRelayEndpoint } from '../modules/relay-endpoint-contract.ts';
import { consolePage } from './console-query.ts';
import type { ConsolePaging } from './console-query.ts';
import { ControlError, invalid, notFound } from './errors.ts';
import type { ScopeAuthorization, TransactionBoundary } from './ports.ts';

export interface TunnelNodeRecord {
    nodeId: string; revoked: boolean; credentialUntil: number | null; capabilities: unknown;
    sessionEpoch: number; snapshotGeneration: number; lastReportAt: number | null;
}
export interface TunnelPeerRecord { fingerprint: string; issuedAt: number; validUntil: number; retireAfter: number | null; revoked: boolean }
export interface TunnelReference { forwardId: string; revision: number; spec: ForwardSpec; recoverySuspended: boolean }
export interface TunnelPaging { page?: string | undefined; limit?: string | undefined }
export interface TunnelReadPort<Tx> {
    node(tx: Tx, scope: string, node: string): Promise<TunnelNodeRecord | null>;
    endpoint(tx: Tx, node: string): Promise<{ revision: number; config: unknown } | null>;
    peers(tx: Tx, node: string, now: number): Promise<{ total: number; windowCount: number; items: TunnelPeerRecord[] }>;
    references(tx: Tx, scope: string, node: string, paging: ConsolePaging): Promise<{ total: number; items: TunnelReference[] }>;
}

const timestamp = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
function integrity(message: string): never { throw new ControlError('INTEGRITY_FAILURE', 409, message); }

/** Bounded persisted metadata, never credential issuance, network validation or execution authorization. */
export class TunnelQueries<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly read: TunnelReadPort<Tx>;
    private readonly clock: () => number;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, read: TunnelReadPort<Tx>, clock: () => number = Date.now) {
        this.db = db; this.identity = identity; this.read = read; this.clock = clock;
    }

    private validate(actor: string, scope: string, node: string) {
        if (![actor, scope, node].every(isId)) invalid('Valid Scope and Node identity required');
    }
    private async node(tx: Tx, scope: string, node: string) {
        const record = await this.read.node(tx, scope, node);
        if (!record) notFound();
        if (record.nodeId !== node || typeof record.revoked !== 'boolean' || record.credentialUntil !== null && !timestamp(record.credentialUntil) ||
            !isCounter(record.sessionEpoch, true) || !isCounter(record.snapshotGeneration, true) || record.lastReportAt !== null && !timestamp(record.lastReportAt) ||
            !Array.isArray(record.capabilities) || record.capabilities.length > 256 ||
            record.capabilities.some(value => typeof value !== 'string' || !value || value.length > 128) || new Set(record.capabilities).size !== record.capabilities.length)
            integrity('Invalid persisted tunnel Node metadata');
        return { ...record, capabilities: [...record.capabilities as string[]] };
    }
    async status(actor: string, scope: string, node: string) {
        this.validate(actor, scope, node);
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope);
            const record = await this.node(tx, scope, node), now = this.clock();
            if (!timestamp(now)) integrity('Invalid metadata observation clock');
            const endpoint = await this.read.endpoint(tx, node);
            let config;
            if (endpoint) {
                if (!isCounter(endpoint.revision)) integrity('Invalid persisted Relay Endpoint revision');
                try { config = parseRelayEndpoint(endpoint.config); } catch { integrity('Invalid persisted Relay Endpoint configuration'); }
            }
            const peers = await this.read.peers(tx, node, now);
            if (!Number.isSafeInteger(peers.total) || peers.total < 0 || !Number.isSafeInteger(peers.windowCount) ||
                peers.windowCount < 0 || peers.windowCount > 2 || peers.windowCount > peers.total || !Array.isArray(peers.items) || peers.items.length > 4 ||
                new Set(peers.items.map(peer => peer.fingerprint)).size !== peers.items.length)
                integrity('Invalid bounded Relay credential metadata');
            const machineWindowOpen = !record.revoked && record.credentialUntil !== null && record.credentialUntil > now;
            const items = peers.items.map(peer => {
                if (!/^[a-f0-9]{64}$/.test(peer.fingerprint) || !timestamp(peer.issuedAt) || !timestamp(peer.validUntil) ||
                    peer.issuedAt > peer.validUntil || peer.retireAfter !== null && !timestamp(peer.retireAfter) || typeof peer.revoked !== 'boolean')
                    integrity('Invalid persisted Relay credential window');
                const effectiveUntil = record.credentialUntil === null ? null : Math.min(peer.validUntil, peer.retireAfter ?? peer.validUntil, record.credentialUntil);
                return { fingerprint: 'sha256:' + peer.fingerprint, issuedAt: new Date(peer.issuedAt).toISOString(),
                    validUntil: new Date(peer.validUntil).toISOString(), retireAfter: peer.retireAfter === null ? null : new Date(peer.retireAfter).toISOString(),
                    revoked: peer.revoked, effectiveUntil: effectiveUntil === null ? null : new Date(effectiveUntil).toISOString(),
                    recordedWindowOpen: machineWindowOpen && !peer.revoked && effectiveUntil !== null && effectiveUntil > now };
            });
            return deepFreeze({ nodeId: node, source: 'persisted-control-state', observedAt: new Date(now).toISOString(),
                health: 'unknown', executionAuthorized: false, reserved: false, networkCheck: 'not-performed', certificateVerification: 'not-performed-by-this-query',
                node: { revoked: record.revoked, credentialUntil: record.credentialUntil === null ? null : new Date(record.credentialUntil).toISOString(),
                    recordedMachineWindowOpen: machineWindowOpen, capabilities: record.capabilities, sessionEpoch: record.sessionEpoch,
                    snapshotGeneration: record.snapshotGeneration, lastReportAt: record.lastReportAt === null ? null : new Date(record.lastReportAt).toISOString() },
                endpoint: endpoint ? { revision: endpoint.revision, config: config! } : null,
                peerCredentials: { total: peers.total, recordedWindowCount: machineWindowOpen ? peers.windowCount : 0,
                    limit: 4, truncated: peers.total > items.length, selection: 'open-peer-windows-first-then-recent-metadata', items },
                consistency: 'read-committed-metadata-not-global-snapshot' });
        });
    }
    async references(actor: string, scope: string, node: string, input: TunnelPaging = {}) {
        this.validate(actor, scope, node);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(key => !['page', 'limit'].includes(key)) || input.page !== undefined && typeof input.page !== 'string' ||
            input.limit !== undefined && typeof input.limit !== 'string') invalid('Bounded tunnel reference query required');
        const paging = Object.freeze(consolePage(input.page, input.limit));
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope);
            await this.node(tx, scope, node);
            const result = await this.read.references(tx, scope, node, paging);
            if (!Number.isSafeInteger(result.total) || result.total < 0 || !Array.isArray(result.items) || result.items.length > paging.limit ||
                new Set(result.items.map(item => item.forwardId)).size !== result.items.length) integrity('Invalid bounded tunnel reference page');
            const items = result.items.map(item => {
                const parsed = parseForwardSpec(item.spec);
                if (!isId(item.forwardId) || !isCounter(item.revision) || typeof item.recoverySuspended !== 'boolean' || !parsed.ok || !parsed.value.path || !parsed.value.transport)
                    integrity('Invalid persisted tunnel reference');
                const spec = parsed.value, path = [spec.ingress.nodeId, ...spec.path!.via], index = path.indexOf(node);
                if (index < 0) integrity('Tunnel reference does not include the requested Node');
                return { forwardId: item.forwardId, revision: item.revision, enabled: spec.enabled, recoverySuspended: item.recoverySuspended,
                    protocols: spec.protocols, profileId: spec.transport!.profileId, configRevision: spec.transport!.configRevision,
                    role: index === 0 ? 'ingress' as const : index === path.length - 1 ? 'egress' as const : 'transit' as const,
                    endpointRequired: index > 0, previousNodeId: path[index - 1] ?? null, nextNodeId: path[index + 1] ?? null, path };
            });
            return deepFreeze({ nodeId: node, page: paging.page, limit: paging.limit, total: result.total, items,
                source: 'persisted-current-desired-rules', previewOnly: true, reserved: false, executionAuthorized: false,
                historicalReferencesIncluded: false, deletionSafety: 'not-proven', consistency: 'read-committed-page-not-global-snapshot' });
        });
    }
}
