import { nativeModuleId as randomUUID, nativeValueDigest as digest, nativeParseTime,
    nativeIsoTime, nativeBase64Fingerprint, nativeWallClockSource,
    nativeProbeResultRequest as resultRequest, probeServiceSelection, probeEchoServiceSelection,
    verifyProbeEchoProof, nativeProbeEchoInvocation, nativeProbeEchoNonce, probeEchoInvocationDigest } from '../../compatibility/public.ts';
import { deepFreeze, isCounter, isId } from '@tunex/core';
import type { ProbeResultRequest, ProbeTypesResultRequest, ProbeServicesResultRequest, ProbeServiceSelection, ProbeServiceContext } from '../../compatibility/public.ts';
import type { ProbeEchoResultRequest, ProbeEchoChallenge, ProbeEchoInvocation } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import { requireProbeMachine } from './machine-policy.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { ProbeMachineReader } from './machine-contracts.ts';
import type { ProbeBinding } from './plan-contracts.ts';
import type { CurrentProbeInstances } from './instance-contracts.ts';
import type { ProbePermitPlans, ProbePermitRecord, ProbePermitStore } from './permit-contracts.ts';
import type { ProbePermitOwner } from './owner-contracts.ts';
import { sameProbeBinding, validProbeBinding, validProbePermit } from './permit-state.ts';
import type { ProbeRunCapture, ProbeRunRecorder } from '../probe-history-owner/public.ts';
import { PROBE_EGRESS_MEASUREMENT, PROBE_INGRESS_MEASUREMENT, PROBE_SERVICE_MEASUREMENT, probeMeasurement,isEchoMeasurement } from './measurements.ts';
import type { ProbeMeasurement, ProbeTypeQualifications } from './measurement-contracts.ts';
import { requireProbeTypeQualification } from './qualification-policy.ts';
import { parseProbeServiceReference } from '../observation-service-owner/public.ts';

