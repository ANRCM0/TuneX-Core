import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { Policy } from '@tunex/contracts/shared';
import { checkControlServerPreflight } from '../src/modules/control-startup-owner/public.ts';
import { nativeProtectedNotificationRoot } from '../src/compatibility/public.ts';
import { MySqlControlBootstrapStore } from '../src/infrastructure/mysql-control-bootstrap.ts';
import type { ServerOptions, startControl } from '../src/server.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type ExpectedOptions = {
  databaseUrl: string; caCert: string; caKey: string; serverCert: string; serverKey: string; openssl: string; stateDirectory: string; port: number;
  host?: string; worker?: boolean; credentialOverlapSeconds?: number; relayCredentialSeconds?: number; policy?: Policy;
  initializeAuthority?: boolean; multihopEnabled?: boolean; probeExecutionEnabled?: boolean; probeScheduleEnabled?: boolean; probeIngressEnabled?: boolean;
  probeServicesEnabled?: boolean; telemetryEnabled?: boolean; forwardTelemetryEnabled?: boolean; hostTelemetryEnabled?: boolean; probeTelemetryEnabled?: boolean;
  telemetryRollupsEnabled?: boolean; stationAlertsEnabled?: boolean; notificationSecretsDirectory?: string | undefined; webhookDeliveryEnabled?: boolean;
};
const originalOptions: Equal<ServerOptions, ExpectedOptions> = true;
const originalResultKeys: Equal<keyof Awaited<ReturnType<typeof startControl>>, 'port' | 'db' | 'control' | 'runtime' | 'authority' | 'close'> = true;

