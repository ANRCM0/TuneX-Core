import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { RuntimeAssignmentValue, RuntimeMessagesFor, RuntimeSnapshotValue } from '@tunex/contracts/execution-values';
import { RuntimeHost } from '../src/framework/runtime-host.ts';
import { runtimeCodec } from '../src/compatibility/public.ts';
import type { RuntimeHostOptions, RuntimeNodeState, RuntimeWorkRecord } from '../src/framework/runtime-host-ports.ts';

function fixture() {
    const tx = Object.freeze({ transaction: Symbol('original') }), events: string[] = [];
    const assignment: RuntimeAssignmentValue = { assignmentId: 'assignment', forwardId: 'forward', forwardRevision: 1,
        deploymentGeneration: 2, bindingFence: 3, role: 'direct', protocol: 'tcp', phase: 'active',
        resource: { address: '127.0.0.1', port: 8080, protocol: 'tcp' }, driver: { id: 'test', configDigest: 'config' }, drainTimeoutSeconds: DEFAULT_POLICY.drainTimeoutSeconds };
    const state: RuntimeNodeState = { node_id: 'node', session_epoch: 2, boot_id: 'boot', snapshot_generation: 4,
        last_report_sequence: 0, last_report: null, received_at: null };
    const facts = { nodeId: 'node', scopeId: 'scope', capabilities: ['tcp'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [8080],
        egressPolicyRevision: 1, allowedDestinationCidrs: [], allowMetadataTargets: false };
    const work: RuntimeWorkRecord = { id: 'operation', scope_id: 'scope', forward_id: 'forward', target_revision: 1, status: 'running',
        claim_token: 'claim', claim_until: 30000, execution_deadline: 30000 };
    const data = { now: 10000, credentialUntil: 60000, revoked: false, awaiting: 0, bootEpoch: 2 as number | undefined,
        previous: undefined as RuntimeSnapshotValue | undefined, priorDigest: undefined as string | undefined,
        authorityFailure: undefined as Error | undefined, saveFailure: undefined as Error | undefined,
        operation: work as RuntimeWorkRecord | undefined, assignments: [assignment], cleanup: [] as string[] };
    const trace = (current: typeof tx, name: string) => { assert.equal(current, tx); events.push(name); };
    const ports: RuntimeHostOptions<typeof tx> = {
        now: () => data.now,
        db: { transaction: async action => { events.push('begin'); try { const result = await action(tx); events.push('commit'); return result; }
            catch (error) { events.push('rollback'); throw error; } } },
        codec: {
            defaultPolicy: DEFAULT_POLICY, validatePolicy: policy => policy, digest: JSON.stringify,
            formatTime: String, parseTime: Number,
            checkHelloProtocol: () => { events.push('protocol'); }, checkHelloCapabilities: () => { events.push('capabilities'); },
            helloResponse: (nodeId, bootId, sessionEpoch, serverTime, policy) => ({ nodeId, bootId, sessionEpoch, serverTime, policy }),
            reportAck: (nodeId, bootId, sessionEpoch, reportSequence, status) => ({ nodeId, bootId, sessionEpoch, reportSequence, status }),
            compileSnapshot: input => { events.push('compile'); return { ...input, complete: true, assignments: [...input.assignments], snapshotDigest: 'snapshot' }; },
        },
        nodes: {
            credential: async (current, node, fingerprint) => { trace(current, `credential:${node}/${fingerprint}`); return data.credentialUntil; },
            facts: async current => { trace(current, 'facts'); return { facts }; },
            state: async current => { trace(current, 'state'); return { facts, revoked: data.revoked, credentialUntil: data.credentialUntil }; },
            capabilities: async (current, _node, capabilities) => { trace(current, `save-capabilities:${capabilities.join(',')}`); },
        },
        forwards: { record: async current => { trace(current, 'forward'); return { id: 'forward', scopeId: 'scope', revision: 1, deleting: false,
            recoverySuspended: false, spec: { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 8080 } }, target: { host: 'example.com', port: 80 } } }; } },
        store: {
            lockNode: async (current, node) => { trace(current, `lock:${node}`); return state; },
            boot: async current => { trace(current, 'boot'); return data.bootEpoch === undefined ? undefined : { session_epoch: data.bootEpoch }; },
            beginBoot: async (current, node, boot, epoch) => { trace(current, `begin-boot:${node}/${boot}/${epoch}`); },
            snapshot: async current => { trace(current, 'snapshot'); return data.previous; },
            awaitingClaim: async current => { trace(current, 'awaiting'); return data.awaiting; },
            operation: async current => { trace(current, 'operation'); return data.operation; },
            saveSnapshot: async (current, snapshot) => { trace(current, `save-snapshot:${snapshot.snapshotGeneration}`); if (data.saveFailure) throw data.saveFailure; },
            cleanupNodeIDs: async () => data.cleanup,
            reportDigest: async current => { trace(current, 'report-digest'); return data.priorDigest; },
            saveReport: async current => { trace(current, 'save-report'); },
            failExecution: async current => { trace(current, 'fail-execution'); },
        },
        ledger: {
            assignments: async current => { trace(current, 'assignments'); return data.assignments; },
            retireChanged: async (current, _node, _previous, _next, generation) => { trace(current, `retire:${generation}`); },
            tombstones: async (current, _node, generation) => { trace(current, `tombstones:${generation}`); return []; },
            verifyPublishable: async current => { trace(current, 'verify'); },
            recordLeases: async current => { trace(current, 'leases'); },
            complete: async current => { trace(current, 'complete'); },
            claim: async current => { trace(current, 'claim'); return data.operation; },
            get: async current => { trace(current, 'get-operation'); return work; },
            observeDrains: async current => { trace(current, 'drains'); },
        },
        observations: { status: async () => ({ applied: [], health: { condition: 'unknown', receivedAt: null, freshUntil: null } }) },
        authority: { issue: async (until, lease, skew) => { events.push(`authority:${until}/${lease}/${skew}`); if (data.authorityFailure) throw data.authorityFailure; } },
    };
    const previous = (): RuntimeSnapshotValue => ({ nodeId: 'node', sessionEpoch: 2, snapshotGeneration: 4, complete: true,
        issuedAt: '0', validUntil: '60000', snapshotDigest: 'old', assignments: [{ ...assignment }], tombstones: [] });
    const hello = (): RuntimeMessagesFor['HelloRequest'] => ({ nodeId: 'node', bootId: 'boot', agentBuild: 'test', capabilities: ['tcp'], lastStoredSnapshotGeneration: 4 });
    const report = (): RuntimeMessagesFor['ReportRequest'] => ({ nodeId: 'node', bootId: 'boot', sessionEpoch: 2, reportSequence: 1,
        observedAt: '10000', acceptedSnapshotGeneration: 4, observations: [{ assignmentId: 'assignment', deploymentGeneration: 2,
            bindingFence: 3, phase: 'active', condition: 'ready', errorCode: null, retryable: false }], drains: [] });
    return { tx, events, assignment, state, facts, work, data, ports, previous, hello, report, host: () => new RuntimeHost(ports) };
}

