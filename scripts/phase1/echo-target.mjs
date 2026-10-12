import { createServer } from 'node:net';
const prefix=process.argv[2]??'';
const server=createServer(socket=>{socket.on('data',data=>socket.write(prefix?Buffer.concat([Buffer.from(prefix),data]):data));socket.on('end',()=>socket.end());socket.on('error',()=>{});});
server.listen(0,'127.0.0.1',()=>process.stdout.write(`${JSON.stringify({port:server.address().port})}\n`));
process.on('SIGTERM',()=>server.close());
