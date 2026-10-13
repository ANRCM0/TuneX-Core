import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuthorityStore,trustDigest } from '../../apps/control/src/infrastructure/authority.ts';
import { backupDatabase,restoreDatabase } from './recovery.ts';
function required(name:string){const value=process.env[name];if(!value)throw new Error(`${name} required`);return value;}
async function main(){
const [command,argument,reviewId]=process.argv.slice(2);const authority=new AuthorityStore(required('TUNEX_CONTROL_STATE'));
if(command==='status')console.log(JSON.stringify(await authority.read(),null,2));
else if(command==='maintenance')console.log(JSON.stringify(await authority.maintain(),null,2));
else if(command==='resume')console.log(JSON.stringify(await authority.resume(argument),null,2));
else if(command==='backup'){const manifest=await backupDatabase({databaseUrl:required('DATABASE_URL'),authority,directory:argument??required('TUNEX_BACKUP_DIRECTORY'),mysqldump:process.env.TUNEX_MYSQLDUMP??'mysqldump'});console.log(JSON.stringify({manifest}));}
else if(command==='restore'){
 if(!argument||!reviewId||process.env.TUNEX_ISSUERS_STOPPED!=='1')throw new Error('restore <manifest> <fresh-database> requires explicit stopped-issuer verification');
 const result=await restoreDatabase({sourceDatabaseUrl:required('DATABASE_URL'),targetDatabase:reviewId,manifest:resolve(argument),authority,newTrustDigest:trustDigest(await readFile(required('TUNEX_RECOVERY_CA_CERT'))),mysql:process.env.TUNEX_MYSQL??'mysql',credentialsDirectory:required('TUNEX_RECOVERY_CREDENTIALS'),issuersStopped:true,timeChecker:required('TUNEX_RECOVERY_CLOCK'),timeCheckerArgs:process.env.TUNEX_RECOVERY_CLOCK_ARGS?JSON.parse(process.env.TUNEX_RECOVERY_CLOCK_ARGS):[]});console.log(JSON.stringify({recoveryId:result.recoveryId,database:reviewId,ownerCredentials:result.ownerCredentials,reviewRequired:true}));
}else throw new Error('Usage: status|maintenance|resume [review-id]|backup [directory]|restore <manifest> <fresh-database>');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Operator command failed');process.exitCode=1;});