test('Runtime Hello keeps protocol and identity refusal before effects, then lock/credential/facts/boot ordering', async () => {
    const f = fixture(), host = f.host();
    await assert.rejects(host.hello('foreign', f.hello()), { code: 'AUTHORIZATION_DENIED' });
    assert.deepEqual(f.events, ['protocol']); f.events.length = 0;
    assert.equal((await host.hello('node', f.hello(), 'fingerprint')).sessionEpoch, 2);
    assert.deepEqual(f.events, ['protocol', 'capabilities', 'begin', 'lock:node', 'credential:node/fingerprint', 'facts', 'boot', 'commit']);
    f.events.length = 0; f.data.bootEpoch = undefined;
    assert.equal((await host.hello('node', { ...f.hello(), bootId: 'new' })).sessionEpoch, 3);
    assert.deepEqual(f.events.slice(-3), ['begin-boot:node/new/3', 'save-capabilities:tcp', 'commit']);
});

test('Runtime construction refuses missing clock/time/machine methods before sampling or provider effects', () => {
    for (const name of ['now', 'parseTime', 'formatTime', 'checkHelloProtocol', 'checkHelloCapabilities', 'helloResponse', 'reportAck']) {
        const f = fixture(); let sampled = 0; Object.assign(f.ports, { now: () => { sampled++; return 10000; } });
        const target = name === 'now' ? f.ports : f.ports.codec;
        Object.assign(target, { [name]: undefined });
        assert.throws(() => f.host(), { message: ['now', 'parseTime', 'formatTime'].includes(name) ? 'Runtime clock and time codec are required' : 'Runtime machine codec is required' });
        assert.equal(sampled, 0); assert.deepEqual(f.events, []);
    }
});

