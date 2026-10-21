import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { ControlApplication } from '../src/application/control.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import { MySqlResourceAccessStore } from '../src/infrastructure/mysql-resource-access.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import { ControlError } from '../src/framework/public.ts';
import { IngressDeployments, IngressMigrations, ingressDeploymentStorageValues, ingressMigrationStorageValues } from '../src/modules/ingress-owner/public.ts';
import type { IngressPlan, IngressAttempt, IngressMigrationPlan, IngressMigrationAttempt, IngressOriginRef } from '../src/modules/ingress-owner/public.ts';
import { MySqlIngressDeploymentStore } from '../src/infrastructure/mysql-ingress-deployment-store.ts';
import { MySqlIngressMigrationStore } from '../src/infrastructure/mysql-ingress-migration-store.ts';
import { MySqlIngressDeploymentRecoveryStore } from '../src/infrastructure/mysql-ingress-deployment-recovery-store.ts';
import { MySqlIngressMigrationRecoveryStore } from '../src/infrastructure/mysql-ingress-migration-recovery-store.ts';
import { pathRequirements, parsePathTemplate } from '../src/modules/path-owner/public.ts';
import type { PathPublicationFailure } from '../src/modules/path-owner/public.ts';

const databaseUrl=process.env.TUNEX_TEST_DATABASE_URL;
async function inventory(connection:Connection,selected?:string[]){
    const [tables]=await connection.query<RowDataPacket[]>('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const values:unknown[]=[];
    for(const table of tables){if(selected&&!selected.includes(table.name))continue;assert.match(table.name,/^[a-z0-9_]+$/);const [records]=await connection.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);values.push([table.name,records.map(record=>JSON.stringify(record)).sort()]);}
    return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

test('60/61 original MySQL owners and Forward path admission retain same-Tx every-write rollback durable partial refusal exact lineage conditional compensation recovery replay and independent accepted work',
    {skip:!databaseUrl,timeout:240000},async()=>{
        const suffix=randomUUID().replaceAll('-',''),name='tunex_ingress_batches_'+suffix,url=new URL(databaseUrl!);url.pathname='/'+name;
        const admin=await createConnection(databaseUrl!),db=new MySqlUnitOfWork(url.toString());let created=false,connection:Connection|undefined;
        try{
            await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();connection=await createConnection(url.toString());
            const now=Date.now(),identity=new Identity(db);await identity.bootstrap('scope','owner',randomBytes(32).toString('base64url'));
            for(const actor of ['manager','viewer','other']){await connection.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)',[actor,tokenHash(randomBytes(32).toString('base64url'))]);await connection.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,?)',['scope',actor,actor!=='viewer']);}
            const nodes=new Nodes(db,identity,{} as NodeCertificateAuthority),control=new ControlApplication(db,identity,nodes,undefined,true);
            const config={version:1,protocols:['tcp','udp'],nodes:['ingress','middle','egress'],endpoints:[{nodeId:'middle',revision:1},{nodeId:'egress',revision:1}],transport:{profileId:'profile',configRevision:1}};
            const shortConfig={...config,nodes:['ingress','egress'],endpoints:[config.endpoints[1]!]};
            const secondIngress={...shortConfig,nodes:['ingress-b','egress']};
            for(const id of ['ingress','ingress-b','middle','egress']){
                const facts={nodeId:id,scopeId:'scope',capabilities:pathRequirements(parsePathTemplate(config)),allowedPorts:[32001,32002,32003,32004,32005,32006,32007],allowedListenerAddresses:['127.0.0.1'],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
                await connection.execute('INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,\'admin-shared\',NULL,1)',[id,'scope',createHash('sha256').update(id).digest('hex'),now,now+3600000,JSON.stringify(facts)]);
                // Real path acceptance requires an established session and a current bounded Relay pin even for disabled intent.
                await connection.execute('INSERT INTO runtime_nodes(node_id,session_epoch,boot_id) VALUES(?,1,?)',[id,'boot-'+id]);
                await connection.execute('INSERT INTO node_boots(node_id,boot_id,session_epoch) VALUES(?,?,1)',[id,'boot-'+id]);
                await connection.execute('INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',
                    [createHash('sha256').update('relay:'+id).digest('hex'),id,now,now+3600000,'synthetic persisted Relay credential for SQL acceptance only']);
                for(const actor of ['owner','manager'])await connection.execute('INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,?,?)',[id,actor,JSON.stringify([id.startsWith('ingress')?'ingress':id==='middle'?'transit':'egress']),JSON.stringify({allowedPorts:id.startsWith('ingress')?facts.allowedPorts:[32101,32102,32103,32104],maxBindings:16})]);
                // Keep a second exclusive TCP/UDP pair for the later independent replacement add; the original Forward retains its slots.
                if(id==='middle'||id==='egress')await connection.execute('INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,1,?,?,?)',[id,JSON.stringify({listenAddress:'127.0.0.1',advertisedHost:'127.0.0.1',allowedTcpPorts:[32101,32102,32103,32104]}),'owner',now]);
            }
            const profile={driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:1024,maxUdpDatagramBytes:1024,maxConnectionsPerNode:8};
            await control.transport.publish('owner','scope','profile','profile-create',0,profile);await connection.execute('INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)',['profile','manager']);
            const first=await control.pathTemplates.publish('manager','scope','saved','template-one',0,config),second=await control.pathTemplates.publish('manager','scope','saved','template-two',1,shortConfig),other=await control.pathTemplates.publish('manager','scope','saved-b','template-b',0,secondIngress);
            const selection=(id:string,revision:number,digest:string)=>({templateId:id,revision,configDigest:digest});
            const template1=selection('saved',1,first.body.configDigest),template2=selection('saved',2,second.body.configDigest),templateB=selection('saved-b',1,other.body.configDigest);
            const groupConfig1={schemaVersion:1,members:[{memberId:'a',template:template1},{memberId:'b',template:templateB}]},groupConfig2={schemaVersion:1,members:[{memberId:'a',template:template2},{memberId:'b',template:templateB}]};
            const g1=await control.ingressGroups.publish('manager','scope','group','group-one',0,groupConfig1),g2=await control.ingressGroups.publish('manager','scope','group','group-two',1,groupConfig2),g3=await control.ingressGroups.publish('manager','scope','group','group-three',2,groupConfig1);
            const group1={groupId:'group',revision:1,configDigest:g1.body.configDigest},group2={groupId:'group',revision:2,configDigest:g2.body.configDigest},group3={groupId:'group',revision:3,configDigest:g3.body.configDigest};
            const input={schemaVersion:1,group:group1,enabled:false,target:{host:'127.0.0.1',port:9000},items:[{memberId:'a',listen:{address:'127.0.0.1',port:32001}},{memberId:'b',listen:{address:'127.0.0.1',port:32002}}]};

            // The original providers receive this same PoolConnection proxy. Every intercepted statement runs on MySQL first.
            const injected=new Error('same transaction injected after original SQL'),probeComplete=new Error('successful probe rolled back');
            let failWrite=0,writes:string[]=[],rollbackProbe=false,knownRefusalSql:string|undefined;
            const traced={async transaction<T>(run:(tx:Transaction)=>Promise<T>){return db.transaction(async raw=>{
                const tx=new Proxy(raw,{get(target,key){if(key==='execute')return async(...args:any[])=>{const result=await (target.execute as (...args:any[])=>Promise<any>).apply(target,args);const sql=String(args[0]);if(/^(INSERT|UPDATE|DELETE)\b/i.test(sql)){writes.push(sql);if(knownRefusalSql&&sql.startsWith(knownRefusalSql))throw new ControlError('PORT_RESERVED',409,'known refusal after actual Forward mutation');if(failWrite===writes.length)throw injected;}return result;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
                const result=await run(tx);if(rollbackProbe)throw probeComplete;return result;
            });}};
            const deployments=new IngressDeployments(traced,identity,new ResourceAccess(identity,new MySqlResourceAccessStore()),control.idempotency,new MySqlIngressDeploymentStore<IngressPlan,IngressAttempt['outcome'],PathPublicationFailure>(ingressDeploymentStorageValues),control.ingressGroups,control.forwards);
            const migrations=new IngressMigrations(traced,identity,new ResourceAccess(identity,new MySqlResourceAccessStore()),control.idempotency,new MySqlIngressMigrationStore<IngressMigrationPlan,IngressMigrationAttempt['outcome'],PathPublicationFailure>(ingressMigrationStorageValues),control.ingressGroups,{resolveIn:(tx,actor,scope,ref)=>ref.kind==='deployment'?control.ingressDeployments.originIn(tx,actor,scope,ref):control.ingressMigrations.originIn(tx,actor,scope,ref)},control.forwards);
            async function everyWrite(label:string,run:()=>Promise<unknown>,required:string[]){
                const before=await inventory(connection!);writes=[];rollbackProbe=true;
                try{await assert.rejects(run(),error=>error===probeComplete,label+' successful probe must reach the original response');}finally{rollbackProbe=false;}
                const original=[...writes];assert.ok(original.length>0,label);for(const fragment of required)assert.ok(original.some(sql=>sql.includes(fragment)),label+': '+fragment);assert.equal(await inventory(connection!),before,label+' successful SQL probe rollback');
                for(let i=1;i<=original.length;i++){writes=[];failWrite=i;try{await assert.rejects(run(),error=>error===injected,label+' write '+i+': '+original[i-1]);}finally{failWrite=0;}assert.equal(writes.length,i,label+' original prefix');assert.equal(await inventory(connection!),before,label+' rollback after original SQL '+i);}
                writes=[];
            }
            const preview=await deployments.preview('manager','scope',input);
            await everyWrite('deployment create',()=>deployments.create('manager','scope','probe-deployment-create',input,preview.previewDigest),['INSERT INTO ingress_deployments','INSERT INTO ingress_deployment_events','UPDATE idempotency SET http_status']);
            await connection.execute('DELETE FROM node_grants WHERE node_id=? AND actor_id=?',['middle','manager']);const beforeRevoked=await inventory(connection);
            await assert.rejects(deployments.create('manager','scope','revoked-admission',input,preview.previewDigest),{code:'NOT_FOUND'});assert.equal(await inventory(connection),beforeRevoked);
            await connection.execute('INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,?,?)',['middle','manager',JSON.stringify(['transit']),JSON.stringify({allowedPorts:[32101,32102,32103,32104],maxBindings:16})]);
            const createdBatch=await deployments.create('manager','scope','deployment-create',input,preview.previewDigest),batchId=createdBatch.body.batchId;
            await everyWrite('deployment accepted Forward create',()=>deployments.act('manager','scope',batchId,'probe-deployment-act',1,'create',1),['INSERT INTO forwards','INSERT INTO forward_revisions','INSERT INTO operations','INSERT INTO forward_path_bindings','INSERT INTO ingress_deployment_attempts','INSERT INTO ingress_deployment_events','UPDATE idempotency SET http_status']);
            const firstAccepted=await deployments.act('manager','scope',batchId,'deployment-act-one',1,'create',1);assert.equal(firstAccepted.body.attempt.outcome.accepted,true);
            assert.deepEqual(await deployments.act('manager','scope',batchId,'deployment-act-one',1,'create',1),firstAccepted);
            await everyWrite('deployment conditional deletion',()=>deployments.act('manager','scope',batchId,'probe-deployment-compensate',2,'compensate',1),['UPDATE forwards SET revision=?,deleting=TRUE','INSERT INTO ingress_deployment_attempts','UPDATE idempotency SET http_status']);
            await everyWrite('deployment cancellation',()=>deployments.cancel('manager','scope',batchId,'probe-deployment-cancel',2),['UPDATE ingress_deployments SET cancelled=TRUE','INSERT INTO ingress_deployment_events','UPDATE idempotency SET http_status']);
            const forwardTables=['forwards','forward_revisions','forward_path_bindings','current_path_bindings','operations','port_slots','relay_deployments','snapshots','execution_leases'];
            const beforePartial=await inventory(connection,forwardTables);knownRefusalSql='INSERT INTO forwards';
            let rejected;
            try{rejected=await deployments.act('manager','scope',batchId,'deployment-refused-two',2,'create',2);}finally{knownRefusalSql=undefined;}
            assert.equal(rejected.body.revision,3);assert.deepEqual(rejected.body.attempt.outcome,{accepted:false,error:{code:'PORT_RESERVED',status:409}});assert.equal(await inventory(connection,forwardTables),beforePartial);
            const retained=await deployments.get('manager','scope',batchId);assert.deepEqual(retained.items.map(value=>value.state),['accepted','rejected']);assert.equal(retained.attempts.length,2);assert.equal(retained.operations.length,1);
            const origin:IngressOriginRef={kind:'deployment',batchId,position:1,phase:'apply'};
            const migrationInput={schemaVersion:1,sourceGroup:group1,targetGroup:group2,sources:[origin],items:[{kind:'update',source:1,memberId:'a'}]};
            const migrationPreview=await migrations.preview('manager','scope',migrationInput);assert.deepEqual(migrationPreview.changes.map(value=>value.memberId),['a','b']);assert.deepEqual(migrationPreview.changes.map(value=>value.kind),['reference-changed','unchanged']);
            await everyWrite('migration create',()=>migrations.create('manager','scope','probe-migration-create',migrationInput,migrationPreview.previewDigest),['INSERT INTO ingress_migrations','INSERT INTO ingress_migration_events','UPDATE idempotency SET http_status']);
            const migration=await migrations.create('manager','scope','migration-create',migrationInput,migrationPreview.previewDigest),migrationId=migration.body.batchId;
            await everyWrite('migration exact path update',()=>migrations.act('manager','scope',migrationId,'probe-migration-apply',1,'apply',1),['UPDATE forwards SET revision=?,spec=?','INSERT INTO forward_revisions','INSERT INTO operations','INSERT INTO forward_path_bindings','INSERT INTO ingress_migration_attempts','UPDATE idempotency SET http_status']);
            const applied=await migrations.act('manager','scope',migrationId,'migration-apply',1,'apply',1);assert.equal(applied.body.attempt.outcome.accepted,true);
            await everyWrite('migration update restoration',()=>migrations.act('manager','scope',migrationId,'probe-migration-compensate',2,'compensate',1),['UPDATE forwards SET revision=?,spec=?','INSERT INTO forward_path_bindings','INSERT INTO ingress_migration_attempts','UPDATE idempotency SET http_status']);
            const restored=await migrations.act('manager','scope',migrationId,'migration-compensate',2,'compensate',1);assert.equal(restored.body.attempt.outcome.accepted,true);
            await db.transaction(async tx=>{await assert.rejects(migrations.originIn(tx,'manager','scope',{kind:'migration',batchId:migrationId,position:1,phase:'apply'}),{code:'PUBLICATION_STATE_CHANGED'});});
            const restoredRef:IngressOriginRef={kind:'migration',batchId:migrationId,position:1,phase:'compensate'};
            const lineage=await db.transaction(tx=>migrations.originIn(tx,'manager','scope',restoredRef));assert.deepEqual(lineage.group,group1);assert.deepEqual(lineage.template,template1);assert.equal(lineage.state.revision,3);
            // The historical deployment receipt still exists but cannot authorize a current Forward revision.
            await assert.rejects(migrations.preview('manager','scope',migrationInput),{code:'PUBLICATION_STATE_CHANGED'});
            await everyWrite('migration cancellation',()=>migrations.cancel('manager','scope',migrationId,'probe-migration-cancel',3),['UPDATE ingress_migrations SET cancelled=TRUE','INSERT INTO ingress_migration_events','UPDATE idempotency SET http_status']);
            const noopInput={schemaVersion:1,sourceGroup:group1,targetGroup:group3,sources:[restoredRef],items:[{kind:'update',source:1,memberId:'a'}]},noopPreview=await migrations.preview('manager','scope',noopInput),noopBatch=await migrations.create('manager','scope','noop-create',noopInput,noopPreview.previewDigest);
            await everyWrite('migration no-op update',()=>migrations.act('manager','scope',noopBatch.body.batchId,'probe-noop',1,'apply',1),['INSERT INTO ingress_migration_attempts','UPDATE idempotency SET http_status']);
            const noop=await migrations.act('manager','scope',noopBatch.body.batchId,'noop-apply',1,'apply',1);assert.equal(noop.body.attempt.outcome.accepted,true);if(noop.body.attempt.outcome.accepted){assert.equal(noop.body.attempt.outcome.result.accepted.status,200);assert.equal(noop.body.attempt.outcome.result.state.revision,3);assert.equal(noop.body.attempt.outcome.result.accepted.body.operationId,null);}
            const noopOrigin:IngressOriginRef={kind:'migration',batchId:noopBatch.body.batchId,position:1,phase:'apply'};
            const replacementInput={schemaVersion:1,sourceGroup:group3,targetGroup:group2,sources:[noopOrigin],items:[{kind:'remove',source:1},{kind:'add',memberId:'a',enabled:false,listen:{address:'127.0.0.1',port:32004},target:{host:'127.0.0.1',port:9000}}]},replacementPreview=await migrations.preview('manager','scope',replacementInput),replacement=await migrations.create('manager','scope','replacement-create',replacementInput,replacementPreview.previewDigest);
            await everyWrite('migration removal without replacement resolution',()=>migrations.act('manager','scope',replacement.body.batchId,'probe-remove',1,'apply',1),['UPDATE forwards SET revision=?,deleting=TRUE','INSERT INTO ingress_migration_attempts']);
            await everyWrite('migration accepted add',()=>migrations.act('manager','scope',replacement.body.batchId,'probe-add',1,'apply',2),['INSERT INTO forwards','INSERT INTO forward_path_bindings','INSERT INTO ingress_migration_attempts']);
            const add=await migrations.act('manager','scope',replacement.body.batchId,'replacement-add',1,'apply',2);assert.equal(add.body.attempt.outcome.accepted,true);
            await everyWrite('migration accepted add conditional removal',()=>migrations.act('manager','scope',replacement.body.batchId,'probe-add-compensate',2,'compensate',2),['UPDATE forwards SET revision=?,deleting=TRUE','INSERT INTO ingress_migration_attempts']);
            // Scope authorization, creator and recovery gates still precede replay of a previously accepted key.
            await assert.rejects(deployments.act('viewer','scope',batchId,'deployment-act-one',1,'create',1),{code:'AUTHORIZATION_DENIED'});await assert.rejects(deployments.act('other','scope',batchId,'deployment-act-one',1,'create',1),{code:'AUTHORIZATION_DENIED'});
            const beforeRecovery=await inventory(connection,forwardTables);
            await db.transaction(tx=>new MySqlIngressDeploymentRecoveryStore().quarantineRecovery(tx,now+1));await db.transaction(tx=>new MySqlIngressMigrationRecoveryStore().quarantineRecovery(tx,now+1));
            assert.equal(await inventory(connection,forwardTables),beforeRecovery);
            await assert.rejects(deployments.act('manager','scope',batchId,'deployment-act-one',1,'create',1),{code:'RECOVERY_REPLAY_REQUIRES_REVIEW'});await assert.rejects(migrations.act('manager','scope',migrationId,'migration-apply',1,'apply',1),{code:'RECOVERY_REPLAY_REQUIRES_REVIEW'});
            await db.transaction(async tx=>{await assert.rejects(deployments.originIn(tx,'manager','scope',origin),{code:'RECOVERY_REPLAY_REQUIRES_REVIEW'});await assert.rejects(migrations.originIn(tx,'manager','scope',restoredRef),{code:'RECOVERY_REPLAY_REQUIRES_REVIEW'});});
            const [history]=await connection.query<RowDataPacket[]>('SELECT COUNT(*) n FROM forward_path_bindings');assert.ok(history[0]!.n>=4);
        }finally{await connection?.end();await db.close();try{if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
    });
