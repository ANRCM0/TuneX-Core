import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { deepFreeze, normalizeIp } from '@tunex/core';
import { compareTimes } from './time.ts';
import { digest } from './digest.ts';
import { parseJson } from './json.ts';
import { parseTransitIntent } from './transit.ts';
import type { TransitIntent } from './transit.ts';

/** Offline ADP/3 Transit extension v1. NOT accepted by the deployed Runtime parser. */
export const TRANSIT_ADP_CAPABILITIES = [
  'adp.multihop.1', 'transit.wire.1', 'native.transit.v1',
] as const;

export interface TransitAdpAssignment {
  readonly protocolVersion: 3;
  readonly extensionVersion: 1;
  readonly nodeId: string;
  readonly sessionEpoch: number;
  readonly assignmentId: string;
  readonly forwardId: string;
  readonly forwardRevision: number;
  readonly deploymentGeneration: number;
  readonly bindingFence: number;
  readonly role: 'relay-transit';
  readonly protocol: 'tcp' | 'udp';
  readonly phase: 'prepared' | 'active' | 'draining';
  readonly resource: { readonly address: string; readonly port: number; readonly protocol: 'tcp' };
  readonly driver: {
    readonly id: 'native.transit.v1'; readonly schemaVersion: 1;
    readonly configDigest: string;
    readonly config: { readonly intent: TransitIntent };
  };
  readonly drainTimeoutSeconds: number;
}
export interface TransitAdpTombstone {
  readonly assignmentId: string; readonly forwardId: string;
  readonly role: 'relay-transit'; readonly protocol: 'tcp' | 'udp';
  readonly physicalProtocol: 'tcp'; readonly port: number;
  readonly bindingFence: number; readonly retirementGeneration: number;
}
export interface TransitAdpSnapshot {
  readonly protocolVersion: 3; readonly extensionVersion: 1;
  readonly kind: 'transit-snapshot';
  readonly requiredCapabilities: readonly ['adp.multihop.1', 'transit.wire.1', 'native.transit.v1'];
  readonly nodeId: string; readonly sessionEpoch: number;
  readonly snapshotGeneration: number; readonly complete: true;
  readonly issuedAt: string; readonly validUntil: string;
  readonly snapshotDigest: string;
  readonly assignments: readonly TransitAdpAssignment[];
  readonly tombstones: readonly TransitAdpTombstone[];
}

const schema = JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/adp-v3-transit.schema.json', import.meta.url), 'utf8')) as {$id: string};
const fullStringRegExp = Object.assign(
  (pattern: string, flags: string) => new RegExp(pattern.endsWith('$') ? `${pattern.slice(0, -1)}$(?![\\s\\S])` : pattern, flags),
  {code: 'fullStringRegExp'});
