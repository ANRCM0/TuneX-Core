import { startControl } from './server.ts';
import { verifyMultihopRelease } from './infrastructure/multihop-release.ts';
function required(name:string):string{const value=process.env[name];if(!value)throw new Error(`${name} required`);return value;}
const port=Number(process.env.TUNEX_CONTROL_PORT??'41001');if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid TUNEX_CONTROL_PORT');
if(process.env.NODE_ENV==='production'&&process.env.TUNEX_MULTIHOP_EXECUTION==='1')await verifyMultihopRelease(required('TUNEX_MULTIHOP_RELEASE_EVIDENCE'),required('TUNEX_SOURCE_REVISION'));
const server=await startControl({databaseUrl:required('DATABASE_URL'),caCert:required('TUNEX_CA_CERT'),caKey:required('TUNEX_CA_KEY'),serverCert:required('TUNEX_SERVER_CERT'),serverKey:required('TUNEX_SERVER_KEY'),stateDirectory:required('TUNEX_CONTROL_STATE'),openssl:process.env.TUNEX_OPENSSL??'openssl',relayCredentialSeconds:Number(process.env.TUNEX_RELAY_CREDENTIAL_SECONDS??'86400'),port,host:process.env.TUNEX_CONTROL_HOST??'127.0.0.1',initializeAuthority:process.env.TUNEX_AUTHORITY_INITIALIZE==='1',multihopEnabled:process.env.TUNEX_MULTIHOP_EXECUTION==='1'});
console.log(`Control listening on https://${process.env.TUNEX_CONTROL_HOST??'127.0.0.1'}:${server.port}`);
let closing=false;async function close(){if(closing)return;closing=true;await server.close();}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
