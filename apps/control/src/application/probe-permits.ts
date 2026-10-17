import { randomUUID } from 'node:crypto';
import { deepFreeze, isCounter, isId } from '@tunex/core';
import { parseProbeResult, probeResultBody, probeResultDigest } from '@tunex/contracts';
import type { ProbeResultRequest } from '@tunex/contracts';
import { ControlError, invalid, notFound } from './errors.ts';
import { requireProbeMachine } from './probe-machine-authorization.ts';
import type { ScopeAuthorization, TransactionBoundary } from './ports.ts';
import type { ProbeMachineReader } from '../modules/probe-negotiation-ports.ts';
import type { ProbeBinding } from '../modules/probe-ports.ts';
import type { CurrentProbeInstances, ProbePermitPlans, ProbePermitRecord, ProbePermitStore } from '../modules/probe-permit-ports.ts';
import { sameProbeBinding, validProbeBinding, validProbePermit } from '../modules/probe-permit-state.ts';

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
function issueInput(actor: string, scope: string, forward: string, input: unknown, selectCurrent: boolean) {
    const command = closed(input, ['version', 'kind', 'expectedRevision', 'timeoutMs',
        ...(selectCurrent ? [] : ['instanceId', 'instanceGeneration'])]);
    const timeoutMs = command.timeoutMs === undefined ? 1000 : command.timeoutMs;
    const { expectedRevision, instanceId, instanceGeneration } = command;
    if (![actor, scope, forward].every(isId) || command.version !== 1 || command.kind !== 'tcp-connect' ||
        !isCounter(expectedRevision) || !selectCurrent && (!isCounter(instanceGeneration) || !hex(instanceId)) ||
        typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 2000)
        invalid('Valid Probe permit revision, instance and bounded timeout required');
    return { expectedRevision, instanceId, instanceGeneration, timeoutMs };
}

