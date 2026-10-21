import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { RuntimeAssignmentValue, RuntimeReportRequestValue, RuntimeSnapshotValue } from '@tunex/contracts/execution-values';
import { RuntimeLedgerHost } from '../src/framework/runtime-ledger.ts';
import type { RuntimeLedgerForwards, RuntimeLedgerOptions, RuntimeLedgerStore, RuntimeOperation, RuntimeRetirement } from '../src/framework/runtime-ledger-ports.ts';
import type { RuntimeResourceAccess } from '../src/framework/runtime-resource-ports.ts';

function fixture() {
    const tx = Object.freeze({ identity: Symbol('caller') }), events: string[] = [];
    const forward: Forward = { id: 'forward', scopeId: 'scope', revision: 2, spec: { enabled: true, protocols: ['tcp'],
        ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 8080 } }, target: { host: 'example.com', port: 80 } } };
    const facts = { nodeId: 'node', scopeId: 'scope', capabilities: ['tcp'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [8080],
        egressPolicyRevision: 1, allowedDestinationCidrs: [], allowMetadataTargets: false };
    const operation: RuntimeOperation = { id: 'operation', scope_id: 'scope', forward_id: 'forward', target_revision: 2, kind: 'create', status: 'running',
        execution_deadline: 50000, claim_token: null, claim_until: null, cleanup_pending: 1, last_error: null, source_operation_id: null,
        previous_spec: null, created_at: 100, requested_by: 'actor', recovery_invalidated: 0 };
    const assignment: RuntimeAssignmentValue = { assignmentId: 'assignment', forwardId: 'forward', forwardRevision: 2, deploymentGeneration: 3, bindingFence: 4,
        role: 'direct', protocol: 'tcp', phase: 'active', resource: { address: '127.0.0.1', port: 8080, protocol: 'tcp' }, driver: { id: 'test', configDigest: 'config' }, drainTimeoutSeconds: 5 };
    const snapshot: RuntimeSnapshotValue = { nodeId: 'node', sessionEpoch: 2, snapshotGeneration: 4, complete: true, issuedAt: '0', validUntil: '40000',
        snapshotDigest: 'snapshot', assignments: [assignment], tombstones: [] };
    const report: RuntimeReportRequestValue = { nodeId: 'node', bootId: 'boot', sessionEpoch: 2, reportSequence: 1, observedAt: '10000', acceptedSnapshotGeneration: 4,
        observations: [{ assignmentId: 'assignment', deploymentGeneration: 3, bindingFence: 4, phase: 'active', condition: 'ready', errorCode: null, retryable: false }], drains: [] };
    const retirement: RuntimeRetirement = { node_id: 'node', assignment_id: 'assignment', deployment_generation: 3, binding_fence: 4,
        forward_id: 'forward', operation_id: 'operation', body: assignment, removed_epoch: null, retirement_generation: 4, safe: 0 };
    const data = { now: 10000, deleting: false, pending: 0, unsafe: 0, lease: undefined as { until: number | null } | undefined,
        snapshot: snapshot as RuntimeSnapshotValue | undefined, retired: [] as RuntimeRetirement[], authorized: true, authorizer: 'actor' as string | null };
    const trace = (supplied: typeof tx, name: string) => { assert.equal(supplied, tx); events.push(name); };
    const unexpected = async (): Promise<never> => { throw new Error('Unexpected provider call'); };
    const store: RuntimeLedgerStore<typeof tx> = {
        beginQuarantine: unexpected, quarantineRetirement: unexpected,
        assignmentOperations: async supplied => { trace(supplied, 'operations'); return [operation]; },
        assignmentSlots: async supplied => { trace(supplied, 'slots'); return [{ owner_id: 'forward', protocol: 'tcp', port: 8080, fence: 4, deployment_generation: 3 }]; },
        latestSnapshot: async supplied => { trace(supplied, 'latest-snapshot'); return data.snapshot ? { body: data.snapshot } : undefined; },
        nodeSession: async supplied => { trace(supplied, 'session'); return { session_epoch: 2 }; },
        operationForRevision: async supplied => { trace(supplied, 'operation-revision'); return operation; },
        latestOperation: async supplied => { trace(supplied, 'latest-operation'); return operation; },
        recordRelayError: unexpected, failRelayOperation: unexpected, succeedRelayOperation: unexpected, clearTerminalRelayCleanup: unexpected,
        denyIntent: unexpected, acceptOperation: unexpected, retireAssignment: unexpected, recordLeases: unexpected,
        previousUnsafeLeases: async supplied => { trace(supplied, 'previous-leases'); return []; },
        unsafeSessionLeaseCount: unexpected,
        retirements: async supplied => { trace(supplied, 'retirements'); return data.retired; },
        retirement: async supplied => { trace(supplied, 'retirement'); return retirement; },
        instanceLease: async supplied => { trace(supplied, 'instance-lease'); return data.lease; },
        markRemoved: async supplied => { trace(supplied, 'removed'); },
        unsafeRetirementsForUpdate: async supplied => { trace(supplied, 'retired-lock'); return []; },
        outstandingRetirementLeases: unexpected, markRetirementSafe: unexpected,
        completionOperations: async supplied => { trace(supplied, 'completion-operations'); return [operation]; },
        pendingRetirementCount: async supplied => { trace(supplied, 'pending-retirements'); return data.pending; },
        unsafeLeaseCount: async supplied => { trace(supplied, 'unsafe-leases'); return data.unsafe; },
        completeOperation: async (supplied, id, at, clearClaim) => { trace(supplied, `complete:${id}/${at}/${clearClaim}`); },
        clearFailedSupersededCleanup: async supplied => { trace(supplied, 'clear-prior-cleanup'); },
        clearOperationCleanup: async supplied => { trace(supplied, 'clear-cleanup'); },
        getOperation: unexpected, expireOperations: unexpected, claimableOperation: unexpected, claimOperation: unexpected,
    };
    const resources: RuntimeResourceAccess<typeof tx> = { initializeNode: unexpected, lockNode: unexpected, lockOwnership: unexpected, maximumAuthorization: unexpected, reserve: unexpected,
        reserveRelay: unexpected, transition: unexpected, releaseForwardSlots: async supplied => { trace(supplied, 'release-all'); },
        releaseObsoleteSlots: async supplied => { trace(supplied, 'release-obsolete'); }, retainSlots: unexpected };
    const forwarding: RuntimeLedgerForwards<typeof tx> = {
        forNode: async supplied => { trace(supplied, 'forwards'); return [forward]; },
        authorizer: async supplied => { trace(supplied, 'authorizer'); return data.authorizer; },
        record: async supplied => { trace(supplied, 'forward-unlocked'); return { ...forward, deleting: data.deleting, recoverySuspended: false }; },
    };
    const options: RuntimeLedgerOptions<typeof tx> = { policy: DEFAULT_POLICY, store, resources, now: () => data.now,
        newID: () => { events.push('id'); return 'new-id'; }, authorization: { canExecute: async supplied => { trace(supplied, 'authorize'); return data.authorized; } },
        assignments: { merge: async (supplied, context, assignments) => { trace(supplied, `merge:${context.includeAccepted}`); return [...assignments]; } },
        compiler: { parseTime: value => { events.push('parse-time'); return Number(value); }, formatTime: String,
            decodeSnapshot: value => { events.push('decode-snapshot'); return value as RuntimeSnapshotValue; }, decodeAssignment: value => value as RuntimeAssignmentValue,
            targetAllowed: () => true, direct: () => { events.push('compile-direct'); return [assignment]; },
            snapshot: input => ({ ...input, complete: true, snapshotDigest: 'compiled', assignments: [...input.assignments] }) } };
    return { tx, events, forward, facts, operation, assignment, snapshot, report, retirement, data, store, forwarding, options, host: () => new RuntimeLedgerHost(options) };
}

