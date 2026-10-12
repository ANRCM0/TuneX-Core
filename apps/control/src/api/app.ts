import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import { TLSSocket } from 'node:tls';
import { randomUUID } from 'node:crypto';
import { parseJson, parseMessage } from '@tunex/contracts';
import { isId, isCounter } from '@tunex/core';
import { ControlError, invalid } from '../application/errors.ts';
import type { ControlApplication } from '../application/control.ts';
import type { NodePolicy } from '../modules/nodes.ts';
import type { RuntimeController } from '../modules/runtime/controller.ts';
export function createApp(control: ControlApplication, runtime: RuntimeController): Hono<{
    Bindings: HttpBindings;
    Variables: {
        actor: string;
        node: string;
        requestId: string;
    };
}> {
    const app = new Hono<{
        Bindings: HttpBindings;
        Variables: {
            actor: string;
            node: string;
            requestId: string;
        };
    }>();
    app.use('*', async (c, next) => { c.set('requestId', randomUUID()); c.header('Cache-Control', 'no-store'); await next(); });
    app.onError((error, c) => {
        const code = error.message.split(':')[0]!;
        const statuses: Record<string, ControlError['status']> = { INVALID_CONFIG: 422, RESOURCE_LIMIT: 429, INTEGRITY_FAILURE: 409, AUTHORIZATION_DENIED: 403, UNSUPPORTED_CAPABILITY: 409, RESOURCE_CONFLICT: 409, FENCING_REJECTED: 409, LEASE_EXPIRED: 409 };
        const known = error instanceof ControlError ? error : error instanceof SyntaxError || error instanceof TypeError ? new ControlError('INVALID_CONFIG', 400, 'Malformed JSON request') : statuses[code] ? new ControlError(code, statuses[code], 'Request violates Node or deployment policy') : new ControlError('INTERNAL_ERROR', 503, 'Control request failed', true);
        return c.json({ code: known.code, message: known.message, retryable: known.retryable, requestId: c.get('requestId') }, known.status);
    });
    app.notFound(c => c.json({ code: 'NOT_FOUND', message: 'Resource not found', retryable: false, requestId: c.get('requestId') }, 404));
    app.use('/api/v1/*', async (c, next) => {
        if (c.req.header('cookie'))
            throw new ControlError('UNAUTHENTICATED', 401, 'Bearer authentication required');
        c.set('actor', await control.identity.authenticate(c.req.header('authorization')));
        await next();
    });
    app.use('/agent/v2/*', async (c, next) => {
        const socket = c.env?.incoming?.socket;
        if (!(socket instanceof TLSSocket) || !socket.authorized)
            throw new ControlError('UNAUTHENTICATED', 401, 'Verified Node client certificate required');
        const certificate = socket.getPeerCertificate();
        if (!certificate.fingerprint256)
            throw new ControlError('UNAUTHENTICATED', 401, 'Node certificate required');
        c.set('node', await control.nodes.machine(certificate.fingerprint256.replaceAll(':', '').toLowerCase()));
        await next();
    });
    async function body(request: Request, limit = 1048576): Promise<string> {
        const reader = request.body?.getReader();
        if (!reader)
            invalid('Request body required');
        let length = 0;
        const chunks: Uint8Array[] = [];
        try {
            for (;;) {
                const next = await reader.read();
                if (next.done)
                    break;
                length += next.value.byteLength;
                if (length > limit)
                    throw new ControlError('RESOURCE_LIMIT', 413, 'Request body too large');
                chunks.push(next.value);
            }
        }
        finally {
            reader.releaseLock();
        }
        return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    }
    function scope(value: string): string { if (!isId(value))
        invalid('Invalid scope ID'); return value; }
    function epoch(value: string | undefined): number { if (!value || !/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value)))
        throw new ControlError('SESSION_SUPERSEDED', 409, 'Valid session header required'); return Number(value); }
    app.get('/health', c => c.json({ status: 'ok', protocolVersion: 2 }));
    app.post('/api/v1/scopes/:scope/nodes', async (c) => c.json(await control.nodes.provision(c.get('actor'), scope(c.req.param('scope')), parseJson(await body(c.req.raw)) as NodePolicy), 201));
    app.post('/enrollment/v1', async (c) => {
        const input = parseJson(await body(c.req.raw, 32768)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Object.keys(input).sort().join(',') !== 'csr,nodeId,token')
            invalid('Invalid enrollment fields');
        return c.json(await control.nodes.enroll(input.nodeId as string, input.token as string, input.csr as string));
    });
    app.post('/api/v1/scopes/:scope/forwards', async (c) => { const result = await control.create(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'), parseJson(await body(c.req.raw))); return c.json(result.body, result.status); });
    app.put('/api/v1/scopes/:scope/forwards/:id', async (c) => { const input = parseJson(await body(c.req.raw)) as Record<string, unknown>; if (!input || typeof input !== 'object' || Object.keys(input).sort().join(',') !== 'expectedRevision,spec' || typeof input.expectedRevision !== 'number')
        invalid('expectedRevision and spec required'); const result = await control.update(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'), c.req.header('idempotency-key'), input.expectedRevision, input.spec); return c.json(result.body, result.status); });
    app.delete('/api/v1/scopes/:scope/forwards/:id', async (c) => { const input = parseJson(await body(c.req.raw)) as Record<string, unknown>; if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'expectedRevision' || typeof input.expectedRevision !== 'number')
        invalid('expectedRevision required'); const result = await control.remove(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'), c.req.header('idempotency-key'), input.expectedRevision); return c.json(result.body, result.status); });
    app.get('/api/v1/scopes/:scope/forwards/:id', async (c) => c.json(await control.db.transaction(async (tx) => {
        const scopeId = scope(c.req.param('scope'));
        await control.identity.scope(tx, c.get('actor'), scopeId);
        const forward = await control.forwarding.get(tx, scopeId, c.req.param('id'));
        const state = await runtime.status(tx, forward);
        const operation = await control.ledger.latest(tx, forward.id);
        return { desired: { revision: forward.revision, spec: forward.spec, deleting: false }, ...state, lastOperation: operation ? { id: operation.id, status: operation.status, cleanupPending: Boolean(operation.cleanup_pending) } : null };
    })));
    app.get('/api/v1/scopes/:scope/operations/:id', async (c) => c.json(await control.db.transaction(async (tx) => {
        const scopeId = scope(c.req.param('scope'));
        await control.identity.scope(tx, c.get('actor'), scopeId);
        const op = await control.ledger.get(tx, scopeId, c.req.param('id'));
        return { id: op.id, status: op.status, targetRevision: op.target_revision, cleanupPending: Boolean(op.cleanup_pending), lastError: op.last_error };
    })));
    app.post('/api/v1/scopes/:scope/operations/:id/retry', async (c) => { const input = parseJson(await body(c.req.raw)) as Record<string, unknown>; if (!input || typeof input !== 'object' || typeof input.expectedRevision !== 'number')
        invalid('expectedRevision required'); const result = await control.retry(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'), c.req.param('id'), input.expectedRevision); return c.json(result.body, result.status); });
    app.post('/agent/v2/hello', async (c) => c.json(await runtime.hello(c.get('node'), parseMessage('HelloRequest', await body(c.req.raw)))));
    app.get('/agent/v2/snapshot', async (c) => c.json(await runtime.snapshot(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')))));
    app.post('/agent/v2/report', async (c) => c.json(await runtime.report(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')), parseMessage('ReportRequest', await body(c.req.raw)))));
    return app;
}
