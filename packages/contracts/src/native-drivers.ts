import { readFileSync } from 'node:fs';
import { deepFreeze } from '@tunex/core';
import { parseJson } from './json.ts';
import { digest } from './digest.ts';

export interface NativeDriverDescriptor {
    readonly id: 'native.direct.v1' | 'native.relay.v1' | 'native.multihop.v1';
    readonly descriptorRevision: 1;
    readonly assignmentSchemaVersion: 1;
    readonly schemaId: string;
    readonly platforms: readonly ('linux' | 'windows')[];
    readonly roles: readonly string[];
    readonly phases: readonly string[];
    readonly businessProtocols: readonly ('tcp' | 'udp')[];
    readonly carrierByProtocol: Readonly<{ tcp: 'tcp'; udp: 'tcp' | 'udp' }>;
    readonly advertisedCapabilities: readonly string[];
    readonly requiredCapabilities: readonly string[];
    readonly agentFlags: readonly string[];
    readonly controlGate: 'none' | 'multihop';
    readonly security: 'not-added-by-driver' | 'mutual-tls13';
    readonly privileges: Readonly<{ networkAdmin: false; rootForUnprivilegedPorts: false; lowPorts: 'os-policy' }>;
    readonly limitSources: readonly string[];
    readonly prepare: 'active-only' | 'tail-to-head';
    readonly drain: 'bounded-authorization-clipped';
    readonly probe: 'direct-egress-tcp-opt-in' | 'unsupported';
    readonly usage: 'not-reported';
}
export interface NativeDriverCatalog { readonly version: 1; readonly drivers: readonly NativeDriverDescriptor[] }
const ids = ['native.direct.v1', 'native.relay.v1', 'native.multihop.v1'];
const fields = ['id', 'descriptorRevision', 'assignmentSchemaVersion', 'schemaId', 'platforms', 'roles', 'phases', 'businessProtocols',
    'carrierByProtocol', 'advertisedCapabilities', 'requiredCapabilities', 'agentFlags', 'controlGate', 'security', 'privileges',
    'limitSources', 'prepare', 'drain', 'probe', 'usage'];
function closed(value: unknown, keys: string[]): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k)));
}
function strings(value: unknown, allowed?: readonly string[], empty = false): value is string[] {
    return Array.isArray(value) && value.length >= (empty ? 0 : 1) && value.length <= 16 && new Set(value).size === value.length &&
        value.every(v => typeof v === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(v.replace(/^--/, '')) && (!allowed || allowed.includes(v)));
}
/** A closed declaration of built-ins, not dynamic registration or an executable ADP message. */
export function parseNativeDriverCatalog(raw: string): NativeDriverCatalog {
    const value = parseJson(raw, 32768);
    if (!closed(value, ['version', 'drivers']) || value.version !== 1 || !Array.isArray(value.drivers) || value.drivers.length !== 3)
        throw Error('INVALID_CONFIG: Native driver catalog v1 required');
    const seen = new Set();
    for (const item of value.drivers) {
        if (!closed(item, fields) || !ids.includes(String(item.id)) || seen.has(item.id) || item.descriptorRevision !== 1 || item.assignmentSchemaVersion !== 1 ||
            !['urn:tunex:adp:3:runtime', 'urn:tunex:adp:3:relay', 'urn:tunex:adp:3:execution:1'].includes(String(item.schemaId)) ||
            !strings(item.platforms, ['linux', 'windows']) || !strings(item.roles, ['direct', 'relay-ingress', 'relay-egress', 'multihop-ingress', 'multihop-transit', 'multihop-egress']) ||
            !strings(item.phases, ['active', 'prepared', 'draining']) || !strings(item.businessProtocols, ['tcp', 'udp']) ||
            !closed(item.carrierByProtocol, ['tcp', 'udp']) || item.carrierByProtocol.tcp !== 'tcp' || !['tcp', 'udp'].includes(String(item.carrierByProtocol.udp)) ||
            !strings(item.advertisedCapabilities) || !item.advertisedCapabilities.includes(item.id as string) ||
            !strings(item.requiredCapabilities) || !item.requiredCapabilities.includes('adp.3') || !item.requiredCapabilities.includes(item.id as string) ||
            !strings(item.agentFlags, ['--relay', '--multihop'], true) || !['none', 'multihop'].includes(String(item.controlGate)) ||
            !['not-added-by-driver', 'mutual-tls13'].includes(String(item.security)) || !closed(item.privileges, ['networkAdmin', 'rootForUnprivilegedPorts', 'lowPorts']) ||
            item.privileges.networkAdmin !== false || item.privileges.rootForUnprivilegedPorts !== false || item.privileges.lowPorts !== 'os-policy' ||
            !strings(item.limitSources) || !['active-only', 'tail-to-head'].includes(String(item.prepare)) || item.drain !== 'bounded-authorization-clipped' ||
            !['direct-egress-tcp-opt-in', 'unsupported'].includes(String(item.probe)) || item.usage !== 'not-reported')
            throw Error('INVALID_CONFIG: Closed native driver descriptor required');
        seen.add(item.id);
    }
    return deepFreeze(value) as unknown as NativeDriverCatalog;
}
export const NATIVE_DRIVER_CATALOG = parseNativeDriverCatalog(readFileSync(new URL('../data/native-drivers-v1.json', import.meta.url), 'utf8'));
export const NATIVE_DRIVER_CATALOG_DIGEST = digest(NATIVE_DRIVER_CATALOG);
