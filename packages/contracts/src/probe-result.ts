import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, isId } from '@tunex/core';
import { parseJson } from './json.ts';
import { digest } from './digest.ts';
import type { ProbeClaimBinding } from './probe-claim.ts';

interface Machine {
    readonly protocolVersion: 3;
    readonly probeVersion: 1;
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly instanceId: string;
    readonly instanceGeneration: number;
    readonly permitId: string;
    readonly requestId: string;
}
export interface ProbeResultRequest extends Machine {
    readonly kind: 'probe-result';
    readonly binding: ProbeClaimBinding;
    readonly timeoutMs: number;
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly consumedAt: string;
    readonly measuredAt: string;
    readonly validUntil: string;
    readonly elapsedMs: number;
    readonly point: 'agent-direct-egress';
    readonly status: 'connected' | 'unreachable';
    readonly code: 'tcp-connected' | 'tcp-connect-failed';
    readonly applicationHealth: 'unknown';
    readonly source: 'agent-reported';
    readonly applicationPayloadBytes: 0;
}
export type ProbeResultBody = Omit<ProbeResultRequest, 'requestId'>;
export interface ProbeResultResponse extends Machine {
    readonly kind: 'probe-result-ack';
    readonly resultDigest: string;
    readonly acceptedAt: string;
    readonly serverTime: string;
    readonly duplicate: boolean;
    readonly health: 'unknown';
    readonly executionEnabled: false;
}
interface Messages { Request: ProbeResultRequest; Response: ProbeResultResponse }
const schema = JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/probe-result-v1.schema.json', import.meta.url), 'utf8')) as { $id: string };
const ajv = new Ajv2020({ strict: true, allErrors: true });
const addFormats: (instance: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv); ajv.addSchema(schema);
const validators = Object.fromEntries(['Request', 'Response'].map(name => [name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })]));
export function parseProbeResult<K extends keyof Messages>(name: K, raw: string): Messages[K] {
    const value = parseJson(raw, 4096) as Messages[K];
    if (!validators[name]?.(value) || ![value.nodeId, value.bootId, value.permitId].every(isId))
        throw new Error('INVALID_CONFIG: Unsupported Probe result');
    if (value.kind === 'probe-result') {
        const b = value.binding, issued = Date.parse(value.issuedAt), expires = Date.parse(value.expiresAt), consumed = Date.parse(value.consumedAt);
        const measured = Date.parse(value.measuredAt), until = Date.parse(value.validUntil);
        if (![b.nodeId, b.bootId, b.forwardId, b.assignmentId].every(isId) || b.nodeId !== value.nodeId || b.bootId !== value.bootId ||
            b.sessionEpoch !== value.sessionEpoch || issued < 0 || consumed < issued || measured < consumed || until <= measured ||
            until > expires || expires - issued > 2000 || value.elapsedMs > value.timeoutMs ||
            (value.status === 'connected') !== (value.code === 'tcp-connected'))
            throw new Error('INVALID_CONFIG: Probe result binding, time or status differs');
    } else if (Date.parse(value.acceptedAt) < 0 || Date.parse(value.serverTime) < Date.parse(value.acceptedAt)) {
        throw new Error('INVALID_CONFIG: Probe result acknowledgement time differs');
    }
    return deepFreeze(value);
}
export function probeResultBody(input: ProbeResultRequest): ProbeResultBody {
    const { requestId: _, ...body } = parseProbeResult('Request', JSON.stringify(input));
    return deepFreeze(body);
}
export function probeResultDigest(input: ProbeResultRequest): string { return digest(probeResultBody(input)); }
export function checkProbeResult(input: ProbeResultRequest, output: ProbeResultResponse): void {
    const req = parseProbeResult('Request', JSON.stringify(input)), ack = parseProbeResult('Response', JSON.stringify(output));
    if (req.nodeId !== ack.nodeId || req.bootId !== ack.bootId || req.sessionEpoch !== ack.sessionEpoch ||
        req.instanceId !== ack.instanceId || req.instanceGeneration !== ack.instanceGeneration || req.permitId !== ack.permitId ||
        req.requestId !== ack.requestId || probeResultDigest(req) !== ack.resultDigest ||
        Date.parse(ack.acceptedAt) < Date.parse(req.measuredAt) || Date.parse(ack.acceptedAt) >= Date.parse(req.validUntil) ||
        Date.parse(ack.serverTime) >= Date.parse(req.validUntil))
        throw new Error('AUTHORIZATION_DENIED: Probe result acknowledgement differs');
}
