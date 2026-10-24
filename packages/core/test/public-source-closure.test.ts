import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import type * as domain from '@tunex/core';
import * as framework from '../../../apps/control/src/framework/public.ts';
import type * as common from '@tunex/contracts/execution-values';
import type * as observations from '@tunex/contracts/execution-observation';
import type * as native from '@tunex/contracts/runtime';
import type { NativeRuntimeFamily } from '../../../apps/control/src/compatibility/public.ts';
import type * as legacy from '@tunex/contracts/legacy/adp2';
import { parseMessage as legacyParse } from '@tunex/contracts/legacy/adp2';
import { parseRuntimeMessage } from '@tunex/contracts/runtime';
import { runtimeCodec } from '../../../apps/control/src/compatibility/runtime-codec.ts';
import { parseMessage as rootParse } from '@tunex/contracts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Same<T extends true> = T;
type Flat<T> = { [K in keyof T]: T[K] };
type ExpectedSpec = {
    readonly enabled: boolean; readonly protocols: readonly ('tcp' | 'udp')[];
    readonly ingress: { readonly nodeId: string; readonly listen: { readonly address: string; readonly port: number } };
    readonly target: { readonly host: string; readonly port: number };
    readonly path?: { readonly via: readonly string[] };
    readonly transport?: { readonly profileId: string; readonly configRevision: number };
};
type ExpectedObservation = { assignmentId: string; deploymentGeneration: number; bindingFence: number;
    phase: 'prepared' | 'active' | 'draining' | 'absent'; condition: 'pending' | 'prepared' | 'ready' | 'degraded' | 'error' | 'draining' | 'removed';
    errorCode: string | null; retryable: boolean };
type ExpectedDrain = { assignmentId: string; deploymentGeneration: number; bindingFence: number; startedAt: string;
    deadline: string; remainingConnections: number; condition: 'draining' | 'removed' };
