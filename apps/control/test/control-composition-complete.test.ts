import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { ControlError } from '../src/framework/public.ts';
import { requestIdentity } from '../src/application/command-request.ts';
import { nativeCommandRequest } from '../src/compatibility/public.ts';

const source = await readFile(new URL('../src/application/control.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
const parsed = ts.createSourceFile('control.ts', source, ts.ScriptTarget.Latest, true);
const imports = new Map<string, string[]>();
for (const statement of parsed.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause && !statement.importClause.isTypeOnly) {
  const bindings = statement.importClause.namedBindings; assert.ok(bindings && ts.isNamedImports(bindings));
  const names = imports.get(statement.moduleSpecifier.text) ?? [];
  for (const entry of bindings.elements) if (!entry.isTypeOnly) names.push((entry.propertyName ?? entry.name).text);
  imports.set(statement.moduleSpecifier.text, names);
}

type Instance = { name: string; args: any[]; [key: string]: any };
function fixture() {
  const built: Instance[] = [], calls: Array<{ owner: unknown; name: string; args: unknown[] }> = [], bindings: Record<string, any> = {};
  const handlers = new Map<string, (...args: any[]) => any>(), token = {}, tx = {}, db = {}, identity = {}, resources = {};
  const method = (owner: unknown, name: string) => function(this: unknown, ...args: unknown[]) {
    assert.equal(this, owner); calls.push({ owner, name, args }); return handlers.get(name)?.(...args) ?? token;
  };
  const nodes: any = {};
  for (const name of ['canExecute', 'cleanupFacts']) nodes[name] = method(nodes, `Nodes.${name}`);
  for (const names of imports.values()) for (const name of names) bindings[name] = class {
    constructor(...args: any[]) {
      const target: Instance = { name, args };
      if (name === 'RelayCoordinator') target.multihopEnabled = args[6];
      if (name === 'ForwardProbes') Object.assign(target, { enabled: args[4], ingressEnabled: args[5], servicesEnabled: args[6], echoEnabled: args[7], pathEchoEnabled: args[8] });
      const cache = new Map<PropertyKey, any>();
      const proxy = new Proxy(target, { get(object, key, receiver) {
        if (Reflect.has(object, key)) return Reflect.get(object, key, receiver);
        if (key === 'then' || typeof key !== 'string') return undefined;
        if (!cache.has(key)) cache.set(key, method(proxy, `${name}.${key}`));
        return cache.get(key);
      } });
      built.push(proxy); return proxy;
    }
  };
  Object.assign(bindings, { DEFAULT_POLICY, ControlError, randomUUID: () => assert.fail('composition must not generate an ID'),
    validateConsoleFilters: {}, nativeReadProjectionValues: { now: () => assert.fail('composition sampled native time') },
    probeInstanceStorageValues: {}, probePermitStorageValues: {}, probeRunStorageValues: {}, probeQualificationStorageValues: {},
    observationServiceStorageValues: {}, pathPublicationStorageValues: {}, ingressDeploymentStorageValues: {}, ingressMigrationStorageValues: {}, nativeRuntimeStatusCodec: {} });
  const exports: any = {};
  new vm.Script(javascript, { filename: 'actual-control.cjs' }).runInContext(vm.createContext({ exports, Date,
    require(specifier: string) { const names = imports.get(specifier); assert.ok(names); return Object.fromEntries(names.map(name => [name, bindings[name]])); } }));
  const construct = (policy?: unknown, ...flags: boolean[]) => new exports.ControlApplication(db, identity, nodes, policy, ...flags, resources);
  const one = (name: string, index = 0) => { const found = built.filter(value => value.name === name)[index]; assert.ok(found, name); return found; };
  return { built, calls, bindings, handlers, token, tx, db, identity, nodes, resources, construct, one, Class: exports.ControlApplication };
}
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test('208 actual Control composition preserves field initializer and every original constructor group before deferred callbacks', () => {
  const f = fixture(), control = f.construct(undefined, false, false, false, false);
  assert.deepEqual(f.built.map(value => value.name), [
    'Forwarding', 'Idempotency', 'MySqlAccountCredentialStore', 'IdentityCredentials', 'MySqlResourceAccessStore', 'ResourceAccess', 'MySqlRuntimeResourceStore', 'MySqlNodeAuthorityStore', 'MySqlResourceUsageStore', 'ResourceUsage', 'MySqlNodeAuthorityStore', 'MySqlSharedResourceLimitStore', 'SharedResourceLimits', 'MySqlManagementReadStore', 'ConsoleReadModels', 'ConsoleQueries',
    'MySqlTransitMachineReader', 'TransitNegotiationService', 'MySqlTransitDeliveryStore', 'MySqlTransitCoordinationStore', 'TransitCoordinationService', 'TransitPreviewDelivery',
    'NativeDrivers', 'MySqlTunnelMetadataReadStore', 'TunnelReadModels', 'TunnelQueries', 'MySqlNodeObservationReader', 'NodeObservations',
    'MySqlObservationServiceStore', 'ProbeObservationServices', 'MySqlProbeReader', 'MySqlProbeReader', 'ForwardPathProbePlans', 'ForwardProbePlans', 'MySqlProbeMachineReader', 'ProbeNegotiator',
    'MySqlProbeMachineReader', 'MySqlProbeInstanceStore', 'ProbeInstances', 'ProbeInstanceRegistry', 'MySqlProbeQualificationStore',
    'MySqlProbeMachineReader', 'MySqlProbeInstanceStore', 'ProbeTypeRegistry', 'MySqlProbeMachineReader', 'MySqlProbeInstanceStore', 'ProbeServiceRegistry',
    'MySqlProbeMachineReader', 'MySqlProbeInstanceStore', 'ProbeEchoRegistry',
    'MySqlProbePermitIntents', 'MySqlProbeReader', 'MySqlProbeReader', 'ForwardPathProbePlans', 'ForwardProbePlans', 'MySqlProbeHistoryStore', 'ProbePathObservations', 'MySqlProbeMachineReader', 'MySqlProbeInstanceStore', 'MySqlProbePermitStore',
    'MySqlProbeHistoryStore', 'ProbeRunHistoryRecorder', 'ProbePermits', 'ProbeClaims', 'ProbeDelivery', 'ProbeResults', 'ProbeTypes', 'ProbeServices', 'ProbeEcho', 'ForwardProbes', 'ForwardProbeCapabilities',
    'RelayAssignmentSource', 'SnapshotAssignmentRegistry', 'RuntimeLedger', 'Transport', 'MySqlProfileReferenceReadStore', 'TransportReferenceReadModels', 'TransportQueries', 'RelayEndpoints',
    'MySqlPathTemplateStore', 'NativePathReferences', 'PathTemplateCommands', 'PathTemplateQueries', 'MySqlPathBindingStore', 'PathBindings', 'MySqlPathGroupStore', 'MySqlPathGroupBindingStore', 'PathGroups',
    'RelayCoordinator', 'RelayPlans', 'ForwardCommandExecutor', 'ForwardCommands', 'MySqlPathPublicationStore', 'PathPublications', 'MySqlIngressGroupStore', 'IngressGroups',
    'MySqlIngressDeploymentStore', 'IngressDeployments', 'MySqlIngressMigrationStore', 'IngressMigrations', 'NativeTunnels', 'ProfileGrantReconciler', 'TransportGrantCommands',
    'AccessChangeReconciler', 'AccessCommands', 'NodeChangeReconciler', 'NodeManagementCommands', 'MySqlRuntimeStatusStore', 'RuntimeStatusQueries', 'ControlQueries',
  ]);
  assert.deepEqual(f.calls, [], 'neither the deferred Relay nor the self-referential migration origin is evaluated during construction');
  assert.equal(control.db, f.db); assert.equal(control.identity, f.identity); assert.equal(control.nodes, f.nodes);
  for (const [field, name] of Object.entries({ forwarding: 'Forwarding', idempotency: 'Idempotency', ledger: 'RuntimeLedger', transport: 'Transport',
    relayEndpoints: 'RelayEndpoints', relay: 'RelayCoordinator', relayPlans: 'RelayPlans', forwards: 'ForwardCommands', pathBindings: 'PathBindings',
    pathGroups: 'PathGroups', ingressDeployments: 'IngressDeployments', ingressMigrations: 'IngressMigrations', details: 'ControlQueries' })) assert.equal(control[field], f.one(name));
  const args = (name: string, index = 0) => f.one(name, index).args;
  assert.deepEqual(args('ResourceAccess'), [f.identity, f.one('MySqlResourceAccessStore')]);
  assert.deepEqual(args('ConsoleQueries'), [f.db, f.identity, f.one('ConsoleReadModels'), control.readAccess]);
  assert.equal(control.readAccess, f.one('ResourceAccess')); assert.equal(control.resourceLimits, f.one('SharedResourceLimits'));
  const payload = args('SharedResourceLimits')[0];
  assert.equal(payload.db, f.db); assert.equal(payload.identity, f.identity); assert.equal(payload.nodes, f.one('MySqlNodeAuthorityStore',1));
  assert.equal(payload.owners, f.one('MySqlRuntimeResourceStore')); assert.equal(payload.runtime, f.resources); assert.equal(payload.store, f.one('MySqlSharedResourceLimitStore'));
  assert.equal(args('MySqlManagementReadStore')[0].now, f.bindings.nativeReadProjectionValues.now);
  assert.equal(args('ConsoleReadModels')[1], f.bindings.nativeReadProjectionValues); assert.equal(args('TunnelReadModels')[1], f.bindings.nativeReadProjectionValues);
  assert.equal(args('TransportReferenceReadModels')[1], f.bindings.nativeReadProjectionValues);
  assert.deepEqual(args('RuntimeLedger'), [undefined, f.nodes, f.one('SnapshotAssignmentRegistry'), f.resources]);
  assert.deepEqual(Array.from(args('SnapshotAssignmentRegistry')[0]), [f.one('RelayAssignmentSource')]);
  const qualification = f.one('MySqlProbeQualificationStore');
  assert.equal(args('ProbeTypeRegistry')[3], qualification); assert.equal(args('ProbeServiceRegistry')[3], qualification); assert.equal(args('ProbePermits')[9], qualification);
  assert.equal(args('ForwardProbePlans')[2], control.readAccess); assert.equal(args('ForwardProbePlans', 1)[2], control.readAccess);
  assert.equal(args('ForwardProbePlans')[3], control.forwarding); assert.equal(args('ForwardProbePlans', 1)[3], f.one('MySqlProbePermitIntents'));
  assert.deepEqual(args('MySqlProbeReader'), []); assert.deepEqual(args('MySqlProbeReader', 1), []);
  assert.deepEqual(args('MySqlProbeReader', 2), [true]); assert.deepEqual(args('MySqlProbeReader', 3), [true]);
  assert.equal(args('ForwardProbePlans')[9],f.one('ForwardPathProbePlans'));
  assert.equal(args('ForwardProbePlans',1)[9],f.one('ForwardPathProbePlans',1));
  assert.equal(args('ProbePathObservations')[3],f.one('ForwardProbePlans',1));
  assert.equal(args('ProbeEcho')[0],control.probePermits);assert.equal(args('ProbeEchoRegistry')[3],qualification);
  assert.equal(payload.usage,control.resourceUsage);
  assert.equal(args('ForwardProbePlans')[7], f.one('ProbeObservationServices')); assert.equal(args('ForwardProbePlans', 1)[7], f.one('ProbeObservationServices'));
  assert.equal(args('ProbePermits')[2], control.readAccess); assert.equal(args('ProbePermits')[7], Date.now); assert.equal(args('ProbePermits')[8], f.one('ProbeRunHistoryRecorder'));
  assert.deepEqual(args('ForwardProbeCapabilities'), [f.db, f.identity, control.readAccess, control.forwarding, control.probePlans, control.probes]);
  assert.equal(args('ForwardCommands')[2], control.readAccess); assert.equal(args('ForwardCommands')[3], control.idempotency); assert.equal(args('ForwardCommands')[4], control.forwarding); assert.equal(args('ForwardCommands')[5], control.ledger);
  assert.equal(args('PathTemplateCommands')[2], control.readAccess); assert.equal(args('PathTemplateCommands')[4], f.one('MySqlPathTemplateStore')); assert.equal(args('PathTemplateQueries')[3], f.one('MySqlPathTemplateStore'));
  assert.equal(args('PathBindings')[3], f.one('MySqlPathTemplateStore')); assert.equal(args('PathGroups')[5], f.one('MySqlPathTemplateStore'));
  assert.equal(args('PathBindings')[5], f.one('MySqlPathBindingStore')); assert.equal(args('PathGroups')[10], f.one('MySqlPathBindingStore'));
  assert.deepEqual(args('RelayCoordinator'), [f.nodes, control.forwarding, control.transport, control.relayEndpoints, control.ledger, undefined, false]);
  assert.equal(args('RuntimeStatusQueries')[1], f.bindings.nativeRuntimeStatusCodec); assert.equal(args('RuntimeStatusQueries')[2], DEFAULT_POLICY);
  assert.deepEqual(plain(args('ControlQueries')[6]), { multihopEnabled: false, maxPathNodes: 8, executionExtension: 1, probeIssuanceEnabled: false, probeIngressIssuanceEnabled: false, probeServicesIssuanceEnabled: false, probeEchoIssuanceEnabled:false,probePathEchoIssuanceEnabled:false });
});

test('208 explicit feature policy and resource bindings reach only their original consumers', () => {
  const f = fixture(), policy = { ...DEFAULT_POLICY, observationFreshnessSeconds: 7, maxClockSkewSeconds: 2 }, control = f.construct(policy, true, true, true, true);
  assert.deepEqual(f.one('NativeDrivers').args, [f.db, f.identity, true, true]);
  assert.deepEqual(plain(f.one('NodeObservations').args[1]), { freshnessMs: 7000, clockSkewMs: 2000 });
  assert.equal(f.one('ForwardProbePlans').args[6], 2000); assert.equal(f.one('ForwardProbePlans', 1).args[6], 2000);
  assert.equal(f.one('RuntimeLedger').args[0], policy); assert.equal(f.one('RelayCoordinator').args[5], policy); assert.equal(f.one('RuntimeStatusQueries').args[2], policy);
  assert.deepEqual(f.one('ForwardProbes').args.slice(4), [true, true, true, false, false]);
  assert.deepEqual(plain(f.one('ControlQueries').args[6]), { multihopEnabled: true, maxPathNodes: 8, executionExtension: 1, probeIssuanceEnabled: true, probeIngressIssuanceEnabled: true, probeServicesIssuanceEnabled: true, probeEchoIssuanceEnabled:false,probePathEchoIssuanceEnabled:false });
  assert.equal(control.ledger, f.one('ForwardCommandExecutor').args[1]); assert.equal(control.ledger, f.one('ForwardCommands').args[5]);
});

test('208 deferred Relay and migration origin callbacks select the original late owner receiver and supplied transaction', async () => {
  const f = fixture(), control = f.construct(undefined, false, false, false, false);
  const source = f.one('RelayAssignmentSource').args[0];
  assert.equal(source.assignments(f.tx, 'node', true), f.token);
  assert.deepEqual(f.calls.pop(), { owner: control.relay, name: 'RelayCoordinator.assignments', args: [f.tx, 'node', true] });
  const origin = f.one('IngressMigrations').args[6];
  for (const kind of ['deployment', 'migration', 'other']) {
    const ref = { kind, id: 'original' }, owner = kind === 'deployment' ? control.ingressDeployments : control.ingressMigrations;
    assert.equal(origin.resolveIn(f.tx, 'actor', 'scope', ref), f.token);
    assert.deepEqual(f.calls.pop(), { owner, name: `${owner.name}.originIn`, args: [f.tx, 'actor', 'scope', ref] });
  }
});

test('208 shared execution callbacks retain exact path/direct routing and propagate owner failures without advancing', async () => {
  const f = fixture(), control = f.construct(undefined, false, false, false, false), execution = f.one('ForwardCommandExecutor').args[3];
  assert.equal(f.one('ProfileGrantReconciler').args[1], execution);
  const direct = { scopeId: 'scope', spec: {} }, path = { scopeId: 'scope', spec: { path: {} } };
  for (const forward of [direct, path]) {
    const start = f.calls.length; await execution.lock(f.tx, forward); await execution.allowed(f.tx, 'actor', forward); await execution.transition(f.tx, 'actor', forward);
    assert.deepEqual(f.calls.slice(start).map(call => call.name), ['RelayCoordinator.lockNodes', forward === path ? 'RelayCoordinator.canExecute' : 'Nodes.canExecute', forward === path ? 'RelayCoordinator.acceptPlan' : 'RuntimeLedger.transition']);
    for (const call of f.calls.slice(start)) assert.equal(call.args[0], f.tx);
  }
  assert.equal(execution.accept(f.tx, direct, 'request', 'delete'), f.token);
  assert.deepEqual(f.calls.at(-1), { owner: control.ledger, name: 'RuntimeLedger.accept', args: [f.tx, direct, 'request', 'delete'] });
  const failure = new Error('original execution failure');
  for (const [action, method] of [
    [() => execution.lock(f.tx, path), 'RelayCoordinator.lockNodes'], [() => execution.allowed(f.tx, 'actor', path), 'RelayCoordinator.canExecute'],
    [() => execution.allowed(f.tx, 'actor', direct), 'Nodes.canExecute'], [() => execution.transition(f.tx, 'actor', path), 'RelayCoordinator.acceptPlan'],
    [() => execution.transition(f.tx, 'actor', direct), 'RuntimeLedger.transition'],
  ] as const) {
    f.handlers.set(method, () => { throw failure; }); const offset = f.calls.length;
    await assert.rejects(action(), error => error === failure); assert.equal(f.calls.length, offset + 1); f.handlers.delete(method);
  }
  const relay = f.one('ForwardCommandExecutor').args[2];
  assert.equal(relay.lockNodes(f.tx, path), f.token); assert.equal(relay.canExecute(f.tx, 'actor', path), f.token);
  assert.equal(await relay.acceptPlan(f.tx, 'actor', path), undefined, 'async adapter intentionally discards native return');
});

test('208 restoration reads current Path then group and refuses authorization before unrelated effects', async () => {
  const f = fixture(), control = f.construct(undefined, false, false, false, false), callback = f.one('ForwardCommands').args[10], forward = { spec: {} };
  const path = {}, group = {}; f.handlers.set('PathBindings.currentIn', () => path); f.handlers.set('PathGroups.currentIn', () => group);
  const found = await callback.current(f.tx, forward); assert.equal(found.path, path); assert.equal(found.group, group);
  assert.deepEqual(f.calls.map(call => call.name), ['PathBindings.currentIn', 'PathGroups.currentIn']);
  assert.equal(callback.detachPath(f.tx, forward), f.token); assert.equal(f.calls.at(-1)!.owner, control.pathBindings);
  f.handlers.set('Nodes.canExecute', () => false);
  await assert.rejects(callback.authorizeRestoration(f.tx, 'actor', forward), { code: 'AUTHORIZATION_DENIED', status: 403, message: 'Original restoration path is no longer authorized' });
  f.handlers.set('Nodes.canExecute', () => true); assert.equal(await callback.authorizeRestoration(f.tx, 'actor', forward), undefined);
  const failure = new Error('path read failure'); f.handlers.set('PathBindings.currentIn', () => { throw failure; }); const offset = f.calls.length;
  await assert.rejects(callback.current(f.tx, forward), error => error === failure); assert.equal(f.calls.length, offset + 1);
});

test('208 capacity retains sequential Node cleanup and same-Tx supplied Forward owner and stops after each rejection', async () => {
  const f = fixture(), control = f.construct(undefined, false, false, false, false), execution = f.one('ForwardCommandExecutor').args[3];
  const forward = { scopeId: 'scope', spec: {} }, facts = new Map([['z', {}], ['a', {}]]);
  f.handlers.set('RelayCoordinator.nodeIDs', () => ['z', 'a']); f.handlers.set('Nodes.cleanupFacts', (_tx, node) => facts.get(node));
  await execution.assertCapacity(f.tx, forward);
  assert.deepEqual(f.calls.map(call => call.name), ['RelayCoordinator.nodeIDs', 'Nodes.cleanupFacts', 'RuntimeLedger.assertCapacity', 'Nodes.cleanupFacts', 'RuntimeLedger.assertCapacity']);
  assert.deepEqual(f.calls[1]!.args, [f.tx, 'z', 'scope']); assert.deepEqual(f.calls[3]!.args, [f.tx, 'a', 'scope']);
  assert.deepEqual(f.calls[2]!.args, [f.tx, control.forwarding, facts.get('z')]); assert.deepEqual(f.calls[4]!.args, [f.tx, control.forwarding, facts.get('a')]);
  const failure = new Error('capacity owner failure');
  for (const method of ['RelayCoordinator.nodeIDs', 'Nodes.cleanupFacts', 'RuntimeLedger.assertCapacity']) {
    const original = f.handlers.get(method); f.handlers.set(method, () => { throw failure; }); const offset = f.calls.length;
    await assert.rejects(execution.assertCapacity(f.tx, forward), error => error === failure);
    assert.equal(f.calls.at(-1)!.name, method); assert.ok(f.calls.length - offset <= 3); if (original) f.handlers.set(method, original); else f.handlers.delete(method);
  }
  const access = f.one('AccessChangeReconciler').args[1], node = f.one('NodeChangeReconciler').args[1];
  for (const callbacks of [access, node]) {
    assert.equal(callbacks.lock, execution.lock); assert.equal(callbacks.allowed, execution.allowed); assert.equal(callbacks.transition, execution.transition);
    assert.equal(callbacks.accept, execution.accept); assert.equal(callbacks.assertCapacity, execution.assertCapacity);
    assert.deepEqual(callbacks.nodeIDs(f.tx, forward), ['z', 'a']);
    assert.equal(callbacks.maximumAuthorization(f.tx, 'node'), f.token);
  }
  let offset = f.calls.length; await access.validateNode(f.tx, 'z', 'scope', false); assert.deepEqual(f.calls.slice(offset).map(call => call.name), ['Nodes.cleanupFacts']);
  offset = f.calls.length; await access.validateNode(f.tx, 'a', 'scope', true); assert.deepEqual(f.calls.slice(offset).map(call => call.name), ['Nodes.cleanupFacts', 'RuntimeLedger.assertCapacity']);
  assert.equal(node.denyIntent(f.tx, 'operation'), f.token); assert.equal(node.assertNodeCapacity(f.tx, facts.get('a')), f.token);
});

test('206 original command delegates retain owner receiver arguments return identity and request wrapper function identity', async () => {
  const f = fixture(), control = f.construct(undefined, false, false, false, false), args = ['actor', 'scope', 'id', 'key', 3, { original: true }, true];
  for (const [name, ownerName, method, length] of [
    ['planRelay', 'RelayPlans', 'planRelay', 3], ['create', 'ForwardCommands', 'create', 4], ['update', 'ForwardCommands', 'update', 6],
    ['remove', 'ForwardCommands', 'remove', 5], ['retry', 'ForwardCommands', 'retry', 5], ['changeNode', 'NodeManagementCommands', 'change', 5],
    ['changeMember', 'AccessCommands', 'changeMember', 5], ['changeNodeGrant', 'AccessCommands', 'changeNodeGrant', 7],
  ] as const) {
    const supplied = args.slice(0, length);
    assert.equal(await control[name](...supplied), f.token);
    assert.deepEqual(f.calls.at(-1), { owner: f.one(ownerName), name: `${ownerName}.${method}`, args: name === 'changeNodeGrant' ? [...supplied, undefined, undefined] : supplied });
  }
  assert.equal(requestIdentity.name, 'requestIdentity'); assert.equal(requestIdentity.length, 6); assert.notEqual(requestIdentity, nativeCommandRequest);
  const input = { detached: true }, call = ['actor', 'scope', 'original-key', 'POST', '/forward', input] as const;
  assert.deepEqual(requestIdentity(...call), nativeCommandRequest(...call));
  for (const key of ['', undefined, 'original-key']) {
    try { requestIdentity('actor', 'scope', key, 'POST', '/forward', input); }
    catch (error) { assert.throws(() => nativeCommandRequest('actor', 'scope', key, 'POST', '/forward', input), expected => error instanceof Error && expected instanceof Error && expected.message === error.message); }
  }
});
