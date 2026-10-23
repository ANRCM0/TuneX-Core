#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePreflightArguments, rolePreflight } from './preflight-role.mjs';
import { deploymentSetupPlan } from './setup-plan.mjs';

export { deploymentSetupPlan } from './setup-plan.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parsePreflightArguments(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node --env-file=/secure/role.env deploy/setup.mjs --role control|agent [--phase initial|existing] [--control-url https://control.example] [--json]');
    } else {
      const plan = deploymentSetupPlan(rolePreflight(process.env, options));
      if (options.json) console.log(JSON.stringify(plan, null, 2));
      else {
        console.log(`Manual ${plan.role} ${plan.phase} setup plan: ${plan.localStatus}; no commands executed; runtime readiness unverified.`);
        for (const finding of plan.findings) console.log(`${finding.status} ${finding.code}: ${finding.advice}`);
        for (const step of plan.steps) {
          console.log(`\n${step.id}: ${step.title} [${step.status}]`);
          for (const instruction of step.instructions) console.log('- ' + instruction);
          for (const command of step.commands) console.log(command);
        }
      }
      process.exitCode = plan.localStatus === 'passed' ? 0 : plan.localStatus === 'incomplete' ? 2 : 1;
    }
  } catch {
    console.error(process.argv.includes('--json') ? JSON.stringify({ setupVersion: 1, scope: 'local-static-plan',
      status: 'rejected', runtimeReady: false, executed: false, code: 'INVALID_SETUP_OPTIONS' }) :
      'Cannot create a setup plan; use --help and review the protected role configuration.');
    process.exitCode = 1;
  }
}
