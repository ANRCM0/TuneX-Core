import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { DEFAULT_POLICY as originalPolicy } from '@tunex/contracts';
import { EXECUTION_HOST_VERSION } from '../src/modules/runtime/execution-adapter-ports.ts';
import { EXECUTION_HOST_VERSION as canonicalHostVersion } from '../src/modules/forward-owner/execution-contracts.ts';

// Independent complete lists from the named source-change scope, not exports
// discovered from the implementation under test. Every listed type is checked
// against the canonical declaration symbol, including its uninstantiated defaults.
const applicationTypes: [string, string, string[]][] = [
    ['access-command-contract', 'identity-owner', ['MemberChangeResponse', 'NodeGrantResponse', 'AccessCommandApi']],
    ['access-commands', 'identity-owner', ['MemberChangeResponse', 'NodeGrantResponse']],
    ['audit-api', 'audit-owner', ['AuditHistory', 'AuditEventsApi']],
    ['console-queries', 'console-query-owner', ['ConsolePage', 'ConsoleNode', 'ConsoleForward', 'ConsoleOperation', 'ConsoleCandidates', 'ConsoleOverview', 'ConsoleDiagnostics', 'ConsoleReadPort']],
    ['console-query', 'console-query-owner', ['ConsoleListKind', 'ConsoleFilters', 'ConsolePaging']],
    ['control-queries', 'control-query-owner', ['ExecutionCapabilities']],
    ['forward-commands', 'forward-owner', ['ForwardAccepted']],
    ['forward-probes', 'probe-owner', ['ProbeAcceptance', 'IngressProbeAcceptance', 'ServiceProbeAcceptance', 'AnyProbeAcceptance']],
    ['node-command-contract', 'node-owner', ['NodeChangeResponse', 'NodeManagementApi']],
    ['node-management', 'node-owner', ['NodeChangeResponse']],
    ['observation-service-api', 'observation-service-owner', ['ObservationServiceTrust', 'ObservationServiceEnvelope', 'ObservationServiceList', 'ObservationServiceDetail', 'ObservationServicesApi']],
    ['probe-instances', 'probe-owner', ['ProbeInstanceCommand', 'ProbeInstanceRegistration', 'ProbeInstanceInspection']],
    ['probe-machine-api', 'probe-owner', ['ProbeNegotiationApi', 'ProbeInstanceApi', 'ProbeClaimApi', 'ProbeDeliveryApi', 'ProbeResultApi', 'ProbeTypeRegistryApi', 'ProbeServiceRegistryApi', 'ProbeTypesApi', 'ProbeServicesApi']],
    ['probe-plans', 'probe-plan-owner', ['ProbePlanReceipt']],
    ['telemetry-rollups', 'telemetry-owner', ['TelemetryRollupQuery']],
    ['transport-grant-contract', 'transport-owner', ['TransportGrantResponse', 'TransportGrantApi']],
    ['transport-grants', 'transport-owner', ['TransportGrantResponse']],
    ['transport-queries', 'transport-owner', ['ProfileReferenceQuery', 'ProfileReference', 'TransportReferenceReader']],
    ['tunnel-queries', 'tunnel-query-owner', ['TunnelNodeRecord', 'TunnelPeerRecord', 'TunnelReference', 'TunnelPaging', 'TunnelReadPort']],
];
const runtimeTypes: [string, string, string[]][] = [
    ['access-ports', 'identity-owner', ['AccessExecutionResult', 'AccessChangeEffects']],
    ['authorization-ports', 'forward-owner', ['ForwardAuthorizationExecution']],
    ['authorization-ports', 'identity-owner', ['AccessExecution']],
    ['authorization-ports', 'node-owner', ['NodeManagementExecution']],
    ['execution-adapter-ports', 'forward-owner', ['NativeDriverId', 'ForwardExecutionAdapter']],
    ['forward-command-ports', 'forward-owner', ['ForwardOperationKind', 'RetrySource', 'ForwardOperationCommands', 'ForwardCommandPreparation', 'ForwardResourceHost', 'ForwardRelayHost']],
    ['node-change-ports', 'node-owner', ['NodeManagementEffects']],
];
const root = new URL('../src/', import.meta.url);
const pathFor = (path: string) => fileURLToPath(new URL(path, root));
const consumerPaths = ['modules/idempotency.ts', 'modules/transport-owner/contracts.ts', 'modules/relay-endpoint-owner/contracts.ts',
    'modules/nodes.ts', 'application/control.ts', 'modules/runtime/controller.ts', 'modules/runtime/ledger.ts', 'modules/runtime/relay-coordinator.ts'];
