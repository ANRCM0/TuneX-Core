import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY } from '@tunex/contracts';
import type { RuntimeAssignment } from '@tunex/contracts';
import { compileDirect, compileSnapshot } from '../src/modules/runtime/planner.ts';
import { compileMultihopPlan } from '../src/modules/runtime/multihop-plan.ts';
import { RuntimeLedger } from '../src/modules/runtime/ledger.ts';
import { RelayAssignmentSource } from '../src/modules/runtime/relay-assignment-source.ts';
import { SnapshotAssignmentRegistry } from '../src/modules/runtime/snapshot-assignments.ts';
import type { AssignmentDriverDeclaration, SnapshotAssignmentContext, SnapshotAssignmentSource } from '../src/modules/runtime/snapshot-assignment-ports.ts';
import { multihopFixture } from './fixtures/multihop.ts';

type Tx = Readonly<{ token: symbol }>;
const tx: Tx = Object.freeze({ token: Symbol('transaction') });
const context: SnapshotAssignmentContext = Object.freeze({ nodeId: 'node-a', includeAccepted: false });

function assignment(id: string, port: number, role: RuntimeAssignment['role'] = 'direct'): RuntimeAssignment {
    const [direct] = compileDirect({ id: 'forward-' + id, scopeId: 'scope-a', revision: 1,
        spec: { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port } },
            target: { host: '127.0.0.1', port: 80 } } },
    { nodeId: 'node-a', scopeId: 'scope-a', capabilities: ['adp.3', 'native.direct.v1', 'tcp'],
        allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [port], egressPolicyRevision: 1,
        allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false },
    [{ nodeId: 'node-a', forwardId: 'forward-' + id, protocol: 'tcp', port, bindingFence: 1, deploymentGeneration: 1 }]);
    const result = structuredClone(direct!); result.assignmentId = id; result.role = role;
    result.driver.id = role === 'direct' ? 'native.direct.v1' : role.startsWith('relay-') ? 'native.relay.v1' : 'native.multihop.v1';
    return result;
}

function source(id: string, roles: AssignmentDriverDeclaration['roles'], assignments: RuntimeAssignment[] = [],
    driver: AssignmentDriverDeclaration['id'] = 'native.relay.v1'): SnapshotAssignmentSource<Tx> {
    return { id, drivers: [{ id: driver, schemaVersion: 1, roles }], collect: async (current, request) => {
        assert.equal(current, tx); return { nodeId: request.nodeId, assignments };
    } };
}

test('static registration rejects missing sources, duplicate IDs, unsupported declarations and overlapping driver/role ownership', () => {
    const good = source('relay', ['relay-ingress']);
    for (const sources of [
        undefined, new Array(1), [null], [{ ...good, id: '../source' }], [{ ...good, collect: undefined }], [{ ...good, drivers: [] }],
        [good, { ...good }], [{ ...good, drivers: [{ id: 'native.direct.v1', schemaVersion: 1, roles: ['direct'] }] }],
        [{ ...good, drivers: [{ id: 'native.relay.v2', schemaVersion: 1, roles: ['relay-ingress'] }] }],
        [{ ...good, drivers: [{ id: 'native.relay.v1', schemaVersion: 2, roles: ['relay-ingress'] }] }],
        [{ ...good, drivers: [{ id: 'native.relay.v1', schemaVersion: 1, roles: [] }] }],
        [{ ...good, drivers: [{ id: 'native.relay.v1', schemaVersion: 1, roles: ['multihop-ingress'] }] }],
        [{ ...good, drivers: [good.drivers[0], good.drivers[0]] }],
        [source('duplicate-role', ['relay-ingress', 'relay-ingress'])],
        [good, source('another-owner', ['relay-ingress'])],
    ]) assert.throws(() => new SnapshotAssignmentRegistry(sources as never));
    assert.throws(() => new RuntimeLedger(undefined, undefined, undefined as never), /collector is required/);
    assert.throws(() => new RelayAssignmentSource(undefined as never), /reader is required/);
});

test('construction performs no source reads and the source set, declarations and callback references cannot be replaced later', async () => {
    let ready = false, originalCalls = 0;
    const roles: AssignmentDriverDeclaration['roles'][number][] = ['relay-ingress'];
    const mutable = { id: 'relay', drivers: [{ id: 'native.relay.v1' as const, schemaVersion: 1 as const, roles }],
        collect: async (current: Tx, request: SnapshotAssignmentContext) => {
            assert.ok(ready); assert.equal(current, tx); originalCalls++;
            return { nodeId: request.nodeId, assignments: [assignment('relay-a', 33001, 'relay-ingress')] };
        } };
    const entries = [mutable], registry = new SnapshotAssignmentRegistry(entries);
    entries.length = 0; roles.length = 0; mutable.id = 'changed';
    mutable.collect = async () => { throw new Error('Replaced callback must not run'); };
    assert.equal(originalCalls, 0); assert.ok(Object.isFrozen(registry)); ready = true;
    assert.equal((await registry.merge(tx, context, [])).length, 1); assert.equal(originalCalls, 1);
});

