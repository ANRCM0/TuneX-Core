import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { RecoveryQuarantine } from '../src/modules/recovery-owner/public.ts';

const source = await readFile(new URL('../../../scripts/ops/recovery.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
const parsed = ts.createSourceFile('recovery.ts', source, ts.ScriptTarget.Latest, true);
const imports = new Map<string, string[]>();
for (const entry of parsed.statements) if (ts.isImportDeclaration(entry) && ts.isStringLiteral(entry.moduleSpecifier) && entry.importClause && !entry.importClause.isTypeOnly) {
    const names = entry.importClause.namedBindings; assert.ok(names && ts.isNamedImports(names));
    imports.set(entry.moduleSpecifier.text, names.elements.filter(name => !name.isTypeOnly).map(name => (name.propertyName ?? name.name).text));
}
type Call = { name: string; owner: unknown; args: any[] };
function fixture() {
    const trace: string[] = [], built: Call[] = [], calls: Call[] = [], handlers = new Map<string, (...args: any[]) => any>();
    const db = {}, tx = {}, native = {}, accounts = [{ actorId: 'owner', token: 'protected', owner: true }], result = {};
    let tick = 100;
    const nativeNow = () => { trace.push('now'); return ++tick; };
    const nativeEncode = (value: unknown) => { trace.push('encode'); return JSON.stringify(value); };
    const bindings: Record<string, any> = {};
    const method = (owner: unknown, name: string) => function(this: unknown, ...args: any[]) {
        assert.equal(this, owner); trace.push(name); calls.push({ name, owner, args });
        return handlers.get(name)?.(...args) ?? (name === 'Identity.quarantineRecovery' ? accounts : result);
    };
    for (const names of imports.values()) for (const name of names) {
        const Class = class {
            constructor(...args: any[]) {
                trace.push(`new:${name}`);
                const target = { name, args }, cache = new Map<string, any>();
                const instance = new Proxy(target, { get(object, key, receiver) {
                    if (Reflect.has(object, key)) return Reflect.get(object, key, receiver);
                    if (key === 'then' || typeof key !== 'string') return undefined;
                    if (!cache.has(key)) cache.set(key, method(instance, `${name}.${key}`));
                    return cache.get(key);
                } });
                built.push({ name, owner: instance, args }); return instance;
            }
        };
        Object.assign(Class, { quarantineRecovery: method(Class, `${name}.quarantineRecovery`) });
        bindings[name] = Class;
    }
    Object.assign(bindings, { RecoveryQuarantine, nativeRecoveryEffects: native, nativeJsonEncode: nativeEncode, nativeWallClockNow: nativeNow });
    const trusted = {}, exports: any = {};
    new vm.Script(javascript, { filename: 'original-recovery-operator.cjs' }).runInContext(vm.createContext({ exports,
        require(name: string) { return { ...Object.fromEntries((imports.get(name) ?? []).map(key => [key, bindings[key]])), trustedRecoveryTime: trusted }; } }));
    const workflow = () => { const found = built.find(call => call.name === 'RecoveryWorkflow'); assert.ok(found); return found; };
    const context = { recoveryId: 'recovery', manifest: { id: 'backup', database: 'old-db', trustDigest: 'old-trust' },
        authority: { latestValidUntil: 99 }, newTrustDigest: 'new-trust', acceptCredentials(value: unknown) { assert.equal(value, accounts); trace.push('credentials'); } };
    return { trace, built, calls, handlers, db, tx, native, accounts, result, nativeNow, nativeEncode, bindings, exports, trusted, workflow, context };
}

test('201 original Recovery operator keeps module load inert, constructs a fresh Workflow per invocation and passes options unchanged', async () => {
    const f = fixture(); assert.deepEqual(f.trace, []); assert.equal(f.exports.trustedRecoveryTime, f.trusted);
    for (const method of ['backupDatabase', 'restoreDatabase']) {
        const options = Object.freeze({ get directory(): never { return assert.fail('operator wrapper must not inspect native options'); } });
        assert.equal(await f.exports[method](options), f.result);
        const built = f.built.at(-1)!; assert.equal(built.name, 'RecoveryWorkflow'); assert.equal(built.args[0].native, f.native);
        assert.equal(typeof built.args[0].quarantine, 'function');
        assert.deepEqual(f.calls.at(-1), { name: `RecoveryWorkflow.${method}`, owner: built.owner, args: [options] });
    }
    assert.deepEqual(f.trace, ['new:RecoveryWorkflow', 'RecoveryWorkflow.backupDatabase', 'new:RecoveryWorkflow', 'RecoveryWorkflow.restoreDatabase']);
    assert.notEqual(f.built[0]!.owner, f.built[1]!.owner);
});

const mutations = ['Identity.quarantineRecovery', 'Transport.quarantineRecovery', 'RelayCoordinator.quarantineRecovery', 'Nodes.quarantineRecovery',
    'TelemetryRecovery.quarantineRecovery', 'StationAlertRecovery.quarantineRecovery', 'NotificationRecovery.quarantineRecovery',
    'MySqlProbeHistoryStore.quarantineRecovery', 'MySqlProbePlanStore.quarantineRecovery', 'MySqlProbeQualificationStore.quarantineRecovery',
    'MySqlObservationServiceStore.quarantineRecovery', 'PathPublicationRecovery.quarantineRecovery', 'IngressRecovery.quarantineDeployments',
    'IngressRecovery.quarantineMigrations', 'MySqlProbeInstanceStore.quarantineRecovery', 'MySqlProbePermitStore.quarantineRecovery',
    'Forwarding.quarantineRecovery', 'RuntimeLedger.quarantineRecovery', 'Idempotency.quarantineRecovery', 'MySqlRecoveryEventStore.record'];

test('201 real quarantine host invokes original lazy owners, static bindings and one empty-assignment Ledger in the supplied transaction', async () => {
    const f = fixture(); await f.exports.restoreDatabase({}); f.trace.length = 0; f.calls.length = 0;
    await f.workflow().args[0].quarantine(f.db, f.tx, f.context);
    assert.deepEqual(f.calls.map(call => call.name), mutations);
    for (const call of f.calls) assert.equal(call.args[0], f.tx);
    assert.deepEqual(f.trace.slice(0, 4), ['new:MySqlIngressDeploymentRecoveryStore', 'new:MySqlIngressMigrationRecoveryStore', 'new:IngressRecovery', 'new:MySqlRecoveryEventStore']);
    assert.ok(f.trace.indexOf('credentials') > f.trace.indexOf(mutations[0]!));
    assert.ok(f.trace.indexOf('credentials') < f.trace.indexOf(mutations[1]!));
    assert.deepEqual(f.built.map(call => call.name), ['RecoveryWorkflow', 'MySqlIngressDeploymentRecoveryStore', 'MySqlIngressMigrationRecoveryStore', 'IngressRecovery', 'MySqlRecoveryEventStore',
        'Identity', 'MySqlTelemetryRecoveryStore', 'TelemetryRecovery', 'MySqlStationAlertRecoveryStore', 'StationAlertRecovery',
        'MySqlNotificationRecoveryStore', 'NotificationRecovery', 'MySqlPathPublicationRecoveryStore', 'PathPublicationRecovery',
        'Forwarding', 'SnapshotAssignmentRegistry', 'RuntimeLedger', 'Idempotency']);
    const one = (name: string) => f.built.find(call => call.name === name)!;
    assert.deepEqual(one('Identity').args, [f.db]);
    for (const [owner, store] of [['TelemetryRecovery', 'MySqlTelemetryRecoveryStore'], ['StationAlertRecovery', 'MySqlStationAlertRecoveryStore'],
        ['NotificationRecovery', 'MySqlNotificationRecoveryStore'], ['PathPublicationRecovery', 'MySqlPathPublicationRecoveryStore']]) assert.equal(one(owner!).args[0], one(store!).owner);
    assert.equal(one('StationAlertRecovery').args[1], f.nativeEncode); assert.equal(one('NotificationRecovery').args[1], f.nativeNow);
    assert.deepEqual(one('IngressRecovery').args, [one('MySqlIngressDeploymentRecoveryStore').owner, one('MySqlIngressMigrationRecoveryStore').owner]);
    assert.deepEqual(Array.from(one('SnapshotAssignmentRegistry').args[0]), []);
    assert.deepEqual(one('RuntimeLedger').args, [undefined, undefined, one('SnapshotAssignmentRegistry').owner]);
    assert.deepEqual(one('Forwarding').args, []); assert.deepEqual(one('Idempotency').args, []);
    for (const name of ['Transport', 'RelayCoordinator', 'Nodes', 'MySqlProbeHistoryStore', 'MySqlProbePlanStore', 'MySqlProbeQualificationStore', 'MySqlObservationServiceStore', 'MySqlProbeInstanceStore', 'MySqlProbePermitStore']) {
        assert.equal(f.calls.find(call => call.name === `${name}.quarantineRecovery`)!.owner, f.bindings[name]);
        assert.equal(f.built.some(call => call.name === name), false, 'original static recovery entry remains static');
    }
    for (const name of ['PathPublicationRecovery.quarantineRecovery', 'IngressRecovery.quarantineDeployments', 'IngressRecovery.quarantineMigrations']) assert.equal(f.calls.find(call => call.name === name)!.args[1], 101);
    const event = f.calls.at(-1)!;
    assert.deepEqual(event.args.slice(0, 3), [f.tx, 'recovery', 102]);
    assert.deepEqual(JSON.parse(event.args[3]), { backupId: 'backup', sourceDatabase: 'old-db', oldTrust: 'old-trust', newTrust: 'new-trust', authorizationCutoff: 99, reviewRequired: true });
    assert.deepEqual(f.trace.filter(name => name === 'now' || name === 'encode'), ['now', 'now', 'encode']);
});

test('201 every native Recovery callback failure stops later owner construction, credential acceptance and final event without another transaction', async () => {
    for (const [index, name] of mutations.entries()) {
        const f = fixture(), failure = new Error(name); await f.exports.backupDatabase({}); f.calls.length = 0; f.trace.length = 0;
        f.handlers.set(name, () => { throw failure; });
        await assert.rejects(f.workflow().args[0].quarantine(f.db, f.tx, f.context), error => error === failure);
        assert.deepEqual(f.calls.map(call => call.name), mutations.slice(0, index + 1));
        assert.equal(f.trace.includes('credentials'), index > 0);
        for (const call of f.calls) assert.equal(call.args[0], f.tx);
        for (const [owner, action] of [['TelemetryRecovery', 4], ['StationAlertRecovery', 5], ['NotificationRecovery', 6],
            ['PathPublicationRecovery', 11], ['Forwarding', 16], ['RuntimeLedger', 17], ['Idempotency', 18]] as const) assert.equal(f.built.some(call => call.name === owner), index >= action);
    }
});
