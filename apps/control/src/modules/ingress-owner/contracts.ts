import type { ForwardIntent as ForwardSpec } from '../../framework/public.ts';
import type { RequestIdentity } from '../../framework/public.ts';
import type { IngressGroupStoredHead, IngressGroupStoredRevision, IngressGroupStorage } from '../../framework/public.ts';
import type { IngressDeploymentStoredHead, IngressDeploymentStoredAttempt, IngressDeploymentStoredRecord, IngressDeploymentStorage } from '../../framework/public.ts';
import type { PathSelection } from '../path-owner/public.ts';
import type { PathTemplateConfig } from '../path-owner/public.ts';
import type { PathPublicationFailure, PublicationForwardResult, PublicationForwardState } from '../path-owner/public.ts';

export interface IngressGroupConfig { schemaVersion: 1; members: { memberId: string; template: PathSelection }[] }
export interface IngressGroupSelection { groupId: string; revision: number; configDigest: string }
export interface IngressGroupHead extends IngressGroupStoredHead {}
export interface IngressGroupRevision extends IngressGroupStoredRevision<IngressGroupConfig> {}
export interface IngressGroupMember { memberId: string; template: PathSelection; config: PathTemplateConfig }
export interface IngressGroupResolver<Tx> {
    describeIn(tx:Tx,actor:string,scope:string,input:IngressGroupSelection,active?:boolean):Promise<{config:IngressGroupConfig;members:IngressGroupMember[]}>;
    resolveIn(tx:Tx,actor:string,scope:string,input:IngressGroupSelection,memberIds:string[]):Promise<IngressGroupMember[]>;
}
export interface IngressGroupStore<Tx> extends IngressGroupStorage<Tx,IngressGroupConfig> {}
export interface IngressDeploymentInput {
    schemaVersion: 1; group: IngressGroupSelection; enabled: boolean; target: ForwardSpec['target'];
    items: { memberId: string; listen: ForwardSpec['ingress']['listen'] }[];
}
export interface IngressPlanItem { position: number; memberId: string; template: PathSelection; spec: ForwardSpec; specDigest: string }
export interface IngressPlan { schemaVersion: 1; group: IngressGroupSelection; items: IngressPlanItem[] }
export interface IngressRemovalResult extends PublicationForwardResult { deleting: true }
export interface IngressForwardPort<Tx> {
    previewIngressIn(tx: Tx, actor: string, scope: string, spec: ForwardSpec, template: PathSelection): Promise<{ spec: ForwardSpec; specDigest: string }>;
    createIngressIn(tx: Tx, request: RequestIdentity, spec: ForwardSpec, template: PathSelection): Promise<PublicationForwardResult>;
    compensateIngressIn(tx: Tx, request: RequestIdentity, accepted: PublicationForwardState): Promise<IngressRemovalResult>;
}
export interface IngressDeploymentHead extends IngressDeploymentStoredHead {}
export interface IngressAttempt extends IngressDeploymentStoredAttempt {
    outcome: { accepted: true; result: PublicationForwardResult | IngressRemovalResult } | { accepted: false; error: PathPublicationFailure };
}
export interface IngressDeploymentRecord extends IngressDeploymentStoredRecord<IngressPlan,IngressAttempt['outcome']> {}
export interface IngressDeploymentStore<Tx> extends IngressDeploymentStorage<Tx,IngressPlan,IngressAttempt['outcome'],PathPublicationFailure> {}