test('Runtime Hello refuses retired boots, changed capabilities, lost history and session exhaustion before boot writes', async () => {
    for (const mode of ['retired', 'capabilities', 'history', 'exhausted'] as const) {
        const f = fixture(), input = f.hello();
        if (mode === 'retired') f.data.bootEpoch = 1;
        if (mode === 'capabilities') input.capabilities = ['udp'];
        if (mode === 'history') input.lastStoredSnapshotGeneration = 5;
        if (mode === 'exhausted') { f.state.session_epoch = MAX_COUNTER; f.data.bootEpoch = undefined; }
        await assert.rejects(f.host().hello('node', input), { code: mode === 'retired' ? 'SESSION_SUPERSEDED' : mode === 'exhausted' ? 'RESOURCE_LIMIT' : 'INTEGRITY_FAILURE' });
        assert.equal(f.events.at(-1), 'rollback'); assert.equal(f.events.some(value => value.startsWith('begin-boot:')), false);
    }
});

test('Runtime publication records protected authority before Snapshot and leases in one transaction', async () => {
    const f = fixture(), snapshot = await f.host().snapshot('node', 2);
    assert.equal(snapshot.snapshotGeneration, 5); assert.equal(snapshot.validUntil, '60000');
    assert.deepEqual(f.events, ['begin', 'lock:node', 'state', 'snapshot', 'awaiting', 'assignments', 'retire:5', 'tombstones:5', 'compile',
        'verify', `authority:60000/${DEFAULT_POLICY.leaseSeconds}/${DEFAULT_POLICY.maxClockSkewSeconds}`, 'save-snapshot:5', 'leases', 'complete', 'commit']);
});

test('Runtime publication stops on authority/save failures and never records leases or completion', async () => {
    for (const stage of ['authorityFailure', 'saveFailure'] as const) {
        const f = fixture(), failure = new Error(stage); f.data[stage] = failure;
        await assert.rejects(f.host().snapshot('node', 2), error => error === failure);
        assert.equal(f.events.at(-1), 'rollback'); assert.equal(f.events.includes('leases'), false); assert.equal(f.events.includes('complete'), false);
        if (stage === 'authorityFailure') assert.equal(f.events.some(value => value.startsWith('save-snapshot:')), false);
    }
});

test('Runtime publication preserves queued same-instance multihop state and refuses exhausted counters before retirement', async () => {
    const f = fixture(); f.assignment.role = 'multihop-ingress'; f.data.previous = f.previous(); f.data.awaiting = 1;
    Object.assign(f.ports, { policy: { ...DEFAULT_POLICY, leaseSeconds: 45, renewalLeadSeconds: 18 } });
    assert.equal(await f.host().snapshot('node', 2), f.data.previous);
    assert.equal(f.events.includes('compile'), false);
    f.events.length = 0; f.data.previous = undefined; f.state.snapshot_generation = MAX_COUNTER;
    await assert.rejects(f.host().snapshot('node', 2), { code: 'RESOURCE_LIMIT' });
    assert.equal(f.events.some(value => value.startsWith('retire:') || value.startsWith('authority:')), false);
});

