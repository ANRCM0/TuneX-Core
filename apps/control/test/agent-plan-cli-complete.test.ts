import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { parseForward } from '@tunex/core';
import { parseJson } from '@tunex/contracts/shared';
import { compileDirect, compileSnapshot } from '../src/compatibility/public.ts';
import type { SnapshotInput } from '../src/compatibility/public.ts';
import type { AuthorizedNodeFacts, ReservedSlot } from '../src/framework/public.ts';

const source = readFileSync(new URL('../src/cli.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const plain = (value: unknown): any => JSON.parse(JSON.stringify(value));
function deferred<T>() { let resolve!: (value: T) => void, reject!: (value: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

function planFixture(argv: unknown[] = ['node', 'cli', 'raw/../plan.json', 'ignored']) {
    const events: any[][] = [], failure = new Error('original plan effect failure');
    const forward = Object.freeze({ native: 'forward' }), nodeFacts = Object.freeze({ native: 'facts' });
    const reservations = Object.freeze([{ native: 'reservation' }]), assignments = Object.freeze([{ native: 'assignment' }]);
    const metadata: Record<string, unknown> = { nodeId: 'node', sessionEpoch: 9, assignments: ['original-overwritten'], tombstones: ['original-overwritten'], nested: { same: true } };
    const input: any = { forward: { source: 'forward' }, nodeFacts, reservations, snapshot: metadata };
    const snapshot: any = { version: 3, nested: { value: 'é' } };
    const state: any = { fail: '', thrown: failure, read: undefined, parse: undefined, forward: undefined, direct: undefined, snapshot: undefined, stringify: undefined, stdout: undefined, error: undefined };
    let caught: Promise<unknown> | undefined;
    let snapshotArgument: any;
    const record = (stage: string, ...args: unknown[]) => { events.push([stage, ...args]); if (state.fail === stage) throw state.thrown; };
    const providers: Record<string, any> = {
        'node:fs/promises': { readFile: async (...args: unknown[]) => { record('read', ...args); return state.read ? state.read(...args) : 'native input'; } },
        '@tunex/contracts/shared': { parseJson: (raw: unknown) => { record('parse', raw); return state.parse ? state.parse(raw) : input; } },
        '@tunex/core': { parseForward: (value: unknown) => { record('forward', value); return state.forward ? state.forward(value) : { ok: true, value: forward }; } },
        './compatibility/public.ts': {
            compileDirect: (...args: unknown[]) => { record('direct', ...args); return state.direct ? state.direct(...args) : assignments; },
            compileSnapshot: (value: unknown) => { record('snapshot', value); snapshotArgument = value; return state.snapshot ? state.snapshot(value) : snapshot; },
        },
    };
    const nativePromiseCatch = Promise.prototype.catch;
    const process = { argv, stdout: { write: (value: unknown) => { record('stdout', value); return state.stdout ? state.stdout(value) : false; } }, get exitCode() { return exitCode; }, set exitCode(value: number | undefined) { record('exit', value); exitCode = value; } };
    let exitCode: number | undefined;
    const context = vm.createContext({
        exports: {}, require: (name: string) => { record('require', name); assert.ok(Object.hasOwn(providers, name), 'offline plan imported unexpected effect owner: ' + name); return providers[name]; },
        process, console: { error: (message: unknown) => { record('error', message); return state.error?.(message); } },
        Error, JSON: { stringify: (...args: Parameters<typeof JSON.stringify>) => { record(args[2] === 2 ? 'pretty' : 'stringify', ...args); return state.stringify ? state.stringify(...args) : JSON.stringify(...args); } },
    });
    // Observe the existing top-level main().catch promise without changing the
    // command body or introducing an exported entrypoint in production.
    const install = new vm.Script('Promise.prototype.catch = function (callback) { return captureCatch(this, callback); };');
    Object.assign(context, { captureCatch: (promise: Promise<unknown>, callback: (error: unknown) => unknown) => { caught = Reflect.apply(nativePromiseCatch, promise, [callback]); return caught; } });
    install.runInContext(context);
    return {
        events, state, input, metadata, forward, nodeFacts, reservations, assignments, snapshot, failure, process, providers,
        snapshotArgument: () => snapshotArgument,
        async run() { vm.runInContext(output, context, { filename: 'apps/control/src/cli.ts' }); assert.ok(caught, 'original main().catch missing'); await caught; },
    };
}

test('152 offline plan retains only public compiler and fact imports and original positional argv rule', async () => {
    const file = ts.createSourceFile('cli.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const imports = file.statements.filter(ts.isImportDeclaration).map(value => ({ module: (value.moduleSpecifier as ts.StringLiteral).text, typeOnly: value.importClause?.isTypeOnly ?? false, names: value.importClause?.namedBindings && ts.isNamedImports(value.importClause.namedBindings) ? value.importClause.namedBindings.elements.map(item => item.name.text) : [] }));
    assert.deepEqual(imports, [
        { module: 'node:fs/promises', typeOnly: false, names: ['readFile'] },
        { module: '@tunex/core', typeOnly: false, names: ['parseForward'] },
        { module: '@tunex/contracts/shared', typeOnly: false, names: ['parseJson'] },
        { module: './compatibility/public.ts', typeOnly: false, names: ['compileDirect', 'compileSnapshot'] },
        { module: './compatibility/public.ts', typeOnly: true, names: ['SnapshotInput'] },
        { module: './framework/public.ts', typeOnly: true, names: ['AuthorizedNodeFacts', 'ReservedSlot'] },
    ]);
    for (const argv of [[], ['node'], ['node', 'cli'], ['node', 'cli', '']]) {
        const h = planFixture(argv); await h.run();
        assert.deepEqual(h.events.filter(event => event[0] !== 'require'), [['error', 'Usage: npm run plan -- <plan-input.json>'], ['exit', 1]]);
        assert.equal(h.process.exitCode, 1);
    }
    for (const path of ['literal-path', ' ', '--help', 'raw/../é.json']) {
        const h = planFixture(['node', 'cli', path, 'extra', 'ignored']); await h.run();
        assert.deepEqual(h.events.find(event => event[0] === 'read'), ['read', path, 'utf8']);
        assert.equal(h.process.exitCode, undefined);
        assert.deepEqual(h.events.filter(event => event[0] === 'require').map(event => event[1]), ['node:fs/promises', '@tunex/core', '@tunex/contracts/shared', './compatibility/public.ts']);
    }
});

test('152 actual offline plan awaits read then strict parse Forward direct snapshot pretty and stdout with original identities', async () => {
    const h = planFixture(); const read = deferred<string>(); h.state.read = () => read.promise;
    const pending = h.run(); await Promise.resolve();
    assert.deepEqual(h.events.filter(event => event[0] !== 'require'), [['read', 'raw/../plan.json', 'utf8']]);
    read.resolve('original bytes'); await pending;
    assert.deepEqual(h.events.filter(event => event[0] !== 'require').map(event => event[0]), ['read', 'parse', 'forward', 'direct', 'snapshot', 'pretty', 'stdout']);
    assert.deepEqual(h.events.find(event => event[0] === 'parse'), ['parse', 'original bytes']);
    assert.equal(h.events.find(event => event[0] === 'forward')![1], h.input.forward);
    const direct = h.events.find(event => event[0] === 'direct')!; assert.equal(direct[1], h.forward); assert.equal(direct[2], h.nodeFacts); assert.equal(direct[3], h.reservations);
    const supplied = h.snapshotArgument(); assert.notEqual(supplied, h.metadata); assert.equal(supplied.nested, h.metadata.nested); assert.equal(supplied.assignments, h.assignments); assert.deepEqual(plain(supplied.tombstones), []);
    assert.deepEqual(Object.keys(supplied), ['nodeId', 'sessionEpoch', 'assignments', 'tombstones', 'nested']);
    assert.deepEqual(h.metadata.assignments, ['original-overwritten']); assert.deepEqual(h.metadata.tombstones, ['original-overwritten']);
    const pretty = h.events.find(event => event[0] === 'pretty')!; assert.equal(pretty[1], h.snapshot); assert.deepEqual(pretty.slice(2), [null, 2]);
    assert.deepEqual(h.events.at(-1), ['stdout', '{\n  "version": 3,\n  "nested": {\n    "value": "é"\n  }\n}\n']);
    assert.equal(h.events.some(event => event[0] === 'error' || event[0] === 'exit'), false);
    assert.equal(h.process.exitCode, undefined, 'stdout false remains ignored without introducing drain/retry');
});

test('152 offline plan preserves snapshot getter evaluation after direct compile and ignores inherited or overwritten assignment facts', async () => {
    const h = planFixture(); const nested = {};
    const original = Object.create({ inherited: 'ignored' });
    Object.defineProperties(original, {
        nodeId: { enumerable: true, get: () => { h.events.push(['get', 'nodeId']); return 'node'; } },
        assignments: { enumerable: true, get: () => { h.events.push(['get', 'assignments']); return ['untrusted']; } },
        tombstones: { enumerable: true, get: () => { h.events.push(['get', 'tombstones']); return ['untrusted']; } },
        nested: { enumerable: true, value: nested },
        hidden: { enumerable: false, get: () => { throw Error('hidden getter reached'); } },
    });
    h.input.snapshot = original; await h.run();
    const stages = h.events.filter(event => event[0] !== 'require').map(event => event[0] === 'get' ? 'get:' + event[1] : event[0]);
    assert.deepEqual(stages, ['read', 'parse', 'forward', 'direct', 'get:nodeId', 'get:assignments', 'get:tombstones', 'snapshot', 'pretty', 'stdout']);
    const supplied = h.snapshotArgument(); assert.equal(supplied.nested, nested); assert.equal(supplied.assignments, h.assignments); assert.deepEqual(plain(supplied.tombstones), []); assert.equal(Object.hasOwn(supplied, 'inherited'), false); assert.equal(Object.hasOwn(supplied, 'hidden'), false);
});

test('152 every offline plan stage failure retains original catch message exit and stops later effects', async () => {
    const stages = ['read', 'parse', 'forward', 'direct', 'snapshot', 'pretty', 'stdout'];
    for (const stage of stages) {
        const h = planFixture(); h.state.fail = stage; await h.run();
        const effects = h.events.filter(event => event[0] !== 'require');
        assert.deepEqual(effects.map(event => event[0]), [...stages.slice(0, stages.indexOf(stage) + 1), 'error', 'exit']);
        assert.deepEqual(effects.slice(-2), [['error', h.failure.message], ['exit', 1]]);
        assert.equal(h.process.exitCode, 1);
    }
    for (const thrown of [null, undefined, 0, false, 'raw failure', { message: 'untrusted object' }]) {
        const h = planFixture(); h.state.fail = 'read'; h.state.thrown = thrown; await h.run();
        assert.deepEqual(h.events.slice(-2), [['error', 'Plan failed'], ['exit', 1]]);
    }
    const h = planFixture(); h.state.fail = 'read'; h.state.error = () => { throw h.failure; };
    await assert.rejects(h.run(), error => error === h.failure);
    assert.equal(h.events.some(event => event[0] === 'exit'), false, 'console failure precedes exitCode assignment');
});

test('152 Forward errors stringify exactly and strict JSON duplicate invalid root and compiler refusal precede output', async () => {
    const h = planFixture(); const errors = [{ code: 'INVALID_FORWARD', path: 'spec.é', message: 'original' }];
    h.state.forward = () => ({ ok: false, errors }); await h.run();
    assert.deepEqual(h.events.filter(event => event[0] !== 'require').map(event => event[0]), ['read', 'parse', 'forward', 'stringify', 'error', 'exit']);
    assert.equal(h.events.find(event => event[0] === 'stringify')![1], errors);
    assert.deepEqual(h.events.slice(-2), [['error', JSON.stringify(errors)], ['exit', 1]]);
    const encode = planFixture(); encode.state.forward = () => ({ ok: false, errors }); encode.state.fail = 'stringify'; await encode.run(); assert.deepEqual(encode.events.slice(-2), [['error', encode.failure.message], ['exit', 1]]);
    for (const raw of ['{', '{"forward":{},"forward":{}}', 'null']) {
        const actual = planFixture(); actual.state.read = () => raw; actual.state.parse = parseJson; actual.state.forward = parseForward; actual.state.direct = compileDirect; actual.state.snapshot = compileSnapshot; await actual.run();
        assert.equal(actual.events.some(event => event[0] === 'stdout' || event[0] === 'direct'), false); assert.equal(actual.process.exitCode, 1);
    }
    const invalidForward = planFixture(); invalidForward.state.parse = parseJson; invalidForward.state.forward = parseForward; invalidForward.state.read = () => '{"forward":{}}'; await invalidForward.run();
    const result = parseForward({}); assert.equal(result.ok, false); if (!result.ok) assert.equal(invalidForward.events.find(event => event[0] === 'error')![1], JSON.stringify(result.errors));
});

function actualPlanInput() {
    const forward = { id: 'forward-a', scopeId: 'scope-a', revision: 3, spec: { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId: 'node-a', listen: { address: '0.0.0.0', port: 25565 } }, target: { host: 'game.example', port: 443 } } };
    const nodeFacts: AuthorizedNodeFacts = { nodeId: 'node-a', scopeId: 'scope-a', capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp'], allowedListenerAddresses: ['0.0.0.0'], allowedPorts: [25565], egressPolicyRevision: 7, allowedDestinationCidrs: ['192.0.2.0/24'], allowMetadataTargets: false };
    const reservations: ReservedSlot[] = ['tcp', 'udp'].map(protocol => ({ nodeId: 'node-a', forwardId: 'forward-a', protocol: protocol as 'tcp' | 'udp', port: 25565, bindingFence: 4, deploymentGeneration: 2 }));
    const snapshot: Omit<SnapshotInput, 'assignments' | 'tombstones'> = { nodeId: 'node-a', sessionEpoch: 5, snapshotGeneration: 10, issuedAt: '2026-10-12T10:00:00Z', validUntil: '2026-10-12T10:05:00Z' };
    return { forward, nodeFacts, reservations, snapshot };
}

test('152 actual public parser and offline compilers keep native Snapshot pretty bytes and independent authorization reservation refusals', async () => {
    for (const mode of ['valid', 'foreign-scope', 'no-reservations', 'bad-snapshot'] as const) {
        const input = actualPlanInput(); if (mode === 'foreign-scope') input.nodeFacts = { ...input.nodeFacts, scopeId: 'foreign' }; if (mode === 'no-reservations') input.reservations = []; if (mode === 'bad-snapshot') input.snapshot.validUntil = input.snapshot.issuedAt;
        const h = planFixture(); h.state.read = () => JSON.stringify(input); h.state.parse = parseJson; h.state.forward = parseForward; h.state.direct = compileDirect; h.state.snapshot = compileSnapshot; await h.run();
        if (mode === 'valid') {
            const parsed = parseForward(input.forward); assert.equal(parsed.ok, true); if (!parsed.ok) throw Error('valid Forward fixture refused');
            const assignments = compileDirect(parsed.value, input.nodeFacts, input.reservations); const expected = compileSnapshot({ ...input.snapshot, assignments, tombstones: [] });
            assert.deepEqual(h.events.at(-1), ['stdout', JSON.stringify(expected, null, 2) + '\n']); assert.equal(h.process.exitCode, undefined);
        } else {
            assert.equal(h.events.some(event => event[0] === 'stdout'), false); assert.equal(h.process.exitCode, 1);
            if (mode === 'foreign-scope') assert.match(h.events.find(event => event[0] === 'error')![1], /AUTHORIZATION_DENIED/);
            if (mode === 'no-reservations') assert.match(h.events.find(event => event[0] === 'error')![1], /RESOURCE_CONFLICT/);
            assert.equal(h.events.some(event => event[0] === 'snapshot'), mode === 'bad-snapshot');
        }
    }
});
