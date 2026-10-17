import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProbePermits } from '../src/application/probe-permits.ts';
import { ForwardProbes } from '../src/application/forward-probes.ts';
import type { ProbeAcceptance } from '../src/application/forward-probes.ts';
import type { IdempotentRequests, RequestIdentity } from '../src/application/ports.ts';
import { ControlError } from '../src/application/errors.ts';
import type { ProbeBinding, ForwardProbePlan } from '../src/modules/probe-ports.ts';
import type { ProbePermitRecord, ProbePermitStore } from '../src/modules/probe-permit-ports.ts';
import type { ProbeInstanceRecord } from '../src/modules/probe-instance-ports.ts';
import type { ProbeMachineEvidence } from '../src/modules/probe-negotiation-ports.ts';
import type { ProbeResultRecord } from '../src/modules/probe-result-ports.ts';
import type { ProbeResultRequest } from '@tunex/contracts';
import { probeResultDigest } from '@tunex/contracts';

const input = { version: 1, kind: 'tcp-connect', expectedRevision: 1,
    instanceId: 'a'.repeat(64), instanceGeneration: 1 };
const fingerprint = 'b'.repeat(64);
function fixture() {
    const initial = 1800000000000, calls: string[] = [], tx = Object.freeze({ tx: Symbol('tx') });
    const binding: ProbeBinding = { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, snapshotGeneration: 3,
        assignmentId: 'assignment-a', forwardId: 'forward-a', forwardRevision: 1, deploymentGeneration: 4,
        bindingFence: 5, configDigest: 'sha256:' + 'c'.repeat(64), egressPolicyRevision: 1 };
    const slot: ProbeInstanceRecord = { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, generation: 1,
        fingerprint, instanceId: input.instanceId, state: 'registered', registeredAt: initial, expiresAt: initial + 30000, revokedAt: null };
    const machine: ProbeMachineEvidence = { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2,
        revoked: false, credentialRevoked: false, nodeCredentialUntil: initial + 60000,
        credentialUntil: initial + 60000, retireAfter: null, capabilities: ['adp.3', 'native.direct.v1', 'tcp'] };
    const state = { now: initial, observedAt: 0, records: [] as ProbePermitRecord[], results: [] as ProbeResultRecord[],
        withdrawals: [] as { permitId: string; withdrawnAt: number }[], binding, slot, machine,
        denyScope: false, denyPlan: false, expireWhileReading: false, failAt: '', postGuard: false,
        planScope: 'scope-a', planUntil: initial + 60000,
        responses: new Map<string, { digest: string; response: ProbeAcceptance | undefined }>() };
    const check = (actual: typeof tx, name: string) => { assert.equal(actual, tx); calls.push(name); };
    let queue = Promise.resolve();
    const db = { transaction: async <T>(action: (actual: typeof tx) => Promise<T>): Promise<T> => {
        const previous = queue; let release!: () => void;
        queue = new Promise<void>(resolve => { release = resolve; }); await previous;
        const saved = structuredClone({ records: state.records, observedAt: state.observedAt, withdrawals: state.withdrawals, results: state.results, responses: state.responses }); calls.push('begin');
        try {
            const result = await action(tx);
            if (state.postGuard) throw new Error('maintenance');
            calls.push('commit'); return result;
        } catch (error) { state.records = saved.records; state.observedAt = saved.observedAt;
            state.withdrawals = saved.withdrawals; state.results = saved.results; state.responses = saved.responses; calls.push('rollback'); throw error; }
        finally { release(); }
    } };
    const identity = { scope: async (actual: typeof tx, _actor: string, _scope: string, manage?: boolean) => {
        check(actual, 'scope'); assert.equal(manage, true);
        if (state.denyScope) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied');
    } };
    const plans = { authorize: async (actual: typeof tx, _actor: string, _scope: string, _forward: string, raw: unknown): Promise<ForwardProbePlan> => {
        check(actual, 'plan');
        if (state.denyPlan) throw new ControlError('AUTHORIZATION_DENIED', 403, 'grant withdrawn');
        assert.equal((raw as { expectedRevision: number }).expectedRevision, 1);
        return { version: 1, kind: 'tcp-connect', executable: false, dispatch: 'not-implemented', independentProbe: false,
            point: 'agent-direct-egress', health: 'unknown', scopeId: state.planScope, binding: { ...state.binding },
            timeoutMs: (raw as { timeoutMs: number }).timeoutMs, maxAttempts: 1, applicationPayloadBytes: 0,
            plannedAt: new Date(state.now).toISOString(), expiresAt: new Date(Math.min(state.now + 2000, state.planUntil)).toISOString() };
    } };
    const machines = { read: async (actual: typeof tx, node: string, hash: string) => {
        check(actual, 'machine'); assert.equal(node, state.slot.nodeId); assert.equal(hash, state.slot.fingerprint);
        if (state.expireWhileReading) state.now += 2001;
        return structuredClone(state.machine);
    } };
    const instances = { readCurrent: async (actual: typeof tx, node: string) => {
        check(actual, 'instance'); assert.equal(node, state.slot.nodeId); return structuredClone(state.slot);
    } };
    const store: ProbePermitStore<typeof tx> = {
        lock: async actual => { check(actual, 'budget'); return structuredClone({ records: state.records,
            observedAt: state.observedAt, withdrawals: state.withdrawals }); },
        clock: async (actual, now) => { check(actual, 'clock'); state.observedAt = now; if (state.failAt === 'clock') throw new Error('clock write'); },
        prune: async (actual, before) => { check(actual, 'prune'); state.records = state.records.filter(p => p.expiresAt > before);
            state.results = state.results.filter(r => state.records.some(p => p.id === r.body.permitId));
            state.withdrawals = state.withdrawals.filter(w => state.records.some(p => p.id === w.permitId)); },
        insert: async (actual, permit) => { check(actual, 'insert'); state.records.push(structuredClone(permit)); if (state.failAt === 'insert') throw new Error('insert'); },
        close: async (actual, id, status, at) => {
            check(actual, 'close'); const index = state.records.findIndex(p => p.id === id);
            assert.notEqual(index, -1); assert.equal(state.records[index]!.state, 'issued');
            state.records[index] = { ...state.records[index]!, state: status, closedAt: at };
            if (state.failAt === 'close') throw new Error('close');
        },
        withdraw: async (actual, id, at) => {
            check(actual, 'withdraw'); assert.equal(state.records.find(p => p.id === id)!.state, 'consumed');
            state.withdrawals.push({ permitId: id, withdrawnAt: at });
            if (state.failAt === 'withdraw') throw new Error('withdraw');
        },
        result: async (actual, id) => { check(actual, 'result'); return structuredClone(state.results.find(r => r.body.permitId === id)); },
        recordResult: async (actual, record) => {
            check(actual, 'record-result'); state.results.push(structuredClone(record));
            if (state.failAt === 'record-result') throw new Error('record-result');
        },
    };
    const assemble = () => new ProbePermits(db, identity, plans, machines, instances, store, () => state.now);
    const host = assemble();
    const requests: IdempotentRequests<typeof tx> = {
        claim: async <R>(actual: typeof tx, request: RequestIdentity) => {
            check(actual, 'request-claim');
            const slot = `${request.actorId}/${request.scopeId}/${request.key}`, previous = state.responses.get(slot);
            if (previous && previous.digest !== request.digest) throw new ControlError('IDEMPOTENCY_CONFLICT', 409, 'conflict');
            if (previous?.response) return structuredClone(previous.response) as R;
            state.responses.set(slot, { digest: request.digest, response: undefined }); return undefined;
        },
        respond: async (actual, request, response) => {
            check(actual, 'request-response');
            state.responses.set(`${request.actorId}/${request.scopeId}/${request.key}`,
                { digest: request.digest, response: structuredClone(response) as ProbeAcceptance });
            if (state.failAt === 'request-response') throw new Error('response write');
        },
    };
    const management = (enabled = true) => new ForwardProbes(db, identity, requests, host, enabled);
    const issue = (command: unknown = input, actor = 'actor-a') => host.issue(actor, 'scope-a', 'forward-a', command);
    const claim = (id: string) => ({ permitId: id, bootId: 'boot-a', instanceId: input.instanceId, instanceGeneration: 1 });
    const consume = (id: string) => host.consume('node-a', fingerprint, 2, claim(id));
    const offer = () => host.offer('node-a', fingerprint, 2, { bootId: 'boot-a', instanceId: input.instanceId, instanceGeneration: 1 });
    const status = (id: string) => host.check('node-a', fingerprint, 2, claim(id));
    return { state, calls, host, issue, consume, claim, assemble, offer, status, management };
}

