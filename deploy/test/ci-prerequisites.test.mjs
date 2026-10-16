import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ciPrerequisiteState } from '../ci-prerequisites.mjs';

const sha = 'a'.repeat(40), other = 'b'.repeat(40);
const run = (changes = {}) => ({
  id: 10, run_attempt: 1, created_at: '2026-10-16T00:00:00Z',
  head_sha: sha, head_branch: 'main', event: 'push',
  path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success',
  ...changes,
});
const response = (...workflow_runs) => ({ total_count: workflow_runs.length, workflow_runs });
const state = payload => ciPrerequisiteState(payload, sha, 'ci.yml');

test('only exact-source main push checks for the required workflow can pass', () => {
  assert.equal(state(response(run())), 'success');
  assert.equal(state(response()), 'missing');
  for (const change of [{ head_sha: other }, { head_branch: 'feature' },
    { event: 'pull_request' }, { event: 'workflow_dispatch' },
    { path: '.github/workflows/container.yml' }]) {
    assert.equal(state(response(run(change))), 'missing');
  }
  assert.equal(ciPrerequisiteState(response(run({ path: '.github/workflows/container.yml' })),
    sha, 'container.yml'), 'success');
});

test('historical success cannot bypass the latest failed, cancelled or unfinished run', () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required',
    'neutral', 'skipped', 'startup_failure', 'stale']) {
    const latest = run({ id: 11, created_at: '2026-10-16T00:01:00Z', conclusion });
    assert.equal(state(response(latest, run())), conclusion);
    assert.equal(state(response(run(), latest)), conclusion);
  }
  for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
    assert.equal(state(response(run(), run({
      id: 11, created_at: '2026-10-16T00:01:00Z', status, conclusion: null,
    }))), 'pending');
  }
});

test('the latest attempt of a run is authoritative, including incomplete reruns', () => {
  assert.equal(state(response(run({ run_attempt: 2, conclusion: 'failure' }))), 'failure');
  assert.equal(state(response(run({
    run_attempt: 3, status: 'in_progress', conclusion: null,
  }))), 'pending');
  assert.equal(state(response(run({ run_attempt: 4 }))), 'success');
  assert.equal(state(response(run({ conclusion: null }))), 'pending');
});

test('creation order and run ID, not input order or an older run attempt, choose the latest run', () => {
  const older = run({ run_attempt: 20, conclusion: 'failure' });
  const newer = run({ id: 11, created_at: '2026-10-16T00:01:00Z' });
  assert.equal(state(response(newer, older)), 'success');
  assert.equal(state(response(run(), run({ id: 11, conclusion: 'cancelled' }))), 'cancelled');
});

test('partial, duplicated, malformed and unexpected API responses reject closed', () => {
  for (const payload of [
    null, [], {}, { total_count: 2, workflow_runs: [run()] },
    { total_count: 0, workflow_runs: [run()] }, response(run(), run()),
    response(...Array.from({ length: 101 }, (_, i) => run({ id: i + 1 }))),
    ...[{ id: 0 }, { run_attempt: 0 }, { run_attempt: undefined },
      { created_at: 'invalid' }, { status: 'unknown' }, { conclusion: 'unknown' },
      { head_sha: 'short' }, { path: null }].map(change => response(run(change))),
  ]) assert.throws(() => state(payload), /Invalid exact-source CI response/);
  assert.throws(() => ciPrerequisiteState(response(), 'short', 'ci.yml'));
  assert.throws(() => ciPrerequisiteState(response(), sha, 'untrusted.yml'));
});

test('CLI returns a single state and never reflects malformed API data', () => {
  const script = fileURLToPath(new URL('../ci-prerequisites.mjs', import.meta.url));
  assert.equal(execFileSync(process.execPath, [script, sha, 'ci.yml'], {
    input: JSON.stringify(response(run())), encoding: 'utf8',
  }).trim(), 'success');
  for (const input of ['secret-invalid-json', JSON.stringify({ private: 'secret-value' })]) {
    assert.throws(() => execFileSync(process.execPath, [script, sha, 'ci.yml'], {
      input, encoding: 'utf8', stdio: 'pipe',
    }), error => {
      assert.equal(error.status, 1);
      assert.doesNotMatch(error.stdout + error.stderr, /secret-invalid-json|secret-value/);
      assert.match(error.stderr, /Cannot establish latest exact-source/);
      return true;
    });
  }
});