export type ProtectedDomainAndContractShapes = [
    Same<Equal<domain.NodeId, string>>, Same<Equal<domain.ForwardId, string>>, Same<Equal<domain.ScopeId, string>>,
    Same<Equal<domain.Revision, number>>, Same<Equal<domain.CapabilityId, string>>, Same<Equal<domain.NetworkProtocol, 'tcp' | 'udp'>>,
    Same<Equal<domain.Node, { readonly id: string; readonly scopeId: string; readonly revision: number }>>,
    Same<Equal<domain.ListenEndpoint, { readonly address: string; readonly port: number }>>,
    Same<Equal<domain.TargetEndpoint, { readonly host: string; readonly port: number }>>,
    Same<Equal<domain.PathSpec, { readonly via: readonly string[] }>>,
    Same<Equal<domain.TransportRef, { readonly profileId: string; readonly configRevision: number }>>,
    Same<Equal<domain.ForwardSpec, ExpectedSpec>>,
    Same<Equal<domain.Forward, { readonly id: string; readonly scopeId: string; readonly revision: number; readonly spec: ExpectedSpec }>>,
    Same<Equal<domain.ForwardChange, { readonly kind: 'replace'; readonly spec: unknown } | { readonly kind: 'set-enabled'; readonly enabled: boolean }>>,
    Same<Equal<domain.Issue, { readonly code: string; readonly path: string; readonly message: string }>>,
    Same<Equal<domain.Result<ExpectedSpec>, { readonly ok: true; readonly value: ExpectedSpec } |
        { readonly ok: false; readonly errors: readonly domain.Issue[] }>>,
    Same<Equal<domain.ValidationResult, domain.Result<ExpectedSpec>>>,
    Same<Equal<observations.Observation, ExpectedObservation>>, Same<Equal<observations.Drain, ExpectedDrain>>,
    Same<Equal<legacy.Observation, observations.Observation>>, Same<Equal<legacy.Drain, observations.Drain>>,
    Same<Equal<native.Observation, observations.Observation>>, Same<Equal<native.Drain, observations.Drain>>,
    Same<Equal<Flat<common.RuntimeAssignmentFor<NativeRuntimeFamily>>, Flat<native.RuntimeAssignment>>>,
    Same<Equal<Flat<common.RuntimeSnapshotFor<NativeRuntimeFamily>>, Flat<native.RuntimeSnapshot>>>,
    Same<Equal<Flat<common.RuntimeMessagesFor<NativeRuntimeFamily>['HelloRequest']>, Flat<native.RuntimeMessages['HelloRequest']>>>,
    Same<Equal<Flat<common.RuntimeMessagesFor<NativeRuntimeFamily>['HelloResponse']>, Flat<native.RuntimeMessages['HelloResponse']>>>,
    Same<Equal<Flat<common.RuntimeMessagesFor<NativeRuntimeFamily>['ReportRequest']>, Flat<native.RuntimeMessages['ReportRequest']>>>,
    Same<Equal<Flat<common.RuntimeMessagesFor<NativeRuntimeFamily>['ReportAck']>, Flat<native.RuntimeMessages['ReportAck']>>>,
    Same<Equal<common.RuntimeAssignmentFor['driver'], common.RuntimeDriverValue>>,
    Same<Equal<NativeRuntimeFamily['relayProfile'], native.RelayProfileConfig>>,
    Same<Equal<common.RuntimeValueFamily['relayProfile'], unknown>>,
    Same<Equal<NonNullable<common.RuntimeSnapshotValue['resourceLimits']>,NonNullable<native.RuntimeSnapshot['resourceLimits']>>>,
    Same<Equal<framework.RuntimeHostOptions<unknown>['payloadPolicy'],framework.RuntimePayloadPolicy<unknown>>>,
    Same<Equal<{} extends Pick<framework.RuntimeHostOptions<unknown>,'payloadPolicy'>?true:false,false>>,
];

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
function leaves(path: string): string[] {
    return readdirSync(new URL(path + '/', root), { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? leaves(path + '/' + entry.name) : [path + '/' + entry.name]);
}

test('protected Core has exactly four implementation files one package entry complete public names and no private ipv4Bytes subpath', async () => {
    assert.deepEqual(readdirSync(new URL('packages/core/src/', root)).sort(), ['forward.ts', 'index.ts', 'primitives.ts', 'types.ts']);
    const manifest = JSON.parse(read('packages/core/package.json'));
    assert.equal(manifest.name, '@tunex/core'); assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.exports, './src/index.ts'); assert.equal(manifest.type, 'module');
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.deepEqual(Object.keys(core).sort(), ['MAX_COUNTER', 'decideForwardChange', 'deepFreeze', 'ipBytes', 'isCounter', 'isId',
        'isPort', 'normalizeIp', 'normalizeTargetHost', 'parseForward', 'parseForwardSpec', 'parseNode', 'validateForwardSpec'].sort());
    assert.equal(core.MAX_COUNTER, 9007199254740991);
    assert.equal(Object.hasOwn(core, 'ipv4Bytes'), false);
    for (const path of ['primitives', 'ipv4Bytes', 'src/primitives.ts', 'src/forward.ts', 'src/types.ts', 'src/index.ts'])
        await assert.rejects(import('@tunex/core/' + path), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }, path);
    const expectedTypes = ['NodeId', 'ForwardId', 'ScopeId', 'Revision', 'CapabilityId', 'NetworkProtocol', 'Node', 'ListenEndpoint',
        'TargetEndpoint', 'PathSpec', 'TransportRef', 'ForwardSpec', 'Forward', 'ForwardChange', 'Issue', 'Result', 'ValidationResult'];
    const source = ts.createSourceFile('types.ts', read('packages/core/src/types.ts'), ts.ScriptTarget.Latest, true);
    const exportedTypes = source.statements.flatMap(statement =>
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ? [statement.name.text] : []);
    assert.deepEqual(exportedTypes, expectedTypes, 'every public type is checked above, including generic/readonly contracts');
});

