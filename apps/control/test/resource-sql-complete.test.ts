import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import type { Forward } from '@tunex/core';
import { MAX_COUNTER } from '@tunex/core';
import { DEFAULT_POLICY } from '@tunex/contracts';
import { RuntimeResources } from '../src/framework/public.ts';
import { MySqlRuntimeResourceStore, createMySqlRuntimeResources } from '../src/infrastructure/mysql-runtime-resources.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

const forward:Forward={id:'forward-a',scopeId:'scope-a',revision:1,spec:{enabled:true,protocols:['udp','tcp'],
    ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:9000}},target:{host:'example.test',port:80}}};

test('8 original resource store SQL keeps every supplied receiver argument result absence and owner fence generation predicate',async()=>{
    const store=new MySqlRuntimeResourceStore(),key={nodeId:'node-a',protocol:'tcp' as const,port:9000},calls:unknown[][]=[];
    let answer:unknown[]=[{node_id:'node-a',protocol:'udp',port:9000,session_epoch:2,until:0,n:3,owner_id:'forward-a',fence:4,deployment_generation:5}],error:unknown;
    const tx={async execute(sql:string,args:unknown[]){assert.equal(this,tx);calls.push([sql,args]);if(error)throw error;return [sql.startsWith('SELECT')?answer:{affectedRows:7},[]];}} as unknown as Transaction;
    const cases:[()=>Promise<unknown>,string,unknown[]][]=[
        [()=>store.lockedNodes(tx,'node-a'),'SELECT node_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',['node-a']],
        [()=>store.exclusiveSlot(tx,key),'SELECT owner_id,fence FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',['node-a','tcp',9000]],
        [()=>store.ownedSlotCount(tx,'node-a'),'SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',['node-a']],
        [()=>store.initializeNode(tx,'node-a'),'INSERT INTO runtime_nodes(node_id) VALUES(?)',['node-a']],
        [()=>store.lockNode(tx,'node-a'),'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE',['node-a']],
        [()=>store.maximumAuthorization(tx,'node-a'),'SELECT MAX(valid_until) until FROM execution_leases WHERE node_id=?',['node-a']],
        [()=>store.ensureSlot(tx,key),'INSERT INTO port_slots(node_id,protocol,port) VALUES(?,?,?) ON DUPLICATE KEY UPDATE port=port',['node-a','tcp',9000]],
        [()=>store.lockSlot(tx,key),'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',['node-a','tcp',9000]],
        [()=>store.lockOwnedSlots(tx,'node-a','forward-a'),'SELECT * FROM port_slots WHERE node_id=? AND owner_id=? FOR UPDATE',['node-a','forward-a']],
        [()=>store.assignSlot(tx,key,'forward-a',5),'UPDATE port_slots SET owner_id=?,fence=fence+1,deployment_generation=? WHERE node_id=? AND protocol=? AND port=?',['forward-a',5,'node-a','tcp',9000]],
        [()=>store.countOwnedSlots(tx,'node-a'),'SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',['node-a']],
        [()=>store.ownedSlots(tx,'forward-a'),'SELECT node_id,protocol,port FROM port_slots WHERE owner_id=?',['forward-a']],
        [()=>store.releaseSlot(tx,key,'forward-a'),'UPDATE port_slots SET owner_id=NULL WHERE node_id=? AND protocol=? AND port=? AND owner_id=?',['node-a','tcp',9000,'forward-a']],
        [()=>store.releaseExactSlot(tx,key,'forward-a',4,5),'UPDATE port_slots SET owner_id=NULL WHERE node_id=? AND protocol=? AND port=? AND owner_id=? AND fence=? AND deployment_generation=?',['node-a','tcp',9000,'forward-a',4,5]],
        [()=>store.releaseForwardSlots(tx,'forward-a'),'UPDATE port_slots SET owner_id=NULL WHERE owner_id=?',['forward-a']],
    ];
    for(const [action,sql,args] of cases){calls.length=0;await action();assert.deepEqual(calls,[[sql,args]]);}
    assert.equal(await store.lockNode(tx,'node-a'),answer[0]);assert.equal(await store.lockSlot(tx,key),answer[0]);
    assert.equal(await store.lockOwnedSlots(tx,'node-a','forward-a'),answer);assert.equal(await store.maximumAuthorization(tx,'node-a'),0);
    assert.equal(await store.countOwnedSlots(tx,'node-a'),3);assert.equal(await store.releaseExactSlot(tx,key,'forward-a',4,5),7);
    assert.deepEqual(await store.ownedSlots(tx,'forward-a'),[{nodeId:'node-a',protocol:'udp',port:9000}]);
    answer=[{until:null}];assert.equal(await store.maximumAuthorization(tx,'node-a'),null);
    answer=[];assert.equal(await store.lockNode(tx,'node-a'),undefined);assert.equal(await store.exclusiveSlot(tx,key),undefined);assert.equal(await store.ownedSlotCount(tx,'node-a'),undefined);
    assert.equal(await store.lockSlot(tx,key),undefined);await assert.rejects(store.maximumAuthorization(tx,'node-a'),TypeError);await assert.rejects(store.countOwnedSlots(tx,'node-a'),TypeError);
    for(const [action] of cases){error=new Error('original resource driver error');calls.length=0;await assert.rejects(action,failure=>failure===error);assert.equal(calls.length,1);}
});

