import type { RequestIdentity } from '../../framework/public.ts';
import type { NodeManagementChange } from './management-contracts.ts';
import type { AccessExecutionResult } from '../identity-owner/public.ts';

export interface NodeManagementEffects<Tx> {
    reconcile(tx: Tx, request: RequestIdentity, change: NodeManagementChange): Promise<AccessExecutionResult>;
}
