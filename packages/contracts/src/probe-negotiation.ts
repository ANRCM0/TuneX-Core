import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, isId } from '@tunex/core';
import { parseJson } from './json.ts';

export interface ProbeNegotiationRequest {
    readonly protocolVersion: 3;
    readonly probeVersion: 1;
    readonly kind: 'probe-hello';
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly instanceId: string;
    readonly capability: 'probe.tcp-connect.v1';
    readonly point: 'agent-direct-egress';
    readonly maxTimeoutMs: 2000;
    readonly maxAttempts: 1;
    readonly applicationPayloadBytes: 0;
}
export interface ProbeNegotiationResponse extends Omit<ProbeNegotiationRequest, 'kind'> {
    readonly kind: 'probe-hello-ack';
    readonly serverTime: string;
    readonly state: 'contract-only';
    readonly executionEnabled: false;
}
interface Messages { Request: ProbeNegotiationRequest; Response: ProbeNegotiationResponse }
const schema = JSON.parse(readFileSync(new URL('../../../docs/protocol/schemas/probe-negotiation-v1.schema.json',
    import.meta.url), 'utf8')) as { $id: string };
const ajv = new Ajv2020({ strict: true, allErrors: true });
const addFormats: (instance: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv); ajv.addSchema(schema);
const validators = {
    Request: ajv.compile({ $ref: `${schema.$id}#/$defs/Request` }),
    Response: ajv.compile({ $ref: `${schema.$id}#/$defs/Response` }),
};
export function parseProbeNegotiation<K extends keyof Messages>(name: K, raw: string): Messages[K] {
    const value = parseJson(raw, 4096);
    if (!validators[name]?.(value) || !isId((value as Messages[K]).nodeId) || !isId((value as Messages[K]).bootId))
        throw new Error('INVALID_CONFIG: Unsupported Probe negotiation contract');
    return deepFreeze(value) as Messages[K];
}
/** Session-bound recognition only; this function cannot issue or validate a Probe permit. */
export function checkProbeNegotiation(request: ProbeNegotiationRequest, response: ProbeNegotiationResponse): void {
    const req = parseProbeNegotiation('Request', JSON.stringify(request));
    const ack = parseProbeNegotiation('Response', JSON.stringify(response));
    if (req.nodeId !== ack.nodeId || req.bootId !== ack.bootId || req.sessionEpoch !== ack.sessionEpoch ||
        req.instanceId !== ack.instanceId)
        throw new Error('AUTHORIZATION_DENIED: Probe negotiation identity differs');
}
