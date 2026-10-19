import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { digest } from '@tunex/contracts';
import { parseProbeResult, parseProbeTypes, parseProbeServices, probeResultDigest, probeTypesResultDigest, probeServicesResultDigest } from '@tunex/contracts/probe';
import type { ProbeResultRequest } from '@tunex/contracts/probe';
import { parseProbeEcho, probeEchoInvocationDigest, probeEchoRequestFrame, probeEchoResultDigest, verifyProbeEchoProof } from '@tunex/contracts/staged/probe-echo';
import type { ProbeEchoServiceContext, ProbeEchoInvocation, ProbeEchoProof, ProbeEchoResultRequest } from '@tunex/contracts/staged/probe-echo';
import * as native from '../src/compatibility/public.ts';
import { ProbePermits, probeMeasurement } from '../src/modules/probe-owner/public.ts';
import type { ProbePermitRecord, ProbePermitStore, ForwardProbePlan } from '../src/modules/probe-owner/public.ts';
import type { ProbeResultRecord } from '../src/modules/probe-owner/result-contracts.ts';
import { ProbeRunHistoryRecorder, parseProbeRunPermit, parseProbeRunRecord, parseProbeRunResult, probeRunImmutable, probeRunStorageValues, publicProbeRun } from '../src/modules/probe-history-owner/public.ts';
import type { ProbeRunPermit, ProbeRunRecord, ProbeRunResult, ProbeRunStore } from '../src/modules/probe-history-owner/public.ts';
import { MySqlProbeHistoryStore } from '../src/infrastructure/mysql-probe-history-store.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import { Identity } from '../src/modules/identity.ts';

