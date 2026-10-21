import type { ForwardIntent, ForwardRuntimeStatus, RelayDeploymentStatus } from '../../framework/public.ts';

export const CONTROL_DETAIL_INTERFACE_VERSION=2 as const;

export interface ExecutionCapabilities {
    multihopEnabled:boolean;maxPathNodes:8;executionExtension:1;probeIssuanceEnabled:boolean;
    probeIngressIssuanceEnabled:boolean;probeServicesIssuanceEnabled:boolean;
}
export interface ForwardDetailView extends ForwardRuntimeStatus {
    desired:{revision:number;spec:ForwardIntent;deleting:boolean;recoverySuspended:boolean};
    lastOperation:{id:string;kind:string;status:string;recoveryInvalidated:boolean;cleanupPending:boolean}|null;
}
export interface OperationDetailView {
    id:string;forwardId:string;kind:string;requestedBy:string;sourceOperationId:string|null;status:string;
    recoveryInvalidated:boolean;targetRevision:number;cleanupPending:boolean;lastError:unknown;
}
/** Scoped detail/query DTOs, not executable handles or class-derived signatures. */
export interface ControlDetailApi {
    capabilities(actor:string,scope:string):Promise<ExecutionCapabilities>;
    deployment(actor:string,scope:string,id:string):Promise<{deployment:RelayDeploymentStatus|null}>;
    revisions(actor:string,scope:string,id:string):Promise<{revisions:{revision:number;spec:unknown}[]}>;
    forward(actor:string,scope:string,id:string):Promise<ForwardDetailView>;
    operation(actor:string,scope:string,id:string):Promise<OperationDetailView>;
}
