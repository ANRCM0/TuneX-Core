#!/usr/bin/env node
// Read-only deployment preflight: never print environment values or secrets.
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePreflightArguments, rolePreflight } from './preflight-role.mjs';

export { rolePreflight } from './preflight-role.mjs';

// Compatibility API for existing layout-only callers. New CLI calls select a role.
export function validate(env, inspect=(path)=>({stat:lstatSync(path),real:realpathSync(path)})){
 const errors=[];
 for(const name of ['TUNEX_CONTROL_IMAGE','TUNEX_AGENT_IMAGE']){
  const value=env[name]??'';
  // Only published registry digests are acceptable; local Docker IDs are not.
  if(!/^([a-zA-Z0-9._-]+(?::[0-9]+)?\/)?[a-zA-Z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(value))
   errors.push(name+': require an immutable registry @sha256 digest');
 }
 const paths=['TUNEX_CONTROL_STATE_DIR','TUNEX_CONTROL_PKI_DIR','TUNEX_AGENT_STATE_DIR','TUNEX_AGENT_SECRETS_DIR'];
 const resolved={};
 for(const name of paths){
  const value=env[name]??'';
  if(!isAbsolute(value)){errors.push(name+': absolute path required');continue}
  try {
   const {stat,real}=inspect(value);
   if(!stat.isDirectory()||stat.isSymbolicLink())errors.push(name+': must be an existing real directory, not symlink');
   if((stat.mode&0o002)!==0)errors.push(name+': directory must not be world-writable');
   resolved[name]=real;
  }catch{errors.push(name+': cannot inspect existing directory')}
 }
 if(resolved.TUNEX_AGENT_STATE_DIR&&resolved.TUNEX_AGENT_SECRETS_DIR){
  const state=resolved.TUNEX_AGENT_STATE_DIR,secret=resolved.TUNEX_AGENT_SECRETS_DIR;
  const inside=(a,p)=>p===a||relative(a,p)===''||(!relative(a,p).startsWith('..'+sep)&&relative(a,p)!=='..'&&!isAbsolute(relative(a,p)));
  if(inside(state,secret)||inside(secret,state))errors.push('Agent secrets and state must be disjoint directories');
 }
 return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parsePreflightArguments(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node --env-file=/secure/role.env deploy/preflight.mjs --role control|agent [--phase initial|existing] [--control-url https://control.example] [--json]');
    } else {
      const report = rolePreflight(process.env, options);
      if (options.json) console.log(JSON.stringify(report, null, 2));
      else {
        console.log('Local static preflight: ' + report.status + ' (runtime readiness is unverified)');
        for (const check of report.checks) console.log(`${check.status} ${check.code} [${check.subject}]: ${check.message}`);
      }
      process.exitCode = report.status === 'passed' ? 0 : report.status === 'incomplete' ? 2 : 1;
    }
  } catch {
    const error = { version: 1, scope: 'local-static', status: 'rejected', runtimeReady: false, code: 'INVALID_OPTIONS', message: 'Invalid preflight arguments; use --help' };
    console.error(process.argv.includes('--json') ? JSON.stringify(error) : error.message);
    process.exitCode = 1;
  }
}
