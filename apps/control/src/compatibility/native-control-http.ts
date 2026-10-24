import { readFile } from 'node:fs/promises';
import { TLSSocket } from 'node:tls';
import { isCounter } from '@tunex/core';
import { ControlError, invalid } from '../framework/public.ts';
import { decodeUtf8Chunks } from './native-http-codecs.ts';
import { nativeIsoTime } from './native-module-values.ts';

export function nativeControlSessionEpoch(value: string | undefined): number {
    if (!value || !/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value)))
        throw new ControlError('SESSION_SUPERSEDED', 409, 'Valid session header required');
    return Number(value);
}

export function nativeControlConsoleHeaders(c: { header: (name: string, value: string) => void }) {
    c.header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
}

export function nativeControlProbeWithdrawal<State>(result: { readonly id: string; readonly state: State }) {
    return { probeId: result.id, state: result.state, executionEnabled: false as const,
        withdrawnAt: 'withdrawnAt' in result && typeof result.withdrawnAt === 'number' ? nativeIsoTime(result.withdrawnAt) : null };
}

export function nativeControlClientFingerprint(socket: unknown): string {
    if (!(socket instanceof TLSSocket) || !socket.authorized)
        throw new ControlError('UNAUTHENTICATED', 401, 'Verified Node client certificate required');
    const certificate = socket.getPeerCertificate();
    if (!certificate.fingerprint256)
        throw new ControlError('UNAUTHENTICATED', 401, 'Node certificate required');
    return certificate.fingerprint256.replaceAll(':', '').toLowerCase();
}

export async function nativeControlRequestBody(request: Request, limit = 1048576): Promise<string> {
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
    return decodeUtf8Chunks(chunks);
}

export function nativeControlRequestError(error: Error): ControlError {
    const code = error.message.split(':')[0]!;
    const statuses: Record<string, ControlError['status']> = { INVALID_CONFIG: 422, RESOURCE_LIMIT: 429, INTEGRITY_FAILURE: 409, AUTHORIZATION_DENIED: 403, UNSUPPORTED_CAPABILITY: 409, RESOURCE_CONFLICT: 409, FENCING_REJECTED: 409, LEASE_EXPIRED: 409 };
    return error instanceof ControlError ? error : error instanceof SyntaxError || error instanceof TypeError ? new ControlError('INVALID_CONFIG', 400, 'Malformed JSON request') : statuses[code] ? new ControlError(code, statuses[code], 'Request violates Node or deployment policy') : new ControlError('INTERNAL_ERROR', 503, 'Control request failed', true);
}

export type NativeControlConsoleAsset = 'index.html' | 'app.js' | 'model.js' | 'relay-model.js' | 'relay.js' |
    'console-model-owner/public.js' | 'console-model-owner/service.js' | 'browser-native/public.js' |
    'console-request-owner/public.js' | 'console-request-owner/service.js' |
    'rule-command-owner/public.js' | 'rule-command-owner/service.js' | 'browser-native/rule-console.js' |
    'browser-native/control-console.js' |
    'browser-native/relay-forms.js' | 'browser-native/relay-console.js' |
    'account-context.js' | 'account-credentials.js' | 'task-workflow.js' | 'line-builder.js' | 'template-reference.js' | 'admin-resource-console.js' | 'resource-limit-console.js' | 'member-console.js' |
    'probe.js' | 'transport-console.js' | 'rule-console.js' | 'tunnel-console.js' | 'path-templates.js' |
    'observation-services.js' | 'path-groups.js' | 'path-publications.js' | 'ingress-groups.js' |
    'ingress-migrations.js' | 'forward-diagnostics.js' | 'forward-status.js' | 'forward-preflight.js' |
    'audit-console.js' | 'station-alerts.js' |
    'notification-endpoints.js' | 'notification-deliveries.js' | 'probe-runs.js' | 'probe-plans.js' |
    'telemetry-console.js' | 'forward-telemetry-console.js' | 'host-telemetry-console.js' |
    'probe-telemetry-console.js' | 'telemetry-aggregate-console.js' | 'style.css';

export function nativeControlConsoleAsset(asset: NativeControlConsoleAsset): Promise<string> {
    return readFile(new URL('../../../web/' + asset, import.meta.url), 'utf8');
}
