import type { OperatorAuthority, OperatorCommandEffects, OperatorFailureEffects, ReleaseEvidenceCommandEffects } from './contracts.ts';

export async function runOperatorCommand<Authority extends OperatorAuthority,Certificate>(effects:OperatorCommandEffects<Authority,Certificate>):Promise<void> {
    function required(name:string):string {const value=effects.env(name);if(!value)throw new Error(`${name} required`);return value;}
    const [command,argument,reviewId,...extra]=effects.arguments();
    if(command==='assess-upgrade'){
        if(!argument||reviewId||extra.length)throw new Error('Usage: assess-upgrade <plan.json>');
        try{
            const report=await effects.assessUpgrade({planPath:argument,databaseUrl:required('DATABASE_URL'),stateDirectory:required('TUNEX_CONTROL_STATE'),caPath:required('TUNEX_CA_CERT')});
            effects.log(effects.stringify(report,null,2));effects.exitCode(report.decision==='blocked'?1:report.decision==='review-required'?2:0);
        }catch(error){
            const codes=new Set(['INVALID_UPGRADE_PLAN','UPGRADE_INPUT_LIMIT','UNREVIEWED_UPGRADE_SCHEMA','UNKNOWN_MIGRATION_FILE','UNREVIEWED_MIGRATION_FILE','INVALID_DATABASE_COUNTER','INVALID_DATABASE_METADATA','UNSUPPORTED_UPGRADE_DATABASE','INVALID_MIGRATION_HISTORY','UPGRADE_NODE_INVENTORY_LIMIT','INVALID_DATABASE_NODE_HISTORY','UPGRADE_SCHEMA_CHANGED_RETRY']);
            const code=error instanceof Error&&codes.has(error.message)?error.message:'UPGRADE_INSPECTION_FAILED';
            effects.log(effects.stringify({version:1,scope:'read-only-compatibility',decision:'blocked',runtimeReady:false,productionApproved:false,checks:[{code,status:'block',subject:'input-or-protected-state'}]}));effects.exitCode(1);
        }
        return;
    }
    const authority=effects.createAuthority(required('TUNEX_CONTROL_STATE'));
    if(command==='status')effects.log(effects.stringify(await authority.read(),null,2));
    else if(command==='maintenance')effects.log(effects.stringify(await authority.maintain(),null,2));
    else if(command==='resume')effects.log(effects.stringify(await authority.resume(argument),null,2));
    else if(command==='backup'){
        const notificationDirectory=effects.env('TUNEX_NOTIFICATION_SECRETS')||undefined;
        const manifest=await effects.backup({databaseUrl:required('DATABASE_URL'),authority,directory:argument??required('TUNEX_BACKUP_DIRECTORY'),mysqldump:effects.env('TUNEX_MYSQLDUMP')??'mysqldump',...(notificationDirectory===undefined?{}:{notificationSecretsDirectory:notificationDirectory})});
        effects.log(effects.stringify({manifest}));
    }
    else if(command==='restore'){
        if(!argument||!reviewId||effects.env('TUNEX_ISSUERS_STOPPED')!=='1')throw new Error('restore <manifest> <fresh-database> requires explicit stopped-issuer verification');
        const notificationDirectory=effects.env('TUNEX_NOTIFICATION_SECRETS')||undefined;
        const result=await effects.restore({sourceDatabaseUrl:required('DATABASE_URL'),targetDatabase:reviewId,manifest:effects.resolve(argument),authority,newTrustDigest:effects.trustDigest(await effects.readCertificate(required('TUNEX_RECOVERY_CA_CERT'))),mysql:effects.env('TUNEX_MYSQL')??'mysql',credentialsDirectory:required('TUNEX_RECOVERY_CREDENTIALS'),issuersStopped:true,timeChecker:required('TUNEX_RECOVERY_CLOCK'),timeCheckerArgs:effects.env('TUNEX_RECOVERY_CLOCK_ARGS')?effects.parseClockArgs(effects.env('TUNEX_RECOVERY_CLOCK_ARGS')!):[],...(notificationDirectory===undefined?{}:{notificationSecretsDirectory:notificationDirectory})});
        effects.log(effects.stringify({recoveryId:result.recoveryId,database:reviewId,ownerCredentials:result.ownerCredentials,reviewRequired:true}));
    }
    else throw new Error('Usage: assess-upgrade <plan.json>|status|maintenance|resume [review-id]|backup [directory]|restore <manifest> <fresh-database>');
}

export function operatorCommandFailure(error:unknown,effects:OperatorFailureEffects):void {
    effects.error(error instanceof Error?error.message:'Operator command failed');effects.exitCode(1);
}

export async function runReleaseEvidenceCommand(effects:ReleaseEvidenceCommandEffects):Promise<void> {
    const path=effects.argument(2),revision=effects.argument(3)??effects.env('TUNEX_SOURCE_REVISION');
    if(!path||!revision)throw Error('Usage: node scripts/ops/check-multihop-release.ts evidence.json <40-character-source-revision>');
    effects.log(effects.stringify(await effects.verify(path,revision),null,2));
}
