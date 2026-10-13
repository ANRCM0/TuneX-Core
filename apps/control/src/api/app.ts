import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import { TLSSocket } from 'node:tls';
import { randomUUID } from 'node:crypto';
import { parseJson, parseRuntimeMessage } from '@tunex/contracts';
import { isId, isCounter } from '@tunex/core';
import { ControlError, invalid } from '../application/errors.ts';
import type { ControlApplication } from '../application/control.ts';
import type { NodePolicy } from '../modules/nodes.ts';
import type { RuntimeController } from '../modules/runtime/controller.ts';
import type { AuthorityStore } from '../infrastructure/authority.ts';
export function createApp(control: ControlApplication, runtime: RuntimeController,authority:AuthorityStore): Hono<{
    Bindings: HttpBindings;
    Variables: {
        actor: string;
        node: string;
        requestId: string;
        fingerprint: string;
    };
}> {
    const app = new Hono<{
        Bindings: HttpBindings;
        Variables: {
            actor: string;
            node: string;
            requestId: string;
            fingerprint: string;
        };
    }>();
    app.use('*', async (c, next) => { c.set('requestId', randomUUID()); c.header('Cache-Control', 'no-store');if(c.req.path!=='/health')await authority.allow(); await next(); });
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
    app.use('/agent/v3/*', async (c, next) => {
        const socket = c.env?.incoming?.socket;
        if (!(socket instanceof TLSSocket) || !socket.authorized)
            throw new ControlError('UNAUTHENTICATED', 401, 'Verified Node client certificate required');
        const certificate = socket.getPeerCertificate();
        if (!certificate.fingerprint256)
            throw new ControlError('UNAUTHENTICATED', 401, 'Node certificate required');
        const fingerprint = certificate.fingerprint256.replaceAll(':', '').toLowerCase();
        c.set('fingerprint', fingerprint);
        c.set('node', await control.nodes.machine(fingerprint));
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
    function scope(value: string): string {
        if (!isId(value))
            invalid('Invalid scope ID');
        return value;
    }
    function epoch(value: string | undefined): number {
        if (!value || !/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value)))
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Valid session header required');
        return Number(value);
    }
    app.all('/agent/v2/*',c=>c.json({code:'UNSUPPORTED_PROTOCOL_VERSION',message:'ADP/3 required',retryable:false,requestId:c.get('requestId')},409));
    app.get('/health',async c=>c.json({status:(await authority.read()).maintenance?'maintenance':'ok',protocolVersion:3}));
    app.post('/api/v1/scopes/:scope/relay-plan',async c=>c.json(await control.planRelay(c.get('actor'),scope(c.req.param('scope')),parseJson(await body(c.req.raw,32768)))));
    app.get('/api/v1/scopes/:scope/transport-profiles/:profile/grants',async c=>c.json(await control.transport.grants(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'))));
    app.put('/api/v1/scopes/:scope/transport-profiles/:profile/grants/:actor',async c=>{const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='allowed,expectedRevision'||!isCounter(input.expectedRevision)||typeof input.allowed!=='boolean')invalid('Profile grant fields required');const result=await control.transport.changeGrant(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'),c.req.param('actor'),c.req.header('idempotency-key'),input.expectedRevision,input.allowed);return c.json(result.body,result.status);});
    app.get('/api/v1/scopes/:scope/nodes/:node/relay-endpoint',async c=>c.json(await control.relayEndpoints.get(c.get('actor'),scope(c.req.param('scope')),c.req.param('node'))));
    app.put('/api/v1/scopes/:scope/nodes/:node/relay-endpoint',async c=>{const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='config,expectedRevision'||!isCounter(input.expectedRevision,true))invalid('Relay endpoint config and expectedRevision required');const result=await control.relayEndpoints.change(c.get('actor'),scope(c.req.param('scope')),c.req.param('node'),c.req.header('idempotency-key'),input.expectedRevision,input.config);return c.json(result.body,result.status);});
    app.get('/api/v1/scopes/:scope/transport-profiles',async c=>c.json(await control.transport.list(c.get('actor'),scope(c.req.param('scope')))));
    app.get('/api/v1/scopes/:scope/transport-profiles/:profile',async c=>{const revision=c.req.query('revision');if(revision!==undefined&&!/^[1-9][0-9]*$/.test(revision))invalid('Canonical Profile revision required');return c.json(await control.transport.get(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'),revision===undefined?undefined:Number(revision)));});
    app.put('/api/v1/scopes/:scope/transport-profiles/:profile',async c=>{const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='config,expectedRevision'||!isCounter(input.expectedRevision,true))invalid('Profile config and expectedRevision required');const result=await control.transport.publish(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'),c.req.header('idempotency-key'),input.expectedRevision,input.config);return c.json(result.body,result.status);});
    app.get('/api/v1/scopes/:scope/members', async (c) => c.json(await control.identity.listMembers(c.get('actor'), scope(c.req.param('scope')))));
    app.put('/api/v1/scopes/:scope/members/:actor', async (c) => {
        const input = parseJson(await body(c.req.raw, 32768)) as Record<string, unknown>;
        if (!input || Array.isArray(input) || Object.keys(input).some(name => !['expectedRevision', 'role', 'token'].includes(name)) || typeof input.expectedRevision !== 'number' || !['manager', 'viewer', 'removed'].includes(input.role as string) || input.token !== undefined && typeof input.token !== 'string')
            invalid('Valid member expectedRevision, role and optional token required');
        const response = await control.changeMember(c.get('actor'), scope(c.req.param('scope')), c.req.param('actor'), c.req.header('idempotency-key'), { expectedRevision: input.expectedRevision, role: input.role as 'manager' | 'viewer' | 'removed', ...(input.token !== undefined ? { token: input.token as string } : {}) });
        return c.json(response.body, response.status);
    });
    app.get('/api/v1/scopes/:scope/nodes/:id/grants', async (c) => c.json(await control.nodes.listGrants(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'))));
    app.put('/api/v1/scopes/:scope/nodes/:id/grants/:actor', async (c) => {
        const input = parseJson(await body(c.req.raw)) as Record<string, unknown>;
        if (!input || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'allowed,expectedRevision' || typeof input.expectedRevision !== 'number' || typeof input.allowed !== 'boolean')
            invalid('Node grant expectedRevision and allowed required');
        const response = await control.changeNodeGrant(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'), c.req.param('actor'), c.req.header('idempotency-key'), input.expectedRevision, input.allowed);
        return c.json(response.body, response.status);
    });
    app.post('/api/v1/scopes/:scope/nodes', async (c) => c.json(await control.nodes.provision(c.get('actor'), scope(c.req.param('scope')), parseJson(await body(c.req.raw)) as NodePolicy), 201));
    app.post('/enrollment/v1', async (c) => {
        const input = parseJson(await body(c.req.raw, 32768)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Object.keys(input).sort().join(',') !== 'csr,nodeId,token')
            invalid('Invalid enrollment fields');
        return c.json(await control.nodes.enroll(input.nodeId as string, input.token as string, input.csr as string));
    });
    app.post('/api/v1/scopes/:scope/forwards', async (c) => { const result = await control.create(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'), parseJson(await body(c.req.raw))); return c.json(result.body, result.status); });
    app.put('/api/v1/scopes/:scope/forwards/:id', async (c) => {
        const input = parseJson(await body(c.req.raw)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Object.keys(input).sort().join(',') !== 'expectedRevision,spec' || typeof input.expectedRevision !== 'number')
            invalid('expectedRevision and spec required');
        const result = await control.update(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'), c.req.header('idempotency-key'), input.expectedRevision, input.spec);
        return c.json(result.body, result.status);
    });
    app.delete('/api/v1/scopes/:scope/forwards/:id', async (c) => {
        const input = parseJson(await body(c.req.raw)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'expectedRevision' || typeof input.expectedRevision !== 'number')
            invalid('expectedRevision required');
        const result = await control.remove(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/forwards/:id', async (c) => c.json(await control.db.transaction(async (tx) => {
        const scopeId = scope(c.req.param('scope'));
        await control.identity.scope(tx, c.get('actor'), scopeId);
        const forward = await control.forwarding.get(tx, scopeId, c.req.param('id'));
        const state = await runtime.status(tx, forward);
        const operation = await control.ledger.latest(tx, forward.id);
        const metadata=await control.forwarding.record(tx,scopeId,forward.id);
        return { desired: { revision: forward.revision, spec: forward.spec, deleting: false,recoverySuspended:metadata.recoverySuspended }, ...state, lastOperation: operation ? { id: operation.id, kind: operation.kind, status: operation.status,recoveryInvalidated:Boolean(operation.recovery_invalidated), cleanupPending: Boolean(operation.cleanup_pending) } : null };
    })));
    app.get('/api/v1/scopes/:scope/operations/:id', async (c) => c.json(await control.db.transaction(async (tx) => {
        const scopeId = scope(c.req.param('scope'));
        await control.identity.scope(tx, c.get('actor'), scopeId);
        const op = await control.ledger.get(tx, scopeId, c.req.param('id'));
        return { id: op.id, kind: op.kind, requestedBy: op.requested_by, sourceOperationId: op.source_operation_id, status: op.status,recoveryInvalidated:Boolean(op.recovery_invalidated), targetRevision: op.target_revision, cleanupPending: Boolean(op.cleanup_pending), lastError: op.last_error };
    })));
    app.post('/api/v1/scopes/:scope/operations/:id/retry', async (c) => {
        const input = parseJson(await body(c.req.raw)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || typeof input.expectedRevision !== 'number')
            invalid('expectedRevision required');
        const result = await control.retry(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'), c.req.param('id'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/nodes/:id', async (c) => c.json(await control.nodes.view(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'))));
    app.put('/api/v1/scopes/:scope/nodes/:id/policy', async (c) => {
        const input = parseJson(await body(c.req.raw)) as Record<string, unknown>;
        if (!input || Object.keys(input).sort().join(',') !== 'expectedRevision,policy' || typeof input.expectedRevision !== 'number')
            invalid('expectedRevision and policy required');
        const response = await control.changeNode(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'), c.req.header('idempotency-key'), { kind: 'policy', expectedRevision: input.expectedRevision, policy: input.policy as NodePolicy });
        return c.json(response.body, response.status);
    });
    app.post('/api/v1/scopes/:scope/nodes/:id/revoke', async (c) => {
        const input = parseJson(await body(c.req.raw));
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length)
            invalid('Empty revocation object required');
        const response = await control.changeNode(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'), c.req.header('idempotency-key'), { kind: 'revoke' });
        return c.json(response.body, response.status);
    });
    app.post('/agent/v3/credentials/rotate', async (c) => {
        const input = parseJson(await body(c.req.raw, 32768)) as Record<string, unknown>;
        if (!input || Object.keys(input).sort().join(',') !== 'csr,requestId' || typeof input.csr !== 'string' || typeof input.requestId !== 'string')
            invalid('requestId and CSR required');
        return c.json(await control.nodes.rotate(c.get('node'), c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')), input.requestId, input.csr));
    });
    app.post('/agent/v3/relay-credential',async c=>{const input=parseJson(await body(c.req.raw,32768)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='csr,requestId'||!isId(input.requestId)||typeof input.csr!=='string')invalid('Relay credential request ID and CSR required');return c.json(await control.nodes.relayCredential(c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),input.requestId,input.csr));});
    app.post('/agent/v3/hello', async (c) => c.json(await runtime.hello(c.get('node'), parseRuntimeMessage('HelloRequest', await body(c.req.raw)), c.get('fingerprint'))));
    app.get('/agent/v3/snapshot', async (c) => c.json(await runtime.snapshot(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')), c.get('fingerprint'))));
    app.post('/agent/v3/report', async (c) => c.json(await runtime.report(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')), parseRuntimeMessage('ReportRequest', await body(c.req.raw)), c.get('fingerprint'))));
    return app;
}