test('FR0026 queued preserved multihop publications renew at the normal lead before Agent skew expiry', async () => {
    for (const remaining of [18001, 18000, 17999, 5001, 5000]) {
        const f = fixture(); f.assignment.role = 'multihop-ingress'; f.data.awaiting = 2;
        Object.assign(f.ports, { policy: { ...DEFAULT_POLICY, leaseSeconds: 45, renewalLeadSeconds: 18 } });
        f.data.previous = { ...f.previous(), validUntil: String(f.data.now + remaining) };
        const snapshot = await f.host().snapshot('node', 2);
        if (remaining > 18000) {
            assert.equal(snapshot, f.data.previous); assert.equal(f.events.includes('compile'), false);
        } else {
            assert.equal(snapshot.snapshotGeneration, 5); assert.equal(snapshot.validUntil, '55000');
            assert.deepEqual(snapshot.assignments, f.data.previous.assignments);
            assert.deepEqual(f.events.slice(-6), ['verify', 'authority:55000/45/5', 'save-snapshot:5', 'leases', 'complete', 'commit']);
        }
    }
    // An unrelated changed assignment still publishes immediately outside the lead.
    const changed = fixture(); changed.assignment.role = 'multihop-ingress'; changed.data.awaiting = 1;
    changed.data.previous = changed.previous(); changed.data.previous.assignments[0]!.bindingFence--;
    assert.equal((await changed.host().snapshot('node', 2)).snapshotGeneration, 5);
    for (const stage of ['authorityFailure', 'saveFailure'] as const) {
        const f = fixture(), failure = new Error(stage); f.assignment.role = 'multihop-ingress'; f.data.awaiting = 1;
        Object.assign(f.ports, { policy: { ...DEFAULT_POLICY, leaseSeconds: 45, renewalLeadSeconds: 18 } });
        f.data.previous = { ...f.previous(), validUntil: '28000' }; f.data[stage] = failure;
        await assert.rejects(f.host().snapshot('node', 2), error => error === failure);
        assert.equal(f.events.at(-1), 'rollback'); assert.equal(f.events.includes('leases'), false);
        assert.equal(f.events.includes('complete'), false);
    }
});

test('Runtime stale worker claim after compilation refuses authority and Snapshot persistence', async () => {
    const f = fixture();
    const originalClaim = { ...f.work };
    f.ports.ledger.claim = async () => originalClaim;
    f.ports.codec.compileSnapshot = input => { f.events.push('compile'); f.work.claim_token = 'superseded';
        return { ...input, complete: true, assignments: [...input.assignments], snapshotDigest: 'snapshot' }; };
    await assert.rejects(f.host().tick(), { code: 'STALE_CLAIM' });
    assert.equal(f.events.includes('operation'), true); assert.equal(f.events.includes('verify'), true);
    assert.equal(f.events.some(value => value.startsWith('authority:') || value.startsWith('save-snapshot:')), false);
    assert.equal(f.events.at(-1), 'rollback');
});

test('Runtime report duplicate replay preserves ACK and rejects changed body before observation writes', async () => {
    const f = fixture(), input = f.report(); f.data.priorDigest = JSON.stringify(input);
    assert.equal((await f.host().report('node', 2, input)).status, 'duplicate');
    assert.deepEqual(f.events, ['begin', 'lock:node', 'facts', 'report-digest', 'commit']);
    f.events.length = 0;
    await assert.rejects(f.host().report('node', 2, { ...input, observedAt: 'changed' }), { code: 'INTEGRITY_FAILURE' });
    assert.equal(f.events.includes('save-report'), false); assert.equal(f.events.at(-1), 'rollback');
});

test('Runtime report refuses identity, boot, unpublished generation, fence and phase before drain/report writes', async () => {
    for (const mode of ['identity', 'boot', 'generation', 'fence', 'phase'] as const) {
        const f = fixture(), input = f.report(); f.data.previous = f.previous();
        if (mode === 'identity') input.nodeId = 'foreign';
        if (mode === 'boot') input.bootId = 'retired';
        if (mode === 'generation') f.data.previous = undefined;
        if (mode === 'fence') input.observations[0]!.bindingFence++;
        if (mode === 'phase') input.observations[0]!.phase = 'prepared';
        await assert.rejects(f.host().report('node', 2, input), { code: mode === 'identity' ? 'AUTHORIZATION_DENIED' : mode === 'boot' ? 'SESSION_SUPERSEDED' : mode === 'generation' ? 'STALE_GENERATION' : 'FENCING_REJECTED' });
        assert.equal(f.events.includes('drains') || f.events.includes('save-report'), false);
    }
});

