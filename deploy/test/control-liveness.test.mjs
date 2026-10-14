import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';

const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../control-liveness.mjs');
function check(port){return spawnSync(process.execPath,[script],{env:{...process.env,TUNEX_CONTROL_PORT:String(port)},timeout:4000});}
test('liveness fails closed without listener',()=>{
  const socket=net.createServer();socket.listen(0,'127.0.0.1');
  return once(socket,'listening').then(async()=>{
    const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
    assert.equal(check(port).status,1);
  });
});
test('liveness succeeds only when local port accepts actual TCP',async()=>{
  const socket=net.createServer();socket.listen(0,'127.0.0.1');
  await once(socket,'listening');
  try{assert.equal(check(socket.address().port).status,0);}
  finally{await new Promise(resolve=>socket.close(resolve));}
});
test('liveness rejects invalid port',()=>assert.equal(check(0).status,1));
