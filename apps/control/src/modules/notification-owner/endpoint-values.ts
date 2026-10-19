import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, parseNotificationDestinationUrl } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';
import type { NotificationDestination, NotificationEndpoint, NotificationEndpointAudit, NotificationEndpointConfig } from './endpoint-contracts.ts';

export { NOTIFICATION_ENDPOINT_LIMITS } from './policy.ts';
export const notificationTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999;
export const notificationHash = (value: unknown): value is string => typeof value === 'string' && value.length===71 && /^sha256:[a-f0-9]{64}$/.test(value);
export const notificationReference = (value: unknown): value is string => typeof value === 'string' && value.length===64 && /^[a-f0-9]{64}$/.test(value);
export function notificationObject(value: unknown, keys: string[]): Record<string,unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value)) ||
        Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) invalid('Closed notification configuration required');
    return value as Record<string,unknown>;
}
function ordered<T extends string>(value: unknown, allowed: (item: unknown) => item is T, maximum: number): T[] {
    if (!Array.isArray(value) || !value.length || value.length > maximum || value.some(item=>!allowed(item)) ||
        value.some((item,index)=>index>0 && value[index-1]>=item)) invalid('Unique sorted notification selections required');
    return [...value] as T[];
}
export function parseNotificationEndpointConfig(input: unknown): NotificationEndpointConfig {
    const value=notificationObject(input,['schemaVersion','enabled','policyIds','kinds','minimumIntervalSeconds']);
    if (value.schemaVersion!==1 || typeof value.enabled!=='boolean' || typeof value.minimumIntervalSeconds!=='number' ||
        !Number.isInteger(value.minimumIntervalSeconds) || value.minimumIntervalSeconds<10 || value.minimumIntervalSeconds>3600)
        invalid('Bounded notification subscription required');
    return deepFreeze({schemaVersion:1,enabled:value.enabled,policyIds:ordered(value.policyIds,isId,16),
        kinds:ordered(value.kinds,(item): item is NotificationEndpointConfig['kinds'][number]=>['firing','invalidated','recovered'].includes(item as string),3),
        minimumIntervalSeconds:value.minimumIntervalSeconds});
}
export function parseNotificationDestination(input: unknown): NotificationDestination {
    const value=notificationObject(input,['url','signingKey']);
    if (typeof value.url!=='string' || typeof value.signingKey!=='string' || value.signingKey.length!==64 || !/^[a-f0-9]{64}$/.test(value.signingKey))
        invalid('Canonical destination and 32-byte lowercase hexadecimal signing key required');
    const destination=parseNotificationDestinationUrl(value.url);
    return {url:destination.url,signingKey:value.signingKey};
}
export function parseNotificationEndpoint(input: unknown): NotificationEndpoint {
    const v=notificationObject(input,['endpointId','revision','credentialRevision','config','configDigest','managedBy','createdAt','updatedAt','suspended','authorityDigest','credentialRef']);
    if (!isId(v.endpointId) || !isId(v.managedBy) || !isCounter(v.revision) || !isCounter(v.credentialRevision) || v.credentialRevision>v.revision ||
        !notificationTime(v.createdAt) || !notificationTime(v.updatedAt) || v.updatedAt<v.createdAt || !['none','recovery'].includes(v.suspended as string) ||
        !notificationHash(v.configDigest) || !notificationHash(v.authorityDigest) || !notificationReference(v.credentialRef)) invalid('Invalid notification endpoint state');
    const config=parseNotificationEndpointConfig(v.config);
    if (digest(config)!==v.configDigest) invalid('Invalid notification endpoint state');
    return deepFreeze({endpointId:v.endpointId,revision:v.revision,credentialRevision:v.credentialRevision,config,configDigest:v.configDigest,
        managedBy:v.managedBy,createdAt:v.createdAt,updatedAt:v.updatedAt,suspended:v.suspended as NotificationEndpoint['suspended'],
        authorityDigest:v.authorityDigest,credentialRef:v.credentialRef});
}
export function parseNotificationEndpointAudit(input: unknown): NotificationEndpointAudit {
    const v=notificationObject(input,['id','endpointId','revision','kind','actorId','createdAt']);
    if (!isId(v.id) || !isId(v.endpointId) || !isCounter(v.revision) || !isId(v.actorId) || !notificationTime(v.createdAt) ||
        !['publish','disable'].includes(v.kind as string)) invalid('Invalid notification management audit');
    return {id:v.id,endpointId:v.endpointId,revision:v.revision,kind:v.kind as NotificationEndpointAudit['kind'],actorId:v.actorId,createdAt:v.createdAt};
}
export function publicNotificationEndpoint(value: NotificationEndpoint) {
    return {endpointId:value.endpointId,revision:value.revision,credentialRevision:value.credentialRevision,config:value.config,configDigest:value.configDigest,
        managedBy:value.managedBy,createdAt:value.createdAt,updatedAt:value.updatedAt,suspended:value.suspended,
        credentials:{configured:true,verification:'not-read-on-get'}};
}
