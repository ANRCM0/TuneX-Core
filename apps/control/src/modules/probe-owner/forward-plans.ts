import { deepFreeze, isCounter, isId, ipBytes, parseForward } from '@tunex/core';
import { ControlError, invalid } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import { targetAllowed, nativeWallClockNow, nativeParseTime, nativeIsoTime } from '../../compatibility/public.ts';
import type { DirectConfig } from '../../compatibility/public.ts';
import type { ForwardProbePlan, ProbeIntents, ProbeNodes, PublishedProbeReader, ProbePathPlans } from './plan-contracts.ts';
import type { ProbeServiceResolver,ProbeEchoServiceResolver } from './service-contracts.ts';
import { parseProbeServiceReference } from '../observation-service-owner/public.ts';
import { probeEchoMeasurement } from './measurements.ts';
import type { ForwardProbePlanApi } from './command-api.ts';

function request(actor: string, scopeId: string, id: string, input: unknown) {
    if (!isId(actor) || !isId(scopeId) || !isId(id)) invalid('Valid probe identity required');
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).some(key => !['version', 'kind', 'expectedRevision', 'timeoutMs', 'service'].includes(key)))
        invalid('Closed probe-plan request required');
    const command = input as Record<string, unknown>, revision = command.expectedRevision;
    const timeoutMs = command.timeoutMs === undefined ? 1000 : command.timeoutMs;
    if (command.version !== 1 || !['tcp-connect','tcp-ingress-connect','tcp-ingress-tls','tcp-ingress-echo','udp-ingress-echo','tcp-path-echo','udp-path-echo'].includes(command.kind as string) || !isCounter(revision) ||
        typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 2000)
        invalid('Supported probe kind/version, expectedRevision and bounded timeoutMs required');
    const controlled=['tcp-ingress-tls','tcp-ingress-echo','udp-ingress-echo','tcp-path-echo','udp-path-echo'].includes(command.kind as string);
    const service=controlled?parseProbeServiceReference(command.service):undefined;
    if(!controlled&&Object.hasOwn(command,'service'))invalid('Only controlled Probe kinds accept a service reference');
    return { revision, timeoutMs, kind:command.kind as 'tcp-connect'|'tcp-ingress-connect'|'tcp-ingress-tls'|'tcp-ingress-echo'|'udp-ingress-echo'|'tcp-path-echo'|'udp-path-echo', ...(service?{service}:{}) };
}

