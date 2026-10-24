import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, normalizeIp, normalizeTargetHost } from '@tunex/core';
import { compareTimes } from './time.ts';
import { parseJson } from './json.ts';
import { validCidr } from './validate.ts';

export interface TransitNeighbor {
 readonly nodeId: string;
 readonly assignmentId: string;
 readonly sessionEpoch: number;
 readonly bindingFence: number;
 readonly peerFingerprint: string;
}
export interface TransitEndpoint { readonly host: string; readonly port: number }
export interface TransitIntent {
 readonly contractVersion: 1; readonly role: 'relay-transit';
 readonly driver: 'native.transit.v1'; readonly security: 'mutual-tls13';
 readonly scopeId: string; readonly forwardId: string; readonly forwardRevision: number;
 readonly deploymentGeneration: number; readonly profileId: string; readonly profileRevision: number;
 readonly profileDigest: string; readonly pathDigest: string;
 readonly nodeId: string; readonly assignmentId: string; readonly sessionEpoch: number; readonly bindingFence: number;
 readonly protocol: 'tcp' | 'udp'; readonly hopIndex: number; readonly hopCount: number;
 readonly listener: { readonly address: string; readonly port: number; readonly protocol: 'tcp' };
 readonly upstream: TransitNeighbor;
 readonly downstream: TransitNeighbor & { readonly endpoint: TransitEndpoint };
 readonly issuedAt: string; readonly authorizationUntil: string;
 readonly egressPolicyRevision: number; readonly allowedDestinationCidrs: readonly string[];
 readonly allowMetadataTargets: boolean; readonly maxConnections: number;
}
const schema = JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/transit-v1.schema.json', import.meta.url), 'utf8'));
const fullStringRegExp = Object.assign((pattern: string, flags: string) => new RegExp(pattern.endsWith('$') ? `${pattern.slice(0, -1)}$(?![\\s\\S])` : pattern, flags), {code:'fullStringRegExp'});
const ajv = new Ajv2020({strict: true, allErrors: true, code: {regExp: fullStringRegExp}});
const addFormats: (a: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv);
ajv.addSchema(schema);
const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/TransitIntent` });

/** Parse a proposed Transit hop WITHOUT approving execution or minting authority.
 * This contract MUST NOT be accepted by the deployed ADP/3 Snapshot parser.
 */
export function parseTransitIntent(raw: string): TransitIntent {
 const candidate = parseJson(raw, 16384);
 if (!validate(candidate)) throw new Error('INVALID_CONFIG: Transit contract rejected');
 const v = candidate as TransitIntent;
 if (v.hopIndex >= v.hopCount - 1) throw new Error('INVALID_CONFIG: Transit position cannot be an endpoint');
 const nodes = [v.upstream.nodeId, v.nodeId, v.downstream.nodeId];
 const assignments = [v.upstream.assignmentId, v.assignmentId, v.downstream.assignmentId];
 if (new Set(nodes).size !== 3 || new Set(assignments).size !== 3 || v.upstream.peerFingerprint === v.downstream.peerFingerprint) {
  throw new Error('AUTHORIZATION_DENIED: Transit must bind two distinct neighboring identities');
 }
 if (compareTimes(v.issuedAt, v.authorizationUntil) >= 0) throw new Error('INVALID_CONFIG: Transit authorization time range');
 if (normalizeIp(v.listener.address) !== v.listener.address || normalizeTargetHost(v.downstream.endpoint.host) !== v.downstream.endpoint.host) {
  throw new Error('INVALID_CONFIG: Noncanonical Transit endpoint');
 }
 if (v.allowedDestinationCidrs.some((cidr, i) => !validCidr(cidr) || (i > 0 && v.allowedDestinationCidrs[i - 1]! >= cidr))) {
  throw new Error('INVALID_CONFIG: Canonical sorted destination CIDRs required');
 }
 return deepFreeze(v);
}