// Readiness 186: staged v4 parsing/history is deliberately separate from the v1/v2/v3 machine API.
const fixture = JSON.parse(await readFile(new URL('../../../docs/protocol/fixtures/probe-result-v1.json', import.meta.url), 'utf8')) as { request: ProbeResultRequest };
const base = fixture.request, issued = Date.parse(base.issuedAt), consumed = Date.parse(base.consumedAt), accepted = Date.parse(base.measuredAt) + 10;
const fingerprint = 'f'.repeat(64), hash = (value: Uint8Array) => 'sha256:' + createHash('sha256').update(value).digest('hex');
const measurements = ['tcp-connect-v1', 'tcp-ingress-connect-v1', 'tcp-ingress-tls-v1', 'tcp-ingress-echo-v1', 'udp-ingress-echo-v1'] as const;
type Measurement = typeof measurements[number];
const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
function context(echo: boolean) {
    const config = echo ? { version: 2, purpose: 'controlled-nonce-echo', endpoint: { address: '127.0.0.1', port: 9000, protocols: ['tcp', 'udp'] },
        trust: { mode: 'ed25519-echo-v1', publicKey }, validFrom: issued, validUntil: issued + 2000 }
        : { version: 1, purpose: 'direct-ingress-tls-handshake', endpoint: { address: '127.0.0.1', port: 9000 },
            trust: { mode: 'pinned-leaf-v1', serverName: 'probe.example', certificateDer: 'AQ==' }, validFrom: issued, validUntil: issued + 2000 };
    const value = { scopeId: 'scope-a', serviceId: 'service-a', revision: 1, configRevision: 1, configDigest: digest(config), config };
    return { ...value, contextDigest: digest(value) };
}
function permit(measurement: Measurement = 'tcp-connect-v1', id = base.permitId): ProbePermitRecord {
    const value: ProbePermitRecord = { id, actorId: 'owner', scopeId: 'scope-a', binding: structuredClone(base.binding),
        instanceId: base.instanceId, instanceGeneration: base.instanceGeneration, fingerprint, timeoutMs: base.timeoutMs,
        issuedAt: issued, expiresAt: Date.parse(base.expiresAt), state: 'consumed', closedAt: consumed,
        ...(measurement === 'tcp-connect-v1' ? {} : { measurement }),
        ...(measurement.includes('tls') || measurement.includes('echo') ? { serviceContext: context(measurement.includes('echo')) as ProbeEchoServiceContext } : {}) };
    if (!measurement.includes('echo')) return value;
    const nonce = Buffer.alloc(32, 7).toString('base64');
    const invocation = native.nativeProbeEchoInvocation(value, () => value.serviceContext!, () => nonce);
    return { ...value, echoChallenge: { nonce, invocationDigest: probeEchoInvocationDigest(invocation) } };
}
function historyPermit(value: ProbePermitRecord): ProbeRunPermit {
    return parseProbeRunPermit({ probeId: value.id, actorId: value.actorId, scopeId: value.scopeId, binding: value.binding,
        instanceId: value.instanceId, instanceGeneration: value.instanceGeneration, timeoutMs: value.timeoutMs,
        issuedAt: value.issuedAt, expiresAt: value.expiresAt, state: value.state, closedAt: value.closedAt,
        ...(value.measurement === undefined ? {} : { measurement: value.measurement }),
        ...(value.serviceContext ? { service: value.measurement?.includes('echo') ? native.probeEchoServiceSelection(value.serviceContext)
            : native.probeServiceSelection(value.serviceContext as native.ProbeServiceContext) } : {}),
        ...(value.echoChallenge ? { echoChallenge: value.echoChallenge } : {}) });
}
function invocation(value: ProbePermitRecord): ProbeEchoInvocation {
    return native.nativeProbeEchoInvocation(value, () => value.serviceContext!, () => value.echoChallenge!.nonce);
}
function proof(value: ProbePermitRecord): ProbeEchoProof {
    const frame = probeEchoRequestFrame(invocation(value), value.echoChallenge!), requestDigest = hash(frame);
    const response = Buffer.alloc(192); frame.copy(response, 0, 0, 120); response.write('TNXECHOR', 0, 'ascii');
    Buffer.from(requestDigest.slice(7), 'hex').copy(response, 120);
    return { algorithm: 'Ed25519', requestDigest, signature: sign(null,
        Buffer.concat([Buffer.from('tunex.echo.response.v1\0', 'ascii'), response]), keys.privateKey).toString('base64'), verified: true };
}
function request(value: ProbePermitRecord, version: 1 | 2 | 3 | 4): unknown {
    const measurement = value.measurement ?? 'tcp-connect-v1', descriptor = probeMeasurement(measurement);
    const common = { ...structuredClone(base), permitId: value.id, binding: value.binding, instanceId: value.instanceId,
        instanceGeneration: value.instanceGeneration, timeoutMs: value.timeoutMs, issuedAt: new Date(value.issuedAt).toISOString(),
        expiresAt: new Date(value.expiresAt).toISOString(), consumedAt: new Date(value.closedAt!).toISOString() };
    if (version === 1) return common;
    const typed = { ...common, ...descriptor, probeVersion: version, kind: version === 2 ? 'probe-types-result' : version === 3 ? 'probe-services-result' : 'probe-echo-result' };
    const tls = measurement === 'tcp-ingress-tls-v1';
    const service = value.serviceContext ? (measurement.includes('echo') ? native.probeEchoServiceSelection(value.serviceContext)
        : native.probeServiceSelection(value.serviceContext as native.ProbeServiceContext)) : null;
    const result = { ...typed, ...(version >= 3 ? { service, tls: tls ? { version: 'TLSv1.3', alpn: 'tunex-observation/1',
        leafFingerprint: hash(Buffer.from('AQ==', 'base64')), verified: true } : null } : {}),
        ...(tls ? { status: 'verified', code: 'tls-handshake-verified' } : {}) };
    return version !== 4 ? result : { ...result, businessProtocol: measurement === 'udp-ingress-echo-v1' ? 'udp' : 'tcp',
        challenge: value.echoChallenge ?? null, echo: measurement.includes('echo') ? proof(value) : null,
        requestBytes: measurement.includes('echo') ? 256 : 0, responseBytes: measurement.includes('echo') ? 256 : 0,
        applicationPayloadBytes: measurement.includes('echo') ? 512 : 0,
        ...(measurement.includes('echo') ? { status: 'echoed', code: 'nonce-echo-verified' } : {}) };
}
function summary(value: ProbePermitRecord): ProbeRunResult {
    const parsed = native.nativeProbeResultRequest(request(value, value.measurement?.includes('echo') ? 4 : value.measurement?.includes('tls') ? 3 : value.measurement ? 2 : 1));
    const input = parsed.request;
    return parseProbeRunResult({ status: input.status, code: input.code, elapsedMs: input.elapsedMs,
        measuredAt: Date.parse(input.measuredAt), validUntil: Date.parse(input.validUntil), acceptedAt: accepted, resultDigest: parsed.resultDigest,
        ...(input.probeVersion === 3 && value.measurement === 'tcp-ingress-tls-v1' ? { tls: input.tls } : {}),
        ...(input.probeVersion === 4 ? { echo: input.echo, requestBytes: input.requestBytes, responseBytes: input.responseBytes } : {}) }, historyPermit(value));
}
function head(value: ProbePermitRecord): ProbeRunRecord {
    return parseProbeRunRecord({ ...historyPermit(value), revision: 2, updatedAt: consumed, withdrawnAt: null, result: null, recoverySuspended: false });
}
type Tx = { name: string };
function memory(initial: ProbeRunRecord | null = null) {
    const tx: Tx = { name: 'caller transaction' }, events: string[] = [];
    let current = initial, losses = { rowsExpired: 0, rowsEvicted: 0, updatesWithoutHead: 0 };
    const same = (actual: Tx) => assert.equal(actual, tx);
    const store: ProbeRunStore<Tx> = {
        lockScope: async actual => { same(actual); events.push('history-lock'); },
        get: async (actual, scope, id, lock) => { same(actual); assert.equal(scope, 'scope-a'); assert.equal(id, base.permitId);
            assert.equal(lock, true); events.push('history-get'); return current; },
        insert: async (actual, value) => { same(actual); events.push('history-insert'); current = value; },
        put: async (actual, value) => { same(actual); events.push('history-put'); current = value; },
        missingUpdate: async actual => { same(actual); events.push('history-missing'); losses.updatesWithoutHead++; },
        losses: async actual => { same(actual); return losses; }, history: async () => current ? [current] : [],
    };
    return { tx, events, store, recorder: new ProbeRunHistoryRecorder(store), get current() { return current; },
        get losses() { return losses; }, restore: (value: ProbeRunRecord | null, counters = losses) => { current = value; losses = structuredClone(counters); } };
}

