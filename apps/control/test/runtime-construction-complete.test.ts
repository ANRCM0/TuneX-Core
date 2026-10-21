import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { Policy } from '@tunex/contracts/policy';
import { RuntimeController } from '../src/modules/runtime/controller.ts';
import { RuntimeLedger } from '../src/modules/runtime/ledger.ts';
import { RelayCoordinator } from '../src/modules/runtime/relay-coordinator.ts';
import type { RelayExecutionLedger } from '../src/modules/runtime/relay-ledger-ports.ts';
import type { NativeRuntimeRelayLedger } from '../src/compatibility/public.ts';
import { runtimeCodec, nativeWallClockNow, nativeRuntimeStatusCodec, nativeLedgerCompiler, nativeRelayCompiler } from '../src/compatibility/public.ts';
import { RuntimeHost, RuntimeLedgerHost, RuntimeRelayHost, RuntimeResources } from '../src/framework/public.ts';
import { MySqlRuntimeStateStore } from '../src/infrastructure/mysql-runtime-host.ts';
import { MySqlRuntimeStatusStore } from '../src/infrastructure/mysql-runtime-status-store.ts';
import { MySqlRuntimeLedgerStore } from '../src/infrastructure/mysql-runtime-ledger.ts';
import { NodePortLimitPolicy } from '../src/modules/node-owner/public.ts';
import { SharedResourceLimitPublicationPolicy } from '../src/modules/resource-limit-owner/public.ts';
import { MySqlSharedResourceLimitStore } from '../src/infrastructure/mysql-resource-limits.ts';
import { MySqlNodeAuthorityStore } from '../src/infrastructure/mysql-node-authority.ts';
import { MySqlRuntimeResourceStore } from '../src/infrastructure/mysql-runtime-resources.ts';
import { MySqlRelayDeploymentStore, MySqlRelayObservations } from '../src/infrastructure/mysql-runtime-relay.ts';
import { RuntimeStatusQueries } from '../src/modules/runtime-status-owner/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

// Inspect existing TypeScript-private bindings after real construction; no production hook or constructor replacement.
function bindings(value: unknown): Record<string, any> { return value as Record<string, any>; }
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
const sameRelayContract: Equal<RelayExecutionLedger<Transaction>, NativeRuntimeRelayLedger<Transaction>> = true;

