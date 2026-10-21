import type { NodeGrantPortLimits } from './port-limits.ts';
import type { NodeUseRole } from '../../framework/public.ts';

export interface NodeGrantState {
    readonly nodeId: string;
    readonly actorId: string;
    readonly revision: number;
    readonly allowed: boolean;
    readonly changed: boolean;
    readonly allowedRoles:readonly NodeUseRole[]|null;
    readonly portLimits:NodeGrantPortLimits|null;
}

export interface NodeGrantWriter<Tx> {
    changeGrant(tx: Tx, owner: string, scopeId: string, nodeId: string, subject: string,
        expectedRevision: number, allowed: boolean,allowedRoles?:readonly NodeUseRole[]|null,portLimits?:NodeGrantPortLimits|null): Promise<NodeGrantState>;
}
