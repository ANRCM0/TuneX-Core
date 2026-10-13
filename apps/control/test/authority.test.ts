import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,readFile,writeFile,unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityStore } from '../src/infrastructure/authority.ts';
import { trustedRecoveryTime } from '../../../scripts/ops/recovery.ts';
const ca='sha256:'+'1'.repeat(64),nextCa='sha256:'+'2'.repeat(64);
async function store(){const root=await mkdtemp(join(tmpdir(),'tunex-authority-'));const value=new AuthorityStore(root);await value.initialize('server:database',ca,true);return value;}
test('authority upper bound is durable and monotonically includes concurrent publishers',async()=>{
 const authority=await store(),other=new AuthorityStore(join(authority.path,'..','..'));const now=Date.now();await Promise.all([authority.issue(now+10000,18,5),other.issue(now+12000,18,5)]);const state=await authority.read();assert.equal(state.latestValidUntil,now+12000);assert.equal(state.sequence,3);assert.equal(state.maxLeaseSeconds,18);
 const reloaded=new AuthorityStore(join(authority.path,'..','..'));assert.equal((await reloaded.read()).latestValidUntil,now+12000);
 await authority.maintain();await assert.rejects(()=>authority.allow(),/maintenance/);await assert.rejects(()=>other.issue(Date.now()+1000,18,5),/disabled/);await assert.rejects(()=>authority.rebind('server:new',nextCa,'recovery-a'),/not expired/);
});
test('recovery trust/database binding stays quarantined until the exact review ID',async()=>{
 const authority=await store();await authority.maintain();await assert.rejects(()=>authority.rebind('server:new',ca,'recovery-a'),/new Node trust/);await authority.rebind('server:new',nextCa,'recovery-a');await assert.rejects(()=>authority.resume(),/review/);await authority.resume('recovery-a');await authority.allow();await assert.rejects(()=>authority.initialize('server:old',ca,false),/binding differs/);
});
test('missing or corrupted protected state cannot be initialized from zero',async()=>{
 const authority=await store();const raw=JSON.parse(await readFile(authority.path,'utf8'));raw.payload.latestValidUntil=0;await writeFile(authority.path,JSON.stringify(raw));await assert.rejects(()=>authority.read(),/integrity/);
 const intact=await store();await unlink(intact.keyPath);const newProcess=new AuthorityStore(join(intact.path,'..','..'));await assert.rejects(()=>newProcess.initialize('server:database',ca,true),/Partial/);
 const noState=await store();await unlink(noState.path);await assert.rejects(()=>noState.initialize('server:database',ca,true),/Partial/);
});
test('artifact verification rejects changed data and publication rejects unsafe bounds',async()=>{
 const authority=await store();const payload={backup:'a',sha:'abc'};const mac=await authority.signArtifact(payload);await authority.verifyArtifact(payload,mac);await assert.rejects(()=>authority.verifyArtifact({...payload,backup:'b'},mac),/integrity/);await assert.rejects(()=>authority.issue(Date.now()+400000,300,5),/bound/);await assert.rejects(()=>authority.issue(Date.now()+1000,301,5),/bound/);
});
test('offline recovery refuses stale or future clock observations even when marked synchronized',async()=>{
 for(const offset of [-60000,60000]){
  const root=await mkdtemp(join(tmpdir(),'tunex-recovery-clock-')),path=join(root,'collector.mjs');
  await writeFile(path,`console.log(JSON.stringify({synchronized:true,maxSkewSeconds:5,checkedAt:new Date(${Date.now()+offset}).toISOString()}));`);
  await assert.rejects(()=>trustedRecoveryTime(process.execPath,[path]),/Fresh trusted OS clock/);
 }
});
