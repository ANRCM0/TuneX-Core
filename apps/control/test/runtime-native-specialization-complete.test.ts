import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY, digest } from '@tunex/contracts/shared';
import type { RuntimeAssignment, RuntimeSnapshot, RuntimeMessages } from '@tunex/contracts/runtime';
import type { RuntimeAssignmentFor, RuntimeSnapshotFor, RuntimeMessagesFor } from '@tunex/contracts/execution-values';
import { runtimeCodec, nativeLedgerCompiler, nativeRelayCompiler, compileDirect, compileSnapshot, compileRelayPlan, compileRelayResources, compileMultihopPlan, compileMultihopResources, relayPeerPinsChanged, nativeCloneSnapshotAssignments } from '../src/compatibility/public.ts';
import type { NativeRuntimeFamily, NativeRuntimeSnapshotInput, NativeRuntimeMachinePort, NativePublishedRuntimeEvidence, NativePublishedRuntimeReader } from '../src/compatibility/public.ts';
import type { RuntimeSnapshotInput, RuntimeMachinePort, PublishedRuntimeEvidence, PublishedRuntimeReader, RuntimeStateStore, RuntimeLedgerStore, RuntimeRelayStore } from '../src/framework/public.ts';
import { MySqlRuntimeStateStore } from '../src/infrastructure/mysql-runtime-host.ts';
import { MySqlRuntimeLedgerStore } from '../src/infrastructure/mysql-runtime-ledger.ts';
import { MySqlRelayDeploymentStore, MySqlRelayObservations } from '../src/infrastructure/mysql-runtime-relay.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { multihopFixture } from './fixtures/multihop.ts';

type Shape<T>={[K in keyof T]:T[K]};
type Equal<A,B>=(<T>()=>T extends Shape<A>?1:2) extends (<T>()=>T extends Shape<B>?1:2)?true:false;
const nativeCorrelation:[Equal<RuntimeAssignmentFor<NativeRuntimeFamily>,RuntimeAssignment>,Equal<RuntimeSnapshotFor<NativeRuntimeFamily>,RuntimeSnapshot>,Equal<RuntimeMessagesFor<NativeRuntimeFamily>['ReportRequest'],RuntimeMessages['ReportRequest']>,Equal<NativeRuntimeSnapshotInput,RuntimeSnapshotInput<NativeRuntimeFamily>>,Equal<NativeRuntimeMachinePort,RuntimeMachinePort<NativeRuntimeFamily>>,Equal<NativePublishedRuntimeEvidence,PublishedRuntimeEvidence<NativeRuntimeFamily>>,Equal<NativePublishedRuntimeReader<Transaction>,PublishedRuntimeReader<Transaction,NativePublishedRuntimeEvidence>>,MySqlRuntimeStateStore extends RuntimeStateStore<Transaction,NativeRuntimeFamily>?true:false,MySqlRuntimeLedgerStore extends RuntimeLedgerStore<Transaction,NativeRuntimeFamily>?true:false,MySqlRelayDeploymentStore extends RuntimeRelayStore<Transaction,NativeRuntimeFamily>?true:false]=[true,true,true,true,true,true,true,true,true,true];

