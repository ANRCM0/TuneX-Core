import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeJsonEncode, nativeUtf8Bytes } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';
import { notificationHash, notificationObject as object, notificationTime as time } from './endpoint-values.ts';
import { STATION_ALERT_REASONS } from '../station-alert-owner/public.ts';
import type { NotificationDelivery, NotificationDeliveryAttempt, NotificationDeliveryCode, NotificationDeliveryLosses, NotificationPayload } from './delivery-contracts.ts';
import type { StationAlertEvent, StationAlertReason, StationAlertRule } from '../station-alert-owner/public.ts';

export { NOTIFICATION_DELIVERY_LIMITS } from './policy.ts';
export const NOTIFICATION_DELIVERY_CODES: readonly NotificationDeliveryCode[]=Object.freeze(['HTTP_ACCEPTED','HTTP_REJECTED','DESTINATION_DENIED','DNS_DENIED',
    'DNS_FAILED','DNS_TIMEOUT','CAPACITY_UNAVAILABLE','REQUEST_INVALID','ABORTED','DEADLINE','RESPONSE_LIMIT','NETWORK_UNKNOWN','DISPATCH_DENIED','GUARD_FAILED',
    'CREDENTIAL_UNAVAILABLE','ATTEMPT_EXPIRED','EVENT_TOO_OLD','POLICY_CHANGED','ENDPOINT_CHANGED','AUTHORIZATION_REVOKED','CURRENT_SILENCE','RECOVERY_SUSPENDED','RATE_WAIT','CAPACITY_WAIT']);
