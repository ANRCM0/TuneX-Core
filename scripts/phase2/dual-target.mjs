import { createServer } from 'node:net';
import { createSocket } from 'node:dgram';
const tcp=createServer(socket=>{socket.pipe(socket);socket.on('error',()=>{});});
const udp=createSocket('udp4');udp.on('message',(payload,client)=>udp.send(payload,client.port,client.address));
tcp.listen(0,'127.0.0.1',()=>udp.bind(tcp.address().port,'127.0.0.1',()=>process.stdout.write(`${JSON.stringify({port:tcp.address().port})}\n`)));
process.on('SIGTERM',()=>{tcp.close();udp.close();});
