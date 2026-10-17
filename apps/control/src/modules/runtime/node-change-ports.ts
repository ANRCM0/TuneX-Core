import type { RequestIdentity } from '../../application/ports.ts';
import type { NodeManagementChange } from '../node-management-ports.ts';
import type { AccessExecutionResult } from './access-ports.ts';

export interface NodeManagementEffects<Tx> {
    reconcile(tx: Tx, request: RequestIdentity, change: NodeManagementChange): Promise<AccessExecutionResult>;
}
