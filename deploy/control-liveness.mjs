// A bounded, unauthenticated localhost TCP listener *liveness* check.
// Successful connection must never be interpreted as authenticated readiness.
import net from 'node:net';
const port=Number(process.env.TUNEX_CONTROL_PORT??41001);
if(!Number.isInteger(port)||port<1||port>65535)process.exit(1);
const connection=net.connect({host:'127.0.0.1',port});
let settled=false;
const finish=(ok)=>{if(settled)return;settled=true;connection.destroy();process.exit(ok?0:1)};
connection.setTimeout(2000,()=>finish(false));
connection.once('connect',()=>finish(true));
connection.once('error',()=>finish(false));
