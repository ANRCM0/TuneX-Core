import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { request } from 'node:https';

interface Host {
  nodeId: string; sshAlias: string; machineIdSHA256: string;
  agentBinary: string; journal: string; diagnostics: string;
}
interface Inventory {
  version: 1; physicalInventoryReviewed: boolean; sourceRevision: string;
  controlURL: string; ca: string; tokenEnvironment: string; scopeId: string; forwardId: string;
  images: {control: string; agent: string}; agentSHA256: string; fixtureSHA256: string;
  fixture: string; hosts: Host[]; targetTag?: string;
}
const path=process.argv[2];if(!path)throw Error('Reviewed physical-host inventory file required');
const config=JSON.parse(await readFile(resolve(path),'utf8')) as Inventory;
const execute=promisify(execFile),id=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,hash=/^[a-f0-9]{64}$/;
assert.equal(config.version,1);assert.equal(config.physicalInventoryReviewed,true);
assert.ok(/^[a-f0-9]{40}$/.test(config.sourceRevision));
assert.ok(Array.isArray(config.hosts)&&config.hosts.length>=3&&config.hosts.length<=8);
assert.equal(new Set(config.hosts.map(h=>h.nodeId)).size,config.hosts.length);
assert.ok(hash.test(config.agentSHA256)&&hash.test(config.fixtureSHA256));
assert.ok(/^[A-Z][A-Z0-9_]{0,127}$/.test(config.tokenEnvironment));
assert.ok(id.test(config.scopeId)&&id.test(config.forwardId));
for(const image of [config.images?.control,config.images?.agent])assert.match(image??'',/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/);
const token=process.env[config.tokenEnvironment];if(!token)throw Error('Configured acceptance token environment variable is empty');
const ca=await readFile(resolve(config.ca)),url=new URL(config.controlURL);
assert.equal(url.protocol,'https:');assert.equal(url.username+url.password+url.search+url.hash,'');assert.equal(url.pathname,'/');
function remotePath(value:string){assert.ok(typeof value==='string'&&/^\/[A-Za-z0-9_./-]+$/.test(value)&&!value.split('/').includes('..'),'Explicit remote file path required');}
remotePath(config.fixture);
const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
async function ssh(host:Host,args:string[]){
  assert.ok(id.test(host.nodeId)&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(host.sshAlias));
  return execute('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10',host.sshAlias,args.map(quote).join(' ')],{timeout:60000,maxBuffer:8*1024*1024});
}
async function get(suffix:string):Promise<any>{
  const endpoint=new URL(`/api/v1/scopes/${encodeURIComponent(config.scopeId)}/forwards/${encodeURIComponent(config.forwardId)}${suffix}`,url);
  return new Promise((resolve,reject)=>{
    const req=request(endpoint,{ca,agent:false,timeout:15000,headers:{authorization:'Bearer '+token}},res=>{
      const parts:Buffer[]=[];let length=0;
      res.on('data',b=>{length+=b.length;if(length>1048576){req.destroy(Error('Bounded Control response required'));return;}parts.push(b);});
      res.on('end',()=>{try{assert.equal(res.statusCode,200);resolve(JSON.parse(Buffer.concat(parts).toString()));}catch(e){reject(e);}});
    });
    req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Control evidence request timed out')));req.end();
  });
}
await mkdir('.artifacts/multihop-physical',{recursive:true});const directory=await mkdtemp(resolve('.artifacts/multihop-physical/run-'));
try{
  const source=(await execute('git',['rev-parse','HEAD'])).stdout.trim();assert.equal(source,config.sourceRevision);
  const before=await get('/deployment'),forward=await get('');
  assert.equal(before.deployment.stage,'active');assert.equal(forward.health.condition,'ready');
  assert.deepEqual(before.deployment.nodes.map((n:any)=>n.nodeId),config.hosts.map(h=>h.nodeId));
  const hosts=[];
  for(const host of config.hosts){
    remotePath(host.agentBinary);remotePath(host.journal);remotePath(host.diagnostics);assert.ok(hash.test(host.machineIdSHA256));
    const machineId=(await ssh(host,['/bin/cat','/etc/machine-id'])).stdout.trim();
    assert.match(machineId,/^[a-f0-9]{32}$/);
    const hostId=createHash('sha256').update(machineId).digest('hex');assert.equal(hostId,host.machineIdSHA256);
    const binarySHA=(await ssh(host,['sha256sum',host.agentBinary])).stdout.split(/\s/)[0];assert.equal(binarySHA,config.agentSHA256);
    const envelope=JSON.parse((await ssh(host,['/bin/cat',host.journal])).stdout);
    // Identity is cross-checked without fetching the protected journal MAC key.
    assert.equal(envelope.payload.snapshot.nodeId,host.nodeId);
    const diagnostics=JSON.parse((await ssh(host,['/bin/cat',host.diagnostics])).stdout);
    assert.equal(diagnostics.platform,'linux');assert.equal(diagnostics.authorizationActive,true);
    assert.ok(Number.isFinite(Date.parse(diagnostics.capturedAt))&&Math.abs(Date.now()-Date.parse(diagnostics.capturedAt))<30000);
    hosts.push({nodeId:host.nodeId,hostId,binarySHA256:binarySHA,diagnostics});
  }
  assert.ok(new Set(hosts.map(h=>h.hostId)).size>=3,'Distinct reviewed physical hosts required');
  const fixtureSHA=(await ssh(config.hosts[0]!,['sha256sum',config.fixture])).stdout.split(/\s/)[0];assert.equal(fixtureSHA,config.fixtureSHA256);
  const port=forward.desired.spec.ingress.listen.port,args=[config.fixture,'--mode','probe','--port',String(port)];
  if(config.targetTag!==undefined){assert.ok(/^[A-Za-z0-9_-]{0,32}$/.test(config.targetTag));args.push('--tag',config.targetTag);}
  const traffic=JSON.parse((await ssh(config.hosts[0]!,args)).stdout);assert.equal(traffic.tcp,true);assert.equal(traffic.udp,true);
  const after=await get('/deployment');assert.equal(after.deployment.generation,before.deployment.generation);assert.ok(after.deployment.nodes.every((n:any)=>n.ready));
  const workingTreeDirty=Boolean((await execute('git',['status','--porcelain'])).stdout.trim());
  await writeFile(join(directory,'evidence.json'),JSON.stringify({passed:true,commit:source,workingTreeDirty,completedAt:new Date().toISOString(),physicalHosts:true,
    inventoryReviewed:true,images:config.images,hosts,traffic,deployment:after.deployment,
    limitation:'SSH machine identity checks supplement the operator-reviewed physical inventory; they do not attest the hypervisor or run disruptive fault tests.'},null,2));
  console.log('Physical multi-hop traffic evidence: '+directory);
}catch(error){
  await writeFile(join(directory,'failure.json'),JSON.stringify({passed:false,error:error instanceof Error?error.message:'Physical evidence failed'},null,2));
  throw error;
}
