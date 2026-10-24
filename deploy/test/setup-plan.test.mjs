import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentSetupPlan } from '../setup-plan.mjs';

const report = (role = 'control', phase = 'initial', checks = []) => ({
  version: 1, scope: 'local-static', role, phase, runtimeReady: false,
  status: checks.some(check => check.status === 'failed') ? 'rejected' :
    checks.some(check => check.required && check.status === 'not-checked') ? 'incomplete' : 'passed',
  checks: [{ code: 'IMMUTABLE_IMAGE_CONFIGURED', status: 'passed', required: true }, ...checks],
});
const commands = plan => plan.steps.flatMap(step => step.commands).join('\n');

test('existing deployments never propose initialization or repeated enrollment', () => {
  for (const role of ['control', 'agent']) {
    const plan = deploymentSetupPlan(report(role, 'existing'));
    assert.equal(plan.executed, false);
    assert.equal(plan.runtimeReady, false);
    assert.equal(plan.executionAuthorized, false);
    assert.match(commands(plan), /assess-upgrade/);
    assert.doesNotMatch(commands(plan), /--enroll|TUNEX_AUTHORITY_INITIALIZE=1|bootstrap\.ts/);
    assert.ok(plan.steps.some(step => step.id === 'retain'));
    assert.ok(plan.steps.some(step => step.id === 'traffic'));
  }
});

test('fresh Control and Agent plans use the original distinct one-time owners', () => {
  const control = commands(deploymentSetupPlan(report('control')));
  const agent = commands(deploymentSetupPlan(report('agent')));
  assert.match(control, /bootstrap\.ts WORKSPACE_ID OWNER_ID/);
  assert.match(control, /run --rm --no-deps --service-ports -e TUNEX_AUTHORITY_INITIALIZE=1 control/);
  assert.doesNotMatch(control, /--enroll/);
  assert.match(agent, /run --rm --no-deps -e TUNEX_ENROLLMENT_TOKEN agent --enroll --control/);
  assert.match(agent, /--journal-key \/run\/tunex-agent-secrets\/journal\.key/);
  assert.doesNotMatch(agent, /bootstrap\.ts|TUNEX_AUTHORITY_INITIALIZE=1/);
  const unsafeCommand = /(?:^|[\s;&|])rm\s+-|chmod 777|--insecure|curl .*\|.*sh/;
  assert.match('rm -rf /protected-state', unsafeCommand);
  assert.doesNotMatch(control + '\n' + agent, unsafeCommand);
});

test('failed or required-unchecked preflight blocks subsequent manual actions', () => {
  for (const [status, code] of [['failed', 'INITIAL_STATE_NOT_EMPTY'], ['not-checked', 'HOST_PERMISSIONS_UNCHECKED']]) {
    const plan = deploymentSetupPlan(report('agent', 'initial', [{ code, status, required: true }]));
    assert.ok(plan.steps.filter(step => step.id !== 'preflight').every(step => step.status === 'blocked-by-preflight'));
    assert.match(plan.findings[0].advice, status === 'failed' ? /never empty/ : /Linux host/);
    assert.equal(plan.runtimeReady, false);
  }
});

test('plans export fixed remediation only and never echo raw errors paths or secrets', () => {
  const secret = 'private-token-do-not-export';
  const input = report('control', 'initial', [{ code: 'FILE_UNAVAILABLE', status: 'failed', required: true,
    subject: '/private/' + secret, message: secret }, { code: secret, status: 'not-checked', required: false, message: secret }]);
  input.database = secret;
  const plan = deploymentSetupPlan(input);
  assert.doesNotMatch(JSON.stringify(plan), new RegExp(secret));
  assert.equal(plan.findings[1].code, 'UNKNOWN_PREFLIGHT_CHECK');
});

test('malformed or contradictory reports cannot become an install readiness result', () => {
  const good = report();
  for (const input of [null, { ...good, version: 2 }, { ...good, scope: 'network-verified' },
    { ...good, role: 'all' }, { ...good, phase: 'reset' }, { ...good, runtimeReady: true },
    { ...good, checks: [] }, { ...good, checks: [{ code: 'FILE_UNAVAILABLE', status: 'failed', required: true }] },
    { ...good, checks: Array(129).fill(good.checks[0]) },
    { ...good, checks: [{ code: 'NETWORK_UNCHECKED', status: 'not-checked', required: 'false' }] }])
    assert.throws(() => deploymentSetupPlan(input), /INVALID_PREFLIGHT_REPORT/);
});

test('optional unchecked runtime observations stay visible after a static pass', () => {
  const plan = deploymentSetupPlan(report('control', 'existing', [
    { code: 'NETWORK_UNCHECKED', status: 'not-checked', required: false },
    { code: 'PROTECTED_STATE_UNCHECKED', status: 'not-checked', required: false },
  ]));
  assert.equal(plan.localStatus, 'passed');
  assert.equal(plan.findings.length, 2);
  assert.ok(plan.steps.filter(step => step.id !== 'preflight').every(step => step.status === 'manual-action-required'));
  assert.equal(plan.runtimeReady, false);
});
