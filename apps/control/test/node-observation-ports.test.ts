import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { NodeObservations, NODE_OBSERVATION_LIMITS } from '../src/application/node-observations.ts';
import { ControlError } from '../src/application/errors.ts';
import { observeNodeReport } from '../src/modules/node-report-observation.ts';
import type { AuthorizedNodeReportReader, NodeObservationContext, NodeReportEvidence } from '../src/modules/observation-ports.ts';
import { MySqlNodeObservationReader } from '../src/infrastructure/mysql-node-observation.ts';
import type { MySqlUnitOfWork, Transaction } from '../src/infrastructure/mysql.ts';

const command = { source: 'persisted-agent-report', version: 1 };
const policy = { freshnessMs: 30000, clockSkewMs: 5000 };
function evidence(now = Date.now()): NodeReportEvidence {
    return {
        scopeId: 'scope-a', nodeId: 'node-a', revoked: false, credentialUntil: now + 120000,
        sessionEpoch: 2, bootId: 'boot-a', snapshotGeneration: 3, snapshotValidUntil: now + 60000,
        invalidReport: false, report: { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2,
            reportSequence: 4, snapshotGeneration: 3, observedAt: now, receivedAt: now, assignmentCount: 2 },
    };
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
function errorCode(code: string, status?: number) {
    return (error: unknown) => error instanceof ControlError && error.code === code &&
        (status === undefined || error.status === status);
}

test('observation requests reject unknown sources, versions, targets, shapes and coercion before admission', async () => {
    let reads = 0;
    const host = new NodeObservations({ read: async () => { reads++; return evidence(); } }, policy);
    for (const input of [null, [], {}, { ...command, source: 'tcp-probe' }, { ...command, version: 2 },
        { ...command, host: '169.254.169.254' }, { ...command, timeoutMs: '100' }, { ...command, timeoutMs: null },
        { ...command, timeoutMs: 99 }, { ...command, timeoutMs: 2001 }, { ...command, timeoutMs: 100.5 },
        Object.create(command)]) {
        await assert.rejects(host.observe('actor-a', 'scope-a', 'node-a', input), errorCode('INVALID_CONFIG'));
    }
    for (const [actor, scope, node] of [['actor-a\n', 'scope-a', 'node-a'], ['actor-a', '../scope', 'node-a'],
        ['actor-a', 'scope-a', 'node-a\n']]) {
        await assert.rejects(host.observe(actor!, scope!, node!, command), errorCode('INVALID_CONFIG'));
    }
    assert.equal(reads, 0);
});

test('the passive host captures its reader and detaches immutable public evidence without raw reports or health claims', async () => {
    const raw = evidence(), entered = deferred<void>(), finish = deferred<void>();
    const source: AuthorizedNodeReportReader = { read: async context => {
        assert.ok(Object.isFrozen(context));
        assert.equal(context.actorId, 'actor-a'); assert.equal(context.scopeId, 'scope-a');
        assert.equal(context.nodeId, 'node-a'); assert.ok(context.deadlineAt > Date.now());
        entered.resolve(); await finish.promise;
        return Object.assign(raw, { secret: 'MUST_NOT_LEAK' });
    } };
    const host = new NodeObservations(source, policy);
    source.read = async () => { throw new Error('mutated reader'); };
    const input = { ...command, timeoutMs: 2000 };
    const pending = host.observe('actor-a', 'scope-a', 'node-a', input);
    await entered.promise;
    input.timeoutMs = 1; input.source = 'tcp-probe';
    finish.resolve();
    const result = await pending;
    assert.equal(result.status, 'observed'); assert.equal(result.health, 'unknown');
    assert.equal(result.independentProbe, false); assert.equal(result.source, 'persisted-agent-report');
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.provenance));
    assert.notEqual(result.provenance, raw.report);
    assert.ok(!JSON.stringify(result).includes('MUST_NOT_LEAK'));
    assert.ok(new TextEncoder().encode(JSON.stringify(result)).length <= NODE_OBSERVATION_LIMITS.maxResultBytes);
});

