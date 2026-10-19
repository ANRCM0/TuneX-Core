import { ControlError, invalid } from '../../framework/public.ts';
import type { ManagementReadStore, ReadProjectionValues, ReadNodeRow } from '../../framework/public.ts';
import type {
    ConsoleCandidates, ConsoleDiagnostics, ConsoleForward, ConsoleNode, ConsoleOperation,
    ConsoleOverview, ConsolePage, ConsoleReadPort, ConsoleFilters, ConsolePaging,
} from './contracts.ts';
/** Product projections only; stores own SQL and invoke each projection synchronously. */
export class ConsoleReadModels<Tx> implements ConsoleReadPort<Tx> {
    private readonly store:ManagementReadStore<Tx>;
    private readonly values:ReadProjectionValues;
    constructor(store:ManagementReadStore<Tx>,values:ReadProjectionValues) {this.store=store;this.values=values;}
    private nodeItem(record:ReadNodeRow):ConsoleNode {
        return {
            id: record.id, revoked: Boolean(record.revoked),
            credentialUntil: record.credential_until === null ? null : this.values.iso(record.credential_until),
            policy: this.values.read<unknown>(record.facts), sessionEpoch: record.session_epoch ?? 0,
            snapshotGeneration: record.snapshot_generation ?? 0,
            lastReportAt: record.received_at === null ? null : this.values.iso(record.received_at),
        };
    }
    async nodes(tx:Tx,scope:string,paging:ConsolePaging,filters:ConsoleFilters):Promise<ConsolePage<ConsoleNode>> {
        return this.store.nodes<ConsolePage<ConsoleNode>>(tx,scope,paging,filters,({count,records})=>({
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record=>this.nodeItem(record)),
        }));
    }
    async forwards(tx:Tx,scope:string,paging:ConsolePaging,filters:ConsoleFilters):Promise<ConsolePage<ConsoleForward>> {
        return this.store.forwards<ConsolePage<ConsoleForward>>(tx,scope,paging,filters,({count,records})=>({
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record => ({
                id: record.id, revision: record.revision, spec: this.values.read<unknown>(record.spec),
                recoverySuspended: Boolean(record.recovery_suspended),
                lastOperation: record.operation_id === null ? null : { id: record.operation_id, kind: record.operation_kind, status: record.operation_status },
            })),
        }));
    }
    async operations(tx:Tx,scope:string,paging:ConsolePaging,filters:ConsoleFilters):Promise<ConsolePage<ConsoleOperation>> {
        return this.store.operations<ConsolePage<ConsoleOperation>>(tx,scope,paging,filters,({count,records})=>({
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record => ({
                id: record.id, forwardId: record.forward_id, kind: record.kind, status: record.status,
                targetRevision: record.target_revision,
                createdAt: this.values.iso(record.created_at),
                updatedAt: this.values.iso(record.updated_at),
                lastError: record.last_error === null ? null : this.values.read<unknown>(record.last_error),
                recoveryInvalidated: Boolean(record.recovery_invalidated), cleanupPending: Boolean(record.cleanup_pending),
            })),
        }));
    }
    async candidates(tx:Tx,actor:string,scope:string,paging:ConsolePaging,filters:ConsoleFilters):Promise<ConsoleCandidates> {
        const mode = filters.mode ?? 'direct';
        const caps = ['adp.3', 'native.direct.v1'];
        if (mode !== 'direct')
            caps.push('native.relay.v1', 'relay.wire.1');
        if (mode === 'multihop')
            caps.push('adp.execution.1', 'native.multihop.v1', 'multihop.wire.1');
        if (filters.protocol)
            caps.push(...(filters.protocol === 'both' ? ['tcp', 'udp'] : [filters.protocol]));
        return this.store.candidates<ConsoleCandidates>(tx,actor,scope,paging,filters,caps,({count,records})=>({
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0), mode,
            items: records.map(record=>this.nodeItem(record)), source: 'persisted-control-state', independentProbe: false,
            fullPlanAuthorization: false, reserved: false,
        }));
    }
    async overview(tx:Tx,scope:string):Promise<ConsoleOverview> {
        return this.store.overview<ConsoleOverview>(tx,scope,record=>({
            nodes: Number(record?.nodes ?? 0), forwards: Number(record?.forwards ?? 0),
            activeOperations: Number(record?.active ?? 0), failedOperations: Number(record?.failed ?? 0),
            observedAt: this.values.currentIso(), source: 'persisted-control-state', independentProbe: false,
        }));
    }
    async diagnostics(tx:Tx,scope:string,nodeId:string):Promise<ConsoleDiagnostics> {
        if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(nodeId))
            invalid('Invalid Node identifier');
        return this.store.diagnostics<ConsoleDiagnostics>(tx,scope,nodeId,record=>{
            if (!record)
                throw new ControlError('NOT_FOUND', 404, 'Node not found');
            const now = this.values.now();
            const raw = record.last_report === null ? null : this.values.read<unknown>(record.last_report);
            const observations = raw && typeof raw === 'object' && 'observations' in raw && Array.isArray(raw.observations) ? raw.observations : [];
            const failures = observations.flatMap((value: unknown) => {
                if (!value || typeof value !== 'object')
                    return [];
                const o = value as Record<string, unknown>;
                if (typeof o.errorCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(o.errorCode))
                    return [];
                return [{ assignmentId: typeof o.assignmentId === 'string' ? o.assignmentId : 'unknown',
                        condition: typeof o.condition === 'string' ? o.condition : 'unknown',
                        errorCode: o.errorCode, retryable: o.retryable === true }];
            }).slice(0, 50);
            const age = record.received_at === null ? null : Math.max(0, Math.floor((now - record.received_at) / 1000));
            const until = record.valid_until === null ? null : this.values.iso(record.valid_until);
            const credentialUntil = record.credential_until === null ? null : this.values.iso(record.credential_until);
            return {
                nodeId: record.id, observedAt: this.values.iso(now), source: 'persisted-control-state',
                independentProbe: false,
                revoked: Boolean(record.revoked), credentialUntil,
                sessionEpoch: record.session_epoch ?? 0, snapshotGeneration: record.snapshot_generation ?? 0,
                lastReportSequence: record.last_report_sequence ?? 0,
                lastReportAt: record.received_at === null ? null : this.values.iso(record.received_at),
                reportAgeSeconds: age, reportStatus: age === null ? 'missing' : 'age-only',
                snapshotLeaseUntil: until,
                snapshotLeaseRemainingSeconds: record.valid_until === null ? null : Math.floor((record.valid_until - now) / 1000),
                totalReportedObservations: observations.length, errors: failures,
                note: 'Control 仅提供历史状态和时间事实；报告年龄、有效证书或未到期快照均不能单独证明链路可达。',
            };
        });
    }
}
