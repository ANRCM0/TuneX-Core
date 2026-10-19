import { isId, isCounter, isPort, normalizeIp } from '@tunex/core';
import { digest, validCidr } from '@tunex/contracts/shared';
import { invalid } from '../framework/public.ts';
import type { AuthorizedNodeFacts, NodeAuthorityCodec } from '../framework/public.ts';
import { readStoredValue } from './stored-value.ts';
import { targetAllowed } from './native-target-policy.ts';
import { nativeIsoTime } from './native-module-values.ts';

export function validatePolicy(policy:Omit<AuthorizedNodeFacts,'nodeId'|'scopeId'|'capabilities'>):void {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy) || Object.keys(policy).sort().join(',') !== ['allowedDestinationCidrs', 'allowedListenerAddresses', 'allowedPorts', 'allowMetadataTargets', 'egressPolicyRevision'].sort().join(',') || !Array.isArray(policy.allowedListenerAddresses) || policy.allowedListenerAddresses.length === 0 || policy.allowedListenerAddresses.length > 256 || policy.allowedListenerAddresses.some(a => typeof a !== 'string' || normalizeIp(a) !== a) || new Set(policy.allowedListenerAddresses).size !== policy.allowedListenerAddresses.length || !Array.isArray(policy.allowedPorts) || policy.allowedPorts.length === 0 || policy.allowedPorts.length > 65535 || policy.allowedPorts.some(p => !isPort(p)) || new Set(policy.allowedPorts).size !== policy.allowedPorts.length || !isCounter(policy.egressPolicyRevision) || !Array.isArray(policy.allowedDestinationCidrs) || policy.allowedDestinationCidrs.length === 0 || policy.allowedDestinationCidrs.length > 256 || policy.allowedDestinationCidrs.some(c => typeof c !== 'string' || !validCidr(c)) || new Set(policy.allowedDestinationCidrs).size !== policy.allowedDestinationCidrs.length || typeof policy.allowMetadataTargets !== 'boolean')
        invalid('Invalid Node policy');
}
export const nativeNodeCodec:NodeAuthorityCodec=Object.freeze({
    digest,readValue:readStoredValue,isId,isCounter,targetAllowed,validateNetworkPolicy:validatePolicy,formatTime:nativeIsoTime,
    validEnrollmentToken:(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(value),
    validCredentialRequest:(value:unknown):value is string=>!(typeof value!=='string'||value.length>16384||!value.startsWith('-----BEGIN CERTIFICATE REQUEST-----')),
    supportsDirectRuntime:(facts:AuthorizedNodeFacts):boolean=>facts.capabilities.includes('adp.3')&&facts.capabilities.includes('native.direct.v1'),
    relayFingerprint:(fingerprint:string):string=>`sha256:${fingerprint}`,
});