test('Runtime report accepts current evidence after drains and never fails execution on expired publication', async () => {
    const f = fixture(); f.data.previous = f.previous();
    assert.equal((await f.host().report('node', 2, f.report())).status, 'accepted');
    assert.deepEqual(f.events.slice(-4), ['drains', 'save-report', 'complete', 'commit']);
    f.events.length = 0; f.data.previous.validUntil = String(f.data.now); const input = f.report(); input.observations[0]!.condition = 'error';
    await f.host().report('node', 2, input); assert.equal(f.events.includes('fail-execution'), false);
});

test('Runtime copies default and explicit validated policies at construction then detaches every Hello response', async () => {
    for (const explicit of [false, true]) {
        const f = fixture(), defaults = { ...DEFAULT_POLICY }, supplied = { ...DEFAULT_POLICY, leaseSeconds: 200 };
        const events: string[] = []; let received: unknown;
        Object.assign(f.ports.codec, { defaultPolicy: defaults });
        if (explicit) Object.assign(f.ports, { policy: supplied });
        Object.assign(f.ports, { now: () => { events.push('now'); return f.data.now; } });
        f.ports.codec.validatePolicy = function (policy, at) {
            assert.equal(this, f.ports.codec); assert.equal(at, 10000); received = policy; events.push('validate'); return policy;
        };
        const host = f.host(); assert.deepEqual(events, ['now', 'validate']);
        assert.equal(received === supplied, explicit); if (!explicit) assert.notEqual(received, defaults);
        const expectedLease = explicit ? 200 : 300;
        supplied.leaseSeconds = 1; defaults.leaseSeconds = 2;
        const first = await host.hello('node', f.hello()); assert.equal(first.policy.leaseSeconds, expectedLease);
        first.policy.leaseSeconds = 3;
        const second = await host.hello('node', f.hello()); assert.equal(second.policy.leaseSeconds, expectedLease);
        assert.notEqual(first.policy, second.policy); assert.equal(Object.isFrozen(first.policy), false);
        assert.deepEqual(events, ['now', 'validate', 'now', 'now']);
    }
});

test('Runtime retains policy validator receiver error identity and refuses weakened authority before any transaction', () => {
    const f = fixture(), failure = new Error('native policy refusal'); let samples = 0;
    Object.assign(f.ports, { now: () => { samples++; return 0; } });
    f.ports.codec.validatePolicy = function (_policy, at) { assert.equal(this, f.ports.codec); assert.equal(at, 0); throw failure; };
    assert.throws(() => f.host(), error => error === failure); assert.equal(samples, 1); assert.deepEqual(f.events, []);
    for (const extra of [{ leaseSeconds: 301 }, { maxClockSkewSeconds: 6 }]) {
        const current = fixture(); Object.assign(current.ports, { policy: { ...DEFAULT_POLICY, ...extra } });
        assert.throws(() => current.host(), { message: 'Runtime policy cannot weaken the 300-second/5-second authorization baseline' });
        assert.deepEqual(current.events, []);
    }
});

test('native Policy validation retains constructor sample timing and original parser refusal for malformed values', () => {
    for (const extra of [{ leaseSeconds: 0 }, { maxClockSkewSeconds: NaN }, { maxAssignmentsPerNode: 1.5 }, { extra: 1 }]) {
        const f = fixture(), policy = { ...DEFAULT_POLICY, ...extra }; let samples = 0;
        Object.assign(f.ports, { policy, now: () => { samples++; return 0; } }); f.ports.codec.validatePolicy = runtimeCodec.validatePolicy;
        let expected: unknown;
        try { runtimeCodec.validatePolicy(policy, 0); assert.fail('invalid fixture must fail native policy validation'); } catch (error) { expected = error; }
        assert.throws(() => f.host(), error => error instanceof Error && expected instanceof Error && error.name === expected.name && error.message === expected.message);
        assert.equal(samples, 1); assert.deepEqual(f.events, []);
    }
    const f = fixture(); f.ports.codec.validatePolicy = runtimeCodec.validatePolicy; Object.assign(f.ports, { now: () => NaN });
    assert.throws(() => f.host(), RangeError); assert.deepEqual(f.events, []);
});
