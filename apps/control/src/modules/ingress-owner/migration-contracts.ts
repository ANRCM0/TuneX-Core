import type { ForwardIntent as ForwardSpec } from '../../framework/public.ts';
import type { IngressMigrationStoredAttempt, IngressMigrationStoredRecord, IngressMigrationStorage } from '../../framework/public.ts';
import type { RequestIdentity } from '../../framework/public.ts';
import type { IngressDeploymentHead, IngressGroupConfig, IngressGroupSelection, IngressRemovalResult } from './contracts.ts';
import type { PathSelection, PathPublicationFailure, PublicationForwardResult, PublicationForwardState } from '../path-owner/public.ts';

export interface IngressOriginRef { kind: 'deployment' | 'migration'; batchId: string; position: number; phase: 'apply' | 'compensate' }
export interface IngressLineage { ref: IngressOriginRef; group: IngressGroupSelection; memberId: string; template: PathSelection; state: PublicationForwardState }
export type IngressMigrationAction =
    { kind: 'add'; memberId: string; enabled: boolean; target: ForwardSpec['target']; listen: ForwardSpec['ingress']['listen'] } |
    { kind: 'update'; memberId: string; source: number } | { kind: 'remove'; source: number };
export interface IngressMigrationInput {
    schemaVersion: 1; sourceGroup: IngressGroupSelection; targetGroup: IngressGroupSelection; sources: IngressOriginRef[]; items: IngressMigrationAction[];
}
export interface IngressDefinitionChange {
    memberId: string; kind: 'added' | 'removed' | 'unchanged' | 'reference-changed' | 'ingress-changed';
    sourceTemplate: PathSelection | null; targetTemplate: PathSelection | null; sourceIngress: string | null; targetIngress: string | null;
}
export interface IngressMigrationItem {
    position: number; kind: IngressMigrationAction['kind']; memberId: string; source: number | null;
    template: PathSelection | null; spec: ForwardSpec | null; specDigest: string | null;
}
export interface IngressMigrationPlan {
    schemaVersion: 1; sourceGroup: IngressGroupSelection; targetGroup: IngressGroupSelection;
    sourceDefinition: IngressGroupConfig; targetDefinition: IngressGroupConfig;
    sources: IngressLineage[]; changes: IngressDefinitionChange[]; items: IngressMigrationItem[];
}
export interface IngressMigrationAttempt extends IngressMigrationStoredAttempt {
    outcome: { accepted: true; result: PublicationForwardResult | IngressRemovalResult } | { accepted: false; error: PathPublicationFailure };
}
export interface IngressMigrationRecord extends IngressMigrationStoredRecord<IngressMigrationPlan,IngressMigrationAttempt['outcome']> { head: IngressDeploymentHead }
export interface IngressOrigins<Tx> { resolveIn(tx: Tx, actor: string, scope: string, ref: IngressOriginRef): Promise<IngressLineage> }
export interface IngressMigrationForwardPort<Tx> {
    inspectIngressIn(tx: Tx, actor: string, scope: string, expected: PublicationForwardState): Promise<PublicationForwardState>;
    previewIngressIn(tx: Tx, actor: string, scope: string, spec: ForwardSpec, template: PathSelection): Promise<{ spec: ForwardSpec; specDigest: string }>;
    previewIngressUpdateIn(tx: Tx, actor: string, scope: string, before: PublicationForwardState, desired: ForwardSpec, template: PathSelection): Promise<{ source: PublicationForwardState; spec: ForwardSpec; specDigest: string }>;
    createIngressIn(tx: Tx, request: RequestIdentity, spec: ForwardSpec, template: PathSelection): Promise<PublicationForwardResult>;
    updateIngressIn(tx: Tx, request: RequestIdentity, before: PublicationForwardState, desired: ForwardSpec, template: PathSelection): Promise<PublicationForwardResult>;
    removeIngressIn(tx: Tx, request: RequestIdentity, before: PublicationForwardState): Promise<IngressRemovalResult>;
    compensatePublicationIn(tx: Tx, request: RequestIdentity, accepted: PublicationForwardState, source: PublicationForwardState): Promise<PublicationForwardResult>;
}
export interface IngressMigrationStore<Tx> extends IngressMigrationStorage<Tx,IngressMigrationPlan,IngressMigrationAttempt['outcome'],PathPublicationFailure> {}
