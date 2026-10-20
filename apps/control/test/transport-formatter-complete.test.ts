import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TransportService } from '../src/modules/transport-owner/public.ts';
import type { TransportOptions } from '../src/modules/transport-owner/public.ts';
import { Transport } from '../src/modules/transport.ts';
import { nativeRelayConfigurationCodec, nativeIsoTime } from '../src/compatibility/public.ts';
import type { NativeRelayConfigurationCodec } from '../src/compatibility/public.ts';
import type { TransportRevisionRecord } from '../src/framework/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../src/infrastructure/mysql.ts';

const profile = {driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,
    idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:4096};
const config = nativeRelayConfigurationCodec.profile(profile), configDigest = nativeRelayConfigurationCodec.digest(config);
type Tx = { effects:string[] };
function fixture(format:(this:NativeRelayConfigurationCodec,at:number)=>string = nativeIsoTime) {
    const tx:Tx={effects:[]}, trace:string[]=[], revisions:number[]=[], failure=new Error('original Transport provider failure');
    const options={fail:'',missing:'',badDigest:false,replay:undefined as unknown,current:3,grantCount:0};
    const record:TransportRevisionRecord={revision:2,config:JSON.stringify(config),config_digest:configDigest,created_by:'creator',created_at:0};
    function call(self:unknown,owner:unknown,name:string,args:unknown[],sameTx=true){
        assert.equal(self,owner);if(sameTx)assert.equal(args[0],tx);trace.push(name);if(options.fail===name)throw failure;
    }
    const db={async transaction<T>(this:unknown,run:(tx:Tx)=>Promise<T>){
        assert.equal(this,db);trace.push('begin');const saved=[...tx.effects];
        try{const result=await run(tx);trace.push('commit');return result;}catch(error){tx.effects=saved;trace.push('rollback');throw error;}
    }};
    const identity={async scope(this:unknown,...args:unknown[]){call(this,identity,'scope',args);tx.effects.push('authorization');},
        async owner(this:unknown,...args:unknown[]){call(this,identity,'owner',args);}};
    const idempotency={async claim(this:unknown,...args:unknown[]){call(this,idempotency,'claim',args);return options.replay;},
        async respond(this:unknown,...args:unknown[]){call(this,idempotency,'respond',args);}};
    const forwarding={async hasLiveRelay(this:unknown,...args:unknown[]){call(this,forwarding,'live',args);return false;}};
    const store={
        async currentRevision(this:unknown,...args:unknown[]){call(this,store,'current',args);assert.deepEqual(args.slice(1),['profile-a','scope-a']);return options.missing==='current'?undefined:{current_revision:options.current};},
        async revision(this:unknown,...args:unknown[]){call(this,store,'revision',args);assert.equal(args[1],'profile-a');revisions.push(args[2] as number);return options.missing==='revision'?undefined:record;},
        async ensureProfile(this:unknown,...args:unknown[]){call(this,store,'ensure',args);},
        async publicationForUpdate(this:unknown,...args:unknown[]){call(this,store,'publication',args);return {scope_id:'scope-a',current_revision:options.current};},
        async publishRevision(this:unknown,...args:unknown[]){call(this,store,'publish',args);},
        async setCurrentRevision(this:unknown,...args:unknown[]){call(this,store,'setCurrent',args);},
        async insertGrant(this:unknown,...args:unknown[]){call(this,store,'insertGrant',args);},
        async deleteGrant(this:unknown,...args:unknown[]){call(this,store,'deleteGrant',args);},
        async grantRevisionForUpdate(this:unknown,...args:unknown[]){call(this,store,'grantLock',args);return {grant_revision:1};},
        async grantCount(this:unknown,...args:unknown[]){call(this,store,'grantCount',args);return options.grantCount;},
        async setGrantRevision(this:unknown,...args:unknown[]){call(this,store,'setGrant',args);},
        async grantEvent(this:unknown,...args:unknown[]){call(this,store,'grantEvent',args);},
        async grantRevision(this:unknown,...args:unknown[]){call(this,store,'grantRevision',args);return {grant_revision:1};},
        async grantActors(this:unknown,...args:unknown[]){call(this,store,'grantActors',args);return [{actor_id:'member'}];},
        async list(this:unknown,...args:unknown[]){call(this,store,'list',args);return [{id:'profile-a',current_revision:3}];},
        async authorizedProfile(this:unknown,...args:unknown[]){call(this,store,'authorizedProfile',args);return true;},
    };
    const codec:NativeRelayConfigurationCodec={...nativeRelayConfigurationCodec,
        isId(this:unknown,value:unknown){call(this,codec,'isId',[value],false);return nativeRelayConfigurationCodec.isId(value);},
        isCounter(this:unknown,value:unknown,zero?:boolean){call(this,codec,'isCounter',[value,zero],false);return nativeRelayConfigurationCodec.isCounter(value,zero);},
        readStored<T>(this:unknown,value:unknown):T{call(this,codec,'decode',[value],false);assert.equal(value,record.config);return nativeRelayConfigurationCodec.readStored<T>(value);},
        profile(this:unknown,value:unknown){call(this,codec,'parse',[value],false);return nativeRelayConfigurationCodec.profile(value);},
        digest(this:unknown,value:unknown){call(this,codec,'digest',[value],false);return options.badDigest?'bad-digest':nativeRelayConfigurationCodec.digest(value);},
        formatTime(this:NativeRelayConfigurationCodec,at:number){call(this,codec,'format',[at],false);return format.call(this,at);},
    };
    const owner=new TransportService({db,identity,idempotency,forwarding,store,codec,now:()=>{trace.push('now');return 123;},newID:()=>{trace.push('newID');return 'event';}} as unknown as TransportOptions<Tx>);
    return {owner,db,identity,codec,record,tx,trace,revisions,options,failure};
}

