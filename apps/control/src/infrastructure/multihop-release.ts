import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const MULTIHOP_RELEASE_GATES = Object.freeze([
  'contracts', 'mysql', 'security', 'relay-isolation',
  'multihop-3', 'multihop-4', 'multihop-8', 'multihop-isolation',
  'multihop-physical', 'containers', 'main-ci', 'dev-images',
  'p0-1panel', 'p0-two-host-relay', 'p0-soak-recovery',
]);
const imageDigest = /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/;
const sha = /^[a-f0-9]{40}$/;
const hash = /^[a-f0-9]{64}$/;
function requireGate(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('MULTIHOP_RELEASE_BLOCKED: '+message);
}
async function readBounded(path: string): Promise<Buffer> {
  const info = await stat(path);
  requireGate(info.isFile()&&info.size>0&&info.size<=8*1024*1024,'Bounded evidence file required');
  return readFile(path);
}
interface Gate { name: string; artifact: string; sha256: string }
interface Manifest {
  version: number; sourceRevision: string;
  images: {control: string; agent: string}; gates: Gate[];
}

// This verifies an operator-reviewed evidence bundle, not a signature or an
// independent re-execution of the tests referenced by that bundle.
export async function verifyMultihopRelease(path: string, sourceRevision: string) {
  requireGate(sha.test(sourceRevision),'Exact built source revision required');
  const manifest = JSON.parse((await readBounded(path)).toString('utf8')) as Manifest;
  requireGate(manifest.version===1&&manifest.sourceRevision===sourceRevision,'Evidence source revision differs');
  requireGate(imageDigest.test(manifest.images?.control??'')&&imageDigest.test(manifest.images?.agent??''),'Both immutable image digests required');
  requireGate(Array.isArray(manifest.gates)&&manifest.gates.length===MULTIHOP_RELEASE_GATES.length&&new Set(manifest.gates.map(g=>g.name)).size===MULTIHOP_RELEASE_GATES.length,'Exact unique release gates required');
  const root = await realpath(dirname(resolve(path)));
  for (const name of MULTIHOP_RELEASE_GATES) {
    const gate = manifest.gates.find(g=>g.name===name);
    requireGate(gate&&typeof gate.artifact==='string'&&!isAbsolute(gate.artifact)&&hash.test(gate.sha256),'Missing gate '+name);
    const artifact = await realpath(resolve(root,gate.artifact));
    const local = relative(root,artifact);
    requireGate(local!==''&&!isAbsolute(local)&&local!=='..'&&!local.startsWith('..'+sep),'Evidence must stay inside its bundle');
    const raw = await readBounded(artifact);
    requireGate(createHash('sha256').update(raw).digest('hex')===gate.sha256,'Artifact digest differs for '+name);
    const report = JSON.parse(raw.toString('utf8')) as Record<string,any>;
    requireGate(report.passed===true&&report.commit===sourceRevision&&report.workingTreeDirty===false,'Gate failed or targets a different tree: '+name);
    if (/^multihop-[348]$/.test(name)) {
      requireGate(report.count===Number(name.at(-1))&&report.cleanupVerified===true&&report.traffic?.tcp===true&&report.traffic?.udp===true,'Complete runtime traffic evidence required for '+name);
    }
    if (name==='multihop-isolation') requireGate(report.isolated===true&&report.cleanupVerified===true&&report.traffic?.tcp===true&&report.traffic?.udp===true,'Actual isolated-network traffic evidence required');
    if (name==='multihop-physical') {
      const hosts=report.hosts as {nodeId:string;hostId:string}[]|undefined;
      requireGate(report.physicalHosts===true&&Array.isArray(hosts)&&hosts.length>=3&&hosts.length<=8&&hosts.every(h=>typeof h.nodeId==='string'&&h.nodeId.length>0&&typeof h.hostId==='string'&&h.hostId.length>0)&&new Set(hosts.map(h=>h.nodeId)).size===hosts.length&&new Set(hosts.map(h=>h.hostId)).size>=3&&report.traffic?.tcp===true&&report.traffic?.udp===true,'At least three distinct physical hosts and both protocols required');
    }
    if (name==='containers'||name==='dev-images') requireGate(report.images?.control===manifest.images.control&&report.images?.agent===manifest.images.agent,'Published image evidence differs');
  }
  return {sourceRevision:manifest.sourceRevision,images:{...manifest.images},gates:[...MULTIHOP_RELEASE_GATES]};
}
