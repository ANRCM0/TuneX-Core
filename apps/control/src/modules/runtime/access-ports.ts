import type { RequestIdentity } from '../../application/ports.ts';
import type { MemberChangeState } from '../identity-ports.ts';
import type { NodeGrantState } from '../node-grant-ports.ts';

export interface AccessExecutionResult {
    operationIds: string[];
    maximumAuthorization: number | null;
}

export interface AccessChangeEffects<Tx> {
    member(tx: Tx, request: RequestIdentity, member: MemberChangeState): Promise<AccessExecutionResult>;
    nodeGrant(tx: Tx, request: RequestIdentity, grant: NodeGrantState): Promise<AccessExecutionResult>;
}
