import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn,execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../udp-smoke.mjs';
const bin=fileURLToPath(new URL('../udp-smoke.mjs',import.meta.url));
const exec=promisify(execFile);

test('bounded UDP fixture arguments reject unsupported modes and invalid ports',()=>{
  assert.deepEqual(parseArgs(['probe','--port','25565','--count','7','--timeout-ms','1000']),{mode:'probe',port:25565,count:7,timeoutMs:1000});
  for(const args of [['probe','--port','0'],['echo','--port','65536'],['probe','--count','0'],['probe','--count','101'],['probe','--timeout-ms','20'],['echo','--count','3'],['probe','--port','1;echo'],['bad']])assert.throws(()=>parseArgs(args));
});
test('two UDP clients exchange distinct random and empty datagrams with real echo process',async()=>{
  const process=spawn(processExec(),[bin,'echo','--port','0'],{stdio:['ignore','pipe','pipe']});
  let ready;
  const launched=new Promise((resolve,reject)=>{
    let stdout='';
    const timer=setTimeout(()=>reject(Error('UDP echo startup timeout')),5000);
    const onExit=(code)=>{clearTimeout(timer);reject(Error('Echo exited before ready: '+code));};
    process.once('exit',onExit);
    process.once('error',reject);
    process.stdout.on('data',chunk=>{
      stdout+=chunk.toString();const index=stdout.indexOf('\n');if(index<0)return;
      clearTimeout(timer);process.off('exit',onExit);
      try{resolve(JSON.parse(stdout.slice(0,index)))}catch(error){reject(error);}
    });
  });
  try{
    ready=await launched;
    assert.equal(ready.status,'ready');
    assert.ok(ready.port>0);
    const result=await exec(processExec(),[bin,'probe','--port',String(ready.port),'--count','4','--timeout-ms','3000'],{timeout:25000});
    const check=JSON.parse(result.stdout.trim());
    assert.equal(check.status,'passed');
    assert.equal(check.clients,2);
    assert.equal(check.datagrams,8);
    assert.equal(check.emptyDatagrams,2);
    assert.equal(check.verifiedExactBytes,true);
    assert.notEqual(check.independentSocketPorts[0],check.independentSocketPorts[1]);
  }finally{
    process.kill('SIGTERM');
    await new Promise(resolve=>{if(process.exitCode!==null||process.signalCode!==null)resolve();else process.once('exit',resolve);});
  }
});
function processExec(){return process.execPath;}
