import { deepFreeze, isCounter, isId, MAX_COUNTER } from '@tunex/core';
import { ControlError, invalid } from './errors.ts';
import { requireProbeMachine } from './probe-machine-authorization.ts';
import type { TransactionBoundary } from './ports.ts';
import type { ProbeMachineReader } from '../modules/probe-negotiation-ports.ts';
import type { ProbeInstanceRecord, ProbeInstanceStore } from '../modules/probe-instance-ports.ts';

export interface ProbeInstanceCommand {
    readonly bootId: string;
    readonly instanceId: string;
    readonly expectedGeneration: number;
}
export interface ProbeInstanceRegistration extends ProbeInstanceRecord {
    readonly executionEnabled: false;
}
export interface ProbeInstanceInspection {
    readonly generation: number;
    readonly state: 'absent' | 'registered' | 'revoked' | 'quarantined' | 'stale';
    readonly instance: ProbeInstanceRegistration | null;
    readonly executionEnabled: false;
}
function identity(nodeId: string, fingerprint: string, epoch: number, bootId: string) {
    if (!isId(nodeId) || !isCounter(epoch) || typeof fingerprint !== 'string' ||
        fingerprint.length !== 64 || !/^[0-9a-f]{64}$/.test(fingerprint) ||
        !isId(bootId)) invalid('Valid current Probe machine identity required');
}
function command(nodeId: string, fingerprint: string, epoch: number, input: ProbeInstanceCommand) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).sort().join(',') !== 'bootId,expectedGeneration,instanceId' ||
        typeof input.instanceId !== 'string' ||
        input.instanceId.length !== 64 || !/^[0-9a-f]{64}$/.test(input.instanceId) ||
        !Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration < 0 ||
        input.expectedGeneration > MAX_COUNTER) invalid('Valid Probe instance identity and generation required');
    identity(nodeId, fingerprint, epoch, input.bootId);
    // Detach caller-owned input before entering an asynchronous transaction.
    return { bootId: input.bootId, instanceId: input.instanceId, expectedGeneration: input.expectedGeneration };
}
function view(record: ProbeInstanceRecord): ProbeInstanceRegistration {
    return deepFreeze({ ...record, executionEnabled: false });
}
function conflict(): never {
    throw new ControlError('PROBE_INSTANCE_CONFLICT', 409, 'Probe instance changed; inspect current generation');
}

/** Internal machine application port only; registration never issues an execution permit. */
export class ProbeInstances<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly machines: ProbeMachineReader<Tx>;
    private readonly store: ProbeInstanceStore<Tx>;
    constructor(db: TransactionBoundary<Tx>, machines: ProbeMachineReader<Tx>, store: ProbeInstanceStore<Tx>) {
        this.db = db; this.machines = machines; this.store = store;
    }

    async register(nodeId: string, fingerprint: string, epoch: number,
        input: ProbeInstanceCommand): Promise<ProbeInstanceRegistration> {
        const request = command(nodeId, fingerprint, epoch, input);
        return this.db.transaction(async tx => {
            const machine = await this.machines.read(tx, nodeId, fingerprint);
            requireProbeMachine(machine, nodeId, request.bootId, epoch, Date.now());
            // Resample after lock waits; the earlier credential check may have expired.
            const current = await this.store.lock(tx, nodeId), now = Date.now();
            const evidence = requireProbeMachine(machine, nodeId, request.bootId, epoch, now);
            const generation = current?.generation ?? 0;
            if (current?.instanceId === request.instanceId) {
                if (current.bootId !== request.bootId || current.sessionEpoch !== epoch ||
                    current.fingerprint !== fingerprint || current.state !== 'registered' ||
                    request.expectedGeneration !== generation - 1) conflict();
                if (current.registeredAt > now || current.expiresAt <= now)
                    throw new ControlError('PROBE_INSTANCE_EXPIRED', 409, 'Fresh instance required; replay cannot renew');
                return view(current);
            }
            if (request.expectedGeneration !== generation) conflict();
            if (generation === MAX_COUNTER)
                throw new ControlError('COUNTER_EXHAUSTED', 409, 'Probe instance generation exhausted');
            const expiresAt = Math.min(now + 30000, evidence.nodeCredentialUntil,
                evidence.credentialUntil, evidence.retireAfter ?? Infinity);
            const next: ProbeInstanceRecord = { nodeId, bootId: request.bootId, sessionEpoch: epoch, fingerprint,
                instanceId: request.instanceId, generation: generation + 1, state: 'registered',
                registeredAt: now, expiresAt, revokedAt: null };
            await this.store.replace(tx, generation, next);
            return view(next);
        });
    }

    async revoke(nodeId: string, fingerprint: string, epoch: number,
        input: ProbeInstanceCommand): Promise<ProbeInstanceRegistration> {
        const request = command(nodeId, fingerprint, epoch, input);
        return this.db.transaction(async tx => {
            const machine = await this.machines.read(tx, nodeId, fingerprint);
            requireProbeMachine(machine, nodeId, request.bootId, epoch, Date.now(), false);
            const current = await this.store.lock(tx, nodeId), now = Date.now();
            // Withdrawing TCP capability must not prevent the authenticated host from closing its slot.
            requireProbeMachine(machine, nodeId, request.bootId, epoch, now, false);
            if (!current || current.generation !== request.expectedGeneration ||
                current.instanceId !== request.instanceId) conflict();
            if (current.state !== 'registered') return view(current);
            const next: ProbeInstanceRecord = { ...current, state: 'revoked', revokedAt: now };
            await this.store.replace(tx, current.generation, next);
            return view(next);
        });
    }

    /** Observation only, not a reservation or future permit-issuance authorization. */
    async inspect(nodeId: string, fingerprint: string, epoch: number, bootId: string): Promise<ProbeInstanceInspection> {
        identity(nodeId, fingerprint, epoch, bootId);
        return this.db.transaction(async tx => {
            const machine = await this.machines.read(tx, nodeId, fingerprint);
            const current = await this.store.read(tx, nodeId), now = Date.now();
            const evidence = requireProbeMachine(machine, nodeId, bootId, epoch, now, false);
            const stale = current && (current.bootId !== bootId || current.sessionEpoch !== epoch ||
                current.fingerprint !== fingerprint || current.registeredAt > now || current.expiresAt <= now ||
                ['adp.3', 'native.direct.v1', 'tcp'].some(c => !evidence.capabilities.includes(c)));
            return deepFreeze({ generation: current?.generation ?? 0,
                state: !current ? 'absent' : current.state !== 'registered' ? current.state : stale ? 'stale' : 'registered',
                instance: current ? view(current) : null, executionEnabled: false });
        });
    }
}
