import { deepFreeze, isCounter, isId, ipBytes, parseForward } from '@tunex/core';
import { ControlError, invalid } from './errors.ts';
import type { ScopeAuthorization, TransactionBoundary } from './ports.ts';
import type { DirectConfig } from '@tunex/contracts';
import type { ForwardProbePlan, ProbeIntents, ProbeNodes, PublishedProbeReader } from '../modules/probe-ports.ts';
import { targetAllowed } from '../modules/target-policy.ts';

function request(actor: string, scopeId: string, id: string, input: unknown) {
    if (!isId(actor) || !isId(scopeId) || !isId(id)) invalid('Valid probe identity required');
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).some(key => !['version', 'kind', 'expectedRevision', 'timeoutMs'].includes(key)))
        invalid('Closed probe-plan request required');
    const command = input as Record<string, unknown>, revision = command.expectedRevision;
    const timeoutMs = command.timeoutMs === undefined ? 1000 : command.timeoutMs;
    if (command.version !== 1 || command.kind !== 'tcp-connect' || !isCounter(revision) ||
        typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 2000)
        invalid('Supported probe kind/version, expectedRevision and bounded timeoutMs required');
    return { revision, timeoutMs };
}

/** Read-only authorization preflight. Its output cannot authorize Agent network work. */
export class ForwardProbePlans<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly intents: ProbeIntents<Tx>;
    private readonly nodes: ProbeNodes<Tx>;
    private readonly published: PublishedProbeReader<Tx>;
    private readonly clockSkewMs: number;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, intents: ProbeIntents<Tx>,
        nodes: ProbeNodes<Tx>, published: PublishedProbeReader<Tx>, clockSkewMs: number) {
        if (!Number.isSafeInteger(clockSkewMs) || clockSkewMs < 0) invalid('Invalid probe clock policy');
        this.db = db; this.identity = identity; this.intents = intents; this.nodes = nodes;
        this.published = published; this.clockSkewMs = clockSkewMs;
    }
    async plan(actor: string, scopeId: string, id: string, input: unknown): Promise<ForwardProbePlan> {
        const parsed = request(actor, scopeId, id, input);
        return this.db.transaction(tx => this.authorize(tx, actor, scopeId, id,
            { version: 1, kind: 'tcp-connect', expectedRevision: parsed.revision, timeoutMs: parsed.timeoutMs }));
    }
    /** Trusted caller supplies its transaction and locking readers; still returns only a plan. */
    async authorize(tx: Tx, actor: string, scopeId: string, id: string, input: unknown): Promise<ForwardProbePlan> {
        const { revision, timeoutMs } = request(actor, scopeId, id, input);
        await this.identity.scope(tx, actor, scopeId, true);
        const record = await this.intents.record(tx, scopeId, id);
        const parsed = parseForward({ id: record.id, scopeId: record.scopeId, revision: record.revision, spec: record.spec });
        if (!parsed.ok || parsed.value.id !== id || parsed.value.scopeId !== scopeId)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Forward intent is unavailable');
        const forward = parsed.value;
        if (forward.revision !== revision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Forward revision conflict');
        if (record.deleting || record.recoverySuspended || !forward.spec.enabled)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'An enabled, non-suspended Forward is required');
        if (forward.spec.path || forward.spec.transport || !forward.spec.protocols.includes('tcp') ||
            !ipBytes(forward.spec.target.host))
            throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Probe v1 supports Direct TCP with an IP-literal target only');
        const facts = await this.nodes.authorized(tx, actor, forward);
        if (facts.nodeId !== forward.spec.ingress.nodeId || facts.scopeId !== scopeId ||
            !targetAllowed(forward.spec.target.host, { ...facts, allowMetadataTargets: false }))
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Probe target is outside the permitted non-metadata network');
        const current = await this.published.read(tx, scopeId, facts.nodeId), now = Date.now();
        if (!current || !isId(current.bootId) || !isCounter(current.sessionEpoch) ||
            current.snapshot.nodeId !== facts.nodeId || current.snapshot.sessionEpoch !== current.sessionEpoch)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Current Node session and Snapshot required');
        const snapshot = current.snapshot;
        const matches = snapshot.assignments.filter(a => a.forwardId === id && a.protocol === 'tcp');
        const assignment = matches[0];
        if (matches.length !== 1 || !assignment || assignment.forwardRevision !== revision ||
            assignment.role !== 'direct' || assignment.phase !== 'active' ||
            assignment.driver.id !== 'native.direct.v1' || assignment.driver.schemaVersion !== 1 ||
            assignment.resource.protocol !== 'tcp' || assignment.resource.address !== forward.spec.ingress.listen.address ||
            assignment.resource.port !== forward.spec.ingress.listen.port)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Published active Direct binding must match the intent');
        const config = assignment.driver.config as DirectConfig;
        if (config.egressPolicyRevision !== facts.egressPolicyRevision ||
            config.target.host !== forward.spec.target.host || config.target.port !== forward.spec.target.port)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Published target and network policy must match');
        const issued = Date.parse(snapshot.issuedAt), valid = Date.parse(snapshot.validUntil);
        const expires = Math.min(now + 2000, current.credentialUntil, valid - this.clockSkewMs);
        if (!Number.isSafeInteger(expires) || expires <= now || !Number.isSafeInteger(issued) ||
            issued >= valid || issued > now + this.clockSkewMs)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Snapshot or credential time window unavailable');
        return deepFreeze({
            version: 1, kind: 'tcp-connect', executable: false, dispatch: 'not-implemented',
            point: 'agent-direct-egress', independentProbe: false, health: 'unknown', scopeId,
            binding: { nodeId: facts.nodeId, bootId: current.bootId, sessionEpoch: current.sessionEpoch,
                snapshotGeneration: snapshot.snapshotGeneration, assignmentId: assignment.assignmentId,
                forwardId: id, forwardRevision: revision, deploymentGeneration: assignment.deploymentGeneration,
                bindingFence: assignment.bindingFence, configDigest: assignment.driver.configDigest,
                egressPolicyRevision: config.egressPolicyRevision },
            timeoutMs, maxAttempts: 1, applicationPayloadBytes: 0,
            plannedAt: new Date(now).toISOString(), expiresAt: new Date(expires).toISOString(),
        });
    }
}