test('Ledger filters stale/revoked intent before authorization and keeps accepted work opt-in', async () => {
    for (const mode of ['accepted', 'failed', 'superseded', 'expired', 'recovery', 'revoke', 'disabled'] as const) {
        const f = fixture();
        if (mode === 'accepted' || mode === 'failed' || mode === 'superseded') f.operation.status = mode;
        if (mode === 'expired') f.operation.execution_deadline = f.data.now;
        if (mode === 'recovery') f.operation.recovery_invalidated = 1;
        if (mode === 'revoke') f.operation.kind = 'revoke';
        if (mode === 'disabled') Object.assign(f.forward.spec, { enabled: false });
        assert.deepEqual(await f.host().assignments(f.tx, f.forwarding, f.facts), [], mode);
        assert.equal(f.events.includes('authorize') || f.events.includes('compile-direct'), false, mode);
        if (mode === 'accepted') assert.deepEqual(await f.host().assignments(f.tx, f.forwarding, f.facts, true), [f.assignment]);
    }
});

test('Ledger requires the original authorizer/current permission and rechecks operation after compilation', async () => {
    const f = fixture(), host = f.host(); f.data.authorized = false;
    assert.deepEqual(await host.assignments(f.tx, f.forwarding, f.facts), []); assert.equal(f.events.includes('compile-direct'), false);
    f.data.authorized = true; f.events.length = 0;
    assert.deepEqual(await host.assignments(f.tx, f.forwarding, f.facts), [f.assignment]);
    assert.deepEqual(f.events, ['forwards', 'operations', 'slots', 'authorizer', 'authorize', 'compile-direct', 'merge:false']);
    f.operation.recovery_invalidated = 1; await assert.rejects(host.verifyPublishable(f.tx, [f.assignment]), { code: 'STALE_CLAIM' });
});

