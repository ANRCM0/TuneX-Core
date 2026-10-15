import { readFileSync, writeFileSync } from 'node:fs';
import { digest } from '../packages/contracts/src/digest.ts';
import { hopPathDigest } from '../packages/contracts/src/multihop.ts';
import { compileMultihopPlan } from '../apps/control/src/modules/runtime/multihop-plan.ts';
import { compileSnapshot } from '../apps/control/src/modules/runtime/planner.ts';
import { multihopFixture } from '../apps/control/test/fixtures/multihop.ts';

const cases=[];
function sign(s){for(const a of s.assignments)a.driver.configDigest=digest(a.driver.config);delete s.snapshotDigest;s.snapshotDigest=digest(s);return s;}
function config(s){for(const a of s.assignments){a.driver.config.hop.pathDigest=hopPathDigest(a.driver.config.hop);a.driver.configDigest=digest(a.driver.config);}return sign(s);}
function add(name,payload,valid){cases.push({name,raw:JSON.stringify(payload),valid});}
for(const count of [3,4,8]){
  const input=multihopFixture(count),plan=compileMultihopPlan(input);
  for(const node of plan.nodes)add(`${count}-${node.nodeId}`,compileSnapshot({nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,snapshotGeneration:1,issuedAt:input.issuedAt,validUntil:'2026-10-16T10:05:00Z',assignments:node.assignments,tombstones:[]}),true);
}
const base=()=>JSON.parse(cases.find(c=>c.name==='3-node-2').raw);
const mixed=base(),legacy=JSON.parse(readFileSync(new URL('../docs/protocol/fixtures/adp-v3-runtime.json',import.meta.url),'utf8'));
const old=JSON.parse(legacy.cases.find(c=>c.name==='mixed-direct-relay').raw);
for(const [i,original] of old.assignments.entries()){
  const a=structuredClone(original);a.assignmentId='mixed-assignment-'+i;a.resource.port=34000+i;
  if(a.role!=='direct'){
    const b=a.driver.config.binding,side=a.role==='relay-ingress'?'ingress':'egress';
    b[side+'NodeId']=mixed.nodeId;b[side+'SessionEpoch']=mixed.sessionEpoch;b[side+'AssignmentId']=a.assignmentId;
  }
  mixed.assignments.push(a);
}
mixed.assignments.sort((a,b)=>a.assignmentId<b.assignmentId?-1:a.assignmentId>b.assignmentId?1:0);
add('mixed-direct-relay-multihop',sign(mixed),true);
const negative={
  'missing-extension':s=>{delete s.executionExtension;},'unknown-extension':s=>{s.executionExtension=2;},
  'foreign-node':s=>{s.nodeId='foreign';},'foreign-session':s=>{s.sessionEpoch++;},
  'missing-hop':s=>{delete s.assignments[0].driver.config.hop;},'unknown-config':s=>{s.assignments[0].driver.config.shell='denied';},
  'wrong-role':s=>{s.assignments[0].role='multihop-egress';},'wrong-physical':s=>{s.assignments[0].resource.protocol='udp';},
  'wrong-fence':s=>{s.assignments[0].bindingFence++;},'wrong-generation':s=>{s.assignments[0].deploymentGeneration++;},
  'wrong-target':s=>{s.assignments[0].driver.config.hop.target.port++;},'wrong-pin':s=>{s.assignments[0].driver.config.hop.path[0].peerFingerprint='sha256:'+'f'.repeat(64);},
  'profile-digest':s=>{s.assignments[0].driver.config.hop.profile.idleTimeoutSeconds++;},
  'duplicate-node':s=>{const h=s.assignments[0].driver.config.hop;h.path[0].nodeId=h.path[1].nodeId;config(s);},
  'duplicate-pin':s=>{const h=s.assignments[0].driver.config.hop;h.path[0].peerFingerprint=h.path[1].peerFingerprint;config(s);},
  'cidr-host-bits':s=>{s.assignments[0].driver.config.hop.allowedDestinationCidrs=['127.0.0.1/8'];config(s);},
  'target-case':s=>{s.assignments[0].driver.config.hop.target.host='Target.Example.';config(s);},
  'hop-out-of-range':s=>{s.assignments[0].driver.config.hop.hopIndex=3;config(s);},
  'duplicate-physical':s=>{s.assignments[1].resource.port=s.assignments[0].resource.port;},
  'retired-fence':s=>{const a=s.assignments[0];s.tombstones=[{assignmentId:a.assignmentId,forwardId:a.forwardId,role:a.role,protocol:a.protocol,physicalProtocol:a.resource.protocol,port:a.resource.port,bindingFence:a.bindingFence,retirementGeneration:1}];},
};
for(const [name,mutate] of Object.entries(negative)){const s=base();mutate(s);add(name,sign(s),false);}
const file=new URL('../docs/protocol/fixtures/adp-v3-execution.json',import.meta.url);
const contents=JSON.stringify({description:'Shared execution extension vectors; stateless contract evidence only.',cases},null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync(file,'utf8').replaceAll('\r\n','\n')!==contents)throw Error('Multi-hop fixtures are stale');}
else writeFileSync(file,contents);
console.log(`${cases.length} multi-hop execution vectors ${process.argv.includes('--check')?'verified':'generated'}.`);
