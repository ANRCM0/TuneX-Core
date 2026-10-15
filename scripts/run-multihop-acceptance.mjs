import { spawnSync } from 'node:child_process';

for(const count of [3,4,8]){
  const result=spawnSync(process.execPath,['scripts/phase2/multihop.ts',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,TUNEX_MULTIHOP_NODES:String(count)}});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
