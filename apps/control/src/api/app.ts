import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import { TLSSocket } from 'node:tls';
import { readFile } from 'node:fs/promises';
import { rows } from '../infrastructure/mysql.ts';
import { consoleQuery } from './console-query.ts';
import { transportReferenceQuery } from './transport-query.ts';
import { tunnelReferenceQuery } from './tunnel-query.ts';
import { randomUUID } from 'node:crypto';
import { parseJson, parseRuntimeMessage, parseTransitNegotiation, parseTransitDelivery, parseProbeNegotiation, parseProbeInstance, parseProbeClaim, parseProbeDelivery, parseProbeResult } from '@tunex/contracts';
import { TransitNegotiator } from '../modules/runtime/transit-negotiation.ts';
import { TransitDeliveryService } from '../modules/runtime/transit-delivery.ts';
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
    // Same-origin, cookie-free alpha console. Bearer credentials remain in tab memory only.
    function consoleHeaders(c: { header: (name: string, value: string) => void }) {
        c.header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        c.header('X-Content-Type-Options', 'nosniff');
        c.header('X-Frame-Options', 'DENY');
        c.header('Referrer-Policy', 'no-referrer');
    }
    app.get('/console', async c => { consoleHeaders(c); return c.html(await readFile(new URL('../../../web/index.html', import.meta.url), 'utf8')); });
    app.get('/console/', async c => { consoleHeaders(c); return c.html(await readFile(new URL('../../../web/index.html', import.meta.url), 'utf8')); });
    app.get('/console/app.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/app.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/model.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/model.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/relay-model.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/relay-model.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/relay.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/relay.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/probe.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/probe.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/transport-console.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/transport-console.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/rule-console.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/rule-console.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/tunnel-console.js', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/tunnel-console.js', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/style.css', async c => { consoleHeaders(c); return c.body(await readFile(new URL('../../../web/style.css', import.meta.url), 'utf8'), 200, { 'Content-Type': 'text/css; charset=utf-8' }); });
    app.get('/api/v1/scopes/:scope/native-drivers', async c => {
        if (new URL(c.req.url).search) invalid('Native catalog does not accept query parameters');
        return c.json(await control.nativeDrivers.list(c.get('actor'), scope(c.req.param('scope'))));
    });
    app.get('/health',async c=>c.json({status:(await authority.read()).maintenance?'maintenance':'ok',protocolVersion:3}));
    app.post('/api/v1/scopes/:scope/relay-plan',async c=>c.json(await control.planRelay(c.get('actor'),scope(c.req.param('scope')),parseJson(await body(c.req.raw,32768)))));
    app.get('/api/v1/scopes/:scope/execution-capabilities',async c=>{
        await control.db.transaction(tx=>control.identity.scope(tx,c.get('actor'),scope(c.req.param('scope'))));
        return c.json({multihopEnabled:control.relay.multihopEnabled,maxPathNodes:8,executionExtension:1,probeIssuanceEnabled:control.probes.enabled});
    });
    app.get('/api/v1/scopes/:scope/forwards/:id/deployment',async c=>c.json(await control.db.transaction(async tx=>{
        const scopeId=scope(c.req.param('scope'));await control.identity.scope(tx,c.get('actor'),scopeId);
        const forward=await control.forwarding.get(tx,scopeId,c.req.param('id'));return {deployment:await control.relay.status(tx,forward)};
    })));
    app.get('/api/v1/scopes/:scope/forwards/:id/revisions',async c=>c.json(await control.db.transaction(async tx=>{
        const scopeId=scope(c.req.param('scope'));await control.identity.scope(tx,c.get('actor'),scopeId);
        const forward=await control.forwarding.get(tx,scopeId,c.req.param('id'));
        return {revisions:await rows(tx,'SELECT revision,spec FROM forward_revisions WHERE forward_id=? ORDER BY revision DESC LIMIT 25',[forward.id])};
    })));
    app.get('/api/v1/scopes/:scope/transport-profiles/:profile/grants',async c=>c.json(await control.transport.grants(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'))));
    app.put('/api/v1/scopes/:scope/transport-profiles/:profile/grants/:actor',async c=>{const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='allowed,expectedRevision'||!isCounter(input.expectedRevision)||typeof input.allowed!=='boolean')invalid('Profile grant fields required');const result=await control.profileGrants.change(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'),c.req.param('actor'),c.req.header('idempotency-key'),input.expectedRevision,input.allowed);return c.json(result.body,result.status);});
    app.get('/api/v1/scopes/:scope/nodes/:node/relay-endpoint',async c=>c.json(await control.relayEndpoints.get(c.get('actor'),scope(c.req.param('scope')),c.req.param('node'))));
    app.get('/api/v1/scopes/:scope/nodes/:node/tunnel', async c => {
        if (new URL(c.req.url).search) invalid('Tunnel metadata does not accept query parameters');
        return c.json(await control.tunnelQueries.status(c.get('actor'), scope(c.req.param('scope')), c.req.param('node')));
    });
    app.get('/api/v1/scopes/:scope/nodes/:node/tunnel/references', async c => c.json(await control.tunnelQueries.references(
        c.get('actor'), scope(c.req.param('scope')), c.req.param('node'), tunnelReferenceQuery(new URL(c.req.url).searchParams))));
    app.put('/api/v1/scopes/:scope/nodes/:node/relay-endpoint',async c=>{const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='config,expectedRevision'||!isCounter(input.expectedRevision,true))invalid('Relay endpoint config and expectedRevision required');const result=await control.relayEndpoints.change(c.get('actor'),scope(c.req.param('scope')),c.req.param('node'),c.req.header('idempotency-key'),input.expectedRevision,input.config);return c.json(result.body,result.status);});
    app.get('/api/v1/scopes/:scope/transport-profiles',async c=>c.json(await control.transport.list(c.get('actor'),scope(c.req.param('scope')))));
    app.get('/api/v1/scopes/:scope/transport-profiles/:profile/references', async c => c.json(await control.transportQueries.references(
        c.get('actor'), scope(c.req.param('scope')), c.req.param('profile'), transportReferenceQuery(new URL(c.req.url).searchParams))));
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
    for (const kind of ['nodes', 'forwards', 'operations', 'candidates'] as const) {
        app.get('/api/v1/scopes/:scope/' + (kind === 'candidates' ? 'nodes/candidates' : kind), async c => {
            const query = consoleQuery(kind, new URL(c.req.url).searchParams);
            return c.json(await control.queries[kind](c.get('actor'), scope(c.req.param('scope')!), query.page, query.limit, query.filters));
        });
    }
    app.get('/api/v1/scopes/:scope/overview', async c => {
        if (new URL(c.req.url).search) invalid('Overview does not accept list filters');
        return c.json(await control.queries.overview(c.get('actor'), scope(c.req.param('scope'))));
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
        return { id: op.id, forwardId: op.forward_id, kind: op.kind, requestedBy: op.requested_by, sourceOperationId: op.source_operation_id, status: op.status,recoveryInvalidated:Boolean(op.recovery_invalidated), targetRevision: op.target_revision, cleanupPending: Boolean(op.cleanup_pending), lastError: op.last_error };
    })));
    app.post('/api/v1/scopes/:scope/operations/:id/retry', async (c) => {
        const input = parseJson(await body(c.req.raw)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'expectedRevision' || typeof input.expectedRevision !== 'number')
            invalid('expectedRevision required');
        const result = await control.retry(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'), c.req.param('id'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/nodes/:id/diagnostics', async c => c.json(await control.queries.diagnostics(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'))));
    app.post('/api/v1/scopes/:scope/nodes/:id/observations', async c => {
        const input = parseJson(await body(c.req.raw, 1024));
        return c.json(await control.observations.observe(c.get('actor'), scope(c.req.param('scope')),
            c.req.param('id'), input, c.req.raw.signal));
    });
    app.post('/api/v1/scopes/:scope/forwards/:id/probe-plan', async c => c.json(
        await control.probePlans.plan(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'),
            parseJson(await body(c.req.raw, 1024)))));
    app.post('/api/v1/scopes/:scope/forwards/:id/probes', async c => {
        const result = await control.probes.create(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'),
            c.req.header('idempotency-key'), parseJson(await body(c.req.raw, 1024)));
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/probes/:id', async c => {
        if (new URL(c.req.url).search) invalid('Probe receipt does not accept query parameters');
        return c.json(await control.probes.inspect(c.get('actor'), scope(c.req.param('scope')), c.req.param('id')));
    });
    app.post('/api/v1/scopes/:scope/probes/:id/revoke', async c => {
        const input = parseJson(await body(c.req.raw, 1024));
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length)
            invalid('Empty Probe revocation object required');
        const result = await control.probes.revoke(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'));
        return c.json({ probeId: result.id, state: result.state, executionEnabled: false,
            withdrawnAt: 'withdrawnAt' in result && typeof result.withdrawnAt === 'number' ? new Date(result.withdrawnAt).toISOString() : null });
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
    app.post('/agent/v3/probe/hello', async c => c.json(await control.probeNegotiation.hello(
        c.get('node'), c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeNegotiation('Request', await body(c.req.raw, 4096)))));
    app.post('/agent/v3/probe/instance', async c => c.json(await control.probeRegistry.handle(
        c.get('node'), c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeInstance('Request', await body(c.req.raw, 4096)))));
    app.post('/agent/v3/probe/claim', async c => c.json(await control.probeClaims.handle(
        c.get('node'), c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeClaim('Request', await body(c.req.raw, 4096)))));
    app.post('/agent/v3/probe/poll', async c => c.json(await control.probeDelivery.poll(
        c.get('node'), c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeDelivery('PollRequest', await body(c.req.raw, 4096)))));
    app.post('/agent/v3/probe/status', async c => c.json(await control.probeDelivery.status(
        c.get('node'), c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeDelivery('StatusRequest', await body(c.req.raw, 4096)))));
    app.post('/agent/v3/probe/result', async c => c.json(await control.probeResults.handle(
        c.get('node'), c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeResult('Request', await body(c.req.raw, 4096)))));
    const transitNegotiator=new TransitNegotiator(control.db);
    // Read-only mTLS session/feature negotiation; never dispatches a Transit job.
    const transitDelivery=new TransitDeliveryService(control.db);
    app.get('/agent/v3/transit/command',async c=>{
      const boot=c.req.header('x-tunex-boot-id');
      if(!boot||!isId(boot))invalid('Current Transit Boot ID header required');
      return c.json(await transitDelivery.poll(c.get('node'),c.get('fingerprint'),
        epoch(c.req.header('x-tunex-session-epoch')),boot));
    });
    app.post('/agent/v3/transit/report',async c=>c.json(await transitDelivery.report(
      c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
      parseTransitDelivery('Report',await body(c.req.raw,8192)))));
    app.post('/agent/v3/transit/hello',async c=>c.json(await transitNegotiator.hello(
      c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
      parseTransitNegotiation('Request',await body(c.req.raw,8192)))));
    app.post('/agent/v3/hello', async (c) => c.json(await runtime.hello(c.get('node'), parseRuntimeMessage('HelloRequest', await body(c.req.raw)), c.get('fingerprint'))));
    app.get('/agent/v3/snapshot', async (c) => c.json(await runtime.snapshot(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')), c.get('fingerprint'))));
    app.post('/agent/v3/report', async (c) => c.json(await runtime.report(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')), parseRuntimeMessage('ReportRequest', await body(c.req.raw)), c.get('fingerprint'))));
    return app;
}