test('132 Transport requires callable formatter before reading any provider and keeps original constructor refusal',()=>{
    for(const value of [undefined,null,{}, {formatTime:undefined},{formatTime:null},{formatTime:0},{formatTime:'format'}]){
        const reads:string[]=[];
        const options=new Proxy({codec:value},{get(target,key,receiver){reads.push(String(key));if(key!=='codec')assert.fail('provider read before formatter refusal');return Reflect.get(target,key,receiver);}});
        assert.throws(()=>new TransportService(options as never),{name:'Error',message:'Transport time formatter is required'});
        assert.deepEqual(reads,['codec']);
    }
    const failure=new Error('formatter getter failure'),options={get codec(){throw failure;}};
    assert.throws(()=>new TransportService(options as never),error=>error===failure);
    const f=fixture();assert.deepEqual(f.trace,[]);assert.deepEqual(f.tx.effects,[]);
});

test('132 Transport get preserves provider receivers authorization revision decode parse digest and response property evaluation inside original Tx',async t=>{
    t.mock.method(Date,'now',()=>assert.fail('get must not read a clock'));
    for(const requested of [undefined,1]){
        const f=fixture(function(at){assert.equal(this,f.codec);assert.deepEqual(f.tx.effects,['authorization']);return `custom:${at}`;});
        const revision=f.record.revision,digest=f.record.config_digest,createdBy=f.record.created_by,at=f.record.created_at;
        Object.defineProperties(f.record,{
            revision:{get(){f.trace.push('property:revision');return revision;}},
            config_digest:{get(){f.trace.push('property:digest');return digest;}},
            created_by:{get(){f.trace.push('property:creator');return createdBy;}},
            created_at:{get(){f.trace.push('property:time');return at;}},
        });
        const result=await f.owner.get('actor-a','scope-a','profile-a',requested);
        assert.deepEqual(result,{profileId:'profile-a',currentRevision:3,revision:2,config,configDigest,createdBy:'creator',createdAt:'custom:0',executionSupported:true});
        assert.deepEqual(Object.keys(result),['profileId','currentRevision','revision','config','configDigest','createdBy','createdAt','executionSupported']);
        assert.deepEqual(f.trace,['isId',...(requested===undefined?[]:['isCounter']),'begin','scope','current','revision','decode','parse','digest','property:digest',
            'property:revision','property:digest','property:creator','property:time','format','commit']);
        assert.deepEqual(f.revisions,[requested??3]);
    }
});

