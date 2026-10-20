import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { MAX_COUNTER } from '@tunex/core';
import { digest } from '@tunex/contracts';
import * as wire from '@tunex/contracts/staged/probe-echo';
import { parseProbeServiceContext } from '@tunex/contracts/probe';
import * as native from '../src/compatibility/public.ts';
import * as legacy from '../src/modules/probe-permit-state.ts';
import * as publicOwner from '../src/modules/probe-owner/public.ts';
import { validProbeBinding, sameProbeBinding, validProbePermit } from '../src/modules/probe-owner/permit-state.ts';
import type { ProbeBinding } from '../src/modules/probe-owner/plan-contracts.ts';

function binding(): ProbeBinding {
    return { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, snapshotGeneration: 2,
        assignmentId: 'assignment', forwardId: 'forward', forwardRevision: 3,
        deploymentGeneration: 4, bindingFence: 5, configDigest: `sha256:${'a'.repeat(64)}`, egressPolicyRevision: 6 };
}
type Value = Record<string, unknown>;
function permit(): Value {
    return { id: 'permit', actorId: 'actor', scopeId: 'scope', binding: binding(), instanceId: 'a'.repeat(64),
        fingerprint: 'b'.repeat(64), instanceGeneration: 1, timeoutMs: 100, issuedAt: 1000,
        expiresAt: 2000, state: 'issued', closedAt: null };
}
function context(version: 1 | 2 = 2, changes: Value = {}) {
    const config = version === 2 ? { version: 2, purpose: 'controlled-nonce-echo', endpoint: { address: '127.0.0.1', port: 9000, protocols: ['tcp', 'udp'] },
        trust: { mode: 'ed25519-echo-v1', publicKey: Buffer.alloc(32, 1).toString('base64') }, validFrom: 1000, validUntil: 2000, ...changes }
        : { version: 1, purpose: 'direct-ingress-tls-handshake', endpoint: { address: '127.0.0.1', port: 9000 },
            trust: { mode: 'pinned-leaf-v1', serverName: 'probe.example', certificateDer: 'AQ==' }, validFrom: 1000, validUntil: 2000, ...changes };
    const base = { scopeId: 'scope', serviceId: 'service', revision: 1, configRevision: 1, configDigest: digest(config), config };
    return { ...base, contextDigest: digest(base) };
}
function otherScope(version: 1 | 2) {
    const { contextDigest: _discard, ...base } = context(version);
    const changed = { ...base, scopeId: 'other' };
    return { ...changed, contextDigest: digest(changed) };
}
function echo(measurement = 'tcp-ingress-echo-v1'): Value {
    const result = { ...permit(), measurement, serviceContext: context(), echoChallenge: { nonce: Buffer.alloc(32, 2).toString('base64'), invocationDigest: '' } };
    const invocation = native.nativeProbeEchoInvocation(result as unknown as native.NativeProbeEchoInvocationSource,
        () => native.parseProbeEchoServiceContext(result.serviceContext), () => result.echoChallenge.nonce);
    result.echoChallenge.invocationDigest = wire.probeEchoInvocationDigest(invocation);
    return result;
}

test('readiness47 public, legacy, canonical validator and L2 parser/digest aliases are exact objects', () => {
    for (const [name, fn] of Object.entries({ validProbeBinding, sameProbeBinding, validProbePermit })) {
        assert.equal(legacy[name as keyof typeof legacy], fn); assert.equal(publicOwner[name as keyof typeof legacy], fn);
    }
    assert.equal(native.parseProbeServiceContext, parseProbeServiceContext);
    assert.equal(native.parseProbeEchoServiceContext, wire.parseProbeEchoServiceContext);
    assert.equal(native.parseProbeEchoChallenge, wire.parseProbeEchoChallenge);
    assert.equal(native.probeEchoInvocationDigest, wire.probeEchoInvocationDigest);
});