const managementInput = { version: 1, kind: 'tcp-connect', expectedRevision: 1 };
test('management selects the locked current instance and records idempotent acceptance in the same owner transaction', async () => {
    const f = fixture(), command = f.management(), accepted = await command.create('actor-a', 'scope-a', 'forward-a', 'request-a', managementInput);
    assert.equal(accepted.status, 202); assert.equal(accepted.body.dispatch, 'agent-poll');
    assert.equal(accepted.body.executionEnabled, false); assert.equal(f.state.records.length, 1);
    assert.equal(f.state.records[0]!.instanceId, f.state.slot.instanceId);
    assert.equal(f.state.records[0]!.instanceGeneration, f.state.slot.generation);
    assert.equal(accepted.body.probeId, f.state.records[0]!.id); assert.ok(Object.isFrozen(accepted.body));
    assert.deepEqual(f.calls, ['begin', 'scope', 'request-claim', 'scope', 'budget', 'plan', 'instance', 'instance',
        'machine', 'prune', 'clock', 'insert', 'request-response', 'commit']);
    assert.doesNotMatch(JSON.stringify(accepted), /fingerprint|instanceId|binding|target|actorId/);
    f.state.now += 10000; f.state.denyPlan = true;
    const replay = await f.management(false).create('actor-a', 'scope-a', 'forward-a', 'request-a', { ...managementInput, timeoutMs: 1000 });
    assert.deepEqual(replay, accepted); assert.equal(f.state.records.length, 1);
    await assert.rejects(command.create('actor-a', 'scope-a', 'other-forward', 'request-a', managementInput), { code: 'IDEMPOTENCY_CONFLICT' });
    f.state.denyScope = true;
    await assert.rejects(command.create('actor-a', 'scope-a', 'forward-a', 'request-a', managementInput), { code: 'AUTHORIZATION_DENIED' });
});

