import type { ObservationMetadataHead, ObservationMetadataRevision, ObservationMetadataAudit, ObservationMetadataStorage } from '../../framework/public.ts';

export const OBSERVATION_SERVICE_LIMITS = {
    servicesPerScope: 32, revisionsPerService: 64, auditPerScope: 256, auditPage: 16,
    certificateBytes: 8192, configBytes: 16384, responseBytes: 131072, validityMs: 604800000,
} as const;
export const OBSERVATION_SERVICE_ALPN = 'tunex-observation/1' as const;
export interface ObservationTLSServiceConfig {
    readonly version: 1;
    readonly purpose: 'direct-ingress-tls-handshake';
    readonly endpoint: { readonly address: string; readonly port: number };
    readonly trust: { readonly mode: 'pinned-leaf-v1'; readonly serverName: string; readonly certificateDer: string };
    readonly validFrom: number;
    readonly validUntil: number;
}
export interface ObservationEchoServiceConfig {
    readonly version: 2;
    readonly purpose: 'controlled-nonce-echo';
    readonly endpoint: { readonly address: string; readonly port: number; readonly protocols: readonly ('tcp'|'udp')[] };
    readonly trust: { readonly mode: 'ed25519-echo-v1'; readonly publicKey: string };
    readonly validFrom: number;
    readonly validUntil: number;
}
export type ObservationServiceConfig = ObservationTLSServiceConfig | ObservationEchoServiceConfig;
export interface ObservationServiceHead extends ObservationMetadataHead {}
export interface ObservationServiceRevision extends ObservationMetadataRevision<ObservationServiceConfig> {}
export interface ObservationServiceAudit extends ObservationMetadataAudit<'publish'|'archive'> {}
export interface ObservationServiceReceipt {
    status: 200 | 202;
    body: { serviceId: string; revision: number; configRevision: number; configDigest: string;
        archived: boolean; recoverySuspended: boolean; changed: boolean };
}
/** Owns configuration declarations only; no probe, network, secret or Runtime authority. */
export interface ObservationServiceStore<Tx> extends ObservationMetadataStorage<Tx,ObservationServiceConfig,ObservationServiceAudit['kind']> {}


export interface ObservationServiceReference {
    readonly serviceId:string;
    readonly revision:number;
    readonly configRevision:number;
    readonly configDigest:string;
}
/** Existing declaration reads in the caller's transaction; never a publisher or permit issuer. */
export interface ObservationServiceReadPort<Tx> {
    head(tx:Tx,scope:string,id:string,lock?:boolean):Promise<ObservationServiceHead|null>;
    revision(tx:Tx,scope:string,id:string,revision:number):Promise<ObservationServiceRevision|null>;
}
