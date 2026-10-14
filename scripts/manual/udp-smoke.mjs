#!/usr/bin/env node
// Local-only UDP echo/probe fixture for manual VNext Direct UDP acceptance.
// This does not authenticate to Control or alter persistent Agent/Forward state.
import { createSocket } from 'node:dgram';
import { randomBytes } from 'node:crypto';

function usage() {
  return 'Usage: node scripts/manual/udp-smoke.mjs echo --port 18081 | probe --port 25565 [--count 5] [--timeout-ms 3000]';
}
export function parseArgs(args) {
  const [mode,...flags]=args;
  if(!['echo','probe'].includes(mode))throw Error(usage());
  const options={port:mode==='echo'?18081:25565,count:5,timeoutMs:3000};
  for(let i=0;i<flags.length;i+=2){
    const key=flags[i],value=flags[i+1];
    if(value===undefined||!/^\d+$/.test(value))throw Error('Invalid flag value: '+key+'\n'+usage());
    const n=Number(value);
    if(key==='--port'&&(mode==='echo'?n>=0:n>=1)&&n<=65535)options.port=n;
    else if(key==='--count'&&mode==='probe'&&n>=1&&n<=100)options.count=n;
    else if(key==='--timeout-ms'&&mode==='probe'&&n>=100&&n<=10000)options.timeoutMs=n;
    else throw Error('Unsupported or out-of-range option: '+key+'\n'+usage());
  }
  return {mode,...options};
}
async function bind(socket,port) {
  await new Promise((resolve,reject)=>{
    socket.once('error',reject);
    socket.bind(port,'127.0.0.1',()=>{socket.off('error',reject);resolve();});
  });
}
function datagramRoundtrip(socket,port,payload,timeoutMs) {
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>finish(Error('UDP reply timeout')),timeoutMs);
    function finish(error,buffer) {
      clearTimeout(timeout);
      socket.off('message',message);
      socket.off('error',failure);
      error?reject(error):resolve(buffer);
    }
    function failure(error){finish(error);}
    function message(data,remote){
      if(remote.address!=='127.0.0.1'||remote.port!==port)return;
      if(!data.equals(payload))return finish(Error('UDP reply bytes differ from sent datagram'));
      finish(null,data);
    }
    socket.on('message',message);
    socket.once('error',failure);
    socket.send(payload,port,'127.0.0.1',error=>{if(error)finish(error);});
  });
}
export async function echo(port) {
  const socket=createSocket('udp4');
  socket.on('error',error=>{console.error('UDP echo socket error:',error.message);process.exitCode=1;socket.close();});
  await bind(socket,port);
  const address=socket.address();
  socket.on('message',(data,peer)=>{
    if(peer.address!=='127.0.0.1')return; // strictly a local test fixture
    socket.send(data,peer.port,peer.address,err=>{if(err)console.error('UDP echo reply error:',err.message);});
  });
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>socket.close());
  console.log(JSON.stringify({status:'ready',mode:'udp-echo',address:'127.0.0.1',port:address.port}));
}
export async function probe(port,count,timeoutMs) {
  const clients=[createSocket('udp4'),createSocket('udp4')];
  let verified=0;
  try {
    await Promise.all(clients.map(socket=>bind(socket,0)));
    await Promise.all(clients.map(async(socket,clientIndex)=>{
      for(let i=0;i<count;i++){
        // Random, non-replayed payloads and an actual zero-length UDP datagram.
        const body=i===0?Buffer.alloc(0):Buffer.concat([Buffer.from('tunex-direct-udp:'+clientIndex+':'+i+':'),randomBytes(24)]);
        await datagramRoundtrip(socket,port,body,timeoutMs);
        verified++;
      }
    }));
    const result={status:'passed',mode:'direct-udp-probe',destination:'127.0.0.1:'+port,clients:2,datagrams:verified,emptyDatagrams:2,verifiedExactBytes:true,independentSocketPorts:clients.map(socket=>socket.address().port)};
    if(result.independentSocketPorts[0]===result.independentSocketPorts[1])throw Error('Distinct UDP clients must use distinct ports');
    console.log(JSON.stringify(result));
    return result;
  } finally {for(const socket of clients)socket.close();}
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href) {
  try {
    const {mode,port,count,timeoutMs}=parseArgs(process.argv.slice(2));
    if(mode==='echo')await echo(port);else await probe(port,count,timeoutMs);
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