test('management defaults off, rejects injected targets and instance selection, and cannot refund or extend issuance', async () => {
    const f = fixture(), command = f.management();
    for (const invalidInput of [null, [], {}, Object.create(managementInput), { ...managementInput, target: '127.0.0.1' },
        { ...managementInput, instanceId: input.instanceId }, { ...managementInput, instanceGeneration: 1 },
        { ...managementInput, timeoutMs: null }, { ...managementInput, timeoutMs: 99 }, { ...managementInput, timeoutMs: 2001 },
        { ...managementInput, expectedRevision: '1' }, { ...managementInput, kind: 'udp' }])
        await assert.rejects(command.create('actor-a', 'scope-a', 'forward-a', 'request-a', invalidInput), { code: 'INVALID_CONFIG' });
    await assert.rejects(command.create('actor-a', 'scope-a', 'forward-a', undefined, managementInput), { code: 'INVALID_CONFIG' });
    for (const key of ['request\n', 'request\r', 'two words', 'x'.repeat(129)])
        await assert.rejects(command.create('actor-a', 'scope-a', 'forward-a', key, managementInput), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.calls, []);
    await assert.rejects(f.management(false).create('actor-a', 'scope-a', 'forward-a', 'request-a', managementInput), { code: 'PROBE_DISABLED' });
    assert.equal(f.state.records.length, 0); assert.equal(f.state.responses.size, 0);
    const accepted = await command.create('actor-a', 'scope-a', 'forward-a', 'request-a', managementInput);
    await command.revoke('actor-a', 'scope-a', accepted.body.probeId);
    await assert.rejects(command.create('actor-a', 'scope-a', 'forward-a', 'request-b', managementInput), { code: 'PROBE_PERMIT_LIMIT' });
    assert.deepEqual(await command.create('actor-a', 'scope-a', 'forward-a', 'request-a', managementInput), accepted);
    assert.equal(f.state.records[0]!.state, 'revoked');
});

test('management rolls back both permit and idempotency on authorization, instance, persistence or post-guard failure', async () => {
    for (const failure of ['plan', 'instance', 'insert', 'request-response', 'guard']) {
        const f = fixture();
        f.state.denyPlan = failure === 'plan';
        if (failure === 'instance') f.state.slot = { ...f.state.slot, state: 'revoked' };
        f.state.failAt = failure; f.state.postGuard = failure === 'guard';
        await assert.rejects(f.management().create('actor-a', 'scope-a', 'forward-a', 'request-a', managementInput));
        assert.equal(f.state.records.length, 0); assert.equal(f.state.responses.size, 0); assert.equal(f.state.observedAt, 0);
        assert.equal(f.calls.at(-1), 'rollback');
    }
});

test('management receipts stay reported-only after expiry or revocation, are scoped and never restore current authority', async () => {
    const f = await resultFixture(); await f.receive();
    const command = f.management(false), before = structuredClone(f.state), receipt = await command.inspect('actor-a', 'scope-a', f.permit.id);
    assert.equal(receipt.health, 'unknown'); assert.equal(receipt.executionEnabled, false);
    assert.equal(receipt.result!.historical, true); assert.equal(receipt.result!.expired, false);
    assert.equal(receipt.result!.body.source, 'agent-reported'); assert.deepEqual(f.state, before);
    assert.ok(Object.isFrozen(receipt.result!.body.binding)); assert.doesNotMatch(JSON.stringify(receipt), /fingerprint|requestId|target/);
    await assert.rejects(command.inspect('actor-a', 'scope-b', f.permit.id), { code: 'NOT_FOUND' });
    await command.revoke('actor-a', 'scope-a', f.permit.id); f.state.now += 5000; f.state.denyPlan = true;
    const historical = await command.inspect('actor-a', 'scope-a', f.permit.id);
    assert.equal(historical.expired, true); assert.equal(historical.result!.expired, true); assert.ok(historical.withdrawnAt);
    assert.equal(historical.state, 'consumed'); assert.equal(historical.health, 'unknown');
    f.state.denyScope = true;
    await assert.rejects(command.inspect('actor-a', 'scope-a', f.permit.id), { code: 'AUTHORIZATION_DENIED' });
});

test('management receipts reject corrupt digest, binding, times and disguised request metadata without repairing storage', async () => {
    for (const mutate of [
        (r: ProbeResultRecord) => ({ ...r, resultDigest: 'sha256:' + '0'.repeat(64) }),
        (r: ProbeResultRecord) => ({ ...r, acceptedAt: Date.parse(r.body.validUntil) }),
        (r: ProbeResultRecord) => ({ ...r, body: { ...r.body, requestId: '0'.repeat(64) } }),
        (r: ProbeResultRecord) => {
            const body = { ...r.body, binding: { ...r.body.binding, bindingFence: 999 } };
            return { ...r, body, resultDigest: probeResultDigest({ ...body, requestId: '0'.repeat(64) }) };
        },
    ]) {
        const f = await resultFixture(); await f.receive(); f.state.results[0] = mutate(f.state.results[0]!);
        const before = structuredClone(f.state.results);
        await assert.rejects(f.management().inspect('actor-a', 'scope-a', f.permit.id), { code: 'PROBE_RESULT_CORRUPT' });
        assert.deepEqual(f.state.results, before);
    }
});