const retainedTypePaths = ['modules/forwarding-ports.ts', 'modules/identity-ports.ts', 'modules/node-execution-ports.ts'];
const roots = [...applicationTypes.map(([name]) => `application/${name}.ts`),
    ...runtimeTypes.map(([name]) => `modules/runtime/${name}.ts`), ...consumerPaths, ...retainedTypePaths];
let cachedProgram: ts.Program | undefined;
function program() {
    if (!cachedProgram) {
        const configFile = ts.findConfigFile(pathFor(''), ts.sys.fileExists, 'tsconfig.json'); assert.ok(configFile);
        const config = ts.readConfigFile(configFile, ts.sys.readFile); assert.equal(config.error, undefined);
        const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(new URL('../../../', root)));
        cachedProgram = ts.createProgram({ rootNames: [...new Set(roots.map(pathFor))], options: parsed.options });
    }
    return cachedProgram;
}
function source(path: string) {
    const found = program().getSourceFile(pathFor(path)); assert.ok(found, path); return found;
}
function original(symbol: ts.Symbol) {
    const checker = program().getTypeChecker();
    const result = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    assert.ok(result.declarations?.length, `unresolved canonical symbol ${symbol.name}`); return result;
}
function exportsOf(path: string) {
    const checker = program().getTypeChecker(), symbol = checker.getSymbolAtLocation(source(path)); assert.ok(symbol, path);
    return new Map(checker.getExportsOfModule(symbol).map(value => [value.name, value]));
}
function namedTypeExports(file: ts.SourceFile) {
    return file.statements.filter(ts.isExportDeclaration).filter(value => value.isTypeOnly).flatMap(value => {
        assert.ok(value.exportClause && ts.isNamedExports(value.exportClause), 'no expanded wildcard type export');
        assert.ok(value.moduleSpecifier && ts.isStringLiteral(value.moduleSpecifier));
        return value.exportClause.elements.map(element => ({ local: element.name.text,
            remote: (element.propertyName ?? element.name).text, from: (value.moduleSpecifier as ts.StringLiteral).text }));
    });
}
function typeImport(file: string, from: string, local: string, remote = local) {
    const checker = program().getTypeChecker();
    const imports = source(file).statements.filter(ts.isImportDeclaration).filter(value =>
        ts.isStringLiteral(value.moduleSpecifier) && value.moduleSpecifier.text === from && value.importClause?.isTypeOnly);
    const elements = imports.flatMap(value => value.importClause!.namedBindings && ts.isNamedImports(value.importClause!.namedBindings) ? [...value.importClause!.namedBindings.elements] : []);
    const imported = elements.find(value => value.name.text === local && (value.propertyName ?? value.name).text === remote); assert.ok(imported, `${file}:${local}`);
    const symbol = checker.getSymbolAtLocation(imported.name); assert.ok(symbol);
    return original(symbol);
}

test('207 all nineteen named application leaves forward every exact type to the same canonical uninstantiated declaration', () => {
    assert.equal(applicationTypes.length, 19);
    for (const [name, owner, names] of applicationTypes) {
        const file = `application/${name}.ts`, canonical = exportsOf(`modules/${owner}/public.ts`), legacy = exportsOf(file);
        assert.deepEqual(namedTypeExports(source(file)), names.map(local => ({ local, remote: local, from: `../modules/${owner}/public.ts` })));
        for (const name of names) {
            assert.ok(legacy.has(name)); assert.ok(canonical.has(name));
            assert.equal(original(legacy.get(name)!), original(canonical.get(name)!), `${file}:${name}`);
        }
    }
});

