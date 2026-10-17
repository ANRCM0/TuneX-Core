import type { AssignmentDriverDeclaration, RelayAssignmentReader, SnapshotAssignmentContext, SnapshotAssignmentSource, SnapshotContribution } from './snapshot-assignment-ports.ts';

export class RelayAssignmentSource<Tx> implements SnapshotAssignmentSource<Tx> {
    readonly id = 'native-relay-plans';
    readonly drivers: readonly AssignmentDriverDeclaration[] = Object.freeze([
        Object.freeze({ id: 'native.relay.v1' as const, schemaVersion: 1 as const,
            roles: Object.freeze(['relay-ingress', 'relay-egress'] as const) }),
        Object.freeze({ id: 'native.multihop.v1' as const, schemaVersion: 1 as const,
            roles: Object.freeze(['multihop-ingress', 'multihop-transit', 'multihop-egress'] as const) }),
    ]);
    private readonly reader: RelayAssignmentReader<Tx>;

    constructor(reader: RelayAssignmentReader<Tx>) {
        if (!reader || typeof reader.assignments !== 'function') throw new Error('Relay assignment reader is required');
        this.reader = Object.freeze({ assignments: reader.assignments.bind(reader) });
        Object.freeze(this);
    }

    async collect(tx: Tx, context: SnapshotAssignmentContext): Promise<SnapshotContribution> {
        return { nodeId: context.nodeId, assignments: await this.reader.assignments(tx, context.nodeId, context.includeAccepted) };
    }
}
