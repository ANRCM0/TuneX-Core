import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecoveryQuarantine } from '../src/modules/recovery-owner/quarantine.ts';
import type { RecoveryQuarantineContext, RecoveryQuarantineOwners } from '../src/modules/recovery-owner/contracts.ts';

const order = ['transport', 'relay', 'nodes', 'telemetry', 'station', 'notification', 'probeHistory', 'probePlans', 'probeQualifications', 'observationServices',
    'pathPublications', 'ingressDeployments', 'ingressMigrations', 'probeInstances', 'probePermits', 'forwards', 'ledger', 'idempotency'] as const;
function fixture(failAt = '') {
    const tx = Object.freeze({ identity: Symbol('supplied') }), events: string[] = [], failure = new Error('owner failure');
    const accounts = [{ actorId: 'account', token: 'credential', owner: true }];
    const mutate = (name: typeof order[number]) => async (supplied: typeof tx, at?: number) => {
        assert.equal(supplied, tx); events.push(name);
        if (['pathPublications', 'ingressDeployments', 'ingressMigrations'].includes(name)) assert.equal(at, 101);
        else assert.equal(at, undefined);
        if (name === failAt) throw failure;
    };
    const owners: RecoveryQuarantineOwners<typeof tx> = {
        identity: async supplied => { assert.equal(supplied, tx); events.push('identity'); return accounts; },
        transport: mutate('transport'), relay: mutate('relay'), nodes: mutate('nodes'), telemetry: mutate('telemetry'), station: mutate('station'),
        notification: mutate('notification'), probeHistory: mutate('probeHistory'), probePlans: mutate('probePlans'), probeQualifications: mutate('probeQualifications'),
        observationServices: mutate('observationServices'), pathPublications: mutate('pathPublications'), ingressDeployments: mutate('ingressDeployments'),
        ingressMigrations: mutate('ingressMigrations'), probeInstances: mutate('probeInstances'), probePermits: mutate('probePermits'),
        forwards: mutate('forwards'), ledger: mutate('ledger'), idempotency: mutate('idempotency'),
    };
    const context: RecoveryQuarantineContext = { recoveryId: 'recovery', manifest: { id: 'backup', database: 'old-db', trustDigest: 'old-trust' },
        authority: { latestValidUntil: 99 }, get newTrustDigest() { events.push('new-trust'); return 'new-trust'; },
        acceptCredentials: supplied => { assert.equal(supplied, accounts); events.push('accounts'); } };
    let now = 100;
    const host = new RecoveryQuarantine({ owners, effects: { now: () => { events.push('now'); return ++now; }, encode: value => { events.push('encode'); return JSON.stringify(value); } },
        events: { record: async (supplied, id, at, details) => { assert.equal(supplied, tx); assert.equal(id, 'recovery'); assert.equal(at, 102);
            assert.deepEqual(JSON.parse(details), { backupId: 'backup', sourceDatabase: 'old-db', oldTrust: 'old-trust', newTrust: 'new-trust', authorizationCutoff: 99, reviewRequired: true }); events.push('event'); } } });
    return { tx, events, context, host, failure };
}

test('recovery quarantine preserves one transaction, immediate accounts and shared publication time before final event encoding', async () => {
    const f = fixture(); await f.host.run(f.tx, f.context);
    assert.deepEqual(f.events, ['identity', 'accounts', ...order.slice(0, 10), 'now', ...order.slice(10), 'now', 'new-trust', 'encode', 'event']);
});

test('recovery quarantine propagates every owner failure and stops subsequent owners/event without retries', async () => {
    for (const [index, name] of order.entries()) {
        const f = fixture(name); await assert.rejects(f.host.run(f.tx, f.context), error => error === f.failure);
        const prefix = ['identity', 'accounts', ...order.slice(0, index + 1)]; if (index >= 10) prefix.splice(12, 0, 'now');
        assert.deepEqual(f.events, prefix, name); assert.equal(f.events.includes('event'), false);
    }
});
