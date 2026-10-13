import assert from 'node:assert/strict';
import type { MySqlUnitOfWork } from '../../apps/control/src/infrastructure/mysql.ts';

// A genuine Report must commit while another transaction owns the desired row.
// The old unqualified locking JOIN waits for that row while owning runtime_nodes,
// which also creates an API update deadlock. No report or clock fact is fabricated.
export async function reportsDuringIntentLock(db:MySqlUnitOfWork,forwardId:string,nodeIds:string[],until:(action:()=>Promise<boolean>,label:string,timeout?:number)=>Promise<void>){
 assert.ok(nodeIds.length>0);
 const holder=await db.pool.getConnection();
 try{
  await holder.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await holder.beginTransaction();
  const [locked]=await holder.query<any[]>('SELECT id FROM forwards WHERE id=? FOR UPDATE',[forwardId]);assert.equal(locked.length,1);
  const placeholders=nodeIds.map(()=>'?').join(','),query=`SELECT node_id,session_epoch,last_report_sequence FROM runtime_nodes WHERE node_id IN (${placeholders})`;
  const [before]=await db.pool.query<any[]>(query,nodeIds);assert.equal(before.length,nodeIds.length);
  await until(async()=>{const [current]=await db.pool.query<any[]>(query,nodeIds);return before.every(prior=>current.some(row=>row.node_id===prior.node_id&&row.session_epoch===prior.session_epoch&&row.last_report_sequence>prior.last_report_sequence));},'real Reports persist while Forward intent is locked',7000);
 }finally{try{await holder.rollback();}finally{holder.release();}}
}