test('186 native result dispatch retains every legacy family and staged v4 body/digest, with no public v4 parser widening', () => {
    const families = [[1, measurements.slice(0, 1)], [2, measurements.slice(0, 2)], [3, measurements.slice(0, 3)], [4, measurements]] as const;
    for (const [version, selected] of families) for (const measurement of selected) {
        const input = request(permit(measurement), version), parsed = native.nativeProbeResultRequest(input);
        const expected = version === 1 ? parseProbeResult('Request', JSON.stringify(input)) : version === 2 ? parseProbeTypes('ResultRequest', JSON.stringify(input))
            : version === 3 ? parseProbeServices('ResultRequest', JSON.stringify(input)) : parseProbeEcho('ResultRequest', JSON.stringify(input));
        assert.deepEqual(parsed.request, expected); assert.equal(parsed.measurement, measurement);
        const { requestId: _requestId, ...body } = expected;
        assert.deepEqual(parsed.body, body); assert.equal(parsed.resultDigest, digest(body));
        assert.ok(Object.isFrozen(parsed.body));
        if (version === 1) assert.equal(parsed.resultDigest, probeResultDigest(expected as ProbeResultRequest));
        if (version === 2) assert.equal(parsed.resultDigest, probeTypesResultDigest(expected as native.ProbeTypesResultRequest));
        if (version === 3) assert.equal(parsed.resultDigest, probeServicesResultDigest(expected as native.ProbeServicesResultRequest));
        if (version === 4) {
            assert.equal(parsed.resultDigest, probeEchoResultDigest(expected as ProbeEchoResultRequest));
            native.nativeStoredProbeResultCheck(parsed);
            assert.throws(() => native.nativeStoredProbeResultCheck({ ...parsed, resultDigest: 'sha256:' + '0'.repeat(64) }), { code: 'INTEGRITY_FAILURE' });
            for (const parse of [() => parseProbeResult('Request', JSON.stringify(input)), () => parseProbeTypes('ResultRequest', JSON.stringify(input)),
                () => parseProbeServices('ResultRequest', JSON.stringify(input))]) assert.throws(parse);
        }
    }
});

test('186 recorder preserves all five families with detached immutable challenge/proof/TLS/bytes and historical digest', async () => {
    for (const measurement of measurements) {
        const value = permit(measurement), owner = historyPermit(value), result = summary(value), f = memory();
        await f.recorder.recordIn(f.tx, { kind: 'issued', permit: { ...owner, state: 'issued', closedAt: null }, at: issued, result: null });
        assert.equal(f.current!.revision, 1);
        await f.recorder.recordIn(f.tx, { kind: 'consumed', permit: owner, at: consumed, result: null });
        await f.recorder.recordIn(f.tx, { kind: 'result', permit: owner, at: accepted, result });
        const stored = f.current!;
        assert.equal(stored.revision, 3); assert.equal(stored.updatedAt, accepted); assert.deepEqual(stored.result, result);
        assert.equal(probeRunImmutable(stored), probeRunImmutable(owner));
        assert.ok(Object.isFrozen(stored)); assert.ok(Object.isFrozen(stored.binding)); assert.ok(Object.isFrozen(stored.result));
        if (measurement.includes('echo')) {
            assert.deepEqual(stored.echoChallenge, value.echoChallenge); assert.deepEqual(stored.result!.echo, proof(value));
            assert.equal(stored.result!.requestBytes, 256); assert.equal(stored.result!.responseBytes, 256);
            assert.ok(Object.isFrozen(stored.echoChallenge)); assert.ok(Object.isFrozen(stored.result!.echo));
            assert.equal(verifyProbeEchoProof(value.serviceContext!, invocation(value), value.echoChallenge!, stored.result!.echo!), true);
        } else assert.equal(Object.hasOwn(stored, 'echoChallenge'), false);
        if (measurement.includes('tls')) {
            const tls = stored.result!.tls;
            assert.ok(tls); assert.equal(Object.getPrototypeOf(tls), null);
            assert.deepEqual(Object.keys(tls), ['version', 'alpn', 'leafFingerprint', 'verified']);
            assert.deepEqual({ ...tls }, { version: 'TLSv1.3', alpn: 'tunex-observation/1',
                leafFingerprint: hash(Buffer.from('AQ==', 'base64')), verified: true });
            assert.deepEqual({ ...tls }, (request(value, 3) as native.ProbeServicesResultRequest).tls);
        }
        const view = publicProbeRun(stored, issued + 3000);
        assert.equal(view.contentDigest, digest(stored)); assert.equal(view.health, 'unknown'); assert.equal(view.executionAuthorized, false);
        assert.equal(view.historical, true); assert.equal(view.permitExpired, true); assert.equal(view.resultExpired, true);
        assert.equal(view.applicationPayloadBytes, measurement.includes('echo') ? 512 : 0);
        for (const key of ['fingerprint', 'serviceContext', 'requestId', 'body']) assert.equal(Object.hasOwn(stored, key), false);
        assert.deepEqual(f.events, ['history-lock', 'history-get', 'history-insert', 'history-lock', 'history-get', 'history-put', 'history-lock', 'history-get', 'history-put']);
        await f.recorder.recordIn(f.tx, { kind: 'result', permit: owner, at: accepted, result });
        assert.equal(f.current, stored); assert.equal(f.current!.revision, 3);
    }
});