async function resultFixture() {
    const f = fixture(), permit = await f.issue();
    await f.consume(permit.id); f.state.now += 10;
    const request: ProbeResultRequest = { protocolVersion: 3, probeVersion: 1, kind: 'probe-result',
        nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, instanceId: input.instanceId, instanceGeneration: 1,
        permitId: permit.id, requestId: 'd'.repeat(64), binding: { ...permit.binding }, timeoutMs: permit.timeoutMs,
        issuedAt: new Date(permit.issuedAt).toISOString(), expiresAt: new Date(permit.expiresAt).toISOString(),
        consumedAt: new Date(f.state.records[0]!.closedAt!).toISOString(), measuredAt: new Date(f.state.now).toISOString(),
        validUntil: new Date(permit.expiresAt).toISOString(), elapsedMs: 1, point: 'agent-direct-egress',
        status: 'connected', code: 'tcp-connected', applicationHealth: 'unknown', source: 'agent-reported', applicationPayloadBytes: 0 };
    const receive = (command = request, host = f.host) => host.receiveResult('node-a', fingerprint, 2, command);
    return { ...f, permit, request, receive };
}

test('result ingestion uses the original owner transaction, preserves consumption and never touches execution', async () => {
    const f = await resultFixture(), records = structuredClone(f.state.records), start = f.calls.length;
    const ack = await f.receive();
    assert.equal(ack.duplicate, false); assert.equal(ack.resultDigest, probeResultDigest(f.request));
    assert.equal(ack.acceptedAt, f.state.now); assert.equal(f.state.results.length, 1);
    assert.ok(Object.isFrozen(ack)); assert.ok(!('requestId' in f.state.results[0]!.body));
    assert.deepEqual(f.state.records, records); assert.equal(f.state.withdrawals.length, 0);
    assert.deepEqual(f.calls.slice(start), ['begin', 'budget', 'plan', 'instance', 'machine', 'result', 'record-result', 'clock', 'commit']);
    const fence = f.state.results[0]!.body.binding.bindingFence;
    (f.request.binding as { bindingFence: number }).bindingFence = fence + 1;
    assert.equal(f.state.results[0]!.body.binding.bindingFence, fence);
});

test('concurrent identical results across hosts deduplicate to the original acceptedAt without writes on replay', async () => {
    const f = await resultFixture(), other = f.assemble();
    const acks = await Promise.all([f.receive(), f.receive({ ...f.request, requestId: 'e'.repeat(64) }, other)]);
    assert.equal(acks.filter(a => a.duplicate).length, 1); assert.equal(f.state.results.length, 1);
    assert.equal(acks[0]!.acceptedAt, acks[1]!.acceptedAt); f.state.now += 10;
    const start = f.calls.length, again = await f.receive();
    assert.equal(again.duplicate, true); assert.equal(again.acceptedAt, acks[0]!.acceptedAt);
    assert.ok(!f.calls.slice(start).some(c => ['record-result', 'clock', 'close', 'prune'].includes(c)));
    await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
});

test('a changed result cannot replace the single accepted observation even with a fresh correlation ID', async () => {
    const f = await resultFixture(); await f.receive(); const before = structuredClone(f.state.results);
    await assert.rejects(f.receive({ ...f.request, status: 'unreachable', code: 'tcp-connect-failed', requestId: 'e'.repeat(64) }),
        { code: 'PROBE_RESULT_CONFLICT' });
    assert.deepEqual(f.state.results, before);
});

test('result ingestion compares every binding and original receipt field against the locked consumed permit', async () => {
    for (const key of Object.keys((await resultFixture()).request.binding)) {
        const f = await resultFixture(), binding = { ...f.request.binding } as Record<string, unknown>;
        binding[key] = typeof binding[key] === 'number' ? (binding[key] as number) + 1 : key === 'configDigest' ? 'sha256:' + 'f'.repeat(64) : 'foreign';
        const command = { ...f.request, binding } as unknown as ProbeResultRequest;
        await assert.rejects(f.receive(command)); assert.equal(f.state.results.length, 0);
    }
    for (const patch of [{ instanceId: 'f'.repeat(64) }, { instanceGeneration: 2 }, { timeoutMs: 1001 },
        { issuedAt: new Date(1800000000001).toISOString() }, { consumedAt: new Date(1800000000001).toISOString() },
        { expiresAt: new Date(1800000001999).toISOString(), validUntil: new Date(1800000001999).toISOString() }]) {
        const f = await resultFixture(); await assert.rejects(f.receive({ ...f.request, ...patch }));
        assert.equal(f.state.results.length, 0);
    }
});

test('result ingestion reauthorizes original actor, instance, credential and topology before duplicate lookup', async () => {
    for (const mode of ['scope', 'binding', 'instance', 'credential', 'machine', 'expired', 'future', 'stale']) {
        const f = await resultFixture(); await f.receive();
        switch (mode) {
            case 'scope': f.state.denyPlan = true; break;
            case 'binding': f.state.binding = { ...f.state.binding, forwardRevision: 2 }; break;
            case 'instance': f.state.slot = { ...f.state.slot, generation: 2 }; break;
            case 'credential': f.state.slot = { ...f.state.slot, fingerprint: 'f'.repeat(64) }; break;
            case 'machine': f.state.machine = { ...f.state.machine, credentialRevoked: true }; break;
            case 'expired': f.state.now = f.permit.expiresAt; break;
            case 'future': f.state.now -= 1; break;
            case 'stale': f.state.now = Date.parse(f.request.validUntil); break;
        }
        const before = structuredClone(f.state.results); await assert.rejects(f.receive());
        assert.deepEqual(f.state.results, before);
    }
});

test('result withdrawal stays sticky after grants recover and does not erase the accepted result or consumption', async () => {
    const f = await resultFixture(); await f.receive();
    const before = structuredClone(f.state.results), consumedAt = f.state.records[0]!.closedAt;
    await f.host.revoke('actor-a', 'scope-a', f.permit.id); f.state.denyPlan = true;
    await assert.rejects(f.receive()); f.state.denyPlan = false; await assert.rejects(f.receive());
    assert.deepEqual(f.state.results, before); assert.equal(f.state.records[0]!.state, 'consumed');
    assert.equal(f.state.records[0]!.closedAt, consumedAt);
});