test('204 five runtime port groups retain every exact public canonical type declaration and original version leaf', () => {
    assert.equal(new Set(runtimeTypes.map(([file]) => file)).size, 5);
    for (const fileName of new Set(runtimeTypes.map(([file]) => file))) {
        const expected = runtimeTypes.filter(([file]) => file === fileName).flatMap(([, owner, names]) =>
            names.map(local => ({ local, remote: local, from: `../${owner}/public.ts` })));
        assert.deepEqual(namedTypeExports(source(`modules/runtime/${fileName}.ts`)), expected);
    }
    for (const [name, owner, names] of runtimeTypes) {
        const legacy = exportsOf(`modules/runtime/${name}.ts`), canonical = exportsOf(`modules/${owner}/public.ts`);
        for (const name of names) assert.equal(original(legacy.get(name)!), original(canonical.get(name)!), `${owner}:${name}`);
    }
    assert.equal(EXECUTION_HOST_VERSION, canonicalHostVersion);
    const valueExports = source('modules/runtime/execution-adapter-ports.ts').statements.filter(ts.isExportDeclaration).filter(value => !value.isTypeOnly);
    assert.equal(valueExports.length, 1); assert.equal((valueExports[0]!.moduleSpecifier as ts.StringLiteral).text, '../forward-owner/execution-contracts.ts');
});

test('202 direct public consumer imports/aliases use the same Accepted, Forward reference, Node authority and Member declarations', () => {
    const forward = exportsOf('modules/forward-owner/public.ts'), node = exportsOf('modules/node-owner/public.ts'), identity = exportsOf('modules/identity-owner/public.ts');
    for (const [file, from, local, remote, canonical] of [
        ['modules/idempotency.ts', './forward-owner/public.ts', 'Accepted', 'ForwardAccepted', forward],
        ['modules/transport-owner/contracts.ts', '../forward-owner/public.ts', 'ProfileForwardReferences', 'ProfileForwardReferences', forward],
        ['modules/relay-endpoint-owner/contracts.ts', '../forward-owner/public.ts', 'RelayForwardReferences', 'RelayForwardReferences', forward],
        ['modules/nodes.ts', './node-owner/public.ts', 'ForwardNodeAuthorization', 'ForwardNodeAuthorization', node],
        ['modules/nodes.ts', './node-owner/public.ts', 'RelayNodeAuthority', 'RelayNodeAuthority', node],
        ['application/control.ts', '../modules/identity-owner/public.ts', 'MemberChangeInput', 'MemberChangeInput', identity],
        ['application/control.ts', '../modules/forward-owner/public.ts', 'Accepted', 'ForwardAccepted', forward],
    ] as const) assert.equal(typeImport(file, from, local, remote), original(canonical.get(remote)!));
    assert.equal(original(exportsOf('modules/idempotency.ts').get('Accepted')!), original(forward.get('ForwardAccepted')!));
    for (const name of ['ProfileForwardReferences', 'RelayForwardReferences'])
        assert.equal(original(exportsOf('modules/forwarding-ports.ts').get(name)!), original(forward.get(name)!));
    for (const name of ['ForwardNodeAuthorization', 'RelayNodeAuthority'])
        assert.equal(original(exportsOf('modules/node-execution-ports.ts').get(name)!), original(node.get(name)!));
    assert.equal(original(exportsOf('modules/identity-ports.ts').get('MemberChangeInput')!), original(identity.get('MemberChangeInput')!));
});

