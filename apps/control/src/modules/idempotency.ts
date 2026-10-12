import { ControlError } from '../application/errors.ts';
import { json, rows, write } from '../infrastructure/mysql.ts';
import type { Transaction } from '../infrastructure/mysql.ts';
export interface Accepted {
    status: 200 | 202;
    body: {
        forwardId: string;
        revision: number;
        operationId: string | null;
        sourceOperationId?: string;
    };
}
export interface RequestIdentity {
    scopeId: string;
    actorId: string;
    key: string;
    digest: string;
}
export class Idempotency {
    async claim(tx: Transaction, request: RequestIdentity): Promise<Accepted | undefined> {
        const args = [request.scopeId, request.actorId, request.key];
        await write(tx, 'INSERT INTO idempotency(scope_id,actor_id,request_key,request_digest) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE request_key=request_key', [...args, request.digest]);
        const record = (await rows<{
            request_digest: string;
            http_status: number | null;
            response: unknown;
        }>(tx, 'SELECT * FROM idempotency WHERE scope_id=? AND actor_id=? AND request_key=? FOR UPDATE', args))[0]!;
        if (record.request_digest !== request.digest)
            throw new ControlError('IDEMPOTENCY_CONFLICT', 409, 'Idempotency key was used for another request');
        if (record.http_status !== null)
            return { status: record.http_status as Accepted['status'], body: json<Accepted['body']>(record.response) };
        return undefined;
    }
    async respond(tx: Transaction, request: RequestIdentity, response: Accepted): Promise<void> {
        await write(tx, 'UPDATE idempotency SET http_status=?,response=? WHERE scope_id=? AND actor_id=? AND request_key=?', [response.status, JSON.stringify(response.body), request.scopeId, request.actorId, request.key]);
    }
}
