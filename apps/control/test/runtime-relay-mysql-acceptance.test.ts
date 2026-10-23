import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { RuntimeMessages } from '@tunex/contracts/runtime';
import { RuntimeRelayHost } from '../src/framework/public.ts';
import { NodeService, NodePortLimitPolicy } from '../src/modules/node-owner/public.ts';
import { Identity, newToken } from '../src/modules/identity.ts';
import { Forwarding } from '../src/modules/forwarding.ts';
import { Transport } from '../src/modules/transport.ts';
import { RelayEndpoints } from '../src/modules/relay-endpoints.ts';
import { RuntimeController } from '../src/modules/runtime/controller.ts';
import { RuntimeLedger } from '../src/modules/runtime/ledger.ts';
import { nativeNodeCodec, nativeRelayCompiler, compileSnapshot } from '../src/compatibility/public.ts';
import { nativeNodeSecrets } from '../src/infrastructure/identity-secrets.ts';
import { MySqlNodeAuthorityStore } from '../src/infrastructure/mysql-node-authority.ts';
import { MySqlTransportProfileStore, MySqlRelayEndpointStore } from '../src/infrastructure/mysql-relay-configuration.ts';
import { MySqlRelayDeploymentStore, MySqlRelayObservations } from '../src/infrastructure/mysql-runtime-relay.ts';
import { createMySqlRuntimeResources, MySqlRuntimeResourceStore } from '../src/infrastructure/mysql-runtime-resources.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { multihopFixture } from './fixtures/multihop.ts';

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
type Statement={sql:string;args:unknown[]};
function traced(tx:Transaction,after:(sql:string,args:unknown[],result:unknown)=>Promise<void>|void):Transaction{
    let supplied:Transaction;supplied=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,supplied);const result=await Reflect.apply(target.execute,target,[sql,args]);await after(sql,args,result);return result;};return Reflect.get(target,key,receiver);}});return supplied;
}
async function withDatabase(action:(f:Awaited<ReturnType<typeof fixture>>)=>Promise<void>){
    const admin=await createConnection(databaseURL!),database='tunex_runtime_closure_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+database;
    const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();await action(await fixture(db));}
    finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
}
async function fixture(db:MySqlUnitOfWork){
    const state={now:Date.now()},input=multihopFixture(),actor='runtime-owner';input.issuedAt=new Date(state.now).toISOString();
    for(const n of input.nodes){n.credentialUntil=state.now+3600000;n.peers[0]!.validUntil=state.now+600000;}
    const plan=nativeRelayCompiler.multihopPlan(input),identity=new Identity(db);await identity.bootstrap(input.forward.scopeId,actor,newToken());
    await db.transaction(async tx=>{
        for(const [index,n]of input.nodes.entries()){
            await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,?,?)',[n.facts.nodeId,input.forward.scopeId,String(index+1).repeat(64),state.now+3600000,n.credentialUntil,JSON.stringify(n.facts),'private',actor,1]);
            await write(tx,'INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,NULL,NULL)',[n.facts.nodeId,actor]);
            await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch,boot_id) VALUES(?,?,?)',[n.facts.nodeId,n.sessionEpoch,'boot-'+n.sessionEpoch]);
            await write(tx,'INSERT INTO node_boots(node_id,boot_id,session_epoch) VALUES(?,?,?)',[n.facts.nodeId,'boot-'+n.sessionEpoch,n.sessionEpoch]);
            await write(tx,'INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',[n.peers[0]!.fingerprint.slice(7),n.facts.nodeId,state.now,n.peers[0]!.validUntil,'original synthetic database certificate']);
        }
        const profileStore=new MySqlTransportProfileStore();await profileStore.ensureProfile(tx,input.profile.profileId,input.forward.scopeId);await profileStore.publishRevision(tx,input.profile.profileId,1,JSON.stringify(input.profile.config),input.profile.configDigest,actor,state.now);await profileStore.setCurrentRevision(tx,input.profile.profileId,1);await profileStore.insertGrant(tx,input.profile.profileId,actor);
        const endpointStore=new MySqlRelayEndpointStore();for(const e of input.endpoints)await endpointStore.save(tx,e.nodeId,e.revision,JSON.stringify(e.config),actor,state.now);
        await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor,owner_actor_id) VALUES(?,?,?,?,?,?)',[input.forward.id,input.forward.scopeId,1,JSON.stringify(input.forward.spec),actor,actor]);
        await new MySqlRelayDeploymentStore().insertMultihop(tx,input.forward,9,plan,state.now,state.now);
    });
    const nodeStore=new MySqlNodeAuthorityStore(),portLimits=new NodePortLimitPolicy(nodeStore,new MySqlRuntimeResourceStore()),resources=createMySqlRuntimeResources(portLimits),nodes=new NodeService({db,identity,store:nodeStore,resources,portLimits,codec:nativeNodeCodec,secrets:nativeNodeSecrets,signer:{},machine:{},overlapSeconds:120,relayCredentialSeconds:86400,now:()=>state.now} as never);
    const forwarding=new Forwarding(),ledger=new RuntimeLedger(DEFAULT_POLICY,undefined,{merge:async(_tx,_context,direct)=>[...direct]},resources),transport=new Transport(db,identity,{} as never,forwarding),endpoints=new RelayEndpoints(db,identity,nodes,{} as never,forwarding);
    const relay=new RuntimeRelayHost({nodes,forwards:forwarding,ledger,transport,endpoints,store:new MySqlRelayDeploymentStore(),observations:new MySqlRelayObservations(),compiler:nativeRelayCompiler,policy:DEFAULT_POLICY,multihopEnabled:true,now:()=>state.now} as never);
    // Pin only the existing test-instance clock bindings so exact SQL arguments
    // compare across rollback attempts; native default capture has separate tests.
    Reflect.set(ledger,'now',()=>state.now);
    const controller=(database:MySqlUnitOfWork=db)=>{const host=new RuntimeController(database,nodes as never,forwarding,ledger,DEFAULT_POLICY,undefined,relay as never);Reflect.set(host,'now',()=>state.now);return host;};
    async function operation(id:string,status='running',cleanup=false,recovery=false,forwardId=input.forward.id){await db.transaction(tx=>write(tx,'INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline,cleanup_pending,recovery_invalidated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,input.forward.scopeId,forwardId,1,'create',status,actor,id,'sha256:'+'a'.repeat(64),state.now,state.now,state.now+600000,cleanup,recovery]));}
    return {db,state,input,plan,identity,nodes,forwarding,ledger,relay,controller,actor,operation};
}
const inventoryTables:[string,string][]=[['runtime_nodes','node_id'],['snapshots','node_id,generation'],['reports','node_id,session_epoch,sequence'],['retirements','node_id,assignment_id,deployment_generation,binding_fence'],['execution_leases','node_id,assignment_id,deployment_generation,binding_fence,session_epoch'],['operations','id'],['forwards','id'],['port_slots','node_id,protocol,port'],['relay_deployments','forward_id,generation']];
async function inventory(db:MySqlUnitOfWork){const result:Record<string,unknown>={};for(const [table,key]of inventoryTables)result[table]=await rows(db.pool,`SELECT * FROM ${table} ORDER BY ${key}`);return result;}

test('4/11 real canonical MySQL transitive Runtime Hello locks every historical related Node before credential/facts and leaves unrelated Node independently lockable',{skip:!databaseURL},async()=>{
    await withDatabase(async f=>{
        await f.db.transaction(async tx=>{const facts={...f.input.nodes[0]!.facts,nodeId:'unrelated'};await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,?,?)',['unrelated',f.input.forward.scopeId,'f'.repeat(64),f.state.now+3600000,f.state.now+3600000,JSON.stringify(facts),'private',f.actor,1]);await write(tx,'INSERT INTO runtime_nodes(node_id) VALUES(?)',['unrelated']);});
        let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),locked=new Promise<void>(resolve=>{entered=resolve;}),trace:Statement[]=[];
        const facade={pool:f.db.pool,transaction:<T>(run:(tx:Transaction)=>Promise<T>)=>f.db.transaction(tx=>run(traced(tx,async(sql,args)=>{trace.push({sql,args});if(sql==='SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE'&&args[0]==='node-3'){entered();await gate;}})))} as unknown as MySqlUnitOfWork;
        const hello:RuntimeMessages['HelloRequest']={protocolVersion:3,nodeId:'node-2',bootId:'boot-2',agentBuild:'test',capabilities:[...f.input.nodes[1]!.facts.capabilities],lastStoredSnapshotGeneration:0};
        const pending=f.controller(facade).hello('node-2',hello),other=await f.db.pool.getConnection();
        try{await locked;await other.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await other.beginTransaction();
            for(const n of f.input.nodes)await assert.rejects(rows(other,'SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE NOWAIT',[n.facts.nodeId]),{code:'ER_LOCK_NOWAIT'});
            await rows(other,'SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE NOWAIT',['unrelated']);
            assert.deepEqual(trace.filter(s=>s.sql==='SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE').map(s=>s.args),[['node-1'],['node-2'],['node-3']]);
            assert.equal(trace.some(s=>s.sql==='SELECT * FROM nodes WHERE id=? FOR SHARE'),false,'target facts await complete related-Node lock closure');
        }finally{release();await other.rollback();other.release();}
        assert.equal((await pending).sessionEpoch,2);
    });
});

test('11 real canonical MySQL pending deployments preserve latest-generation eligibility updated-time/ID ties and the independent100-row cap',{skip:!databaseURL},async()=>{
    await withDatabase(async f=>{
        await f.db.transaction(async tx=>{
            await write(tx,"UPDATE relay_deployments SET stage='withdrawn'");
            async function seed(id:string,stage:string,at:number,history=false){
                await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)',[id,f.input.forward.scopeId,1,JSON.stringify(f.input.forward.spec)]);
                const body={...f.plan,forwardId:id};
                if(history)await write(tx,'INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,body,created_at,updated_at,stage) VALUES(?,?,?,?,?,?,?,?,?)',[id,1,1,'node-1','node-3',JSON.stringify(body),0,0,'active']);
                await write(tx,'INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,body,created_at,updated_at,stage) VALUES(?,?,?,?,?,?,?,?,?)',[id,2,1,'node-1','node-3',JSON.stringify(body),0,at,stage]);
            }
            for(let index=104;index>=0;index--)await seed('p'+String(index).padStart(3,'0'),'preparing',1+Math.floor(index/3),true);
            for(const id of ['a-accepted','a-running','a-cleanup','a-superseded-cleanup','excluded-failed','excluded-recovery','excluded-superseded','excluded-historical'])await seed(id,'withdrawn',0,id==='excluded-historical');
        });
        await f.operation('accepted','accepted',false,false,'a-accepted');await f.operation('running','running',false,false,'a-running');await f.operation('cleanup','failed',true,false,'a-cleanup');await f.operation('superseded-cleanup','superseded',true,false,'a-superseded-cleanup');await f.operation('excluded-failed','failed',false,false,'excluded-failed');await f.operation('excluded-recovery','accepted',true,true,'excluded-recovery');await f.operation('excluded-superseded','superseded',false,false,'excluded-superseded');
        const before=await inventory(f.db),store=new MySqlRelayDeploymentStore();
        const result=await f.db.transaction(tx=>store.pendingDeployments(tx));
        assert.equal(result.length,100);assert.deepEqual(result.map(r=>r.forward_id),['a-accepted','a-cleanup','a-running','a-superseded-cleanup',...Array.from({length:96},(_,i)=>'p'+String(i).padStart(3,'0'))]);assert.ok(result.every(r=>r.generation===2));
        assert.deepEqual(await inventory(f.db),before);
    });
});

test('11 real canonical Node credential owner keeps current-pin refusal separate from issued retiring authority at before/equal overlap cutoff in every Relay phase',{skip:!databaseURL},async()=>{
    await withDatabase(async f=>{
        await f.operation('running');const cutoff=f.state.now+10000;
        await f.db.transaction(async tx=>{for(const [index,n]of f.input.nodes.entries()){
            await write(tx,'UPDATE node_relay_credentials SET retire_after=? WHERE fingerprint=?',[cutoff,n.peers[0]!.fingerprint.slice(7)]);
            await write(tx,'INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',[String(index+4).repeat(64),n.facts.nodeId,f.state.now+1,f.state.now+3600000,'replacement synthetic database certificate']);
        }});
        f.state.now=cutoff-1;
        for(const phase of [{stage:'preparing',prepared:0,activated:0},{stage:'preparing',prepared:1,activated:0},{stage:'preparing',prepared:2,activated:0},{stage:'egress_active',prepared:3,activated:1},{stage:'egress_active',prepared:3,activated:2},{stage:'egress_active',prepared:3,activated:3},{stage:'active',prepared:3,activated:3}]){
            await f.db.transaction(tx=>write(tx,'UPDATE relay_deployments SET stage=?,prepared_count=?,activated_count=? WHERE forward_id=?',[phase.stage,phase.prepared,phase.activated,f.input.forward.id]));
            const trace:Statement[]=[];
            await f.db.transaction(async native=>{const supplied=traced(native,(sql,args)=>{trace.push({sql,args});});
                for(const n of f.plan.nodes)assert.deepEqual(await f.relay.assignments(supplied,n.nodeId),[],phase.stage);
                assert.equal(await f.relay.authorizationBound(supplied,f.plan.nodes.flatMap(n=>n.assignments)),cutoff);
            });
            const peerReads=trace.filter(s=>s.sql.startsWith('SELECT fingerprint,certificate,valid_until,retire_after FROM node_relay_credentials'));
            assert.ok(peerReads.some(s=>s.args.at(-1)===true));assert.ok(peerReads.some(s=>s.args.at(-1)===false));assert.ok(peerReads.every(s=>s.args[1]===cutoff-1&&s.args[2]===cutoff-1));
        }
        f.state.now=cutoff;
        await assert.rejects(f.db.transaction(tx=>f.relay.authorizationBound(tx,f.plan.nodes[0]!.assignments)),{code:'AUTHORIZATION_DENIED'});
        const history=await rows<{fingerprint:string;retire_after:number|null}>(f.db.pool,'SELECT fingerprint,retire_after FROM node_relay_credentials ORDER BY fingerprint');assert.equal(history.length,6);assert.equal(history.filter(c=>c.retire_after===cutoff).length,3,'expiry never deletes issued credential history');
    });
});

test('4 real canonical Runtime report/drain retains original supplied Tx and restores every owner table after each original SQL statement including post-write faults',{skip:!databaseURL},async()=>{
    await withDatabase(async f=>{
        await f.operation('retirement-owner','superseded',false);
        const node=f.plan.nodes[0]!,assignment=node.assignments.find(a=>a.protocol==='tcp')!,snapshot=compileSnapshot({nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,snapshotGeneration:1,issuedAt:new Date(f.state.now).toISOString(),validUntil:new Date(f.state.now+60000).toISOString(),assignments:[],tombstones:[{assignmentId:assignment.assignmentId,forwardId:assignment.forwardId,role:assignment.role,protocol:assignment.protocol,physicalProtocol:assignment.resource.protocol,port:assignment.resource.port,bindingFence:assignment.bindingFence,retirementGeneration:1}]});
        await f.db.transaction(async tx=>{
            await write(tx,'INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,?,?,?,?)',[node.nodeId,1,node.sessionEpoch,Date.parse(snapshot.validUntil),JSON.stringify(snapshot)]);await write(tx,'UPDATE runtime_nodes SET snapshot_generation=1 WHERE node_id=?',[node.nodeId]);
            await write(tx,'INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation) VALUES(?,?,?,?,?,?,?,?)',[node.nodeId,assignment.assignmentId,assignment.deploymentGeneration,assignment.bindingFence,assignment.forwardId,'retirement-owner',JSON.stringify(assignment),1]);
            await write(tx,'INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) VALUES(?,?,?,?,?,?,?)',[assignment.forwardId,node.nodeId,assignment.assignmentId,assignment.deploymentGeneration,assignment.bindingFence,node.sessionEpoch,f.state.now+60000]);
        });
        const report:RuntimeMessages['ReportRequest']={protocolVersion:3,nodeId:node.nodeId,bootId:'boot-'+node.sessionEpoch,sessionEpoch:node.sessionEpoch,reportSequence:1,observedAt:new Date(f.state.now).toISOString(),acceptedSnapshotGeneration:1,observations:[],drains:[{assignmentId:assignment.assignmentId,deploymentGeneration:assignment.deploymentGeneration,bindingFence:assignment.bindingFence,condition:'removed',remainingConnections:0,startedAt:new Date(f.state.now).toISOString(),deadline:new Date(f.state.now+60000).toISOString()}]};
        const before=await inventory(f.db),sentinel=new Error('counting transaction rollback'),failure=new Error('after original native Runtime statement'),trace:Statement[]=[];let nth=0,counting=true,count=0;
        const facade={pool:f.db.pool,transaction:<T>(run:(tx:Transaction)=>Promise<T>)=>f.db.transaction(async native=>{count=0;const supplied=traced(native,(sql,args)=>{trace.push({sql,args});if(++count===nth)throw failure;});const result=await run(supplied);if(counting)throw sentinel;return result;})} as unknown as MySqlUnitOfWork;
        const runtime=f.controller(facade);await assert.rejects(runtime.report(node.nodeId,node.sessionEpoch,report),e=>e===sentinel);const statements=count,reference=[...trace];assert.ok(statements>10);
        assert.deepEqual(reference.filter(s=>s.sql==='SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE').map(s=>s.args),[['node-1'],['node-2'],['node-3']]);
        const removed=reference.findIndex(s=>s.sql.startsWith('UPDATE retirements SET removed_epoch=')),saved=reference.findIndex(s=>s.sql.startsWith('INSERT INTO reports')),safe=reference.findIndex(s=>s.sql.startsWith('UPDATE retirements SET safe=TRUE'));
        assert.ok(removed>=0&&saved>removed&&safe>saved);assert.deepEqual(await inventory(f.db),before);
        counting=false;
        for(nth=1;nth<=statements;nth++){trace.length=0;await assert.rejects(runtime.report(node.nodeId,node.sessionEpoch,report),e=>e===failure,`statement ${nth}`);assert.deepEqual(trace,reference.slice(0,nth));assert.deepEqual(await inventory(f.db),before,`statement ${nth} rollback`);}
        nth=0;trace.length=0;const ack=await runtime.report(node.nodeId,node.sessionEpoch,report);assert.equal(ack.status,'accepted');
        const retirement=(await rows<{removed_epoch:number;safe:number}>(f.db.pool,'SELECT removed_epoch,safe FROM retirements'))[0]!;assert.deepEqual(retirement,{removed_epoch:node.sessionEpoch,safe:1});
        const committed=await inventory(f.db);assert.equal((await runtime.report(node.nodeId,node.sessionEpoch,report)).status,'duplicate');assert.deepEqual(await inventory(f.db),committed);
    });
});