test('result writes, budget clock failures and maintenance guards roll back with no acknowledgement', async () => {
    for (const mode of ['record-result', 'clock', 'guard']) {
        const f = await resultFixture(), before = structuredClone(f.state.records), observedAt = f.state.observedAt;
        if (mode === 'guard') f.state.postGuard = true; else f.state.failAt = mode;
        await assert.rejects(f.receive()); assert.equal(f.state.results.length, 0);
        assert.equal(f.state.observedAt, observedAt); assert.deepEqual(f.state.records, before);
        f.state.failAt = ''; f.state.postGuard = false; assert.equal((await f.receive()).duplicate, false);
    }
});

test('corrupt persisted results fail closed instead of being repaired or overwritten', async () => {
    for (const mode of ['body', 'digest', 'time', 'correlation']) {
        const f = await resultFixture(); await f.receive(); const r = f.state.results[0]!;
        f.state.results[0] = mode === 'body' ? { ...r, body: null as never } : mode === 'digest' ? { ...r, resultDigest: 'sha256:' + '0'.repeat(64) } :
            mode === 'time' ? { ...r, acceptedAt: f.state.now + 1 } : { ...r, body: { ...r.body, requestId: 'd'.repeat(64) } as never };
        await assert.rejects(f.receive(), { code: 'PROBE_RESULT_CORRUPT' });
    }
});

test('malformed and forged result identities reject before transactions, without consuming new permits', async () => {
    const f = await resultFixture(), before = f.calls.length;
    await assert.rejects(f.host.receiveResult('foreign', fingerprint, 2, f.request));
    await assert.rejects(f.host.receiveResult('node-a', fingerprint, 3, f.request));
    await assert.rejects(f.host.receiveResult('node-a', 'bad', 2, f.request));
    for (const patch of [{ actorId: 'actor-a' }, { target: '169.254.169.254' }, { status: 'timeout' }, { applicationHealth: 'healthy' }])
        await assert.rejects(f.receive({ ...f.request, ...patch } as ProbeResultRequest));
    assert.equal(f.calls.length, before);
    f.state.records[0] = { ...f.state.records[0]!, state: 'issued', closedAt: null };
    await assert.rejects(f.receive()); assert.equal(f.state.results.length, 0); assert.equal(f.state.records[0]!.state, 'issued');
});

test('permit requests reject unknown fields, unsafe identities and coercion before any transaction', async () => {
    const f = fixture();
    for (const command of [null, [], {}, Object.create(input), { ...input, target: '169.254.169.254' },
        { ...input, version: 2 }, { ...input, kind: 'udp' }, { ...input, expectedRevision: 0 },
        { ...input, instanceId: 'a' }, { ...input, instanceGeneration: 0 }, { ...input, instanceGeneration: '1' },
        { ...input, timeoutMs: 99 }, { ...input, timeoutMs: 2001 }, { ...input, timeoutMs: '100' }])
        await assert.rejects(f.issue(command), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.issue('bad\n', 'scope-a', 'forward-a', input), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.consume('node-a', fingerprint, 2, { ...f.claim('permit-a'), target: 'foreign' }), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.consume('node-a', fingerprint, 0, f.claim('permit-a')), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.calls, []);
});

test('issuance locks current actor, plan, instance and machine in one transaction and returns no remote execution authority', async () => {
    const f = fixture(), permit = await f.issue();
    assert.deepEqual(f.calls, ['begin', 'scope', 'budget', 'plan', 'instance', 'machine', 'prune', 'clock', 'insert', 'commit']);
    assert.equal(permit.executionEnabled, false); assert.equal(permit.dispatch, 'not-implemented');
    assert.equal(permit.expiresAt - permit.issuedAt, 2000); assert.equal(permit.state, 'issued');
    assert.equal(permit.instanceGeneration, 1); assert.deepEqual(permit.binding, f.state.binding);
    assert.ok(Object.isFrozen(permit)); assert.ok(Object.isFrozen(permit.binding));
    assert.ok(!('fingerprint' in permit)); assert.ok(!('target' in permit));
    f.state.records[0] = { ...f.state.records[0]!, binding: { ...f.state.binding, bindingFence: 99 } };
    assert.equal(permit.binding.bindingFence, 5);
});