test('204/207 Policy imports and original DEFAULT_POLICY/Idempotency value imports retain exact leaves and declarations', () => {
    const checker = program().getTypeChecker();
    const policyFiles = ['application/control.ts', 'modules/runtime/controller.ts', 'modules/runtime/ledger.ts', 'modules/runtime/relay-coordinator.ts'];
    const policySymbols = policyFiles.map(file => typeImport(file, '@tunex/contracts/policy', 'Policy'));
    for (const symbol of policySymbols) assert.equal(symbol, policySymbols[0]);
    for (const file of ['application/control.ts', 'modules/runtime/ledger.ts', 'modules/runtime/relay-coordinator.ts']) {
        const declaration = source(file).statements.filter(ts.isImportDeclaration).find(value =>
            (value.moduleSpecifier as ts.StringLiteral).text === '@tunex/contracts/shared' && !value.importClause?.isTypeOnly);
        assert.ok(declaration?.importClause?.namedBindings && ts.isNamedImports(declaration.importClause.namedBindings));
        assert.deepEqual(declaration.importClause.namedBindings.elements.map(value => value.name.text), ['DEFAULT_POLICY']);
        const shared = checker.getSymbolAtLocation(declaration.moduleSpecifier); assert.ok(shared);
        const oldPolicy = checker.getExportsOfModule(shared).find(value => value.name === 'Policy'); assert.ok(oldPolicy);
        assert.equal(original(oldPolicy), policySymbols[0]);
    }
    const imports = source('application/control.ts').statements.filter(ts.isImportDeclaration);
    const idempotency = imports.find(value => (value.moduleSpecifier as ts.StringLiteral).text === '../modules/idempotency.ts');
    assert.ok(idempotency && !idempotency.importClause?.isTypeOnly);
    assert.ok(idempotency.importClause?.namedBindings && ts.isNamedImports(idempotency.importClause.namedBindings));
    assert.deepEqual(idempotency.importClause.namedBindings.elements.map(value => value.name.text), ['Idempotency']);
});

test('202/204/207 changing erased import/export sources cannot change emitted runtime body, value imports or introduce a loading cycle', () => {
    const compilerOptions = { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true };
    let erased = 0;
    for (const path of new Set(roots)) {
        const file = source(path), edits: { start: number; end: number }[] = [];
        for (const statement of file.statements) {
            if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly || ts.isExportDeclaration(statement) && statement.isTypeOnly) {
                const module = statement.moduleSpecifier;
                if (module) { edits.push({ start: module.getStart(file), end: module.end }); erased++; }
            }
        }
        let poisoned = file.text;
        for (const edit of edits.reverse()) poisoned = poisoned.slice(0, edit.start) + "'__nonexistent_erased_type_only_source__'" + poisoned.slice(edit.end);
        const compile = (input: string) => ts.transpileModule(input, { compilerOptions, fileName: path }).outputText;
        const emitted = compile(file.text);
        assert.equal(compile(poisoned), emitted, path);
        assert.equal(emitted.includes('__nonexistent_erased_type_only_source__'), false, path);
    }
    assert.ok(erased >= 40, 'all named type-source leaves and consumers examined');
});

test('202/204/207 actual legacy runtime imports initialize and old server/bootstrap/phase/test paths remain resolvable', async () => {
    const legacy = await import('../src/modules/idempotency.ts'); assert.equal(typeof legacy.Idempotency, 'function');
    const nodes = await import('../src/modules/nodes.ts'); assert.equal(typeof nodes.Nodes, 'function');
    const control = await import('../src/application/control.ts'); assert.equal(typeof control.ControlApplication, 'function');
    for (const path of new Set(runtimeTypes.map(([name]) => name))) {
        const namespace = await import(new URL(`modules/runtime/${path}.ts`, root).href);
        assert.deepEqual(Object.keys(namespace), path === 'execution-adapter-ports' ? ['EXECUTION_HOST_VERSION'] : []);
    }
    assert.equal(DEFAULT_POLICY, originalPolicy); assert.equal(Object.isFrozen(DEFAULT_POLICY), true);
    const examples: [string, string[]][] = [
        ['server.ts', ['./modules/identity.ts', './modules/nodes.ts', './application/control.ts']],
        ['bootstrap.ts', ['./modules/identity.ts']],
        ['application/control.ts', ['../modules/transport.ts', '../modules/idempotency.ts']],
    ];
    for (const [file, expected] of examples) {
        const text = await readFile(new URL(file, root), 'utf8');
        for (const path of expected) assert.ok(text.includes(`from '${path}'`), `${file}:${path}`);
    }
    const script = await readFile(new URL('../../../scripts/phase1/acceptance.ts', root), 'utf8');
    assert.ok(script.includes("from '../../apps/control/src/modules/identity.ts'"));
    const oldTest = await readFile(new URL('../test/transport-grant-ports.test.ts', root), 'utf8');
    assert.ok(oldTest.includes("from '../src/application/transport-grants.ts'"));
});
