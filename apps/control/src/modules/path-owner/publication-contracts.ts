import type { ForwardIntent as ForwardSpec } from '../../framework/public.ts';
import type { RequestIdentity } from '../../framework/public.ts';
import type { PathPublicationStoredHead, PathPublicationStoredAttempt, PathPublicationStoredRecord, PathPublicationStoredOperation,
    PathPublicationStorage } from '../../framework/public.ts';
import type { PathBindingReceipt, PathSelection } from './binding-contracts.ts';
import type { PathGroupSelection } from './group-contracts.ts';
import type { PathGroupBindingReceipt } from './group-contracts.ts';

export interface PublicationForwardState {
    forwardId: string; revision: number; spec: ForwardSpec; specDigest: string;
    path: Omit<PathBindingReceipt, 'changed'> | null;
    group: Omit<PathGroupBindingReceipt, 'changed'> | null;
}
export interface PublicationForwardReceipt {
    status: 200 | 202;
    body: { forwardId: string; revision: number; operationId: string | null; pathBinding?: PathBindingReceipt; pathGroupBinding?: PathGroupBindingReceipt };
}
export interface PublicationForwardResult { accepted: PublicationForwardReceipt; state: PublicationForwardState }
export interface PublicationPlanItem {
    position: number; source: PublicationForwardState; template: PathSelection; proposedSpec: ForwardSpec; proposedDigest: string;
}
export interface PathPublicationPlan { schemaVersion: 1; group: PathGroupSelection; items: PublicationPlanItem[] }
export interface PathPublicationInput { schemaVersion: 1; group: PathGroupSelection; items: { forwardId: string; expectedRevision: number }[] }
export interface PathPublicationForwardPort<Tx> {
    previewPublicationIn(tx: Tx, actor: string, scope: string, forwardId: string, expectedRevision: number, group: PathGroupSelection): Promise<Omit<PublicationPlanItem, 'position'>>;
    applyPublicationIn(tx: Tx, request: RequestIdentity, source: PublicationForwardState, group: PathGroupSelection): Promise<PublicationForwardResult>;
    compensatePublicationIn(tx: Tx, request: RequestIdentity, accepted: PublicationForwardState, source: PublicationForwardState): Promise<PublicationForwardResult>;
}
export interface PublicationProvenance<Tx> {
    current(tx: Tx, forward: { id: string; scopeId: string; revision: number; spec: ForwardSpec }): Promise<Pick<PublicationForwardState, 'path' | 'group'>>;
    detachPath(tx: Tx, forward: { id: string; scopeId: string; revision: number; spec: ForwardSpec }): Promise<void>;
    authorizeRestoration(tx: Tx, actor: string, forward: { id: string; scopeId: string; revision: number; spec: ForwardSpec }): Promise<void>;
}
export interface PathPublicationHead extends PathPublicationStoredHead {}
export interface PathPublicationFailure { code: string; status: 403 | 404 | 409 | 422 | 429 }
export interface PathPublicationAttempt extends PathPublicationStoredAttempt {
    outcome: { accepted: true; result: PublicationForwardResult } | { accepted: false; error: PathPublicationFailure };
}
export interface PathPublicationRecord extends PathPublicationStoredRecord<PathPublicationPlan,PathPublicationAttempt['outcome']> {}
export interface PublicationOperation extends PathPublicationStoredOperation {
    status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'superseded';
}
export interface PathPublicationStore<Tx> extends PathPublicationStorage<Tx,PathPublicationPlan,PathPublicationAttempt['outcome'],PathPublicationFailure> {}
