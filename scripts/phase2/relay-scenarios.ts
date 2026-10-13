import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { request } from 'node:https';
import { startControl } from '../../apps/control/src/server.ts';
import { host,linux,linuxPath,spawnLinux } from './native-linux.ts';

export interface ScenarioSpec {
 enabled:boolean;protocols:string[];ingress:{nodeId:string;listen:{address:string;port:number}};
 target:{host:string;port:number};path:{via:string[]};transport:{profileId:string;configRevision:number};
}
export interface ScenarioAgent {nodeId:string;root:string;args:string[];process:ChildProcess}
interface FixtureProcess {root:string;pid:number;process:ChildProcess;mode:string}
interface Context {
 control:()=>Awaited<ReturnType<typeof startControl>>;
 call:(method:string,path:string,input?:unknown)=>Promise<{status:number;body:any}>;
 until:(action:()=>Promise<boolean>,label:string,timeout?:number)=>Promise<void>;
 pass:(message:string)=>void;
 agents:ScenarioAgent[];scope:string;forwardId:string;spec:ScenarioSpec;revision:number;
 nativeRoot:string;binary:string;fixture:string;caPath:string;freePort:()=>Promise<number>;
 unusedListenPort:number;
}

async function statusLine(process:ChildProcess):Promise<any>{return new Promise((resolve,reject)=>{let buffered='';const receive=(chunk:Buffer)=>{buffered+=chunk.toString();const end=buffered.indexOf('\n');if(end<0)return;process.stdout!.off('data',receive);try{resolve(JSON.parse(buffered.slice(0,end)))}catch(err){reject(err)}};process.stdout!.on('data',receive);process.once('error',reject);process.once('exit',code=>reject(new Error(`Fixture exited before ready: ${code}`)));});}
async function stopFixture(context:Context,entry:FixtureProcess):Promise<void>{
 const actual=await linux('/bin/cat',[`/proc/${entry.pid}/cmdline`]).catch(()=>undefined),fields=actual?.stdout.split('\0');
 if(fields?.[0]===context.fixture&&fields.includes(entry.root)&&fields.includes(entry.mode)){await linux('/bin/kill',['-TERM',String(entry.pid)]);await context.until(async()=>{const remaining=await linux('/bin/cat',[`/proc/${entry.pid}/cmdline`]).catch(()=>undefined);return !remaining?.stdout.split('\0').includes(entry.root);},'owned fixture exit',10000);}
 entry.process.kill();
}
async function machineReplay(context:Context,node:ScenarioAgent,report:unknown,epoch:number){
 const ca=Buffer.from((await linux('/bin/cat',[linuxPath(context.caPath)])).stdout),cert=Buffer.from((await linux('/bin/cat',[`${node.root}/state/node.pem`])).stdout),key=Buffer.from((await linux('/bin/cat',[`${node.root}/state/private.pem`])).stdout),body=JSON.stringify(report);
 return new Promise<{status:number;body:any}>((resolve,reject)=>{const req=request({hostname:host,port:context.control().port,path:'/agent/v3/report',method:'POST',ca,cert,key,agent:false,timeout:10000,headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(body)),'x-tunex-session-epoch':String(epoch)}},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{try{resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())})}catch(err){reject(err)}})});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Machine replay timeout')));req.end(body);});
}