test('only one concurrent claim consumes; restart, repeated claim and replacement cannot refund or reuse it', async () => {
    const f = fixture(), permit = await f.issue();
    const claims = await Promise.allSettled([f.consume(permit.id), f.consume(permit.id)]);
    assert.equal(claims.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(f.state.records[0]!.state, 'consumed');
    await assert.rejects(f.assemble().consume('node-a', fingerprint, 2, f.claim(permit.id)), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
    f.state.slot = { ...f.state.slot, instanceId: 'd'.repeat(64), generation: 2 };
    await assert.rejects(f.issue({ ...input, instanceId: f.state.slot.instanceId, instanceGeneration: 2 }), { code: 'PROBE_PERMIT_LIMIT' });
});

test('consumption reauthorizes the original actor and compares every topology binding dimension', async () => {
    for (const key of Object.keys(fixture().state.binding) as (keyof ProbeBinding)[]) {
        const f = fixture(), permit = await f.issue(), old = f.state.binding[key];
        f.state.binding = { ...f.state.binding, [key]: typeof old === 'number' ? old + 1 : key === 'configDigest' ? 'sha256:' + 'd'.repeat(64) : 'changed' };
        await assert.rejects(f.consume(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
        assert.equal(f.state.records[0]!.state, 'issued');
    }
    const denied = fixture(), permit = await denied.issue(); denied.state.denyPlan = true;
    await assert.rejects(denied.consume(permit.id), { code: 'AUTHORIZATION_DENIED' });
    assert.equal(denied.state.records[0]!.state, 'issued');
    const foreign = fixture(), other = await foreign.issue(); foreign.state.planScope = 'scope-b';
    await assert.rejects(foreign.consume(other.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
});

test('old certificate, session, instance, generation, revoked slot and credential retirement deny current consumption', async () => {
    for (const change of [
        (f: ReturnType<typeof fixture>) => { f.state.slot = { ...f.state.slot, fingerprint: 'e'.repeat(64) }; },
        (f: ReturnType<typeof fixture>) => { f.state.slot = { ...f.state.slot, generation: 2 }; },
        (f: ReturnType<typeof fixture>) => { f.state.slot = { ...f.state.slot, state: 'revoked', revokedAt: f.state.now }; },
        (f: ReturnType<typeof fixture>) => { f.state.machine = { ...f.state.machine, credentialRevoked: true }; },
        (f: ReturnType<typeof fixture>) => { f.state.machine = { ...f.state.machine, sessionEpoch: 3 }; },
        (f: ReturnType<typeof fixture>) => { f.state.machine = { ...f.state.machine, retireAfter: f.state.now + 100 }; },
        (f: ReturnType<typeof fixture>) => { f.state.machine = { ...f.state.machine, capabilities: ['adp.3'] }; },
        (f: ReturnType<typeof fixture>) => { f.state.now += 2000; },
        (f: ReturnType<typeof fixture>) => { f.state.expireWhileReading = true; },
    ]) {
        const f = fixture(), permit = await f.issue(); change(f);
        await assert.rejects(f.consume(permit.id)); assert.equal(f.state.records[0]!.state, 'issued');
    }
    const f = fixture(), permit = await f.issue();
    await assert.rejects(f.host.consume('node-a', 'f'.repeat(64), 2, f.claim(permit.id)), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    await assert.rejects(f.host.consume('node-a', fingerprint, 3, f.claim(permit.id)), { code: 'PROBE_PERMIT_UNAVAILABLE' });
});

test('fresh issuance clips all deadline bounds and rejects withdrawn or foreign authorization before writing', async () => {
    for (const key of ['credentialUntil', 'nodeCredentialUntil', 'retireAfter'] as const) {
        const f = fixture(); f.state.machine = { ...f.state.machine, [key]: f.state.now + 500 };
        assert.equal((await f.issue()).expiresAt, f.state.now + 500);
    }
    const limited = fixture(); limited.state.slot = { ...limited.state.slot, expiresAt: limited.state.now + 200 };
    assert.equal((await limited.issue()).expiresAt, limited.state.now + 200);
    for (const change of [
        (f: ReturnType<typeof fixture>) => { f.state.denyScope = true; },
        (f: ReturnType<typeof fixture>) => { f.state.denyPlan = true; },
        (f: ReturnType<typeof fixture>) => { f.state.slot = { ...f.state.slot, expiresAt: f.state.now }; },
        (f: ReturnType<typeof fixture>) => { f.state.planScope = 'scope-b'; },
        (f: ReturnType<typeof fixture>) => { f.state.expireWhileReading = true; },
    ]) {
        const f = fixture(); change(f); await assert.rejects(f.issue()); assert.equal(f.state.records.length, 0);
    }
});

test('scope managers can revoke after grant withdrawal, without reopening, consuming or refunding the reservation', async () => {
    const f = fixture(), permit = await f.issue(); f.state.denyPlan = true;
    await assert.rejects(f.host.revoke('actor-a', 'scope-b', permit.id), { code: 'NOT_FOUND' });
    const revoked = await f.host.revoke('actor-b', 'scope-a', permit.id);
    assert.equal(revoked.state, 'revoked'); assert.equal(revoked.closedAt, f.state.now);
    assert.deepEqual(await f.host.revoke('actor-b', 'scope-a', permit.id), revoked);
    await assert.rejects(f.consume(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    f.state.denyPlan = false; await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
});

test('Actor limits span Scopes and Node limits span Actors; cluster reservations survive early closure', async () => {
    const f = fixture(), first = await f.issue();
    f.state.planScope = 'scope-b';
    await assert.rejects(f.host.issue('actor-a', 'scope-b', 'forward-a', input), { code: 'PROBE_PERMIT_LIMIT' });
    f.state.planScope = 'scope-a';
    await assert.rejects(f.issue(input, 'actor-b'), { code: 'PROBE_PERMIT_LIMIT' });
    const original = structuredClone(f.state.records[0]!);
    f.state.records = Array.from({ length: 4 }, (_, i) => ({ ...original, id: 'permit-' + i, actorId: 'other-' + i,
        binding: { ...original.binding, nodeId: 'other-' + i }, state: 'revoked' as const, closedAt: f.state.now }));
    await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
    assert.ok(first.id);
});

test('clock rollback, future history, corrupt records and oversized retained sets fail closed', async () => {
    for (const change of [
        (f: ReturnType<typeof fixture>) => { f.state.now--; },
        (f: ReturnType<typeof fixture>) => { f.state.observedAt++; },
        (f: ReturnType<typeof fixture>) => { f.state.records[0] = { ...f.state.records[0]!, issuedAt: f.state.now + 1 }; },
        (f: ReturnType<typeof fixture>) => { f.state.records[0] = { ...f.state.records[0]!, binding: {} as ProbeBinding }; },
        (f: ReturnType<typeof fixture>) => { f.state.records = Array(257).fill(f.state.records[0]!); },
    ]) {
        const f = fixture(), permit = await f.issue(); change(f);
        await assert.rejects(f.consume(permit.id));
    }
});

test('owner failures and post-acceptance maintenance roll back insertion, consumption, pruning and budget clock', async () => {
    for (const failure of ['insert', 'clock', 'guard']) {
        const f = fixture(); f.state.failAt = failure; f.state.postGuard = failure === 'guard';
        await assert.rejects(f.issue()); assert.deepEqual(f.state.records, []); assert.equal(f.state.observedAt, 0);
    }
    const f = fixture(), permit = await f.issue(); f.state.failAt = 'close';
    await assert.rejects(f.consume(permit.id)); assert.equal(f.state.records[0]!.state, 'issued');
    f.state.failAt = ''; f.state.postGuard = true;
    await assert.rejects(f.consume(permit.id)); assert.equal(f.state.records[0]!.state, 'issued');
    f.state.postGuard = false; assert.equal((await f.consume(permit.id)).state, 'consumed');
});

test('expired IDs are pruned only after cooldown and cannot become new issuance or executable replay', async () => {
    const f = fixture(), old = await f.issue(); f.state.now += 2999;
    await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
    f.state.now++;
    const fresh = await f.issue(); assert.notEqual(fresh.id, old.id);
    assert.equal(f.state.records.length, 1); assert.equal(f.state.records[0]!.id, fresh.id);
    await assert.rejects(f.consume(old.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
});

test('delivery and consumed checks reject injected authority and unsafe machine commands before a transaction', async () => {
    const f = fixture(), request = { bootId: 'boot-a', instanceId: input.instanceId, instanceGeneration: 1 };
    for (const bad of [null, [], {}, { ...request, permitId: 'caller' }, { ...request, target: '169.254.169.254' },
        { ...request, actorId: 'owner' }, { ...request, instanceGeneration: 0 }])
        await assert.rejects(f.host.offer('node-a', fingerprint, 2, bad), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.check('node-a', fingerprint, 2, { ...f.claim('permit-a'), timeoutMs: 2000 }), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.check('node-a', 'bad', 2, f.claim('permit-a')), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.calls, []);
});

test('bounded delivery authenticates even an empty mailbox and returns one detached minimized offer without mutation', async () => {
    const f = fixture();
    assert.deepEqual(await f.offer(), { observedAt: f.state.now, executionEnabled: false, offer: null });
    const permit = await f.issue(), saved = structuredClone(f.state), calls = f.calls.length;
    const result = await f.offer(); assert.ok(result.offer);
    assert.equal(result.offer.permitId, permit.id); assert.deepEqual(result.offer.binding, permit.binding);
    assert.ok(Object.isFrozen(result.offer.binding)); assert.ok(Object.isFrozen(result.offer));
    assert.ok(!['actorId', 'scopeId', 'fingerprint', 'target'].some(k => k in result.offer!));
    assert.deepEqual(f.state, saved); assert.equal(f.calls.slice(calls).filter(c => c === 'begin').length, 1);
    assert.deepEqual(await f.offer(), result);
    f.state.slot = { ...f.state.slot, state: 'revoked', revokedAt: f.state.now };
    await assert.rejects(f.offer(), { code: 'PROBE_PERMIT_UNAVAILABLE' });
});

test('delivery does not expose foreign or closed permits, mint IDs, consume, renew or choose an ambiguous candidate', async () => {
    for (const patch of [{ binding: { ...fixture().state.binding, nodeId: 'foreign' } },
        { fingerprint: 'e'.repeat(64) }, { instanceId: 'e'.repeat(64) }, { instanceGeneration: 2 }]) {
        const f = fixture(); await f.issue(); f.state.records[0] = { ...f.state.records[0]!, ...patch };
        assert.equal((await f.offer()).offer, null); assert.equal(f.state.records.length, 1);
    }
    const f = fixture(), permit = await f.issue(); await f.consume(permit.id);
    assert.equal((await f.offer()).offer, null);
    await assert.rejects(f.status('unknown'), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    const ambiguous = fixture(); await ambiguous.issue();
    ambiguous.state.records.push({ ...ambiguous.state.records[0]!, id: 'other-permit', actorId: 'actor-b' });
    await assert.rejects(ambiguous.offer(), { code: 'PROBE_PERMIT_CORRUPT' });
});

test('delivery and consumed status reauthorize the original Actor and every complete binding field', async () => {
    for (const consumed of [false, true]) {
        for (const key of Object.keys(fixture().state.binding) as (keyof ProbeBinding)[]) {
            const f = fixture(), permit = await f.issue(); if (consumed) await f.consume(permit.id);
            const old = f.state.binding[key]; f.state.binding = { ...f.state.binding,
                [key]: typeof old === 'number' ? old + 1 : key === 'configDigest' ? 'sha256:' + 'd'.repeat(64) : 'changed' };
            const saved = structuredClone(f.state.records);
            await assert.rejects(consumed ? f.status(permit.id) : f.offer()); assert.deepEqual(f.state.records, saved);
        }
        const f = fixture(), permit = await f.issue(); if (consumed) await f.consume(permit.id);
        f.state.denyPlan = true;
        await assert.rejects(consumed ? f.status(permit.id) : f.offer(), { code: 'AUTHORIZATION_DENIED' });
    }
});

test('consumed status is repeatable observation, not a new claim, deadline, execution lease or clock write', async () => {
    const f = fixture(), permit = await f.issue();
    await assert.rejects(f.status(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    const consumed = await f.consume(permit.id), before = structuredClone(f.state);
    const status = await f.status(permit.id);
    assert.deepEqual(status, { ...consumed, checkedAt: f.state.now }); assert.deepEqual(f.state, before);
    assert.deepEqual(await f.status(permit.id), status);
    for (const mutate of [
        (f: ReturnType<typeof fixture>) => { f.state.now += 2000; },
        (f: ReturnType<typeof fixture>) => { f.state.expireWhileReading = true; },
        (f: ReturnType<typeof fixture>) => { f.state.slot = { ...f.state.slot, generation: 2 }; },
        (f: ReturnType<typeof fixture>) => { f.state.machine = { ...f.state.machine, credentialRevoked: true }; },
        (f: ReturnType<typeof fixture>) => { f.state.machine = { ...f.state.machine, retireAfter: f.state.now + 1 }; },
        (f: ReturnType<typeof fixture>) => { f.state.machine = { ...f.state.machine, capabilities: ['adp.3'] }; },
    ]) {
        const g = fixture(), p = await g.issue(); await g.consume(p.id); mutate(g);
        await assert.rejects(g.status(p.id));
    }
});

test('explicit consumed withdrawal is sticky across owner restart and preserves consumption, scope isolation and reservations', async () => {
    const f = fixture(), permit = await f.issue(), consumed = await f.consume(permit.id); f.state.now++;
    await assert.rejects(f.host.revoke('actor-b', 'scope-b', permit.id), { code: 'NOT_FOUND' });
    f.state.denyPlan = true;
    const withdrawn = await f.host.revoke('actor-b', 'scope-a', permit.id);
    assert.equal(withdrawn.state, 'consumed'); assert.equal(withdrawn.closedAt, consumed.closedAt);
    assert.equal('withdrawnAt' in withdrawn && withdrawn.withdrawnAt, f.state.now);
    const saved = structuredClone(f.state), before = f.calls.filter(c => c === 'withdraw').length;
    assert.deepEqual(await f.host.revoke('actor-b', 'scope-a', permit.id), withdrawn);
    assert.deepEqual(f.state, saved); assert.equal(f.calls.filter(c => c === 'withdraw').length, before);
    f.state.denyPlan = false;
    await assert.rejects(f.assemble().check('node-a', fingerprint, 2, f.claim(permit.id)), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
    await assert.rejects(f.consume(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
});

test('withdrawal insert, clock and post-acceptance failures roll back the flag without losing the original claim', async () => {
    for (const failure of ['withdraw', 'clock', 'guard']) {
        const f = fixture(), permit = await f.issue(); await f.consume(permit.id); f.state.now++;
        const saved = structuredClone(f.state.records), clock = f.state.observedAt;
        f.state.failAt = failure; f.state.postGuard = failure === 'guard';
        await assert.rejects(f.host.revoke('actor-b', 'scope-a', permit.id));
        assert.deepEqual(f.state.records, saved); assert.deepEqual(f.state.withdrawals, []); assert.equal(f.state.observedAt, clock);
        f.state.failAt = ''; f.state.postGuard = false; assert.equal((await f.status(permit.id)).state, 'consumed');
    }
});

test('corrupt, orphaned, duplicate, over-capacity and future withdrawals fail closed without mutation', async () => {
    for (const change of [
        (f: ReturnType<typeof fixture>, id: string) => { f.state.withdrawals = [{ permitId: id, withdrawnAt: f.state.now - 1 }]; },
        (f: ReturnType<typeof fixture>, id: string) => { f.state.withdrawals = [{ permitId: id, withdrawnAt: f.state.now + 1 }]; },
        (f: ReturnType<typeof fixture>) => { f.state.withdrawals = [{ permitId: 'orphan', withdrawnAt: f.state.now }]; },
        (f: ReturnType<typeof fixture>, id: string) => { f.state.withdrawals = Array(2).fill({ permitId: id, withdrawnAt: f.state.now }); },
        (f: ReturnType<typeof fixture>, id: string) => { f.state.withdrawals = Array(257).fill({ permitId: id, withdrawnAt: f.state.now }); },
    ]) {
        const f = fixture(), permit = await f.issue(); await f.consume(permit.id); change(f, permit.id);
        const saved = structuredClone(f.state.withdrawals); await assert.rejects(f.status(permit.id)); assert.deepEqual(f.state.withdrawals, saved);
    }
});

test('expiry cleanup removes only withdrawn history past cooldown and cannot resurrect any old permit', async () => {
    const f = fixture(), old = await f.issue(); await f.consume(old.id); await f.host.revoke('actor-a', 'scope-a', old.id);
    f.state.now += 2999; await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
    f.state.now++; const fresh = await f.issue(); assert.notEqual(fresh.id, old.id);
    assert.deepEqual(f.state.withdrawals, []); assert.equal(f.state.records.length, 1);
    await assert.rejects(f.status(old.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    await assert.rejects(f.consume(old.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
});