test('129 actual native compiler and codec bindings preserve singleton function identity and complete family correlations',()=>{
    assert.ok(nativeCorrelation.every(Boolean));assert.equal(runtimeCodec.defaultPolicy,DEFAULT_POLICY);assert.equal(runtimeCodec.digest,digest);assert.equal(runtimeCodec.compileSnapshot,compileSnapshot);
    assert.equal(nativeLedgerCompiler.direct,compileDirect);assert.equal(nativeLedgerCompiler.snapshot,compileSnapshot);
    assert.equal(nativeRelayCompiler.relayPlan,compileRelayPlan);assert.equal(nativeRelayCompiler.relayResources,compileRelayResources);assert.equal(nativeRelayCompiler.multihopPlan,compileMultihopPlan);assert.equal(nativeRelayCompiler.multihopResources,compileMultihopResources);assert.equal(nativeRelayCompiler.peerPinsChanged,relayPeerPinsChanged);
    for(const value of [runtimeCodec,nativeLedgerCompiler,nativeRelayCompiler])assert.equal(Object.isFrozen(value),true);
    const raw={nested:{mutable:true}};assert.equal(nativeLedgerCompiler.decodeSnapshot(raw),raw);assert.equal(nativeLedgerCompiler.decodeAssignment(raw),raw);assert.equal(nativeRelayCompiler.readValue(raw),raw);
    const text='{"nested":{"mutable":true}}';assert.deepEqual(nativeLedgerCompiler.decodeSnapshot(text),raw);assert.notEqual(nativeLedgerCompiler.decodeSnapshot(text),raw);
    const cloned=nativeCloneSnapshotAssignments(raw);assert.deepEqual(cloned,raw);assert.notEqual(cloned,raw);assert.notEqual(cloned.nested,raw.nested);assert.equal(Object.isFrozen(cloned),false);
    const failure=new Error('native clone getter');assert.throws(()=>nativeCloneSnapshotAssignments({get nested(){throw failure;}}),e=>e===failure);
});

test('129 native Snapshot compiler preserves detached sorting complete wire JSON and original getter/error timing',()=>{
    const f=multihopFixture(),plan=compileMultihopPlan(f),assignments=[...plan.nodes[0]!.assignments].reverse(),before=[...assignments];
    const input={nodeId:plan.nodes[0]!.nodeId,sessionEpoch:plan.nodes[0]!.sessionEpoch,snapshotGeneration:9,issuedAt:f.issuedAt,validUntil:new Date(Date.parse(f.issuedAt)+DEFAULT_POLICY.leaseSeconds*1000).toISOString(),assignments,tombstones:[],policy:DEFAULT_POLICY};
    const output=compileSnapshot(input);assert.deepEqual(assignments,before);assert.notEqual(output.assignments,assignments);assert.deepEqual(output.assignments.map(a=>a.assignmentId),before.map(a=>a.assignmentId).sort());
    assert.deepEqual(Object.keys(output),['protocolVersion','executionExtension','nodeId','sessionEpoch','snapshotGeneration','complete','issuedAt','validUntil','assignments','tombstones','snapshotDigest']);
    const {snapshotDigest,...body}=output;assert.equal(snapshotDigest,digest(body));assert.equal(output.protocolVersion,3);assert.equal(output.executionExtension,1);assert.equal(Object.isFrozen(output),true);assert.equal(Object.isFrozen(output.assignments),true);
    const failure=new Error('sort getter'),events:string[]=[];const broken=[{get assignmentId(){events.push('assignmentId');throw failure;}},{assignmentId:'other'}];
    assert.throws(()=>compileSnapshot({...input,assignments:broken as never,get tombstones(){events.push('tombstones');return assert.fail('late tombstones');}}),e=>e===failure);assert.deepEqual(events,['assignmentId']);
    events.length=0;const invalidPolicy={...DEFAULT_POLICY,leaseSeconds:0};assert.throws(()=>compileSnapshot({...input,policy:invalidPolicy,get assignments(){events.push('assignments');return assert.fail('policy must precede assignments');}}));assert.deepEqual(events,[]);
});

type Statement=[string,unknown[]];
function sql(){
    const calls:Statement[]=[],failure=new Error('original native SQL'),state={fail:0,position:0,rows:[{n:7,body:{native:true},node_id:'node',request_digest:'request'}] as any[]};
    const tx={async execute(this:unknown,query:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([query,args]);if(++state.position===state.fail)throw failure;return [/^SELECT/.test(query)?state.rows:{affectedRows:1},[]];}} as unknown as Transaction;
    return {tx,calls,failure,state,clear(){calls.length=0;state.position=0;state.fail=0;}};
}
async function matrix(f:ReturnType<typeof sql>,cases:[string,()=>Promise<unknown>,Statement[]][]){
    for(const [name,action,expected]of cases){f.clear();await action();assert.deepEqual(f.calls,expected,name);for(let position=1;position<=expected.length;position++){f.clear();f.state.fail=position;await assert.rejects(action(),e=>e===f.failure,name);assert.deepEqual(f.calls,expected.slice(0,position),`${name} first error ${position}`);}}
}