test('sources execute in deterministic ID order and merge Direct, Relay and multi-hop contributions into one sorted assignment set', async () => {
    const calls: string[] = [];
    const first = source('a-relay', ['relay-ingress'], [assignment('z-relay', 33001, 'relay-ingress')]);
    const second = source('z-multihop', ['multihop-transit'], [assignment('a-hop', 33002, 'multihop-transit')], 'native.multihop.v1');
    const wrap = (s: SnapshotAssignmentSource<Tx>) => ({ ...s, collect: async (current: Tx, request: SnapshotAssignmentContext) => {
        calls.push(s.id); return s.collect(current, request);
    } });
    const direct = [assignment('m-direct', 32001)];
    const a = await new SnapshotAssignmentRegistry([wrap(second), wrap(first)]).merge(tx, context, direct);
    assert.deepEqual(calls, ['a-relay', 'z-multihop']);
    const b = await new SnapshotAssignmentRegistry([first, second]).merge(tx, context, direct);
    assert.deepEqual(a, b); assert.deepEqual(a.map(a => a.assignmentId), ['a-hop', 'm-direct', 'z-relay']);
    assert.equal(direct.length, 1);
});

test('Relay adapter passes the same transaction, Node and capacity/publication flag without authorizing or publishing on its own', async () => {
    const calls: boolean[] = [];
    const relay = new RelayAssignmentSource<Tx>({ assignments: async (current, nodeId, includeAccepted) => {
        assert.equal(current, tx); assert.equal(nodeId, 'node-a'); calls.push(includeAccepted);
        return includeAccepted ? [{ ...assignment('staged', 33001, 'relay-ingress'), phase: 'prepared' }] : [];
    } });
    const registry = new SnapshotAssignmentRegistry([relay]);
    assert.deepEqual(await registry.merge(tx, context, []), []);
    assert.equal((await registry.merge(tx, { ...context, includeAccepted: true }, []))[0]!.phase, 'prepared');
    assert.deepEqual(calls, [false, true]); assert.ok(Object.isFrozen(relay.drivers[0]!.roles));
});

test('foreign Nodes, malformed contributions, undeclared drivers/roles and attempts to contribute host-owned Direct assignments fail closed', async () => {
    const base = source('relay', ['relay-ingress']);
    for (const contribution of [
        null, { nodeId: 'node-b', assignments: [] }, { nodeId: 'node-a', assignments: {} },
        { nodeId: 'node-a', assignments: [assignment('direct', 32001)] },
        { nodeId: 'node-a', assignments: [assignment('egress', 33001, 'relay-egress')] },
        { nodeId: 'node-a', assignments: [assignment('multi', 33001, 'multihop-ingress')] },
        { nodeId: 'node-a', assignments: [{ ...assignment('bad-schema', 33001, 'relay-ingress'), driver: { id: 'native.relay.v1', schemaVersion: 2 } }] },
        { nodeId: 'node-a', assignments: [null] },
    ]) {
        const registry = new SnapshotAssignmentRegistry([{ ...base, collect: async () => contribution as never }]);
        await assert.rejects(registry.merge(tx, context, []), { code: 'INTEGRITY_FAILURE' });
    }
    await assert.rejects(new SnapshotAssignmentRegistry([]).merge(tx, context, [assignment('foreign-base', 33001, 'relay-ingress')]),
        { code: 'INTEGRITY_FAILURE' });
});

test('merging rejects duplicate assignment IDs, logical bindings and physical TCP/UDP slots rather than dropping one source', async () => {
    const direct = assignment('same-id', 32001);
    for (const change of ['id', 'physical', 'logical'] as const) {
        const a = assignment('a-relay', 33001, 'relay-ingress'), b = assignment('b-relay', 33002, 'relay-ingress');
        if (change === 'id') a.assignmentId = direct.assignmentId;
        if (change === 'physical') { a.resource.port = direct.resource.port; a.resource.address = '0.0.0.0'; }
        if (change === 'logical') b.forwardId = a.forwardId;
        const registry = new SnapshotAssignmentRegistry([source('relay', ['relay-ingress'], [a, b])]);
        await assert.rejects(registry.merge(tx, context, [direct]), { code: 'RESOURCE_CONFLICT' });
    }
    const relay = assignment('relay', 32001, 'relay-ingress'); relay.protocol = 'udp'; relay.resource.protocol = 'udp';
    assert.equal((await new SnapshotAssignmentRegistry([source('relay', ['relay-ingress'], [relay])]).merge(tx, context, [direct])).length, 2);
    const a = source('ingress', ['relay-ingress'], [assignment('ingress', 33001, 'relay-ingress')]);
    const b = source('egress', ['relay-egress'], [assignment('egress', 33001, 'relay-egress')]);
    await assert.rejects(new SnapshotAssignmentRegistry([a, b]).merge(tx, context, []), { code: 'RESOURCE_CONFLICT' });
});