/** Read-only authorization preflight. Its output cannot authorize Agent network work. */
export class ForwardProbePlans<Tx> implements ForwardProbePlanApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly intents: ProbeIntents<Tx>;
    private readonly nodes: ProbeNodes<Tx>;
    private readonly published: PublishedProbeReader<Tx>;
    private readonly clockSkewMs: number;
    private readonly services: ProbeServiceResolver<Tx> | undefined;
    private readonly echoes:ProbeEchoServiceResolver<Tx>|undefined;
    private readonly access:ResourceReadAccess<Tx>;
    private readonly paths:ProbePathPlans<Tx>|undefined;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, access: ResourceReadAccess<Tx>, intents: ProbeIntents<Tx>,
        nodes: ProbeNodes<Tx>, published: PublishedProbeReader<Tx>, clockSkewMs: number, services?: ProbeServiceResolver<Tx>,echoes?:ProbeEchoServiceResolver<Tx>,paths?:ProbePathPlans<Tx>) {
        this.access=access;

        if (!Number.isSafeInteger(clockSkewMs) || clockSkewMs < 0) invalid('Invalid probe clock policy');
        this.db = db; this.identity = identity; this.intents = intents; this.nodes = nodes;
        this.published = published; this.clockSkewMs = clockSkewMs; this.services = services;
        this.echoes=echoes;this.paths=paths;
    }
    async plan(actor: string, scopeId: string, id: string, input: unknown): Promise<ForwardProbePlan> {
        const parsed = request(actor, scopeId, id, input);
        return this.db.transaction(tx => this.authorize(tx, actor, scopeId, id,
            { version: 1, kind: parsed.kind, expectedRevision: parsed.revision, timeoutMs: parsed.timeoutMs, ...(parsed.service?{service:parsed.service}:{}) }));
    }
    /** Trusted caller supplies its transaction and locking readers; still returns only a plan. */
    async authorize(tx: Tx, actor: string, scopeId: string, id: string, input: unknown): Promise<ForwardProbePlan> {
        const { revision, timeoutMs, kind, service } = request(actor, scopeId, id, input),ingress=kind!=='tcp-connect',tls=kind==='tcp-ingress-tls';
        const echo=kind==='tcp-ingress-echo'||kind==='udp-ingress-echo',protocol=kind==='udp-ingress-echo'?'udp':'tcp';
        await this.identity.scope(tx, actor, scopeId, true);
        await this.access.owned(tx, actor, scopeId, 'forward', id);
        const record = await this.intents.record(tx, scopeId, id);
        const parsed = parseForward({ id: record.id, scopeId: record.scopeId, revision: record.revision, spec: record.spec });
        if (!parsed.ok || parsed.value.id !== id || parsed.value.scopeId !== scopeId)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Forward intent is unavailable');
        const forward = parsed.value;
        if (forward.revision !== revision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Forward revision conflict');
        if (record.deleting || record.recoverySuspended || !forward.spec.enabled)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'An enabled, non-suspended Forward is required');
        if(kind==='tcp-path-echo'||kind==='udp-path-echo'){
            if(!this.paths||!service)throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Path Echo planner unavailable');
            return this.paths.authorize(tx,actor,forward,kind,timeoutMs,service);
        }
        if (forward.spec.path || forward.spec.transport || !forward.spec.protocols.includes(protocol) ||
            !ipBytes(ingress?forward.spec.ingress.listen.address:forward.spec.target.host))
            throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Probe requires its original Direct transport and numeric observation address');
        const facts = await this.nodes.authorized(tx, actor, forward);
        if (facts.nodeId !== forward.spec.ingress.nodeId || facts.scopeId !== scopeId ||
            !targetAllowed(ingress?forward.spec.ingress.listen.address:forward.spec.target.host, { ...facts, allowMetadataTargets: false }))
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Probe target is outside the permitted non-metadata network');
        if(ingress&&!facts.capabilities.includes('probe.tcp-ingress-connect.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Explicit current ingress Probe capability required');
        if(tls&&!facts.capabilities.includes('probe.tcp-ingress-tls.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Explicit current ingress TLS Probe capability required');
        if(echo&&!facts.capabilities.includes(protocol==='tcp'?'probe.tcp-ingress-echo.v1':'probe.udp-ingress-echo.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Explicit current controlled echo Probe capability required');
        const current = await this.published.read(tx, scopeId, facts.nodeId), now = nativeWallClockNow();
        if (!current || !isId(current.bootId) || !isCounter(current.sessionEpoch) ||
            current.snapshot.nodeId !== facts.nodeId || current.snapshot.sessionEpoch !== current.sessionEpoch)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Current Node session and Snapshot required');
        const snapshot = current.snapshot;
        const matches = snapshot.assignments.filter(a => a.forwardId === id && a.protocol === protocol);
        const assignment = matches[0];
        if (matches.length !== 1 || !assignment || assignment.forwardRevision !== revision ||
            assignment.role !== 'direct' || assignment.phase !== 'active' ||
            assignment.driver.id !== 'native.direct.v1' || assignment.driver.schemaVersion !== 1 ||
            assignment.resource.protocol !== protocol || assignment.resource.address !== forward.spec.ingress.listen.address ||
            assignment.resource.port !== forward.spec.ingress.listen.port)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Published active Direct binding must match the intent');
        const config = assignment.driver.config as DirectConfig;
        if (config.egressPolicyRevision !== facts.egressPolicyRevision ||
            config.target.host !== forward.spec.target.host || config.target.port !== forward.spec.target.port)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Published target and network policy must match');
        if(tls&&(!this.services||!service||!ipBytes(forward.spec.target.host)))
            throw new ControlError('UNSUPPORTED_CAPABILITY',422,'TLS Probe requires an exact registered numeric Direct target');
        if(echo&&(!this.echoes||!service||!ipBytes(forward.spec.target.host)))
            throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Echo Probe requires an exact registered numeric Direct target');
        const tlsContext=tls?await this.services!.resolve(tx,actor,scopeId,service!):undefined;
        const echoContext=echo?await this.echoes!.resolveEcho(tx,actor,scopeId,service!,protocol):undefined;
        const serviceContext=tls?tlsContext:echoContext;
        if(serviceContext&&(serviceContext.scopeId!==scopeId||serviceContext.config.endpoint.address!==forward.spec.target.host||
            serviceContext.config.endpoint.port!==forward.spec.target.port||
            !targetAllowed(serviceContext.config.endpoint.address,{...facts,allowMetadataTargets:false})))
            throw new ControlError('AUTHORIZATION_DENIED',403,'Registered observation service must exactly match the original authorized Direct target');
        const issued = nativeParseTime(snapshot.issuedAt), valid = nativeParseTime(snapshot.validUntil);
        const expires = Math.min(now + 2000, current.credentialUntil, valid - this.clockSkewMs,
            serviceContext?serviceContext.config.validUntil-this.clockSkewMs:Infinity);
        if (!Number.isSafeInteger(expires) || expires <= now || !Number.isSafeInteger(issued) ||
            issued >= valid || issued > now + this.clockSkewMs)
            throw new ControlError('PROBE_UNAVAILABLE', 409, 'Snapshot or credential time window unavailable');
        const classification=echo?{kind:kind as 'tcp-ingress-echo'|'udp-ingress-echo',
            ...probeEchoMeasurement(protocol==='tcp'?'tcp-ingress-echo-v1':'udp-ingress-echo-v1'),serviceContext:echoContext!}:
            tls?{kind:'tcp-ingress-tls' as const,point:'agent-local-direct-ingress' as const,
            measurement:'tcp-ingress-tls-v1' as const,capability:'probe.tcp-ingress-tls.v1' as const,serviceContext:tlsContext!}:
            ingress?{kind:'tcp-ingress-connect' as const,point:'agent-local-direct-ingress' as const,
            measurement:'tcp-ingress-connect-v1' as const,capability:'probe.tcp-ingress-connect.v1' as const}:
            {kind:'tcp-connect' as const,point:'agent-direct-egress' as const};
        return deepFreeze({
            version: 1, ...classification, executable: false, dispatch: 'not-implemented',
            independentProbe: false, health: 'unknown', scopeId,
            binding: { nodeId: facts.nodeId, bootId: current.bootId, sessionEpoch: current.sessionEpoch,
                snapshotGeneration: snapshot.snapshotGeneration, assignmentId: assignment.assignmentId,
                forwardId: id, forwardRevision: revision, deploymentGeneration: assignment.deploymentGeneration,
                bindingFence: assignment.bindingFence, configDigest: assignment.driver.configDigest,
                egressPolicyRevision: config.egressPolicyRevision },
            timeoutMs, maxAttempts: 1, applicationPayloadBytes: 0,
            plannedAt: nativeIsoTime(now), expiresAt: nativeIsoTime(expires),
        });
    }
}
