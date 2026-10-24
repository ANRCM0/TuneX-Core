import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, isId } from '@tunex/core';
import { parseJson } from './json.ts';
import type { ProbeClaimBinding } from './probe-claim.ts';

interface Machine {
    readonly protocolVersion: 3;
    readonly probeVersion: 1;
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly instanceId: string;
    readonly instanceGeneration: number;
    readonly requestId: string;
}
export interface ProbePollRequest extends Machine { readonly kind: 'probe-poll' }
export interface ProbeOffer {
    readonly permitId: string;
    readonly binding: ProbeClaimBinding;
    readonly timeoutMs: number;
    readonly issuedAt: string;
    readonly expiresAt: string;
}
export interface ProbePollResponse extends Machine {
    readonly kind: 'probe-poll-ack';
    readonly observedAt: string;
    readonly serverTime: string;
    readonly executionEnabled: false;
    readonly offer: ProbeOffer | null;
}
export interface ProbeStatusRequest extends Machine {
    readonly kind: 'probe-status';
    readonly permitId: string;
}
export interface ProbeStatusResponse extends Machine, ProbeOffer {
    readonly kind: 'probe-status-ack';
    readonly consumedAt: string;
    readonly checkedAt: string;
    readonly serverTime: string;
    readonly state: 'consumed';
    readonly executionEnabled: false;
}
interface Messages {
    PollRequest: ProbePollRequest;
    PollResponse: ProbePollResponse;
    StatusRequest: ProbeStatusRequest;
    StatusResponse: ProbeStatusResponse;
}
const schema = JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/probe-delivery-v1.schema.json', import.meta.url), 'utf8')) as { $id: string };
const ajv = new Ajv2020({ strict: true, allErrors: true });
const addFormats: (instance: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv); ajv.addSchema(schema);
const validators = Object.fromEntries(['PollRequest', 'PollResponse', 'StatusRequest', 'StatusResponse'].map(name =>
    [name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })]));
function offerValid(machine: Machine, offer: ProbeOffer, observed: number): boolean {
    const b = offer.binding, issued = Date.parse(offer.issuedAt), expires = Date.parse(offer.expiresAt);
    return [offer.permitId, b.nodeId, b.bootId, b.assignmentId, b.forwardId].every(isId) &&
        b.nodeId === machine.nodeId && b.bootId === machine.bootId && b.sessionEpoch === machine.sessionEpoch &&
        issued >= 0 && issued <= observed && observed < expires && expires > issued && expires - issued <= 2000;
}
function valid(value: Messages[keyof Messages]): boolean {
    if (![value.nodeId, value.bootId].every(isId) || 'permitId' in value && !isId(value.permitId)) return false;
    if (value.kind === 'probe-poll' || value.kind === 'probe-status') return true;
    const observed = Date.parse(value.kind === 'probe-poll-ack' ? value.observedAt : value.checkedAt);
    const server = Date.parse(value.serverTime);
    // A fresh point-in-time observation, not a lease. Consumers must also bound end-to-end elapsed time.
    if (observed < 0 || server < observed || server - observed > 250) return false;
    if (value.kind === 'probe-poll-ack') return value.offer === null ||
        offerValid(value, value.offer, observed) && server < Date.parse(value.offer.expiresAt);
    const consumed = Date.parse(value.consumedAt);
    return offerValid(value, value, observed) && consumed >= Date.parse(value.issuedAt) && consumed <= observed &&
        server < Date.parse(value.expiresAt);
}
export function parseProbeDelivery<K extends keyof Messages>(name: K, raw: string): Messages[K] {
    const value = parseJson(raw, 4096);
    if (!validators[name]?.(value) || !valid(value as Messages[K]))
        throw new Error('INVALID_CONFIG: Unsupported Probe delivery observation');
    return deepFreeze(value) as Messages[K];
}
function echo(request: Machine, response: Machine): void {
    if (request.nodeId !== response.nodeId || request.bootId !== response.bootId || request.sessionEpoch !== response.sessionEpoch ||
        request.instanceId !== response.instanceId || request.instanceGeneration !== response.instanceGeneration || request.requestId !== response.requestId)
        throw new Error('AUTHORIZATION_DENIED: Probe delivery response differs');
}
export function checkProbePoll(request: ProbePollRequest, response: ProbePollResponse): void {
    echo(parseProbeDelivery('PollRequest', JSON.stringify(request)), parseProbeDelivery('PollResponse', JSON.stringify(response)));
}
export function checkProbeStatus(request: ProbeStatusRequest, response: ProbeStatusResponse): void {
    const req = parseProbeDelivery('StatusRequest', JSON.stringify(request)), ack = parseProbeDelivery('StatusResponse', JSON.stringify(response));
    echo(req, ack);
    if (req.permitId !== ack.permitId) throw new Error('AUTHORIZATION_DENIED: Probe status permit differs');
}
