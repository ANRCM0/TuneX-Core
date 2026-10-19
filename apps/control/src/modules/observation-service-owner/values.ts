import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, jsonUtf8Bytes, observationObject, observationServerName, observationAddress,
    observationIdentityURN, observationEchoFingerprint, readObservationLeaf, parseObservationEchoConfig } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';
import { OBSERVATION_SERVICE_ALPN, OBSERVATION_SERVICE_LIMITS } from './contracts.ts';
import type { ObservationServiceAudit, ObservationServiceConfig, ObservationServiceHead, ObservationServiceReceipt,
    ObservationServiceRevision } from './contracts.ts';

export { observationObject, observationServerName, observationAddress };
export const observationServiceId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$(?![\s\S])/.test(value);
export const observationTime = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 253402300799999;
export const observationHash = (value: unknown): value is string => typeof value === 'string' && /^sha256:[a-f0-9]{64}$(?![\s\S])/.test(value);
export function observationServiceIdentity(scope: string, id: string) {
    if (!isId(scope) || !observationServiceId(id)) invalid('Valid scoped observation service identity required');
    return observationIdentityURN(scope,id);
}
export function observationTrust(config: ObservationServiceConfig, scope: string, id: string) {
    if(config.version===2) {
        observationServiceIdentity(scope,id);
        const fingerprint=observationEchoFingerprint(config.trust.publicKey);
        return deepFreeze({mode:'ed25519-echo-v1' as const,algorithm:'Ed25519' as const,
            fingerprint,keyUsage:'fixed-nonce-echo-only' as const});
    }
    const serviceIdentity = observationServiceIdentity(scope, id), encoded = config.trust.certificateDer;
    const leaf=readObservationLeaf(encoded,OBSERVATION_SERVICE_LIMITS.certificateBytes,
        ()=>[`DNS:${config.trust.serverName}`,`URI:${serviceIdentity}`].sort(),(facts,expected)=>{
            const {before,after,usage,sans}=facts;
            if (!facts.matchesDer || facts.ca || !facts.strongKey || !Array.isArray(usage) || usage.length !== 1 ||
                usage[0] !== '1.3.6.1.5.5.7.3.1' || sans.length !== 2 || sans.some((san,index)=>san!==expected[index]) ||
                !observationTime(before) || !observationTime(after) || before >= after ||
                config.validFrom < before || config.validUntil > after)
                invalid('Dedicated server-auth-only observation leaf, exact DNS/URI and certificate-bounded validity required');
        });
    return deepFreeze({ mode: 'pinned-leaf-v1' as const, fingerprint: leaf.fingerprint,
        serverName: config.trust.serverName, serviceIdentity, alpn: OBSERVATION_SERVICE_ALPN,
        certificateNotBefore: leaf.before, certificateNotAfter: leaf.after, chainValidation: 'not-used-exact-leaf-pin' as const });
}
export function parseObservationServiceConfig(input: unknown, scope: string, id: string): ObservationServiceConfig {
    const value = observationObject(input, ['version', 'purpose', 'endpoint', 'trust', 'validFrom', 'validUntil']);
    if(value.version===2) {
        let config:ObservationServiceConfig;
        try {config=parseObservationEchoConfig(value);} catch {return invalid('Bounded immutable Ed25519 echo configuration required');}
        if(!observationAddress(config.endpoint.address)||config.validUntil-config.validFrom>OBSERVATION_SERVICE_LIMITS.validityMs||
            jsonUtf8Bytes(config)>OBSERVATION_SERVICE_LIMITS.configBytes)invalid('Bounded non-metadata echo endpoint required');
        observationTrust(config,scope,id);
        return deepFreeze(config);
    }
    const endpoint = observationObject(value.endpoint, ['address', 'port']), trust = observationObject(value.trust, ['mode', 'serverName', 'certificateDer']);
    if (value.version !== 1 || value.purpose !== 'direct-ingress-tls-handshake' || !observationAddress(endpoint.address) ||
        !isCounter(endpoint.port) || endpoint.port > 65535 || trust.mode !== 'pinned-leaf-v1' ||
        !observationServerName(trust.serverName) || typeof trust.certificateDer !== 'string' ||
        !observationTime(value.validFrom) || !observationTime(value.validUntil) || value.validUntil <= value.validFrom ||
        value.validUntil - value.validFrom > OBSERVATION_SERVICE_LIMITS.validityMs)
        invalid('Bounded immutable observation service configuration required');
    const config: ObservationServiceConfig = { version: 1, purpose: 'direct-ingress-tls-handshake',
        endpoint: { address: endpoint.address, port: endpoint.port },
        trust: { mode: 'pinned-leaf-v1', serverName: trust.serverName, certificateDer: trust.certificateDer },
        validFrom: value.validFrom, validUntil: value.validUntil };
    if (jsonUtf8Bytes(config) > OBSERVATION_SERVICE_LIMITS.configBytes) invalid('Observation configuration byte limit exceeded');
    observationTrust(config, scope, id);
    return deepFreeze(config);
}
export function parseObservationServiceHead(input: unknown): ObservationServiceHead {
    const v = observationObject(input, ['serviceId', 'revision', 'configRevision', 'archived', 'recoverySuspended']);
    if (!observationServiceId(v.serviceId) || !isCounter(v.revision) || !isCounter(v.configRevision) ||
        v.configRevision > OBSERVATION_SERVICE_LIMITS.revisionsPerService || v.revision < v.configRevision ||
        typeof v.archived !== 'boolean' || typeof v.recoverySuspended !== 'boolean') invalid('Valid observation service head required');
    return { serviceId: v.serviceId, revision: v.revision, configRevision: v.configRevision, archived: v.archived, recoverySuspended: v.recoverySuspended };
}
export function parseObservationServiceRevision(input: unknown, scope: string, id: string): ObservationServiceRevision {
    const v = observationObject(input, ['configRevision', 'config', 'configDigest', 'createdBy', 'createdAt']);
    const config = parseObservationServiceConfig(v.config, scope, id);
    if (!isCounter(v.configRevision) || v.configRevision > OBSERVATION_SERVICE_LIMITS.revisionsPerService ||
        !observationHash(v.configDigest) || v.configDigest !== digest(config) || !isId(v.createdBy) || !observationTime(v.createdAt))
        invalid('Valid immutable observation revision required');
    return { configRevision: v.configRevision, config, configDigest: v.configDigest, createdBy: v.createdBy, createdAt: v.createdAt };
}
export function parseObservationServiceAudit(input: unknown): ObservationServiceAudit {
    const v = observationObject(input, ['id', 'serviceId', 'revision', 'configRevision', 'kind', 'actorId', 'createdAt']);
    if (!isId(v.id) || !observationServiceId(v.serviceId) || !isCounter(v.revision) || !isCounter(v.configRevision) ||
        v.configRevision > OBSERVATION_SERVICE_LIMITS.revisionsPerService || v.revision < v.configRevision ||
        !['publish', 'archive'].includes(v.kind as string) || !isId(v.actorId) || !observationTime(v.createdAt)) invalid('Valid observation audit required');
    return { id: v.id, serviceId: v.serviceId, revision: v.revision, configRevision: v.configRevision,
        kind: v.kind as ObservationServiceAudit['kind'], actorId: v.actorId, createdAt: v.createdAt };
}
export function parseObservationServiceReceipt(input: unknown, id: string): ObservationServiceReceipt {
    const v = observationObject(input, ['status', 'body']);
    const b = observationObject(v.body, ['serviceId', 'revision', 'configRevision', 'configDigest', 'archived', 'recoverySuspended', 'changed']);
    const head = parseObservationServiceHead({ serviceId: b.serviceId, revision: b.revision, configRevision: b.configRevision,
        archived: b.archived, recoverySuspended: b.recoverySuspended });
    if (head.serviceId !== id || !observationHash(b.configDigest) || typeof b.changed !== 'boolean' || v.status !== (b.changed ? 202 : 200))
        invalid('Valid observation service command receipt required');
    return { status: b.changed ? 202 : 200, body: { ...head, configDigest: b.configDigest, changed: b.changed } };
}
