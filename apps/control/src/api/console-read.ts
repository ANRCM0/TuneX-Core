import type { ControlApplication } from '../application/control.ts';
import { ControlError, invalid } from '../application/errors.ts';
import { json, rows } from '../infrastructure/mysql.ts';

/** Scope-scoped, strictly bounded read models. Never infer health from Agent presence. */
export function consolePage(pageText: string | undefined, limitText: string | undefined) {
    const numeric = (value: string | undefined, fallback: number, maximum: number) => {
        if (value === undefined) return fallback;
        if (!/^[1-9][0-9]*$/.test(value) || Number(value) > maximum) invalid('Invalid pagination parameter');
        return Number(value);
    };
    const page = numeric(pageText, 1, 10000);
    const limit = numeric(limitText, 25, 100);
    return { page, limit, offset: (page - 1) * limit };
}

export async function consoleNodes(control: ControlApplication, actor: string, scope: string, pageText?: string, limitText?: string) {
    const paging = consolePage(pageText, limitText);
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [count] = await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM nodes WHERE scope_id=?', [scope]);
        const records = await rows<{
            id: string; revoked: number; credential_until: number | null; facts: unknown;
            session_epoch: number | null; snapshot_generation: number | null; received_at: number | null;
        }>(tx, 'SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.scope_id=? ORDER BY n.id LIMIT ? OFFSET ?', [scope, paging.limit, paging.offset]);
        return {
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record => ({
                id: record.id, revoked: Boolean(record.revoked),
                credentialUntil: record.credential_until === null ? null : new Date(record.credential_until).toISOString(),
                policy: json(record.facts), sessionEpoch: record.session_epoch ?? 0,
                snapshotGeneration: record.snapshot_generation ?? 0,
                lastReportAt: record.received_at === null ? null : new Date(record.received_at).toISOString(),
            })),
        };
    });
}

export async function consoleForwards(control: ControlApplication, actor: string, scope: string, pageText?: string, limitText?: string) {
    const paging = consolePage(pageText, limitText);
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [count] = await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM forwards WHERE scope_id=? AND deleting=FALSE', [scope]);
        const records = await rows<{
            id: string; revision: number; spec: unknown; recovery_suspended: number;
            operation_id: string | null; operation_kind: string | null; operation_status: string | null;
        }>(tx, "SELECT f.id,f.revision,f.spec,f.recovery_suspended,o.id operation_id,o.kind operation_kind,o.status operation_status FROM forwards f LEFT JOIN operations o ON o.id=(SELECT recent.id FROM operations recent WHERE recent.forward_id=f.id ORDER BY recent.target_revision DESC,recent.created_at DESC,recent.id DESC LIMIT 1) WHERE f.scope_id=? AND f.deleting=FALSE ORDER BY f.id LIMIT ? OFFSET ?", [scope, paging.limit, paging.offset]);
        return {
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record => ({
                id: record.id, revision: record.revision, spec: json(record.spec),
                recoverySuspended: Boolean(record.recovery_suspended),
                lastOperation: record.operation_id === null ? null : { id: record.operation_id, kind: record.operation_kind, status: record.operation_status },
            })),
        };
    });
}

export async function consoleOperations(control: ControlApplication, actor: string, scope: string, pageText?: string, limitText?: string) {
    const paging = consolePage(pageText, limitText);
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [count] = await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM operations WHERE scope_id=?', [scope]);
        const records = await rows<{
            id: string; forward_id: string; kind: string; status: string; target_revision: number;
            created_at: number; updated_at: number; last_error: unknown; recovery_invalidated: number; cleanup_pending: number;
        }>(tx, 'SELECT id,forward_id,kind,status,target_revision,created_at,updated_at,last_error,recovery_invalidated,cleanup_pending FROM operations WHERE scope_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?', [scope, paging.limit, paging.offset]);
        return {
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record => ({
                id: record.id, forwardId: record.forward_id, kind: record.kind, status: record.status,
                targetRevision: record.target_revision,
                createdAt: new Date(record.created_at).toISOString(),
                updatedAt: new Date(record.updated_at).toISOString(),
                lastError: record.last_error === null ? null : json(record.last_error),
                recoveryInvalidated: Boolean(record.recovery_invalidated), cleanupPending: Boolean(record.cleanup_pending),
            })),
        };
    });
}

/** Read-only Node diagnosis: persisted machine facts, not a network or target probe. */
export async function consoleNodeDiagnostics(control: ControlApplication, actor: string, scope: string, nodeId: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(nodeId)) invalid('Invalid Node identifier');
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [record] = await rows<{
            id: string; revoked: number; credential_until: number | null;
            session_epoch: number | null; snapshot_generation: number | null;
            last_report_sequence: number | null; received_at: number | null;
            last_report: unknown; valid_until: number | null;
        }>(tx, 'SELECT n.id,n.revoked,n.credential_until,r.session_epoch,r.snapshot_generation,r.last_report_sequence,r.received_at,r.last_report,s.valid_until FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation WHERE n.id=? AND n.scope_id=?', [nodeId,scope]);
        if (!record) throw new ControlError('NOT_FOUND',404,'Node not found');
        const now=Date.now();
        const raw=record.last_report===null?null:json<unknown>(record.last_report);
        const observations=raw&&typeof raw==='object'&&'observations' in raw&&Array.isArray(raw.observations)?raw.observations:[];
        const failures=observations.flatMap((value: unknown)=>{
            if (!value||typeof value!=='object') return [];
            const o=value as Record<string,unknown>;
            if (o.errorCode===null||typeof o.errorCode!=='string'||o.errorCode.length>96) return [];
            return [{ assignmentId:typeof o.assignmentId==='string'?o.assignmentId:'unknown',
                condition:typeof o.condition==='string'?o.condition:'unknown',
                errorCode:o.errorCode,retryable:o.retryable===true }];
        }).slice(0,50);
        const age=record.received_at===null?null:Math.max(0,Math.floor((now-record.received_at)/1000));
        const until=record.valid_until===null?null:new Date(record.valid_until).toISOString();
        const credentialUntil=record.credential_until===null?null:new Date(record.credential_until).toISOString();
        return {
            nodeId:record.id,observedAt:new Date(now).toISOString(),source:'persisted-control-state',
            independentProbe:false,
            revoked:Boolean(record.revoked),credentialUntil,
            sessionEpoch:record.session_epoch??0,snapshotGeneration:record.snapshot_generation??0,
            lastReportSequence:record.last_report_sequence??0,
            lastReportAt:record.received_at===null?null:new Date(record.received_at).toISOString(),
            reportAgeSeconds:age,reportStatus:age===null?'missing':'age-only',
            snapshotLeaseUntil:until,
            snapshotLeaseRemainingSeconds:record.valid_until===null?null:Math.floor((record.valid_until-now)/1000),
            totalReportedObservations:observations.length,errors:failures,
            note:'Control 仅提供历史状态和时间事实；报告年龄、有效证书或未到期快照均不能单独证明链路可达。'
        };
    });
}
