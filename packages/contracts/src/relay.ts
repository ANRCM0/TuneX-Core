import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { normalizeIp,normalizeTargetHost } from '@tunex/core';
import { digest } from './digest.ts';
import { validCidr } from './validate.ts';
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
export interface RelayResource {address:string;port:number;protocol:'tcp'|'udp'}
export interface RelayConfig {role:'relay-ingress'|'relay-egress';binding:RelayBinding;profile:RelayProfileConfig;peerFingerprints:string[];peerEndpoint?:{host:string;port:number};target?:{host:string;port:number};egressPolicyRevision:number;allowedDestinationCidrs:string[];allowMetadataTargets:boolean}
export interface RelayAssignment {protocolVersion:3;nodeId:string;sessionEpoch:number;assignmentId:string;forwardId:string;forwardRevision:number;deploymentGeneration:number;bindingFence:number;role:'relay-ingress'|'relay-egress';protocol:'tcp'|'udp';phase:'prepared'|'active'|'draining';resource:RelayResource;driver:{id:'native.relay.v1';schemaVersion:1;configDigest:string;config:RelayConfig};drainTimeoutSeconds:number}
export interface RelayTombstone {protocolVersion:3;nodeId:string;role:'relay-ingress'|'relay-egress';assignmentId:string;forwardId:string;protocol:'tcp'|'udp';physicalProtocol:'tcp'|'udp';port:number;bindingFence:number;retirementGeneration:number}
const schema=JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/native-relay-v1.schema.json',import.meta.url),'utf8')) as {$id:string};
const fullStringRegExp=Object.assign((pattern:string,flags:string)=>new RegExp(pattern.endsWith('$')?`${pattern.slice(0,-1)}$(?![\\s\\S])`:pattern,flags),{code:'fullStringRegExp'});
const ajv=new Ajv2020({strict:true,allErrors:true,code:{regExp:fullStringRegExp}});ajv.addSchema(schema);
const validators=new Map<string,ValidateFunction>();for(const name of ['ProfileConfig','Open','Accept','Reject'])validators.set(name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`}));
export function parseRelayMessage<K extends keyof RelayMessages>(name:K,raw:string,maxBytes=4096):RelayMessages[K]{
 const value=parseJson(raw,Math.min(maxBytes,4096));if(!validators.get(name)?.(value))throw new Error('INVALID_CONFIG: Relay contract rejected');
 if(name==='ProfileConfig'){const config=value as RelayProfileConfig;if(config.maxUdpDatagramBytes>config.maxFrameBytes||config.protocols.some((protocol,index)=>index>0&&config.protocols[index-1]!>=protocol))throw new Error('INVALID_CONFIG: Canonical bounded Relay Profile required');}
 if(name==='Open'){const binding=(value as RelayOpen).binding;if(binding.ingressNodeId===binding.egressNodeId||binding.ingressAssignmentId===binding.egressAssignmentId)throw new Error('INVALID_CONFIG: Distinct Relay Nodes and Assignments required');}
 return deepFreeze(value as RelayMessages[K]);
}

const adp3=JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/adp-v3-relay.schema.json',import.meta.url),'utf8')) as {$id:string};
const adp3Ajv=new Ajv2020({strict:true,allErrors:true,code:{regExp:fullStringRegExp}});const addFormats:(instance:Ajv2020)=>void=createRequire(import.meta.url)('ajv-formats');addFormats(adp3Ajv);adp3Ajv.addSchema(adp3);
const adp3Validators=new Map<string,ValidateFunction>(['Assignment','Tombstone'].map(name=>[name,adp3Ajv.compile({$ref:`${adp3.$id}#/$defs/${name}`})]));
export function parseRelayAssignment<K extends 'Assignment'|'Tombstone'>(name:K,raw:string,maxBytes=16384):K extends 'Assignment'?RelayAssignment:RelayTombstone{
 const value=parseJson(raw,Math.min(maxBytes,16384));if(!adp3Validators.get(name)?.(value))throw new Error('INVALID_CONFIG: ADP/3 Relay resource contract rejected');
 if(name==='Assignment'){
  const a=value as RelayAssignment,c=a.driver.config,b=c.binding,ingress=a.role==='relay-ingress';
  parseRelayMessage('ProfileConfig',JSON.stringify(c.profile));parseRelayMessage('Open',JSON.stringify({wireVersion:1,type:'open',action:'probe',requestId:'contract-validation',binding:b}));
  if(a.role!==c.role||a.nodeId!==(ingress?b.ingressNodeId:b.egressNodeId)||a.sessionEpoch!==(ingress?b.ingressSessionEpoch:b.egressSessionEpoch)||a.assignmentId!==(ingress?b.ingressAssignmentId:b.egressAssignmentId)||a.bindingFence!==(ingress?b.ingressFence:b.egressFence)||a.forwardId!==b.forwardId||a.forwardRevision!==b.forwardRevision||a.deploymentGeneration!==b.deploymentGeneration)throw new Error('AUTHORIZATION_DENIED: Relay deployment binding differs');
  if(a.resource.protocol!==(ingress?a.protocol:'tcp')||normalizeIp(a.resource.address)!==a.resource.address)throw new Error('RESOURCE_CONFLICT: Relay physical resource differs');
  if(!c.profile.protocols.includes(a.protocol)||digest(c.profile)!==b.profileDigest||digest(c)!==a.driver.configDigest)throw new Error('INTEGRITY_FAILURE: Relay config/Profile digest differs');
  if(ingress?(!c.peerEndpoint||c.target!==undefined):(!c.target||c.peerEndpoint!==undefined))throw new Error('INVALID_CONFIG: Exactly the endpoint for this Relay role is required');
  const target=ingress?c.peerEndpoint!:c.target!;
  if(normalizeTargetHost(target.host)!==target.host||c.allowedDestinationCidrs.some(cidr=>!validCidr(cidr))||new Set(c.allowedDestinationCidrs).size!==c.allowedDestinationCidrs.length||c.allowedDestinationCidrs.some((cidr,index)=>index>0&&c.allowedDestinationCidrs[index-1]!>=cidr)||c.peerFingerprints.some((fingerprint,index)=>index>0&&c.peerFingerprints[index-1]!>=fingerprint))throw new Error('INVALID_CONFIG: Canonical Relay endpoint/policy required');
 }
 if(name==='Tombstone'){const t=value as RelayTombstone;if(t.physicalProtocol!==(t.role==='relay-egress'?'tcp':t.protocol))throw new Error('RESOURCE_CONFLICT: Relay retirement physical resource differs');}
 return deepFreeze(value) as K extends 'Assignment'?RelayAssignment:RelayTombstone;
}
