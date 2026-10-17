import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProbeNegotiationRequest } from '@tunex/contracts';
import { ProbeNegotiator } from '../src/application/probe-negotiation.ts';
import { MySqlProbeMachineReader } from '../src/infrastructure/mysql-probe-machine.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { ProbeMachineEvidence } from '../src/modules/probe-negotiation-ports.ts';
import { createApp } from '../src/api/app.ts';
const command: ProbeNegotiationRequest = { protocolVersion: 3, probeVersion: 1, kind: 'probe-hello',
    nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, instanceId: 'a'.repeat(64), capability: 'probe.tcp-connect.v1',
    point: 'agent-direct-egress', maxTimeoutMs: 2000, maxAttempts: 1, applicationPayloadBytes: 0 };
function fixture() {
    const tx = Object.freeze({ marker: Symbol('tx') }), calls: string[] = [];
    const state: { current: ProbeMachineEvidence | undefined } = { current: { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2,
        revoked: false, credentialRevoked: false, nodeCredentialUntil: Date.now() + 120000,
        credentialUntil: Date.now() + 60000, retireAfter: null, capabilities: ['adp.3', 'native.direct.v1', 'tcp'] } };
    const host = new ProbeNegotiator({
        transaction: async action => { calls.push('begin'); const result = await action(tx); calls.push('commit'); return result; },
    }, { read: async (actual, node, fingerprint) => {
        assert.equal(actual, tx); assert.equal(node, 'node-a'); assert.equal(fingerprint, 'a'.repeat(64));
        calls.push('read'); return state.current;
    } });
    return { state, calls, host, run: (input = command) => host.hello('node-a', 'a'.repeat(64), 2, input) };
}
test('Probe negotiation returns only immutable session-bound recognition on the supplied read transaction', async () => {
    const f = fixture(), result = await f.run();
    assert.deepEqual(f.calls, ['begin', 'read', 'commit']);
    assert.equal(result.instanceId, command.instanceId); assert.equal(result.kind, 'probe-hello-ack');
    assert.equal(result.state, 'contract-only'); assert.equal(result.executionEnabled, false);
    assert.equal(Object.keys(result).some(key => /permit|lease|snapshot|target/i.test(key)), false);
    assert.ok(Object.isFrozen(result));
});
test('malformed declarations and session or fingerprint mismatches reject before transaction admission', async () => {
    const f = fixture();
    await assert.rejects(f.run({ ...command, probeVersion: 2 } as never), /INVALID_CONFIG/);
    await assert.rejects(f.host.hello('node-b', 'a'.repeat(64), 2, command), { code: 'SESSION_SUPERSEDED' });
    await assert.rejects(f.host.hello('node-a', 'a'.repeat(64), 3, command), { code: 'SESSION_SUPERSEDED' });
    await assert.rejects(f.host.hello('node-a', 'a'.repeat(64) + '\n', 2, command), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.calls, []);
});
test('retired boots, foreign evidence, revoked, missing or expired credentials and unavailable TCP facts cannot negotiate', async () => {
    for (const patch of [
        { nodeId: 'node-b' }, { bootId: null }, { bootId: 'boot-old' }, { sessionEpoch: 3 },
        { revoked: true }, { credentialRevoked: true }, { nodeCredentialUntil: Date.now() },
        { credentialUntil: Date.now() }, { retireAfter: Date.now() }, { credentialUntil: NaN },
        { capabilities: ['adp.3', 'native.direct.v1'] }, { capabilities: ['probe.tcp-connect.v1'] },
    ]) {
        const f = fixture(); f.state.current = { ...f.state.current!, ...patch }; await assert.rejects(f.run());
    }
    const f = fixture(); f.state.current = undefined; await assert.rejects(f.run(), { code: 'SESSION_SUPERSEDED' });
});
test('machine reader binds the supplied fingerprint to its Node, fails closed on missing credentials and detaches facts', async () => {
    const record = { node_id: 'node-a', boot_id: 'boot-a', session_epoch: 2, revoked: 0,
        credential_revoked: 0 as number | null, credential_until: Date.now() + 120000, valid_until: Date.now() + 60000,
        retire_after: null, facts: { capabilities: ['adp.3', 'tcp', 'native.direct.v1'] } };
    const tx = { execute: async (sql: string, parameters: unknown[]) => {
        assert.match(sql, /c.node_id=r.node_id AND c.fingerprint=\?/); assert.match(sql, /FOR SHARE/);
        assert.ok(!/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/.test(sql));
        assert.deepEqual(parameters, ['a'.repeat(64), 'node-a']); return [[record], []];
    } } as unknown as Transaction;
    const reader = new MySqlProbeMachineReader(), result = await reader.read(tx, 'node-a', 'a'.repeat(64));
    record.facts.capabilities.length = 0;
    assert.equal(result!.capabilities.length, 3);
    record.credential_revoked = null;
    assert.equal((await reader.read(tx, 'node-a', 'a'.repeat(64)))!.credentialRevoked, true);
});
test('the separate Probe hello endpoint cannot be reached with Bearer or spoofed session headers instead of mTLS', async () => {
    const app = createApp({} as never, {} as never, { allow: async () => undefined } as never);
    const response = await app.request('/agent/v3/probe/hello', { method: 'POST',
        headers: { Authorization: 'Bearer fake', 'X-TuneX-Session-Epoch': '2' }, body: JSON.stringify(command) });
    assert.equal(response.status, 401); assert.equal((await response.json() as { code: string }).code, 'UNAUTHENTICATED');
});