test('binding closed sorted keys and equality preserve order independence and exact values', () => {
    const a = binding(), b = Object.fromEntries(Object.entries(a).reverse()) as unknown as ProbeBinding;
    assert.equal(validProbeBinding(a), true); assert.equal(validProbeBinding(b), true); assert.equal(sameProbeBinding(a, b), true);
    assert.equal(validProbeBinding(Object.assign(Object.create(null) as object, a)), true);
    for (const key of Object.keys(a)) {
        const missing: Value = { ...a }; delete missing[key]; assert.equal(validProbeBinding(missing), false, key);
        const changed = { ...a, [key]: typeof a[key as keyof ProbeBinding] === 'number' ? 7 : 'other' } as ProbeBinding;
        assert.equal(sameProbeBinding(a, changed), false, key); assert.equal(sameProbeBinding(changed, a), false, key);
    }
    assert.equal(validProbeBinding({ ...a, extra: true }), false);
    for (const value of [null, undefined, [], [a], false, 1, 'binding', {}]) {
        assert.equal(validProbeBinding(value), false); assert.equal(sameProbeBinding(value as ProbeBinding, a), false);
    }
});

test('binding validates every ID, counter and digest bound', () => {
    for (const key of ['nodeId', 'bootId', 'assignmentId', 'forwardId']) for (const value of ['', null, 1, 'x'.repeat(129)])
        assert.equal(validProbeBinding({ ...binding(), [key]: value }), false, `${key}:${value}`);
    for (const key of ['sessionEpoch', 'snapshotGeneration', 'forwardRevision', 'deploymentGeneration', 'bindingFence', 'egressPolicyRevision']) {
        for (const value of [0, -1, 1.5, MAX_COUNTER + 1, NaN, Infinity, '1', null]) assert.equal(validProbeBinding({ ...binding(), [key]: value }), false, `${key}:${value}`);
        assert.equal(validProbeBinding({ ...binding(), [key]: MAX_COUNTER }), true, key);
    }
    for (const configDigest of ['a'.repeat(64), `sha256:${'A'.repeat(64)}`, `sha256:${'a'.repeat(63)}`, `sha256:${'a'.repeat(64)}\n`, null])
        assert.equal(validProbeBinding({ ...binding(), configDigest }), false);
});

test('permit accepts exactly legacy, ingress, TLS and both staged echo key unions', () => {
    const values = [permit(), { ...permit(), measurement: 'tcp-ingress-connect-v1' },
        { ...permit(), measurement: 'tcp-ingress-tls-v1', serviceContext: context(1) }, echo(), echo('udp-ingress-echo-v1')];
    for (const value of values) {
        assert.equal(validProbePermit(value), true);
        assert.equal(validProbePermit(Object.fromEntries(Object.entries(value).reverse())), true);
        assert.equal(validProbePermit(Object.assign(Object.create(null) as object, value)), true);
        assert.equal(validProbePermit({ ...value, extra: 1 }), false);
        for (const key of Object.keys(value)) {
            const missing = { ...value }; delete missing[key];
            assert.equal(validProbePermit(missing), key === 'measurement' && value.measurement === 'tcp-ingress-connect-v1', key);
        }
    }
    for (const measurement of [undefined, null, 'tcp-connect-v1', 'unknown', 1]) assert.equal(validProbePermit({ ...permit(), measurement }), false);
    for (const value of [null, undefined, [], [permit()], false, 1, 'permit', {}]) assert.equal(validProbePermit(value), false);
});