test('8 resource native constructors keep supplied explicit zero/default capacity no connection and original missing node/epoch semantics',async()=>{
    const native=createMySqlRuntimeResources(),zero=createMySqlRuntimeResources(0);
    const bound=(value:unknown)=>value as {store:unknown;maxAssignmentsPerNode:number};
    assert.equal(bound(native).maxAssignmentsPerNode,DEFAULT_POLICY.maxAssignmentsPerNode);assert.equal(bound(zero).maxAssignmentsPerNode,0);
    assert.ok(bound(native).store instanceof MySqlRuntimeResourceStore);assert.notEqual(bound(native).store,bound(zero).store);
    const tx={async execute(sql:string){assert.equal(this,tx);assert.equal(sql,'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE');return [[{session_epoch:0}],[]];}} as unknown as Transaction;
    await native.lockNode(tx,'node-a');for(const epoch of [0,-1,1,1.1,NaN,Infinity,MAX_COUNTER+1])await assert.rejects(native.lockNode(tx,'node-a',epoch),{code:'SESSION_SUPERSEDED'});
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>){
    const admin=await createConnection(databaseURL!),name='tunex_resource_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+name;
    const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();
        await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['owner','a'.repeat(64)]);await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope-a','owner']);
            for(const [index,id] of ['node-a','node-b'].entries()){await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)',[id,'scope-a',String(index).repeat(64),900000,'{}']);await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',[id,2]);}
            await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)',[forward.id,forward.scopeId,1,JSON.stringify(forward.spec)]);
        });await action(db);
    }finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
}

test('8 real MySQL resource capacity failures roll back all reservations and preserve physical owner fence and old generation drain slots',
    {skip:!databaseURL,timeout:60000},async()=>withDatabase(async db=>{
        const store=new MySqlRuntimeResourceStore(),host=createMySqlRuntimeResources(1);
        await assert.rejects(db.transaction(tx=>host.reserve(tx,forward)),{code:'RESOURCE_LIMIT'});
        assert.equal((await rows<RowDataPacket>(db.pool,'SELECT COUNT(*) n FROM port_slots'))[0]!.n,0);
        const full=createMySqlRuntimeResources(4);const first=await db.transaction(tx=>full.reserve(tx,forward));
        assert.deepEqual(first.map(slot=>[slot.protocol,slot.bindingFence,slot.deploymentGeneration]),[['tcp',1,1],['udp',1,1]]);
        await assert.rejects(db.transaction(tx=>full.reserve(tx,forward)),{code:'PORT_RESERVED'});
        const next:Forward={...forward,revision:7,spec:{...forward.spec,ingress:{...forward.spec.ingress,listen:{address:'127.0.0.1',port:9001}}}};
        await db.transaction(async tx=>{await full.lockNode(tx,'node-a',2);const result=await full.transition(tx,forward,next);assert.deepEqual(result.map(slot=>slot.deploymentGeneration),[7,7]);
            assert.equal((await store.ownedSlots(tx,forward.id)).length,4);await full.releaseObsoleteSlots(tx,next);assert.deepEqual((await store.ownedSlots(tx,forward.id)).map(slot=>slot.port),[9001,9001]);});
        const before=await rows(db.pool,'SELECT * FROM port_slots ORDER BY node_id,protocol,port');
        await assert.rejects(db.transaction(tx=>new RuntimeResources(store,1).reserveRelay(tx,next,[
            {nodeId:'node-b',role:'egress',forwardProtocol:'udp',physicalProtocol:'tcp',address:'127.0.0.1',port:9100},
            {nodeId:'node-a',role:'ingress',forwardProtocol:'udp',physicalProtocol:'tcp',address:'127.0.0.1',port:9001},
        ],9)),{code:'RESOURCE_LIMIT'});
        assert.deepEqual(await rows(db.pool,'SELECT * FROM port_slots ORDER BY node_id,protocol,port'),before);
        const reserved=await db.transaction(tx=>full.reserveRelay(tx,next,[
            {nodeId:'node-a',role:'ingress',forwardProtocol:'udp',physicalProtocol:'tcp',address:'127.0.0.1',port:9001},
            {nodeId:'node-b',role:'egress',forwardProtocol:'udp',physicalProtocol:'tcp',address:'127.0.0.1',port:9100},
        ],9));assert.deepEqual(reserved.map(slot=>[slot.physicalProtocol,slot.forwardProtocol,slot.bindingFence,slot.deploymentGeneration]),[['tcp','udp',2,9],['tcp','udp',1,9]]);
        await db.transaction(async tx=>{const key={nodeId:'node-a',protocol:'tcp' as const,port:9001};
            assert.equal(await store.releaseExactSlot(tx,key,'other',2,9),0);assert.equal(await store.releaseExactSlot(tx,key,forward.id,1,9),0);
            assert.equal(await store.releaseExactSlot(tx,key,forward.id,2,8),0);assert.equal(await store.releaseExactSlot(tx,key,forward.id,2,9),1);
            await full.retainSlots(tx,forward.id,[{nodeId:'node-b',protocol:'tcp',port:9100}]);assert.deepEqual(await store.ownedSlots(tx,forward.id),[{nodeId:'node-b',protocol:'tcp',port:9100}]);
            await full.releaseForwardSlots(tx,forward.id);assert.deepEqual(await store.ownedSlots(tx,forward.id),[]);
        });
    }));