test('129 native Runtime state storage retains complete same-Tx SQL lock/JSON/order traces and original errors',async()=>{
    const f=sql(),store=new MySqlRuntimeStateStore({pool:f.tx} as never),snapshot={nodeId:'node',sessionEpoch:2,snapshotGeneration:3,validUntil:'1970-01-01T00:00:04Z',assignments:[]} as unknown as RuntimeSnapshot;
    const report={nodeId:'node',sessionEpoch:2,reportSequence:5} as RuntimeMessages['ReportRequest'],assignment={forwardId:'forward',forwardRevision:6} as RuntimeAssignment,observation={errorCode:'ERROR',retryable:false} as never;
    await matrix(f,[
        ['lock',()=>store.lockNode(f.tx,'node'),[['SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE',['node']]]],
        ['boot',()=>store.boot(f.tx,'node','boot'),[['SELECT session_epoch FROM node_boots WHERE node_id=? AND boot_id=?',['node','boot']]]],
        ['beginBoot',()=>store.beginBoot(f.tx,'node','boot',2),[['INSERT INTO node_boots(node_id,boot_id,session_epoch) VALUES(?,?,?)',['node','boot',2]],['UPDATE runtime_nodes SET session_epoch=?,boot_id=?,last_report_sequence=0,last_report=NULL,received_at=NULL WHERE node_id=?',[2,'boot','node']]]],
        ['snapshot',()=>store.snapshot(f.tx,'node',3),[['SELECT body FROM snapshots WHERE node_id=? AND generation=?',['node',3]]]],
        ['snapshot epoch',()=>store.snapshot(f.tx,'node',3,2),[['SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',['node',3,2]]]],
        ['awaiting',()=>store.awaitingClaim(f.tx,'node'),[["SELECT COUNT(*) n FROM operations o JOIN forwards f ON f.id=o.forward_id AND f.revision=o.target_revision WHERE o.status='accepted' AND JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId'))=?",['node']]]],
        ['operation',()=>store.operation(f.tx,'operation'),[['SELECT * FROM operations WHERE id=? FOR UPDATE',['operation']]]],
        ['saveSnapshot',()=>store.saveSnapshot(f.tx,snapshot),[['INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,?,?,?,?)',['node',3,2,4000,JSON.stringify(snapshot)]],['UPDATE runtime_nodes SET snapshot_generation=? WHERE node_id=?',[3,'node']]]],
        ['cleanup',()=>store.cleanupNodeIDs(),[["SELECT node_id FROM retirements WHERE safe=FALSE UNION SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId')) AS CHAR CHARACTER SET ascii) COLLATE ascii_bin node_id FROM operations o JOIN forwards f ON f.id=o.forward_id WHERE o.cleanup_pending=TRUE AND o.status='failed' LIMIT 20",[]]]],
        ['reportDigest',()=>store.reportDigest(f.tx,'node',2,5),[['SELECT request_digest FROM reports WHERE node_id=? AND session_epoch=? AND sequence=?',['node',2,5]]]],
        ['saveReport',()=>store.saveReport(f.tx,report,'digest',9),[['INSERT INTO reports(node_id,session_epoch,sequence,request_digest) VALUES(?,?,?,?)',['node',2,5,'digest']],['UPDATE runtime_nodes SET last_report_sequence=?,last_report=?,received_at=? WHERE node_id=?',[5,JSON.stringify(report),9,'node']]]],
        ['fail',()=>store.failExecution(f.tx,assignment,observation,9),[["UPDATE operations SET last_error=?,updated_at=?,status=IF(?,'running','failed'),cleanup_pending=IF(?,cleanup_pending,TRUE) WHERE forward_id=? AND target_revision=? AND status='running'",['{"code":"ERROR","retryable":false}',9,false,false,'forward',6]]]],
    ]);
    f.clear();assert.equal(await store.snapshot(f.tx,'node',3),f.state.rows[0]!.body);f.state.rows=[];assert.equal(await store.snapshot(f.tx,'node',3),undefined);
});