test('132 Transport forwards zero fractional invalid NaN infinite timestamps unchanged to custom formatter without clock or coercion',async t=>{
    t.mock.method(Date,'now',()=>assert.fail('get must not read a clock'));
    const poison={ [Symbol.toPrimitive](){assert.fail('custom timestamps must not be coerced');} };
    for(const at of [0,-0,0.9,-0.9,NaN,Infinity,-Infinity,8640000000000001,'invalid',poison]){
        let received:unknown,calls=0;
        const f=fixture(function(value){calls++;received=value;assert.equal(this,f.codec);return 'opaque provider output';});
        f.record.created_at=at as number;
        const result=await f.owner.get('actor-a','scope-a','profile-a');
        assert.ok(Object.is(received,at));assert.equal(calls,1);assert.equal(result.createdAt,'opaque provider output');
        assert.equal(f.trace.at(-1),'commit');assert.ok(!f.trace.includes('now'));
    }
});

test('132 Transport native formatter retains Date ISO clipping boundaries and original RangeError with transaction rollback',async t=>{
    t.mock.method(Date,'now',()=>assert.fail('native get must not read a clock'));
    assert.equal(nativeRelayConfigurationCodec.formatTime,nativeIsoTime);
    for(const at of [0,-0,0.9,-0.9,1700000000123.75,8640000000000000,-8640000000000000,NaN,Infinity,-Infinity,8640000000000001,'invalid']){
        const f=fixture();f.record.created_at=at as number;
        if(Number.isFinite(Number(at))&&Math.abs(Number(at))<=8640000000000000){
            const result=await f.owner.get('actor-a','scope-a','profile-a');assert.equal(result.createdAt,new Date(at).toISOString());assert.equal(f.trace.at(-1),'commit');
        }else{
            await assert.rejects(f.owner.get('actor-a','scope-a','profile-a'),RangeError);assert.deepEqual(f.trace.slice(-2),['format','rollback']);assert.deepEqual(f.tx.effects,[]);
        }
    }
});

test('132 Transport first failure stops later providers formatting and preserves exact thrown value and rollback',async()=>{
    const prefix=['isId','isCounter','begin','scope','current','revision','decode','parse','digest','format'];
    for(const fail of ['isId','isCounter','scope','current','revision','decode','parse','digest','format']){
        const f=fixture();f.options.fail=fail;
        await assert.rejects(f.owner.get('actor-a','scope-a','profile-a',1),error=>error===f.failure);
        assert.deepEqual(f.trace,[...prefix.slice(0,prefix.indexOf(fail)+1),...(['isId','isCounter'].includes(fail)?[]:['rollback'])]);
        assert.deepEqual(f.tx.effects,[]);
    }
    for(const missing of ['current','revision']){
        const f=fixture();f.options.missing=missing;
        await assert.rejects(f.owner.get('actor-a','scope-a','profile-a'),{code:'NOT_FOUND'});assert.ok(!f.trace.includes('format'));assert.equal(f.trace.at(-1),'rollback');
    }
    const bad=fixture();bad.options.badDigest=true;
    await assert.rejects(bad.owner.get('actor-a','scope-a','profile-a'),{code:'INTEGRITY_FAILURE'});assert.ok(!bad.trace.includes('format'));assert.deepEqual(bad.tx.effects,[]);
    for(const args of [['actor-a','scope-a','invalid id'],['actor-a','scope-a','profile-a',0]] as const){
        const f=fixture();await assert.rejects(f.owner.get(args[0],args[1],args[2],args[3]),{code:'INVALID_CONFIG'});assert.ok(!f.trace.includes('begin'));assert.ok(!f.trace.includes('format'));
    }
    for(const thrown of [new Error('custom failure'),new RangeError('custom range failure'),null,'original thrown string']){
        const f=fixture(()=>{throw thrown;});let caught:unknown=Symbol();
        try{await f.owner.get('actor-a','scope-a','profile-a');assert.fail('expected formatter failure');}catch(error){caught=error;}
        assert.equal(caught,thrown);assert.deepEqual(f.trace.slice(-2),['format','rollback']);assert.deepEqual(f.tx.effects,[]);
    }
});

