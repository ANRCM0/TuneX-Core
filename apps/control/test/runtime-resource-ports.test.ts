import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { RuntimeResources } from '../src/framework/runtime-resources.ts';
import type { RelayResource, RuntimeResourceStore, RuntimeSlotKey, RuntimeSlotState } from '../src/framework/runtime-resource-ports.ts';
import type { RuntimePortReservationPolicy } from '../src/framework/runtime-port-policy-ports.ts';

const forward = (revision = 1): Forward => ({ id: 'forward', scopeId: 'scope', revision,
    spec: { enabled: true, protocols: ['udp', 'tcp'], ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 8080 } }, target: { host: 'example.com', port: 80 } } });
function fixture() {
    const tx = Object.freeze({ transaction: Symbol('original') }), events: string[] = [];
    const slot: RuntimeSlotState = { owner_id: null, fence: 4, deployment_generation: 2 };
    const state = { epoch: 2 as number | undefined, count: 2, maximum: null as number | null,
        previous: [{ owner_id: 'forward', fence: 2, deployment_generation: 8 }] as RuntimeSlotState[], owned: [] as RuntimeSlotKey[],policyError:undefined as Error|undefined };
    const trace = (current: typeof tx, action: string) => { assert.equal(current, tx); events.push(action); };
    const key = (value: RuntimeSlotKey) => `${value.nodeId}/${value.protocol}/${value.port}`;
    const store: RuntimeResourceStore<typeof tx> = {
        initializeNode: async (current, node) => { trace(current, `initialize:${node}`); },
        lockNode: async (current, node) => { trace(current, `node:${node}`); return state.epoch === undefined ? undefined : { session_epoch: state.epoch }; },
        maximumAuthorization: async (current, node) => { trace(current, `maximum:${node}`); return state.maximum; },
        ensureSlot: async (current, value) => { trace(current, `ensure:${key(value)}`); },
        lockSlot: async (current, value) => { trace(current, `lock:${key(value)}`); return { ...slot }; },
        lockOwnedSlots: async (current, node, owner) => { trace(current, `owned-lock:${node}/${owner}`); return state.previous; },
        assignSlot: async (current, value, owner, generation) => { trace(current, `assign:${key(value)}/${owner}/${generation}`); },
        countOwnedSlots: async (current, node) => { trace(current, `count:${node}`); return state.count; },
        ownedSlots: async (current, owner) => { trace(current, `owned:${owner}`); return state.owned; },
        releaseSlot: async (current, value, owner) => { trace(current, `release:${key(value)}/${owner}`); },
        releaseForwardSlots: async (current, owner) => { trace(current, `release-all:${owner}`); },
    };
    const portPolicy:RuntimePortReservationPolicy<typeof tx>={async assertReservation(current,intent,slots){
        assert.equal(current,tx);assert.equal(intent.id,'forward');assert.equal(intent.scopeId,'scope');
        for(const nodeId of new Set(slots.map(value=>value.nodeId)))assert.ok(events.includes(`node:${nodeId}`));
        events.push('port-policy');if(state.policyError)throw state.policyError;
    }};
    return { tx, events, slot, state, store, portPolicy, host: new RuntimeResources(store, 2,portPolicy) };
}

test('resource ports retain the caller transaction, Node session refusal and null versus zero authorization', async () => {
    const f = fixture();
    await f.host.initializeNode(f.tx, 'node'); await f.host.lockNode(f.tx, 'node', 2);
    assert.equal(await f.host.maximumAuthorization(f.tx, 'node'), null);
    f.state.maximum = 0; assert.equal(await f.host.maximumAuthorization(f.tx, 'node'), 0);
    for (const epoch of [0, 3, Number.NaN]) await assert.rejects(f.host.lockNode(f.tx, 'node', epoch), { code: 'SESSION_SUPERSEDED' });
    f.state.epoch = undefined; await assert.rejects(f.host.lockNode(f.tx, 'node'), { code: 'SESSION_SUPERSEDED' });
});

test('Direct reservation sorts physical protocols and refuses even the same existing owner', async () => {
    const f = fixture(), result = await f.host.reserve(f.tx, forward());
    assert.deepEqual(f.events, ['node:node','port-policy','ensure:node/tcp/8080', 'lock:node/tcp/8080', 'assign:node/tcp/8080/forward/1',
        'ensure:node/udp/8080', 'lock:node/udp/8080', 'assign:node/udp/8080/forward/1', 'count:node']);
    assert.deepEqual(result.map(value => [value.protocol, value.bindingFence, value.deploymentGeneration]), [['tcp', 5, 1], ['udp', 5, 1]]);
    f.events.length = 0; f.slot.owner_id = 'forward';
    await assert.rejects(f.host.reserve(f.tx, forward()), { code: 'PORT_RESERVED' });
    assert.deepEqual(f.events, ['node:node','port-policy','ensure:node/tcp/8080', 'lock:node/tcp/8080']);
});

