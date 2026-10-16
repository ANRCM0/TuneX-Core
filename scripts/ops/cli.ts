import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuthorityStore,trustDigest } from '../../apps/control/src/infrastructure/authority.ts';
import { backupDatabase,restoreDatabase } from './recovery.ts';
import { runUpgradeAssessment } from './upgrade-inspect.ts';
function required(name:string){const value=process.env[name];if(!value)throw new Error(`${name} required`);return value;}
async function main(){
const [command,argument,reviewId,...extra]=process.argv.slice(2);
if(command==='assess-upgrade'){
 if(!argument||reviewId||extra.length)throw new Error('Usage: assess-upgrade <plan.json>');
 try{
  const report=await runUpgradeAssessment({planPath:argument,databaseUrl:required('DATABASE_URL'),stateDirectory:required('TUNEX_CONTROL_STATE'),caPath:required('TUNEX_CA_CERT')});
  console.log(JSON.stringify(report,null,2));process.exitCode=report.decision==='blocked'?1:report.decision==='review-required'?2:0;
 }catch(error){
  const codes=new Set(['INVALID_UPGRADE_PLAN','UPGRADE_INPUT_LIMIT','UNREVIEWED_UPGRADE_SCHEMA','UNKNOWN_MIGRATION_FILE','UNREVIEWED_MIGRATION_FILE','INVALID_DATABASE_COUNTER','INVALID_DATABASE_METADATA','UNSUPPORTED_UPGRADE_DATABASE','INVALID_MIGRATION_HISTORY','UPGRADE_NODE_INVENTORY_LIMIT','INVALID_DATABASE_NODE_HISTORY','UPGRADE_SCHEMA_CHANGED_RETRY']);
  const code=error instanceof Error&&codes.has(error.message)?error.message:'UPGRADE_INSPECTION_FAILED';
  console.log(JSON.stringify({version:1,scope:'read-only-compatibility',decision:'blocked',runtimeReady:false,productionApproved:false,checks:[{code,status:'block',subject:'input-or-protected-state'}]}));process.exitCode=1;
 }
 return;
}
const authority=new AuthorityStore(required('TUNEX_CONTROL_STATE'));
if(command==='status')console.log(JSON.stringify(await authority.read(),null,2));
else if(command==='maintenance')console.log(JSON.stringify(await authority.maintain(),null,2));
else if(command==='resume')console.log(JSON.stringify(await authority.resume(argument),null,2));
else if(command==='backup'){const manifest=await backupDatabase({databaseUrl:required('DATABASE_URL'),authority,directory:argument??required('TUNEX_BACKUP_DIRECTORY'),mysqldump:process.env.TUNEX_MYSQLDUMP??'mysqldump'});console.log(JSON.stringify({manifest}));}
else if(command==='restore'){
 if(!argument||!reviewId||process.env.TUNEX_ISSUERS_STOPPED!=='1')throw new Error('restore <manifest> <fresh-database> requires explicit stopped-issuer verification');
 const result=await restoreDatabase({sourceDatabaseUrl:required('DATABASE_URL'),targetDatabase:reviewId,manifest:resolve(argument),authority,newTrustDigest:trustDigest(await readFile(required('TUNEX_RECOVERY_CA_CERT'))),mysql:process.env.TUNEX_MYSQL??'mysql',credentialsDirectory:required('TUNEX_RECOVERY_CREDENTIALS'),issuersStopped:true,timeChecker:required('TUNEX_RECOVERY_CLOCK'),timeCheckerArgs:process.env.TUNEX_RECOVERY_CLOCK_ARGS?JSON.parse(process.env.TUNEX_RECOVERY_CLOCK_ARGS):[]});console.log(JSON.stringify({recoveryId:result.recoveryId,database:reviewId,ownerCredentials:result.ownerCredentials,reviewRequired:true}));
}else throw new Error('Usage: assess-upgrade <plan.json>|status|maintenance|resume [review-id]|backup [directory]|restore <manifest> <fresh-database>');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Operator command failed');process.exitCode=1;});