const measurementOf=(value:ProbePermitRecord):ProbeMeasurement=>value.measurement??PROBE_EGRESS_MEASUREMENT;
function permitServiceSelection(permit:ProbePermitRecord):ProbeServiceSelection {
    const context=permit.serviceContext!;
    return isEchoMeasurement(permit.measurement)?probeEchoServiceSelection(context):probeServiceSelection(context as ProbeServiceContext);
}
const hex = (value: unknown): value is string => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
function closed(input: unknown, keys: string[]): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).some(k => !keys.includes(k))) invalid('Closed Probe permit request required');
    return input as Record<string, unknown>;
}
function available(): never { throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Current unused Probe permit and binding required'); }
function machineCommand(node: string, fingerprint: string, epoch: number, input: unknown, withPermit: boolean) {
    const command = closed(input, ['bootId', 'instanceId', 'instanceGeneration', ...(withPermit ? ['permitId'] : [])]);
    const { permitId, bootId, instanceId, instanceGeneration } = command;
    if (![node, bootId].every(isId) || withPermit && !isId(permitId) || !hex(fingerprint) || !hex(instanceId) ||
        !isCounter(epoch) || !isCounter(instanceGeneration)) invalid('Valid current Probe machine required');
    return { permitId: permitId as string, bootId: bootId as string, instanceId, instanceGeneration };
}
function view(record: ProbePermitRecord) {
    const { fingerprint: _, ...publicRecord } = record;
    return deepFreeze({ ...publicRecord, binding: { ...record.binding }, executionEnabled: false as const,
        dispatch: 'not-implemented' as const });
}
function managementView(record:ProbePermitRecord) {
    const {serviceContext,...rest}=view(record);
    return deepFreeze({...rest,...(serviceContext?{service:probeEchoServiceSelection(serviceContext)}:{})});
}
function serviceMatches(record:ProbePermitRecord,selection:ProbeServiceSelection|null|undefined):boolean {
    return record.serviceContext?selection!==null&&selection!==undefined&&digest(probeEchoServiceSelection(record.serviceContext))===digest(selection):selection===null;
}
function echoInvocation(record:ProbePermitRecord,nonce:string):ProbeEchoInvocation {
    if(!isEchoMeasurement(record.measurement)||!record.serviceContext)available();
    return nativeProbeEchoInvocation(record,()=>record.serviceContext!,()=>nonce);
}
function challengeMatches(record:ProbePermitRecord,challenge:ProbeEchoChallenge|null|undefined):boolean {
    return digest(record.echoChallenge??null)===digest(challenge??null);
}
function resultPinMatches(record:ProbePermitRecord,request:ProbeResultRequest|ProbeTypesResultRequest|ProbeServicesResultRequest|ProbeEchoResultRequest):boolean {
    if(request.probeVersion===4&&isEchoMeasurement(request.measurement)) {
        if(!challengeMatches(record,request.challenge))return false;
        return request.echo===null||record.serviceContext!==undefined&&record.echoChallenge!==undefined&&
            verifyProbeEchoProof(record.serviceContext,echoInvocation(record,record.echoChallenge.nonce),record.echoChallenge,request.echo);
    }
    if((request.probeVersion!==3&&request.probeVersion!==4)||request.measurement!==PROBE_SERVICE_MEASUREMENT||request.tls===null)return true;
    return record.serviceContext!==undefined&&record.serviceContext.config.version===1&&request.tls.leafFingerprint===
        nativeBase64Fingerprint(record.serviceContext.config.trust.certificateDer);
}
function issueInput(actor: string, scope: string, forward: string, input: unknown, selectCurrent: boolean) {
    const command = closed(input, ['version', 'kind', 'expectedRevision', 'timeoutMs', 'service',
        ...(selectCurrent ? [] : ['instanceId', 'instanceGeneration'])]);
    const timeoutMs = command.timeoutMs === undefined ? 1000 : command.timeoutMs;
    const { expectedRevision, instanceId, instanceGeneration } = command;
    if (![actor, scope, forward].every(isId) || command.version !== 1 || !['tcp-connect','tcp-ingress-connect','tcp-ingress-tls','tcp-ingress-echo','udp-ingress-echo','tcp-path-echo','udp-path-echo'].includes(command.kind as string) ||
        !isCounter(expectedRevision) || !selectCurrent && (!isCounter(instanceGeneration) || !hex(instanceId)) ||
        typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 2000)
        invalid('Valid Probe permit revision, instance and bounded timeout required');
    const controlled=['tcp-ingress-tls','tcp-ingress-echo','udp-ingress-echo','tcp-path-echo','udp-path-echo'].includes(command.kind as string);
    const service=controlled?parseProbeServiceReference(command.service):undefined;
    if(!controlled&&Object.hasOwn(command,'service'))invalid('Only controlled Probe kinds accept a service reference');
    return { expectedRevision, instanceId, instanceGeneration, timeoutMs,kind:command.kind as 'tcp-connect'|'tcp-ingress-connect'|'tcp-ingress-tls'|'tcp-ingress-echo'|'udp-ingress-echo'|'tcp-path-echo'|'udp-path-echo',...(service?{service}:{}) };
}

/** Online permit authority. Management and machine adapters never bypass this owner. */
export class ProbePermits<Tx> implements ProbePermitOwner<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly plans: ProbePermitPlans<Tx>;
    private readonly machines: ProbeMachineReader<Tx>;
    private readonly instances: CurrentProbeInstances<Tx>;
    private readonly store: ProbePermitStore<Tx>;
    private readonly clock: () => number;
    private readonly history: ProbeRunRecorder<Tx> | undefined;
    private readonly types:ProbeTypeQualifications<Tx>|undefined;
    private readonly access:import('../../framework/public.ts').ResourceReadAccess<Tx>;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, access: import('../../framework/public.ts').ResourceReadAccess<Tx>,
        plans: ProbePermitPlans<Tx>, machines: ProbeMachineReader<Tx>,
        instances: CurrentProbeInstances<Tx>, store: ProbePermitStore<Tx>, clock: () => number = nativeWallClockSource(), history?: ProbeRunRecorder<Tx>,types?:ProbeTypeQualifications<Tx>) {
        this.access=access;

        this.db = db; this.identity = identity; this.plans = plans; this.machines = machines;
        this.instances = instances; this.store = store; this.clock = clock; this.history = history;this.types=types;
    }

    private async recordHistory(tx: Tx, permit: ProbePermitRecord, kind: ProbeRunCapture['kind'], at: number, result: ProbeRunCapture['result'] = null) {
        if (!this.history) return;
        // Deliberately exclude the machine fingerprint and the raw result/request body.
        await this.history.recordIn(tx, { kind, at, result, permit: {
            probeId: permit.id, scopeId: permit.scopeId, actorId: permit.actorId, binding: { ...permit.binding },
            instanceId: permit.instanceId, instanceGeneration: permit.instanceGeneration, timeoutMs: permit.timeoutMs,
            issuedAt: permit.issuedAt, expiresAt: permit.expiresAt, state: permit.state, closedAt: permit.closedAt,
            ...(permit.measurement===undefined?{}:{measurement:permit.measurement}),
            ...(permit.serviceContext?{service:permitServiceSelection(permit)}:{}),
            ...(isEchoMeasurement(permit.measurement)?{echoChallenge:permit.echoChallenge}:{}),
        } });
    }

    private now(observedAt: number): number {
        const now = this.clock();
        if (!Number.isSafeInteger(observedAt) || observedAt < 0 || !Number.isSafeInteger(now) ||
            now < observedAt || now > 8640000000000000 - 3000)
            throw new ControlError('CLOCK_UNCERTAIN', 503, 'Probe permit clock requires operator review');
        return now;
    }
    private async budget(tx: Tx) {
        const current = await this.store.lock(tx);
        if (current.records.length > 256 || current.records.some(p => !validProbePermit(p)) ||
            new Set(current.records.map(p => p.id)).size !== current.records.length ||
            current.withdrawals.length > 256 || new Set(current.withdrawals.map(w => w.permitId)).size !== current.withdrawals.length ||
            current.withdrawals.some(w => {
                const permit = current.records.find(p => p.id === w.permitId);
                return !isId(w.permitId) || !Number.isSafeInteger(w.withdrawnAt) || !permit ||
                    permit.state !== 'consumed' || permit.closedAt === null ||
                    w.withdrawnAt < Math.max(permit.closedAt, permit.issuedAt);
            }))
            throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Invalid persisted Probe permits');
        const now = this.now(current.observedAt);
        if (current.records.some(p => p.issuedAt > now) || current.withdrawals.some(w => w.withdrawnAt > now))
            throw new ControlError('CLOCK_UNCERTAIN', 503, 'Probe permit history is in the future');
        return { ...current, now };
    }
    private async current(tx: Tx, binding: ProbeBinding, instanceId: string, generation: number, fingerprint?: string) {
        if (!validProbeBinding(binding)) available();
        return this.registered(tx, binding, instanceId, generation, fingerprint);
    }
    private async registered(tx: Tx, binding: Pick<ProbeBinding, 'nodeId' | 'bootId' | 'sessionEpoch'>,
        instanceId: string, generation: number, fingerprint?: string) {
        const slot = await this.instances.readCurrent(tx, binding.nodeId);
        if (!slot || slot.nodeId !== binding.nodeId || !hex(slot.fingerprint) ||
            slot.state !== 'registered' || slot.instanceId !== instanceId || slot.generation !== generation ||
            slot.bootId !== binding.bootId || slot.sessionEpoch !== binding.sessionEpoch ||
            !Number.isSafeInteger(slot.registeredAt) || !Number.isSafeInteger(slot.expiresAt) ||
            slot.registeredAt < 0 || slot.expiresAt <= slot.registeredAt || slot.expiresAt - slot.registeredAt > 30000 ||
            fingerprint !== undefined && slot.fingerprint !== fingerprint) available();
        const machine = await this.machines.read(tx, binding.nodeId, slot.fingerprint);
        return { slot, machine };
    }
    private async qualified(tx:Tx,slot:Awaited<ReturnType<CurrentProbeInstances<Tx>['readCurrent']>>,now:number,services=false,echo=false) {
        if(!slot||!this.types)available();
        const value=requireProbeTypeQualification(await this.types.get(tx,slot.nodeId),slot,now);
        if(services&&value.servicesVersion!==1)available();
        if(echo&&value.echoVersion!==1)available();
        return value;
    }
    private async authorize(tx: Tx, floor: number, permit: ProbePermitRecord,typed:boolean|'services'|'echo'=false) {
        const classification=probeMeasurement(measurementOf(permit));
        const plan = await this.plans.authorize(tx, permit.actorId, permit.scopeId, permit.binding.forwardId,
            { version: 1, kind: classification.taskKind, expectedRevision: permit.binding.forwardRevision, timeoutMs: permit.timeoutMs,
                ...(permit.serviceContext?{service:parseProbeServiceReference({serviceId:permit.serviceContext.serviceId,revision:permit.serviceContext.revision,
                    configRevision:permit.serviceContext.configRevision,configDigest:permit.serviceContext.configDigest})}:{}) });
        if (plan.scopeId !== permit.scopeId || plan.kind!==classification.taskKind||plan.point!==classification.point||plan.timeoutMs !== permit.timeoutMs || !sameProbeBinding(plan.binding, permit.binding)) available();
        if(isEchoMeasurement(permit.measurement)&&typed!=='echo')available();
        if(permit.serviceContext&&((typed!=='services'&&typed!=='echo')||!('serviceContext' in plan)||
            digest(plan.serviceContext)!==digest(permit.serviceContext)))available();
        const { slot, machine } = await this.current(tx, permit.binding, permit.instanceId, permit.instanceGeneration, permit.fingerprint);
        const now = this.now(floor);
        const evidence = requireProbeMachine(machine, permit.binding.nodeId, permit.binding.bootId, permit.binding.sessionEpoch, now);
        const qualification=typed||permit.measurement!==undefined?await this.qualified(tx,slot,now,
            typed==='services'||typed==='echo'||permit.measurement===PROBE_SERVICE_MEASUREMENT,typed==='echo'):null;
        if(permit.measurement!==undefined&&!evidence.capabilities.includes('probe.tcp-ingress-connect.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Current ingress Probe capability required');
        if(permit.measurement===PROBE_SERVICE_MEASUREMENT&&!evidence.capabilities.includes('probe.tcp-ingress-tls.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Current ingress TLS Probe capability required');
        if(isEchoMeasurement(permit.measurement)&&!evidence.capabilities.includes(
            probeMeasurement(permit.measurement!).capability))available();
        const upper = Math.min(nativeParseTime(plan.expiresAt), slot.expiresAt, evidence.nodeCredentialUntil,
            evidence.credentialUntil, evidence.retireAfter ?? Infinity,qualification?.expiresAt??Infinity);
        if (permit.issuedAt > now || permit.closedAt !== null && (permit.closedAt < permit.issuedAt || permit.closedAt > now) || permit.expiresAt <= now ||
            slot.registeredAt > now || slot.expiresAt <= now || !Number.isSafeInteger(upper) || upper < permit.expiresAt) available();
        return now;
    }
    private async finish(tx: Tx, now: number) {
        // Expired IDs may be removed: there is no caller-selected issuance ID or replay-as-insert path.
        await this.store.prune(tx, now - 1000);
        await this.store.clock(tx, now);
    }

    async issue(actor: string, scope: string, forward: string, input: unknown) {
        const command = issueInput(actor, scope, forward, input, false);
        return this.db.transaction(tx => this.issueIn(tx, actor, scope, forward, command, false));
    }

    /** Management acceptance supplies its idempotency transaction; instance selection stays locked here. */
    async issueCurrentIn(tx: Tx, actor: string, scope: string, forward: string, input: unknown, notAfter?: number) {
        if(notAfter!==undefined&&(!Number.isSafeInteger(notAfter)||notAfter<0||notAfter>8640000000000000-3000))invalid('Bounded trusted Probe issuance deadline required');
        return this.issueIn(tx, actor, scope, forward, issueInput(actor, scope, forward, input, true), true, notAfter);
    }

    private async issueIn(tx: Tx, actor: string, scope: string, forward: string, command: ReturnType<typeof issueInput>, selectCurrent: boolean, notAfter?: number) {
        const { expectedRevision, instanceId, instanceGeneration, timeoutMs,kind,service } = command;
        await this.identity.scope(tx, actor, scope, true);
        const budget = await this.budget(tx);
        const plan = await this.plans.authorize(tx, actor, scope, forward,
            { version: 1, kind, expectedRevision, timeoutMs,...(service?{service}:{}) });
        if (plan.scopeId !== scope || plan.binding.forwardId !== forward || plan.binding.forwardRevision !== expectedRevision ||
            plan.kind!==kind||plan.timeoutMs !== timeoutMs) available();
        const selected = selectCurrent ? await this.instances.readCurrent(tx, plan.binding.nodeId) : undefined;
        const selectedId = selectCurrent ? selected?.instanceId : instanceId;
        const selectedGeneration = selectCurrent ? selected?.generation : instanceGeneration;
        if (!hex(selectedId) || !isCounter(selectedGeneration)) available();
        const { slot, machine } = await this.current(tx, plan.binding, selectedId, selectedGeneration);
        const now = this.now(budget.now);
        const evidence = requireProbeMachine(machine, plan.binding.nodeId, plan.binding.bootId, plan.binding.sessionEpoch, now);
        const ingress=kind!=='tcp-connect',tls=kind==='tcp-ingress-tls',echo=kind.endsWith('-echo');
        const qualification=ingress?await this.qualified(tx,slot,now,tls||echo,echo):null;
        if(echo&&'measurement' in plan&&!evidence.capabilities.includes(probeMeasurement(plan.measurement).capability))available();
        if(ingress&&!evidence.capabilities.includes('probe.tcp-ingress-connect.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Current ingress Probe capability required');
        if(tls&&(!evidence.capabilities.includes('probe.tcp-ingress-tls.v1')||plan.kind!=='tcp-ingress-tls'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Current ingress TLS Probe capability and service context required');
        if (slot.registeredAt > now || slot.expiresAt <= now) available();
        const retained = budget.records.filter(p => p.expiresAt + 1000 > now);
        // Consumption, revocation, process restart and new instances never refund an issuance reservation.
        if (retained.length >= 256 || retained.filter(p => p.expiresAt > now).length >= 4 ||
            retained.some(p => p.actorId === actor || p.binding.nodeId === plan.binding.nodeId))
            throw new ControlError('PROBE_PERMIT_LIMIT', 429, 'Probe issuance budget or cooldown is exhausted', true);
        const expiresAt = Math.min(now + 2000, notAfter ?? Infinity, nativeParseTime(plan.expiresAt), slot.expiresAt,
            evidence.nodeCredentialUntil, evidence.credentialUntil, evidence.retireAfter ?? Infinity,qualification?.expiresAt??Infinity);
        if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) available();
        let record: ProbePermitRecord = { id: randomUUID(), actorId: actor, scopeId: scope, binding: { ...plan.binding },
            instanceId: selectedId, instanceGeneration: selectedGeneration, fingerprint: slot.fingerprint, timeoutMs, issuedAt: now, expiresAt,
            state: 'issued', closedAt: null,...(echo&&'serviceContext' in plan?{measurement:plan.measurement,serviceContext:plan.serviceContext}:
                tls&&plan.kind==='tcp-ingress-tls'?{measurement:PROBE_SERVICE_MEASUREMENT,serviceContext:plan.serviceContext}:
                ingress?{measurement:PROBE_INGRESS_MEASUREMENT}:{}) };
        if(echo){
            const nonce=nativeProbeEchoNonce();
            record={...record,echoChallenge:{nonce,invocationDigest:probeEchoInvocationDigest(echoInvocation(record,nonce))}};
        }
        if (!validProbePermit(record)) available();
        await this.finish(tx, now);
        await this.store.insert(tx, record);
        await this.recordHistory(tx, record, 'issued', now);
        return view(record);
    }

    /** Historical receipt, available to its requester or explicit Scope governance. */
    async inspect(actor: string, scope: string, id: string) {
        if (![actor, scope, id].every(isId)) invalid('Valid Probe receipt identity required');
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope, true);
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === id && p.scopeId === scope);
            if (!permit) notFound();
            if (permit.actorId !== actor && !(await this.access.principal(tx, actor, scope)).governance)
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Probe receipt belongs to another actor');
            const result = await this.store.result(tx, id), now = this.now(budget.now);
            if (result) {
                try {
                    if (!result.body || 'requestId' in result.body) throw new Error('body');
                    const parsed=resultRequest({ ...result.body, requestId: '0'.repeat(64) }),stored=parsed.request;
                    if (parsed.measurement!==measurementOf(permit)||(stored.probeVersion===3||stored.probeVersion===4)&&!serviceMatches(permit,stored.service)||!resultPinMatches(permit,stored)||
                        parsed.resultDigest !== result.resultDigest || stored.permitId !== id ||
                        permit.state !== 'consumed' || !sameProbeBinding(stored.binding, permit.binding) ||
                        stored.instanceId !== permit.instanceId || stored.instanceGeneration !== permit.instanceGeneration ||
                        stored.timeoutMs !== permit.timeoutMs || nativeParseTime(stored.issuedAt) !== permit.issuedAt ||
                        nativeParseTime(stored.expiresAt) !== permit.expiresAt || nativeParseTime(stored.consumedAt) !== permit.closedAt ||
                        !Number.isSafeInteger(result.acceptedAt) || result.acceptedAt < nativeParseTime(stored.measuredAt) ||
                        result.acceptedAt >= nativeParseTime(stored.validUntil) || result.acceptedAt > now) throw new Error('record');
                } catch {
                    throw new ControlError('PROBE_RESULT_CORRUPT', 503, 'Invalid persisted Probe result');
                }
            }
            const withdrawnAt = budget.withdrawals.find(w => w.permitId === id)?.withdrawnAt ?? null;
            return deepFreeze({ probeId: id, forwardId: permit.binding.forwardId, state: permit.state,
                ...(permit.measurement===undefined?{}:probeMeasurement(permit.measurement)),
                ...(permit.serviceContext?{service:permitServiceSelection(permit)}:{}),
                issuedAt: nativeIsoTime(permit.issuedAt), expiresAt: nativeIsoTime(permit.expiresAt),
                expired: permit.expiresAt <= now, withdrawnAt: withdrawnAt === null ? null : nativeIsoTime(withdrawnAt),
                executionEnabled: false as const, health: 'unknown' as const,
                result: result ? { ...result, body: { ...result.body, binding: { ...result.body.binding } },
                    historical: true as const, expired: nativeParseTime(result.body.validUntil) <= now } : null });
        });
    }

    async consume(node: string, fingerprint: string, epoch: number, input: unknown,measurement:ProbeMeasurement=PROBE_EGRESS_MEASUREMENT,typed:boolean|'services'|'echo'=false,service?:ProbeServiceSelection|null,challenge?:ProbeEchoChallenge|null) {
        const { permitId, bootId, instanceId, instanceGeneration } = machineCommand(node, fingerprint, epoch, input, true);
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === permitId);
            if (!permit || measurementOf(permit)!==measurement||(typed==='services'||typed==='echo')&&!serviceMatches(permit,service)||
                typed==='echo'&&!challengeMatches(permit,challenge)||permit.state !== 'issued' || permit.binding.nodeId !== node || permit.binding.bootId !== bootId ||
                permit.binding.sessionEpoch !== epoch || permit.fingerprint !== fingerprint ||
                permit.instanceId !== instanceId || permit.instanceGeneration !== instanceGeneration) available();
            const now = await this.authorize(tx, budget.now, permit,typed);
            await this.store.close(tx, permit.id, 'consumed', now);
            await this.finish(tx, now);
            await this.recordHistory(tx, { ...permit, state: 'consumed', closedAt: now }, 'consumed', now);
            return view({ ...permit, state: 'consumed', closedAt: now });
        });
    }

    /** Bounded, non-executable discovery. A reply reserves nothing and never mints or renews a permit. */
    async offer(node: string, fingerprint: string, epoch: number, input: unknown,typed:boolean|'services'|'echo'=false) {
        const { bootId, instanceId, instanceGeneration } = machineCommand(node, fingerprint, epoch, input, false);
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx);
            const { slot, machine } = await this.registered(tx, { nodeId: node, bootId, sessionEpoch: epoch },
                instanceId, instanceGeneration, fingerprint);
            let now = this.now(budget.now);
            requireProbeMachine(machine, node, bootId, epoch, now);
            if(typed)await this.qualified(tx,slot,now,typed==='services'||typed==='echo',typed==='echo');
            if (slot.registeredAt > now || slot.expiresAt <= now) available();
            const candidates = budget.records.filter(p => (typed==='echo'||!isEchoMeasurement(p.measurement)&&
                (typed==='services'||typed===true&&p.measurement!==PROBE_SERVICE_MEASUREMENT||!typed&&p.measurement===undefined))&&p.state === 'issued' && p.expiresAt > now &&
                p.binding.nodeId === node && p.binding.bootId === bootId && p.binding.sessionEpoch === epoch &&
                p.fingerprint === fingerprint && p.instanceId === instanceId && p.instanceGeneration === instanceGeneration);
            if (candidates.length > 1) throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Ambiguous Probe delivery');
            const permit = candidates[0];
            if (permit) now = await this.authorize(tx, now, permit,typed);
            return deepFreeze({ observedAt: now, executionEnabled: false as const, offer: permit ? {
                permitId: permit.id, instanceId, instanceGeneration, binding: { ...permit.binding }, timeoutMs: permit.timeoutMs,
                issuedAt: permit.issuedAt, expiresAt: permit.expiresAt,
                ...(typed?probeMeasurement(measurementOf(permit)):{}),
                ...(typed==='services'||typed==='echo'?{serviceContext:permit.serviceContext??null}:{}),
                ...(typed==='echo'?{echoChallenge:permit.echoChallenge??null}:{}),
            } : null });
        });
    }

    /** Current authority observation, not a lease or an executable grant. Must not be cached as continued permission. */
    async check(node: string, fingerprint: string, epoch: number, input: unknown,measurement:ProbeMeasurement=PROBE_EGRESS_MEASUREMENT,typed:boolean|'services'|'echo'=false,service?:ProbeServiceSelection|null,challenge?:ProbeEchoChallenge|null) {
        const { permitId, bootId, instanceId, instanceGeneration } = machineCommand(node, fingerprint, epoch, input, true);
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === permitId);
            if (!permit || measurementOf(permit)!==measurement||(typed==='services'||typed==='echo')&&!serviceMatches(permit,service)||
                typed==='echo'&&!challengeMatches(permit,challenge)||permit.state !== 'consumed' || budget.withdrawals.some(w => w.permitId === permitId) ||
                permit.binding.nodeId !== node || permit.binding.bootId !== bootId || permit.binding.sessionEpoch !== epoch ||
                permit.fingerprint !== fingerprint || permit.instanceId !== instanceId || permit.instanceGeneration !== instanceGeneration) available();
            const now = await this.authorize(tx, budget.now, permit,typed);
            return deepFreeze({ ...view(permit), checkedAt: now });
        });
    }

    /** Short-lived reported evidence only. Never consumes, renews, executes or changes health. */
    async receiveResult(node: string, fingerprint: string, epoch: number, input: ProbeResultRequest|ProbeTypesResultRequest|ProbeServicesResultRequest|ProbeEchoResultRequest) {
        const parsed=resultRequest(input),request=parsed.request,typed=request.probeVersion===4?'echo':request.probeVersion===3?'services':request.probeVersion===2;
        if (request.nodeId !== node || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe result Node/session differs');
        machineCommand(node, fingerprint, epoch, { permitId: request.permitId, bootId: request.bootId,
            instanceId: request.instanceId, instanceGeneration: request.instanceGeneration }, true);
        const {resultDigest,body}=parsed;
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === request.permitId);
            if (!permit || measurementOf(permit)!==parsed.measurement||(request.probeVersion===3||request.probeVersion===4)&&!serviceMatches(permit,request.service)||permit.state !== 'consumed' || budget.withdrawals.some(w => w.permitId === request.permitId) ||
                permit.fingerprint !== fingerprint || permit.instanceId !== request.instanceId || permit.instanceGeneration !== request.instanceGeneration ||
                !sameProbeBinding(permit.binding, request.binding) || permit.timeoutMs !== request.timeoutMs ||
                nativeIsoTime(permit.issuedAt) !== request.issuedAt || nativeIsoTime(permit.expiresAt) !== request.expiresAt ||
                permit.closedAt === null || nativeIsoTime(permit.closedAt) !== request.consumedAt) available();
            if(!resultPinMatches(permit,request))available();
            let now = await this.authorize(tx, budget.now, permit,typed);
            const previous = await this.store.result(tx, permit.id);
            // Lock waits must not admit a now-expired measurement or reuse a pre-lock clock sample.
            now = this.now(now);
            if (nativeParseTime(request.measuredAt) > now || nativeParseTime(request.validUntil) <= now || permit.expiresAt <= now) available();
            if (previous) {
                try {
                    if (!previous.body || 'requestId' in previous.body) throw new Error('body');
                    const parsedStored=resultRequest({ ...previous.body, requestId: request.requestId }),stored=parsedStored.request;
                    if (parsedStored.measurement!==measurementOf(permit)||(stored.probeVersion===3||stored.probeVersion===4)&&!serviceMatches(permit,stored.service)||!resultPinMatches(permit,stored)||parsedStored.resultDigest !== previous.resultDigest || stored.permitId !== permit.id ||
                        !Number.isSafeInteger(previous.acceptedAt) || previous.acceptedAt < nativeParseTime(stored.measuredAt) ||
                        previous.acceptedAt >= nativeParseTime(stored.validUntil) || previous.acceptedAt > now)
                        throw new Error('record');
                } catch {
                    throw new ControlError('PROBE_RESULT_CORRUPT', 503, 'Invalid persisted Probe result');
                }
                if (previous.resultDigest !== resultDigest)
                    throw new ControlError('PROBE_RESULT_CONFLICT', 409, 'This Probe permit already has a different result');
                return deepFreeze({ resultDigest, acceptedAt: previous.acceptedAt, checkedAt: now, duplicate: true });
            }
            await this.store.recordResult(tx, { body, resultDigest, acceptedAt: now });
            await this.recordHistory(tx, permit, 'result', now, { status: request.status, code: request.code,
                elapsedMs: request.elapsedMs, measuredAt: nativeParseTime(request.measuredAt), validUntil: nativeParseTime(request.validUntil),
                acceptedAt: now, resultDigest,
                ...(permit.measurement===PROBE_SERVICE_MEASUREMENT&&(request.probeVersion===3||request.probeVersion===4)?{tls:request.tls}:{}),
                ...(isEchoMeasurement(permit.measurement)&&request.probeVersion===4?{echo:request.echo,requestBytes:request.requestBytes,responseBytes:request.responseBytes}:{}) });
            await this.store.clock(tx, now);
            const checkedAt = this.now(now);
            if (checkedAt >= nativeParseTime(request.validUntil) || checkedAt >= permit.expiresAt) available();
            return deepFreeze({ resultDigest, acceptedAt: now, checkedAt, duplicate: false });
        });
    }

    async revoke(actor: string, scope: string, id: string) {
        if (![actor, scope, id].every(isId)) invalid('Valid Probe revocation identity required');
        return this.db.transaction(async tx => {
            // Requester or governance may close without reacquiring execution use rights.
            await this.identity.scope(tx, actor, scope, true);
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === id && p.scopeId === scope);
            if (!permit) notFound();
            if (permit.actorId !== actor && !(await this.access.principal(tx, actor, scope)).governance)
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Probe receipt belongs to another actor');
            const now = this.now(budget.now);
            if (permit.state === 'consumed') {
                const previous = budget.withdrawals.find(w => w.permitId === id);
                if (previous) return deepFreeze({ ...managementView(permit), withdrawnAt: previous.withdrawnAt });
                if (permit.closedAt === null || permit.closedAt < permit.issuedAt || permit.closedAt > now) available();
                await this.store.withdraw(tx, id, now);
                await this.finish(tx, now);
                await this.recordHistory(tx, permit, 'withdrawn', now);
                return deepFreeze({ ...managementView(permit), withdrawnAt: now });
            }
            if (permit.state !== 'issued') return managementView(permit);
            await this.store.close(tx, permit.id, 'revoked', now);
            await this.finish(tx, now);
            await this.recordHistory(tx, { ...permit, state: 'revoked', closedAt: now }, 'revoked', now);
            return managementView({ ...permit, state: 'revoked', closedAt: now });
        });
    }
}
