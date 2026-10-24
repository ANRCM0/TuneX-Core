import type { RuntimeValueFamily, RuntimeAssignmentFor } from '@tunex/contracts/execution-values';

export interface SnapshotAssignmentContext {
    readonly nodeId:string;
    readonly includeAccepted:boolean;
}
export interface SnapshotContribution<F extends RuntimeValueFamily=RuntimeValueFamily> {
    readonly nodeId:string;
    readonly assignments:readonly RuntimeAssignmentFor<F>[];
}
export type AssignmentDriverDeclaration<F extends RuntimeValueFamily=RuntimeValueFamily>=F['sourceDriver'];
export interface SnapshotAssignmentSource<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    readonly id:string;
    readonly drivers:readonly AssignmentDriverDeclaration<F>[];
    collect(tx:Tx,context:SnapshotAssignmentContext):Promise<SnapshotContribution<F>>;
}
export interface SnapshotAssignmentCollector<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    merge(tx:Tx,context:SnapshotAssignmentContext,direct:readonly RuntimeAssignmentFor<F>[]):Promise<RuntimeAssignmentFor<F>[]>;
}
export interface RelayAssignmentReader<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    assignments(tx:Tx,nodeId:string,includeAccepted:boolean):Promise<RuntimeAssignmentFor<F>[]>;
}

export const RELAY_FORWARD_ASSIGNMENTS_INTERFACE_VERSION=1 as const;
export interface RelayForwardAssignmentReader<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    assignmentsForForward(tx:Tx,forwardId:string):Promise<readonly SnapshotContribution<F>[]>;
}

export const RELAY_NODE_ASSIGNMENTS_INTERFACE_VERSION=1 as const;
export interface RelayNodeAssignmentReader<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    assignmentsForNode(tx:Tx,nodeId:string,includeAccepted?:boolean):Promise<RuntimeAssignmentFor<F>[]>;
}
