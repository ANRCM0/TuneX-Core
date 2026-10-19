import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MySqlForwardIntentStore, MySqlIdempotencyStore } from '../src/infrastructure/mysql-intent-store.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { ForwardStateService } from '../src/modules/forward-owner/public.ts';

function fixture(){
    const calls:unknown[][]=[],raw=[{id:'forward',scope_id:'scope',revision:2,spec:{unvalidated:true},authorization_actor:null,deleting:1,recovery_suspended:0}];
    let answer:unknown[]=raw,failure:unknown,affected=0;
    const tx={async execute(sql:string,args:unknown[]){assert.equal(this,tx);calls.push([sql,args]);if(failure)throw failure;return [sql.startsWith('SELECT')?answer:{affectedRows:affected},[]];}} as unknown as Transaction;
    return {calls,raw,tx,store:new MySqlForwardIntentStore(),idem:new MySqlIdempotencyStore(),set(value:unknown[]){answer=value;},fail(value:unknown){failure=value;},affected(value:number){affected=value;}};
}

test('22 Forward native store retains all seventeen literal SQL predicates lock modes argument order and undecoded driver results',async()=>{
    const f=fixture(),s=f.store,t=f.tx;
    const cases:[()=>Promise<unknown>,string,unknown[]][]=[
        [()=>s.revisions(t,'forward'),'SELECT revision,spec FROM forward_revisions WHERE forward_id=? ORDER BY revision DESC LIMIT 25',['forward']],
        [()=>s.quarantine(t),'UPDATE forwards SET recovery_suspended=TRUE',[]],
        [()=>s.liveProfileCount(t,'profile'),"SELECT id FROM forwards WHERE recovery_suspended=FALSE AND deleting=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.transport.profileId'))=? FOR SHARE",['profile']],
        [()=>s.liveNodeCount(t,'node'),"SELECT id FROM forwards WHERE recovery_suspended=FALSE AND deleting=FALSE AND (JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? OR JSON_CONTAINS(JSON_EXTRACT(spec,'$.path.via'),JSON_QUOTE(?))) AND JSON_EXTRACT(spec,'$.transport') IS NOT NULL FOR SHARE",['node','node']],
        [()=>s.forNode(t,'node'),"SELECT * FROM forwards WHERE deleting=FALSE AND recovery_suspended=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? ORDER BY id",['node']],
        [()=>s.forReferencedNode(t,'node'),"SELECT * FROM forwards WHERE deleting=FALSE AND recovery_suspended=FALSE AND (JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? OR JSON_CONTAINS(JSON_EXTRACT(spec,'$.path.via'),JSON_QUOTE(?))) ORDER BY id",['node','node']],
        [()=>s.forProfileActor(t,'actor','profile'),"SELECT * FROM forwards WHERE authorization_actor=? AND deleting=FALSE AND recovery_suspended=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.transport.profileId'))=? ORDER BY id",['actor','profile']],
        [()=>s.insertCurrent(t,'forward','scope',2,'encoded','actor'),'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES(?,?,?,?,?)',['forward','scope',2,'encoded','actor']],
        [()=>s.insertRevision(t,'forward',2,'encoded'),'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,?,?)',['forward',2,'encoded']],
        [()=>s.authorizer(t,'forward'),'SELECT authorization_actor FROM forwards WHERE id=?',['forward']],
        [()=>s.setAuthorizer(t,'actor','forward'),'UPDATE forwards SET authorization_actor=? WHERE id=?',['actor','forward']],
        [()=>s.forActor(t,'scope','actor'),'SELECT * FROM forwards WHERE scope_id=? AND authorization_actor=? AND deleting=FALSE ORDER BY id',['scope','actor']],
        [()=>s.get(t,'forward','scope'),'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE',['forward','scope']],
        [()=>s.currentForUpdate(t,'forward','scope'),'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE FOR UPDATE',['forward','scope']],
        [()=>s.record(t,'forward','scope'),'SELECT * FROM forwards WHERE id=? AND scope_id=?',['forward','scope']],
        [()=>s.replaceCurrent(t,2,'encoded','forward',1),'UPDATE forwards SET revision=?,spec=?,deleting=FALSE,recovery_suspended=FALSE WHERE id=? AND revision=? AND deleting=FALSE',[2,'encoded','forward',1]],
        [()=>s.markDeleting(t,2,'forward',1),'UPDATE forwards SET revision=?,deleting=TRUE WHERE id=? AND revision=? AND deleting=FALSE',[2,'forward',1]],
    ];
    for(const [action,sql,args] of cases){f.calls.length=0;await action();assert.deepEqual(f.calls,[[sql,args]]);}
    for(const action of [()=>s.revisions(t,'forward'),()=>s.forNode(t,'node'),()=>s.forReferencedNode(t,'node'),()=>s.forProfileActor(t,'actor','profile'),()=>s.forActor(t,'scope','actor')])assert.equal(await action(),f.raw);
    assert.equal(await s.liveProfileCount(t,'profile'),1);assert.equal(await s.liveNodeCount(t,'node'),1);
    for(const action of [()=>s.get(t,'forward','scope'),()=>s.currentForUpdate(t,'forward','scope'),()=>s.record(t,'forward','scope'),()=>s.authorizer(t,'forward')])assert.equal(await action(),f.raw[0]);
    f.affected(2);assert.equal(await s.replaceCurrent(t,2,'{}','forward',1),2);assert.equal(await s.markDeleting(t,2,'forward',1),2);
    f.set([]);assert.equal(await s.get(t,'forward','scope'),undefined);assert.equal(await s.currentForUpdate(t,'forward','scope'),undefined);
    assert.equal(await s.record(t,'forward','scope'),undefined);assert.equal(await s.authorizer(t,'forward'),undefined);assert.equal(await s.liveNodeCount(t,'node'),0);
    for(const [action] of cases){const error=new Error('original driver failure');f.fail(error);f.calls.length=0;await assert.rejects(action,failure=>failure===error);assert.equal(f.calls.length,1);}
});