test('186 recorder never backfills missing heads; duplicate, immutable identity, refusal and revision paths preserve history', async () => {
    const value = permit('tcp-ingress-echo-v1'), owner = historyPermit(value), result = summary(value);
    for (const kind of ['consumed', 'withdrawn', 'result', 'revoked'] as const) {
        const f = memory(), selected = kind === 'revoked' ? { ...owner, state: 'revoked' as const, closedAt: consumed } : owner;
        await f.recorder.recordIn(f.tx, { kind, permit: selected, at: kind === 'result' ? accepted : consumed, result: kind === 'result' ? result : null });
        assert.equal(f.current, null); assert.deepEqual(f.losses, { rowsExpired: 0, rowsEvicted: 0, updatesWithoutHead: 1 });
        assert.deepEqual(f.events, ['history-lock', 'history-get', 'history-missing']);
    }
    const issuedOwner = { ...owner, state: 'issued' as const, closedAt: null }, f = memory();
    await f.recorder.recordIn(f.tx, { kind: 'issued', permit: issuedOwner, at: issued, result: null });
    const original = f.current!;
    await f.recorder.recordIn(f.tx, { kind: 'issued', permit: issuedOwner, at: issued, result: null });
    assert.equal(f.current, original);
    for (const patch of [{ actorId: 'different' }, { binding: { ...owner.binding, forwardRevision: 2 } }, { instanceGeneration: 2 },
        { timeoutMs: 999 }, { expiresAt: owner.expiresAt - 1 }, { service: { ...owner.service!, revision: 2 } },
        { echoChallenge: { ...owner.echoChallenge!, invocationDigest: 'sha256:' + '0'.repeat(64) } }]) {
        await assert.rejects(f.recorder.recordIn(f.tx, { kind: 'consumed', permit: { ...owner, ...patch }, at: consumed, result: null }), { code: 'INTEGRITY_FAILURE' });
        assert.equal(f.current, original);
    }
    await f.recorder.recordIn(f.tx, { kind: 'consumed', permit: owner, at: consumed, result: null });
    const consumedHead = f.current!;
    await assert.rejects(f.recorder.recordIn(f.tx, { kind: 'consumed', permit: owner, at: consumed, result: null }), { code: 'INTEGRITY_FAILURE' });
    assert.equal(f.current, consumedHead);
    for (const patch of [{ recoverySuspended: true }, { revision: Number.MAX_SAFE_INTEGER }, { updatedAt: accepted + 1 }]) {
        f.restore(parseProbeRunRecord({ ...consumedHead, ...patch }));
        const before: ProbeRunRecord | null = f.current;
        await assert.rejects(f.recorder.recordIn(f.tx, { kind: 'result', permit: owner, at: accepted, result }),
            { code: Object.hasOwn(patch, 'revision') ? 'REVISION_EXHAUSTED' : 'INTEGRITY_FAILURE' });
        assert.equal(f.current, before);
    }
    f.restore(consumedHead);
    await f.recorder.recordIn(f.tx, { kind: 'result', permit: owner, at: accepted, result });
    const completed = f.current;
    await assert.rejects(f.recorder.recordIn(f.tx, { kind: 'result', permit: owner, at: accepted,
        result: { ...result, resultDigest: 'sha256:' + 'e'.repeat(64) } }), { code: 'INTEGRITY_FAILURE' });
    assert.equal(f.current, completed);
    f.restore(consumedHead);
    await f.recorder.recordIn(f.tx, { kind: 'withdrawn', permit: owner, at: accepted, result: null });
    const withdrawn = f.current;
    await f.recorder.recordIn(f.tx, { kind: 'withdrawn', permit: owner, at: accepted, result: null });
    assert.equal(f.current, withdrawn);
    await assert.rejects(f.recorder.recordIn(f.tx, { kind: 'result', permit: owner, at: accepted, result }), { code: 'INTEGRITY_FAILURE' });
    await assert.rejects(f.recorder.recordIn(f.tx, { kind: 'withdrawn', permit: owner, at: accepted + 1, result: null }), { code: 'INTEGRITY_FAILURE' });
    assert.equal(f.current, withdrawn);
});

