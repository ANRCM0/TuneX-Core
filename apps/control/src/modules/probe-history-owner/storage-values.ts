import { freezeModuleValue } from '../../framework/public.ts';
import type { ProbeHistoryValues } from '../../framework/public.ts';
import type { ProbeRunRecord } from './contracts.ts';
import { parseProbeRunRecord, probeRunImmutable } from './values.ts';

export const probeRunStorageValues:ProbeHistoryValues<ProbeRunRecord>=
    freezeModuleValue({read:parseProbeRunRecord,immutable:probeRunImmutable});