// Independent declaration table from the public candidate index. Each number is
// pinned separately, including ports whose version differs from its aggregate.
const controlCounters = `
kernel/public RUNTIME_KERNEL_INTERFACE_VERSION 1
framework/public FRAMEWORK_INTERFACE_VERSION 1
framework/background-tasks BACKGROUND_TASKS_INTERFACE_VERSION 2
framework/cancellation-ports CANCELLATION_INTERFACE_VERSION 1
framework/forward-diagnostic-store-ports FORWARD_DIAGNOSTIC_STORAGE_INTERFACE_VERSION 1
framework/identity-access-ports IDENTITY_ACCESS_INTERFACE_VERSION 2
framework/ingress-deployment-storage-ports INGRESS_DEPLOYMENT_STORAGE_INTERFACE_VERSION 2
framework/ingress-group-storage-ports INGRESS_GROUP_STORAGE_INTERFACE_VERSION 2
framework/ingress-migration-storage-ports INGRESS_MIGRATION_STORAGE_INTERFACE_VERSION 2
framework/intent-store-ports INTENT_STORAGE_INTERFACE_VERSION 2
framework/machine-session-lock-ports MACHINE_SESSION_LOCK_INTERFACE_VERSION 1
framework/management-read-ports MANAGEMENT_READ_INTERFACE_VERSION 2
framework/node-authority-ports NODE_AUTHORITY_INTERFACE_VERSION 5
framework/node-report-read-ports NODE_REPORT_READ_INTERFACE_VERSION 2
framework/notification-effects-ports NOTIFICATION_EFFECTS_INTERFACE_VERSION 2
framework/notification-store-ports NOTIFICATION_STORAGE_INTERFACE_VERSION 1
framework/observation-read-store-ports OBSERVATION_READ_STORAGE_INTERFACE_VERSION 1
framework/observation-recovery-storage-ports OBSERVATION_RECOVERY_STORAGE_INTERFACE_VERSION 1
framework/path-binding-storage-ports PATH_BINDING_STORAGE_INTERFACE_VERSION 2
framework/path-group-storage-ports PATH_GROUP_STORAGE_INTERFACE_VERSION 2
framework/path-publication-storage-ports PATH_PUBLICATION_STORAGE_INTERFACE_VERSION 2
framework/path-template-storage-ports PATH_TEMPLATE_STORAGE_INTERFACE_VERSION 2
framework/probe-history-store-ports PROBE_HISTORY_STORAGE_INTERFACE_VERSION 2
framework/probe-permit-storage-ports PROBE_PERMIT_STORAGE_INTERFACE_VERSION 1
framework/probe-permit-storage-ports PROBE_PERMIT_OBSERVATION_INTERFACE_VERSION 1
framework/probe-registration-store-ports PROBE_REGISTRATION_STORAGE_INTERFACE_VERSION 1
framework/publication-recovery-storage-ports PUBLICATION_RECOVERY_STORAGE_INTERFACE_VERSION 1
framework/recovery-event-storage-ports RECOVERY_EVENT_STORAGE_INTERFACE_VERSION 1
framework/resource-access-ports RESOURCE_ACCESS_INTERFACE_VERSION 1
framework/runtime-port-policy-ports RUNTIME_PORT_POLICY_INTERFACE_VERSION 1
framework/relay-configuration-ports RELAY_CONFIGURATION_INTERFACE_VERSION 2
framework/runtime-evidence-read-ports RUNTIME_EVIDENCE_READ_INTERFACE_VERSION 2
framework/runtime-exclusive-reservation-ports RUNTIME_EXCLUSIVE_RESERVATION_INTERFACE_VERSION 2
framework/runtime-host-ports RUNTIME_HOST_INTERFACE_VERSION 4
framework/runtime-ledger-ports RUNTIME_LEDGER_INTERFACE_VERSION 3
framework/runtime-relay-ports RUNTIME_RELAY_INTERFACE_VERSION 7
framework/runtime-relay-ports RELAY_PROGRESS_INTERFACE_VERSION 1
framework/runtime-assignment-ports RELAY_FORWARD_ASSIGNMENTS_INTERFACE_VERSION 1
framework/runtime-assignment-ports RELAY_NODE_ASSIGNMENTS_INTERFACE_VERSION 1
framework/runtime-reservation-release-ports RUNTIME_RESERVATION_RELEASE_INTERFACE_VERSION 1
framework/runtime-resource-ports RUNTIME_RESOURCE_INTERFACE_VERSION 2
framework/resource-limit-ports RESOURCE_LIMIT_INTERFACE_VERSION 1
framework/runtime-status-storage-ports RUNTIME_STATUS_STORAGE_INTERFACE_VERSION 1
framework/station-alert-store-ports STATION_ALERT_STORAGE_INTERFACE_VERSION 1
framework/telemetry-rollup-store-ports TELEMETRY_ROLLUP_STORAGE_INTERFACE_VERSION 1
framework/telemetry-store-ports TELEMETRY_STORAGE_INTERFACE_VERSION 1
framework/transit-coordination-storage-ports TRANSIT_COORDINATION_STORAGE_INTERFACE_VERSION 1
framework/transit-delivery-storage-ports TRANSIT_DELIVERY_STORAGE_INTERFACE_VERSION 1
framework/transit-staging-storage-ports TRANSIT_STAGING_STORAGE_INTERFACE_VERSION 1
compatibility/public COMPATIBILITY_INTERFACE_VERSION 1
compatibility/native-control-bootstrap-command CONTROL_BOOTSTRAP_NATIVE_INTERFACE_VERSION 1
compatibility/native-operator-command OPERATOR_COMMAND_NATIVE_INTERFACE_VERSION 1
compatibility/native-recovery RECOVERY_NATIVE_INTERFACE_VERSION 1
api/public CONTROL_HTTP_INTERFACE_VERSION 6
application/management-read-models MANAGEMENT_READ_MODEL_INTERFACE_VERSION 1
modules/audit-owner/api AUDIT_API_INTERFACE_VERSION 2
modules/audit-owner/public AUDIT_MODULE_INTERFACE_VERSION 1
modules/console-query-owner/contracts CONSOLE_QUERY_INTERFACE_VERSION 2
modules/control-bootstrap-command-owner/public CONTROL_BOOTSTRAP_COMMAND_INTERFACE_VERSION 1
modules/control-client-command-owner/contracts CONTROL_CLIENT_COMMAND_INTERFACE_VERSION 1
modules/control-query-owner/contracts CONTROL_DETAIL_INTERFACE_VERSION 4
modules/control-startup-owner/contracts CONTROL_STARTUP_INTERFACE_VERSION 3
modules/forward-diagnostic-owner/api FORWARD_DIAGNOSTIC_API_INTERFACE_VERSION 2
modules/forward-diagnostic-owner/public FORWARD_DIAGNOSTIC_MODULE_INTERFACE_VERSION 1
modules/forward-owner/command-api FORWARD_COMMAND_INTERFACE_VERSION 2
modules/forward-owner/execution-contracts EXECUTION_HOST_VERSION 1
modules/forward-owner/public FORWARD_STATE_INTERFACE_VERSION 2
modules/identity-owner/command-api ACCESS_COMMAND_INTERFACE_VERSION 3
modules/identity-owner/public IDENTITY_MODULE_INTERFACE_VERSION 3
modules/identity-owner/credential-contracts ACCOUNT_CREDENTIAL_API_INTERFACE_VERSION 1
framework/identity-credential-ports ACCOUNT_CREDENTIAL_STORE_INTERFACE_VERSION 1
modules/ingress-owner/deployment-api INGRESS_DEPLOYMENT_API_INTERFACE_VERSION 2
modules/ingress-owner/group-api INGRESS_GROUP_API_INTERFACE_VERSION 2
modules/ingress-owner/migration-api INGRESS_MIGRATION_API_INTERFACE_VERSION 2
modules/ingress-owner/public INGRESS_MODULE_INTERFACE_VERSION 2
modules/ingress-owner/recovery INGRESS_RECOVERY_INTERFACE_VERSION 1
modules/native-driver-owner/contracts NATIVE_DRIVER_QUERY_INTERFACE_VERSION 1
modules/native-tunnel-owner/contracts NATIVE_TUNNEL_API_INTERFACE_VERSION 1
modules/node-observation-owner/api NODE_OBSERVATION_API_INTERFACE_VERSION 1
modules/node-owner/command-api NODE_MANAGEMENT_INTERFACE_VERSION 2
modules/node-owner/contracts NODE_PORT_USAGE_QUERY_INTERFACE_VERSION 1
modules/node-owner/public NODE_MODULE_INTERFACE_VERSION 3
modules/notification-owner/api NOTIFICATION_API_INTERFACE_VERSION 2
modules/notification-owner/public NOTIFICATION_MODULE_INTERFACE_VERSION 1
modules/notification-owner/recovery NOTIFICATION_RECOVERY_INTERFACE_VERSION 1
modules/observation-service-owner/api OBSERVATION_SERVICE_API_INTERFACE_VERSION 1
modules/observation-service-owner/public OBSERVATION_SERVICE_MODULE_INTERFACE_VERSION 2
modules/operator-command-owner/contracts OPERATOR_COMMAND_INTERFACE_VERSION 1
modules/path-owner/binding-api PATH_BINDING_API_INTERFACE_VERSION 2
modules/path-owner/group-api PATH_GROUP_API_INTERFACE_VERSION 2
modules/path-owner/public PATH_MODULE_INTERFACE_VERSION 2
modules/path-owner/publication-api PATH_PUBLICATION_API_INTERFACE_VERSION 2
modules/path-owner/recovery PATH_RECOVERY_INTERFACE_VERSION 1
modules/path-owner/template-api PATH_TEMPLATE_API_INTERFACE_VERSION 2
modules/probe-history-owner/api PROBE_HISTORY_API_INTERFACE_VERSION 3
modules/probe-history-owner/public PROBE_HISTORY_MODULE_INTERFACE_VERSION 3
modules/probe-owner/command-api FORWARD_PROBE_API_INTERFACE_VERSION 4
modules/probe-owner/capability-api FORWARD_PROBE_CAPABILITY_API_INTERFACE_VERSION 3
modules/probe-owner/machine-api PROBE_MACHINE_API_INTERFACE_VERSION 3
modules/probe-owner/owner-contracts PROBE_OWNER_INTERFACE_VERSION 3
modules/probe-owner/public PROBE_MODULE_INTERFACE_VERSION 5
modules/probe-plan-owner/public PROBE_PLAN_MODULE_INTERFACE_VERSION 2
modules/resource-access-owner/public RESOURCE_ACCESS_OWNER_INTERFACE_VERSION 1
modules/resource-limit-owner/public RESOURCE_LIMIT_MODULE_INTERFACE_VERSION 3
framework/resource-usage-ports RESOURCE_USAGE_STORE_INTERFACE_VERSION 1
modules/recovery-owner/contracts RECOVERY_QUARANTINE_INTERFACE_VERSION 1
modules/recovery-owner/workflow-contracts RECOVERY_WORKFLOW_INTERFACE_VERSION 1
modules/relay-endpoint-owner/public RELAY_ENDPOINT_MODULE_INTERFACE_VERSION 1
modules/relay-plan-owner/contracts RELAY_QUERY_INTERFACE_VERSION 1
modules/runtime-status-owner/contracts RUNTIME_STATUS_QUERY_INTERFACE_VERSION 1
modules/station-alert-owner/api STATION_ALERT_API_INTERFACE_VERSION 4
modules/station-alert-owner/public STATION_ALERT_MODULE_INTERFACE_VERSION 3
modules/station-alert-owner/recovery STATION_ALERT_RECOVERY_INTERFACE_VERSION 1
modules/telemetry-owner/api TELEMETRY_API_INTERFACE_VERSION 2
modules/telemetry-owner/public TELEMETRY_MODULE_INTERFACE_VERSION 1
modules/telemetry-owner/recovery TELEMETRY_RECOVERY_INTERFACE_VERSION 1
modules/transit-owner/contracts TRANSIT_API_INTERFACE_VERSION 1
modules/transit-owner/public TRANSIT_MODULE_INTERFACE_VERSION 2
modules/transport-owner/grant-api TRANSPORT_GRANT_INTERFACE_VERSION 1
modules/transport-owner/public TRANSPORT_MODULE_INTERFACE_VERSION 2
modules/transport-owner/query-contracts TRANSPORT_QUERY_INTERFACE_VERSION 2
modules/tunnel-query-owner/contracts TUNNEL_QUERY_INTERFACE_VERSION 2
modules/upgrade-assessment-owner/contracts UPGRADE_ASSESSMENT_INTERFACE_VERSION 10
`.trim().split('\n').map(line => { const [path, name, value] = line.split(' '); return { path: `apps/control/src/${path}.ts`, name: name!, value: Number(value) }; });
const otherCounters = [
    ['packages/contracts/src/policy.ts', 'RUNTIME_POLICY_INTERFACE_VERSION', 1],
    ['packages/contracts/src/execution-observation.ts', 'EXECUTION_OBSERVATION_INTERFACE_VERSION', 1],
    ['packages/contracts/src/execution-values.ts', 'RUNTIME_VALUES_INTERFACE_VERSION', 3],
    ['apps/web/console-model-owner/public.js', 'CONSOLE_MODEL_INTERFACE_VERSION', 2],
    ['apps/web/console-request-owner/public.js', 'CONSOLE_REQUEST_INTERFACE_VERSION', 1],
    ['apps/web/rule-command-owner/public.js', 'RULE_COMMAND_INTERFACE_VERSION', 1],
    ['apps/web/browser-native/public.js', 'BROWSER_NATIVE_INTERFACE_VERSION', 1],
    ['examples/foundation-extension/public.ts', 'MODULE_CONTRACT_VERSION', 1],
] as const;