test('Relay reservation orders physical resources while preserving forward protocol and allowing same-owner renewal', async () => {
    const f = fixture(); f.slot.owner_id = 'forward';
    const resources: RelayResource[] = [
        { nodeId: 'z', role: 'egress', forwardProtocol: 'udp', physicalProtocol: 'tcp', address: '127.0.0.1', port: 9000 },
        { nodeId: 'a', role: 'ingress', forwardProtocol: 'udp', physicalProtocol: 'udp', address: '127.0.0.1', port: 9000 },
        { nodeId: 'a', role: 'transit', forwardProtocol: 'udp', physicalProtocol: 'tcp', address: '127.0.0.1', port: 9001 },
    ];
    const reserved = await f.host.reserveRelay(f.tx, forward(), resources, 9);
    assert.deepEqual(f.events.slice(0,3),['node:a','node:z','port-policy']);
    assert.deepEqual(reserved.map(value => [value.nodeId, value.physicalProtocol, value.forwardProtocol, value.deploymentGeneration]),
        [['a', 'tcp', 'udp', 9], ['a', 'udp', 'udp', 9], ['z', 'tcp', 'udp', 9]]);
    assert.deepEqual(f.events.filter(value => value.startsWith('lock:')), ['lock:a/tcp/9001', 'lock:a/udp/9000', 'lock:z/tcp/9000']);
    assert.deepEqual(f.events.slice(-2), ['count:z', 'count:a']);
    assert.deepEqual(resources.map(value => value.nodeId), ['z', 'a', 'a']);
});

test('resource capacity failure follows all reservations and propagates for caller rollback', async () => {
    const f = fixture(); f.state.count = 3;
    let rolledBack = false;
    const transaction = async () => { try { await f.host.reserve(f.tx, forward()); } catch (error) { rolledBack = true; throw error; } };
    await assert.rejects(transaction(), { code: 'RESOURCE_LIMIT' });
    assert.equal(rolledBack, true); assert.equal(f.events.filter(value => value.startsWith('assign:')).length, 2);
    assert.equal(f.events.at(-1), 'count:node');
});

test('transition locks Node and policy before prior ownership and keeps old slots through the drain window', async () => {
    const f = fixture(); f.slot.owner_id = 'forward';
    const reserved = await f.host.transition(f.tx, forward(), forward(7));
    assert.deepEqual(f.events.slice(0,3), ['node:node','port-policy','owned-lock:node/forward']);
    assert.deepEqual(reserved.map(value => value.deploymentGeneration), [9, 9]);
    assert.equal(f.events.some(value => value.startsWith('release:') || value.startsWith('count:')), false);
    f.state.previous = []; f.slot.deployment_generation = 3; f.events.length = 0;
    assert.equal((await f.host.transition(f.tx, forward(), forward(12)))[0]?.deploymentGeneration, 12);
});

test('fence and generation exhaustion refuse writes at the original resource lock boundary', async () => {
    const f = fixture(); f.slot.fence = MAX_COUNTER;
    await assert.rejects(f.host.reserve(f.tx, forward()), { code: 'RESOURCE_LIMIT' });
    assert.equal(f.events.some(value => value.startsWith('assign:')), false);
    f.slot.fence = 0; f.slot.deployment_generation = MAX_COUNTER; f.events.length = 0;
    await assert.rejects(f.host.transition(f.tx, forward(), forward()), { code: 'RESOURCE_LIMIT' });
    assert.equal(f.events.some(value => value.startsWith('assign:')), false);
    f.events.length = 0;
    await assert.rejects(f.host.reserveRelay(f.tx, forward(), [], MAX_COUNTER + 1), { code: 'RESOURCE_LIMIT' });
    assert.deepEqual(f.events, []);
});

test('slot removal preserves enumeration order and exact owner and physical protocol predicates', async () => {
    const f = fixture(); f.state.owned = [
        { nodeId: 'old', protocol: 'tcp', port: 8080 }, { nodeId: 'node', protocol: 'tcp', port: 8080 },
        { nodeId: 'node', protocol: 'udp', port: 8080 }, { nodeId: 'node', protocol: 'tcp', port: 8081 },
    ];
    await f.host.releaseObsoleteSlots(f.tx, forward());
    assert.deepEqual(f.events, ['owned:forward', 'release:old/tcp/8080/forward', 'release:node/tcp/8081/forward']);
    f.events.length = 0; await f.host.retainSlots(f.tx, 'forward', [{ nodeId: 'node', protocol: 'udp', port: 8080 }]);
    assert.deepEqual(f.events, ['owned:forward', 'release:old/tcp/8080/forward', 'release:node/tcp/8080/forward', 'release:node/tcp/8081/forward']);
});


test('port-policy rejection follows original Node lock and precedes every slot write',async()=>{
    const f=fixture(),failure=new Error('Node owner refused original reservation');f.state.policyError=failure;
    await assert.rejects(f.host.reserve(f.tx,forward(),'creating-actor'),error=>error===failure);
    assert.deepEqual(f.events,['node:node','port-policy']);
});

test('ownership attribution locks actual retained and current path Nodes without reserving',async()=>{
    const f=fixture();f.state.owned=[{nodeId:'z',protocol:'tcp',port:9000},{nodeId:'a',protocol:'udp',port:9000}];
    const current={...forward(),spec:{...forward().spec,path:{via:['z','b']}}};
    await f.host.lockOwnership(f.tx,current);
    assert.deepEqual(f.events,['owned:forward','node:a','node:b','node:node','node:z']);
    assert.equal(f.events.includes('port-policy'),false);
});
