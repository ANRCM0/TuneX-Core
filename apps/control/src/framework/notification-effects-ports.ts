import type { CancellationSignal } from './cancellation-ports.ts';

export const NOTIFICATION_EFFECTS_INTERFACE_VERSION=2 as const;

export interface NotificationSecretBinding {
    scopeId: string; endpointId: string; credentialRevision: number; authorityDigest: string;
}
export interface NotificationDestination { url: string; signingKey: string }
export interface NotificationSecretLease { destination: NotificationDestination; release(): void }
/** Opaque references only enter SQL; implementations never use Authority signing material. */
export interface NotificationSecrets {
    stage(binding: NotificationSecretBinding, requestDigest: string, destination: NotificationDestination, keepReference: string | null): Promise<string>;
    read(binding: NotificationSecretBinding, reference: string): Promise<NotificationDestination>;
    acquire(binding: NotificationSecretBinding, reference: string): Promise<NotificationSecretLease>;
    close(): Promise<void>;
}
export type NotificationSendCode = 'HTTP_ACCEPTED' | 'HTTP_REJECTED' | 'DESTINATION_DENIED' | 'DNS_DENIED' | 'DNS_FAILED' |
    'DNS_TIMEOUT' | 'CAPACITY_UNAVAILABLE' | 'REQUEST_INVALID' | 'ABORTED' | 'DEADLINE' | 'RESPONSE_LIMIT' | 'NETWORK_UNKNOWN' | 'DISPATCH_DENIED' | 'GUARD_FAILED';
export interface NotificationSendResult {
    outcome: 'delivered' | 'rejected' | 'unknown'; code: NotificationSendCode; statusCode: number | null;
}
export interface NotificationSender {
    send(input: { destination: string; deliveryId: string; body: string; secret: Uint8Array; beforeDispatch: () => Promise<boolean>; signal?: CancellationSignal }): Promise<NotificationSendResult>;
    idle(): Promise<void>;
    close(): Promise<void>;
}