test('186 Echo proof, request binding and rejected byte semantics remain closed without changing non-Echo history', () => {
    for (const measurement of ['tcp-ingress-echo-v1', 'udp-ingress-echo-v1'] as const) {
        const value = permit(measurement), owner = historyPermit(value), result = summary(value);
        for (const patch of [{ echo: null }, { requestBytes: 255 }, { responseBytes: 255 }, { tls: null },
            { echo: { ...result.echo!, requestDigest: 'sha256:' + '0'.repeat(64) } }, { echo: { ...result.echo!, signature: 'AA==' } },
            { echo: { ...result.echo!, verified: false } }]) assert.throws(() => parseProbeRunResult({ ...result, ...patch }, owner));
        const rejected = { ...result, status: 'unverified', code: 'nonce-echo-rejected', echo: null, responseBytes: 0 };
        assert.equal(parseProbeRunResult(rejected, owner).echo, null);
        assert.throws(() => parseProbeRunResult({ ...rejected, requestBytes: 0 }, owner));
        const unreachable = { ...result, status: 'unreachable', code: 'tcp-connect-failed', echo: null, requestBytes: 0, responseBytes: 0 };
        if (measurement.startsWith('tcp')) assert.equal(parseProbeRunResult(unreachable, owner).status, 'unreachable');
        else assert.throws(() => parseProbeRunResult(unreachable, owner));
        assert.throws(() => parseProbeRunResult({ ...unreachable, responseBytes: 1 }, owner));
    }
    for (const measurement of measurements.slice(0, 3)) {
        const value = permit(measurement), owner = historyPermit(value), result = summary(value);
        for (const extra of [{ echo: null }, { requestBytes: 0 }, { responseBytes: 0 }]) assert.throws(() => parseProbeRunResult({ ...result, ...extra }, owner));
        if (measurement.includes('tls')) {
            assert.throws(() => parseProbeRunResult({ ...result, tls: null }, owner));
            assert.equal(parseProbeRunResult({ ...result, status: 'unverified', code: 'tls-handshake-failed', tls: null }, owner).tls, null);
            assert.throws(() => parseProbeRunResult({ ...result, status: 'unverified', code: 'tls-handshake-failed' }, owner));
        }
    }
});

function ownerHarness(value: ProbePermitRecord, failure?: 'capture' | 'commit' | 'clock', allowRevoke = false) {
    const f = memory(head(value)), events = f.events;
    let result: ProbeResultRecord | undefined, clockCalls = 0;
    const same = (tx: Tx) => assert.equal(tx, f.tx);
    const store: ProbePermitStore<Tx> = {
        lock: async tx => { same(tx); events.push('budget'); return { observedAt: consumed, records: [value], withdrawals: [] }; },
        result: async tx => { same(tx); events.push('result'); return result; },
        recordResult: async (tx, input) => { same(tx); events.push('record-result'); result = input; },
        clock: async tx => { same(tx); events.push('write-clock'); },
        prune: async (tx, before) => { same(tx); assert.equal(allowRevoke, true); assert.equal(before, accepted - 1000); events.push('prune'); },
        insert: async () => { assert.fail('result ingestion never issues'); },
        close: async (tx, id, state, at) => { same(tx); assert.equal(allowRevoke, true); assert.equal(id, value.id); assert.equal(state, 'revoked'); assert.equal(at, accepted); events.push('close-revoked'); },
        withdraw: async (tx, id, at) => { same(tx); assert.equal(allowRevoke, true); assert.equal(id, value.id); assert.equal(at, accepted); events.push('withdraw'); },
    };
    const host = new ProbePermits({ transaction: async action => {
        events.push('begin'); const before = f.current, saved = result, counters = structuredClone(f.losses);
        try { const answer = await action(f.tx); if (failure === 'commit') throw new Error('commit refused'); events.push('commit'); return answer; }
        catch (error) { f.restore(before, counters); result = saved; events.push('rollback'); throw error; }
    } }, { scope: async tx => { same(tx); events.push('scope'); } }, {
        authorize: async tx => { same(tx); events.push('plan'); const descriptor = probeMeasurement(value.measurement ?? 'tcp-connect-v1');
            return { version: 1, executable: false, dispatch: 'not-implemented', independentProbe: false, health: 'unknown', scopeId: value.scopeId,
                binding: value.binding, timeoutMs: value.timeoutMs, maxAttempts: 1, applicationPayloadBytes: 0, plannedAt: base.issuedAt,
                expiresAt: base.expiresAt, ...descriptor, kind: descriptor.taskKind, ...(value.serviceContext ? { serviceContext: value.serviceContext } : {}),
                ...(value.measurement?.includes('echo') ? { businessProtocol: value.measurement.startsWith('udp') ? 'udp' : 'tcp' } : {}) } as ForwardProbePlan; },
    }, { read: async tx => { same(tx); events.push('machine'); return { nodeId: base.nodeId, bootId: base.bootId, sessionEpoch: base.sessionEpoch,
        revoked: false, credentialRevoked: false, nodeCredentialUntil: issued + 30000, credentialUntil: issued + 30000, retireAfter: null,
        capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'probe.tcp-ingress-connect.v1', 'probe.tcp-ingress-tls.v1'] }; } },
    { readCurrent: async tx => { same(tx); events.push('instance'); return { nodeId: base.nodeId, bootId: base.bootId, sessionEpoch: base.sessionEpoch,
        fingerprint, instanceId: value.instanceId, generation: value.instanceGeneration, state: 'registered', registeredAt: issued,
        expiresAt: issued + 30000, revokedAt: null }; } }, store,
    () => { events.push('clock'); clockCalls++; return failure === 'clock' && clockCalls === 4 ? issued + 2000 : accepted; },
    { recordIn: async (tx, capture) => { same(tx); events.push('capture');
        assert.notEqual(capture.permit.binding, value.binding);
        for (const key of ['fingerprint', 'serviceContext', 'body']) assert.equal(Object.hasOwn(capture.permit, key), false);
        await f.recorder.recordIn(tx, capture); if (failure === 'capture') throw new Error('capture refused'); } },
    { get: async tx => { same(tx); events.push('qualification'); return { nodeId: base.nodeId, bootId: base.bootId, sessionEpoch: base.sessionEpoch,
        fingerprint, instanceId: value.instanceId, instanceGeneration: value.instanceGeneration, state: 'qualified', qualifiedAt: issued,
        expiresAt: issued + 30000, servicesVersion: 1 }; }, put: async () => { assert.fail('history/result flow never changes qualification'); } });
    return { ...f, host, events, get savedResult() { return result; }, get current() { return f.current; } };
}

