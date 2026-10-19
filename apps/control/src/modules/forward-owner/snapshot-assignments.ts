import { deepFreeze, isId } from '@tunex/core';
import type { RuntimeAssignment } from '../../compatibility/public.ts';
import { NATIVE_DRIVER_CATALOG, nativeCloneSnapshotAssignments } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { SnapshotAssignmentContext } from '../../framework/public.ts';
import type { NativeSnapshotAssignmentCollector as SnapshotAssignmentCollector, NativeSnapshotAssignmentSource as SnapshotAssignmentSource,
    NativeSnapshotContribution as SnapshotContribution } from '../../compatibility/public.ts';

const nativeRoles:Readonly<Record<string,readonly string[]>>=Object.freeze(Object.fromEntries(
    NATIVE_DRIVER_CATALOG.drivers.filter(driver=>driver.id!=='native.direct.v1').map(driver=>[driver.id,driver.roles])));

interface RegisteredSource<Tx> {
    readonly id: string;
    readonly bindings: readonly string[];
    readonly collect: (tx: Tx, context: SnapshotAssignmentContext) => Promise<SnapshotContribution>;
}

/** Static, trusted in-process sources; this is not a sandbox or an authorization issuer. */
export class SnapshotAssignmentRegistry<Tx> implements SnapshotAssignmentCollector<Tx> {
    private readonly sources: readonly RegisteredSource<Tx>[];

    constructor(sources: readonly SnapshotAssignmentSource<Tx>[]) {
        if (!Array.isArray(sources)) throw new Error('Snapshot assignment sources are required');
        const ids = new Set<string>(), owned = new Set<string>();
        this.sources = Object.freeze(Array.from(sources).map(source => {
            if (!source || !isId(source.id) || typeof source.collect !== 'function' ||
                !Array.isArray(source.drivers) || !source.drivers.length)
                throw new Error('Invalid Snapshot assignment source declaration');
            if (ids.has(source.id)) throw new Error('Duplicate Snapshot assignment source ID');
            ids.add(source.id);
            const drivers = new Set<string>(), bindings: string[] = [];
            for (const driver of source.drivers) {
                const roles = driver && Object.hasOwn(nativeRoles, driver.id) ? nativeRoles[driver.id] : undefined;
                if (!roles || driver.schemaVersion !== 1 || !Array.isArray(driver.roles) || !driver.roles.length)
                    throw new Error('Unsupported Snapshot assignment driver declaration');
                if (drivers.has(driver.id)) throw new Error('Duplicate Snapshot assignment driver declaration');
                drivers.add(driver.id);
                for (const role of driver.roles) {
                    if (!roles.includes(role)) throw new Error('Unsupported Snapshot assignment role declaration');
                    const binding = `${driver.id}/${driver.schemaVersion}/${role}`;
                    if (owned.has(binding)) throw new Error('Duplicate Snapshot assignment driver/role ownership');
                    owned.add(binding); bindings.push(binding);
                }
            }
            return Object.freeze({ id: source.id, bindings: Object.freeze(bindings), collect: source.collect.bind(source) });
        }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        Object.freeze(this);
    }

    async merge(tx: Tx, input: SnapshotAssignmentContext, direct: readonly RuntimeAssignment[]): Promise<RuntimeAssignment[]> {
        if (!input || !isId(input.nodeId) || typeof input.includeAccepted !== 'boolean')
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Valid Snapshot assignment context required');
        const context = Object.freeze({ nodeId: input.nodeId, includeAccepted: input.includeAccepted });
        const result: RuntimeAssignment[] = [], ids = new Set<string>(), logical = new Set<string>(), physical = new Set<string>();
        const append = (assignment: RuntimeAssignment, bindings?: readonly string[]) => {
            if (!assignment || !isId(assignment.assignmentId) || !isId(assignment.forwardId) || !assignment.driver || !assignment.resource ||
                (bindings ? !bindings.includes(`${assignment.driver.id}/${assignment.driver.schemaVersion}/${assignment.role}`) :
                    assignment.role !== 'direct' || assignment.driver.id !== 'native.direct.v1' || assignment.driver.schemaVersion !== 1))
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Assignment differs from its registered source ownership');
            const logicalKey = `${assignment.forwardId}/${assignment.protocol}/${assignment.role}`;
            const slot = `${assignment.resource.protocol}/${assignment.resource.port}`;
            if (ids.has(assignment.assignmentId) || logical.has(logicalKey) || physical.has(slot))
                throw new ControlError('RESOURCE_CONFLICT', 409, 'Duplicate Snapshot assignment or physical resource');
            ids.add(assignment.assignmentId); logical.add(logicalKey); physical.add(slot); result.push(assignment);
        };
        // Detach each result before awaiting another source; never mutate owner-owned plans.
        for (const assignment of nativeCloneSnapshotAssignments(direct)) append(deepFreeze(assignment));
        for (const source of this.sources) {
            const contribution = await source.collect(tx, context);
            if (!contribution || contribution.nodeId !== context.nodeId || !Array.isArray(contribution.assignments))
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Snapshot contribution belongs to another Node or has invalid shape');
            for (const assignment of nativeCloneSnapshotAssignments(contribution.assignments)) append(deepFreeze(assignment), source.bindings);
        }
        // Complete ADP/schema, config, session and fence validation remains in the Snapshot compiler.
        return result.sort((a, b) => a.assignmentId < b.assignmentId ? -1 : a.assignmentId > b.assignmentId ? 1 : 0);
    }
}