/** Online permit authority. Management and machine adapters never bypass this owner. */
export class ProbePermits<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly plans: ProbePermitPlans<Tx>;
    private readonly machines: ProbeMachineReader<Tx>;
    private readonly instances: CurrentProbeInstances<Tx>;
    private readonly store: ProbePermitStore<Tx>;
    private readonly clock: () => number;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>,
        plans: ProbePermitPlans<Tx>, machines: ProbeMachineReader<Tx>,
        instances: CurrentProbeInstances<Tx>, store: ProbePermitStore<Tx>, clock: () => number = Date.now) {
        this.db = db; this.identity = identity; this.plans = plans; this.machines = machines;
        this.instances = instances; this.store = store; this.clock = clock;
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
    private async authorize(tx: Tx, floor: number, permit: ProbePermitRecord) {
        const plan = await this.plans.authorize(tx, permit.actorId, permit.scopeId, permit.binding.forwardId,
            { version: 1, kind: 'tcp-connect', expectedRevision: permit.binding.forwardRevision, timeoutMs: permit.timeoutMs });
        if (plan.scopeId !== permit.scopeId || plan.timeoutMs !== permit.timeoutMs || !sameProbeBinding(plan.binding, permit.binding)) available();
        const { slot, machine } = await this.current(tx, permit.binding, permit.instanceId, permit.instanceGeneration, permit.fingerprint);
        const now = this.now(floor);
        const evidence = requireProbeMachine(machine, permit.binding.nodeId, permit.binding.bootId, permit.binding.sessionEpoch, now);
        const upper = Math.min(Date.parse(plan.expiresAt), slot.expiresAt, evidence.nodeCredentialUntil,
            evidence.credentialUntil, evidence.retireAfter ?? Infinity);
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
    async issueCurrentIn(tx: Tx, actor: string, scope: string, forward: string, input: unknown) {
        return this.issueIn(tx, actor, scope, forward, issueInput(actor, scope, forward, input, true), true);
    }

    private async issueIn(tx: Tx, actor: string, scope: string, forward: string, command: ReturnType<typeof issueInput>, selectCurrent: boolean) {
        const { expectedRevision, instanceId, instanceGeneration, timeoutMs } = command;
        await this.identity.scope(tx, actor, scope, true);
        const budget = await this.budget(tx);
        const plan = await this.plans.authorize(tx, actor, scope, forward,
            { version: 1, kind: 'tcp-connect', expectedRevision, timeoutMs });
        if (plan.scopeId !== scope || plan.binding.forwardId !== forward || plan.binding.forwardRevision !== expectedRevision ||
            plan.timeoutMs !== timeoutMs) available();
        const selected = selectCurrent ? await this.instances.readCurrent(tx, plan.binding.nodeId) : undefined;
        const selectedId = selectCurrent ? selected?.instanceId : instanceId;
        const selectedGeneration = selectCurrent ? selected?.generation : instanceGeneration;
        if (!hex(selectedId) || !isCounter(selectedGeneration)) available();
        const { slot, machine } = await this.current(tx, plan.binding, selectedId, selectedGeneration);
        const now = this.now(budget.now);
        const evidence = requireProbeMachine(machine, plan.binding.nodeId, plan.binding.bootId, plan.binding.sessionEpoch, now);
        if (slot.registeredAt > now || slot.expiresAt <= now) available();
        const retained = budget.records.filter(p => p.expiresAt + 1000 > now);
        // Consumption, revocation, process restart and new instances never refund an issuance reservation.
        if (retained.length >= 256 || retained.filter(p => p.expiresAt > now).length >= 4 ||
            retained.some(p => p.actorId === actor || p.binding.nodeId === plan.binding.nodeId))
            throw new ControlError('PROBE_PERMIT_LIMIT', 429, 'Probe issuance budget or cooldown is exhausted', true);
        const expiresAt = Math.min(now + 2000, Date.parse(plan.expiresAt), slot.expiresAt,
            evidence.nodeCredentialUntil, evidence.credentialUntil, evidence.retireAfter ?? Infinity);
        if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) available();
        const record: ProbePermitRecord = { id: randomUUID(), actorId: actor, scopeId: scope, binding: { ...plan.binding },
            instanceId: selectedId, instanceGeneration: selectedGeneration, fingerprint: slot.fingerprint, timeoutMs, issuedAt: now, expiresAt,
            state: 'issued', closedAt: null };
        if (!validProbePermit(record)) available();
        await this.finish(tx, now);
        await this.store.insert(tx, record);
        return view(record);
    }

    /** Historical receipt, not current execution authority. Scope managers may also inspect after revocation. */
    async inspect(actor: string, scope: string, id: string) {
        if (![actor, scope, id].every(isId)) invalid('Valid Probe receipt identity required');
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope, true);
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === id && p.scopeId === scope);
            if (!permit) notFound();
            const result = await this.store.result(tx, id), now = this.now(budget.now);
            if (result) {
                try {
                    if (!result.body || 'requestId' in result.body) throw new Error('body');
                    const stored = parseProbeResult('Request', JSON.stringify({ ...result.body, requestId: '0'.repeat(64) }));
                    if (probeResultDigest(stored) !== result.resultDigest || stored.permitId !== id ||
                        permit.state !== 'consumed' || !sameProbeBinding(stored.binding, permit.binding) ||
                        stored.instanceId !== permit.instanceId || stored.instanceGeneration !== permit.instanceGeneration ||
                        stored.timeoutMs !== permit.timeoutMs || Date.parse(stored.issuedAt) !== permit.issuedAt ||
                        Date.parse(stored.expiresAt) !== permit.expiresAt || Date.parse(stored.consumedAt) !== permit.closedAt ||
                        !Number.isSafeInteger(result.acceptedAt) || result.acceptedAt < Date.parse(stored.measuredAt) ||
                        result.acceptedAt >= Date.parse(stored.validUntil) || result.acceptedAt > now) throw new Error('record');
                } catch {
                    throw new ControlError('PROBE_RESULT_CORRUPT', 503, 'Invalid persisted Probe result');
                }
            }
            const withdrawnAt = budget.withdrawals.find(w => w.permitId === id)?.withdrawnAt ?? null;
            return deepFreeze({ probeId: id, forwardId: permit.binding.forwardId, state: permit.state,
                issuedAt: new Date(permit.issuedAt).toISOString(), expiresAt: new Date(permit.expiresAt).toISOString(),
                expired: permit.expiresAt <= now, withdrawnAt: withdrawnAt === null ? null : new Date(withdrawnAt).toISOString(),
                executionEnabled: false as const, health: 'unknown' as const,
                result: result ? { ...result, body: { ...result.body, binding: { ...result.body.binding } },
                    historical: true as const, expired: Date.parse(result.body.validUntil) <= now } : null });
        });
    }

    async consume(node: string, fingerprint: string, epoch: number, input: unknown) {
        const { permitId, bootId, instanceId, instanceGeneration } = machineCommand(node, fingerprint, epoch, input, true);
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === permitId);
            if (!permit || permit.state !== 'issued' || permit.binding.nodeId !== node || permit.binding.bootId !== bootId ||
                permit.binding.sessionEpoch !== epoch || permit.fingerprint !== fingerprint ||
                permit.instanceId !== instanceId || permit.instanceGeneration !== instanceGeneration) available();
            const now = await this.authorize(tx, budget.now, permit);
            await this.store.close(tx, permit.id, 'consumed', now);
            await this.finish(tx, now);
            return view({ ...permit, state: 'consumed', closedAt: now });
        });
    }

    /** Bounded, non-executable discovery. A reply reserves nothing and never mints or renews a permit. */
    async offer(node: string, fingerprint: string, epoch: number, input: unknown) {
        const { bootId, instanceId, instanceGeneration } = machineCommand(node, fingerprint, epoch, input, false);
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx);
            const { slot, machine } = await this.registered(tx, { nodeId: node, bootId, sessionEpoch: epoch },
                instanceId, instanceGeneration, fingerprint);
            let now = this.now(budget.now);
            requireProbeMachine(machine, node, bootId, epoch, now);
            if (slot.registeredAt > now || slot.expiresAt <= now) available();
            const candidates = budget.records.filter(p => p.state === 'issued' && p.expiresAt > now &&
                p.binding.nodeId === node && p.binding.bootId === bootId && p.binding.sessionEpoch === epoch &&
                p.fingerprint === fingerprint && p.instanceId === instanceId && p.instanceGeneration === instanceGeneration);
            if (candidates.length > 1) throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Ambiguous Probe delivery');
            const permit = candidates[0];
            if (permit) now = await this.authorize(tx, now, permit);
            return deepFreeze({ observedAt: now, executionEnabled: false as const, offer: permit ? {
                permitId: permit.id, instanceId, instanceGeneration, binding: { ...permit.binding }, timeoutMs: permit.timeoutMs,
                issuedAt: permit.issuedAt, expiresAt: permit.expiresAt,
            } : null });
        });
    }

    /** Current authority observation, not a lease or an executable grant. Must not be cached as continued permission. */
    async check(node: string, fingerprint: string, epoch: number, input: unknown) {
        const { permitId, bootId, instanceId, instanceGeneration } = machineCommand(node, fingerprint, epoch, input, true);
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === permitId);
            if (!permit || permit.state !== 'consumed' || budget.withdrawals.some(w => w.permitId === permitId) ||
                permit.binding.nodeId !== node || permit.binding.bootId !== bootId || permit.binding.sessionEpoch !== epoch ||
                permit.fingerprint !== fingerprint || permit.instanceId !== instanceId || permit.instanceGeneration !== instanceGeneration) available();
            const now = await this.authorize(tx, budget.now, permit);
            return deepFreeze({ ...view(permit), checkedAt: now });
        });
    }

    /** Short-lived reported evidence only. Never consumes, renews, executes or changes health. */
    async receiveResult(node: string, fingerprint: string, epoch: number, input: ProbeResultRequest) {
        const request = parseProbeResult('Request', JSON.stringify(input));
        if (request.nodeId !== node || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe result Node/session differs');
        machineCommand(node, fingerprint, epoch, { permitId: request.permitId, bootId: request.bootId,
            instanceId: request.instanceId, instanceGeneration: request.instanceGeneration }, true);
        const resultDigest = probeResultDigest(request), body = probeResultBody(request);
        return this.db.transaction(async tx => {
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === request.permitId);
            if (!permit || permit.state !== 'consumed' || budget.withdrawals.some(w => w.permitId === request.permitId) ||
                permit.fingerprint !== fingerprint || permit.instanceId !== request.instanceId || permit.instanceGeneration !== request.instanceGeneration ||
                !sameProbeBinding(permit.binding, request.binding) || permit.timeoutMs !== request.timeoutMs ||
                new Date(permit.issuedAt).toISOString() !== request.issuedAt || new Date(permit.expiresAt).toISOString() !== request.expiresAt ||
                permit.closedAt === null || new Date(permit.closedAt).toISOString() !== request.consumedAt) available();
            let now = await this.authorize(tx, budget.now, permit);
            const previous = await this.store.result(tx, permit.id);
            // Lock waits must not admit a now-expired measurement or reuse a pre-lock clock sample.
            now = this.now(now);
            if (Date.parse(request.measuredAt) > now || Date.parse(request.validUntil) <= now || permit.expiresAt <= now) available();
            if (previous) {
                try {
                    if (!previous.body || 'requestId' in previous.body) throw new Error('body');
                    const stored = parseProbeResult('Request', JSON.stringify({ ...previous.body, requestId: request.requestId }));
                    if (probeResultDigest(stored) !== previous.resultDigest || stored.permitId !== permit.id ||
                        !Number.isSafeInteger(previous.acceptedAt) || previous.acceptedAt < Date.parse(stored.measuredAt) ||
                        previous.acceptedAt >= Date.parse(stored.validUntil) || previous.acceptedAt > now)
                        throw new Error('record');
                } catch {
                    throw new ControlError('PROBE_RESULT_CORRUPT', 503, 'Invalid persisted Probe result');
                }
                if (previous.resultDigest !== resultDigest)
                    throw new ControlError('PROBE_RESULT_CONFLICT', 409, 'This Probe permit already has a different result');
                return deepFreeze({ resultDigest, acceptedAt: previous.acceptedAt, checkedAt: now, duplicate: true });
            }
            await this.store.recordResult(tx, { body, resultDigest, acceptedAt: now });
            await this.store.clock(tx, now);
            const checkedAt = this.now(now);
            if (checkedAt >= Date.parse(request.validUntil) || checkedAt >= permit.expiresAt) available();
            return deepFreeze({ resultDigest, acceptedAt: now, checkedAt, duplicate: false });
        });
    }

    async revoke(actor: string, scope: string, id: string) {
        if (![actor, scope, id].every(isId)) invalid('Valid Probe revocation identity required');
        return this.db.transaction(async tx => {
            // Any current manager may close a permit, even after its original Node grant was withdrawn.
            await this.identity.scope(tx, actor, scope, true);
            const budget = await this.budget(tx), permit = budget.records.find(p => p.id === id && p.scopeId === scope);
            if (!permit) notFound();
            const now = this.now(budget.now);
            if (permit.state === 'consumed') {
                const previous = budget.withdrawals.find(w => w.permitId === id);
                if (previous) return deepFreeze({ ...view(permit), withdrawnAt: previous.withdrawnAt });
                if (permit.closedAt === null || permit.closedAt < permit.issuedAt || permit.closedAt > now) available();
                await this.store.withdraw(tx, id, now);
                await this.finish(tx, now);
                return deepFreeze({ ...view(permit), withdrawnAt: now });
            }
            if (permit.state !== 'issued') return view(permit);
            await this.store.close(tx, permit.id, 'revoked', now);
            await this.finish(tx, now);
            return view({ ...permit, state: 'revoked', closedAt: now });
        });
    }
}