test('186 real permit owner preserves result mutation/capture/clock/commit order and duplicate no-write for public v1/v2/v3', async () => {
    for (const [version, measurement] of [[1, 'tcp-connect-v1'], [2, 'tcp-ingress-connect-v1'], [3, 'tcp-ingress-tls-v1']] as const) {
        const value = permit(measurement), f = ownerHarness(value), input = request(value, version) as ProbeResultRequest;
        const receipt = await f.host.receiveResult(base.nodeId, fingerprint, base.sessionEpoch, input);
        assert.equal(receipt.duplicate, false); assert.equal(receipt.acceptedAt, accepted);
        assert.deepEqual(f.current!.result, summary(value)); assert.equal(f.current!.revision, 3);
        assert.deepEqual(f.events, ['begin', 'budget', 'clock', 'plan', 'instance', 'machine', 'clock',
            ...(version === 1 ? [] : ['qualification']), 'result', 'clock', 'record-result', 'capture',
            'history-lock', 'history-get', 'history-put', 'write-clock', 'clock', 'commit']);
        const captured = f.current, saved = f.savedResult; f.events.length = 0;
        const duplicate = await f.host.receiveResult(base.nodeId, fingerprint, base.sessionEpoch, input);
        assert.equal(duplicate.duplicate, true); assert.equal(f.current, captured); assert.equal(f.savedResult, saved);
        assert.equal(f.events.includes('capture'), false); assert.equal(f.events.includes('record-result'), false);
        assert.equal(f.events.at(-1), 'commit');
        await assert.rejects(f.host.receiveResult(base.nodeId, fingerprint, base.sessionEpoch, { ...input, elapsedMs: input.elapsedMs + 1 }), { code: 'PROBE_RESULT_CONFLICT' });
        assert.equal(f.current, captured);
    }
});

test('186 real permit owner failure/late clock/commit rollback retains original head and no partial result', async () => {
    for (const failure of ['capture', 'commit', 'clock'] as const) {
        const value = permit('tcp-ingress-tls-v1'), f = ownerHarness(value, failure), before = f.current;
        await assert.rejects(f.host.receiveResult(base.nodeId, fingerprint, base.sessionEpoch, request(value, 3) as ProbeResultRequest));
        assert.equal(f.current, before); assert.equal(f.savedResult, undefined); assert.equal(f.events.at(-1), 'rollback');
        assert.equal(f.events.includes('record-result'), true); assert.equal(f.events.includes('capture'), true);
    }
    const value = permit(), f = ownerHarness(value), before = f.current;
    for (const patch of [{ permitId: 'missing' }, { instanceGeneration: 2 }, { consumedAt: base.issuedAt }]) {
        await assert.rejects(f.host.receiveResult(base.nodeId, fingerprint, base.sessionEpoch, { ...base, ...patch } as ProbeResultRequest));
        assert.equal(f.current, before); assert.equal(f.savedResult, undefined);
    }
});