test('every independently versioned Control framework storage product native and browser public declaration matches its own source and runtime export', async () => {
    const expected = [...controlCounters, ...otherCounters.map(([path, name, value]) => ({ path, name, value }))];
    assert.equal(new Set(expected.map(entry => entry.name)).size, expected.length);
    const found: string[] = [];
    for (const path of ['apps/control/src', 'packages/contracts/src', 'apps/web', 'examples/foundation-extension'].flatMap(leaves)) {
        if (!/\.(?:ts|js)$/.test(path) || /\/test\//.test(path)) continue;
        const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
        for (const statement of ast.statements) {
            if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
            for (const declaration of statement.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name) || !/(?:INTERFACE_VERSION|HOST_VERSION|MODULE_CONTRACT_VERSION)$/.test(declaration.name.text)) continue;
                found.push(path + ':' + declaration.name.text);
            }
        }
    }
    assert.deepEqual(found.sort(), expected.map(entry => entry.path + ':' + entry.name).sort(), 'no omitted or aggregate-substituted counter');
    for (const entry of expected) {
        const namespace = await import(new URL(entry.path, root).href);
        assert.equal(namespace[entry.name], entry.value, entry.path + ':' + entry.name);
        if (entry.path.startsWith('apps/control/src/framework/') && entry.name !== 'FRAMEWORK_INTERFACE_VERSION')
            assert.equal((framework as unknown as Record<string, unknown>)[entry.name], entry.value, 'actual public framework reexport:' + entry.name);
    }
});

