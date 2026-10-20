import type * as F from '../src/framework/public.ts';
import type * as Path from '../src/modules/path-owner/public.ts';
import type * as Ingress from '../src/modules/ingress-owner/public.ts';
import type * as OldTemplate from '../src/modules/path-template-ports.ts';
import type * as OldMigration from '../src/modules/ingress-migration-ports.ts';
import type { ConsolePaging } from '../src/modules/console-query-owner/public.ts';

// Compile-time witnesses are intentionally independent complete shapes. They
// establish declaration compatibility only; SQL, hooks and atomicity are separate.
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Same<T extends true> = T;
type Flat<T> = {[K in keyof T]:T[K]};
type Optional<T> = {[K in keyof T]-?:{} extends Pick<T,K>?K:never}[keyof T];
type Mutable<T> = {[K in keyof T]-?:Equal<Pick<T,K>,{-readonly [P in keyof Pick<T,K>]:Pick<T,K>[P]}> extends true?K:never}[keyof T];
type Tx = {readonly publicationContractTransaction:unique symbol};
type ConfigA = {readonly family:'a';readonly nested:readonly number[]};
type ConfigB = {readonly family:'b';readonly nested:readonly string[]};
type Head = {templateId:string;currentRevision:number;archived:boolean};
type Revision<C> = {revision:number;config:C;profileDigest:string;configDigest:string;createdBy:string;createdAt:number};
type TemplateReader<C> = {
    head(tx:Tx,scope:string,id:string,lock?:boolean):Promise<Head|null>;
    revision(tx:Tx,scope:string,id:string,revision:number):Promise<Revision<C>|null>;
    list(tx:Tx,scope:string,paging:F.ReadPageWindow,prefix:string):Promise<{total:number;items:Head[]}>;
};
type TemplateWriter<C> = TemplateReader<C> & {
    lockScope(tx:Tx,scope:string):Promise<void>;count(tx:Tx,scope:string):Promise<number>;
    publish(tx:Tx,scope:string,id:string,record:Revision<C>):Promise<void>;
    archive(tx:Tx,scope:string,id:string):Promise<void>;
    audit(tx:Tx,scope:string,id:string,actor:string,revision:number,kind:'publish'|'archive',at:number):Promise<void>;
};
type TemplateConfig = {
    readonly version:1;readonly protocols:readonly ('tcp'|'udp')[];readonly nodes:readonly string[];
    readonly endpoints:readonly {readonly nodeId:string;readonly revision:number}[];
    readonly transport:{readonly profileId:string;readonly configRevision:number};
};
export type TemplateCompleteDeclarations55 = [
    Same<Equal<F.ReadPageWindow,{page:number;limit:number;offset:number}>>,Same<Equal<ConsolePaging,F.ReadPageWindow>>,
    Same<Equal<F.PathTemplateStoredHead,Head>>,Same<Equal<F.PathTemplateStoredRevision<ConfigA>,Revision<ConfigA>>>,
    Same<Equal<F.PathTemplateStoredRevision<ConfigB>,Revision<ConfigB>>>,
    Same<Equal<Flat<F.PathTemplateStorageReader<Tx,ConfigA>>,Flat<TemplateReader<ConfigA>>>>,
    Same<Equal<Flat<F.PathTemplateStorage<Tx,ConfigA>>,Flat<TemplateWriter<ConfigA>>>>,
    Same<Equal<Flat<F.PathTemplateStorage<Tx,ConfigB>>,Flat<TemplateWriter<ConfigB>>>>,
    Same<Equal<Path.PathTemplateConfig,TemplateConfig>>,Same<Equal<Mutable<Path.PathTemplateConfig>,never>>,
    Same<Equal<Mutable<Path.PathTemplateRevision>,keyof Revision<TemplateConfig>>>,
    Same<Equal<Optional<Path.PathTemplateRevision>,never>>,Same<Equal<Path.PathTemplateHead,Head>>,
    Same<Equal<Path.PathTemplateRevision,Revision<TemplateConfig>>>,
    Same<Equal<Flat<Path.PathTemplateReader<Tx>>,Flat<TemplateReader<TemplateConfig>>>>,
    Same<Equal<Flat<Path.PathTemplateWriter<Tx>>,Flat<TemplateWriter<TemplateConfig>>>>,
    Same<Equal<OldTemplate.PathTemplateConfig,Path.PathTemplateConfig>>,
    Same<Equal<OldTemplate.PathTemplateHead,Path.PathTemplateHead>>,
    Same<Equal<OldTemplate.PathTemplateRevision,Path.PathTemplateRevision>>,
    Same<Equal<OldTemplate.PathTemplateReader<Tx>,Path.PathTemplateReader<Tx>>>,
    Same<Equal<OldTemplate.PathTemplateWriter<Tx>,Path.PathTemplateWriter<Tx>>>,
];