test('permit scalar bounds, state and closedAt retain exact original boolean rules', () => {
    const invalid: Record<string, unknown[]> = {
        id: ['', null, 1], actorId: ['', null, 1], scopeId: ['', null, 1], binding: [null, [], {}],
        instanceId: ['a'.repeat(63), 'A'.repeat(64), null, `${'a'.repeat(64)}\n`], fingerprint: ['a'.repeat(65), 'g'.repeat(64), 1],
        instanceGeneration: [0, -1, 1.5, MAX_COUNTER + 1], timeoutMs: [99, 2001, 100.5, '100', null],
        issuedAt: [-1, 0.5, NaN, '1000', null], expiresAt: [1000, 999, 3001, 2000.5, NaN, '2000'],
        state: ['unknown', null, 1], closedAt: [0, 1, undefined],
    };
    for (const [key, values] of Object.entries(invalid)) for (const value of values) assert.equal(validProbePermit({ ...permit(), [key]: value }), false, `${key}:${value}`);
    for (const state of ['consumed', 'revoked', 'quarantined']) {
        assert.equal(validProbePermit({ ...permit(), state, closedAt: 0 }), true);
        for (const closedAt of [null, -1, 0.5, '0', NaN]) assert.equal(validProbePermit({ ...permit(), state, closedAt }), false);
    }
    assert.equal(validProbePermit({ ...permit(), issuedAt: 0, expiresAt: 2000, timeoutMs: 2000, instanceGeneration: MAX_COUNTER }), true);
    assert.equal(validProbePermit({ ...permit(), expiresAt: 1001 }), true);
});

test('TLS scope and validity window are inclusive and parser exceptions become false', () => {
    const value = { ...permit(), measurement: 'tcp-ingress-tls-v1', serviceContext: context(1) };
    assert.equal(validProbePermit(value), true);
    for (const serviceContext of [null, [], {}, context(), context(1, { validFrom: 1001 }), context(1, { validUntil: 1999 }),
        otherScope(1), { ...context(1), contextDigest: `sha256:${'0'.repeat(64)}` }]) assert.equal(validProbePermit({ ...value, serviceContext }), false);
    for (const field of ['issuedAt', 'expiresAt']) assert.equal(validProbePermit({ ...value, [field]: '1000' }), false);
});

test('echo requires scope, v2, selected protocol, inclusive window and matching invocation challenge', () => {
    for (const measurement of ['tcp-ingress-echo-v1', 'udp-ingress-echo-v1']) {
        const value = echo(measurement); assert.equal(validProbePermit(value), true);
        for (const serviceContext of [null, [], {}, context(1), context(2, { validFrom: 1001 }), context(2, { validUntil: 1999 }),
            otherScope(2), context(2, { endpoint: { address: '127.0.0.1', port: 9000, protocols: [measurement.startsWith('tcp') ? 'udp' : 'tcp'] } })])
            assert.equal(validProbePermit({ ...value, serviceContext }), false);
        for (const echoChallenge of [null, [], {}, { nonce: 'bad', invocationDigest: `sha256:${'0'.repeat(64)}` },
            { nonce: Buffer.alloc(32, 2).toString('base64'), invocationDigest: `sha256:${'0'.repeat(64)}` }]) assert.equal(validProbePermit({ ...value, echoChallenge }), false);
        for (const [key, changed] of Object.entries({ id: 'changed', instanceId: 'c'.repeat(64), instanceGeneration: 2, timeoutMs: 101,
            issuedAt: 1001, expiresAt: 1999, binding: { ...binding(), bindingFence: 6 } })) assert.equal(validProbePermit({ ...value, [key]: changed }), false, key);
    }
});

test('native invocation uses canonical ISO bytes and original key order before exact wire digest', () => {
    const value = echo(), nonce = Buffer.alloc(32, 2).toString('base64');
    const invocation = native.nativeProbeEchoInvocation(value as unknown as native.NativeProbeEchoInvocationSource, () => native.parseProbeEchoServiceContext(value.serviceContext), () => nonce);
    assert.deepEqual(Object.keys(invocation), ['domain', 'probeVersion', 'measurement', 'permitId', 'binding', 'instanceId', 'instanceGeneration', 'timeoutMs', 'issuedAt', 'expiresAt', 'service', 'nonce']);
    assert.equal(invocation.issuedAt, '1970-01-01T00:00:01.000Z'); assert.equal(invocation.expiresAt, '1970-01-01T00:00:02.000Z');
    assert.equal(invocation.binding, value.binding);
    assert.equal(wire.probeEchoInvocationDigest(invocation), digest(invocation));
    assert.equal((value.echoChallenge as wire.ProbeEchoChallenge).invocationDigest, digest(invocation));
    assert.throws(() => wire.probeEchoInvocationDigest({ ...invocation, issuedAt: '1970-01-01T00:00:01Z' }));
});