test('203/205 RuntimeController constructs original state/status providers and preserves every ledger receiver and Forward argument', async () => {
    const db = {}, nodes = {}, forwards = {}, authority = {}, relay = {}, tx = {}, facts = {}, report = {}, snapshot = {};
    const assignments: unknown[] = [], previous: unknown[] = [], next: unknown[] = [];
    const calls: unknown[][] = [], result = {};
    const ledger = Object.fromEntries(['assignments','retireChanged','tombstones','verifyPublishable','recordLeases','complete','claim','get','observeDrains'].map(name => [name, function(this: unknown,...args: unknown[]) { assert.equal(this,ledger); calls.push([name,...args]); return result; }]));
    const controller = new RuntimeController(db as never,nodes as never,forwards as never,ledger as never,undefined,authority as never,relay as never);
    assert.ok(controller instanceof RuntimeHost); assert.equal(RuntimeController.length,8);
    const ports = bindings(controller).ports;
    for(const [key,value] of Object.entries({db,nodes,forwards,authority,relay,codec:runtimeCodec,now:nativeWallClockNow})) assert.equal(ports[key],value);
    assert.ok(ports.store instanceof MySqlRuntimeStateStore); assert.equal(bindings(ports.store).db,db);
    assert.ok(ports.observations instanceof RuntimeStatusQueries);
    assert.ok(bindings(ports.observations).store instanceof MySqlRuntimeStatusStore);
    assert.equal(bindings(ports.observations).codec,nativeRuntimeStatusCodec);
    assert.ok(ports.payloadPolicy instanceof SharedResourceLimitPublicationPolicy);
    const payloadOptions=bindings(ports.payloadPolicy).options;
    assert.ok(payloadOptions.nodes instanceof MySqlNodeAuthorityStore);assert.ok(payloadOptions.owners instanceof MySqlRuntimeResourceStore);
    assert.ok(payloadOptions.store instanceof MySqlSharedResourceLimitStore);assert.equal(typeof payloadOptions.codec.formatTime,'function');
    const cases: [string,unknown[],unknown[]][] = [
        ['assignments',[tx,facts],[tx,forwards,facts]], ['retireChanged',[tx,'node',previous,next,7],[tx,'node',previous,next,7]],
        ['tombstones',[tx,'node',7],[tx,'node',7]], ['verifyPublishable',[tx,assignments],[tx,assignments]],
        ['recordLeases',[tx,snapshot],[tx,snapshot]], ['complete',[tx,'node',report,snapshot],[tx,'node',forwards,report,snapshot]],
        ['claim',[tx],[tx]], ['get',[tx,'scope','id'],[tx,'scope','id']], ['observeDrains',[tx,'node',4,report],[tx,'node',4,report]],
    ];
    for(const [name,args,expected] of cases) { assert.equal(ports.ledger[name](...args),result); assert.deepEqual(calls.pop(),[name,...expected]); }
    const failure = new Error('original-ledger'); ledger.claim = function() { assert.equal(this,ledger); throw failure; };
    assert.throws(()=>ports.ledger.claim(tx), error=>error===failure);
    const policy={...DEFAULT_POLICY}; const explicit=new RuntimeController(db as never,nodes as never,forwards as never,ledger as never,policy);
    assert.equal(bindings(explicit).ports.policy,policy); assert.deepEqual(bindings(bindings(explicit).ports.observations).policy,policy);
    assert.notEqual(bindings(bindings(explicit).ports.observations).policy,policy);
    const payloadPolicy={async limits(){assert.fail('construction must not sample payload policy');}};
    const custom=new RuntimeController(db as never,nodes as never,forwards as never,ledger as never,policy,authority as never,relay as never,payloadPolicy);
    assert.equal(bindings(custom).ports.payloadPolicy,payloadPolicy);
});

test('203/205 RuntimeLedger retains policy spread resource short circuit native stores collector authorization and captured clock/UUID', t => {
    t.mock.method(Date,'now',()=>1234); const clock=Date.now;
    const collector={merge(){assert.fail('construction must not collect');}}, authorization={}, resources={};
    let reads=0; const policy={...DEFAULT_POLICY,get maxAssignmentsPerNode(){reads++;return 17;}} as Policy;
    const ledger=new RuntimeLedger(policy,authorization as never,collector as never,resources as never), bound=bindings(ledger);
    assert.ok(ledger instanceof RuntimeLedgerHost); assert.equal(RuntimeLedger.length,4);
    assert.equal(reads,1); assert.notEqual(bound.policy,policy); assert.deepEqual(bound.policy,{...DEFAULT_POLICY,maxAssignmentsPerNode:17});
    assert.equal(bound.resources,resources); assert.equal(bound.authorization,authorization); assert.equal(bound.assignmentSources,collector);
    assert.ok(bound.store instanceof MySqlRuntimeLedgerStore); assert.equal(bound.compiler,nativeLedgerCompiler);
    assert.equal(bound.now,clock); assert.equal(bound.newID,randomUUID);
    t.mock.method(Date,'now',()=>9876); assert.equal(bound.now(),1234);
    policy.maxClockSkewSeconds=4; assert.notEqual(bound.policy.maxClockSkewSeconds,4);
    const native=new RuntimeLedger(undefined,undefined,collector as never), defaults=bindings(native);
    assert.deepEqual(defaults.policy,DEFAULT_POLICY); assert.notEqual(defaults.policy,DEFAULT_POLICY);
    assert.ok(defaults.resources instanceof RuntimeResources); assert.ok(bindings(defaults.resources).store instanceof MySqlRuntimeResourceStore);
    assert.equal(bindings(defaults.resources).maxAssignmentsPerNode,DEFAULT_POLICY.maxAssignmentsPerNode);
    assert.ok(bindings(defaults.resources).portPolicy instanceof NodePortLimitPolicy);
    const selected=new RuntimeLedger({...DEFAULT_POLICY,maxAssignmentsPerNode:19},undefined,collector as never);
    assert.equal(bindings(bindings(selected).resources).maxAssignmentsPerNode,19);
    assert.throws(()=>new RuntimeLedger(undefined,undefined,undefined as never),/Snapshot assignment collector is required/);
});

