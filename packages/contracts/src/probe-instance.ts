import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, isId } from '@tunex/core';
import { parseJson } from './json.ts';

export interface ProbeInstanceRequest {
    readonly protocolVersion: 3;
    readonly probeVersion: 1;
    readonly kind: 'probe-instance';
    readonly action: 'inspect' | 'register' | 'revoke';
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly instanceId: string;
    readonly expectedGeneration: number;
}
export interface ProbeInstanceResponse extends Omit<ProbeInstanceRequest, 'kind'> {
    readonly kind: 'probe-instance-ack';
    readonly generation: number;
    readonly state: 'absent' | 'registered' | 'stale' | 'revoked' | 'quarantined';
    readonly currentInstanceId: string | null;
    readonly registeredAt: string | null;
    readonly expiresAt: string | null;
    readonly serverTime: string;
    readonly executionEnabled: false;
}
interface Messages { Request: ProbeInstanceRequest; Response: ProbeInstanceResponse }
const schema = JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/probe-instance-v1.schema.json', import.meta.url), 'utf8')) as { $id: string };
const ajv = new Ajv2020({ strict: true, allErrors: true });
const addFormats: (instance: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv); ajv.addSchema(schema);
const validators = { Request: ajv.compile({ $ref: `${schema.$id}#/$defs/Request` }),
    Response: ajv.compile({ $ref: `${schema.$id}#/$defs/Response` }) };
function valid(value: ProbeInstanceRequest | ProbeInstanceResponse): boolean {
    if (!isId(value.nodeId) || !isId(value.bootId) || value.action === 'inspect' && value.expectedGeneration !== 0) return false;
    if (value.kind === 'probe-instance') return true;
    const absent = value.state === 'absent';
    if (absent !== (value.generation === 0) || absent !== (value.currentInstanceId === null) ||
        absent !== (value.registeredAt === null) || absent !== (value.expiresAt === null)) return false;
    if (!absent) {
        const duration = Date.parse(value.expiresAt!) - Date.parse(value.registeredAt!);
        if (!(duration > 0 && duration <= 30000)) return false;
    }
    if (value.action === 'register' && (value.state !== 'registered' ||
        value.generation !== value.expectedGeneration + 1 || value.currentInstanceId !== value.instanceId)) return false;
    if (value.action === 'revoke' && (!['revoked', 'quarantined'].includes(value.state) ||
        value.generation !== value.expectedGeneration || value.currentInstanceId !== value.instanceId)) return false;
    return true;
}
export function parseProbeInstance<K extends keyof Messages>(name: K, raw: string): Messages[K] {
    const value = parseJson(raw, 4096);
    if (!validators[name]?.(value) || !valid(value as Messages[K]))
        throw new Error('INVALID_CONFIG: Unsupported Probe instance contract');
    return deepFreeze(value) as Messages[K];
}
export function checkProbeInstance(request: ProbeInstanceRequest, response: ProbeInstanceResponse): void {
    const req = parseProbeInstance('Request', JSON.stringify(request)), ack = parseProbeInstance('Response', JSON.stringify(response));
    if (req.nodeId !== ack.nodeId || req.bootId !== ack.bootId || req.sessionEpoch !== ack.sessionEpoch ||
        req.action !== ack.action || req.instanceId !== ack.instanceId || req.expectedGeneration !== ack.expectedGeneration)
        throw new Error('AUTHORIZATION_DENIED: Probe instance response differs');
}
