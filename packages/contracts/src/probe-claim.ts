import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, isId } from '@tunex/core';
import { parseJson } from './json.ts';

export interface ProbeClaimBinding {
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly snapshotGeneration: number;
    readonly assignmentId: string;
    readonly forwardId: string;
    readonly forwardRevision: number;
    readonly deploymentGeneration: number;
    readonly bindingFence: number;
    readonly configDigest: string;
    readonly egressPolicyRevision: number;
}
export interface ProbeClaimRequest {
    readonly protocolVersion: 3;
    readonly probeVersion: 1;
    readonly kind: 'probe-claim';
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly instanceId: string;
    readonly instanceGeneration: number;
    readonly permitId: string;
}
export interface ProbeClaimResponse extends Omit<ProbeClaimRequest, 'kind'> {
    readonly kind: 'probe-claim-ack';
    readonly binding: ProbeClaimBinding;
    readonly timeoutMs: number;
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly consumedAt: string;
    readonly serverTime: string;
    readonly state: 'consumed';
    readonly executionEnabled: false;
}
interface Messages { Request: ProbeClaimRequest; Response: ProbeClaimResponse }
const schema = JSON.parse(readFileSync(new URL('../../../docs/protocol/schemas/probe-claim-v1.schema.json', import.meta.url), 'utf8')) as { $id: string };
const ajv = new Ajv2020({ strict: true, allErrors: true });
const addFormats: (instance: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv); ajv.addSchema(schema);
const validators = { Request: ajv.compile({ $ref: `${schema.$id}#/$defs/Request` }),
    Response: ajv.compile({ $ref: `${schema.$id}#/$defs/Response` }) };
function valid(value: ProbeClaimRequest | ProbeClaimResponse): boolean {
    if (![value.nodeId, value.bootId, value.permitId].every(isId)) return false;
    if (value.kind === 'probe-claim') return true;
    const b = value.binding;
    if (![b.nodeId, b.bootId, b.assignmentId, b.forwardId].every(isId) ||
        b.nodeId !== value.nodeId || b.bootId !== value.bootId || b.sessionEpoch !== value.sessionEpoch) return false;
    const issued = Date.parse(value.issuedAt), expires = Date.parse(value.expiresAt),
        consumed = Date.parse(value.consumedAt), server = Date.parse(value.serverTime);
    return issued >= 0 && expires > issued && expires - issued <= 2000 &&
        consumed >= issued && consumed <= server && server < expires;
}
export function parseProbeClaim<K extends keyof Messages>(name: K, raw: string): Messages[K] {
    const value = parseJson(raw, 4096);
    if (!validators[name]?.(value) || !valid(value as Messages[K]))
        throw new Error('INVALID_CONFIG: Unsupported Probe claim receipt');
    return deepFreeze(value) as Messages[K];
}
export function checkProbeClaim(request: ProbeClaimRequest, response: ProbeClaimResponse): void {
    const req = parseProbeClaim('Request', JSON.stringify(request)), ack = parseProbeClaim('Response', JSON.stringify(response));
    if (req.nodeId !== ack.nodeId || req.bootId !== ack.bootId || req.sessionEpoch !== ack.sessionEpoch ||
        req.instanceId !== ack.instanceId || req.instanceGeneration !== ack.instanceGeneration || req.permitId !== ack.permitId)
        throw new Error('AUTHORIZATION_DENIED: Probe claim response differs');
}
