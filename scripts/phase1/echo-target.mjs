import { createServer } from 'node:net';
const server=createServer(socket=>socket.pipe(socket));
server.listen(0,'127.0.0.1',()=>process.stdout.write(`${JSON.stringify({port:server.address().port})}\n`));
process.on('SIGTERM',()=>server.close());
