import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { ProbeInstances, ProbeTypeRegistry, ProbeServiceRegistry, probeInstanceStorageValues, probeQualificationStorageValues } from '../src/modules/probe-owner/public.ts';
import type { ProbeInstanceRecord, ProbeTypeQualification } from '../src/modules/probe-owner/public.ts';
import { MySqlProbeInstanceStore } from '../src/infrastructure/mysql-probe-instance-store.ts';
import { MySqlProbeQualificationStore } from '../src/infrastructure/mysql-probe-qualification-store.ts';
import { MySqlProbeInstances } from '../src/infrastructure/mysql-probe-instances.ts';
import { MySqlProbeTypeQualifications } from '../src/infrastructure/mysql-probe-type-qualifications.ts';
import { MySqlProbeMachineReader } from '../src/infrastructure/mysql-probe-machine.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { TransactionBoundary } from '../src/framework/public.ts';
import type { ProbeTypesQualificationRequest, ProbeServicesQualificationRequest } from '../src/compatibility/public.ts';

const databaseUrl=process.env.TUNEX_TEST_DATABASE_URL,fp='a'.repeat(64),instanceId='1'.repeat(64);
const typedRequest=(action:ProbeTypesQualificationRequest['action']='register'):ProbeTypesQualificationRequest=>({protocolVersion:3,probeVersion:2,kind:'probe-types-instance',nodeId:'node',bootId:'boot',sessionEpoch:2,instanceId,instanceGeneration:1,requestId:'3'.repeat(64),action,measurements:['tcp-connect-v1','tcp-ingress-connect-v1']});
const servicesRequest=(action:ProbeServicesQualificationRequest['action']='register'):ProbeServicesQualificationRequest=>({...typedRequest(action),probeVersion:3,kind:'probe-services-instance',measurements:['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1']});
const nativeInstances=()=>new MySqlProbeInstanceStore(probeInstanceStorageValues),nativeProofs=()=>new MySqlProbeQualificationStore(probeQualificationStorageValues);

test('79/80 native/legacy stores keep identical SQL values, constructor defaults and recovery projection',async t=>{
    const now=1800000000000,instance:ProbeInstanceRecord={nodeId:'node',bootId:'boot',sessionEpoch:2,fingerprint:fp,instanceId,generation:1,state:'registered',registeredAt:now,expiresAt:now+30000,revokedAt:null},proof:ProbeTypeQualification={nodeId:'node',bootId:'boot',sessionEpoch:2,fingerprint:fp,instanceId,instanceGeneration:1,state:'qualified',qualifiedAt:now,expiresAt:now+30000,servicesVersion:1};
    let instanceRow:Record<string,unknown>={node_id:'node',boot_id:'boot',session_epoch:2,fingerprint:fp,instance_id:instanceId,generation:1,state:'registered',registered_at:now,expires_at:now+30000,revoked_at:null};
    let proofRow:Record<string,unknown>={node_id:'node',boot_id:'boot',session_epoch:2,fingerprint:fp,instance_id:instanceId,instance_generation:1,state:'qualified',qualified_at:now,expires_at:now+30000,services_version:1,echo_version:null};
    const calls:{sql:string;args:unknown[]}[]=[],tx={async execute(sql:string,args:unknown[]=[]){calls.push({sql,args});return sql.startsWith('SELECT')?[[sql.includes('probe_type_qualifications')?proofRow:instanceRow],[]]:[{affectedRows:1},[]];}} as unknown as Transaction;
    for(const operation of ['read','readCurrent','lock'] as const){calls.length=0;const actual=await nativeInstances()[operation](tx,'node'),native=structuredClone(calls);calls.length=0;assert.deepEqual(await new MySqlProbeInstances()[operation](tx,'node'),actual);assert.deepEqual(calls,native);}
    for(const lock of [false,true]){calls.length=0;const actual=await nativeProofs().get(tx,'node',lock),native=structuredClone(calls);calls.length=0;assert.deepEqual(await new MySqlProbeTypeQualifications().get(tx,'node',lock),actual);assert.deepEqual(calls,native);assert.match(calls.at(-1)!.sql,lock?/FOR UPDATE/:/FOR SHARE/);}
    calls.length=0;await nativeProofs().put(tx,proof);const nativePut=structuredClone(calls);calls.length=0;await new MySqlProbeTypeQualifications().put(tx,proof);assert.deepEqual(calls,nativePut);assert.deepEqual(calls[0]!.args.slice(-2),[1,null]);assert.match(calls[0]!.sql,/COALESCE\(VALUES\(services_version\),services_version\)/);
    calls.length=0;await nativeInstances().replace(tx,1,{...instance,generation:2,instanceId:'2'.repeat(64)});const nativeReplace=structuredClone(calls);calls.length=0;await new MySqlProbeInstances().replace(tx,1,{...instance,generation:2,instanceId:'2'.repeat(64)});assert.deepEqual(calls,nativeReplace);
    for(const patch of [{services_version:2},{services_version:null,echo_version:1},{qualified_at:now+30000,expires_at:now}]){const saved=proofRow;proofRow={...proofRow,...patch};await assert.rejects(nativeProofs().get(tx,'node'),{code:'INTEGRITY_FAILURE'});proofRow=saved;}
    const saved=instanceRow;instanceRow={...instanceRow,generation:'1'};await assert.rejects(nativeInstances().read(tx,'node'),{code:'PROBE_INSTANCE_CORRUPT'});instanceRow=saved;
    calls.length=0;await MySqlProbeQualificationStore.quarantineRecovery(tx);const recovery=structuredClone(calls);calls.length=0;await MySqlProbeTypeQualifications.quarantineRecovery(tx);assert.deepEqual(calls,recovery);assert.match(calls[0]!.sql,/state='quarantined' WHERE state='qualified'/);
    t.mock.method(Date,'now',()=>now);calls.length=0;await MySqlProbeInstanceStore.quarantineRecovery(tx);const instanceRecovery=structuredClone(calls);calls.length=0;await MySqlProbeInstances.quarantineRecovery(tx);assert.deepEqual(calls,instanceRecovery);assert.match(calls[0]!.sql,/generation>0/);assert.equal(/SET generation/.test(calls[0]!.sql),false);assert.deepEqual(calls[0]!.args,[now]);
});

