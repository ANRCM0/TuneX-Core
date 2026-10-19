import type { RequestIdentity } from '../../framework/public.ts';
import type { MemberChangeState } from './contracts.ts';
import type { NodeGrantState } from '../node-owner/public.ts';

export interface AccessExecutionResult {
    operationIds: string[];
    maximumAuthorization: number | null;
}

export interface AccessChangeEffects<Tx> {
    member(tx: Tx, request: RequestIdentity, member: MemberChangeState): Promise<AccessExecutionResult>;
    nodeGrant(tx: Tx, request: RequestIdentity, grant: NodeGrantState): Promise<AccessExecutionResult>;
}
