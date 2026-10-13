import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { deepFreeze } from '@tunex/core';
import { parseJson } from './json.ts';

export interface RelayProfileConfig {
 driver:'native.relay.v1';wireVersion:1;security:'mutual-tls13';protocols:('tcp'|'udp')[];
 handshakeTimeoutSeconds:number;idleTimeoutSeconds:number;maxFrameBytes:number;
 maxUdpDatagramBytes:number;maxConnectionsPerNode:number;
}
export interface RelayBinding {
 scopeId:string;forwardId:string;forwardRevision:number;deploymentGeneration:number;
 ingressNodeId:string;egressNodeId:string;ingressAssignmentId:string;egressAssignmentId:string;
 ingressSessionEpoch:number;egressSessionEpoch:number;ingressFence:number;egressFence:number;
 profileId:string;profileRevision:number;profileDigest:string;
}
export interface RelayOpen {wireVersion:1;type:'open';action:'probe'|'tcp'|'udp';requestId:string;binding:RelayBinding}
export interface RelayAccept {wireVersion:1;type:'accepted';requestId:string;bindingDigest:string}
export interface RelayReject {wireVersion:1;type:'rejected';requestId:string;code:'AUTHENTICATION_FAILED'|'AUTHORIZATION_DENIED'|'STALE_DEPLOYMENT'|'DOWNSTREAM_NOT_ACTIVE'|'UNSUPPORTED_CAPABILITY'|'RESOURCE_LIMIT'|'TARGET_REJECTED'|'TARGET_UNAVAILABLE';retryable:boolean}
export interface RelayMessages {ProfileConfig:RelayProfileConfig;Open:RelayOpen;Accept:RelayAccept;Reject:RelayReject}
const schema=JSON.parse(readFileSync(new URL('../../../docs/protocol/schemas/native-relay-v1.schema.json',import.meta.url),'utf8')) as {$id:string};
const fullStringRegExp=Object.assign((pattern:string,flags:string)=>new RegExp(pattern.endsWith('$')?`${pattern.slice(0,-1)}$(?![\\s\\S])`:pattern,flags),{code:'fullStringRegExp'});
const ajv=new Ajv2020({strict:true,allErrors:true,code:{regExp:fullStringRegExp}});ajv.addSchema(schema);
const validators=new Map<string,ValidateFunction>();for(const name of ['ProfileConfig','Open','Accept','Reject'])validators.set(name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`}));
export function parseRelayMessage<K extends keyof RelayMessages>(name:K,raw:string,maxBytes=4096):RelayMessages[K]{
 const value=parseJson(raw,Math.min(maxBytes,4096));if(!validators.get(name)?.(value))throw new Error('INVALID_CONFIG: Relay contract rejected');
 if(name==='ProfileConfig'){const config=value as RelayProfileConfig;if(config.maxUdpDatagramBytes>config.maxFrameBytes||config.protocols.some((protocol,index)=>index>0&&config.protocols[index-1]!>=protocol))throw new Error('INVALID_CONFIG: Canonical bounded Relay Profile required');}
 if(name==='Open'){const binding=(value as RelayOpen).binding;if(binding.ingressNodeId===binding.egressNodeId||binding.ingressAssignmentId===binding.egressAssignmentId)throw new Error('INVALID_CONFIG: Distinct Relay Nodes and Assignments required');}
 return deepFreeze(value as RelayMessages[K]);
}