test('186 inspect keeps original native service selection per family; staged v4 controlled ingestion remains unavailable before mutation', async () => {
    for (const measurement of measurements) {
        const value = permit(measurement), f = ownerHarness(value);
        const receipt = await f.host.inspect('owner', 'scope-a', value.id);
        assert.equal(receipt.health, 'unknown'); assert.equal(receipt.executionEnabled, false); assert.equal(receipt.result, null);
        assert.equal(Object.hasOwn(receipt, 'serviceContext'), false);
        if (value.serviceContext) assert.deepEqual(receipt.service, measurement.includes('echo') ? native.probeEchoServiceSelection(value.serviceContext)
            : native.probeServiceSelection(value.serviceContext as native.ProbeServiceContext));
        else assert.equal(Object.hasOwn(receipt, 'service'), false);
        if (measurement.includes('tls') || measurement.includes('echo')) {
            f.events.length = 0; const before = f.current;
            const input = request(value, 4); native.nativeProbeResultRequest(input);
            await assert.rejects(f.host.receiveResult(base.nodeId, fingerprint, base.sessionEpoch, input as ProbeResultRequest), { code: 'PROBE_PERMIT_UNAVAILABLE' });
            assert.equal(f.current, before); assert.equal(f.savedResult, undefined);
            assert.deepEqual(f.events, ['begin', 'budget', 'clock', 'plan', 'rollback']);
        }
    }
});

