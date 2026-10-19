import { readFile } from 'node:fs/promises';
import { parseForward } from '@tunex/core';
import { parseJson } from '@tunex/contracts/shared';
import { compileDirect, compileSnapshot } from './compatibility/public.ts';
import type { SnapshotInput } from './compatibility/public.ts';
import type { AuthorizedNodeFacts, ReservedSlot } from './framework/public.ts';

// Offline plan inspection only. This command cannot reserve resources, issue authorization or deploy an Agent.
async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npm run plan -- <plan-input.json>');
  const input = parseJson(await readFile(path, 'utf8')) as { forward: unknown; nodeFacts: AuthorizedNodeFacts; reservations: ReservedSlot[]; snapshot: Omit<SnapshotInput, 'assignments' | 'tombstones'> };
  const forward = parseForward(input.forward);
  if (!forward.ok) throw new Error(JSON.stringify(forward.errors));
  const assignments = compileDirect(forward.value, input.nodeFacts, input.reservations);
  const snapshot = compileSnapshot({ ...input.snapshot, assignments, tombstones: [] });
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Plan failed'); process.exitCode = 1; });