test('129 native Ledger storage complete method/lock/JSON history traces keep all original statement arguments and failure positions',async()=>{
    const f=sql(),s=new MySqlRuntimeLedgerStore(),key={node_id:'node',assignment_id:'assignment',deployment_generation:3,binding_fence:4},k=['node','assignment',3,4],a={assignmentId:'assignment',forwardId:'forward',deploymentGeneration:3,bindingFence:4} as RuntimeAssignment;
    const snapshot={nodeId:'node',sessionEpoch:2,validUntil:'1970-01-01T00:00:04Z',assignments:[a]} as RuntimeSnapshot,retirement={...key,removed_epoch:2} as never;
    const input={id:'operation',forward:{id:'forward',scopeId:'scope',revision:6},request:{actorId:'actor',key:'request',digest:'digest'},kind:'create',at:9,executionDeadline:10,sourceOperationId:null,previousSpec:{old:true}} as never;
    await matrix(f,[
        ['quarantine',()=>s.beginQuarantine(f.tx),[['UPDATE operations SET recovery_invalidated=TRUE,claim_token=NULL,claim_until=NULL',[]],['UPDATE retirements SET safe=TRUE',[]],['UPDATE runtime_nodes SET last_report=NULL,received_at=NULL',[]],['SELECT s.node_id,s.generation,s.body FROM snapshots s JOIN runtime_nodes r ON r.node_id=s.node_id AND r.snapshot_generation=s.generation',[]]]],
        ['quarantineRetirement',()=>s.quarantineRetirement(f.tx,'node',a,'operation',8),[['INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation,safe) VALUES(?,?,?,?,?,?,?,?,TRUE) ON DUPLICATE KEY UPDATE safe=TRUE',['node','assignment',3,4,'forward','operation',JSON.stringify(a),8]]]],
        ['assignments',()=>s.assignmentOperations(f.tx,['forward','other']),[['SELECT * FROM operations WHERE forward_id IN (?,?) ORDER BY created_at DESC,id DESC FOR UPDATE',['forward','other']]]],
        ['slots',()=>s.assignmentSlots(f.tx,'node'),[['SELECT * FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',['node']]]],
        ['latestSnapshot',()=>s.latestSnapshot(f.tx,'node'),[['SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1',['node']]]],
        ['session',()=>s.nodeSession(f.tx,'node'),[['SELECT session_epoch FROM runtime_nodes WHERE node_id=?',['node']]]],
        ['revision',()=>s.operationForRevision(f.tx,'forward',6),[['SELECT * FROM operations WHERE forward_id=? AND target_revision=? ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',['forward',6]]]],
        ['latest',()=>s.latestOperation(f.tx,'forward'),[['SELECT * FROM operations WHERE forward_id=? ORDER BY target_revision DESC,created_at DESC,id DESC LIMIT 1',['forward']]]],
        ['recordError',()=>s.recordRelayError(f.tx,'operation',{error:true},9),[['UPDATE operations SET last_error=?,updated_at=? WHERE id=?',['{"error":true}',9,'operation']]]],
        ['fail',()=>s.failRelayOperation(f.tx,'operation',{error:true},9),[["UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=?",['{"error":true}',9,'operation']]]],
        ['succeed',()=>s.succeedRelayOperation(f.tx,'operation',9,10),[["UPDATE operations SET status='succeeded',cleanup_pending=FALSE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=? AND status='running' AND execution_deadline>?",[9,'operation',10]]]],
        ['clearTerminal',()=>s.clearTerminalRelayCleanup(f.tx,'forward',9),[["UPDATE operations SET cleanup_pending=FALSE,updated_at=? WHERE forward_id=? AND status IN ('succeeded','failed','superseded')",[9,'forward']]]],
        ['deny',()=>s.denyIntent(f.tx,'operation',9),[["UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,updated_at=? WHERE id=? AND status='accepted'",['{"code":"AUTHORIZATION_DENIED","retryable":false}',9,'operation']]]],
        ['accept',()=>s.acceptOperation(f.tx,input),[["INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline,source_operation_id,previous_spec) VALUES(?,?,?,? ,?,'accepted',?,?,?,?,?,?,?,?)",['operation','scope','forward',6,'create','actor','request','digest',9,9,10,null,'{"old":true}']],["UPDATE operations SET status='superseded',superseded_by=?,claim_token=NULL,claim_until=NULL,updated_at=? WHERE forward_id=? AND id<>? AND status IN ('accepted','running')",['operation',9,'forward','operation']],['UPDATE retirements SET operation_id=? WHERE forward_id=? AND safe=FALSE',['operation','forward']]]],
        ['retire',()=>s.retireAssignment(f.tx,'node',a,'operation',8),[['INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE operation_id=VALUES(operation_id)',['node','assignment',3,4,'forward','operation',JSON.stringify(a),8]],['UPDATE operations SET cleanup_pending=TRUE WHERE id=?',['operation']]]],
        ['leases',()=>s.recordLeases(f.tx,snapshot),[['INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE valid_until=GREATEST(valid_until,VALUES(valid_until))',['forward','node','assignment',3,4,2,4000]]]],
        ['previousLeases',()=>s.previousUnsafeLeases(f.tx,'forward',9),[['SELECT l.node_id,l.assignment_id,l.deployment_generation,l.binding_fence FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND l.valid_until+5000>? AND (r.safe IS NULL OR r.safe=FALSE)',['forward',9]]]],
        ['sessionLeases',()=>s.unsafeSessionLeaseCount(f.tx,'node',2,9),[['SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.node_id=? AND l.session_epoch<>? AND l.valid_until+5000>? AND (r.safe IS NULL OR r.safe=FALSE)',['node',2,9]]]],
        ['retirements',()=>s.retirements(f.tx,'node'),[['SELECT * FROM retirements WHERE node_id=? ORDER BY retirement_generation,assignment_id',['node']]]],
        ['retirement',()=>s.retirement(f.tx,key),[['SELECT * FROM retirements WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?',k]]],
        ['instanceLease',()=>s.instanceLease(f.tx,key,2),[['SELECT MAX(valid_until) until FROM execution_leases WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=? AND session_epoch=?',[...k,2]]]],
        ['removed',()=>s.markRemoved(f.tx,key,2),[['UPDATE retirements SET removed_epoch=? WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?',[2,...k]]]],
        ['unsafeRetirements',()=>s.unsafeRetirementsForUpdate(f.tx,'node'),[['SELECT * FROM retirements WHERE node_id=? AND safe=FALSE FOR UPDATE',['node']]]],
        ['outstanding',()=>s.outstandingRetirementLeases(f.tx,retirement,9),[['SELECT COUNT(*) n FROM execution_leases WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=? AND valid_until+5000>? AND (session_epoch<>? OR ? IS NULL)',[...k,9,2,2]]]],
        ['safe',()=>s.markRetirementSafe(f.tx,key),[['UPDATE retirements SET safe=TRUE WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?',k]]],
        ['completion',()=>s.completionOperations(f.tx,'node'),[["SELECT o.* FROM operations o JOIN forwards f ON f.id=o.forward_id AND f.revision=o.target_revision WHERE o.recovery_invalidated=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId'))=? AND (o.status='running' OR o.cleanup_pending=TRUE) ORDER BY o.id FOR UPDATE OF o",['node']]]],
        ['pending',()=>s.pendingRetirementCount(f.tx,'forward'),[['SELECT COUNT(*) n FROM retirements WHERE forward_id=? AND safe=FALSE',['forward']]]],
        ['unsafe',()=>s.unsafeLeaseCount(f.tx,'forward'),[['SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND (r.safe IS NULL OR r.safe=FALSE)',['forward']]]],
        ['complete clear',()=>s.completeOperation(f.tx,'operation',9,true),[["UPDATE operations SET status=IF(status='running','succeeded',status),cleanup_pending=FALSE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=?",[9,'operation']]]],
        ['complete retain',()=>s.completeOperation(f.tx,'operation',9,false),[["UPDATE operations SET status=IF(status='running','succeeded',status),cleanup_pending=FALSE,updated_at=? WHERE id=?",[9,'operation']]]],
        ['clearFailed',()=>s.clearFailedSupersededCleanup(f.tx,'forward'),[["UPDATE operations SET cleanup_pending=FALSE WHERE forward_id=? AND status IN ('failed','superseded')",['forward']]]],
        ['clearOperation',()=>s.clearOperationCleanup(f.tx,'operation',9),[['UPDATE operations SET cleanup_pending=FALSE,updated_at=? WHERE id=?',[9,'operation']]]],
        ['get',()=>s.getOperation(f.tx,'scope','operation',false),[['SELECT * FROM operations WHERE id=? AND scope_id=?',['operation','scope']]]],
        ['get lock',()=>s.getOperation(f.tx,'scope','operation',true),[['SELECT * FROM operations WHERE id=? AND scope_id=? FOR UPDATE',['operation','scope']]]],
        ['expire',()=>s.expireOperations(f.tx,9),[["UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE recovery_invalidated=FALSE AND status IN ('accepted','running') AND execution_deadline<=?",['{"code":"EXECUTION_DEADLINE","retryable":false}',9,9]]]],
        ['claimable',()=>s.claimableOperation(f.tx,9),[["SELECT * FROM operations WHERE recovery_invalidated=FALSE AND status IN ('accepted','running') AND (claim_until IS NULL OR claim_until<=?) AND execution_deadline>? ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",[9,9]]]],
        ['claim',()=>s.claimOperation(f.tx,'operation','token',9,10),[["UPDATE operations SET status='running',claim_token=?,claim_until=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?",['token',10,9,'operation']]]],
    ]);
});