test('all independently versioned Agent declarations preserve their exact native or lower public constant and typed Host alias', () => {
    const expected = `
agentenrollment/native InterfaceVersion 1
agentcli/native InterfaceVersion 2
agentcommand/host InterfaceVersion 2
agentplatform/native InterfaceVersion 1
agentidentity/native InterfaceVersion 2
controlchannel/http InterfaceVersion 1
executionchannel/provider InterfaceVersion 1
executionenrollment/host InterfaceVersion 1
executionhost/driver HostVersion 1
executionhost/prepared PreparedInstanceVersion 1
executionidentity/provider InterfaceVersion 2
executiontime/clock InterfaceVersion 2
executionstate/types InterfaceVersion 4
nativeexecution/direct InterfaceVersion 3
nativeexecution/offline_transit OfflineTransitAdapterVersion 1
platformruntime/native InterfaceVersion 2
platformstate/files InterfaceVersion 1
platformobservation/process InterfaceVersion 2
observationwire/values InterfaceVersion 1
probe/platform InterfaceVersion 1
runtimeobservation/ports InterfaceVersion 2
observationtrust/trust InterfaceVersion 1
runtimeplatform/ports InterfaceVersion 2
platformclock/clock InterfaceVersion 2
payloadbudget/history InterfaceVersion 1
`.trim().split('\n').map(line => { const [path, name, value] = line.split(' '); return { path: `agent/internal/${path}.go`, name: name!, value: value! }; });
    const actual: string[] = [];
    for (const path of leaves('agent/internal').filter(path => path.endsWith('.go') && !path.endsWith('_test.go'))) {
        const source = read(path).replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
        for (const match of source.matchAll(/^const\s+(InterfaceVersion|HostVersion|PreparedInstanceVersion|OfflineTransitAdapterVersion)\s+uint64\s*=\s*([^\r\n]+)/gm))
            actual.push(path + ':' + match[1] + ':' + match[2]!.trim());
    }
    assert.deepEqual(actual.sort(), [...expected.map(entry => `${entry.path}:${entry.name}:${entry.value}`),
        'agent/internal/executiondriver/driver.go:HostVersion:executionhost.HostVersion'].sort());
    for (const entry of expected) assert.match(read(entry.path), new RegExp(`const ${entry.name} uint64 = ${entry.value}(?:\\r?\\n|$)`), entry.path);
    assert.match(read('agent/internal/executiondriver/driver.go'), /type Host = executionhost\.Host\[adp3\.Policy, relay\.Identity\]/);
    // Agent named types/method sets/reflect/wire behavior remain in the independent
    // Go owner suites; a source constant is never substituted for that acceptance.
});

