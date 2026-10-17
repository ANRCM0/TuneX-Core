import type { RuntimeAssignment } from '@tunex/contracts';

export interface SnapshotAssignmentContext {
    readonly nodeId: string;
    readonly includeAccepted: boolean;
}

export interface SnapshotContribution {
    readonly nodeId: string;
    readonly assignments: readonly RuntimeAssignment[];
}

export interface AssignmentDriverDeclaration {
    readonly id: 'native.relay.v1' | 'native.multihop.v1';
    readonly schemaVersion: 1;
    readonly roles: readonly Exclude<RuntimeAssignment['role'], 'direct'>[];
}

export interface SnapshotAssignmentSource<Tx> {
    readonly id: string;
    readonly drivers: readonly AssignmentDriverDeclaration[];
    collect(tx: Tx, context: SnapshotAssignmentContext): Promise<SnapshotContribution>;
}

export interface SnapshotAssignmentCollector<Tx> {
    merge(tx: Tx, context: SnapshotAssignmentContext, direct: readonly RuntimeAssignment[]): Promise<RuntimeAssignment[]>;
}

export interface RelayAssignmentReader<Tx> {
    assignments(tx: Tx, nodeId: string, includeAccepted: boolean): Promise<RuntimeAssignment[]>;
}
