import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Independent compatibility inventory. Exact declaration identity retains all
// readonly/optional fields, uninstantiated generic constraints and defaults.
const aliases:[string,string,string[]][]=[
 ['access-ports','../identity-owner/public.ts',['AccessExecutionResult','AccessChangeEffects']],
 ['authorization-ports','../forward-owner/public.ts',['ForwardAuthorizationExecution']],
 ['authorization-ports','../identity-owner/public.ts',['AccessExecution']],
 ['authorization-ports','../node-owner/public.ts',['NodeManagementExecution']],
 ['execution-adapter-ports','../forward-owner/public.ts',['NativeDriverId','ForwardExecutionAdapter']],
 ['forward-command-ports','../forward-owner/public.ts',['ForwardOperationKind','RetrySource','ForwardOperationCommands','ForwardCommandPreparation','ForwardResourceHost','ForwardRelayHost']],
 ['forward-telemetry-ports','../telemetry-owner/public.ts',['ForwardTelemetryMapping','ForwardTelemetryMappingPort']],
 ['multihop-plan','../../compatibility/public.ts',['MultihopPlanInput=NativeRuntimeMultihopInput']],
 ['node-change-ports','../node-owner/public.ts',['NodeManagementEffects']],
 ['operation-contract','../../framework/public.ts',['Operation=RuntimeOperation']],
 ['path-topology','../../compatibility/public.ts',['PathRole','PathNode','PathHop','PathTopology']],
 ['planner','../../compatibility/public.ts',['DirectRuntimeAssignment','SnapshotInput']],
 ['planner','../../framework/public.ts',['AuthorizedNodeFacts','ReservedSlot']],
 ['probe-telemetry-ports','../telemetry-owner/public.ts',['ProbeTelemetryMapping','ProbeTelemetryMappingPort']],
 ['query-ports','../../framework/public.ts',['AppliedObservation','ForwardRuntimeStatus','RuntimeObservationReader','OperationReadRecord','OperationReader','RelayDeploymentStatus','DeploymentReader']],
 ['query-ports','../../compatibility/public.ts',['RuntimeMachinePort=NativeRuntimeMachinePort']],
 ['relay-plan','../../framework/public.ts',['ReservedRelayResource','RelayNodeExecutionFacts=RuntimeRelayNodeFacts']],
 ['relay-plan','../../compatibility/public.ts',['RelayPreparedPlan=NativeRuntimeRelayPlan']],
 ['relay-planner','../../framework/public.ts',['RelayResource']],
 ['snapshot-assignment-ports','../../framework/public.ts',['SnapshotAssignmentContext']],
 ['snapshot-assignment-ports','../../compatibility/public.ts',['SnapshotContribution=NativeSnapshotContribution','AssignmentDriverDeclaration=NativeAssignmentDriverDeclaration','SnapshotAssignmentSource=NativeSnapshotAssignmentSource','SnapshotAssignmentCollector=NativeSnapshotAssignmentCollector','RelayAssignmentReader=NativeRelayAssignmentReader']],
 ['transit-api-contract','../transit-owner/public.ts',['TransitNegotiationApi','TransitDeliveryApi']],
 ['transit-preparation','../transit-owner/public.ts',['HopRole','TransitResource','ReservedTransitResource','HopBinding','TransitPreparation','TransitInput','TransitPreparationInput']],
];
const construction=['controller','ledger','relay-coordinator','transit-coordination','transit-delivery','transit-negotiation','transit-reservations','transit-staging'];
const forwarders=['access-changes','access-ports','authorization-ports','execution-adapter-ports','execution-adapters','forward-command-ports','forward-commands','forward-telemetry-ports','multihop-plan','native-forward-adapters','node-change-ports','node-changes','operation-contract','path-topology','planner','probe-telemetry-ports','profile-grants','query-ports','relay-assignment-source','relay-plan','relay-planner','snapshot-assignment-ports','snapshot-assignments','transit-api-contract','transit-preparation'];
const runtime=new URL('../src/modules/runtime/',import.meta.url);

test('203 all 34 runtime leaves retain bounded eight construction one interface 25 forwarding classification',async()=>{
    assert.equal(construction.length,8);assert.equal(forwarders.length,25);
    const actual=(await readdir(runtime)).filter(name=>name.endsWith('.ts')).sort();
    assert.deepEqual(actual,[...construction,...forwarders,'relay-ledger-ports'].map(name=>`${name}.ts`).sort());
    const inventory=JSON.parse(await readFile(new URL('../../../scripts/config/entrypoint-inventory-v1.json',import.meta.url),'utf8'));
    assert.deepEqual(inventory.legacy.runtime,actual);
});

