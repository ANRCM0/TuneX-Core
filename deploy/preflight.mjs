#!/usr/bin/env node
// Read-only deployment preflight: never print environment values or secrets.
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';

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
if(process.argv[1] && import.meta.url.endsWith(process.argv[1])){
 const errors=validate(process.env);
 if(errors.length){console.error('Deployment preflight rejected:\n'+errors.join('\n'));process.exitCode=1}
 else console.log('Deployment preflight passed (paths and immutable references only; not runtime readiness)');
}
