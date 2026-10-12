import { request } from 'node:https';
import { readFile } from 'node:fs/promises';
import { parseJson } from '@tunex/contracts';
const [command,scope,idOrFile,key]=process.argv.slice(2);
const base=process.env.TUNEX_CONTROL_URL,caPath=process.env.TUNEX_CA_CERT,token=process.env.TUNEX_OWNER_TOKEN;
if(!base?.startsWith('https://')||!caPath||!token||!scope)throw new Error('Trusted Control URL/CA, owner token and scope required');
let method='GET',path='',body:string|undefined;
if(command==='create'||command==='node'){if(!idOrFile)throw new Error('JSON input file required');method='POST';path=command==='create'?'forwards':'nodes';body=JSON.stringify(parseJson(await readFile(idOrFile,'utf8')));}
else if(command==='get'||command==='operation'){if(!idOrFile)throw new Error('Resource ID required');path=`${command==='get'?'forwards':'operations'}/${encodeURIComponent(idOrFile)}`;}
else throw new Error('Usage: create|node <scope> <input.json> [idempotency-key], get|operation <scope> <id>');
if(command==='create'&&!key)throw new Error('Provide a persistent Idempotency-Key for create and reuse it on retry');
const url=new URL(`/api/v1/scopes/${encodeURIComponent(scope)}/${path}`,base);
const ca=await readFile(caPath);
const result=await new Promise<string>((resolve,reject)=>{const req=request(url,{method,ca,timeout:10000,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...(key?{'idempotency-key':key}:{})}},res=>{const chunks:Buffer[]=[];res.on('data',value=>chunks.push(value));res.on('end',()=>{const text=Buffer.concat(chunks).toString();if(res.statusCode!>=200&&res.statusCode!<300)resolve(text);else reject(new Error(`HTTP ${res.statusCode}: ${text}`));});});req.on('timeout',()=>req.destroy(new Error('Control request timeout')));req.on('error',reject);req.end(body);});
console.log(JSON.stringify(parseJson(result),null,2));