type BatchHead = {batchId:string;revision:number;createdBy:string;createdAt:number;planDigest:string;cancelled:boolean;recoveryInvalidated:boolean};
type Operation = {operationId:string;forwardId:string;targetRevision:number;status:'accepted'|'running'|'succeeded'|'failed'|'superseded';cleanupPending:boolean;recoveryInvalidated:boolean};
type Attempt<O,K extends string> = {position:number;kind:K;actorId:string;createdAt:number;requestKey:string;requestDigest:string;outcome:O};
type RecordValue<P,O,K extends string> = {head:BatchHead;plan:P;attempts:Attempt<O,K>[]};
type Hooks<K extends string> = {
    count?:(tx:Tx,scope:string)=>Promise<number>;
    event?:(tx:Tx,scope:string,id:string,revision:number,kind:K,actor:string,at:number)=>Promise<void>;
};
type Store<P,O,E,K extends string> = {
    lockScope(tx:Tx,scope:string):Promise<void>;count(tx:Tx,scope:string):Promise<number>;
    list(tx:Tx,scope:string,paging:F.ReadPageWindow,groupId?:string):Promise<{total:number;items:BatchHead[]}>;
    read(tx:Tx,scope:string,id:string,lock?:boolean):Promise<RecordValue<P,O,K>|null>;
    create(tx:Tx,scope:string,head:BatchHead,plan:P):Promise<void>;
    append(tx:Tx,scope:string,id:string,expectedRevision:number,attempt:Attempt<O,K>):Promise<void>;
    cancel(tx:Tx,scope:string,id:string,expectedRevision:number,actor:string,at:number):Promise<void>;
    isolate<T>(tx:Tx,action:()=>Promise<T>):Promise<{accepted:true;value:T}|{accepted:false;error:E}>;
    operations(tx:Tx,scope:string,ids:string[]):Promise<Operation[]>;
};
type DeployA = {group:{groupId:string;revision:number};readonly customA:ConfigA};
type DeployB = {group:{groupId:string;revision:number};readonly customB:ConfigB};
type MigrateA = {sourceGroup:{groupId:string;revision:number};targetGroup:{groupId:string;revision:number};readonly customA:ConfigA};
type MigrateB = {sourceGroup:{groupId:string;revision:number};targetGroup:{groupId:string;revision:number};readonly customB:ConfigB};
type OutcomeA = {accepted:true;result:{readonly family:'a'}}|{accepted:false;error:{readonly code:'a'}};
type OutcomeB = {accepted:true;result:{readonly family:'b'}}|{accepted:false;error:{readonly code:'b'}};
type FailureA = {readonly code:'a'};
type FailureB = {readonly code:'b'};
export type DeploymentCompleteDeclarations60 = [
    Same<Equal<Path.PathPublicationFailure,{code:string;status:403|404|409|422|429}>>,
    Same<Equal<Ingress.IngressGroupSelection,{groupId:string;revision:number;configDigest:string}>>,
    Same<Equal<Ingress.IngressPlan,{schemaVersion:1;group:Ingress.IngressGroupSelection;items:Ingress.IngressPlanItem[]}>>,
    Same<Equal<Ingress.IngressPlanItem,{position:number;memberId:string;template:Path.PathSelection;spec:F.ForwardIntent;specDigest:string}>>,
    Same<Equal<F.PathPublicationStoredHead,BatchHead>>,Same<Equal<F.IngressDeploymentStoredHead,BatchHead>>,
    Same<Equal<F.PathPublicationStoredOperation,Operation>>,
    Same<Equal<F.IngressDeploymentStoredPlan,{group:{groupId:string;revision:number}}>>,
    Same<Equal<F.IngressDeploymentStoredAttempt,Attempt<unknown,'create'|'compensate'>>>,
    Same<Equal<F.IngressDeploymentStoredAttempt<OutcomeA>,Attempt<OutcomeA,'create'|'compensate'>>>,
    Same<Equal<F.IngressDeploymentStoredRecord<DeployA,OutcomeA>,RecordValue<DeployA,OutcomeA,'create'|'compensate'>>>,
    Same<Equal<F.IngressDeploymentStorageHooks<Tx>,Hooks<'create'|'compensate'|'cancel'>>>,
    Same<Equal<Optional<F.IngressDeploymentStorageHooks<Tx>>,'count'|'event'>>,
    Same<Equal<Mutable<F.IngressDeploymentStorageHooks<Tx>>,'count'|'event'>>,
    Same<Equal<F.IngressDeploymentStorage<Tx,DeployA,OutcomeA,FailureA>,Store<DeployA,OutcomeA,FailureA,'create'|'compensate'>>>,
    Same<Equal<F.IngressDeploymentStorage<Tx,DeployB,OutcomeB,FailureB>,Store<DeployB,OutcomeB,FailureB,'create'|'compensate'>>>,
    Same<Equal<Ingress.IngressDeploymentHead,BatchHead>>,
    Same<Equal<Ingress.IngressAttempt,Attempt<{accepted:true;result:Path.PublicationForwardResult|Ingress.IngressRemovalResult}|{accepted:false;error:Path.PathPublicationFailure},'create'|'compensate'>>>,
    Same<Equal<Ingress.IngressDeploymentRecord,RecordValue<Ingress.IngressPlan,Ingress.IngressAttempt['outcome'],'create'|'compensate'>>>,
    Same<Equal<Ingress.IngressDeploymentStore<Tx>,Store<Ingress.IngressPlan,Ingress.IngressAttempt['outcome'],Path.PathPublicationFailure,'create'|'compensate'>>>,
    Same<Equal<Mutable<Ingress.IngressDeploymentHead>,keyof BatchHead>>,
    Same<Equal<Optional<Ingress.IngressAttempt>,never>>,
    Same<Equal<Mutable<Ingress.IngressAttempt>,keyof Attempt<unknown,string>>>,
];
export type MigrationCompleteDeclarations61 = [
    Same<Equal<Ingress.IngressOriginRef,{kind:'deployment'|'migration';batchId:string;position:number;phase:'apply'|'compensate'}>>,
    Same<Equal<Ingress.IngressLineage,{ref:Ingress.IngressOriginRef;group:Ingress.IngressGroupSelection;memberId:string;template:Path.PathSelection;state:Path.PublicationForwardState}>>,
    Same<Equal<Ingress.IngressMigrationPlan,{schemaVersion:1;sourceGroup:Ingress.IngressGroupSelection;targetGroup:Ingress.IngressGroupSelection;sourceDefinition:Ingress.IngressGroupConfig;targetDefinition:Ingress.IngressGroupConfig;sources:Ingress.IngressLineage[];changes:Ingress.IngressDefinitionChange[];items:Ingress.IngressMigrationItem[]}>>,
    Same<Equal<Ingress.IngressMigrationItem,{position:number;kind:'add'|'update'|'remove';memberId:string;source:number|null;template:Path.PathSelection|null;spec:F.ForwardIntent|null;specDigest:string|null}>>,
    Same<Equal<Ingress.IngressDefinitionChange,{memberId:string;kind:'added'|'removed'|'unchanged'|'reference-changed'|'ingress-changed';sourceTemplate:Path.PathSelection|null;targetTemplate:Path.PathSelection|null;sourceIngress:string|null;targetIngress:string|null}>>,
    Same<Equal<F.IngressMigrationStoredPlan,{sourceGroup:{groupId:string;revision:number};targetGroup:{groupId:string;revision:number}}>>,
    Same<Equal<F.IngressMigrationStoredAttempt,Attempt<unknown,'apply'|'compensate'>>>,
    Same<Equal<F.IngressMigrationStoredAttempt<OutcomeB>,Attempt<OutcomeB,'apply'|'compensate'>>>,
    Same<Equal<F.IngressMigrationStoredRecord<MigrateB,OutcomeB>,RecordValue<MigrateB,OutcomeB,'apply'|'compensate'>>>,
    Same<Equal<F.IngressMigrationStorageHooks<Tx>,Hooks<'create'|'apply'|'compensate'|'cancel'>>>,
    Same<Equal<F.IngressMigrationStorage<Tx,MigrateA,OutcomeA,FailureA>,Store<MigrateA,OutcomeA,FailureA,'apply'|'compensate'>>>,
    Same<Equal<F.IngressMigrationStorage<Tx,MigrateB,OutcomeB,FailureB>,Store<MigrateB,OutcomeB,FailureB,'apply'|'compensate'>>>,
    Same<Equal<Ingress.IngressMigrationAttempt,Attempt<{accepted:true;result:Path.PublicationForwardResult|Ingress.IngressRemovalResult}|{accepted:false;error:Path.PathPublicationFailure},'apply'|'compensate'>>>,
    Same<Equal<Ingress.IngressMigrationRecord,RecordValue<Ingress.IngressMigrationPlan,Ingress.IngressMigrationAttempt['outcome'],'apply'|'compensate'>>>,
    Same<Equal<Ingress.IngressMigrationStore<Tx>,Store<Ingress.IngressMigrationPlan,Ingress.IngressMigrationAttempt['outcome'],Path.PathPublicationFailure,'apply'|'compensate'>>>,
    Same<Equal<OldMigration.IngressMigrationRecord,Ingress.IngressMigrationRecord>>,
    Same<Equal<OldMigration.IngressMigrationStore<Tx>,Ingress.IngressMigrationStore<Tx>>>,
    Same<Equal<Mutable<Ingress.IngressMigrationRecord>,'head'|'plan'|'attempts'>>,
    Same<Equal<Optional<Ingress.IngressMigrationRecord>,never>>,
];