const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
const parsed = ts.createSourceFile('server.ts', source, ts.ScriptTarget.Latest, true);
const imports = new Map<string, string[]>();
for (const statement of parsed.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause && !statement.importClause.isTypeOnly) {
  const bindings = statement.importClause.namedBindings;
  assert.ok(bindings && ts.isNamedImports(bindings));
  const names = imports.get(statement.moduleSpecifier.text) ?? [];
  for (const entry of bindings.elements) if (!entry.isTypeOnly) names.push((entry.propertyName ?? entry.name).text);
  imports.set(statement.moduleSpecifier.text, names);
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

function fixture() {
  const events: string[] = [], argumentsByName = new Map<string, unknown[][]>(), instances = new Map<string, any>();
  const options: any = { databaseUrl: 'database', caCert: 'ca-cert', caKey: 'ca-key', serverCert: 'server-cert', serverKey: 'server-key',
    openssl: 'openssl', stateDirectory: 'authority-root', port: 41001 };
  const fault = { at: '', error: new Error('native failure'), obsolete: 0, nodes: 0, maintenance: false, close: new Set<string>() };
  const pending = new Map<string, Promise<void>>();
  const invoke = (name: string) => { events.push(name); if (fault.at === name) throw fault.error; };
  const close = async (name: string) => { invoke(name); await pending.get(name); if (fault.close.has(name)) throw new Error(name); };
  const tx = {}, result = {}, resources = {}, idempotency = {}, forwarding = {}, ledger = {}, relay = {};
  const callbackCalls: unknown[][] = [];
  const delegate = (name: string) => function(this: unknown, ...args: unknown[]) { callbackCalls.push([name, this, ...args]); return result; };
  const db: any = { async migrate() { invoke('migrate'); }, close: () => close('database-close'), pool: { async query(sql: string) {
    if (sql === "SELECT COUNT(*) n FROM snapshots WHERE JSON_EXTRACT(body,'$.protocolVersion') IS NULL OR JSON_EXTRACT(body,'$.protocolVersion')<>3") {
      invoke('obsolete-sql'); return [[{ n: fault.obsolete }]];
    }
    assert.equal(sql, "SELECT CONCAT(@@server_uuid,':',DATABASE()) name,(SELECT COUNT(*) FROM nodes) nodes");
    invoke('identity-sql'); return [[{ name: 'database-identity', nodes: fault.nodes }]];
  } } };
  const telemetryDb: any = { close: () => close('telemetry-close'), transaction: async (action: (value: unknown) => unknown) => { invoke('observation-transaction'); return action(tx); } };
  const authority = { async initialize(...args: unknown[]) { callbackCalls.push(['authority-initialize', ...args]); invoke('authority-initialize'); },
    async read() { invoke('authority-read'); return { database: 'bound-database', trustDigest: 'bound-trust', recoveryId: 'recovery', maintenance: fault.maintenance }; }, allow: delegate('allow') };
  const identity = { authenticateIn: delegate('authenticate') };
  const control = { idempotency, forwarding, ledger, relay, probes: { servicesEnabled: false, ingressEnabled: false, issueIn: delegate('issue') },
    probePlans: { authorize: delegate('authorize') } };
  const runtime = { tick: async () => { invoke('runtime-tick'); } };
  let declarations: any[], effects: unknown, appPorts: any, tlsOptions: any, listener: unknown, listenError: ((error: unknown) => void) | undefined;
  let acknowledgeListen: (() => void) | undefined, holdListen = false, boundPort = 45000;
  const tasks = { start: () => invoke('tasks-start'), stopAdmission: () => invoke('tasks-stop'), close: () => close('tasks-close') };
  const requests = { stopAdmission: () => invoke('requests-stop'), drain: () => close('requests-drain') };
  const secrets = { close: () => close('secrets-close') };
  const server = { once(name: string, action: (error: unknown) => void) { assert.equal(name, 'error'); invoke('server-once'); listenError = action; },
    listen(port: number, host: string, action: () => void) { callbackCalls.push(['listen', port, host]); invoke('server-listen'); acknowledgeListen = action; if (!holdListen) action(); },
    closeAllConnections: () => invoke('connections-close'), close(action: (error?: Error) => void) { invoke('server-close');
      const settle = () => action(fault.close.has('server-close') ? new Error('server-close') : undefined);
      if (pending.has('server-close')) void pending.get('server-close')!.then(settle); else settle(); },
    address() { invoke('server-address'); return { port: boundPort }; } };
  const bindings: Record<string, any> = {};
  const special: Record<string, any> = { MySqlUnitOfWork: db, MySqlTelemetryDatabase: telemetryDb, AuthorityStore: authority, Identity: identity,
    ControlApplication: control, RuntimeController: runtime, BackgroundTasks: tasks, RequestLifecycle: requests };
  for (const names of imports.values()) for (const name of names) {
    bindings[name] = class {
      constructor(...args: unknown[]) {
        invoke(`new:${name}`); const calls = argumentsByName.get(name) ?? []; calls.push(args); argumentsByName.set(name, calls);
        let instance: any = special[name];
        if (!instance) {
          instance = { enabled: args.find(value => typeof value === 'boolean') ?? false };
          if (name === 'NotificationDeliveries') { instance.enabled = (args[0] as any).enabled; instance.tick = async () => invoke('notification-tick'); instance.close = () => close('notification-worker-close'); }
          if (name === 'ProbePlans') { instance.scheduleEnabled = (args[0] as any).scheduleEnabled; instance.tick = async () => invoke('probe-tick'); instance.close = () => close('probe-worker-close'); }
          if (name === 'StationAlerts') { instance.tick = async () => invoke('station-tick'); }
          if (['NodeTelemetry', 'ForwardTelemetry', 'HostTelemetry', 'ProbeTelemetry', 'TelemetryRollups'].includes(name)) instance.prune = async () => invoke(`prune:${name}`);
          if (name === 'MySqlTelemetryStore') instance.node = delegate('node-source');
          if (name === 'MySqlForwardTelemetryStore') instance.forward = delegate('forward-source');
        }
        if (name === 'BackgroundTasks') { declarations = args[0] as any[]; effects = args[1]; }
        instances.set(name, instance); return instance;
      }
    };
  }
  Object.assign(bindings, {
    DEFAULT_POLICY, checkControlServerPreflight, MySqlControlBootstrapStore,
    nativeProtectedNotificationRoot: (value: unknown) => { assert.equal(value, options); invoke('notification-root'); return 'protected-secrets'; },
    FileNotificationSecrets: { async open(root: string) { assert.equal(root, 'protected-secrets'); invoke('secrets-open'); return secrets; } },
    async readFile(path: string) { invoke(`read:${path}`); return Buffer.from(path); },
    trustDigest(raw: Buffer) { invoke('trust-digest'); assert.equal(raw.toString(), 'ca-cert'); return 'trust'; },
    digest(value: unknown) { callbackCalls.push(['digest', value]); return 'binding'; },
    createMySqlRuntimeResources(limit: number) { invoke('resources'); callbackCalls.push(['resources', limit]); return resources; },
    createControlApp(value: unknown) { invoke('app'); appPorts = value; return { fetch: result }; },
    getRequestListener(fetch: unknown) { assert.equal(fetch, result); invoke('request-listener'); return listener = {}; },
    createServer(value: unknown, actual: unknown) { assert.equal(actual, listener); tlsOptions = value; invoke('https-create'); return server; },
    nativeBackgroundTaskEffects: {}, telemetryRollupStorageValues: {}, auditStoragePolicy: {}, stationAlertStorageValues: {}, stationAlertFactValues: {},
    notificationEndpointStorageValues: {}, notificationOutboxStorageValues: {}, probeRunStorageValues: {}, probePlanStorageValues: {}, observationServiceStorageValues: {},
  });
  const exports: any = {};
  const context = vm.createContext({ exports, Date, console: { error: (message: string) => events.push(`log:${message}`) },
    require(specifier: string) { const names = imports.get(specifier); assert.ok(names, `unexpected import ${specifier}`); return Object.fromEntries(names.map(name => [name, bindings[name]])); } });
  new vm.Script(javascript, { filename: 'current-server.cjs' }).runInContext(context);
  return { options, fault, events, pending, callbackCalls, argumentsByName, instances, bindings, tx, result, db, telemetryDb, authority, identity,
    control, runtime, resources, idempotency, requests, tasks, secrets, server,
    start: () => exports.startControl(options) as Promise<any>, declarations: () => declarations!, effects: () => effects, app: () => appPorts,
    tls: () => tlsOptions, holdListen: () => { holdListen = true; }, listen: () => acknowledgeListen!(), listenError: (error: unknown) => listenError!(error),
    setBoundPort: (port: number) => { boundPort = port; } };
}

test('159 server preflight preserves feature-first and native lifetime/default/getter behavior before any dependency', () => {
  for (const [change, message] of [
    [{ webhookDeliveryEnabled: true }, 'Webhook delivery requires protected notification storage'],
    [{ probeScheduleEnabled: true }, 'Probe schedule requires original Probe execution'],
    [{ probeIngressEnabled: true }, 'Ingress Probe requires original Probe execution'],
    [{ probeServicesEnabled: true }, 'Controlled service TLS Probe requires ingress and original Probe execution'],
    [{ probeExecutionEnabled: true }, 'Probe execution requires an explicitly configured one-second maximum clock skew'],
    [{ relayCredentialSeconds: 1 }, 'Relay credential lifetime must allow renewal before expiry and bounded overlap'],
  ] as const) {
    const f = fixture(); Object.assign(f.options, change);
    assert.throws(() => checkControlServerPreflight(f.options, DEFAULT_POLICY), { message }); assert.deepEqual(f.events, []);
  }
  const reads: string[] = [], values: any = { leaseSeconds: 10, maxClockSkewSeconds: 1, pollIntervalSeconds: 5 };
  const policy = new Proxy(values, { get(target, key) { reads.push(`policy:${String(key)}`); return target[key]; } });
  const supplied: any = { probeExecutionEnabled: true, policy, relayCredentialSeconds: 121, credentialOverlapSeconds: 0 };
  const traced = new Proxy(supplied, { get(target, key) { reads.push(String(key)); return target[key]; } });
  assert.equal(checkControlServerPreflight(traced, DEFAULT_POLICY), policy);
  assert.deepEqual(reads, ['webhookDeliveryEnabled', 'probeScheduleEnabled', 'probeIngressEnabled', 'probeServicesEnabled', 'probeExecutionEnabled',
    'policy', 'policy:maxClockSkewSeconds', 'policy', 'policy:leaseSeconds', 'policy:maxClockSkewSeconds', 'policy:pollIntervalSeconds', 'relayCredentialSeconds', 'credentialOverlapSeconds']);
  for (const lifetime of [0, -1, 119, 120.5, NaN, Infinity, 86401]) assert.throws(() => checkControlServerPreflight({ relayCredentialSeconds: lifetime }, DEFAULT_POLICY));
  assert.equal(checkControlServerPreflight({}, DEFAULT_POLICY), DEFAULT_POLICY);
});

test('159 server startup reads exact pool SQL, binds original resources and defers work until HTTPS listens', async () => {
  assert.equal(originalOptions, true); assert.equal(originalResultKeys, true);
  const f = fixture(); f.holdListen(); f.setBoundPort(45678);
  f.options.initializeAuthority = true; f.options.telemetryRollupsEnabled = true;
  const starting = f.start(); await flush();
  assert.equal(f.events.at(-1), 'server-listen'); assert.equal(f.events.includes('tasks-start'), false);
  assert.deepEqual(f.events.slice(0, 8), ['new:MySqlUnitOfWork', 'migrate', 'obsolete-sql', 'identity-sql', 'new:AuthorityStore', 'read:ca-cert', 'trust-digest', 'authority-initialize']);
  assert.deepEqual(f.callbackCalls.find(call => call[0] === 'authority-initialize'), ['authority-initialize', 'database-identity', 'trust', true]);
  assert.equal(f.db.guard(), f.result); assert.equal(f.telemetryDb.guard(), f.result);
  assert.deepEqual(f.callbackCalls.filter(call => call[0] === 'allow').map(call => call[1]), [f.authority, f.authority]);
  const args = (name: string) => f.argumentsByName.get(name)![0]!;
  assert.deepEqual(args('Nodes'), [f.db, f.identity, f.instances.get('NodeCertificateAuthority'), 120, 86400, f.resources]);
  assert.deepEqual(args('ControlApplication'), [f.db, f.identity, f.instances.get('Nodes'), undefined, false, false, false, false, f.resources]);
  assert.deepEqual(args('RuntimeController'), [f.db, f.instances.get('Nodes'), f.control.forwarding, f.control.ledger, undefined, f.authority, f.control.relay]);
  assert.equal(args('NodeTelemetry')[5], Date.now); assert.equal(args('ForwardTelemetry')[6], Date.now);
  assert.equal(args('HostTelemetry')[5], Date.now); assert.equal(args('ProbeTelemetry')[6], Date.now);
  for (const [name, index] of [['NodeTelemetry', 6], ['ForwardTelemetry', 7], ['HostTelemetry', 6], ['ProbeTelemetry', 7]] as const) assert.equal(args(name)[index], f.instances.get('MySqlTelemetryRollupStorage'));
  assert.deepEqual(Object.keys(f.app().services), ['telemetry', 'forwardTelemetry', 'authenticateObservation', 'hostTelemetry', 'probeTelemetry',
    'telemetryRollups', 'diagnostics', 'audit', 'stationAlerts', 'notificationEndpoints', 'notificationDeliveries', 'probeRuns', 'probePlans', 'observationServices']);
  assert.equal(f.app().requests, f.requests); assert.equal(f.effects(), f.bindings.nativeBackgroundTaskEffects);
  assert.deepEqual({ ...f.tls(), key: f.tls().key.toString(), cert: f.tls().cert.toString(), ca: f.tls().ca.toString() },
    { key: 'server-key', cert: 'server-cert', ca: 'ca-cert', requestCert: true, rejectUnauthorized: false, minVersion: 'TLSv1.3' });
  assert.deepEqual(f.events.slice(-6), ['read:server-key', 'read:server-cert', 'read:ca-cert', 'request-listener', 'https-create', 'server-once', 'server-listen'].slice(-6));
  f.listen(); const started = await starting;
  assert.equal(started.port, 45678); assert.equal(started.db, f.db); assert.equal(started.control, f.control); assert.equal(started.runtime, f.runtime); assert.equal(started.authority, f.authority);
  assert.deepEqual(Object.keys(started), ['port', 'db', 'control', 'runtime', 'authority', 'close']);
  assert.deepEqual(f.events.slice(-2), ['tasks-start', 'server-address']);
  await f.app().services.authenticateObservation('Bearer token');
  assert.deepEqual(f.callbackCalls.at(-1), ['authenticate', f.identity, f.tx, 'Bearer token']);
  const sources = args('TelemetryRollups')[3] as any;
  sources.node(f.tx, 'node'); sources.forward(f.tx, 'scope', 'forward');
  assert.deepEqual(f.callbackCalls.slice(-2), [['node-source', f.instances.get('MySqlTelemetryStore'), f.tx, 'node'], ['forward-source', f.instances.get('MySqlForwardTelemetryStore'), f.tx, 'scope', 'forward']]);
  const issuer = (args('ProbePlans')[0] as any).issuer;
  const config = { forwardId: 'forward', kind: 'tcp', expectedForwardRevision: 4, timeoutMs: 500, expiresAt: 'expiry', service: { id: 'service' } };
  issuer.previewIn(f.tx, 'actor', 'scope', config); issuer.issueIn(f.tx, 'actor', 'scope', config);
  assert.deepEqual(plain(f.callbackCalls.slice(-2).map(call => [call[0], ...call.slice(2)])), [
    ['authorize', f.tx, 'actor', 'scope', 'forward', { version: 1, kind: 'tcp', expectedRevision: 4, timeoutMs: 500, service: config.service }],
    ['issue', f.tx, 'actor', 'scope', 'forward', { version: 1, kind: 'tcp', expectedRevision: 4, timeoutMs: 500, service: config.service }, 'expiry'],
  ]);
  assert.equal(f.callbackCalls.at(-2)![1], f.control.probePlans); assert.equal(f.callbackCalls.at(-1)![1], f.control.probes);
  await (args('NotificationDeliveries')[0] as any).authorityBinding();
  assert.deepEqual(plain(f.callbackCalls.at(-1)), ['digest', { database: 'bound-database', trustDigest: 'bound-trust', recoveryId: 'recovery' }]);
  await started.close();
});

test('121/159 five original worker declarations retain feature flags, maintenance guard, serial retention and stop hooks', async () => {
  const f = fixture(); Object.assign(f.options, { stationAlertsEnabled: true, webhookDeliveryEnabled: true, notificationSecretsDirectory: 'configured',
    probeExecutionEnabled: true, probeScheduleEnabled: true, policy: { ...DEFAULT_POLICY, maxClockSkewSeconds: 1 } });
  const started = await f.start(), tasks = f.declarations();
  assert.deepEqual(Array.from(tasks, task => [task.id, task.intervalMs, task.enabled]), [
    ['runtime', 250, true], ['telemetry-retention', 30000, true], ['station-alerts', 5000, true], ['notification-delivery', 1000, true], ['probe-plans', 1000, true],
  ]);
  assert.equal(tasks[2].failureDelay, tasks[3].failureDelay); assert.equal(tasks[3].failureDelay, tasks[4].failureDelay);
  assert.deepEqual({ ...tasks[2].failureDelay }, { initialMs: 30000, maxMs: 300000 });
  f.fault.maintenance = true; let offset = f.events.length; await tasks[0].run(); assert.deepEqual(f.events.slice(offset), ['authority-read']);
  f.fault.maintenance = false; offset = f.events.length; await tasks[0].run(); assert.deepEqual(f.events.slice(offset), ['authority-read', 'runtime-tick']);
  for (const failure of ['', 'prune:NodeTelemetry', 'prune:HostTelemetry']) {
    f.fault.at = failure; offset = f.events.length;
    if (failure) await assert.rejects(tasks[1].run(), { message: 'Telemetry retention deferred' }); else await tasks[1].run();
    assert.deepEqual(f.events.slice(offset), ['prune:NodeTelemetry', 'prune:ForwardTelemetry', 'prune:HostTelemetry', 'prune:ProbeTelemetry', 'prune:TelemetryRollups']);
  }
  f.fault.at = ''; await tasks[2].run(); await tasks[3].run(); await tasks[4].run(); await tasks[3].onStop(); await tasks[4].onStop();
  assert.deepEqual(f.events.slice(-5), ['station-tick', 'notification-tick', 'probe-tick', 'notification-worker-close', 'probe-worker-close']);
  for (const task of tasks) task.onFailure();
  assert.deepEqual(f.events.slice(-5), ['log:Runtime tick failed', 'log:Telemetry retention deferred', 'log:Station alert observation deferred', 'log:Notification delivery deferred', 'log:Probe plan schedule deferred']);
  await started.close();
  const disabled = fixture(); disabled.options.worker = false; const quiet = await disabled.start();
  assert.equal(disabled.declarations().every(task => task.enabled === false), true); await quiet.close();
});

test('159 early failure and protected store-open retain original partial-start cleanup and exact error identity', async () => {
  for (const failure of ['migrate', 'obsolete-sql', 'identity-sql', 'authority-initialize', 'notification-root', 'secrets-open']) {
    const f = fixture(); f.fault.at = failure;
    if (failure === 'notification-root' || failure === 'secrets-open') f.options.notificationSecretsDirectory = 'configured';
    await assert.rejects(f.start(), error => error === f.fault.error);
    const closes = f.events.filter(event => event.endsWith('-close'));
    assert.deepEqual(closes, failure === 'authority-initialize' ? ['database-close'] : ['notification-root', 'secrets-open'].includes(failure) ? ['telemetry-close', 'database-close'] : []);
    assert.equal(f.events.includes('https-create'), false); assert.equal(f.events.includes('tasks-start'), false);
  }
  const obsolete = fixture(); obsolete.fault.obsolete = 1;
  await assert.rejects(obsolete.start(), /ADP\/2 persisted history is unsupported/);
  assert.deepEqual(obsolete.events, ['new:MySqlUnitOfWork', 'migrate', 'obsolete-sql', 'database-close']);
  for (const nodes of [0, 1, '0']) {
    const f = fixture(); f.options.initializeAuthority = true; f.fault.nodes = nodes as number;
    const started = await f.start(); assert.equal(f.callbackCalls.find(call => call[0] === 'authority-initialize')![3], nodes === 0); await started.close();
  }
});

test('159 HTTPS partial failures drain all admitted owners before closing dependencies and retain first startup error', async () => {
  for (const failure of ['read:server-key', 'read:server-cert', 'https-create', 'server-listen', 'listen-event']) {
    const f = fixture(); if (failure === 'listen-event') f.holdListen(); else f.fault.at = failure;
    f.options.notificationSecretsDirectory = 'configured'; f.fault.close.add('tasks-close'); f.fault.close.add('telemetry-close');
    let release!: () => void; f.pending.set('requests-drain', new Promise<void>(resolve => { release = resolve; }));
    const starting = f.start(); await flush();
    if (failure === 'listen-event') { f.listenError(f.fault.error); await flush(); }
    assert.equal(f.events.includes('requests-stop'), true); assert.equal(f.events.includes('requests-drain'), true);
    assert.equal(f.events.includes('database-close'), false); assert.equal(f.events.includes('tasks-start'), false);
    release(); await assert.rejects(starting, error => error === f.fault.error);
    assert.deepEqual(f.events.filter(event => ['requests-stop', 'tasks-close', 'requests-drain', 'secrets-close', 'telemetry-close', 'database-close'].includes(event)),
      ['requests-stop', 'tasks-close', 'requests-drain', 'secrets-close', 'telemetry-close', 'database-close']);
  }
});

test('159 close returns one promise and joins tasks requests server then every dependency even after a failure', async () => {
  for (const failure of ['', 'tasks-close', 'requests-drain', 'server-close', 'secrets-close', 'telemetry-close', 'database-close']) {
    const f = fixture(); f.options.notificationSecretsDirectory = 'configured'; const started = await f.start();
    let release!: () => void; f.pending.set('server-close', new Promise<void>(resolve => { release = resolve; }));
    if (failure) f.fault.close.add(failure);
    const offset = f.events.length, closing = started.close(); assert.equal(started.close(), closing);
    await flush(); assert.deepEqual(f.events.slice(offset), ['requests-stop', 'tasks-stop', 'connections-close', 'tasks-close', 'requests-drain', 'server-close']);
    release(); if (failure) await assert.rejects(closing, { message: 'Control shutdown failed after draining' }); else await closing;
    assert.deepEqual(f.events.slice(offset), ['requests-stop', 'tasks-stop', 'connections-close', 'tasks-close', 'requests-drain', 'server-close', 'secrets-close', 'telemetry-close', 'database-close']);
    assert.equal(started.close(), closing);
  }
});

test('159 native protected notification root preserves exact absolute and ancestor exclusion without touching files', () => {
  const base = resolve('test-protected-paths'), root = resolve(base, 'secrets');
  const value = { notificationSecretsDirectory: root, stateDirectory: resolve(base, 'authority'), caCert: resolve(base, 'ca', 'cert'), caKey: resolve(base, 'ca', 'key'),
    serverCert: resolve(base, 'server', 'cert'), serverKey: resolve(base, 'server', 'key') };
  assert.equal(nativeProtectedNotificationRoot(value), root);
  const reads: string[] = [];
  assert.equal(nativeProtectedNotificationRoot(new Proxy(value, { get(target, key) { reads.push(String(key)); return Reflect.get(target, key); } })), root);
  assert.deepEqual(reads, ['notificationSecretsDirectory', 'notificationSecretsDirectory', 'notificationSecretsDirectory', 'stateDirectory', 'caCert', 'caKey', 'serverCert', 'serverKey']);
  for (const change of [{ notificationSecretsDirectory: 'relative' }, { notificationSecretsDirectory: `${root}/..` },
    { notificationSecretsDirectory: base }, { stateDirectory: root }, { stateDirectory: resolve(root, 'nested') }, { caCert: resolve(root, 'cert') }]) {
    assert.throws(() => nativeProtectedNotificationRoot({ ...value, ...change }), { code: 'NOTIFICATION_SECRETS_UNAVAILABLE', status: 503, message: 'Independent protected notification directory required' });
  }
});

test('159 early cleanup remains sequential and retains its original close-error precedence', async () => {
  for (const early of ['authority-initialize', 'secrets-open']) {
    const f = fixture(); f.fault.at = early; f.options.notificationSecretsDirectory = 'configured';
    const closeName = early === 'authority-initialize' ? 'database-close' : 'telemetry-close';
    f.fault.close.add(closeName);
    await assert.rejects(f.start(), { message: closeName });
    assert.deepEqual(f.events.filter(event => event.endsWith('-close')), [closeName]);
    assert.equal(f.events.includes('https-create'), false);
  }
});

test('159 all original option reads remain lazy repeated and ordered across assembly with exact optional feature arguments', async () => {
  const f = fixture(), reads: string[] = [];
  const keys = ['databaseUrl', 'caCert', 'caKey', 'serverCert', 'serverKey', 'openssl', 'stateDirectory', 'port', 'host', 'worker',
    'credentialOverlapSeconds', 'relayCredentialSeconds', 'policy', 'initializeAuthority', 'multihopEnabled', 'probeExecutionEnabled',
    'probeScheduleEnabled', 'probeIngressEnabled', 'probeServicesEnabled', 'telemetryEnabled', 'forwardTelemetryEnabled', 'hostTelemetryEnabled',
    'probeTelemetryEnabled', 'telemetryRollupsEnabled', 'stationAlertsEnabled', 'notificationSecretsDirectory', 'webhookDeliveryEnabled'];
  for (const key of keys) {
    let value = f.options[key]; Object.defineProperty(f.options, key, { enumerable: true, configurable: true,
      get() { reads.push(key); return value; }, set(next) { value = next; } });
  }
  const started = await f.start();
  assert.deepEqual(reads, [
    'webhookDeliveryEnabled', 'probeScheduleEnabled', 'probeIngressEnabled', 'probeServicesEnabled', 'probeExecutionEnabled', 'policy', 'relayCredentialSeconds', 'credentialOverlapSeconds',
    'databaseUrl', 'stateDirectory', 'caCert', 'initializeAuthority', 'openssl', 'caCert', 'caKey', 'stateDirectory',
    'credentialOverlapSeconds', 'relayCredentialSeconds', 'policy', 'multihopEnabled', 'probeExecutionEnabled', 'probeIngressEnabled', 'probeServicesEnabled',
    'databaseUrl', 'telemetryRollupsEnabled', 'telemetryEnabled', 'forwardTelemetryEnabled', 'hostTelemetryEnabled', 'probeTelemetryEnabled', 'telemetryRollupsEnabled',
    'probeExecutionEnabled', 'probeScheduleEnabled', 'notificationSecretsDirectory', 'webhookDeliveryEnabled', 'stationAlertsEnabled', 'policy', 'worker',
    'serverKey', 'serverCert', 'caCert', 'port', 'host',
  ]);
  await started.close();
  const enabled = fixture(); Object.assign(enabled.options, { host: '', credentialOverlapSeconds: 0, relayCredentialSeconds: 3600,
    policy: { ...DEFAULT_POLICY, maxClockSkewSeconds: 1 }, multihopEnabled: true, probeExecutionEnabled: true, probeScheduleEnabled: true,
    probeIngressEnabled: true, probeServicesEnabled: true, telemetryEnabled: true, forwardTelemetryEnabled: true, hostTelemetryEnabled: true,
    probeTelemetryEnabled: true, telemetryRollupsEnabled: true, stationAlertsEnabled: true, webhookDeliveryEnabled: true, notificationSecretsDirectory: 'configured' });
  enabled.control.probes.ingressEnabled = true as never; enabled.control.probes.servicesEnabled = true as never;
  const active = await enabled.start(), args = (name: string) => enabled.argumentsByName.get(name)![0]!;
  assert.deepEqual(args('Nodes').slice(3), [0, 3600, enabled.resources]);
  assert.deepEqual(args('ControlApplication').slice(3), [enabled.options.policy, true, true, true, true, enabled.resources]);
  assert.equal(args('NodeTelemetry')[4], true); assert.equal(args('ForwardTelemetry')[5], true);
  assert.equal(args('HostTelemetry')[4], true); assert.equal(args('ProbeTelemetry')[5], true);
  assert.equal(args('TelemetryRollups')[4], true); assert.equal(args('StationAlerts')[5], true);
  const plans = args('ProbePlans')[0] as any;
  assert.deepEqual([plans.executionEnabled, plans.scheduleEnabled, plans.ingressExecutionEnabled, plans.servicesExecutionEnabled, plans.clockSkewMs], [true, true, true, true, 1000]);
  const delivery = args('NotificationDeliveries')[0] as any;
  assert.equal(delivery.enabled, true); assert.equal(delivery.secrets, enabled.secrets); assert.equal(delivery.clockSkewMs, 1000);
  assert.equal(args('NotificationEndpoints')[8], true);
  assert.deepEqual(enabled.callbackCalls.find(call => call[0] === 'listen'), ['listen', 41001, '']);
  await active.close();
});
