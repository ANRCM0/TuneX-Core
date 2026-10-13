import type { Forwarding } from './forwarding.ts';
import { isId,isCounter,isPort,ipBytes,normalizeIp,normalizeTargetHost,MAX_COUNTER } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { ControlError,invalid,notFound } from '../application/errors.ts';
import { rows,write,json } from '../infrastructure/mysql.ts';
import type { MySqlUnitOfWork,Transaction } from '../infrastructure/mysql.ts';
import type { Identity } from './identity.ts';
import type { Nodes } from './nodes.ts';
import { Idempotency } from './idempotency.ts';
export interface RelayEndpoint {listenAddress:string;advertisedHost:string;allowedTcpPorts:number[]}
export interface ResolvedEndpoint {nodeId:string;revision:number;config:RelayEndpoint}
export function parseRelayEndpoint(input:unknown):RelayEndpoint{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='advertisedHost,allowedTcpPorts,listenAddress')invalid('Explicit Relay endpoint fields required');
 const value=input as Record<string,unknown>;const address=typeof value.listenAddress==='string'?normalizeIp(value.listenAddress):undefined,host=typeof value.advertisedHost==='string'?normalizeTargetHost(value.advertisedHost):undefined;
 const bytes=host?ipBytes(host):undefined;if(bytes&&(bytes.every(byte=>byte===0)||bytes.length===4&&bytes[0]!>=224||bytes.length===16&&bytes[0]===255))invalid('Relay endpoint must identify a unicast host');
 if(!address||!host||!Array.isArray(value.allowedTcpPorts)||value.allowedTcpPorts.length<1||value.allowedTcpPorts.length>256||value.allowedTcpPorts.some(p=>!isPort(p))||new Set(value.allowedTcpPorts).size!==value.allowedTcpPorts.length)invalid('Canonical IP listener, reachable host and bounded unique TCP ports required');
 return {listenAddress:address,advertisedHost:host,allowedTcpPorts:[...value.allowedTcpPorts as number[]].sort((a,b)=>a-b)};
}
export class RelayEndpoints {
 private readonly db:MySqlUnitOfWork;private readonly identity:Identity;private readonly nodes:Nodes;private readonly idempotency:Idempotency;private readonly forwarding:Forwarding;
 constructor(db:MySqlUnitOfWork,identity:Identity,nodes:Nodes,idempotency:Idempotency,forwarding:Forwarding){this.db=db;this.identity=identity;this.nodes=nodes;this.idempotency=idempotency;this.forwarding=forwarding;}
 async change(actor:string,scopeId:string,nodeId:string,key:string|undefined,expectedRevision:number,input:unknown){
  if(!isId(nodeId)||!isCounter(expectedRevision,true)||!key||!/^[\x21-\x7e]{1,128}$/.test(key))invalid('Valid endpoint command required');const config=parseRelayEndpoint(input);
  const request={actorId:actor,scopeId,key,digest:digest({method:'PUT',path:`/api/v1/scopes/${scopeId}/nodes/${nodeId}/relay-endpoint`,expectedRevision,config})};
  return this.db.transaction(async tx=>{await this.identity.owner(tx,actor,scopeId);const replay=await this.idempotency.claim<{status:200|202;body:{nodeId:string;revision:number;changed:boolean}}>(tx,request);if(replay)return replay;
   const node=await this.nodes.management(tx,actor,scopeId,nodeId);if(node.revoked)throw new ControlError('AUTHORIZATION_DENIED',403,'Revoked Node endpoint cannot be changed');const current=(await rows<{revision:number;config:unknown}>(tx,'SELECT revision,config FROM node_relay_endpoints WHERE node_id=? FOR UPDATE',[nodeId]))[0];if((current?.revision??0)!==expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Relay endpoint revision conflict');
   const changed=!current||digest(json(current.config))!==digest(config),revision=expectedRevision+(changed?1:0);if(revision>MAX_COUNTER)throw new ControlError('REVISION_EXHAUSTED',409,'Relay endpoint revision exhausted');
   if(changed){const live=await this.forwarding.hasLiveRelay(tx,undefined,nodeId);if(live)throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Active Relay endpoint changes require withdrawal coordinator');await write(tx,'INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),config=VALUES(config),created_by=VALUES(created_by),updated_at=VALUES(updated_at)',[nodeId,revision,JSON.stringify(config),actor,Date.now()]);await this.nodes.audit(tx,nodeId,actor,'relay_endpoint_update',{revision,config});}
   const response={status:changed?202 as const:200 as const,body:{nodeId,revision,changed}};await this.idempotency.respond(tx,request,response);return response;
  });
 }
 async resolve(tx:Transaction,nodeId:string):Promise<ResolvedEndpoint>{const record=(await rows<{revision:number;config:unknown}>(tx,'SELECT revision,config FROM node_relay_endpoints WHERE node_id=? FOR SHARE',[nodeId]))[0];if(!record)notFound();return {nodeId,revision:record.revision,config:parseRelayEndpoint(json(record.config))};}
 async get(actor:string,scopeId:string,nodeId:string){return this.db.transaction(async tx=>{await this.identity.scope(tx,actor,scopeId);await this.nodes.cleanupFacts(tx,nodeId,scopeId);return {...await this.resolve(tx,nodeId),executionSupported:false};});}
}