test('report status separates missing, invalid, stale, revoked and incompatible evidence from fresh observations', () => {
    const now = Date.now(), base = evidence(now), report = base.report!;
    const cases: [Partial<NodeReportEvidence>, string, string][] = [
        [{ report: null }, 'unknown', 'missing-report'],
        [{ invalidReport: true, report: null }, 'unknown', 'invalid-report'],
        [{ revoked: true }, 'unknown', 'node-revoked'],
        [{ credentialUntil: now }, 'unknown', 'credential-expired'],
        [{ bootId: 'boot-new' }, 'unknown', 'session-mismatch'],
        [{ sessionEpoch: 3 }, 'unknown', 'session-mismatch'],
        [{ report: { ...report, nodeId: 'other-node' } }, 'unknown', 'session-mismatch'],
        [{ snapshotGeneration: 4 }, 'unknown', 'snapshot-mismatch'],
        [{ report: { ...report, snapshotGeneration: 0 } }, 'unknown', 'snapshot-mismatch'],
        [{ report: { ...report, receivedAt: now + 1 } }, 'unknown', 'clock-skew'],
        [{ report: { ...report, observedAt: now + 5001 } }, 'unknown', 'clock-skew'],
        [{ report: { ...report, receivedAt: now - 30000 } }, 'stale', 'report-expired'],
        [{ report: { ...report, observedAt: now - 30000 } }, 'stale', 'report-expired'],
        [{ snapshotValidUntil: now + 5000 }, 'stale', 'snapshot-expired'],
        [{ snapshotValidUntil: null }, 'stale', 'snapshot-expired'],
    ];
    for (const [patch, status, reason] of cases) {
        const result = observeNodeReport({ ...base, ...patch }, 'scope-a', 'node-a', now, policy);
        assert.equal(result.status, status, reason); assert.equal(result.reason, reason);
        assert.equal(result.health, 'unknown'); assert.equal(result.independentProbe, false);
    }
});

test('freshness expires at the earliest report, snapshot or credential bound and never extends from Agent clock skew', () => {
    const now = Date.now(), base = evidence(now);
    for (const [patch, expires] of [
        [{}, now + 30000],
        [{ snapshotValidUntil: now + 15000 }, now + 10000],
        [{ credentialUntil: now + 1000 }, now + 1000],
        [{ report: { ...base.report!, observedAt: now + 4000 } }, now + 30000],
    ] as [Partial<NodeReportEvidence>, number][]) {
        assert.equal(observeNodeReport({ ...base, ...patch }, 'scope-a', 'node-a', now, policy).expiresAt,
            new Date(expires).toISOString());
    }
    assert.equal(observeNodeReport(base, 'scope-a', 'node-a', now,
        { ...policy, clockSkewMs: Number.MAX_SAFE_INTEGER }).expiresAt, new Date(0).toISOString());
});

test('malformed and foreign source results fail closed instead of widening the returned scope', async () => {
    for (const patch of [{ scopeId: 'other-scope' }, { nodeId: 'other-node' }, { bootId: 'boot-a\n' },
        { report: { ...evidence().report!, assignmentCount: 10001 } },
        { report: { ...evidence().report!, reportSequence: Number.MAX_SAFE_INTEGER + 1 } },
        { snapshotValidUntil: Number.NaN }]) {
        const host = new NodeObservations({ read: async () => ({ ...evidence(), ...patch }) }, policy);
        await assert.rejects(host.observe('actor-a', 'scope-a', 'node-a', command), errorCode('OBSERVATION_INVALID_RESULT'));
    }
});

test('source failures are sanitized while missing resources and denied authorization retain their HTTP meaning', async () => {
    for (const [failure, code, status] of [
        [new Error('password=MUST_NOT_LEAK'), 'OBSERVATION_FAILED', 503],
        [new ControlError('NOT_FOUND', 404, 'MUST_NOT_LEAK'), 'NOT_FOUND', 404],
        [new ControlError('AUTHORIZATION_DENIED', 403, 'MUST_NOT_LEAK'), 'AUTHORIZATION_DENIED', 403],
    ] as const) {
        const host = new NodeObservations({ read: async () => { throw failure; } }, policy);
        await assert.rejects(host.observe('actor-a', 'scope-a', 'node-a', command), error =>
            errorCode(code, status)(error) && error instanceof Error && !error.message.includes('MUST_NOT_LEAK'));
    }
});