test('129 native Relay deployment and observation storage complete SQL traces retain original same-Tx history and locks',async()=>{
    const f=sql(),s=new MySqlRelayDeploymentStore(),o=new MySqlRelayObservations(),forward={id:'forward',revision:6,spec:{ingress:{nodeId:'ingress'},path:{via:['egress']}}} as never,plan={path:['ingress','transit','egress'],native:true} as never;
    await matrix(f,[
        ['quarantine',()=>s.quarantine(f.tx,9),[["UPDATE relay_deployments SET stage='withdrawn',updated_at=?",[9]]]],
        ['latest',()=>s.latest(f.tx,'forward',false),[['SELECT * FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1',['forward']]]],
        ['latest lock',()=>s.latest(f.tx,'forward',true),[['SELECT * FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1 FOR UPDATE',['forward']]]],
        ['forForward',()=>s.forForward(f.tx,'forward'),[['SELECT * FROM relay_deployments WHERE forward_id=?',['forward']]]],
        ['all',()=>s.allDeployments(f.tx),[['SELECT * FROM relay_deployments',[]]]],
        ['forNode',()=>s.forNode(f.tx,'node'),[['SELECT d.* FROM relay_deployments d WHERE (d.ingress_node_id=? OR d.egress_node_id=? OR JSON_CONTAINS(d.path_nodes,JSON_QUOTE(?))) AND d.generation=(SELECT MAX(generation) FROM relay_deployments WHERE forward_id=d.forward_id) ORDER BY d.forward_id',['node','node','node']]]],
        ['insertRelay',()=>s.insertRelay(f.tx,forward,3,plan,9,10),[['INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',['forward',3,6,'ingress','egress',JSON.stringify(plan),9,10]]]],
        ['insertMultihop',()=>s.insertMultihop(f.tx,forward,3,plan,9,10),[['INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,path_nodes,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',['forward',3,6,'ingress','egress','["ingress","transit","egress"]',JSON.stringify(plan),9,10]]]],
        ['withdraw',()=>s.withdraw(f.tx,'forward',3,9),[["UPDATE relay_deployments SET stage='withdrawn',updated_at=? WHERE forward_id=? AND generation=?",[9,'forward',3]]]],
        ['touch',()=>s.touch(f.tx,'forward',3,9),[['UPDATE relay_deployments SET updated_at=? WHERE forward_id=? AND generation=?',[9,'forward',3]]]],
        ['stage',()=>s.setStage(f.tx,'forward',3,'active',9),[['UPDATE relay_deployments SET stage=?,updated_at=? WHERE forward_id=? AND generation=?',['active',9,'forward',3]]]],
        ['activate',()=>s.activate(f.tx,'forward',3,9),[["UPDATE relay_deployments SET stage='active',updated_at=? WHERE forward_id=? AND generation=?",[9,'forward',3]]]],
        ['preparation',()=>s.setPreparation(f.tx,'forward',3,2,'preparing',1,9),[['UPDATE relay_deployments SET prepared_count=?,stage=?,activated_count=?,updated_at=? WHERE forward_id=? AND generation=?',[2,'preparing',1,9,'forward',3]]]],
        ['activation',()=>s.incrementActivation(f.tx,'forward',3,9),[['UPDATE relay_deployments SET activated_count=activated_count+1,updated_at=? WHERE forward_id=? AND generation=?',[9,'forward',3]]]],
        ['forwardIDs',()=>s.forwardIDsForNode(f.tx,'node'),[['SELECT DISTINCT forward_id FROM relay_deployments WHERE ingress_node_id=? OR egress_node_id=? OR JSON_CONTAINS(path_nodes,JSON_QUOTE(?)) ORDER BY forward_id',['node','node','node']]]],
        ['pending',()=>s.pendingDeployments(f.tx),[["SELECT d.* FROM relay_deployments d WHERE d.generation=(SELECT MAX(generation) FROM relay_deployments WHERE forward_id=d.forward_id) AND (d.stage<>'withdrawn' OR EXISTS(SELECT 1 FROM operations o WHERE o.forward_id=d.forward_id AND o.recovery_invalidated=FALSE AND (o.status IN ('accepted','running') OR o.cleanup_pending=TRUE))) ORDER BY d.updated_at,d.forward_id LIMIT 100",[]]]],
        ['observation session',()=>o.nodeSession(f.tx,'node'),[['SELECT session_epoch FROM runtime_nodes WHERE node_id=?',['node']]]],
        ['runtime',()=>o.runtimeNode(f.tx,'node'),[['SELECT * FROM runtime_nodes WHERE node_id=?',['node']]]],
        ['snapshot',()=>o.snapshot(f.tx,'node',3,2),[['SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',['node',3,2]]]],
        ['latestSnapshot',()=>o.latestSnapshot(f.tx,'node'),[['SELECT body,valid_until FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1',['node']]]],
        ['portOwner',()=>o.portOwner(f.tx,'node',80),[["SELECT owner_id FROM port_slots WHERE node_id=? AND protocol='tcp' AND port=?",['node',80]]]],
        ['isolation',()=>o.isolation(f.tx,'forward'),[['SELECT node_id,assignment_id,binding_fence,removed_epoch FROM retirements WHERE forward_id=? AND safe=FALSE ORDER BY node_id,assignment_id',['forward']]]],
        ['pending retirement',()=>o.pendingRetirementCount(f.tx,'forward'),[['SELECT COUNT(*) n FROM retirements WHERE forward_id=? AND safe=FALSE',['forward']]]],
        ['unsafe lease',()=>o.unsafeLeaseCount(f.tx,'forward'),[['SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND (r.safe IS NULL OR r.safe=FALSE)',['forward']]]],
        ['leaseNodes',()=>o.leaseNodes(f.tx,'forward'),[['SELECT DISTINCT node_id FROM execution_leases WHERE forward_id=?',['forward']]]],
    ]);
    f.clear();assert.equal(await s.forForward(f.tx,'forward'),f.state.rows);assert.equal(await s.latest(f.tx,'forward',false),f.state.rows[0]);assert.equal(await o.runtimeNode(f.tx,'node'),f.state.rows[0]);assert.equal(await o.pendingRetirementCount(f.tx,'forward'),7);assert.equal(await o.unsafeLeaseCount(f.tx,'forward'),7);
});