test('source failure aborts the whole merge instead of silently publishing a partial Direct or earlier-source result', async () => {
    const calls: string[] = [], failure = new Error('Injected owner read failure');
    const a = { ...source('a-relay', ['relay-ingress']), collect: async () => {
        calls.push('first'); return { nodeId: 'node-a', assignments: [assignment('relay', 33001, 'relay-ingress')] };
    } };
    const b = { ...source('b-relay', ['relay-egress']), collect: async () => { calls.push('second'); throw failure; } };
    const c = { ...source('c-hop', ['multihop-transit'], [], 'native.multihop.v1'), collect: async () => {
        calls.push('third'); return { nodeId: 'node-a', assignments: [] };
    } };
    await assert.rejects(new SnapshotAssignmentRegistry([c, b, a]).merge(tx, context, [assignment('direct', 32001)]), error => error === failure);
    assert.deepEqual(calls, ['first', 'second']);
});

test('request and each contribution detach before later awaits without freezing or modifying owner-owned plan objects', async () => {
    const request = { nodeId: 'node-a', includeAccepted: false }, direct = assignment('direct', 32001), first = assignment('relay', 33001, 'relay-ingress');
    const a = { ...source('a-relay', ['relay-ingress'], [first]), collect: async (current: Tx, received: SnapshotAssignmentContext) => {
        assert.equal(current, tx); assert.ok(Object.isFrozen(received));
        request.nodeId = 'node-b'; request.includeAccepted = true; direct.resource.port = 1;
        return { nodeId: received.nodeId, assignments: [first] };
    } };
    const b = { ...source('b-relay', ['relay-egress']), collect: async (_current: Tx, received: SnapshotAssignmentContext) => {
        assert.deepEqual(received, context); first.resource.port = 2; return { nodeId: received.nodeId, assignments: [] };
    } };
    const merged = await new SnapshotAssignmentRegistry([a, b]).merge(tx, request, [direct]);
    assert.deepEqual(merged.map(a => a.resource.port), [32001, 33001]);
    assert.ok(Object.isFrozen(merged[0]!.driver.config)); assert.ok(Object.isFrozen(merged[1]!.resource));
    assert.equal(Object.isFrozen(first), false); assert.equal(Object.isFrozen(direct), false);
});

test('an explicit empty source set supports Direct-only helpers and rejects invalid non-HTTP contexts', async () => {
    const registry = new SnapshotAssignmentRegistry<Tx>([]);
    assert.deepEqual(await registry.merge(tx, context, []), []);
    assert.equal((await registry.merge(tx, context, [assignment('direct', 32001)])).length, 1);
    for (const request of [null, { nodeId: '../node', includeAccepted: false }, { nodeId: 'node-a', includeAccepted: 'yes' }])
        await assert.rejects(registry.merge(tx, request as never, []), { code: 'INTEGRITY_FAILURE' });
});

test('valid mixed contributions still require the existing complete Snapshot compiler and its session/config/size checks', async () => {
    const input = multihopFixture(), plan = compileMultihopPlan(input), node = plan.nodes[0]!, facts = input.nodes[0]!.facts;
    const direct = compileDirect({ id: 'direct', scopeId: facts.scopeId, revision: 1, spec: { enabled: true, protocols: ['tcp'],
        ingress: { nodeId: facts.nodeId, listen: { address: '127.0.0.1', port: 32003 } }, target: { host: '127.0.0.1', port: 80 } } },
    { ...facts, allowedPorts: [32001, 32003] },
    [{ nodeId: facts.nodeId, forwardId: 'direct', protocol: 'tcp', port: 32003, bindingFence: 1, deploymentGeneration: 1 }]);
    const registry = new SnapshotAssignmentRegistry<Tx>([new RelayAssignmentSource({
        assignments: async () => node.assignments,
    })]);
    const assignments = await registry.merge(tx, { nodeId: node.nodeId, includeAccepted: false }, direct);
    const snapshot = { nodeId: node.nodeId, sessionEpoch: node.sessionEpoch, snapshotGeneration: 1,
        issuedAt: input.issuedAt, validUntil: '2026-10-16T10:05:00Z', assignments, tombstones: [] };
    assert.equal(compileSnapshot(snapshot).executionExtension, 1);
    assert.throws(() => compileSnapshot({ ...snapshot, sessionEpoch: node.sessionEpoch + 1 }), /AUTHORIZATION_DENIED/);
    const changed = structuredClone(assignments); changed.find(a => a.role !== 'direct')!.driver.configDigest = 'sha256:' + '0'.repeat(64);
    assert.throws(() => compileSnapshot({ ...snapshot, assignments: changed }));
    assert.throws(() => compileSnapshot({ ...snapshot, policy: { ...DEFAULT_POLICY, maxAssignmentsPerNode: 1 } }), /Assignment limit/);
});