const ajv = new Ajv2020({strict: true, allErrors: true, code: {regExp: fullStringRegExp}});
const addFormats: (instance: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv);
ajv.addSchema(schema);
const validators = new Map<string, ValidateFunction>();
for (const name of ['Assignment', 'Snapshot'] as const)
  validators.set(name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`}));

function deny(code: string, message: string): never { throw new Error(`${code}: ${message}`); }

export function requireTransitAdpCapabilities(advertised: readonly string[]): void {
  if (TRANSIT_ADP_CAPABILITIES.some(capability => !advertised.includes(capability)))
    deny('UNSUPPORTED_CAPABILITY', 'Versioned Transit ADP/3 capabilities not advertised');
}
function validateAssignment(assignment: TransitAdpAssignment): void {
  const intent = parseTransitIntent(JSON.stringify(assignment.driver.config.intent));
  if (digest(assignment.driver.config) !== assignment.driver.configDigest)
    deny('INTEGRITY_FAILURE', 'Transit driver config digest differs');
  if (assignment.nodeId !== intent.nodeId ||
      assignment.sessionEpoch !== intent.sessionEpoch ||
      assignment.assignmentId !== intent.assignmentId ||
      assignment.forwardId !== intent.forwardId ||
      assignment.forwardRevision !== intent.forwardRevision ||
      assignment.deploymentGeneration !== intent.deploymentGeneration ||
      assignment.bindingFence !== intent.bindingFence ||
      assignment.protocol !== intent.protocol)
    deny('AUTHORIZATION_DENIED', 'Transit Assignment/Intent binding differs');
  if (assignment.resource.protocol !== 'tcp' ||
      assignment.resource.address !== intent.listener.address ||
      assignment.resource.port !== intent.listener.port ||
      normalizeIp(assignment.resource.address) !== assignment.resource.address)
    deny('RESOURCE_CONFLICT', 'Transit physical TLS listener differs');
}
/** Structural and semantic validation only: never creates a runtime authorization. */
export function parseTransitAdpAssignment(raw: string): TransitAdpAssignment {
  const value = parseJson(raw, 16384);
  if (!validators.get('Assignment')!(value))
    deny('INVALID_CONFIG', 'Versioned Transit Assignment structure rejected');
  const assignment = value as TransitAdpAssignment;
  validateAssignment(assignment);
  return deepFreeze(assignment);
}
function tombstoneOrder(a: TransitAdpTombstone, b: TransitAdpTombstone): number {
  return a.physicalProtocol.localeCompare(b.physicalProtocol) ||
    a.port - b.port || a.retirementGeneration - b.retirementGeneration ||
    a.assignmentId.localeCompare(b.assignmentId);
}
/** A dedicated offline envelope. The existing ADP/3 Runtime Snapshot stays fail-closed. */
export function parseTransitAdpSnapshot(raw: string): TransitAdpSnapshot {
  const value = parseJson(raw, 4194304);
  if (!validators.get('Snapshot')!(value))
    deny('INVALID_CONFIG', 'Versioned Transit Snapshot structure rejected');
  const snapshot = value as TransitAdpSnapshot;
  if (compareTimes(snapshot.issuedAt, snapshot.validUntil) >= 0)
    deny('INVALID_CONFIG', 'Transit Snapshot time range');
  const {snapshotDigest, ...body} = snapshot;
  if (digest(body) !== snapshotDigest)
    deny('INTEGRITY_FAILURE', 'Transit Snapshot digest differs');
  let previous = '';
  const logical = new Set<string>(), physical = new Set<string>();
  for (const a of snapshot.assignments) {
    validateAssignment(a);
    if (a.nodeId !== snapshot.nodeId || a.sessionEpoch !== snapshot.sessionEpoch ||
        compareTimes(snapshot.issuedAt, a.driver.config.intent.issuedAt) < 0 ||
        compareTimes(snapshot.validUntil, a.driver.config.intent.authorizationUntil) > 0)
      deny('AUTHORIZATION_DENIED', 'Transit Snapshot Node/Session/lease differs');
    const logicalKey = `${a.forwardId}/${a.protocol}`;
    const physicalKey = `tcp/${a.resource.port}`;
    if (a.assignmentId <= previous || logical.has(logicalKey) || physical.has(physicalKey))
      deny('RESOURCE_CONFLICT', 'Duplicate, unsorted or overlapping Transit resource');
    previous = a.assignmentId; logical.add(logicalKey); physical.add(physicalKey);
  }
  let prior: TransitAdpTombstone | undefined;
  const retired = new Set<string>();
  for (const t of snapshot.tombstones) {
    const key = `tcp/${t.port}/${t.bindingFence}`;
    if (retired.has(key) || t.retirementGeneration > snapshot.snapshotGeneration ||
        (prior && tombstoneOrder(prior, t) >= 0))
      deny('INVALID_CONFIG', 'Transit retirement order or high-water differs');
    if (snapshot.assignments.some(a => a.resource.port === t.port && a.bindingFence <= t.bindingFence))
      deny('FENCING_REJECTED', 'Transit retirement fence resurrected');
    retired.add(key); prior = t;
  }
  return deepFreeze(snapshot);
}