test('203 all legacy runtime native aliases and generic defaults resolve to the exact original uninstantiated public declarations',()=>{
    const configPath=ts.findConfigFile(fileURLToPath(runtime),ts.sys.fileExists,'tsconfig.json');assert.ok(configPath);
    const config=ts.readConfigFile(configPath,ts.sys.readFile);assert.equal(config.error,undefined);
    const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,fileURLToPath(new URL('../../../',runtime)));
    const program=ts.createProgram({rootNames:forwarders.map(name=>fileURLToPath(new URL(`${name}.ts`,runtime))),options:parsed.options}),checker=program.getTypeChecker();
    function exported(path:string,name:string){const source=program.getSourceFile(path);assert.ok(source,path);const module=checker.getSymbolAtLocation(source);assert.ok(module);const symbol=checker.getExportsOfModule(module).find(value=>value.name===name);assert.ok(symbol,`${path}:${name}`);return symbol.flags&ts.SymbolFlags.Alias?checker.getAliasedSymbol(symbol):symbol;}
    for(const [leaf,destination,names]of aliases){
        const path=fileURLToPath(new URL(`${leaf}.ts`,runtime)),source=program.getSourceFile(path);assert.ok(source);
        for(const pair of names){const [name,remote=name]=pair.split('=') as [string,string?];
            const declarations=source.statements.filter(ts.isExportDeclaration).filter(value=>value.isTypeOnly&&value.moduleSpecifier&&ts.isStringLiteral(value.moduleSpecifier)&&value.moduleSpecifier.text===destination);
            const found=declarations.flatMap(value=>value.exportClause&&ts.isNamedExports(value.exportClause)?[...value.exportClause.elements]:[]).find(value=>value.name.text===name&&(value.propertyName??value.name).text===remote);
            assert.ok(found,`${leaf}:${pair} retains explicit type-only source`);
            const original=exported(fileURLToPath(new URL(destination,new URL(`${leaf}.ts`,runtime))),remote),alias=exported(path,name);
            assert.equal(alias,original,`${leaf}:${pair} canonical symbol`);assert.equal(alias.declarations,original.declarations,`${leaf}:${pair} inherited/generic/default declaration identity`);
        }
    }
    for(const leaf of new Set(aliases.map(row=>row[0]))){const source=program.getSourceFile(fileURLToPath(new URL(`${leaf}.ts`,runtime)))!;
        const actual=source.statements.filter(ts.isExportDeclaration).filter(value=>value.isTypeOnly).flatMap(value=>value.exportClause&&ts.isNamedExports(value.exportClause)?value.exportClause.elements.map(entry=>entry.name.text):[]).sort();
        const expected=aliases.filter(row=>row[0]===leaf).flatMap(row=>row[2].map(pair=>pair.split('=')[0]!)).sort();assert.deepEqual(actual,expected,`${leaf} complete exact type export set`);
    }
});

test('203 production Recovery phase fixture and original tests retain actual legacy construction and native compilation imports until migration',async()=>{
    const root=new URL('../../../',import.meta.url);
    const consumers:[string,string[]][]=[
        ['apps/control/src/server.ts',['RuntimeController']],
        ['apps/control/src/application/control.ts',['RuntimeLedger','RelayCoordinator']],
        ['scripts/ops/recovery.ts',['RuntimeLedger','RelayCoordinator','SnapshotAssignmentRegistry']],
        ['scripts/phase1/acceptance.ts',['compileDirect']],
        ['scripts/build-multihop-fixtures.mjs',['compileMultihopPlan']],
        ['apps/control/test/transit-coordination.test.ts',['TransitCoordinationJournal','TransitDeliveryService','TransitStagingCoordinator']],
        ['apps/control/test/transit-negotiation.test.ts',['TransitNegotiator']],
        ['apps/control/test/snapshot-assignment-ports.test.ts',['SnapshotAssignmentRegistry','SnapshotAssignmentContext']],
    ];
    for(const [path,names]of consumers){const text=await readFile(new URL(path,root),'utf8');for(const name of names)assert.ok(text.includes(name),`${path}:${name}`);assert.match(text,/modules\/runtime\/|\.\/runtime\//,`${path} original leaf import`);}
});
