import type { CommandResponse, NotificationEndpointRecord, NotificationEndpointAuditRecord, NotificationEndpointStorage } from '../../framework/public.ts';
import type { StationAlertEvent } from '../station-alert-owner/public.ts';
export type { NotificationSecretBinding, NotificationDestination, NotificationSecretLease, NotificationSecrets,
    NotificationSendCode, NotificationSendResult, NotificationSender } from '../../framework/public.ts';

export interface NotificationEndpointConfig {
    schemaVersion: 1; enabled: boolean; policyIds: string[]; kinds: StationAlertEvent['kind'][]; minimumIntervalSeconds: number;
}
export interface NotificationEndpoint extends NotificationEndpointRecord<NotificationEndpointConfig,'none'|'recovery'> {}
export interface NotificationEndpointAudit extends NotificationEndpointAuditRecord<'publish'|'disable'> {}
export interface NotificationEndpointStore<Tx> extends NotificationEndpointStorage<Tx,NotificationEndpoint,NotificationEndpointAudit> {}
export type NotificationEndpointReceipt = CommandResponse & { body: { endpointId: string; revision: number; changed: boolean } };