test('79/80 lower native storage validation stays after locked row reads and before each write without moving seed timing',async()=>{
    const events:string[]=[],now=1800000000000,proof:ProbeTypeQualification={nodeId:'node',bootId:'boot',sessionEpoch:2,fingerprint:fp,instanceId,instanceGeneration:1,state:'qualified',qualifiedAt:now,expiresAt:now+30000};
    const failure=new Error('original value parser failure');let empty=true,failRead=false;
    const tx={async execute(sql:string){events.push(sql.startsWith('SELECT')?'select':'write');return sql.startsWith('SELECT')?[[empty?{node_id:'node',instance_generation:0,state:'empty',boot_id:null,session_epoch:null,fingerprint:null,instance_id:null,qualified_at:null,expires_at:null,services_version:null,echo_version:null}:{node_id:'node',instance_generation:1,state:'qualified',boot_id:'boot',session_epoch:2,fingerprint:fp,instance_id:instanceId,qualified_at:now,expires_at:now+30000,services_version:null,echo_version:null}],[]]:[{affectedRows:1},[]];}} as unknown as Transaction;
    const store=new MySqlProbeQualificationStore({read(value){events.push('parse');if(failRead)throw failure;return probeQualificationStorageValues.read(value);}});
    assert.equal(await store.get(tx,'node',true),null);assert.deepEqual(events,['write','select']);empty=false;events.length=0;await store.get(tx,'node',true);assert.deepEqual(events,['write','select','parse']);events.length=0;await store.put(tx,proof);assert.deepEqual(events,['parse','write']);
    failRead=true;events.length=0;await assert.rejects(store.get(tx,'node'),error=>error===failure);assert.deepEqual(events,['select','parse']);events.length=0;await assert.rejects(store.put(tx,proof),error=>error===failure);assert.deepEqual(events,['parse']);
    const instance:ProbeInstanceRecord={nodeId:'node',bootId:'boot',sessionEpoch:2,fingerprint:fp,instanceId,generation:1,state:'registered',registeredAt:now,expiresAt:now+30000,revokedAt:null};
    const instances=new MySqlProbeInstanceStore({read(value,node){events.push('instance-parse');return probeInstanceStorageValues.read(value,node);},closing(expected,value){events.push('closing');return probeInstanceStorageValues.closing(expected,value);}});events.length=0;await instances.replace(tx,0,instance);assert.deepEqual(events,['instance-parse','closing','write']);events.length=0;await assert.rejects(instances.replace(tx,1,instance),{code:'PROBE_INSTANCE_CONFLICT'});assert.deepEqual(events,['instance-parse','closing']);
});