test('already cancelled work never enters the reader and client cancellation aborts admitted work', async () => {
    const controller = new AbortController(), entered = deferred<void>(), finish = deferred<NodeReportEvidence>();
    let calls = 0, context: NodeObservationContext | undefined;
    const host = new NodeObservations({ read: async work => {
        calls++; context = work; entered.resolve(); return finish.promise;
    } }, policy);
    controller.abort('MUST_NOT_LEAK');
    await assert.rejects(host.observe('actor-a', 'scope-a', 'node-a', command, controller.signal),
        errorCode('OBSERVATION_CANCELLED'));
    assert.equal(calls, 0);
    const second = new AbortController();
    const pending = host.observe('actor-a', 'scope-a', 'node-a', command, second.signal);
    const rejected = assert.rejects(pending, errorCode('OBSERVATION_CANCELLED'));
    await entered.promise; second.abort('MUST_NOT_LEAK'); await rejected;
    assert.equal(context?.signal.aborted, true);
    finish.resolve(evidence());
    await delay(0);
});

test('a deadline discards late evidence and holds the node budget until the reader actually stops', async () => {
    const finish = deferred<NodeReportEvidence>();
    let context: NodeObservationContext | undefined, calls = 0;
    const host = new NodeObservations({ read: async work => {
        context = work; calls++; return calls === 1 ? finish.promise : evidence();
    } }, policy);
    await assert.rejects(host.observe('actor-a', 'scope-a', 'node-a', { ...command, timeoutMs: 100 }),
        errorCode('OBSERVATION_TIMEOUT'));
    assert.equal(context?.signal.aborted, true);
    await assert.rejects(host.observe('actor-b', 'scope-a', 'node-a', command), errorCode('OBSERVATION_BUSY'));
    finish.resolve(evidence()); await delay(0);
    assert.equal((await host.observe('actor-b', 'scope-a', 'node-a', command)).status, 'observed');
    assert.equal(calls, 2);
});

test('per-actor and per-node concurrency budgets prevent cross-scope and cross-actor bypass', async () => {
    const entered = deferred<void>(), finish = deferred<NodeReportEvidence>();
    const host = new NodeObservations({ read: async () => { entered.resolve(); return finish.promise; } }, policy);
    const pending = host.observe('actor-a', 'scope-a', 'node-a', command);
    await entered.promise;
    await assert.rejects(host.observe('actor-a', 'scope-b', 'node-b', command), errorCode('OBSERVATION_BUSY', 429));
    await assert.rejects(host.observe('actor-b', 'scope-a', 'node-a', command), errorCode('OBSERVATION_BUSY', 429));
    finish.resolve(evidence()); await pending;
    await assert.rejects(host.observe('actor-a', 'scope-a', 'node-a', command), errorCode('OBSERVATION_BUSY'));
});

test('cancelled uncooperative readers cannot release global admission early', async () => {
    const finish = deferred<NodeReportEvidence>(), host = new NodeObservations({ read: async () => finish.promise }, policy);
    for (let index = 0; index < NODE_OBSERVATION_LIMITS.maxActive; index++) {
        const controller = new AbortController();
        const pending = host.observe('actor-' + index, 'scope-a', 'node-' + index, command, controller.signal);
        const rejected = assert.rejects(pending, errorCode('OBSERVATION_CANCELLED'));
        await delay(0); controller.abort(); await rejected;
    }
    await assert.rejects(host.observe('actor-extra', 'scope-a', 'node-extra', command), errorCode('OBSERVATION_BUSY'));
    finish.resolve(evidence()); await delay(0);
});

test('the per-process cooldown expires and policy cannot be weakened by mutating constructor inputs', async () => {
    const settings = { ...policy };
    const host = new NodeObservations({ read: async () => evidence(Date.now() - 40000) }, settings);
    settings.freshnessMs = 300000;
    assert.equal((await host.observe('actor-a', 'scope-a', 'node-a', command)).status, 'stale');
    await assert.rejects(host.observe('actor-a', 'scope-a', 'node-a', command), errorCode('OBSERVATION_BUSY'));
    await delay(NODE_OBSERVATION_LIMITS.cooldownMs + 20);
    assert.equal((await host.observe('actor-a', 'scope-a', 'node-a', command)).status, 'stale');
});

const rawReportProjection = /(?:\bSELECT|,)\s*r\.last_report(?:\s+(?:AS\s+)?[a-z_][a-z0-9_]*)?\s*(?:,|\bFROM\b)/i;
test('the raw-report projection guard distinguishes selected bodies from bounded JSON function arguments', () => {
    for (const sql of ['SELECT r.last_report FROM runtime_nodes r', 'SELECT n.id,r.last_report, r.node_id FROM runtime_nodes r',
        'SELECT n.id,r.last_report AS body FROM runtime_nodes r', 'SELECT r.last_report body FROM runtime_nodes r'])
        assert.match(sql, rawReportProjection);
    assert.doesNotMatch("SELECT LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.last_report,'$.nodeId')),129) report_node, JSON_LENGTH(r.last_report,'$.observations') observation_count FROM runtime_nodes r", rawReportProjection);
});