test('Ledger accept obtains ID then latest owner and uses monotonic creation/deadline without a new transaction', async () => {
    const f = fixture(); f.data.now = 50;
    f.store.acceptOperation = async (supplied, input) => {
        assert.equal(supplied, f.tx); assert.equal(input.forward, f.forward); assert.equal(input.at, 101); assert.equal(input.executionDeadline, 600101);
        assert.equal(input.sourceOperationId, 'source'); assert.equal(input.previousSpec, 'previous'); f.events.push('accept');
    };
    assert.equal(await f.host().accept(f.tx, f.forward, { scopeId: 'scope', actorId: 'actor', key: 'key', digest: 'digest' }, 'retry', 'previous', 'source'), 'new-id');
    assert.deepEqual(f.events, ['id', 'latest-operation', 'accept']);
});

test('Ledger claim expires first and retains one sample/token and the exact fifteen-second bound', async () => {
    const f = fixture(); let clocks = 0; Object.assign(f.options, { now: () => { clocks++; return 10000; } });
    f.store.expireOperations = async (supplied, at) => { assert.equal(supplied, f.tx); assert.equal(at, 10000); f.events.push('expire'); };
    f.store.claimableOperation = async (supplied, at) => { assert.equal(supplied, f.tx); assert.equal(at, 10000); f.events.push('skip-locked'); return f.operation; };
    f.store.claimOperation = async (supplied, id, token, at, until) => { assert.equal(supplied, f.tx); assert.equal(id, 'operation'); assert.equal(token, 'new-id'); assert.equal(at, 10000); assert.equal(until, 25000); f.events.push('claim'); };
    const claimed = await f.host().claim(f.tx);
    assert.deepEqual(f.events, ['expire', 'skip-locked', 'id', 'claim']); assert.equal(clocks, 1); assert.notEqual(claimed, f.operation);
    assert.equal(claimed?.claim_until, 25000); assert.equal(f.operation.claim_token, null);
});

test('Ledger capacity retains its early time sample across provider awaits and includes old-instance tombstones', async () => {
    const f = fixture(); f.snapshot.assignments = [{ ...f.assignment, deploymentGeneration: 1, bindingFence: 1 }];
    f.forwarding.forNode = async supplied => { assert.equal(supplied, f.tx); f.data.now = 90000; return [f.forward]; };
    f.options.compiler.snapshot = input => { assert.equal(input.issuedAt, '10000'); assert.equal(input.validUntil, String(10000 + DEFAULT_POLICY.leaseSeconds * 1000));
        assert.equal(input.tombstones[0]?.bindingFence, 1); assert.equal(input.tombstones[0]?.retirementGeneration, MAX_COUNTER);
        return { ...input, assignments: [...input.assignments], complete: true, snapshotDigest: 'capacity' }; };
    await f.host().assertCapacity(f.tx, f.forwarding, f.facts);
});

test('Ledger tombstones preserve physical ordering and clamp each retirement generation', async () => {
    const f = fixture();
    const retired = (id: string, physical: 'tcp' | 'udp', port: number, generation: number): RuntimeRetirement => ({ ...f.retirement,
        assignment_id: id, retirement_generation: generation, body: { ...f.assignment, assignmentId: id, resource: { ...f.assignment.resource, protocol: physical, port } } });
    f.data.retired = [retired('udp', 'udp', 1, 9), retired('b', 'tcp', 80, 8), retired('a', 'tcp', 80, 3), retired('first', 'tcp', 79, 2)];
    const result = await f.host().tombstones(f.tx, 'node', 4);
    assert.deepEqual(result.map(value => [value.assignmentId, value.physicalProtocol, value.port, value.retirementGeneration]),
        [['first', 'tcp', 79, 2], ['a', 'tcp', 80, 3], ['b', 'tcp', 80, 4], ['udp', 'udp', 1, 4]]);
});

