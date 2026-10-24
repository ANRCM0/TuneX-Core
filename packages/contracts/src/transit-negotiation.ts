import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { deepFreeze } from '@tunex/core';
import { parseJson } from './json.ts';

export const TRANSIT_NEGOTIATION_CAPABILITIES =
  ['adp.multihop.1','transit.wire.1','native.transit.v1'] as const;
export interface TransitNegotiationRequest {
  readonly protocolVersion:3;
  readonly extensionVersion:1;
  readonly nodeId:string;
  readonly bootId:string;
  readonly sessionEpoch:number;
  readonly requiredCapabilities:typeof TRANSIT_NEGOTIATION_CAPABILITIES;
  readonly lastStoredTransitGeneration:number;
}
export interface TransitNegotiationResponse {
  readonly protocolVersion:3;
  readonly extensionVersion:1;
  readonly nodeId:string;
  readonly bootId:string;
  readonly sessionEpoch:number;
  readonly requiredCapabilities:typeof TRANSIT_NEGOTIATION_CAPABILITIES;
  readonly serverTime:string;
  readonly state:'contract-only';
  readonly executionEnabled:false;
}
const schema=JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/adp-v3-transit-negotiation.schema.json',import.meta.url),'utf8')) as {$id:string};
const ajv=new Ajv2020({strict:true,allErrors:true});
const addFormats:(instance:Ajv2020)=>void=createRequire(import.meta.url)('ajv-formats');
addFormats(ajv);
ajv.addSchema(schema);
const validators=new Map<string,ValidateFunction>();
for (const name of ['Request','Response'] as const)
  validators.set(name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`}));
export function parseTransitNegotiation<K extends 'Request'|'Response'>(
  name:K,raw:string,
):K extends 'Request'?TransitNegotiationRequest:TransitNegotiationResponse {
  const value=parseJson(raw,8192);
  if (!validators.get(name)!(value))
    throw new Error('INVALID_CONFIG: Unsupported Transit negotiation shape or capabilities');
  return deepFreeze(value) as K extends 'Request'?TransitNegotiationRequest:TransitNegotiationResponse;
}
/** Advertised parsing ability is NOT permission to execute or issue a lease. */
export function checkTransitNegotiation(
  request:TransitNegotiationRequest,response:TransitNegotiationResponse,
):void{
  if(response.nodeId!==request.nodeId||response.bootId!==request.bootId||
      response.sessionEpoch!==request.sessionEpoch||response.executionEnabled!==false||
      response.state!=='contract-only')
    throw new Error('AUTHORIZATION_DENIED: Transit handshake session or execution boundary differs');
}
