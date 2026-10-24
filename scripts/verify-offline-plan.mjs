import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const plan = spawnSync(process.execPath, ['apps/control/src/cli.ts', 'examples/direct-plan.json'], { encoding: 'utf8' });
assert.equal(plan.status, 0, plan.stderr);
const check = spawnSync(process.execPath, ['scripts/run-go.mjs', 'run', './cmd/adp-validate', 'Snapshot'], { input: plan.stdout, encoding: 'utf8' });
assert.equal(check.status, 0, check.stderr);
assert.deepEqual(JSON.parse(check.stdout), { valid: true, message: 'Snapshot', protocolVersion: 3 });
console.log('Offline Forward → Runtime Snapshot → Go parser passed. No network execution asserted.');