test('Ledger drain refuses unaccepted generation and absent/null/zero authorization before parsing deadlines', async () => {
    for (const lease of [undefined, { until: null }, { until: 0 }]) {
        const f = fixture(); f.data.lease = lease;
        f.report.drains = [{ assignmentId: 'assignment', deploymentGeneration: 3, bindingFence: 4, startedAt: '10000', deadline: '20000', remainingConnections: 1, condition: 'draining' }];
        await assert.rejects(f.host().observeDrains(f.tx, 'node', 2, f.report), { code: 'LEASE_EXPIRED' });
        assert.equal(f.events.includes('parse-time'), false); assert.equal(f.events.includes('removed'), false);
    }
    const f = fixture(); f.retirement.retirement_generation = 5; f.report.drains = [{ assignmentId: 'assignment', deploymentGeneration: 3, bindingFence: 4, startedAt: '10000', deadline: '20000', remainingConnections: 0, condition: 'removed' }];
    await assert.rejects(f.host().observeDrains(f.tx, 'node', 2, f.report), { code: 'FENCING_REJECTED' }); assert.equal(f.events.includes('instance-lease'), false);
});

test('Ledger drain accepts the exact authorization deadline and records removal only with zero connections', async () => {
    const f = fixture(), host = f.host(); f.data.lease = { until: 20000 };
    f.report.drains = [{ assignmentId: 'assignment', deploymentGeneration: 3, bindingFence: 4, startedAt: '10000', deadline: '20000', remainingConnections: 1, condition: 'draining' }];
    await host.observeDrains(f.tx, 'node', 2, f.report); assert.equal(f.events.includes('removed'), false);
    f.report.drains[0]!.deadline = '20001'; await assert.rejects(host.observeDrains(f.tx, 'node', 2, f.report), { code: 'LEASE_EXPIRED' });
    f.report.drains[0]!.condition = 'removed'; await host.observeDrains(f.tx, 'node', 2, f.report); assert.equal(f.events.includes('removed'), false);
    f.report.drains[0]!.remainingConnections = 0; await host.observeDrains(f.tx, 'node', 2, f.report); assert.equal(f.events.at(-1), 'removed');
});

test('Ledger completion separates stopped, failed and ready claim/cleanup writes while keeping the Forward read unlocked', async () => {
    for (const mode of ['stopped', 'failed', 'ready'] as const) {
        const f = fixture();
        if (mode === 'stopped') f.data.deleting = true;
        if (mode === 'failed') f.operation.status = 'failed';
        if (mode !== 'ready') f.snapshot.assignments = [];
        await f.host().complete(f.tx, 'node', f.forwarding, f.report, f.snapshot);
        assert.deepEqual(f.events.slice(0, 5), ['latest-snapshot', 'retired-lock', 'completion-operations', 'forward-unlocked', 'pending-retirements']);
        if (mode === 'stopped') assert.deepEqual(f.events.slice(-3), ['release-all', 'complete:operation/10000/false', 'clear-prior-cleanup']);
        if (mode === 'failed') assert.deepEqual(f.events.slice(-2), ['release-obsolete', 'clear-cleanup']);
        if (mode === 'ready') assert.deepEqual(f.events.slice(-4), ['previous-leases', 'release-obsolete', 'complete:operation/10000/true', 'clear-prior-cleanup']);
    }
});

test('Ledger completion retains cleanup and resources at the exact five-second boundary or while old leases remain', async () => {
    for (const mode of ['boundary', 'previous', 'pending'] as const) {
        const f = fixture();
        if (mode === 'boundary') f.snapshot.validUntil = '15000';
        if (mode === 'pending') f.data.pending = 1;
        if (mode === 'previous') f.store.previousUnsafeLeases = async () => [{ node_id: 'other-session', assignment_id: 'assignment', deployment_generation: 3, binding_fence: 4 }];
        await f.host().complete(f.tx, 'node', f.forwarding, f.report, f.snapshot);
        assert.equal(f.events.some(value => value.startsWith('release-') || value.startsWith('complete:')), false, mode);
    }
});


test('Ledger forwards the original ownership lock and creating actor without acquiring its own authority',async()=>{
    const f=fixture(),host=f.host(),seen:unknown[][]=[];
    f.options.resources.lockOwnership=async(tx,intent)=>{assert.equal(tx,f.tx);assert.equal(intent,f.forward);seen.push(['ownership',tx,intent]);};
    f.options.resources.reserve=async(tx,intent,actor)=>{assert.equal(tx,f.tx);assert.equal(intent,f.forward);assert.equal(actor,'creating-actor');seen.push(['reserve',tx,intent,actor]);return [];};
    await host.lockOwnership(f.tx,f.forward);await host.reserve(f.tx,f.forward,'creating-actor');
    assert.deepEqual(seen,[['ownership',f.tx,f.forward],['reserve',f.tx,f.forward,'creating-actor']]);
    const failure=new Error('original ownership lock failed');f.options.resources.lockOwnership=async()=>{throw failure;};
    await assert.rejects(host.lockOwnership(f.tx,f.forward),error=>error===failure);
});
