import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MULTIHOP_RELEASE_GATES, verifyMultihopRelease } from '../src/infrastructure/multihop-release.ts';

async function bundle() {
  const directory=await mkdtemp(join(tmpdir(),'tunex-release-')),commit='a'.repeat(40);
  const images={control:'ghcr.io/example/control@sha256:'+'b'.repeat(64),agent:'ghcr.io/example/agent@sha256:'+'c'.repeat(64)};
  const gates=[];
  for(const name of MULTIHOP_RELEASE_GATES){
    const artifact=name+'.json',report={passed:true,commit,workingTreeDirty:false,images,count:Number(name.at(-1)),cleanupVerified:true,traffic:{tcp:true,udp:true},isolated:true,physicalHosts:true,hosts:[{nodeId:'a',hostId:'host-a'},{nodeId:'b',hostId:'host-b'},{nodeId:'c',hostId:'host-c'}]};
    const raw=JSON.stringify(report);await writeFile(join(directory,artifact),raw);
    gates.push({name,artifact,sha256:createHash('sha256').update(raw).digest('hex')});
  }
  const manifest={version:1,sourceRevision:commit,images,gates},path=join(directory,'manifest.json');
  await writeFile(path,JSON.stringify(manifest));
  return {directory,commit,manifest,path};
}

test('release evidence requires all exact-source runtime, physical and P0 gates',async()=>{
  const f=await bundle();
  try{
    assert.equal((await verifyMultihopRelease(f.path,f.commit)).gates.length,MULTIHOP_RELEASE_GATES.length);
    await assert.rejects(()=>verifyMultihopRelease(f.path,'d'.repeat(40)),/revision differs/);
    f.manifest.gates.pop();await writeFile(f.path,JSON.stringify(f.manifest));
    await assert.rejects(()=>verifyMultihopRelease(f.path,f.commit),/Exact unique release gates/);
  }finally{await rm(f.directory,{recursive:true,force:true});}
});
test('artifact corruption and a dirty tested tree block production enablement',async()=>{
  const f=await bundle();
  try{
    const gate=f.manifest.gates[0]!,file=join(f.directory,gate.artifact),raw=await readFile(file,'utf8');
    await writeFile(file,raw+' ');
    await assert.rejects(()=>verifyMultihopRelease(f.path,f.commit),/digest differs/);
    const report=JSON.parse(raw);report.workingTreeDirty=true;const changed=JSON.stringify(report);
    await writeFile(file,changed);gate.sha256=createHash('sha256').update(changed).digest('hex');await writeFile(f.path,JSON.stringify(f.manifest));
    await assert.rejects(()=>verifyMultihopRelease(f.path,f.commit),/different tree/);
  }finally{await rm(f.directory,{recursive:true,force:true});}
});
test('same-host namespaces cannot satisfy the physical-host gate',async()=>{
  const f=await bundle();
  try{
    const gate=f.manifest.gates.find(g=>g.name==='multihop-physical')!,file=join(f.directory,gate.artifact),report=JSON.parse(await readFile(file,'utf8'));
    for(const host of report.hosts)host.hostId='same-host';const raw=JSON.stringify(report);
    await writeFile(file,raw);gate.sha256=createHash('sha256').update(raw).digest('hex');await writeFile(f.path,JSON.stringify(f.manifest));
    await assert.rejects(()=>verifyMultihopRelease(f.path,f.commit),/distinct physical hosts/);
  }finally{await rm(f.directory,{recursive:true,force:true});}
});
