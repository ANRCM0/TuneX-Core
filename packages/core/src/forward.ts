import { deepFreeze, isCounter, isId, isPort, MAX_COUNTER, normalizeIp, normalizeTargetHost } from './primitives.ts';
import type { Forward, ForwardChange, ForwardSpec, Issue, Node, Result, ValidationResult } from './types.ts';

function record(input: unknown, keys: readonly string[], path: string, errors: Issue[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    errors.push({ code: 'INVALID_CONFIG', path, message: 'Expected an object' }); return {};
  }
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(obj)) if (!keys.includes(key)) errors.push({ code: 'INVALID_CONFIG', path: `${path}.${key}`, message: 'Unknown field' });
  return obj;
}
function check(condition: boolean, path: string, message: string, errors: Issue[]): void {
  if (!condition) errors.push({ code: 'INVALID_CONFIG', path, message });
}

/** Parse untrusted intent, reject unmanaged fields, and return detached immutable canonical values. */
export function parseForwardSpec(input: unknown): Result<ForwardSpec> {
  const errors: Issue[] = [];
  const spec = record(input, ['enabled', 'protocols', 'ingress', 'target', 'path', 'transport'], 'spec', errors);
  check(typeof spec.enabled === 'boolean', 'spec.enabled', 'Expected a boolean', errors);
  const protocols = Array.isArray(spec.protocols) ? spec.protocols : [];
  check(protocols.length > 0 && protocols.length <= 2 && protocols.every(p => p === 'tcp' || p === 'udp') && new Set(protocols).size === protocols.length, 'spec.protocols', 'Expected a nonempty unique TCP/UDP set', errors);
  const ingress = record(spec.ingress, ['nodeId', 'listen'], 'spec.ingress', errors);
  check(isId(ingress.nodeId), 'spec.ingress.nodeId', 'Invalid Node ID', errors);
  const listen = record(ingress.listen, ['address', 'port'], 'spec.ingress.listen', errors);
  const address = typeof listen.address === 'string' ? normalizeIp(listen.address) : undefined;
  check(address !== undefined, 'spec.ingress.listen.address', 'Expected an IP literal', errors);
  check(isPort(listen.port), 'spec.ingress.listen.port', 'Expected port 1..65535', errors);
  const target = record(spec.target, ['host', 'port'], 'spec.target', errors);
  const host = normalizeTargetHost(target.host);
  check(host !== undefined, 'spec.target.host', 'Invalid target IP or ASCII hostname', errors);
  check(isPort(target.port), 'spec.target.port', 'Expected port 1..65535', errors);
  let via: string[] | undefined;
  if (Object.hasOwn(spec, 'path')) {
    const path = record(spec.path, ['via'], 'spec.path', errors);
    check(Array.isArray(path.via) && path.via.every(isId), 'spec.path.via', 'Expected Node ID array', errors);
    if (Array.isArray(path.via) && path.via.every(isId)) {
      via = [...path.via];
      check(new Set(via).size === via.length && !via.includes(ingress.nodeId as string), 'spec.path.via', 'Repeated or cyclic Node path', errors);
    }
  }
  let transport: ForwardSpec['transport'];
  if (Object.hasOwn(spec, 'transport')) {
    const ref = record(spec.transport, ['profileId', 'configRevision'], 'spec.transport', errors);
    check(isId(ref.profileId), 'spec.transport.profileId', 'Invalid Profile ID', errors);
    check(isCounter(ref.configRevision), 'spec.transport.configRevision', 'Invalid Profile revision', errors);
    transport = { profileId: ref.profileId as string, configRevision: ref.configRevision as number };
  }
  check(Boolean(via?.length) === Boolean(transport), 'spec.transport', 'A nonempty path requires a locked Profile; direct forbids a Profile', errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: deepFreeze({
    enabled: spec.enabled as boolean,
    protocols: (['tcp', 'udp'] as const).filter(protocol => protocols.includes(protocol)),
    ingress: { nodeId: ingress.nodeId as string, listen: { address: address!, port: listen.port as number } },
    target: { host: host!, port: target.port as number },
    ...(via?.length ? { path: { via } } : {}), ...(transport ? { transport } : {}),
  }) };
}
/** Domain validation uses the same canonical parser; database/network facts belong to outer modules. */
export function validateForwardSpec(spec: ForwardSpec): ValidationResult { return parseForwardSpec(spec); }
export function parseNode(input: unknown): Result<Node> {
  const errors: Issue[] = [];
  const node = record(input, ['id', 'scopeId', 'revision'], 'node', errors);
  check(isId(node.id), 'node.id', 'Invalid Node ID', errors);
  check(isId(node.scopeId), 'node.scopeId', 'Invalid Scope ID', errors);
  check(isCounter(node.revision), 'node.revision', 'Invalid revision', errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: deepFreeze({ id: node.id as string, scopeId: node.scopeId as string, revision: node.revision as number }) };
}
export function parseForward(input: unknown): Result<Forward> {
  const errors: Issue[] = [];
  const forward = record(input, ['id', 'scopeId', 'revision', 'spec'], 'forward', errors);
  check(isId(forward.id), 'forward.id', 'Invalid Forward ID', errors);
  check(isId(forward.scopeId), 'forward.scopeId', 'Invalid Scope ID', errors);
  check(isCounter(forward.revision), 'forward.revision', 'Invalid revision', errors);
  const spec = parseForwardSpec(forward.spec);
  if (!spec.ok) errors.push(...spec.errors);
  if (errors.length || !spec.ok) return { ok: false, errors };
  return { ok: true, value: deepFreeze({ id: forward.id as string, scopeId: forward.scopeId as string, revision: forward.revision as number, spec: spec.value }) };
}
/** Pure CAS decision. The repository must still enforce expectedRevision in its atomic write. */
export function decideForwardChange(current: Forward, expectedRevision: number, change: ForwardChange): Result<Forward> {
  const parsed = parseForward(current);
  if (!parsed.ok) return parsed;
  if (!isCounter(expectedRevision) || current.revision !== expectedRevision) return { ok: false, errors: [{ code: 'REVISION_CONFLICT', path: 'expectedRevision', message: 'Expected revision does not match' }] };
  const errors: Issue[] = [];
  const command = record(change, change?.kind === 'replace' ? ['kind', 'spec'] : ['kind', 'enabled'], 'change', errors);
  if (command.kind !== 'replace' && command.kind !== 'set-enabled') return { ok: false, errors: [{ code: 'INVALID_CONFIG', path: 'change.kind', message: 'Unknown change kind' }] };
  if (errors.length) return { ok: false, errors };
  const next = parseForwardSpec(command.kind === 'replace' ? command.spec : { ...parsed.value.spec, enabled: command.enabled });
  if (!next.ok) return next;
  if (JSON.stringify(parsed.value.spec) === JSON.stringify(next.value)) return parsed;
  if (current.revision === MAX_COUNTER) return { ok: false, errors: [{ code: 'REVISION_EXHAUSTED', path: 'revision', message: 'Revision counter exhausted' }] };
  return { ok: true, value: deepFreeze({ ...parsed.value, revision: current.revision + 1, spec: next.value }) };
}
