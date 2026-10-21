export const OBSERVATION_SERVICE_MODULE_INTERFACE_VERSION=2 as const;
export { observationObject, observationServerName, observationAddress, observationServiceId, observationTime, observationHash,
    observationServiceIdentity, observationTrust, parseObservationServiceConfig, parseObservationServiceHead,
    parseObservationServiceRevision, parseObservationServiceAudit, parseObservationServiceReceipt } from './values.ts';
export { parseProbeServiceReference, parseProbeServiceReference as parseObservationServiceReference } from './reference.ts';
export type { ObservationServiceReference, ObservationServiceReadPort } from './contracts.ts';
export { OBSERVATION_SERVICE_ALPN, OBSERVATION_SERVICE_LIMITS } from './contracts.ts';
export type { ObservationTLSServiceConfig, ObservationEchoServiceConfig, ObservationServiceConfig, ObservationServiceHead,
    ObservationServiceRevision, ObservationServiceAudit, ObservationServiceReceipt, ObservationServiceStore } from './contracts.ts';
export { ObservationServices } from './service.ts';
export { observationServiceStorageValues } from './storage-values.ts';
export { OBSERVATION_SERVICE_API_INTERFACE_VERSION } from './api.ts';
export type { ObservationServiceTrust, ObservationServiceEnvelope, ObservationServiceList, ObservationServiceDetail,
    ObservationServicesApi } from './api.ts';