async function fixture(){
    const name='tunex_registry_complete_'+randomUUID().replaceAll('-',''),admin=await createConnection(databaseUrl!),url=new URL(databaseUrl!);url.pathname='/'+name;
    const db=new MySqlUnitOfWork(url.toString()),peer=new MySqlUnitOfWork(url.toString());let created=false,writer:Connection|undefined;
    const close=async()=>{try{await writer?.end();await peer.close();await db.close();}finally{try{if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}};
    const assemble=(boundary:TransactionBoundary<Transaction>)=>{const instances=nativeInstances(),proofs=nativeProofs(),machines=new MySqlProbeMachineReader();return{instances,proofs,owner:new ProbeInstances(boundary,machines,instances),types:new ProbeTypeRegistry(boundary,machines,instances,proofs),services:new ProbeServiceRegistry(boundary,machines,instances,proofs)};};
    try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();writer=await createConnection(url.toString());const now=Date.now();
        await writer.execute("INSERT INTO accounts(id,token_hash) VALUES('owner',?)",[randomBytes(32).toString('hex')]);await writer.execute("INSERT INTO scopes(id,owner_id) VALUES('scope','owner')");await writer.execute("INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES('node','scope',?,0,?,?)",[randomBytes(32).toString('hex'),now+600000,JSON.stringify({capabilities:['adp.3','native.direct.v1','tcp','probe.tcp-connect.v1','probe.tcp-ingress-connect.v1','probe.tcp-ingress-tls.v1']})]);await writer.execute("INSERT INTO runtime_nodes(node_id,boot_id,session_epoch) VALUES('node','boot',2)");await writer.execute("INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,'node',?,?)",[fp,now,now+600000]);
        const snapshot=async()=>{const result=[];for(const table of ['probe_instances','probe_type_qualifications']){const[rows]=await writer!.query<RowDataPacket[]>(`SELECT * FROM \`${table}\` ORDER BY node_id`);result.push([table,rows]);}return JSON.stringify(result);};
        return{db,peer,writer,close,assemble,host:assemble(db),independent:assemble(peer),snapshot};
    }catch(error){await close();throw error;}
}

