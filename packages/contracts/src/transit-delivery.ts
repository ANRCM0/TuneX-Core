import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { deepFreeze } from '@tunex/core';
import { digest } from './digest.ts';
import { parseJson } from './json.ts';
import { compareTimes } from './time.ts';

/** Transport-only, never an executable Transit assignment or Control grant. */
export interface TransitPreviewCommand {
 readonly protocolVersion:3;
 readonly extensionVersion:1;
 readonly kind:'transit-command-preview-v1';
 readonly executionEnabled:false;
 readonly nodeId:string;
 readonly bootId:string;
 readonly sessionEpoch:number;
 readonly forwardId:string;
 readonly deploymentGeneration:number;
 readonly coordinationRevision:number;
 readonly previewAction:'prepare'|'activate'|'withdraw';
 readonly commandDigest:string;
 readonly issuedAt:string;
 readonly validUntil:string;
 readonly envelopeDigest:string;
}
export interface TransitDeliveryReport {
 readonly protocolVersion:3;
 readonly extensionVersion:1;
 readonly kind:'transit-delivery-report-v1';
 readonly nodeId:string;
 readonly bootId:string;
 readonly sessionEpoch:number;
 readonly commandDigest:string;
 readonly envelopeDigest:string;
 readonly reportSequence:number;
 readonly observedAt:string;
 readonly condition:'received';
}
export interface TransitDeliveryAck {
 readonly protocolVersion:3;
 readonly extensionVersion:1;
 readonly kind:'transit-delivery-ack-v1';
 readonly executionEnabled:false;
 readonly nodeId:string;
 readonly bootId:string;
 readonly sessionEpoch:number;
 readonly commandDigest:string;
 readonly envelopeDigest:string;
 readonly reportSequence:number;
 readonly status:'accepted'|'duplicate';
}
export type TransitDeliveryMessage={
 Command:TransitPreviewCommand;Report:TransitDeliveryReport;Ack:TransitDeliveryAck;
};
const schema=JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/adp-v3-transit-delivery.schema.json',import.meta.url),'utf8')) as {$id:string};
const fullStringRegExp=Object.assign(
 (pattern:string,flags:string)=>new RegExp(pattern.endsWith('$')?`${pattern.slice(0,-1)}$(?![\\s\\S])`:pattern,flags),
 {code:'fullStringRegExp'});
const ajv=new Ajv2020({strict:true,allErrors:true,code:{regExp:fullStringRegExp}});
const addFormats:(instance:Ajv2020)=>void=createRequire(import.meta.url)('ajv-formats');
addFormats(ajv);ajv.addSchema(schema);
const validators=new Map<string,ValidateFunction>();
for(const name of ['Command','Report','Ack'] as const)
 validators.set(name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`}));

export function parseTransitDelivery<K extends keyof TransitDeliveryMessage>(
 name:K,raw:string,
):TransitDeliveryMessage[K]{
 const value=parseJson(raw,8192);
 if(!validators.get(name)!(value))
  throw new Error('INVALID_CONFIG: Strict Transit transport-only envelope rejected');
 if(name==='Command'){
  const command=value as TransitPreviewCommand;
  const {envelopeDigest,...body}=command;
  if(digest(body)!==envelopeDigest)
   throw new Error('INTEGRITY_FAILURE: Transit preview digest differs');
  if(compareTimes(command.issuedAt,command.validUntil)>=0)
   throw new Error('INVALID_CONFIG: Transit preview time range');
 }
 return deepFreeze(value as TransitDeliveryMessage[K]);
}