test('refusal order is synchronous: keys before values, context/challenge before common scalar reads', () => {
    const bomb = new Error('read'), bad = { ...permit(), extra: true };
    Object.defineProperty(bad, 'id', { enumerable: true, get() { throw bomb; } });
    assert.equal(validProbePermit(bad), false);
    const invalidBinding = { ...binding(), extra: true };
    Object.defineProperty(invalidBinding, 'nodeId', { enumerable: true, get() { throw bomb; } });
    assert.equal(validProbeBinding(invalidBinding), false);
    for (const measurement of ['tcp-ingress-tls-v1', 'tcp-ingress-echo-v1']) {
        const value = measurement.includes('echo') ? echo() : { ...permit(), measurement, serviceContext: context(1) };
        Object.defineProperty(value, 'serviceContext', { enumerable: true, get() { throw bomb; } });
        Object.defineProperty(value, 'id', { enumerable: true, get() { throw new Error('common value reached'); } });
        assert.equal(validProbePermit(value), false);
    }
    const value = permit(); Object.defineProperty(value, 'id', { enumerable: true, get() { throw bomb; } });
    assert.throws(() => validProbePermit(value), error => error === bomb);
    assert.equal(typeof validProbePermit(permit()), 'boolean');
});

test('echo context then challenge parsing precedes scope/window/digest and common-field evaluation', () => {
    for (const badContext of [true, false]) {
        const value = echo(), reads: string[] = [];
        Object.defineProperty(value, 'serviceContext', { enumerable: true, get() { reads.push('context'); return badContext ? null : context(); } });
        Object.defineProperty(value, 'echoChallenge', { enumerable: true, get() { reads.push('challenge'); return null; } });
        Object.defineProperty(value, 'scopeId', { enumerable: true, get() { reads.push('scope'); throw new Error('scope reached'); } });
        Object.defineProperty(value, 'id', { enumerable: true, get() { reads.push('id'); throw new Error('id reached'); } });
        assert.equal(validProbePermit(value), false);
        assert.deepEqual(reads, badContext ? ['context'] : ['context', 'challenge']);
    }
    const value = echo(), reads: string[] = [];
    Object.defineProperty(value, 'serviceContext', { enumerable: true, get() { reads.push('context'); return otherScope(2); } });
    const challenge = value.echoChallenge;
    Object.defineProperty(value, 'echoChallenge', { enumerable: true, get() { reads.push('challenge'); return challenge; } });
    Object.defineProperty(value, 'issuedAt', { enumerable: true, get() { reads.push('issuedAt'); throw new Error('window reached'); } });
    assert.equal(validProbePermit(value), false); assert.deepEqual(reads, ['context', 'challenge']);
});

test('validation samples no ambient clock, mutates no facts and creates no authority fields', t => {
    const value = echo(), original = structuredClone(value);
    t.mock.method(Date, 'now', () => { throw new Error('ambient clock'); });
    for (let index = 0; index < 2; index++) assert.equal(validProbePermit(value), true);
    assert.deepEqual(value, original);
    for (const key of ['executionEnabled', 'authority', 'lease', 'reservation', 'proof']) assert.equal(Object.hasOwn(value, key), false);
});

test('pure validator source imports only Core predicates, synchronous L2 codec and erased owner types', async () => {
    const source = await readFile(new URL('../src/modules/probe-owner/permit-state.ts', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)];
    assert.deepEqual(imports.filter(match => !match[1]).map(match => match[3]), ['@tunex/core', '../../compatibility/public.ts']);
    assert.deepEqual(imports.filter(match => match[1]).map(match => match[3]), ['../../compatibility/public.ts', './plan-contracts.ts', './permit-contracts.ts']);
    assert.doesNotMatch(source, /\b(?:async|await|Date|fetch|setTimeout|setInterval|process|require)\b|node:|\.transaction\(|\.query\(|\.execute\(|\.write\(/);
});
