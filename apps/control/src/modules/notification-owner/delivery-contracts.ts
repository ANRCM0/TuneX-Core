import type { NotificationSendCode } from './endpoint-contracts.ts';
import type { StationAlertEvent, StationAlertReason, StationAlertRule } from '../station-alert-owner/public.ts';
import type { NotificationOutboxRecord, NotificationAttemptRecord, NotificationOutboxHeader, NotificationOutboxLosses,
    NotificationOutboxLoss, NotificationOutboxQuery, NotificationOutboxStorage } from '../../framework/public.ts';

export type NotificationDeliveryStatus = 'queued' | 'claimed' | 'retry-wait' | 'delivered' | 'dead-letter' | 'cancelled';
export type NotificationDeliveryCode = NotificationSendCode | 'CREDENTIAL_UNAVAILABLE' | 'ATTEMPT_EXPIRED' | 'EVENT_TOO_OLD' |
    'POLICY_CHANGED' | 'ENDPOINT_CHANGED' | 'AUTHORIZATION_REVOKED' | 'CURRENT_SILENCE' | 'RECOVERY_SUSPENDED' | 'RATE_WAIT' | 'CAPACITY_WAIT';
export interface NotificationPayload {
    notificationVersion: 1; deliveryId: string; scopeId: string;
    event: { id: string; policyId: string; configRevision: number; episode: number; kind: StationAlertEvent['kind'];
        rule: StationAlertRule; target: { kind: 'forward' | 'node'; id: string }; reason: StationAlertReason; occurredAt: number };
}
export interface NotificationDelivery extends NotificationOutboxRecord<NotificationPayload,NotificationDeliveryStatus,NotificationDeliveryCode,'none'|'delivered'|'rejected'|'unknown'> {}
export interface NotificationDeliveryAttempt extends NotificationAttemptRecord<NotificationDeliveryCode,'pending'|'delivered'|'rejected'|'unknown'> {}
export interface NotificationDeliveryLosses extends NotificationOutboxLosses {}
export type NotificationDeliveryLoss=NotificationOutboxLoss;
export interface NotificationDeliveryQuery extends NotificationOutboxQuery<NotificationDeliveryStatus> {}
export interface NotificationDeliveryHeader extends NotificationOutboxHeader {}
export interface NotificationDeliveryStore<Tx> extends NotificationOutboxStorage<Tx,NotificationDelivery,NotificationDeliveryAttempt> {}
export type { StationEventHandoff } from '../station-alert-owner/public.ts';