export async function relaySwitchFaults(context:Context):Promise<{spec:ScenarioSpec;revision:number;details:unknown}>{
 let spec=context.spec,revision=context.revision;
 const fixtures:FixtureProcess[]=[],details:any[]=[];
 const resourcePath=`/api/v1/scopes/${context.scope}/forwards/${context.forwardId}`;
 const spawnFixture=async(mode:string,args:string[],name:string)=>{const root=`${context.nativeRoot}/${name}`,process=spawnLinux(context.fixture,['--mode',mode,...args,'--run-id',root]);process.stderr!.on('data',()=>{});const status=await statusLine(process);assert.equal(status.runId,root);const entry={root,pid:status.pid as number,process,mode};fixtures.push(entry);return {entry,status};};
 const probe=async(port:number,tag:string,tcpOnly=false)=>JSON.parse((await linux(context.fixture,['--mode','probe','--port',String(port),'--tag',tag,...(tcpOnly?['--tcp-only']:[])])).stdout);
 const waitOperation=async(id:string,expected='succeeded',timeout=60000)=>context.until(async()=>{const operation=await context.call('GET',`/api/v1/scopes/${context.scope}/operations/${id}`);return operation.body.status===expected;},`Operation ${expected}`,timeout);
 async function holdTCP(tag:string,name:string){
  const root=`${context.nativeRoot}/${name}`,process=spawnLinux(context.fixture,['--mode','monitor','--port',String(spec.ingress.listen.port),'--tag',tag,'--run-id',root]);let buffer='',connected=false,ended=false,verified=0,endedAt=0,pid=0;
  process.stderr!.on('data',()=>{});process.stdout!.on('data',chunk=>{buffer+=chunk.toString();const lines=buffer.split('\n');buffer=lines.pop()!;for(const line of lines){if(!line.trim())continue;const row=JSON.parse(line);assert.equal(row.tag,tag);connected ||= Boolean(row.connected);if(row.pid)pid=row.pid;verified=Math.max(verified,row.verified??0);if(row.ended){ended=true;endedAt=Date.now();}}});
  await context.until(async()=>connected&&verified>=2,'held tagged stream');const entry={root,pid,process,mode:'monitor'};fixtures.push(entry);
  return {entry,progress:()=>({ended,verified,endedAt})};
 }
 async function switchWithHeld(next:ScenarioSpec,oldTag:string,newTag:string,name:string){
  const held=await holdTCP(oldTag,name),before=held.progress().verified,oldNodeIds=[spec.ingress.nodeId,...spec.path.via];
  const accepted=await context.call('PUT',resourcePath,{expectedRevision:revision,spec:next});assert.equal(accepted.status,202,JSON.stringify(accepted.body));revision=accepted.body.revision;spec=next;
  await context.until(async()=>{const [plans]=await context.control().db.pool.query<any[]>('SELECT generation,target_revision,stage FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1',[context.forwardId]);const latest=plans[0];const resource=await context.call('GET',resourcePath);return latest.target_revision===revision&&latest.stage==='active'&&resource.body.desired.revision===revision&&resource.body.health.condition==='ready'&&resource.body.applied.length===4&&resource.body.applied.every((obs:any)=>obs.phase==='active'&&obs.deploymentGeneration===latest.generation&&obs.forwardRevision===revision);},'successor ready while old stream drains');
  assert.ok(!held.progress().ended);await context.until(async()=>held.progress().verified>=before+3,'old target stream still checked');
  const checked=await probe(spec.ingress.listen.port,newTag);assert.equal(checked.tcp,true);assert.equal(checked.udp,true);
  assert.equal((await context.call('GET',`/api/v1/scopes/${context.scope}/operations/${accepted.body.operationId}`)).body.status,'running');
  const drains:any[]=[];for(const nodeId of oldNodeIds){const [runtime]=await context.control().db.pool.query<any[]>('SELECT last_report FROM runtime_nodes WHERE node_id=?',[nodeId]);drains.push(...runtime[0].last_report.drains.filter((drain:any)=>drain.remainingConnections>0));}assert.equal(drains.length,2);
  const cutoff=Math.min(...drains.map((drain:any)=>Date.parse(drain.deadline)));await context.until(async()=>held.progress().ended,'old stream bounded cutoff');assert.ok(held.progress().endedAt<=cutoff+2500);assert.ok(held.progress().endedAt>=cutoff-2500);assert.ok(held.progress().verified>before+3);
  await waitOperation(accepted.body.operationId);assert.equal(held.entry.process.exitCode,0);
  details.push({name,oldTag,newTag,revision,verifiedOldReplies:held.progress().verified,drainDeadline:cutoff,closedAt:held.progress().endedAt});
 }
 try{
  const targetB=await spawnFixture('target',['--tag','B'],'target-B');
  const udpRoot=`${context.nativeRoot}/udp-route`,udp=spawnLinux(context.fixture,['--mode','udp-route-monitor','--port',String(spec.ingress.listen.port),'--tag','A','--next-tag','B','--run-id',udpRoot]);let udpBuffer='',udpCounts={A:0,B:0},udpPID=0,lost=0;
  udp.stderr!.on('data',()=>{});udp.stdout!.on('data',chunk=>{udpBuffer+=chunk.toString();const lines=udpBuffer.split('\n');udpBuffer=lines.pop()!;for(const line of lines){if(!line.trim())continue;const row=JSON.parse(line);udpCounts=row.verified;udpPID=row.pid;lost=row.lost;}});
  await context.until(async()=>udpCounts.A>=2,'original UDP association');const udpEntry={root:udpRoot,pid:udpPID,process:udp,mode:'udp-route-monitor'};fixtures.push(udpEntry);
  const originalTarget=spec.target;
  await switchWithHeld({...spec,target:{host:'127.0.0.1',port:targetB.status.port}},'A','B','target-switch-stream');
  await context.until(async()=>udpCounts.B>=3,'same UDP client switched target');assert.equal(udp.exitCode,null);details.push({udpReplies:udpCounts,lostDatagrams:lost});await stopFixture(context,udpEntry);
  context.pass('Held target switch: old TCP keeps target A until bounded drain; new TCP/UDP and the same UDP client reach target B without stale replies');
  const node=await context.call('POST',`/api/v1/scopes/${context.scope}/nodes`,{allowedListenerAddresses:['127.0.0.1'],allowedPorts:[spec.ingress.listen.port,context.unusedListenPort],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false});assert.equal(node.status,201);
  const root=`${context.nativeRoot}/egress-switch`,args=['--control',`https://${host}:${context.control().port}`,'--node',node.body.nodeId,'--ca',linuxPath(context.caPath),'--state',`${root}/state`,'--journal-key',`${root}/secrets/journal.key`,'--relay'];
  try{await linux('env',[`TUNEX_ENROLLMENT_TOKEN=${node.body.enrollmentToken}`,context.binary,...args,'--enroll']);}catch{throw new Error('Switch Node enrollment failed; token redacted');}
  const process=spawnLinux(context.binary,args);process.stderr!.on('data',()=>{});context.agents.push({nodeId:node.body.nodeId,root,args,process});
  await context.until(async()=>{const [issued]=await context.control().db.pool.query<any[]>('SELECT COUNT(*) n FROM node_relay_credentials WHERE node_id=?',[node.body.nodeId]);return issued[0].n===1;},'switch peer identity');
  assert.equal((await context.call('PUT',`/api/v1/scopes/${context.scope}/nodes/${node.body.nodeId}/relay-endpoint`,{expectedRevision:0,config:{listenAddress:'127.0.0.1',advertisedHost:'127.0.0.1',allowedTcpPorts:[await context.freePort(),await context.freePort()]}})).status,202);
  const originalEgress=spec.path.via[0]!;
  await switchWithHeld({...spec,target:originalTarget,path:{via:[node.body.nodeId]}},'B','A','path-switch-stream');
  const [oldSlots]=await context.control().db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id=?',[originalEgress,context.forwardId]);assert.equal(oldSlots[0].n,0);
  context.pass('Held path switch: third independent egress activates tail-to-head; old path streams drain before its internal slots are released');
  const restored={...spec,path:{via:[originalEgress]}},restore=await context.call('PUT',resourcePath,{expectedRevision:revision,spec:restored});assert.equal(restore.status,202);revision=restore.body.revision;spec=restored;await waitOperation(restore.body.operationId);
  const occupancy=await spawnFixture('occupy-udp',['--port',String(context.unusedListenPort)],'external-udp');
  const failing={...spec,ingress:{...spec.ingress,listen:{address:'127.0.0.1',port:context.unusedListenPort}}},accepted=await context.call('PUT',resourcePath,{expectedRevision:revision,spec:failing});assert.equal(accepted.status,202);revision=accepted.body.revision;spec=failing;
  await context.until(async()=>{const resource=await context.call('GET',resourcePath);return resource.body.applied.some((obs:any)=>obs.nodeId===spec.ingress.nodeId&&obs.condition==='ready')&&resource.body.applied.some((obs:any)=>obs.nodeId===spec.ingress.nodeId&&obs.errorCode==='PORT_IN_USE');},'one ingress protocol failed');
  const partial=await context.call('GET',resourcePath);assert.equal(partial.body.health.condition,'degraded');assert.deepEqual(partial.body.desired.spec.protocols,['tcp','udp']);assert.equal((await context.call('GET',`/api/v1/scopes/${context.scope}/operations/${accepted.body.operationId}`)).body.status,'running');assert.equal((await probe(spec.ingress.listen.port,'A',true)).tcp,true);
  context.pass('Partial activation: external UDP conflict preserves exact TCP flow and full two-protocol intent; overall Operation stays running/degraded');
  const [reportRows]=await context.control().db.pool.query<any[]>('SELECT last_report,session_epoch FROM runtime_nodes WHERE node_id=?',[spec.ingress.nodeId]);
  await context.control().db.pool.query('UPDATE operations SET execution_deadline=? WHERE id=?',[Date.now()-1,accepted.body.operationId]);
  await context.until(async()=>{const operation=await context.call('GET',`/api/v1/scopes/${context.scope}/operations/${accepted.body.operationId}`);return operation.body.status==='failed'&&!operation.body.cleanupPending;},'actual scanner expiry and both-Node cleanup',75000);
  const failed=await context.call('GET',resourcePath);assert.equal(failed.body.desired.revision,revision);assert.deepEqual(failed.body.desired.spec.protocols,['tcp','udp']);assert.equal(failed.body.lastOperation.status,'failed');
  const ingress=context.agents.find(node=>node.nodeId===spec.ingress.nodeId)!;const replay=await machineReplay(context,ingress,reportRows[0].last_report,reportRows[0].session_epoch);assert.equal(replay.status,200);assert.equal(replay.body.status,'duplicate');assert.equal((await context.call('GET',`/api/v1/scopes/${context.scope}/operations/${accepted.body.operationId}`)).body.status,'failed');
  context.pass('Execution deadline: real scanner expires an injected overdue deadline, removes both roles safely and refuses terminal-state resurrection by delayed report replay');
  await stopFixture(context,occupancy.entry);const retry=await context.call('POST',`/api/v1/scopes/${context.scope}/operations/${accepted.body.operationId}/retry`,{expectedRevision:revision});assert.equal(retry.status,202);assert.notEqual(retry.body.operationId,accepted.body.operationId);assert.equal(retry.body.sourceOperationId,accepted.body.operationId);await waitOperation(retry.body.operationId);
  const recovered=await probe(spec.ingress.listen.port,'A');assert.equal(recovered.tcp,true);assert.equal(recovered.udp,true);assert.equal((await context.call('GET',resourcePath)).body.desired.revision,revision);assert.equal((await context.call('GET',`/api/v1/scopes/${context.scope}/operations/${accepted.body.operationId}`)).body.status,'failed');
  context.pass('Explicit Relay retry: freed UDP port restores both encrypted protocols with a new Operation/generation and unchanged desired revision');
  return {spec,revision,details};
 }finally{for(const entry of [...fixtures].reverse())await stopFixture(context,entry).catch(()=>{});}
}