test('203/205 RelayCoordinator keeps same ledger/providers fresh policy false multihop captured instance clock and invocation-time static same-Tx quarantine', async t => {
    const nodes={},forwards={},transport={},endpoints={},ledger={};
    t.mock.method(Date,'now',()=>100); const captured=Date.now;
    const relay=new RelayCoordinator(nodes as never,forwards as never,transport as never,endpoints as never,ledger as never), bound=bindings(relay);
    assert.ok(relay instanceof RuntimeRelayHost); assert.equal(RelayCoordinator.length,5); assert.equal(relay.multihopEnabled,false);
    for(const [key,value] of Object.entries({nodes,forwarding:forwards,transport,endpoints,ledger,compiler:nativeRelayCompiler,now:captured})) assert.equal(bound[key],value);
    assert.ok(bound.store instanceof MySqlRelayDeploymentStore); assert.ok(bound.observations instanceof MySqlRelayObservations);
    assert.deepEqual(bound.policy,DEFAULT_POLICY); assert.notEqual(bound.policy,DEFAULT_POLICY);
    const second=new RelayCoordinator(nodes as never,forwards as never,transport as never,endpoints as never,ledger as never);
    assert.notEqual(bindings(second).policy,bound.policy);
    const explicit={...DEFAULT_POLICY,maxAssignmentsPerNode:21}; const enabled=new RelayCoordinator(nodes as never,forwards as never,transport as never,endpoints as never,ledger as never,explicit,true);
    assert.equal(enabled.multihopEnabled,true); assert.notEqual(bindings(enabled).policy,explicit); assert.deepEqual(bindings(enabled).policy,explicit);
    const calls: unknown[][]=[]; const tx={execute:async function(this:unknown,...args:unknown[]){assert.equal(this,tx);calls.push(args);return [{affectedRows:1},[]];}} as unknown as Transaction;
    t.mock.method(Date,'now',()=>200); await RelayCoordinator.quarantineRecovery(tx);
    t.mock.method(Date,'now',()=>300); await relay.quarantineRecovery(tx);
    assert.deepEqual(calls,[["UPDATE relay_deployments SET stage='withdrawn',updated_at=?",[200]],["UPDATE relay_deployments SET stage='withdrawn',updated_at=?",[100]]]);
    const failure=new Error('same-tx SQL failure'); t.mock.method(tx,'execute',async()=>{throw failure;});
    await assert.rejects(RelayCoordinator.quarantineRecovery(tx),error=>error===failure);
});

test('203 retained RelayExecutionLedger remains an interface extending original public native generic specialization', async () => {
    assert.equal(sameRelayContract,true);
    const source=await readFile(new URL('../src/modules/runtime/relay-ledger-ports.ts',import.meta.url),'utf8');
    assert.match(source,/import type \{ NativeRuntimeRelayLedger as RuntimeRelayLedger \} from '\.\.\/\.\.\/compatibility\/public\.ts'/);
    assert.match(source,/export interface RelayExecutionLedger<Tx> extends RuntimeRelayLedger<Tx> \{\}/);
    assert.doesNotMatch(source,/export type RelayExecutionLedger|class RelayExecutionLedger/);
});
