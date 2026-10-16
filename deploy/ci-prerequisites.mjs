import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const workflows = new Set(['ci.yml', 'container.yml']);
const pending = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const conclusions = new Set(['success', 'failure', 'cancelled', 'timed_out',
  'action_required', 'neutral', 'skipped', 'startup_failure', 'stale']);
const revision = /^[a-f0-9]{40}$/;
const invalid = () => { throw new Error('Invalid exact-source CI response'); };

// The API query must filter by SHA/event/branch so an incomplete history cannot
// hide a newer run. Recheck those facts rather than trusting the query alone.
export function ciPrerequisiteState(response, sha, workflow) {
  if (!revision.test(sha) || !workflows.has(workflow) ||
      !response || typeof response !== 'object' || Array.isArray(response) ||
      !Array.isArray(response.workflow_runs) ||
      !Number.isSafeInteger(response.total_count) || response.total_count < 0 ||
      response.workflow_runs.length !== response.total_count ||
      response.workflow_runs.length > 100) invalid();
  const matching = [];
  const ids = new Set();
  for (const run of response.workflow_runs) {
    if (!run || typeof run !== 'object' || Array.isArray(run) ||
        !Number.isSafeInteger(run.id) || run.id < 1 || ids.has(run.id) ||
        !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 ||
        typeof run.head_sha !== 'string' || !revision.test(run.head_sha) ||
        typeof run.event !== 'string' || typeof run.head_branch !== 'string' ||
        typeof run.path !== 'string' || typeof run.created_at !== 'string' ||
        !Number.isFinite(Date.parse(run.created_at)) ||
        !(pending.has(run.status) || run.status === 'completed') ||
        !(run.conclusion === null || conclusions.has(run.conclusion))) invalid();
    ids.add(run.id);
    if (run.head_sha === sha && run.event === 'push' && run.head_branch === 'main' &&
        run.path === '.github/workflows/' + workflow) matching.push(run);
  }
  // Each API entry describes its latest attempt, not a previous successful one.
  matching.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) ||
    a.id - b.id);
  const latest = matching.at(-1);
  if (!latest) return 'missing';
  if (latest.status !== 'completed') return 'pending';
  return latest.conclusion ?? 'pending';
}

async function main() {
  const [sha, workflow, ...extra] = process.argv.slice(2);
  if (extra.length) invalid();
  const parts = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 8 * 1024 * 1024) invalid();
    parts.push(chunk);
  }
  console.log(ciPrerequisiteState(JSON.parse(Buffer.concat(parts).toString('utf8')), sha, workflow));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Cannot establish latest exact-source main push CI prerequisites');
    process.exitCode = 1;
  });
}
