import type { NodeManagementCommand } from './management-contracts.ts';

export const NODE_MANAGEMENT_INTERFACE_VERSION=1 as const;

export interface NodeChangeResponse {
    status:202;
    body:{nodeId:string;policyRevision:number;operationIds:string[];latestAuthorizationUntil:string|null};
}
export interface NodeManagementApi {
    change(actorId:string,scopeId:string,nodeId:string,key:string|undefined,input:NodeManagementCommand):Promise<NodeChangeResponse>;
}