test('22 native Idempotency SQL retains original full key identity and response status bytes with no implicit decode',async()=>{
    const f=fixture(),s=f.idem,t=f.tx,key={scopeId:'scope',actorId:'actor',key:'request'};
    const cases:[()=>Promise<unknown>,string,unknown[]][]=[
        [()=>s.quarantine(t),'UPDATE idempotency SET recovery_invalidated=TRUE',[]],
        [()=>s.ensure(t,key,'digest'),'INSERT INTO idempotency(scope_id,actor_id,request_key,request_digest) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE request_key=request_key',['scope','actor','request','digest']],
        [()=>s.currentForUpdate(t,key),'SELECT * FROM idempotency WHERE scope_id=? AND actor_id=? AND request_key=? FOR UPDATE',['scope','actor','request']],
        [()=>s.respond(t,202,'raw response',key),'UPDATE idempotency SET http_status=?,response=? WHERE scope_id=? AND actor_id=? AND request_key=?',[202,'raw response','scope','actor','request']],
    ];
    for(const [action,sql,args] of cases){f.calls.length=0;await action();assert.deepEqual(f.calls,[[sql,args]]);}
    assert.equal(await s.currentForUpdate(t,key),f.raw[0]);f.set([]);assert.equal(await s.currentForUpdate(t,key),undefined);
    for(const [action] of cases){const error=new Error('native idempotency error');f.fail(error);f.calls.length=0;await assert.rejects(action,failure=>failure===error);assert.equal(f.calls.length,1);}
});

test('22 Forward service preserves lazy raw revisions projection flags missing rows and original argument translations',async()=>{
    const f=fixture(),events:string[]=[],decoded=f.raw[0]!.spec;
    const service=new ForwardStateService({store:f.store,values:{read<T>(value:unknown):T{assert.equal(value,decoded);events.push('decode');return value as T;},encode(){return assert.fail('read path encoding');}}});
    assert.equal(await service.revisions(f.tx,'forward'),f.raw);assert.deepEqual(events,[]);
    assert.equal((await service.get(f.tx,'scope','forward')).spec,decoded);assert.deepEqual(f.calls.at(-1)![1],['forward','scope']);
    assert.equal((await service.currentForUpdate(f.tx,'scope','forward')).spec,decoded);
    const record=await service.record(f.tx,'scope','forward');assert.equal(record.spec,decoded);assert.equal(record.deleting,true);assert.equal(record.recoverySuspended,false);
    await service.forProfileActor(f.tx,'profile','actor');assert.deepEqual(f.calls.at(-1)![1],['actor','profile']);
    await service.setAuthorizer(f.tx,'forward','actor');assert.deepEqual(f.calls.at(-1)![1],['actor','forward']);
    assert.equal(await service.authorizer(f.tx,'forward'),null);
    f.set([]);events.length=0;
    for(const action of [()=>service.get(f.tx,'scope','forward'),()=>service.currentForUpdate(f.tx,'scope','forward'),()=>service.record(f.tx,'scope','forward')])await assert.rejects(action,{code:'NOT_FOUND',status:404});
    assert.deepEqual(events,[]);assert.equal(await service.authorizer(f.tx,'forward'),null);
    assert.equal(await service.hasLiveRelay(f.tx,'profile','node'),false);assert.deepEqual(f.calls.at(-1)![1],['profile']);
    const length=f.calls.length;await assert.rejects(service.hasLiveRelay(f.tx),{message:'Explicit Relay reference required'});assert.equal(f.calls.length,length);
});
