import { freezeModuleValue } from '../../framework/public.ts';
import type { ObservationMetadataValues } from '../../framework/public.ts';
import type { ObservationServiceConfig, ObservationServiceAudit } from './contracts.ts';

// Preserve the old storage projection; full config/trust validation stays at the
// original application call points rather than being moved earlier into SQL.
export const observationServiceStorageValues:ObservationMetadataValues<ObservationServiceConfig,ObservationServiceAudit['kind']>=freezeModuleValue({
    config:(input:unknown)=>input as ObservationServiceConfig,
    auditKind:(input:unknown):input is ObservationServiceAudit['kind']=>['publish','archive'].includes(input as string),
});