test('79/80 real canonical MySQL serializes first-slot allocation and shared qualification seed/upgrade without rotating a live instance', {skip:!databaseUrl,timeout:60000},async()=>{
    const f=await fixture();try{
        const command={bootId:'boot',instanceId,expectedGeneration:0},other={...command,instanceId:'2'.repeat(64)},race=await Promise.allSettled([f.host.owner.register('node',fp,2,command),f.independent.owner.register('node',fp,2,other)]);assert.equal(race.filter(value=>value.status==='fulfilled').length,1);const winner=race.find(value=>value.status==='fulfilled');assert.ok(winner?.status==='fulfilled');const winnerInput=winner.value.instanceId===instanceId?command:other;
        assert.deepEqual(await f.independent.owner.register('node',fp,2,winnerInput),winner.value);const originalSlot=await f.db.transaction(tx=>f.host.instances.read(tx,'node'));const typeInput={...typedRequest(),instanceId:winner.value.instanceId},serviceInput={...servicesRequest(),instanceId:winner.value.instanceId};
        const[typed,service]=await Promise.all([f.host.types.handle('node',fp,2,typeInput),f.independent.services.handle('node',fp,2,serviceInput)]);assert.equal(typed.qualified,true);assert.equal(service.qualified,true);const proof=await f.db.transaction(tx=>f.host.proofs.get(tx,'node'));assert.equal(proof!.servicesVersion,1);assert.equal('echoVersion' in proof!,false);assert.deepEqual(await f.db.transaction(tx=>f.host.instances.read(tx,'node')),originalSlot);assert.ok(proof);
        const persisted=await f.snapshot();await f.independent.types.handle('node',fp,2,typeInput);await f.host.services.handle('node',fp,2,serviceInput);assert.equal(await f.snapshot(),persisted);
        await f.host.types.handle('node',fp,2,{...typeInput,action:'revoke'});await assert.rejects(f.independent.services.handle('node',fp,2,serviceInput),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal((await f.db.transaction(tx=>f.host.proofs.get(tx,'node')))!.servicesVersion,1);
    }finally{await f.close();}
});

test('79/80 real canonical MySQL current-slot share lock and qualification update lock block independent owner writes until original transaction ends', {skip:!databaseUrl,timeout:60000},async()=>{
    const f=await fixture();try{
        const shortWait:TransactionBoundary<Transaction>={transaction:action=>f.peer.transaction(async tx=>{await tx.execute('SET SESSION innodb_lock_wait_timeout=1');return action(tx);})},peer=f.assemble(shortWait),command={bootId:'boot',instanceId,expectedGeneration:0};await f.host.owner.register('node',fp,2,command);
        await f.db.transaction(async tx=>{assert.equal((await f.host.instances.readCurrent(tx,'node'))!.generation,1);await assert.rejects(peer.owner.register('node',fp,2,{...command,instanceId:'2'.repeat(64),expectedGeneration:1}),{code:'ER_LOCK_WAIT_TIMEOUT'});assert.equal((await f.host.instances.read(tx,'node'))!.generation,1);});
        await f.db.transaction(async tx=>{assert.equal(await f.host.proofs.get(tx,'node',true),null);await assert.rejects(peer.types.handle('node',fp,2,typedRequest()),{code:'ER_LOCK_WAIT_TIMEOUT'});});
        assert.equal((await f.independent.types.handle('node',fp,2,typedRequest())).qualified,true);await f.db.transaction(async tx=>{assert.equal((await f.host.proofs.get(tx,'node',true))!.state,'qualified');await assert.rejects(peer.services.handle('node',fp,2,servicesRequest()),{code:'ER_LOCK_WAIT_TIMEOUT'});assert.equal((await f.host.proofs.get(tx,'node'))!.servicesVersion,undefined);});assert.equal((await f.independent.services.handle('node',fp,2,servicesRequest())).qualified,true);
    }finally{await f.close();}
});

test('79/80 real canonical MySQL rolls back each absent seed/replacement/proof/upgraded marker/revoke write and static recovery', {skip:!databaseUrl,timeout:60000},async()=>{
    const f=await fixture();try{
        const failure=new Error('after exact native SQL write'),failing=(nth:number):TransactionBoundary<Transaction>=>({transaction:action=>f.db.transaction(tx=>{let count=0;const wrapped={execute:async(sql:string,args:unknown[])=>{const result=await tx.execute(sql,args);if(/^(INSERT|UPDATE|DELETE)\b/.test(sql.trim())&&++count===nth)throw failure;return result;}} as unknown as Transaction;return action(wrapped);})});
        const command={bootId:'boot',instanceId,expectedGeneration:0};
        for(const nth of [1,2]){const before=await f.snapshot(),host=f.assemble(failing(nth));await assert.rejects(host.owner.register('node',fp,2,command),error=>error===failure);assert.equal(await f.snapshot(),before);}
        await f.host.owner.register('node',fp,2,command);
        for(const nth of [1,2]){const before=await f.snapshot(),host=f.assemble(failing(nth));await assert.rejects(host.owner.register('node',fp,2,{...command,instanceId:'2'.repeat(64),expectedGeneration:1}),error=>error===failure);assert.equal(await f.snapshot(),before);}
        for(const version of [2,3] as const)for(const nth of [1,2])for(const action of ['register','revoke'] as const){const before=await f.snapshot(),host=f.assemble(failing(nth));await assert.rejects(version===2?host.types.handle('node',fp,2,typedRequest(action)):host.services.handle('node',fp,2,servicesRequest(action)),error=>error===failure);assert.equal(await f.snapshot(),before);}
        await f.host.types.handle('node',fp,2,typedRequest());
        for(const nth of [1,2]){const before=await f.snapshot(),host=f.assemble(failing(nth));await assert.rejects(host.services.handle('node',fp,2,servicesRequest()),error=>error===failure);assert.equal(await f.snapshot(),before);await assert.rejects(host.services.handle('node',fp,2,servicesRequest('revoke')),error=>error===failure);assert.equal(await f.snapshot(),before);await assert.rejects(host.owner.revoke('node',fp,2,{...command,expectedGeneration:1}),error=>error===failure);assert.equal(await f.snapshot(),before);}
        await f.host.services.handle('node',fp,2,servicesRequest());const before=await f.snapshot();
        for(const recover of [MySqlProbeInstanceStore.quarantineRecovery,MySqlProbeQualificationStore.quarantineRecovery]){await assert.rejects(f.db.transaction(async tx=>{await recover(tx);throw failure;}),error=>error===failure);assert.equal(await f.snapshot(),before);}
        await f.db.transaction(async tx=>{await MySqlProbeInstanceStore.quarantineRecovery(tx);await MySqlProbeQualificationStore.quarantineRecovery(tx);});const instance=await f.db.transaction(tx=>f.host.instances.read(tx,'node')),proof=await f.db.transaction(tx=>f.host.proofs.get(tx,'node'));assert.equal(instance!.generation,1);assert.equal(instance!.state,'quarantined');assert.equal(proof!.state,'quarantined');assert.equal(proof!.servicesVersion,1);assert.equal(proof!.instanceGeneration,1);await assert.rejects(f.host.services.handle('node',fp,2,servicesRequest()),{code:'PROBE_PERMIT_UNAVAILABLE'});
    }finally{await f.close();}
});
