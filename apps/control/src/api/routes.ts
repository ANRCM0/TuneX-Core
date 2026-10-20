import { nativeCreateControlHttpApp, nativeControlQueryString, nativeControlQueryParams,
    nativeControlRequestFingerprint, nativeControlSessionEpoch as epoch,
    nativeControlConsoleHeaders as consoleHeaders, nativeControlProbeWithdrawal } from '../compatibility/control-http/public.ts';
import type { NativeControlHttpApp } from '../compatibility/control-http/public.ts';
import { consoleQuery } from '../modules/console-query-owner/public.ts';
import { transportReferenceQuery, tunnelReferenceQuery, pathTemplateListQuery, pathTemplateRevisionQuery, pathReferenceQuery,
    pathGroupReferenceQuery, pathPublicationListQuery, ingressDeploymentListQuery, telemetryHistoryQuery, telemetryRollupQuery,
    auditQuery, stationEventQuery, notificationDeliveryQuery, probeRunQuery, probePlanQuery,
    observationServiceRevisionQuery } from '../compatibility/public.ts';
import { observationObject } from '../compatibility/public.ts';
import { nativeRequestId as randomUUID, nativeJsonParse as parseJson,
    nativeControlRequestBody as body, nativeControlRequestError, nativeControlConsoleAsset,
    parseNodeTelemetrySample, parseForwardTelemetrySample, parseHostTelemetrySample, parseProbeTelemetrySample,
    parseRuntimeMessage, parseTransitNegotiation, parseTransitDelivery, parseProbeNegotiation, parseProbeInstance,
    parseProbeClaim, parseProbeDelivery, parseProbeResult, parseProbeTypes, parseProbeServices } from '../compatibility/public.ts';
