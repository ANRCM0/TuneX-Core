import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { deepFreeze, ipBytes, normalizeTargetHost } from '@tunex/core';
import { digest } from './digest.ts';
import { parseJson } from './json.ts';
import { compareTimes, validateTime } from './time.ts';
import type { Messages, Policy, Snapshot } from './types.ts';

const schema = JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/adp-v2-direct.schema.json', import.meta.url), 'utf8')) as { $id: string };
// Domain scalars require full-string matches. JS "$" otherwise accepts a final newline; Go rejects it.
const fullStringRegExp = Object.assign((pattern: string, flags: string) => new RegExp(pattern.endsWith('$') ? `${pattern.slice(0, -1)}$(?![\\s\\S])` : pattern, flags), { code: 'fullStringRegExp' });
const ajv = new Ajv2020({ strict: true, allErrors: true, code: { regExp: fullStringRegExp } });
const addFormats: (instance: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
addFormats(ajv);
ajv.addSchema(schema);
const validators = new Map<string, ValidateFunction>();
const names = ['HelloRequest', 'HelloResponse', 'Snapshot', 'ReportRequest', 'ReportAck', 'ErrorResponse'] as const;
for (const name of names) validators.set(name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` }));
function fail(code: string, message: string): never { throw new Error(`${code}: ${message}`); }
/** Validate canonical CIDR network text. Policy resolution and enforcement at dial time remain separate. */
export function validCidr(value: string): boolean {
  const parts = value.split('/');
  if (parts.length !== 2 || !/^(0|[1-9][0-9]*)$/.test(parts[1]!)) return false;
  const bytes = ipBytes(parts[0]!); const prefix = Number(parts[1]);
  if (!bytes || prefix > bytes.length * 8) return false;
  return bytes.every((byte, i) => {
    const bits = Math.max(0, Math.min(8, prefix - i * 8));
    return (byte & (255 >> bits)) === 0;
  });
}
export function validatePolicy(policy: Policy): void {
  if (policy.pollIntervalSeconds >= policy.renewalLeadSeconds || policy.renewalLeadSeconds >= policy.leaseSeconds || policy.renewalLeadSeconds <= 2 * policy.pollIntervalSeconds + policy.maxClockSkewSeconds) fail('INVALID_CONFIG', 'Invalid renewal timing');
  // The schema permits integer range; operational durations must also remain representable in milliseconds.
  for (const [key, value] of Object.entries(policy)) if (key.endsWith('Seconds') && value > Math.floor(Number.MAX_SAFE_INTEGER / 1000)) fail('INVALID_CONFIG', 'Duration overflows milliseconds');
}
export function validateSnapshot(snapshot: Snapshot): void {
  if (compareTimes(snapshot.issuedAt, snapshot.validUntil) >= 0) fail('INVALID_CONFIG', 'Invalid snapshot time range');
  const { snapshotDigest, ...body } = snapshot;
  if (digest(body) !== snapshotDigest) fail('INTEGRITY_FAILURE', 'Snapshot digest mismatch');
  const logical = new Set<string>(), physical = new Set<string>();
  let previous = '';
  for (const assignment of snapshot.assignments) {
    const logicalKey = `${assignment.forwardId}/${assignment.protocol}/${assignment.role}`;
    if (assignment.assignmentId <= previous || logical.has(logicalKey)) fail('RESOURCE_CONFLICT', 'Assignments must be unique and sorted');
    previous = assignment.assignmentId; logical.add(logicalKey);
    const key = `${assignment.protocol}/${assignment.listener.port}`;
    if (physical.has(key)) fail('RESOURCE_CONFLICT', 'Conflicting physical slot');
    physical.add(key);
    const config = assignment.driver.config;
    if (!normalizeTargetHost(config.target.host) || normalizeTargetHost(config.target.host) !== config.target.host) fail('INVALID_CONFIG', 'Noncanonical target host');
    if (config.allowedDestinationCidrs.some(cidr => !validCidr(cidr))) fail('INVALID_CONFIG', 'Invalid CIDR network');
    if (digest(config) !== assignment.driver.configDigest) fail('INTEGRITY_FAILURE', 'Driver config digest mismatch');
  }
  const retired = new Set<string>();
  let previousTombstone: (typeof snapshot.tombstones)[number] | undefined;
  for (const tombstone of snapshot.tombstones) {
    const key = `${tombstone.protocol}/${tombstone.port}/${tombstone.bindingFence}`;
    if (retired.has(key) || tombstone.retirementGeneration > snapshot.snapshotGeneration) fail('INVALID_CONFIG', 'Invalid retirement high-water');
    retired.add(key);
    if (previousTombstone) {
      const p = previousTombstone, t = tombstone;
      const order = p.protocol < t.protocol ? -1 : p.protocol > t.protocol ? 1 : p.port - t.port || p.retirementGeneration - t.retirementGeneration || (p.assignmentId < t.assignmentId ? -1 : p.assignmentId > t.assignmentId ? 1 : 0);
      if (order >= 0) fail('INVALID_CONFIG', 'Tombstones must be unique and sorted');
    }
    previousTombstone = tombstone;
    if (snapshot.assignments.some(a => a.protocol === tombstone.protocol && a.listener.port === tombstone.port && a.bindingFence <= tombstone.bindingFence)) fail('FENCING_REJECTED', 'Assignment resurrects retired slot');
  }
}
/** Validate wire JSON before returning a typed message. Runtime identity/session/freshness checks are additional. */
export function parseMessage<K extends keyof Messages>(name: K, raw: string): Messages[K] {
  const value = parseJson(raw, name === 'ReportRequest' ? 1048576 : 4194304);
  const validator = validators.get(name);
  if (!validator || !validator(value)) fail('INVALID_CONFIG', `Invalid ${name} structure`);
  const message = value as Messages[K];
  if (name === 'HelloResponse') { const hello = message as Messages['HelloResponse']; validateTime(hello.serverTime); validatePolicy(hello.policy); }
  if (name === 'Snapshot') validateSnapshot(message as Snapshot);
  if (name === 'ReportRequest') {
    const report = message as Messages['ReportRequest'];
    validateTime(report.observedAt);
    if (report.acceptedSnapshotGeneration === 0 && (report.observations.length > 0 || report.drains.length > 0)) fail('INVALID_CONFIG', 'Unaccepted snapshot cannot have observations');
    const seen = new Set<string>();
    for (const obs of report.observations) {
      const key = `${obs.assignmentId}/${obs.deploymentGeneration}/${obs.bindingFence}`;
      if (seen.has(key)) fail('INVALID_CONFIG', 'Duplicate observation');
      seen.add(key);
      const requiredPhase: Record<string, string> = { ready: 'active', prepared: 'prepared', removed: 'absent', draining: 'draining' };
      if (requiredPhase[obs.condition] && requiredPhase[obs.condition] !== obs.phase) fail('INVALID_CONFIG', 'Phase and condition disagree');
    }
    const drains = new Set<string>();
    for (const drain of report.drains) {
      const key = `${drain.assignmentId}/${drain.deploymentGeneration}/${drain.bindingFence}`;
      if (drains.has(key)) fail('INVALID_CONFIG', 'Duplicate drain report');
      drains.add(key);
      if (compareTimes(drain.startedAt, drain.deadline) > 0 || (drain.condition === 'removed' && drain.remainingConnections !== 0)) fail('INVALID_CONFIG', 'Invalid drain report');
    }
  }
  return deepFreeze(message);
}
/** Structural-only conformance, used to test the authoritative fixture separately from runtime semantics. */
export function validateStructure(name: keyof Messages, raw: string): boolean {
  try { return validators.get(name)?.(parseJson(raw, name === 'ReportRequest' ? 1048576 : 4194304)) === true; } catch { return false; }
}