test('132 Transport publish changed unchanged replay grants resolve and list retain responses without formatter or extra clock',async()=>{
    const f=fixture(()=>assert.fail('only get invokes formatter'));
    f.options.current=0;
    assert.deepEqual(await f.owner.publish('actor-a','scope-a','profile-a','key',0,profile),{status:202,body:{profileId:'profile-a',revision:1,configDigest,changed:true}});
    assert.equal(f.trace.filter(name=>name==='now').length,1);assert.ok(f.trace.includes('insertGrant'));
    f.trace.length=0;f.options.current=3;
    assert.deepEqual(await f.owner.publish('actor-a','scope-a','profile-a','key',3,profile),{status:200,body:{profileId:'profile-a',revision:3,configDigest,changed:false}});
    assert.ok(!f.trace.includes('now'));assert.ok(!f.trace.includes('publish'));
    const replay={status:202 as const,body:{profileId:'profile-a',revision:1,configDigest,changed:true}};
    f.options.replay=replay;f.trace.length=0;
    assert.equal(await f.owner.publish('actor-a','scope-a','profile-a','key',3,profile),replay);
    assert.deepEqual(f.trace.slice(-4),['begin','owner','claim','commit']);assert.ok(!f.trace.includes('now'));
    f.options.replay=undefined;f.trace.length=0;
    assert.deepEqual(await f.db.transaction(tx=>f.owner.applyGrant(tx,{actorId:'actor-a',scopeId:'scope-a',profileId:'profile-a',subject:'member',expectedRevision:1,allowed:true})),
        {profileId:'profile-a',actorId:'member',revision:2,allowed:true,changed:true});
    assert.equal(f.trace.filter(name=>name==='now').length,1);assert.equal(f.trace.filter(name=>name==='newID').length,1);
    f.trace.length=0;f.options.grantCount=1;
    assert.deepEqual(await f.db.transaction(tx=>f.owner.applyGrant(tx,{actorId:'actor-a',scopeId:'scope-a',profileId:'profile-a',subject:'member',expectedRevision:1,allowed:true})),
        {profileId:'profile-a',actorId:'member',revision:1,allowed:true,changed:false});assert.ok(!f.trace.includes('now'));
    f.trace.length=0;
    assert.deepEqual(await f.owner.grants('actor-a','scope-a','profile-a'),{profileId:'profile-a',revision:1,actorIds:['member']});
    assert.deepEqual(await f.owner.list('actor-a','scope-a'),{profiles:[{profileId:'profile-a',currentRevision:3}],executionSupported:true});
    assert.deepEqual(await f.db.transaction(tx=>f.owner.resolve(tx,'actor-a','scope-a','profile-a',2)),{profileId:'profile-a',revision:2,config,configDigest});
    assert.ok(!f.trace.includes('format'));assert.ok(!f.trace.includes('now'));assert.ok(!f.trace.includes('newID'));
});

test('132 legacy Transport get uses unchanged native SQL supplied Tx default output and native formatter rollback',async t=>{
    t.mock.method(Date,'now',()=>assert.fail('legacy get must not sample time'));
    for(const at of [0,0.9,NaN,Infinity]){
        const trace:string[]=[],calls:Array<[string,unknown[]]>=[];
        const tx={async execute(this:unknown,sql:string,args:unknown[]){assert.equal(this,tx);calls.push([sql,args]);
            return [calls.length===1?[{current_revision:3}]:[{revision:2,config:JSON.stringify(config),config_digest:configDigest,created_by:'creator',created_at:at}],[]];}} as unknown as Transaction;
        const db={async transaction<T>(action:(tx:Transaction)=>Promise<T>){assert.equal(this,db);trace.push('begin');try{const value=await action(tx);trace.push('commit');return value;}catch(error){trace.push('rollback');throw error;}}} as MySqlUnitOfWork;
        const identity={async scope(this:unknown,received:Transaction,...args:unknown[]){assert.equal(this,identity);assert.equal(received,tx);assert.deepEqual(args,['actor-a','scope-a']);trace.push('scope');},async owner(){assert.fail('get only scope authorization');}};
        const owner=new Transport(db,identity,{} as never,{} as never);
        if(Number.isFinite(at)){const result=await owner.get('actor-a','scope-a','profile-a',2);assert.deepEqual(result,{profileId:'profile-a',currentRevision:3,revision:2,config,configDigest,createdBy:'creator',createdAt:new Date(at).toISOString(),executionSupported:true});assert.deepEqual(trace,['begin','scope','commit']);}
        else{await assert.rejects(owner.get('actor-a','scope-a','profile-a',2),RangeError);assert.deepEqual(trace,['begin','scope','rollback']);}
        assert.deepEqual(calls,[['SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?',['profile-a','scope-a']],
            ['SELECT * FROM transport_profile_revisions WHERE profile_id=? AND revision=?',['profile-a',2]]]);
    }
});