test('native ADP3 admission refuses legacy input while the original internal ADP2 projection and lower generic shapes remain available', () => {
    const fixtures = JSON.parse(read('docs/protocol/fixtures/adp-v2-direct.json')) as { valid: { schema: keyof legacy.Messages; payload: unknown }[] };
    assert.equal(legacyParse, rootParse);
    const hello = { protocolVersion: 2, nodeId: 'node-1', bootId: 'boot-1', agentBuild: 'old',
        capabilities: ['tcp', 'native.direct.v1', 'adp.3'], lastStoredSnapshotGeneration: 0 };
    assert.throws(() => runtimeCodec.checkHelloProtocol(hello as unknown as native.RuntimeMessages['HelloRequest']),
        { code: 'UNSUPPORTED_PROTOCOL_VERSION', status: 409 });
    assert.throws(() => parseRuntimeMessage('HelloRequest', JSON.stringify(hello)));
    for (const fixture of fixtures.valid) assert.doesNotThrow(() => legacyParse(fixture.schema, JSON.stringify(fixture.payload)), fixture.schema);
    assert.doesNotThrow(() => runtimeCodec.checkHelloProtocol({ ...hello, protocolVersion: 3 }));
    assert.throws(() => runtimeCodec.checkHelloProtocol({ ...hello, protocolVersion: 3, capabilities: ['tcp', 'native.direct.v1'] }),
        { code: 'UNSUPPORTED_PROTOCOL_VERSION', status: 409 });
});

