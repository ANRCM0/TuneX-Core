import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MySqlPathPublicationStore } from '../src/infrastructure/mysql-publication-store.ts';
import { MySqlIngressDeploymentStore } from '../src/infrastructure/mysql-ingress-deployment-store.ts';
import { MySqlIngressMigrationStore } from '../src/infrastructure/mysql-ingress-migration-store.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { PathPublicationStorageValues } from '../src/framework/public.ts';
import { ControlError } from '../src/framework/errors.ts';
import { pathPublicationStorageValues } from '../src/modules/path-owner/publication-storage-values.ts';
import { PATH_PUBLICATION_REJECTIONS } from '../src/modules/path-owner/publication-values.ts';

const stores = [
    ['path_publication_forward', (values: PathPublicationStorageValues<string>) => new MySqlPathPublicationStore(values)],
    ['ingress_deployment_forward', (values: PathPublicationStorageValues<string>) => new MySqlIngressDeploymentStore(values)],
    ['ingress_migration_forward', (values: PathPublicationStorageValues<string>) => new MySqlIngressMigrationStore(values)],
] as const;

for (const [name, create] of stores) {
    function fixture() {
        const trace: string[] = [], sentinel = new Error('action'), faults = { query: '', classify: false, project: false, refused: true };
        const failure = new Error('adapter failure');
        const tx = { query: async (sql: string) => {
            trace.push(sql); if (sql === faults.query) throw failure; return [[], []];
        } } as unknown as Transaction;
        const store = create({
            isRefusal(error) { assert.equal(error, sentinel); trace.push('classify'); if (faults.classify) throw failure; return faults.refused; },
            refusal(error) { assert.equal(error, sentinel); trace.push('project'); if (faults.project) throw failure; return 'refused'; },
        });
        return { trace, sentinel, faults, failure, tx, store };
    }

    test(`${name} success keeps result identity and releases after the original action`, async () => {
        const f = fixture(), value = { original: true };
        const result = await f.store.isolate(f.tx, async () => { f.trace.push('action'); return value; });
        assert.equal(result.accepted, true); if (result.accepted) assert.equal(result.value, value);
        assert.deepEqual(f.trace, [`SAVEPOINT ${name}`, 'action', `RELEASE SAVEPOINT ${name}`]);
    });

    test(`${name} classifies before rollback and projects only after release`, async () => {
        const f = fixture();
        assert.deepEqual(await f.store.isolate(f.tx, async () => { f.trace.push('action'); throw f.sentinel; }),
            { accepted: false, error: 'refused' });
        assert.deepEqual(f.trace, [`SAVEPOINT ${name}`, 'action', 'classify', `ROLLBACK TO SAVEPOINT ${name}`,
            `RELEASE SAVEPOINT ${name}`, 'project']);
    });

    test(`${name} unknown errors and classifier faults escape without savepoint rollback`, async () => {
        for (const classify of [false, true]) {
            const f = fixture(); f.faults.refused = false; f.faults.classify = classify;
            await assert.rejects(f.store.isolate(f.tx, async () => { throw f.sentinel; }),
                error => error === (classify ? f.failure : f.sentinel));
            assert.deepEqual(f.trace, [`SAVEPOINT ${name}`, 'classify']);
        }
    });

    test(`${name} every savepoint or late projection failure escapes by identity`, async () => {
        for (const point of ['create', 'rollback', 'release', 'project', 'success-release']) {
            const f = fixture();
            f.faults.query = point === 'create' ? `SAVEPOINT ${name}` : point === 'rollback' ? `ROLLBACK TO SAVEPOINT ${name}` :
                point.includes('release') ? `RELEASE SAVEPOINT ${name}` : '';
            f.faults.project = point === 'project';
            await assert.rejects(f.store.isolate(f.tx, async () => {
                f.trace.push('action'); if (point !== 'success-release') throw f.sentinel; return 'value';
            }), error => error === f.failure);
            if (point === 'create') assert.deepEqual(f.trace, [`SAVEPOINT ${name}`]);
            if (point === 'rollback') assert.ok(!f.trace.includes(`RELEASE SAVEPOINT ${name}`));
            if (point !== 'project') assert.ok(!f.trace.includes('project'));
            assert.equal(f.trace.filter(step => step === 'action').length, point === 'create' ? 0 : 1);
        }
    });
}

test('publication refusal classifier retains error identity, status bounds, retryable guard and shared mutable code Set', () => {
    const code = [...PATH_PUBLICATION_REJECTIONS][0]!;
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429, 503] as const) {
        assert.equal(pathPublicationStorageValues.isRefusal(new ControlError(code, status, 'message')),
            [403, 404, 409, 422, 429].includes(status));
        assert.equal(pathPublicationStorageValues.isRefusal(new ControlError(code, status, 'message', true)), false);
    }
    assert.equal(pathPublicationStorageValues.isRefusal({ code, status: 409, retryable: false }), false);
    const added = 'TEST_MUTABLE_REFUSAL';
    assert.equal(pathPublicationStorageValues.isRefusal(new ControlError(added, 409, 'message')), false);
    PATH_PUBLICATION_REJECTIONS.add(added);
    try {
        const error = new ControlError(added, 409, 'message');
        assert.equal(pathPublicationStorageValues.isRefusal(error), true);
        assert.deepEqual(pathPublicationStorageValues.refusal(error), { code: added, status: 409 });
    } finally { PATH_PUBLICATION_REJECTIONS.delete(added); }
});