test('186 original permit revoke/withdraw owner actually captures Echo challenge and family selection in the same transaction after mutation', async () => {
    for (const measurement of measurements) for (const state of ['issued', 'consumed'] as const) {
        const value = { ...permit(measurement), state, closedAt: state === 'issued' ? null : consumed }, f = ownerHarness(value, undefined, true);
        await f.host.revoke('owner', 'scope-a', value.id);
        assert.deepEqual(f.events, ['begin', 'scope', 'budget', 'clock', 'clock', state === 'issued' ? 'close-revoked' : 'withdraw',
            'prune', 'write-clock', 'capture', 'history-lock', 'history-get', 'history-put', 'commit']);
        assert.equal(f.current!.revision, 3); assert.equal(f.current!.result, null);
        assert.equal(f.current!.state, state === 'issued' ? 'revoked' : 'consumed');
        assert.equal(f.current!.withdrawnAt, state === 'issued' ? null : accepted);
        if (measurement.includes('echo')) assert.deepEqual(f.current!.echoChallenge, value.echoChallenge);
        if (value.serviceContext) assert.deepEqual(f.current!.service, historyPermit(value).service);
        assert.equal(f.savedResult, undefined);
    }
});

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
test('186 real MySQL0037 roundtrips family optional fields, immutable revisions, rollback, missing-head loss and sticky recovery',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const name = 'tunex_history_' + randomUUID().replaceAll('-', ''), admin = await createConnection(databaseUrl!);
        const url = new URL(databaseUrl!); url.pathname = '/' + name;
        const db = new MySqlUnitOfWork(url.toString()), store = new MySqlProbeHistoryStore(probeRunStorageValues), recorder = new ProbeRunHistoryRecorder(store);
        let created = false;
        try {
            await admin.query(`CREATE DATABASE \`${name}\``); created = true; await db.migrate();
            await new Identity(db).bootstrap('scope-a', 'owner', randomBytes(32).toString('base64url'));
            const [migration] = await db.pool.query<RowDataPacket[]>("SELECT name FROM vnext_migrations WHERE name='0037-probe-echo.sql'");
            assert.equal(migration.length, 1);
            for (const [index, measurement] of measurements.entries()) {
                const value = permit(measurement, 'history-' + index), owner = historyPermit(value), result = summary(value);
                await db.transaction(async tx => {
                    await recorder.recordIn(tx, { kind: 'issued', permit: { ...owner, state: 'issued', closedAt: null }, at: issued, result: null });
                    const [raw] = await tx.query<RowDataPacket[]>('SELECT measurement,service_selection,echo_challenge,result_tls,result_echo,result_request_bytes,result_response_bytes FROM probe_runs WHERE probe_id=?', [value.id]);
                    assert.equal(raw[0]!.measurement, measurement);
                    assert.equal(raw[0]!.service_selection === null, !measurement.includes('tls') && !measurement.includes('echo'));
                    assert.equal(raw[0]!.echo_challenge === null, !measurement.includes('echo'));
                    for (const field of ['result_tls', 'result_echo', 'result_request_bytes', 'result_response_bytes']) assert.equal(raw[0]![field], null);
                    await recorder.recordIn(tx, { kind: 'consumed', permit: owner, at: consumed, result: null });
                    await recorder.recordIn(tx, { kind: 'result', permit: owner, at: accepted, result });
                    const stored = await store.get(tx, 'scope-a', value.id);
                    assert.deepEqual(stored, parseProbeRunRecord({ ...owner, revision: 3, updatedAt: accepted, withdrawnAt: null, result, recoverySuspended: false }));
                    const [rows] = await tx.query<RowDataPacket[]>('SELECT result_tls,result_echo,result_request_bytes,result_response_bytes FROM probe_runs WHERE probe_id=?', [value.id]);
                    assert.equal(rows[0]!.result_tls === null, !measurement.includes('tls'));
                    assert.equal(rows[0]!.result_echo === null, !measurement.includes('echo'));
                    assert.equal(rows[0]!.result_request_bytes, measurement.includes('echo') ? 256 : null);
                    assert.equal(rows[0]!.result_response_bytes, measurement.includes('echo') ? 256 : null);
                    await recorder.recordIn(tx, { kind: 'result', permit: owner, at: accepted, result });
                    assert.equal((await store.get(tx, 'scope-a', value.id))!.revision, 3);
                });
            }
            for (const measurement of ['tcp-ingress-tls-v1', 'tcp-ingress-echo-v1', 'udp-ingress-echo-v1'] as const) {
                const value = permit(measurement, 'rejected-' + measurement), owner = historyPermit(value), original = summary(value);
                const result = parseProbeRunResult({ ...original, status: 'unverified', code: measurement.includes('echo') ? 'nonce-echo-rejected' : 'tls-handshake-failed',
                    ...(measurement.includes('echo') ? { echo: null, responseBytes: 0 } : { tls: null }) }, owner);
                await db.transaction(async tx => {
                    await recorder.recordIn(tx, { kind: 'issued', permit: { ...owner, state: 'issued', closedAt: null }, at: issued, result: null });
                    await recorder.recordIn(tx, { kind: 'consumed', permit: owner, at: consumed, result: null });
                    await recorder.recordIn(tx, { kind: 'result', permit: owner, at: accepted, result });
                    assert.deepEqual((await store.get(tx, 'scope-a', value.id))!.result, result);
                    const [raw] = await tx.query<RowDataPacket[]>('SELECT result_tls,result_echo,result_request_bytes,result_response_bytes FROM probe_runs WHERE probe_id=?', [value.id]);
                    assert.equal(raw[0]!.result_tls, null); assert.equal(raw[0]!.result_echo, null);
                    assert.equal(raw[0]!.result_request_bytes, measurement.includes('echo') ? 256 : null);
                    assert.equal(raw[0]!.result_response_bytes, measurement.includes('echo') ? 0 : null);
                });
            }
            for (const [column, replacement, id] of [['echo_challenge', null, 'history-3'], ['result_echo', null, 'history-3'],
                ['result_request_bytes', 257, 'history-3'], ['service_selection', '{}', 'history-0']] as const) {
                await assert.rejects(db.pool.execute(`UPDATE probe_runs SET ${column}=? WHERE probe_id=?`, [replacement, id]), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
            }
            const value = permit('tcp-ingress-echo-v1', 'history-3'), owner = historyPermit(value), before = await db.transaction(tx => store.get(tx, 'scope-a', value.id));
            await assert.rejects(db.transaction(async tx => {
                await recorder.recordIn(tx, { kind: 'withdrawn', permit: owner, at: accepted + 1, result: null });
                throw new Error('transaction refused after capture');
            }), /transaction refused/);
            assert.deepEqual(await db.transaction(tx => store.get(tx, 'scope-a', value.id)), before);
            await assert.rejects(db.transaction(tx => store.put(tx, parseProbeRunRecord({ ...before!, actorId: 'other', revision: 4 }))), { code: 'INTEGRITY_FAILURE' });
            await assert.rejects(db.transaction(tx => store.put(tx, before!)), { code: 'INTEGRITY_FAILURE' });
            assert.deepEqual(await db.transaction(tx => store.get(tx, 'scope-a', value.id)), before);
            await db.transaction(async tx => {
                // Legacy family avoids fabricating a challenge for a changed permit ID.
                const missingLegacy = { ...historyPermit(permit()), probeId: 'never-issued' };
                await recorder.recordIn(tx, { kind: 'consumed', permit: missingLegacy, at: consumed, result: null });
                assert.equal(await store.get(tx, 'scope-a', missingLegacy.probeId), null);
                assert.deepEqual(await store.losses(tx, 'scope-a'), { rowsExpired: 0, rowsEvicted: 0, updatesWithoutHead: 1 });
                await MySqlProbeHistoryStore.quarantineRecovery(tx);
            });
            const recovered = await db.transaction(tx => store.get(tx, 'scope-a', value.id));
            assert.equal(recovered!.recoverySuspended, true); assert.equal(recovered!.revision, 4);
            await assert.rejects(db.transaction(tx => recorder.recordIn(tx, { kind: 'withdrawn', permit: owner, at: accepted + 1, result: null })), { code: 'INTEGRITY_FAILURE' });
            await db.transaction(tx => MySqlProbeHistoryStore.quarantineRecovery(tx));
            assert.deepEqual(await db.transaction(tx => store.get(tx, 'scope-a', value.id)), recovered);
            const [counts] = await db.pool.query<RowDataPacket[]>('SELECT (SELECT COUNT(*) FROM probe_runs) historyCount,(SELECT COUNT(*) FROM probe_permits) permitCount,(SELECT COUNT(*) FROM probe_results) resultCount');
            assert.deepEqual({ ...counts[0] }, { historyCount: 8, permitCount: 0, resultCount: 0 });
        } finally {
            await db.close();
            try { if (created) await admin.query(`DROP DATABASE \`${name}\``); } finally { await admin.end(); }
        }
    });
