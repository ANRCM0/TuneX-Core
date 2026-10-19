import type { BackupDatabaseOptions, RestoreDatabaseOptions, RecoveryAuthority } from '../recovery-owner/public.ts';
import type { NativeRecoveryAuthorityRecord } from '../../compatibility/public.ts';

export const OPERATOR_COMMAND_INTERFACE_VERSION=1 as const;

export interface OperatorAuthority extends RecoveryAuthority {
    maintain():Promise<NativeRecoveryAuthorityRecord>;
    resume(reviewId?:string):Promise<NativeRecoveryAuthorityRecord>;
}
export type OperatorBackupOptions<Authority extends OperatorAuthority>=Omit<BackupDatabaseOptions,'authority'>&{authority:Authority};
export type OperatorRestoreOptions<Authority extends OperatorAuthority>=Omit<RestoreDatabaseOptions,'authority'>&{authority:Authority};
export interface OperatorAssessmentOptions {planPath:string;databaseUrl:string;stateDirectory:string;caPath:string}
export interface OperatorCommandEffects<Authority extends OperatorAuthority,Certificate> {
    arguments():string[];
    env(name:string):string|undefined;
    createAuthority(directory:string):Authority;
    readCertificate(path:string):Promise<Certificate>;
    trustDigest(certificate:Certificate):string;
    resolve(path:string):string;
    parseClockArgs(value:string):string[];
    stringify(value:unknown,replacer?:null,space?:number):string|undefined;
    log(value:string|undefined):void;
    error(value:string):void;
    exitCode(value:number):void;
    backup(options:OperatorBackupOptions<Authority>):Promise<string>;
    restore(options:OperatorRestoreOptions<Authority>):Promise<{recoveryId:string;databaseUrl:string;ownerCredentials:string}>;
    assessUpgrade(options:OperatorAssessmentOptions):Promise<{decision:string}>;
}
export interface OperatorFailureEffects {error(value:string):void;exitCode(value:number):void}
export interface ReleaseEvidenceCommandEffects {
    argument(index:number):string|undefined;
    env(name:string):string|undefined;
    verify(path:string,revision:string):Promise<unknown>;
    stringify(value:unknown,replacer?:null,space?:number):string|undefined;
    log(value:string|undefined):void;
}