export const NOTIFICATION_DELIVERY_STATUSES=Object.freeze(['queued','claimed','retry-wait','delivered','dead-letter','cancelled'] as const);
const code=(v:unknown):v is NotificationDeliveryCode=>typeof v==='string'&&NOTIFICATION_DELIVERY_CODES.includes(v as NotificationDeliveryCode);
const statusCode=(v:unknown)=>v===null||typeof v==='number'&&Number.isInteger(v)&&v>=100&&v<=599;
const terminal=(v:unknown)=>v==='delivered'||v==='dead-letter'||v==='cancelled';
export function notificationDeliveryId(scopeId:string,eventId:string,endpointId:string):string { return 'notify-'+digest({scopeId,eventId,endpointId}).slice(7); }
export function notificationAttemptId(deliveryId:string,fence:number):string { return 'attempt-'+digest({deliveryId,fence}).slice(7); }
export function parseNotificationPayload(input:unknown):NotificationPayload {
    const v=object(input,['notificationVersion','deliveryId','scopeId','event']), e=object(v.event,['id','policyId','configRevision','episode','kind','rule','target','reason','occurredAt']), t=object(e.target,['kind','id']);
    if (v.notificationVersion!==1||!isId(v.deliveryId)||!isId(v.scopeId)||!isId(e.id)||!isId(e.policyId)||!isCounter(e.configRevision)||!isCounter(e.episode)||
        !['firing','recovered','invalidated'].includes(e.kind as string)||!['forward-operation-failed','node-report-stale','node-credential-expiring','shared-usage-high','shared-period-ending','recent-path-probe-degraded'].includes(e.rule as string)||
        !isId(t.id)||(['forward-operation-failed','recent-path-probe-degraded'].includes(e.rule as string)?t.kind!=='forward':t.kind!=='node')||!STATION_ALERT_REASONS.includes(e.reason as StationAlertReason)||!time(e.occurredAt))
        invalid('Invalid bounded notification payload');
    return deepFreeze({notificationVersion:1,deliveryId:v.deliveryId,scopeId:v.scopeId,event:{id:e.id,policyId:e.policyId,configRevision:e.configRevision,
        episode:e.episode,kind:e.kind,rule:e.rule,target:{kind:t.kind,id:t.id},reason:e.reason,occurredAt:e.occurredAt}} as NotificationPayload);
}
export function notificationPayload(scopeId:string,deliveryId:string,event:StationAlertEvent):NotificationPayload {
    return parseNotificationPayload({notificationVersion:1,deliveryId,scopeId,event:{id:event.id,policyId:event.policyId,configRevision:event.configRevision,
        episode:event.episode,kind:event.kind,rule:event.config.rule,target:event.config.target,reason:event.reason,occurredAt:event.occurredAt}});
}
/** Closed v1 field order is stable across SQL JSON property reordering. */
export function notificationWireBody(value:NotificationPayload):string { return nativeJsonEncode(parseNotificationPayload(value)); }
export function parseNotificationDelivery(input:unknown):NotificationDelivery {
    const v=object(input,['id','eventId','policyId','endpointId','policyConfigRevision','endpointRevision','credentialRevision','policyManagedBy','endpointManagedBy',
        'authorityDigest','payload','payloadDigest','revision','status','attemptCount','fence','claimedAt','claimUntil','createdAt','updatedAt','nextAttemptAt','expiresAt',
        'lastCode','lastOutcome','lastStatusCode','recoverySuspended']);
    if (![v.id,v.eventId,v.policyId,v.endpointId,v.policyManagedBy,v.endpointManagedBy].every(isId)||
        ![v.policyConfigRevision,v.endpointRevision,v.credentialRevision,v.revision].every(n=>isCounter(n))||
        !isCounter(v.attemptCount,true)||v.attemptCount>6||!isCounter(v.fence,true)||v.fence!==v.attemptCount||
        !notificationHash(v.authorityDigest)||!notificationHash(v.payloadDigest)||!NOTIFICATION_DELIVERY_STATUSES.includes(v.status as NotificationDelivery['status'])||
        ![v.createdAt,v.updatedAt,v.nextAttemptAt,v.expiresAt].every(time)||
        v.claimedAt!==null&&!time(v.claimedAt)||v.claimUntil!==null&&!time(v.claimUntil)||
        v.lastCode!==null&&!code(v.lastCode)||!['none','delivered','rejected','unknown'].includes(v.lastOutcome as string)||!statusCode(v.lastStatusCode)||typeof v.recoverySuspended!=='boolean')
        invalid('Invalid bounded notification delivery');
    const value=v as unknown as NotificationDelivery, payload=parseNotificationPayload(v.payload);
    if (value.credentialRevision>value.endpointRevision||value.updatedAt<value.createdAt||value.expiresAt!==value.createdAt+3600000||
        payload.deliveryId!==value.id||payload.event.id!==value.eventId||payload.event.policyId!==value.policyId||payload.event.configRevision!==value.policyConfigRevision||
        payload.event.occurredAt!==value.createdAt||notificationDeliveryId(payload.scopeId,value.eventId,value.endpointId)!==value.id||
        digest(payload)!==value.payloadDigest||nativeUtf8Bytes(notificationWireBody(payload))>4096) invalid('Invalid immutable notification association');
    if (value.status==='claimed' ? value.attemptCount<1||value.claimedAt===null||value.claimUntil!==value.claimedAt+30000||
        value.claimedAt<value.createdAt||value.nextAttemptAt<value.claimUntil : value.claimedAt!==null||value.claimUntil!==null) invalid('Invalid notification claim');
    if (terminal(value.status)&&value.nextAttemptAt!==0||!terminal(value.status)&&value.nextAttemptAt<value.createdAt||
        value.status==='queued'&&(value.attemptCount!==0||value.lastOutcome!=='none')||value.status==='retry-wait'&&value.attemptCount<1||
        value.status==='delivered'&&(value.lastOutcome!=='delivered'||value.lastCode!=='HTTP_ACCEPTED'||value.lastStatusCode===null||value.lastStatusCode<200||value.lastStatusCode>=300))
        invalid('Invalid notification lifecycle state');
    return deepFreeze({...value,payload});
}
export function parseNotificationDeliveryAttempt(input:unknown):NotificationDeliveryAttempt {
    const v=object(input,['id','deliveryId','ordinal','fence','startedAt','finishedAt','outcome','code','statusCode']);
    if (!isId(v.id)||!isId(v.deliveryId)||!isCounter(v.ordinal)||v.ordinal>6||!isCounter(v.fence)||v.fence!==v.ordinal||
        !time(v.startedAt)||v.finishedAt!==null&&!time(v.finishedAt)||!['pending','delivered','rejected','unknown'].includes(v.outcome as string)||
        v.code!==null&&!code(v.code)||!statusCode(v.statusCode)) invalid('Invalid notification attempt');
    const value=v as unknown as NotificationDeliveryAttempt;
    if (value.id!==notificationAttemptId(value.deliveryId,value.fence)||
        (value.outcome==='pending'?value.finishedAt!==null||value.code!==null||value.statusCode!==null:value.finishedAt===null||value.finishedAt<value.startedAt||value.code===null)||
        value.outcome==='delivered'&&(value.code!=='HTTP_ACCEPTED'||value.statusCode===null||value.statusCode<200||value.statusCode>=300)) invalid('Invalid notification attempt result');
    return deepFreeze({...value});
}
export function parseNotificationDeliveryLosses(input:unknown):NotificationDeliveryLosses {
    const v=object(input,['queueRejected','routingRejected','silenceSuppressed','disabledSuppressed','rowsExpired','rowsEvicted','attemptsEvicted']);
    if (!Object.values(v).every(n=>isCounter(n,true))) invalid('Invalid notification retention accounting');
    return {...v} as unknown as NotificationDeliveryLosses;
}
export function publicNotificationDelivery(value:NotificationDelivery) {
    return {id:value.id,eventId:value.eventId,policyId:value.policyId,endpointId:value.endpointId,policyConfigRevision:value.policyConfigRevision,
        endpointRevision:value.endpointRevision,credentialRevision:value.credentialRevision,payloadDigest:value.payloadDigest,revision:value.revision,status:value.status,
        attemptCount:value.attemptCount,fence:value.fence,claimedAt:value.claimedAt,claimUntil:value.claimUntil,createdAt:value.createdAt,updatedAt:value.updatedAt,
        nextAttemptAt:value.nextAttemptAt,expiresAt:value.expiresAt,lastCode:value.lastCode,lastOutcome:value.lastOutcome,lastStatusCode:value.lastStatusCode,
        recoverySuspended:value.recoverySuspended,event:{kind:value.payload.event.kind,rule:value.payload.event.rule as StationAlertRule,target:value.payload.event.target,
            episode:value.payload.event.episode,occurredAt:value.payload.event.occurredAt,reason:value.payload.event.reason}};
}