test('saved package support assets and actual deployment COPY embed fs and source replacement inputs retain their declared consumers', () => {
    const required = ['package.json', 'package-lock.json', '.node-version', '.dockerignore',
        'packages/core/package.json', 'packages/contracts/package.json', 'apps/control/package.json', 'agent/go.mod', 'agent/go.sum',
        'deploy/Dockerfile.control', 'deploy/Dockerfile.agent', 'deploy/Dockerfile.observation-responder',
        'deploy/control-liveness.mjs', 'deploy/compose.control.example.yaml', 'deploy/compose.agent.example.yaml',
        'deploy/compose.runtime.example.yaml', 'deploy/compose.dev.yaml', 'deploy/compose.observation.example.yaml',
        'deploy/compose.multihop-control.override.example.yaml', 'scripts/ops/cli.ts', 'scripts/ops/recovery.ts',
        'scripts/ops/upgrade.ts', 'scripts/ops/upgrade-inspect.ts', 'scripts/ops/check-multihop-release.ts',
        'examples/foundation-extension/public.ts', 'examples/foundation-extension/module.ts', 'examples/foundation-extension/main.ts',
        '.github/workflows/ci.yml', '.github/workflows/container.yml', '.github/workflows/candidate-images.yml', '.github/workflows/images.yml'];
    for (const path of required) assert.ok(existsSync(new URL(path, root)), path);
    const lock = JSON.parse(read('package-lock.json'));
    assert.equal(lock.lockfileVersion, 3);
    const manifests = ['', 'packages/core', 'packages/contracts', 'apps/control'];
    for (const path of manifests) {
        const manifest = JSON.parse(read((path ? path + '/' : '') + 'package.json'));
        const locked = lock.packages[path]; assert.ok(locked, path);
        for (const key of ['name', 'version', 'dependencies', 'devDependencies', 'engines']) {
            if (manifest[key] !== undefined && (key !== 'name' || path === '')) assert.deepEqual(locked[key], manifest[key], path + ':' + key);
        }
    }
    for (const [name, path] of [['@tunex/core', 'packages/core'], ['@tunex/contracts', 'packages/contracts'], ['@tunex/control', 'apps/control']]) {
        assert.equal(lock.packages['node_modules/' + name].link, true); assert.equal(lock.packages['node_modules/' + name].resolved, path);
    }
    for (const line of read('agent/go.mod').split(/\r?\n/)) {
        const dependency = line.match(/^\s*(\S+\/\S+)\s+(v\S+)/);
        if (dependency) assert.ok(read('agent/go.sum').includes(dependency[1] + ' ' + dependency[2] + ' '), dependency[1]);
    }
    const control = read('deploy/Dockerfile.control');
    for (const [source, target] of [['apps/control', './apps/control'], ['packages/core', './packages/core'],
        ['packages/contracts', './packages/contracts'], ['docs/protocol/schemas', './docs/protocol/schemas'],
        ['apps/web', './apps/web'], ['scripts/ops', './scripts/ops'], ['deploy/control-liveness.mjs', './deploy/control-liveness.mjs']])
        assert.ok(control.includes(`COPY ${source} ${target}`), source);
    for (const name of ['agent', 'observation-responder']) {
        const docker = read('deploy/Dockerfile.' + name);
        assert.match(docker, /COPY agent\//); assert.match(docker, /go build/);
    }
    assert.match(read('.github/workflows/container.yml'), /docker build --pull/);
    assert.match(read('.github/workflows/container.yml'), /network none[^\n]+upgrade-inspect\.ts/);
    const migrations = readdirSync(new URL('apps/control/migrations/', root)).filter(name => name.endsWith('.sql')).sort();
    assert.equal(migrations.length, 46);
    assert.equal(migrations.at(-1), '0046-recent-path-probe-alert.sql');
    assert.deepEqual(migrations.map(name => name.slice(0, 4)), Array.from({ length: 46 }, (_, index) => String(index + 1).padStart(4, '0')));
    for (const path of leaves('agent/internal').filter(path => path.endsWith('.go') && !path.endsWith('_test.go'))) {
        const source = read(path);
        for (const match of source.matchAll(/^\/\/go:embed\s+([^\r\n]+)/gm)) {
            for (const asset of match[1]!.trim().split(/\s+/)) {
                assert.doesNotMatch(asset, /[*?\[\]]/, 'all current native embed assets are explicit');
                assert.ok(existsSync(new URL(path.slice(0, path.lastIndexOf('/') + 1) + asset, root)), path + ':' + asset);
            }
        }
    }
    for (const path of ['docs/protocol/fixtures/adp-v2-direct.json', 'docs/protocol/fixtures/adp-v3-runtime.json',
        'docs/protocol/fixtures/adp-v3-execution.json', 'docs/protocol/fixtures/native-relay-v1.json', 'docs/protocol/fixtures/adp-v3-relay.json',
        'docs/protocol/fixtures/transit-v1.json', 'docs/protocol/fixtures/probe-negotiation-v1.json', 'docs/protocol/fixtures/probe-instance-v1.json',
        'docs/protocol/fixtures/probe-claim-v1.json', 'docs/protocol/fixtures/probe-delivery-v1.json', 'docs/protocol/fixtures/probe-result-v1.json',
        'packages/contracts/test/fixtures/conformance.json']) assert.doesNotThrow(() => JSON.parse(read(path)), path);
    // Existing legacy imports are still real consumers, rather than being deleted
    // merely because their canonical owners now exist.
    for (const path of ['scripts/phase1/acceptance.ts', 'scripts/phase2/acceptance.ts', 'scripts/phase2/access.ts',
        'scripts/phase2/capacity.ts', 'scripts/phase2/faults.ts', 'scripts/phase2/linux-agent.ts', 'scripts/phase2/multihop.ts',
        'scripts/phase2/probe.ts', 'scripts/phase2/recovery.ts', 'scripts/phase2/relay.ts', 'scripts/phase2/security.ts', 'scripts/phase2/transport.ts',
        'scripts/manual/udp-smoke.mjs', 'scripts/manual/test/udp-smoke.test.mjs']) assert.ok(existsSync(new URL(path, root)), path);
});