import { isId, isCounter } from '@tunex/core';
import { ControlError, invalid } from '../framework/public.ts';
import type { NodePolicy } from '../modules/node-owner/public.ts';
import type { NativeRuntimeMachinePort as RuntimeMachinePort } from '../compatibility/public.ts';
import type { ControlApi, AuthorityAdmission, ControlHttpOptions, ControlHttpServices } from './contracts.ts';
export function createControlApp(options:ControlHttpOptions): NativeControlHttpApp {
    const {control,runtime,authority}=options;
    const {telemetry,forwardTelemetry,authenticateObservation:telemetryAuthenticate,hostTelemetry,probeTelemetry,telemetryRollups,
        diagnostics,audit,stationAlerts,notificationEndpoints,notificationDeliveries,probeRuns,probePlans,observationServices}=options.services??{};
    const app = nativeCreateControlHttpApp();
    app.use('*', async (c, next) => {
        c.set('requestId',randomUUID());c.header('Cache-Control','no-store');
        const action=async()=>{if(c.req.path!=='/health')await authority.allow();await next();};
        if(options.requests)await options.requests.run(action);else await action();
    });
    app.onError((error, c) => {
        const known = nativeControlRequestError(error);
        return c.json({ code: known.code, message: known.message, retryable: known.retryable, requestId: c.get('requestId') }, known.status);
    });
    app.notFound(c => c.json({ code: 'NOT_FOUND', message: 'Resource not found', retryable: false, requestId: c.get('requestId') }, 404));
    app.use('/api/v1/scopes/:scope/nodes/:node/telemetry', async (_c, next) => {
        if (!telemetry) throw new ControlError('TELEMETRY_UNAVAILABLE', 503, 'Telemetry history is unavailable');
        await telemetry.admitReadRequest(next);
    });
    app.use('/api/v1/scopes/:scope/forwards/:id/telemetry', async (_c, next) => {
        if (!forwardTelemetry) throw new ControlError('FORWARD_TELEMETRY_UNAVAILABLE', 503, 'Forward telemetry history is unavailable');
        await forwardTelemetry.admitReadRequest(next);
    });
    app.use('/api/v1/scopes/:scope/nodes/:node/host-telemetry', async (_c, next) => {
        if (!hostTelemetry) throw new ControlError('HOST_TELEMETRY_UNAVAILABLE', 503, 'Host telemetry history is unavailable');
        await hostTelemetry.admitReadRequest(next);
    });
    app.use('/api/v1/scopes/:scope/forwards/:id/probe-telemetry', async (_c, next) => {
        if (!probeTelemetry) throw new ControlError('PROBE_TELEMETRY_UNAVAILABLE', 503, 'Probe telemetry history is unavailable');
        await probeTelemetry.admitReadRequest(next);
    });
    app.use('/api/v1/scopes/:scope/forwards/:id/diagnostics', async (_c, next) => {
        if (!diagnostics) throw new ControlError('DIAGNOSTIC_UNAVAILABLE', 503, 'Forward diagnostics are unavailable');
        await diagnostics.admitReadRequest(next);
    });
    app.use('/api/v1/scopes/:scope/audit-events', async (_c, next) => {
        if (!audit) throw new ControlError('AUDIT_UNAVAILABLE', 503, 'Audit query is unavailable');
        await audit.admitReadRequest(next);
    });
    for (const path of ['/api/v1/scopes/:scope/nodes/:node/telemetry/aggregates',
        '/api/v1/scopes/:scope/forwards/:id/telemetry/aggregates', '/api/v1/scopes/:scope/telemetry/capacity']) {
        app.use(path, async (_c, next) => {
            if (!telemetryRollups) throw new ControlError('TELEMETRY_AGGREGATE_UNAVAILABLE', 503, 'Aggregate history is unavailable');
            await telemetryRollups.admitReadRequest(next);
        });
    }
    const stationAlertPath = (path: string) => /^\/api\/v1\/scopes\/[^/]+\/(?:alert-policies|station-events)(?:\/.*)?$/.test(path);
    const notificationPath = (path: string) => /^\/api\/v1\/scopes\/[^/]+\/notification-(?:endpoints|deliveries)(?:\/.*)?$/.test(path);
    const probeHistoryPath = (path: string) => /^\/api\/v1\/scopes\/[^/]+\/probe-runs(?:\/.*)?$/.test(path);
    const probePlanPath = (path: string) => /^\/api\/v1\/scopes\/[^/]+\/probe-plans(?:\/.*)?$/.test(path);
    const observationServicePath = (path: string) => /^\/api\/v1\/scopes\/[^/]+\/observation-services(?:\/.*)?$/.test(path);
    app.use('/api/v1/*', async (c,next) => {
        if (observationServicePath(c.req.path)) {
            if (!observationServices) throw new ControlError('OBSERVATION_SERVICE_UNAVAILABLE',503,'Observation service metadata adapter is unavailable');
            return observationServices.admitRequest(next);
        }
        if (probePlanPath(c.req.path)) {
            if (!probePlans) throw new ControlError('PROBE_PLAN_UNAVAILABLE',503,'Probe plan adapter is unavailable');
            return probePlans.admitRequest(next);
        }
        if (probeHistoryPath(c.req.path)) {
            if (!probeRuns) throw new ControlError('PROBE_HISTORY_UNAVAILABLE',503,'Probe history adapter is unavailable');
            return probeRuns.admitReadRequest(next);
        }
        if (/^\/api\/v1\/scopes\/[^/]+\/notification-deliveries(?:\/.*)?$/.test(c.req.path)) {
            if (!notificationDeliveries) throw new ControlError('NOTIFICATION_UNAVAILABLE',503,'Notification delivery adapter is unavailable');
            return notificationDeliveries.admitRequest(next);
        }
        if (notificationPath(c.req.path)) {
            if (!notificationEndpoints) throw new ControlError('NOTIFICATION_UNAVAILABLE',503,'Notification endpoint adapter is unavailable');
            return notificationEndpoints.admitRequest(next);
        }
        if (!stationAlertPath(c.req.path)) return next();
        if (!stationAlerts) throw new ControlError('STATION_ALERT_UNAVAILABLE',503,'Station alert adapter is unavailable');
        await stationAlerts.admitRequest(next);
    });
    app.use('/api/v1/*', async (c, next) => {
        if (c.req.header('cookie'))
            throw new ControlError('UNAUTHENTICATED', 401, 'Bearer authentication required');
        const history = /^\/api\/v1\/scopes\/[^/]+\/(?:nodes|forwards)\/[^/]+\/telemetry$/.test(c.req.path) ||
            /^\/api\/v1\/scopes\/[^/]+\/nodes\/[^/]+\/host-telemetry$/.test(c.req.path) ||
            /^\/api\/v1\/scopes\/[^/]+\/forwards\/[^/]+\/probe-telemetry$/.test(c.req.path) ||
            /^\/api\/v1\/scopes\/[^/]+\/(?:nodes|forwards)\/[^/]+\/telemetry\/aggregates$/.test(c.req.path) ||
            /^\/api\/v1\/scopes\/[^/]+\/telemetry\/capacity$/.test(c.req.path);
        const diagnostic = /^\/api\/v1\/scopes\/[^/]+\/forwards\/[^/]+\/diagnostics$/.test(c.req.path);
        const auditing = /^\/api\/v1\/scopes\/[^/]+\/audit-events$/.test(c.req.path);
        const stationAlerting = stationAlertPath(c.req.path) || notificationPath(c.req.path);
        const probeHistory = probeHistoryPath(c.req.path), probePlanning = probePlanPath(c.req.path), observationService = observationServicePath(c.req.path);
        if ((history || diagnostic || auditing || stationAlerting || probeHistory || probePlanning || observationService) && !telemetryAuthenticate) throw new ControlError(observationService ? 'OBSERVATION_SERVICE_UNAVAILABLE' : probePlanning ? 'PROBE_PLAN_UNAVAILABLE' : probeHistory ? 'PROBE_HISTORY_UNAVAILABLE' : notificationPath(c.req.path) ? 'NOTIFICATION_UNAVAILABLE' : stationAlerting ? 'STATION_ALERT_UNAVAILABLE' : auditing ? 'AUDIT_UNAVAILABLE' : diagnostic ? 'DIAGNOSTIC_UNAVAILABLE' : 'TELEMETRY_UNAVAILABLE', 503, 'Observation identity adapter is unavailable');
        c.set('actor', history || diagnostic || auditing || stationAlerting || probeHistory || probePlanning || observationService ? await telemetryAuthenticate!(c.req.header('authorization')) :
            await control.identity.authenticate(c.req.header('authorization')));
        await next();
    });
    app.use('/agent/v3/telemetry', async (_c, next) => {
        if (!telemetry) throw new ControlError('TELEMETRY_DISABLED', 503, 'Telemetry collection is unavailable');
        await telemetry.admitMachineRequest(next);
    });
    app.use('/agent/v3/forward-telemetry', async (_c, next) => {
        if (!forwardTelemetry) throw new ControlError('FORWARD_TELEMETRY_DISABLED', 503, 'Forward telemetry collection is unavailable');
        await forwardTelemetry.admitMachineRequest(next);
    });
    app.use('/agent/v3/host-telemetry', async (_c, next) => {
        if (!hostTelemetry) throw new ControlError('HOST_TELEMETRY_DISABLED', 503, 'Host telemetry collection is unavailable');
        await hostTelemetry.admitMachineRequest(next);
    });
    app.use('/agent/v3/probe-telemetry', async (_c, next) => {
        if (!probeTelemetry) throw new ControlError('PROBE_TELEMETRY_DISABLED', 503, 'Probe telemetry collection is unavailable');
        await probeTelemetry.admitMachineRequest(next);
    });
    app.use('/agent/v3/probe/services/*', async (c, next) => {
        if(nativeControlQueryString(c.req.url))invalid('Service Probe machine requests accept no query parameters');
        await next();
    });
    app.use('/agent/v3/*', async (c, next) => {
        const fingerprint = nativeControlRequestFingerprint(c);
        c.set('fingerprint', fingerprint);
        // Telemetry binds its parsed Node claim to this fingerprint using Nodes.credential
        // in the observation transaction, without an initial query on Runtime's pool.
        if (c.req.path !== '/agent/v3/telemetry' && c.req.path !== '/agent/v3/forward-telemetry' &&
            c.req.path !== '/agent/v3/host-telemetry' && c.req.path !== '/agent/v3/probe-telemetry')
            c.set('node', await control.nodes.machine(fingerprint));
        await next();
    });
    function scope(value: string): string {
        if (!isId(value))
            invalid('Invalid scope ID');
        return value;
    }
    app.all('/agent/v2/*',c=>c.json({code:'UNSUPPORTED_PROTOCOL_VERSION',message:'ADP/3 required',retryable:false,requestId:c.get('requestId')},409));
    // Same-origin, cookie-free alpha console. Bearer credentials remain in tab memory only.
    app.get('/console', async c => { consoleHeaders(c); return c.html(await nativeControlConsoleAsset('index.html')); });
    app.get('/console/', async c => { consoleHeaders(c); return c.html(await nativeControlConsoleAsset('index.html')); });
    app.get('/console/app.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('app.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/model.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('model.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/console-model-owner/public.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('console-model-owner/public.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/console-model-owner/service.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('console-model-owner/service.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/browser-native/public.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('browser-native/public.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/console-request-owner/public.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('console-request-owner/public.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/console-request-owner/service.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('console-request-owner/service.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/browser-native/control-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('browser-native/control-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/browser-native/relay-forms.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('browser-native/relay-forms.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/browser-native/relay-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('browser-native/relay-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/relay-model.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('relay-model.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/relay.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('relay.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/probe.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('probe.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/transport-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('transport-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/rule-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('rule-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/rule-command-owner/public.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('rule-command-owner/public.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/rule-command-owner/service.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('rule-command-owner/service.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/browser-native/rule-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('browser-native/rule-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/tunnel-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('tunnel-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/path-templates.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('path-templates.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/observation-services.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('observation-services.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/path-groups.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('path-groups.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/path-publications.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('path-publications.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/ingress-groups.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('ingress-groups.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/ingress-migrations.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('ingress-migrations.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/forward-diagnostics.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('forward-diagnostics.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/forward-status.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('forward-status.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/forward-preflight.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('forward-preflight.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/audit-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('audit-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/station-alerts.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('station-alerts.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/notification-endpoints.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('notification-endpoints.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/notification-deliveries.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('notification-deliveries.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/probe-runs.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('probe-runs.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/probe-plans.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('probe-plans.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/telemetry-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('telemetry-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/forward-telemetry-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('forward-telemetry-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/host-telemetry-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('host-telemetry-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/probe-telemetry-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('probe-telemetry-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/telemetry-aggregate-console.js', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('telemetry-aggregate-console.js'), 200, { 'Content-Type': 'text/javascript; charset=utf-8' }); });
    app.get('/console/style.css', async c => { consoleHeaders(c); return c.body(await nativeControlConsoleAsset('style.css'), 200, { 'Content-Type': 'text/css; charset=utf-8' }); });
    app.get('/api/v1/scopes/:scope/native-drivers', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Native catalog does not accept query parameters');
        return c.json(await control.nativeDrivers.list(c.get('actor'), scope(c.req.param('scope'))));
    });
    app.get('/health',async c=>c.json({status:(await authority.read()).maintenance?'maintenance':'ok',protocolVersion:3}));
    app.post('/agent/v3/telemetry', async c => {
        if (!telemetry) throw new ControlError('TELEMETRY_DISABLED', 503, 'Telemetry collection is unavailable');
        if (nativeControlQueryString(c.req.url)) invalid('Telemetry collection does not accept query parameters');
        const input = parseNodeTelemetrySample(parseJson(await body(c.req.raw, 8192)));
        return c.json(await telemetry.ingest(input.nodeId, c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')), input));
    });
    app.get('/api/v1/scopes/:scope/nodes/:node/telemetry', async c => {
        if (!telemetry) throw new ControlError('TELEMETRY_UNAVAILABLE', 503, 'Telemetry history is unavailable');
        return c.json(await telemetry.history(c.get('actor'), scope(c.req.param('scope')), c.req.param('node'), telemetryHistoryQuery(nativeControlQueryParams(c.req.url))));
    });
    app.post('/agent/v3/host-telemetry', async c => {
        if (!hostTelemetry) throw new ControlError('HOST_TELEMETRY_DISABLED', 503, 'Host telemetry collection is unavailable');
        if (nativeControlQueryString(c.req.url)) invalid('Host telemetry collection does not accept query parameters');
        const input = parseHostTelemetrySample(parseJson(await body(c.req.raw, 8192)));
        return c.json(await hostTelemetry.ingest(input.nodeId, c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')), input));
    });
    app.get('/api/v1/scopes/:scope/nodes/:node/host-telemetry', async c => {
        if (!hostTelemetry) throw new ControlError('HOST_TELEMETRY_UNAVAILABLE', 503, 'Host telemetry history is unavailable');
        return c.json(await hostTelemetry.history(c.get('actor'), scope(c.req.param('scope')), c.req.param('node'),
            telemetryHistoryQuery(nativeControlQueryParams(c.req.url))));
    });
    app.post('/agent/v3/forward-telemetry', async c => {
        if (!forwardTelemetry) throw new ControlError('FORWARD_TELEMETRY_DISABLED', 503, 'Forward telemetry collection is unavailable');
        if (nativeControlQueryString(c.req.url)) invalid('Forward telemetry collection does not accept query parameters');
        const input = parseForwardTelemetrySample(parseJson(await body(c.req.raw, 65536)));
        return c.json(await forwardTelemetry.ingest(input.nodeId, c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')), input));
    });
    app.get('/api/v1/scopes/:scope/forwards/:id/telemetry', async c => {
        if (!forwardTelemetry) throw new ControlError('FORWARD_TELEMETRY_UNAVAILABLE', 503, 'Forward telemetry history is unavailable');
        return c.json(await forwardTelemetry.history(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'),
            telemetryHistoryQuery(nativeControlQueryParams(c.req.url))));
    });
    app.post('/agent/v3/probe-telemetry', async c => {
        if (!probeTelemetry) throw new ControlError('PROBE_TELEMETRY_DISABLED', 503, 'Probe telemetry collection is unavailable');
        if (nativeControlQueryString(c.req.url)) invalid('Probe telemetry collection does not accept query parameters');
        const input = parseProbeTelemetrySample(parseJson(await body(c.req.raw, 65536)));
        return c.json(await probeTelemetry.ingest(input.nodeId, c.get('fingerprint'), epoch(c.req.header('x-tunex-session-epoch')), input));
    });
    app.get('/api/v1/scopes/:scope/forwards/:id/probe-telemetry', async c => {
        if (!probeTelemetry) throw new ControlError('PROBE_TELEMETRY_UNAVAILABLE', 503, 'Probe telemetry history is unavailable');
        return c.json(await probeTelemetry.history(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'),
            telemetryHistoryQuery(nativeControlQueryParams(c.req.url))));
    });
    app.get('/api/v1/scopes/:scope/nodes/:node/telemetry/aggregates', async c => {
        if (!telemetryRollups) throw new ControlError('TELEMETRY_AGGREGATE_UNAVAILABLE', 503, 'Aggregate history is unavailable');
        return c.json(await telemetryRollups.history(c.get('actor'), scope(c.req.param('scope')), 'node', c.req.param('node'),
            telemetryRollupQuery(nativeControlQueryParams(c.req.url))));
    });
    app.get('/api/v1/scopes/:scope/forwards/:id/telemetry/aggregates', async c => {
        if (!telemetryRollups) throw new ControlError('TELEMETRY_AGGREGATE_UNAVAILABLE', 503, 'Aggregate history is unavailable');
        return c.json(await telemetryRollups.history(c.get('actor'), scope(c.req.param('scope')), 'forward', c.req.param('id'),
            telemetryRollupQuery(nativeControlQueryParams(c.req.url))));
    });
    app.get('/api/v1/scopes/:scope/telemetry/capacity', async c => {
        if (!telemetryRollups) throw new ControlError('TELEMETRY_AGGREGATE_UNAVAILABLE', 503, 'Aggregate capacity is unavailable');
        if (nativeControlQueryString(c.req.url)) invalid('Aggregate capacity does not accept query parameters');
        return c.json(await telemetryRollups.capacity(c.get('actor'), scope(c.req.param('scope'))));
    });
    app.post('/api/v1/scopes/:scope/relay-plan',async c=>c.json(await control.planRelay(c.get('actor'),scope(c.req.param('scope')),parseJson(await body(c.req.raw,32768)))));
    app.get('/api/v1/scopes/:scope/execution-capabilities',async c=>c.json(await control.details.capabilities(c.get('actor'),scope(c.req.param('scope')))));
    app.get('/api/v1/scopes/:scope/forwards/:id/deployment',async c=>c.json(await control.details.deployment(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'))));
    app.get('/api/v1/scopes/:scope/forwards/:id/revisions',async c=>c.json(await control.details.revisions(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'))));
    app.get('/api/v1/scopes/:scope/transport-profiles/:profile/grants',async c=>c.json(await control.transport.grants(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'))));
    app.put('/api/v1/scopes/:scope/transport-profiles/:profile/grants/:actor',async c=>{const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='allowed,expectedRevision'||!isCounter(input.expectedRevision)||typeof input.allowed!=='boolean')invalid('Profile grant fields required');const result=await control.profileGrants.change(c.get('actor'),scope(c.req.param('scope')),c.req.param('profile'),c.req.param('actor'),c.req.header('idempotency-key'),input.expectedRevision,input.allowed);return c.json(result.body,result.status);});
    app.get('/api/v1/scopes/:scope/nodes/:node/relay-endpoint',async c=>c.json(await control.relayEndpoints.get(c.get('actor'),scope(c.req.param('scope')),c.req.param('node'))));
    app.get('/api/v1/scopes/:scope/nodes/:node/tunnel', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Tunnel metadata does not accept query parameters');
        return c.json(await control.tunnelQueries.status(c.get('actor'), scope(c.req.param('scope')), c.req.param('node')));
    });
    app.get('/api/v1/scopes/:scope/nodes/:node/tunnel/references', async c => c.json(await control.tunnelQueries.references(
        c.get('actor'), scope(c.req.param('scope')), c.req.param('node'), tunnelReferenceQuery(nativeControlQueryParams(c.req.url)))));
    app.put('/api/v1/scopes/:scope/nodes/:node/relay-endpoint',async c=>{const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='config,expectedRevision'||!isCounter(input.expectedRevision,true))invalid('Relay endpoint config and expectedRevision required');const result=await control.relayEndpoints.change(c.get('actor'),scope(c.req.param('scope')),c.req.param('node'),c.req.header('idempotency-key'),input.expectedRevision,input.config);return c.json(result.body,result.status);});
    app.get('/api/v1/scopes/:scope/observation-services', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Observation service list accepts no query parameters');
        return c.json(await observationServices!.list(c.get('actor'), scope(c.req.param('scope'))));
    });
    app.get('/api/v1/scopes/:scope/observation-services/:service', async c => c.json(await observationServices!.get(
        c.get('actor'), scope(c.req.param('scope')), c.req.param('service'), observationServiceRevisionQuery(nativeControlQueryParams(c.req.url)))));
    app.put('/api/v1/scopes/:scope/observation-services/:service', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Observation service mutation accepts no query parameters');
        const input = observationObject(parseJson(await body(c.req.raw, 18432)), ['expectedRevision', 'config']);
        if (!isCounter(input.expectedRevision, true)) invalid('Observation metadata CAS required');
        const result = await observationServices!.publish(c.get('actor'), scope(c.req.param('scope')), c.req.param('service'),
            c.req.header('idempotency-key'), input.expectedRevision, input.config);
        return c.json(result.body, result.status);
    });
    app.delete('/api/v1/scopes/:scope/observation-services/:service', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Observation service mutation accepts no query parameters');
        const input = observationObject(parseJson(await body(c.req.raw, 2048)), ['expectedRevision']);
        if (!isCounter(input.expectedRevision)) invalid('Observation archival metadata CAS required');
        const result = await observationServices!.archive(c.get('actor'), scope(c.req.param('scope')), c.req.param('service'),
            c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/path-templates', async c => c.json(await control.pathTemplateQueries.list(c.get('actor'), scope(c.req.param('scope')), pathTemplateListQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/path-templates/:template/references', async c => c.json(await control.pathBindings.references(c.get('actor'), scope(c.req.param('scope')), c.req.param('template'), pathReferenceQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/path-templates/:template', async c => c.json(await control.pathTemplateQueries.get(c.get('actor'), scope(c.req.param('scope')), c.req.param('template'), pathTemplateRevisionQuery(nativeControlQueryParams(c.req.url)))));
    app.put('/api/v1/scopes/:scope/path-templates/:template', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('PathTemplate mutation does not accept query parameters');
        const input = parseJson(await body(c.req.raw, 8192)) as Record<string, unknown>;
        if (!input || Object.keys(input).sort().join(',') !== 'config,expectedRevision' || !isCounter(input.expectedRevision, true)) invalid('Template config and expectedRevision required');
        const result = await control.pathTemplates.publish(c.get('actor'), scope(c.req.param('scope')), c.req.param('template'), c.req.header('idempotency-key'), input.expectedRevision, input.config);
        return c.json(result.body, result.status);
    });
    app.delete('/api/v1/scopes/:scope/path-templates/:template', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('PathTemplate mutation does not accept query parameters');
        const input = parseJson(await body(c.req.raw, 8192)) as Record<string, unknown>;
        if (!input || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Template archive expectedRevision required');
        const result = await control.pathTemplates.archive(c.get('actor'), scope(c.req.param('scope')), c.req.param('template'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.post('/api/v1/scopes/:scope/ingress-migrations/preview', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress migration preview has no query parameters');
        return c.json(await control.ingressMigrations.preview(c.get('actor'), scope(c.req.param('scope')), parseJson(await body(c.req.raw, 16384))));
    });
    app.post('/api/v1/scopes/:scope/ingress-migrations', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress migration creation has no query parameters');
        const input = parseJson(await body(c.req.raw, 16384)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'items,previewDigest,schemaVersion,sourceGroup,sources,targetGroup') invalid('Closed ingress migration input and previewDigest required');
        const result = await control.ingressMigrations.create(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'),
            { schemaVersion: input.schemaVersion, sourceGroup: input.sourceGroup, targetGroup: input.targetGroup, sources: input.sources, items: input.items }, input.previewDigest);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/ingress-migrations', async c => c.json(await control.ingressMigrations.list(c.get('actor'), scope(c.req.param('scope')), ingressDeploymentListQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/ingress-migrations/:batch', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress migration lookup has no query parameters');
        return c.json(await control.ingressMigrations.get(c.get('actor'), scope(c.req.param('scope')), c.req.param('batch')));
    });
    for (const action of ['apply','compensate'] as const) app.post('/api/v1/scopes/:scope/ingress-migrations/:batch/items/:position/' + action, async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress migration commands have no query parameters');
        const position = c.req.param('position') ?? '', input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!/^[1-8]$/.test(position) || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Exact ingress migration item and batch expectedRevision required');
        const result = await control.ingressMigrations.act(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('batch') ?? '', c.req.header('idempotency-key'), input.expectedRevision, action, Number(position));
        return c.json(result.body, result.status);
    });
    app.post('/api/v1/scopes/:scope/ingress-migrations/:batch/cancel', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress migration cancellation has no query parameters');
        const input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Ingress migration batch expectedRevision required');
        const result = await control.ingressMigrations.cancel(c.get('actor'), scope(c.req.param('scope')), c.req.param('batch'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/ingress-groups', async c => c.json(await control.ingressGroups.list(c.get('actor'), scope(c.req.param('scope')), pathTemplateListQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/ingress-groups/:group', async c => c.json(await control.ingressGroups.get(c.get('actor'), scope(c.req.param('scope')), c.req.param('group'), pathTemplateRevisionQuery(nativeControlQueryParams(c.req.url)))));
    app.put('/api/v1/scopes/:scope/ingress-groups/:group', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress group publication has no query parameters');
        const input = parseJson(await body(c.req.raw, 8192)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'config,expectedRevision' || !isCounter(input.expectedRevision, true)) invalid('Closed ingress group config and expectedRevision required');
        const result = await control.ingressGroups.publish(c.get('actor'), scope(c.req.param('scope')), c.req.param('group'), c.req.header('idempotency-key'), input.expectedRevision, input.config);
        return c.json(result.body, result.status);
    });
    app.delete('/api/v1/scopes/:scope/ingress-groups/:group', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress group archive has no query parameters');
        const input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Ingress archive expectedRevision required');
        const result = await control.ingressGroups.archive(c.get('actor'), scope(c.req.param('scope')), c.req.param('group'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.post('/api/v1/scopes/:scope/ingress-deployments/preview', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress preview has no query parameters');
        return c.json(await control.ingressDeployments.preview(c.get('actor'), scope(c.req.param('scope')), parseJson(await body(c.req.raw, 16384))));
    });
    app.post('/api/v1/scopes/:scope/ingress-deployments', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress deployment creation has no query parameters');
        const input = parseJson(await body(c.req.raw, 16384)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'enabled,group,items,previewDigest,schemaVersion,target') invalid('Closed ingress deployment input and previewDigest required');
        const result = await control.ingressDeployments.create(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'),
            { schemaVersion: input.schemaVersion, group: input.group, enabled: input.enabled, target: input.target, items: input.items }, input.previewDigest);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/ingress-deployments', async c => c.json(await control.ingressDeployments.list(c.get('actor'), scope(c.req.param('scope')), ingressDeploymentListQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/ingress-deployments/:batch', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress deployment lookup has no query parameters');
        return c.json(await control.ingressDeployments.get(c.get('actor'), scope(c.req.param('scope')), c.req.param('batch')));
    });
    for (const action of ['create','compensate'] as const) app.post('/api/v1/scopes/:scope/ingress-deployments/:batch/items/:position/' + action, async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress item commands have no query parameters');
        const position = c.req.param('position') ?? '', input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!/^[1-8]$/.test(position) || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Exact ingress item and batch expectedRevision required');
        const result = await control.ingressDeployments.act(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('batch') ?? '', c.req.header('idempotency-key'), input.expectedRevision, action, Number(position));
        return c.json(result.body, result.status);
    });
    app.post('/api/v1/scopes/:scope/ingress-deployments/:batch/cancel', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Ingress cancellation has no query parameters');
        const input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Ingress batch expectedRevision required');
        const result = await control.ingressDeployments.cancel(c.get('actor'), scope(c.req.param('scope')), c.req.param('batch'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.post('/api/v1/scopes/:scope/path-publications/preview', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Publication preview has no query parameters');
        return c.json(await control.pathPublications.preview(c.get('actor'), scope(c.req.param('scope')), parseJson(await body(c.req.raw, 16384))));
    });
    app.post('/api/v1/scopes/:scope/path-publications', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Publication creation has no query parameters');
        const input = parseJson(await body(c.req.raw, 16384)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'group,items,previewDigest,schemaVersion') invalid('Closed publication input and previewDigest required');
        const result = await control.pathPublications.create(c.get('actor'), scope(c.req.param('scope')), c.req.header('idempotency-key'),
            { schemaVersion: input.schemaVersion, group: input.group, items: input.items }, input.previewDigest);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/path-publications', async c => c.json(await control.pathPublications.list(c.get('actor'), scope(c.req.param('scope')), pathPublicationListQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/path-publications/:batch', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Publication lookup has no query parameters');
        return c.json(await control.pathPublications.get(c.get('actor'), scope(c.req.param('scope')), c.req.param('batch')));
    });
    for (const action of ['apply', 'compensate'] as const) app.post('/api/v1/scopes/:scope/path-publications/:batch/items/:position/' + action, async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Publication actions have no query parameters');
        const position = c.req.param('position') ?? '', input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!/^(?:[1-9]|10)$/.test(position) || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Exact item and batch expectedRevision required');
        const result = await control.pathPublications.act(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('batch') ?? '', c.req.header('idempotency-key'), input.expectedRevision, action, Number(position));
        return c.json(result.body, result.status);
    });
    app.post('/api/v1/scopes/:scope/path-publications/:batch/cancel', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Publication cancellation has no query parameters');
        const input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Batch expectedRevision required');
        const result = await control.pathPublications.cancel(c.get('actor'), scope(c.req.param('scope')), c.req.param('batch'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/path-groups', async c => c.json(await control.pathGroups.list(c.get('actor'), scope(c.req.param('scope')), pathTemplateListQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/path-groups/:group/references', async c => c.json(await control.pathGroups.references(c.get('actor'), scope(c.req.param('scope')), c.req.param('group'), pathGroupReferenceQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/path-groups/:group', async c => c.json(await control.pathGroups.get(c.get('actor'), scope(c.req.param('scope')), c.req.param('group'), pathTemplateRevisionQuery(nativeControlQueryParams(c.req.url)))));
    app.put('/api/v1/scopes/:scope/path-groups/:group', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Group mutation does not accept query parameters');
        const input = parseJson(await body(c.req.raw, 8192)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
            Object.keys(input).sort().join(',') !== 'config,expectedRevision' || !isCounter(input.expectedRevision, true))
            invalid('Group config and expectedRevision required');
        const result = await control.pathGroups.publish(c.get('actor'), scope(c.req.param('scope')), c.req.param('group'), c.req.header('idempotency-key'), input.expectedRevision, input.config);
        return c.json(result.body, result.status);
    });
    app.delete('/api/v1/scopes/:scope/path-groups/:group', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Group mutation does not accept query parameters');
        const input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
            Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Group archive expectedRevision required');
        const result = await control.pathGroups.archive(c.get('actor'), scope(c.req.param('scope')), c.req.param('group'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/tunnels', async c => c.json(await control.tunnels.list(c.get('actor'), scope(c.req.param('scope')), pathTemplateListQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/tunnels/:tunnel/references', async c => c.json(await control.tunnels.references(c.get('actor'), scope(c.req.param('scope')), c.req.param('tunnel'), pathReferenceQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/tunnels/:tunnel', async c => c.json(await control.tunnels.get(c.get('actor'), scope(c.req.param('scope')), c.req.param('tunnel'), pathTemplateRevisionQuery(nativeControlQueryParams(c.req.url)))));
    app.put('/api/v1/scopes/:scope/tunnels/:tunnel', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Tunnel mutation does not accept query parameters');
        const input = parseJson(await body(c.req.raw, 8192)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'config,expectedRevision' || !isCounter(input.expectedRevision, true)) invalid('Tunnel config and expectedRevision required');
        const result = await control.tunnels.publish(c.get('actor'), scope(c.req.param('scope')), c.req.param('tunnel'), c.req.header('idempotency-key'), input.expectedRevision, input.config);
        return c.json(result.body, result.status);
    });
    app.delete('/api/v1/scopes/:scope/tunnels/:tunnel', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Tunnel mutation does not accept query parameters');
        const input = parseJson(await body(c.req.raw, 8192)) as Record<string, unknown>;
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'expectedRevision' || !isCounter(input.expectedRevision)) invalid('Tunnel archive expectedRevision required');
        const result = await control.tunnels.archive(c.get('actor'), scope(c.req.param('scope')), c.req.param('tunnel'), c.req.header('idempotency-key'), input.expectedRevision);
        return c.json(result.body, result.status);
    });
    app.get('/api/v1/scopes/:scope/transport-profiles',async c=>c.json(await control.transport.list(c.get('actor'),scope(c.req.param('scope')))));
    app.get('/api/v1/scopes/:scope/transport-profiles/:profile/references', async c => c.json(await control.transportQueries.references(
        c.get('actor'), scope(c.req.param('scope')), c.req.param('profile'), transportReferenceQuery(nativeControlQueryParams(c.req.url)))));
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
            const query = consoleQuery(kind, nativeControlQueryParams(c.req.url));
            return c.json(await control.queries[kind](c.get('actor'), scope(c.req.param('scope')!), query.page, query.limit, query.filters));
        });
    }
    app.get('/api/v1/scopes/:scope/overview', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Overview does not accept list filters');
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
    function probeHistoryService() {
        if (!probeRuns) throw new ControlError('PROBE_HISTORY_UNAVAILABLE',503,'Probe history adapter is unavailable');
        return probeRuns;
    }
    app.get('/api/v1/scopes/:scope/probe-runs', async c => c.json(await probeHistoryService().history(c.get('actor'),scope(c.req.param('scope')),
        probeRunQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/probe-runs/:id', async c => {
        if (nativeControlQueryParams(c.req.url).size) invalid('Probe history detail does not accept query parameters');
        return c.json(await probeHistoryService().get(c.get('actor'),scope(c.req.param('scope')),c.req.param('id')));
    });
    function probePlanService() {
        if (!probePlans) throw new ControlError('PROBE_PLAN_UNAVAILABLE',503,'Probe plan adapter is unavailable');
        return probePlans;
    }
    app.get('/api/v1/scopes/:scope/probe-plans', async c => c.json(await probePlanService().history(c.get('actor'),scope(c.req.param('scope')),
        probePlanQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/probe-plans/:id', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Probe plan detail has no query parameters');
        return c.json(await probePlanService().get(c.get('actor'),scope(c.req.param('scope')),c.req.param('id')));
    });
    app.post('/api/v1/scopes/:scope/probe-plans/preview', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Probe plan preview has no query parameters');
        return c.json(await probePlanService().preview(c.get('actor'),scope(c.req.param('scope')),parseJson(await body(c.req.raw,8192))));
    });
    app.post('/api/v1/scopes/:scope/probe-plans', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Probe plan commands have no query parameters');
        const result=await probePlanService().create(c.get('actor'),scope(c.req.param('scope')),c.req.header('idempotency-key'),parseJson(await body(c.req.raw,8192)));
        return c.json(result.body,result.status);
    });
    for (const action of ['run','cancel'] as const) app.post(`/api/v1/scopes/:scope/probe-plans/:id/${action}`, async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Probe plan commands have no query parameters');
        const result=await probePlanService().command(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'),c.req.header('idempotency-key'),action,
            parseJson(await body(c.req.raw,1024)));
        return c.json(result.body,result.status);
    });
    function notificationService() {
        if (!notificationEndpoints) throw new ControlError('NOTIFICATION_UNAVAILABLE',503,'Notification endpoint adapter is unavailable');
        return notificationEndpoints;
    }
    function deliveryService() {
        if (!notificationDeliveries) throw new ControlError('NOTIFICATION_UNAVAILABLE',503,'Notification delivery adapter is unavailable');
        return notificationDeliveries;
    }
    app.get('/api/v1/scopes/:scope/notification-deliveries', async c => c.json(await deliveryService().history(c.get('actor'),scope(c.req.param('scope')),
        notificationDeliveryQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/notification-deliveries/:id', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Notification delivery lookup has no query parameters');
        return c.json(await deliveryService().get(c.get('actor'),scope(c.req.param('scope')),c.req.param('id')));
    });
    app.get('/api/v1/scopes/:scope/notification-endpoints', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Notification endpoint list has no query parameters');
        return c.json(await notificationService().list(c.get('actor'),scope(c.req.param('scope'))));
    });
    app.get('/api/v1/scopes/:scope/notification-endpoints/:id', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Notification endpoint lookup has no query parameters');
        return c.json(await notificationService().get(c.get('actor'),scope(c.req.param('scope')),c.req.param('id')));
    });
    app.put('/api/v1/scopes/:scope/notification-endpoints/:id', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Notification endpoint commands have no query parameters');
        const input=parseJson(await body(c.req.raw,8192)) as Record<string,unknown>;
        if (!input||Object.keys(input).sort().join(',')!=='config,destination,expectedRevision'||!isCounter(input.expectedRevision,true))
            invalid('Notification config, destination and expectedRevision required');
        const result=await notificationService().publish(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'),c.req.header('idempotency-key'),
            input.expectedRevision,input.config,input.destination);
        return c.json(result.body,result.status);
    });
    app.post('/api/v1/scopes/:scope/notification-endpoints/:id/disable', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Notification endpoint commands have no query parameters');
        const input=parseJson(await body(c.req.raw,1024)) as Record<string,unknown>;
        if (!input||Object.keys(input).join(',')!=='expectedRevision'||!isCounter(input.expectedRevision)) invalid('Notification endpoint expectedRevision required');
        const result=await notificationService().disable(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'),c.req.header('idempotency-key'),input.expectedRevision);
        return c.json(result.body,result.status);
    });
    function alertService() {
        if (!stationAlerts) throw new ControlError('STATION_ALERT_UNAVAILABLE',503,'Station alert adapter is unavailable');
        return stationAlerts;
    }
    app.get('/api/v1/scopes/:scope/alert-policies', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Station policy list has no query parameters');
        return c.json(await alertService().listPolicies(c.get('actor'),scope(c.req.param('scope'))));
    });
    app.get('/api/v1/scopes/:scope/alert-policies/:id', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Station policy lookup has no query parameters');
        return c.json(await alertService().getPolicy(c.get('actor'),scope(c.req.param('scope')),c.req.param('id')));
    });
    app.put('/api/v1/scopes/:scope/alert-policies/:id', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Station policy commands have no query parameters');
        const input=parseJson(await body(c.req.raw,2048)) as Record<string,unknown>;
        if (!input||Object.keys(input).sort().join(',')!=='config,expectedRevision'||!isCounter(input.expectedRevision,true)) invalid('Station policy config and expectedRevision required');
        const result=await alertService().publish(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'),c.req.header('idempotency-key'),input.expectedRevision,input.config);
        return c.json(result.body,result.status);
    });
    app.post('/api/v1/scopes/:scope/alert-policies/:id/silence', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Station silence commands have no query parameters');
        const input=parseJson(await body(c.req.raw,1024)) as Record<string,unknown>;
        if (!input||Object.keys(input).sort().join(',')!=='expectedRevision,until'||!isCounter(input.expectedRevision)||
            input.until!==null&&(typeof input.until!=='number'||!Number.isSafeInteger(input.until))) invalid('Station silence CAS and deadline required');
        const result=await alertService().silence(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'),c.req.header('idempotency-key'),input.expectedRevision,input.until as number|null);
        return c.json(result.body,result.status);
    });
    app.get('/api/v1/scopes/:scope/station-events', async c => c.json(await alertService().history(c.get('actor'),scope(c.req.param('scope')),
        stationEventQuery(nativeControlQueryParams(c.req.url)))));
    app.get('/api/v1/scopes/:scope/station-events/:id', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Station event lookup has no query parameters');
        return c.json(await alertService().getEvent(c.get('actor'),scope(c.req.param('scope')),c.req.param('id')));
    });
    app.post('/api/v1/scopes/:scope/station-events/:id/acknowledge', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Station acknowledgement has no query parameters');
        const input=parseJson(await body(c.req.raw,1024)) as Record<string,unknown>;
        if (!input||Object.keys(input).join(',')!=='expectedRevision'||!isCounter(input.expectedRevision)) invalid('Station event expectedRevision required');
        const result=await alertService().acknowledge(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'),c.req.header('idempotency-key'),input.expectedRevision);
        return c.json(result.body,result.status);
    });
    app.get('/api/v1/scopes/:scope/audit-events', async c => {
        if (!audit) throw new ControlError('AUDIT_UNAVAILABLE', 503, 'Audit query is unavailable');
        return c.json(await audit.query(c.get('actor'),scope(c.req.param('scope')),auditQuery(nativeControlQueryParams(c.req.url))));
    });
    app.get('/api/v1/scopes/:scope/forwards/:id/diagnostics', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Forward diagnostics do not accept query parameters');
        if (!diagnostics) throw new ControlError('DIAGNOSTIC_UNAVAILABLE', 503, 'Forward diagnostics are unavailable');
        return c.json(await diagnostics.get(c.get('actor'),scope(c.req.param('scope')),c.req.param('id')));
    });
    app.get('/api/v1/scopes/:scope/forwards/:id/path-group-binding', async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Group binding lookup has no query parameters');
        return c.json(await control.pathGroups.getBinding(c.get('actor'), scope(c.req.param('scope')), c.req.param('id')));
    });
    for (const action of ['path-group-preview', 'path-group-binding'] as const) {
        const preview = action === 'path-group-preview';
        app.on(preview ? 'POST' : 'PUT', '/api/v1/scopes/:scope/forwards/:id/' + action, async c => {
            if (nativeControlQueryString(c.req.url)) invalid('Group path commands have no query parameters');
            const input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
            if (!input || typeof input !== 'object' || Array.isArray(input) ||
                Object.keys(input).sort().join(',') !== 'expectedRevision,group' || !isCounter(input.expectedRevision))
                invalid('Exact expectedRevision and group candidate required');
            if (preview) return c.json(await control.pathGroups.preview(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('id') ?? '', input.expectedRevision, input.group));
            const result = await control.forwards.applyGroup(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('id') ?? '', c.req.header('idempotency-key'), input.expectedRevision, input.group);
            return c.json(result.body, result.status);
        });
    }
    for (const binding of ['path-binding', 'tunnel-binding'] as const) app.get('/api/v1/scopes/:scope/forwards/:id/' + binding, async c => {
        if (nativeControlQueryString(c.req.url)) invalid('Path binding lookup has no query parameters');
        const owner = binding === 'tunnel-binding' ? control.tunnels.binding.bind(control.tunnels) : control.pathBindings.get.bind(control.pathBindings);
        return c.json(await owner(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('id') ?? ''));
    });
    for (const action of ['path-preview', 'path-binding', 'tunnel-preview', 'tunnel-binding'] as const) {
        const preview = action === 'path-preview' || action === 'tunnel-preview';
        app.on(preview ? 'POST' : 'PUT', '/api/v1/scopes/:scope/forwards/:id/' + action, async c => {
            if (nativeControlQueryString(c.req.url)) invalid('Path commands have no query parameters');
            const input = parseJson(await body(c.req.raw, 1024)) as Record<string, unknown>;
            if (!input || typeof input !== 'object' || Array.isArray(input) ||
                Object.keys(input).sort().join(',') !== 'expectedRevision,template' || typeof input.expectedRevision !== 'number')
                invalid('Closed expectedRevision and exact template selection required');
            if (preview) return c.json(await (action === 'tunnel-preview' ? control.tunnels.preview.bind(control.tunnels) : control.pathBindings.preview.bind(control.pathBindings))(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('id') ?? '', input.expectedRevision, input.template));
            const result = await (action === 'tunnel-binding' ? control.tunnels.apply.bind(control.tunnels) : control.forwards.applyPath.bind(control.forwards))(c.get('actor'), scope(c.req.param('scope') ?? ''), c.req.param('id') ?? '', c.req.header('idempotency-key'), input.expectedRevision, input.template);
            return c.json(result.body, result.status);
        });
    }
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
    app.get('/api/v1/scopes/:scope/forwards/:id',async c=>c.json(await control.details.forward(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'))));
    app.get('/api/v1/scopes/:scope/operations/:id',async c=>c.json(await control.details.operation(c.get('actor'),scope(c.req.param('scope')),c.req.param('id'))));
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
        if (nativeControlQueryString(c.req.url)) invalid('Probe receipt does not accept query parameters');
        return c.json(await control.probes.inspect(c.get('actor'), scope(c.req.param('scope')), c.req.param('id')));
    });
    app.post('/api/v1/scopes/:scope/probes/:id/revoke', async c => {
        const input = parseJson(await body(c.req.raw, 1024));
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length)
            invalid('Empty Probe revocation object required');
        const result = await control.probes.revoke(c.get('actor'), scope(c.req.param('scope')), c.req.param('id'));
        return c.json(nativeControlProbeWithdrawal(result));
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
    app.post('/agent/v3/probe/types/instance', async c => c.json(await control.probeTypeRegistry.handle(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeTypes('QualificationRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/types/poll', async c => c.json(await control.probeTypes.poll(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeTypes('PollRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/types/claim', async c => c.json(await control.probeTypes.claim(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeTypes('ClaimRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/types/status', async c => c.json(await control.probeTypes.status(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeTypes('StatusRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/types/result', async c => c.json(await control.probeTypes.result(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeTypes('ResultRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/services/instance', async c => c.json(await control.probeServiceRegistry.handle(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeServices('QualificationRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/services/poll', async c => c.json(await control.probeServices.poll(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeServices('PollRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/services/claim', async c => c.json(await control.probeServices.claim(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeServices('ClaimRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/services/status', async c => c.json(await control.probeServices.status(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeServices('StatusRequest',await body(c.req.raw,4096)))));
    app.post('/agent/v3/probe/services/result', async c => c.json(await control.probeServices.result(
        c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
        parseProbeServices('ResultRequest',await body(c.req.raw,4096)))));
    app.get('/agent/v3/transit/command',async c=>{
      const boot=c.req.header('x-tunex-boot-id');
      if(!boot||!isId(boot))invalid('Current Transit Boot ID header required');
      return c.json(await control.transitDelivery.poll(c.get('node'),c.get('fingerprint'),
        epoch(c.req.header('x-tunex-session-epoch')),boot));
    });
    app.post('/agent/v3/transit/report',async c=>c.json(await control.transitDelivery.report(
      c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
      parseTransitDelivery('Report',await body(c.req.raw,8192)))));
    app.post('/agent/v3/transit/hello',async c=>c.json(await control.transitNegotiation.hello(
      c.get('node'),c.get('fingerprint'),epoch(c.req.header('x-tunex-session-epoch')),
      parseTransitNegotiation('Request',await body(c.req.raw,8192)))));
    app.post('/agent/v3/hello', async (c) => c.json(await runtime.hello(c.get('node'), parseRuntimeMessage('HelloRequest', await body(c.req.raw)), c.get('fingerprint'))));
    app.get('/agent/v3/snapshot', async (c) => c.json(await runtime.snapshot(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')), c.get('fingerprint'))));
    app.post('/agent/v3/report', async (c) => c.json(await runtime.report(c.get('node'), epoch(c.req.header('x-tunex-session-epoch')), parseRuntimeMessage('ReportRequest', await body(c.req.raw)), c.get('fingerprint'))));
    return app;
}

/** Existing in-repository callers can migrate to the named composition without a flag day. */
export function createApp(control:ControlApi,runtime:RuntimeMachinePort,authority:AuthorityAdmission,
    telemetry?:ControlHttpServices['telemetry'],forwardTelemetry?:ControlHttpServices['forwardTelemetry'],
    telemetryAuthenticate?:ControlHttpServices['authenticateObservation'],hostTelemetry?:ControlHttpServices['hostTelemetry'],
    probeTelemetry?:ControlHttpServices['probeTelemetry'],telemetryRollups?:ControlHttpServices['telemetryRollups'],
    diagnostics?:ControlHttpServices['diagnostics'],audit?:ControlHttpServices['audit'],stationAlerts?:ControlHttpServices['stationAlerts'],
    notificationEndpoints?:ControlHttpServices['notificationEndpoints'],notificationDeliveries?:ControlHttpServices['notificationDeliveries'],
    probeRuns?:ControlHttpServices['probeRuns'],probePlans?:ControlHttpServices['probePlans'],observationServices?:ControlHttpServices['observationServices']) {
    return createControlApp({control,runtime,authority,services:{telemetry,forwardTelemetry,authenticateObservation:telemetryAuthenticate,
        hostTelemetry,probeTelemetry,telemetryRollups,diagnostics,audit,stationAlerts,notificationEndpoints,notificationDeliveries,
        probeRuns,probePlans,observationServices}});
}
