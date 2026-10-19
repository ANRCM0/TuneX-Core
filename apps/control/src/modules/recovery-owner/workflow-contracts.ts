import type { TransactionBoundary } from '../../framework/public.ts';
import type { BackupEnvelope, RecoveryBackupMetadata, RecoveryLeaseBound, RecoveryDatabaseBinding,
    NativeRecoveryAuthorityRecord } from '../../compatibility/public.ts';
import type { RecoveryQuarantineContext } from './contracts.ts';

export const RECOVERY_WORKFLOW_INTERFACE_VERSION=1 as const;

/** A public view of the same protected native authority, never a second issuer. */
export interface RecoveryAuthority {
    readonly keyPath:string;
    read():Promise<NativeRecoveryAuthorityRecord>;
    signArtifact(payload:unknown):Promise<string>;
    verifyArtifact(payload:unknown,mac:string):Promise<void>;
    rebind(database:string,trustDigest:string,recoveryId:string):Promise<NativeRecoveryAuthorityRecord>;
}
export interface BackupDatabaseOptions {
    databaseUrl:string;authority:RecoveryAuthority;directory:string;mysqldump:string;notificationSecretsDirectory?:string;
}
export interface RestoreDatabaseOptions {
    sourceDatabaseUrl:string;targetDatabase:string;manifest:string;authority:RecoveryAuthority;newTrustDigest:string;
    mysql:string;credentialsDirectory:string;issuersStopped:boolean;timeChecker:string;timeCheckerArgs?:string[];
    notificationSecretsDirectory?:string;
}
export interface RecoveryDatabase<Tx> extends TransactionBoundary<Tx> {
    migrate():Promise<void>;
    close():Promise<void>;
}
export interface RecoverySource {recoveryId:string}
export interface RecoveryWorkflowNative<Database,Source extends RecoverySource> {
    resolve(...parts:string[]):string;
    outsideProtectedDirectory(directory:string,authority:Pick<RecoveryAuthority,'keyPath'>):void;
    outsideNotificationDirectory(directory:string,protectedDirectory:string|undefined):Promise<void>;
    makeDirectory(directory:string):Promise<void>;
    openDatabase(url:string):Database;
    backupMetadata(db:Database):Promise<RecoveryBackupMetadata[]>;
    leaseBound(db:Database):Promise<RecoveryLeaseBound[]>;
    databaseBinding(db:Database):Promise<RecoveryDatabaseBinding[]>;
    createEmptyDump(path:string):Promise<void>;
    dump(options:Pick<BackupDatabaseOptions,'mysqldump'|'databaseUrl'>,path:string):Promise<void>;
    syncDump(path:string,directory:string):Promise<void>;
    fileSHA(path:string):Promise<string>;
    durableFile(path:string,content:string):Promise<void>;
    readManifest(path:string):Promise<BackupEnvelope>;
    newId():string;
    createdAt():string;
    pretty(value:unknown):string;
    validTargetDatabase(value:string):boolean;
    validTrustDigest(value:string):boolean;
    trustedTime(executable:string,args?:string[]):Promise<{now:number;maxSkewSeconds:number}>;
    sqlPath(options:Pick<RestoreDatabaseOptions,'manifest'>,sqlFile:string):string;
    beginRestore(options:Pick<RestoreDatabaseOptions,'sourceDatabaseUrl'|'targetDatabase'>):Promise<Source>;
    createRestoreTarget(source:Source,options:Pick<RestoreDatabaseOptions,'targetDatabase'>):Promise<string>;
    restoreDump(options:Pick<RestoreDatabaseOptions,'mysql'>,databaseUrl:string,path:string):Promise<void>;
    closeRestoreSource(source:Source):Promise<void>;
}
export interface RecoveryWorkflowOptions<Tx,Database extends RecoveryDatabase<Tx>,Source extends RecoverySource> {
    native:RecoveryWorkflowNative<Database,Source>;
    quarantine(db:Database,tx:Tx,context:RecoveryQuarantineContext):Promise<void>;
}
