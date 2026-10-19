import type { BackupManifest } from '../../compatibility/public.ts';
import type { RecoveryIdentity } from '../identity-owner/public.ts';
import type { BackupDatabaseOptions, RestoreDatabaseOptions, RecoveryDatabase, RecoverySource,
    RecoveryWorkflowOptions } from './workflow-contracts.ts';

/** Original operator workflow; native I/O and each quarantine owner are explicit. */
export class RecoveryWorkflow<Tx,Database extends RecoveryDatabase<Tx>,Source extends RecoverySource> {
    private readonly options:RecoveryWorkflowOptions<Tx,Database,Source>;
    constructor(options:RecoveryWorkflowOptions<Tx,Database,Source>){this.options=options;}

    async backupDatabase(options:BackupDatabaseOptions):Promise<string> {
        const native=this.options.native;
        const directory=native.resolve(options.directory);
        native.outsideProtectedDirectory(directory,options.authority);
        await native.outsideNotificationDirectory(directory,options.notificationSecretsDirectory);
        await native.makeDirectory(directory);
        await native.outsideNotificationDirectory(directory,options.notificationSecretsDirectory);
        const db=native.openDatabase(options.databaseUrl);
        try {
            const metadata=await native.backupMetadata(db);
            const current=await options.authority.read();
            if(current.database!==metadata[0]!.binding)throw new Error('Backup database does not match protected authority binding');
            const id=native.newId(),sqlFile=`${id}.sql`,path=native.resolve(directory,sqlFile);
            await native.createEmptyDump(path);
            await native.dump(options,path);
            await native.syncDump(path,directory);
            const after=await options.authority.read();
            if(after.database!==metadata[0]!.binding||after.trustDigest!==current.trustDigest)throw new Error('Authority binding changed during backup');
            const leases=await native.leaseBound(db);
            if(leases[0]!.until!==null&&(after.latestValidUntil??0)<leases[0]!.until)throw new Error('Database authorization exceeds the independent trusted record');
            const payload:BackupManifest={version:1,id,createdAt:native.createdAt(),database:metadata[0]!.name,
                authorityBinding:after.database,trustDigest:after.trustDigest,sqlFile,sqlSHA:await native.fileSHA(path),
                mysqlVersion:metadata[0]!.version,nodeCount:metadata[0]!.nodes,forwardCount:metadata[0]!.forwards,
                operationCount:metadata[0]!.operations};
            const manifest=native.resolve(directory,`${id}.json`);
            await native.durableFile(manifest,native.pretty({payload,mac:await options.authority.signArtifact(payload)}));
            return manifest;
        } finally {await db.close();}
    }

    async restoreDatabase(options:RestoreDatabaseOptions):Promise<{recoveryId:string;databaseUrl:string;ownerCredentials:string}> {
        const native=this.options.native;
        if(options.issuersStopped!==true)throw new Error('All signing services must be stopped and verified before restore');
        if(!native.validTargetDatabase(options.targetDatabase))throw new Error('Bounded fresh database name required');
        const authority=await options.authority.read();
        if(!authority.maintenance)throw new Error('Protected maintenance state required');
        const envelope=await native.readManifest(options.manifest);
        await options.authority.verifyArtifact(envelope.payload,envelope.mac);
        const manifest=envelope.payload;
        if(manifest.version!==1||manifest.authorityBinding!==authority.database||manifest.trustDigest!==authority.trustDigest||!native.validTrustDigest(options.newTrustDigest)||options.newTrustDigest===authority.trustDigest)throw new Error('Fresh trust and matching backup authority required');
        const path=native.sqlPath(options,manifest.sqlFile);
        if(await native.fileSHA(path)!==manifest.sqlSHA)throw new Error('Backup SQL integrity failure');
        const time=await native.trustedTime(options.timeChecker,options.timeCheckerArgs);
        if(authority.latestValidUntil!==null&&time.now-time.maxSkewSeconds*1000<authority.latestValidUntil+authority.maxClockSkewSeconds*1000)throw new Error('RECOVERY_NOT_READY: historical authorization has not been exhausted');
        const directory=native.resolve(options.credentialsDirectory);
        native.outsideProtectedDirectory(directory,options.authority);
        await native.outsideNotificationDirectory(directory,options.notificationSecretsDirectory);
        await native.makeDirectory(directory);
        await native.outsideNotificationDirectory(directory,options.notificationSecretsDirectory);
        const source=await native.beginRestore(options),recoveryId=source.recoveryId;
        try {
            const databaseUrl=await native.createRestoreTarget(source,options);
            await native.restoreDump(options,databaseUrl,path);
            const db=native.openDatabase(databaseUrl);
            let accounts:RecoveryIdentity[]=[];
            try {
                await db.migrate();
                const bounds=await native.leaseBound(db);
                if(bounds[0]!.until!==null&&bounds[0]!.until>(authority.latestValidUntil??0))throw new Error('Restored authorization exceeds independently recorded bounds');
                await db.transaction(async tx=>{
                    await this.options.quarantine(db,tx,{recoveryId,manifest,authority,
                        get newTrustDigest(){return options.newTrustDigest;},acceptCredentials:next=>{accounts=next;}});
                });
                const binding=await native.databaseBinding(db);
                const credentials=native.resolve(directory,`${recoveryId}-credentials.json`);
                await native.durableFile(credentials,native.pretty({recoveryId,accounts,owners:accounts.filter(account=>account.owner)}));
                await options.authority.rebind(binding[0]!.binding,options.newTrustDigest,recoveryId);
                return {recoveryId,databaseUrl,ownerCredentials:credentials};
            } finally {await db.close();}
        } finally {await native.closeRestoreSource(source);}
    }
}