function mysqlFixture(allowed = true) {
    const events: string[] = [], controller = new AbortController(), now = Date.now();
    const tx = {
        connection: { stream: { destroy: (_error: Error) => { events.push('transport-stop'); } } },
        query: async () => { events.push('isolation'); },
        beginTransaction: async () => { events.push('begin'); },
        rollback: async () => { events.push('rollback'); },
        release: () => { events.push('release'); },
        destroy: () => { events.push('destroy'); },
        execute: async (sql: string, args: unknown[]) => {
            events.push('read');
            assert.ok(sql.includes('n.id=? AND n.scope_id=?'));
            assert.doesNotMatch(sql, rawReportProjection, 'raw report bodies must not be selected');
            assert.deepEqual(args, ['node-a', 'scope-a']);
            return [[{ id: 'node-a', scope_id: 'scope-a', revoked: 0, credential_until: now + 60000,
                session_epoch: 2, boot_id: 'boot-a', snapshot_generation: 3, received_at: now,
                last_report_sequence: 4, valid_until: now + 60000, has_report: 1,
                report_node: 'node-a', report_boot: 'boot-a', report_epoch: '2', report_sequence: '4',
                report_snapshot: '3', report_time: new Date(now).toISOString(), observation_count: 2 }], []];
        },
    };
    const db = { pool: { getConnection: async () => tx }, guard: async () => { events.push('guard'); } } as unknown as
        Pick<MySqlUnitOfWork, 'pool' | 'guard'>;
    const reader = new MySqlNodeObservationReader(db, { scope: async (current, actor, scope, manage) => {
        assert.equal(current, tx); assert.equal(actor, 'actor-a'); assert.equal(scope, 'scope-a'); assert.ok(!manage);
        events.push('authorize');
        if (!allowed) throw new ControlError('NOT_FOUND', 404, 'denied');
    } });
    const context: NodeObservationContext = Object.freeze({
        actorId: 'actor-a', scopeId: 'scope-a', nodeId: 'node-a', deadlineAt: now + 2000, signal: controller.signal,
    });
    return { events, controller, tx, db, reader, context };
}

test('the MySQL observer authorizes before its scoped projection in one transaction and always rolls back reads', async () => {
    const f = mysqlFixture();
    const result = await f.reader.read(f.context);
    assert.equal(result.report?.reportSequence, 4); assert.equal(result.invalidReport, false);
    assert.deepEqual(f.events, ['guard', 'isolation', 'begin', 'authorize', 'read', 'guard', 'rollback', 'release']);
    const denied = mysqlFixture(false);
    await assert.rejects(denied.reader.read(denied.context), errorCode('NOT_FOUND'));
    assert.deepEqual(denied.events, ['guard', 'isolation', 'begin', 'authorize', 'rollback', 'release']);
});

test('MySQL cancellation destroys only the observation connection and never releases a dirty transaction', async () => {
    const f = mysqlFixture(), entered = deferred<void>(), finish = deferred<void>();
    f.tx.execute = async () => { entered.resolve(); await finish.promise; throw new Error('connection stopped'); };
    const pending = f.reader.read(f.context), rejected = assert.rejects(pending);
    await entered.promise; f.controller.abort();
    assert.ok(f.events.includes('destroy'));
    finish.resolve();
    await rejected;
    assert.ok(!f.events.includes('release')); assert.ok(!f.events.includes('rollback'));
});

test('pool acquisition after cancellation is destroyed and failed rollback is never returned to the pool', async () => {
    const f = mysqlFixture(), connection = deferred<Transaction>();
    f.db.pool.getConnection = () => connection.promise;
    const pending = f.reader.read(f.context), rejected = assert.rejects(pending);
    f.controller.abort(); connection.resolve(f.tx as unknown as Transaction); await rejected;
    assert.deepEqual(f.events, ['transport-stop', 'destroy']);
    const broken = mysqlFixture();
    broken.tx.rollback = async () => { throw new Error('rollback failed'); };
    await assert.rejects(broken.reader.read(broken.context), /rollback failed/);
    assert.equal(broken.events.at(-1), 'destroy'); assert.ok(!broken.events.includes('release'));
});
