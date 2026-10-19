import { isCounter } from '@tunex/core';
import { invalid } from '../../framework/public.ts';
import { observationObject, observationServiceId, observationHash } from './values.ts';
import type { ObservationServiceReference } from './contracts.ts';
export function parseProbeServiceReference(input: unknown): ObservationServiceReference {
    const value = observationObject(input, ['serviceId', 'revision', 'configRevision', 'configDigest']);
    if (!observationServiceId(value.serviceId) || !isCounter(value.revision) || !isCounter(value.configRevision) ||
        value.configRevision > 64 || value.revision < value.configRevision || !observationHash(value.configDigest))
        invalid('Exact current observation service reference required');
    return { serviceId: value.serviceId, revision: value.revision, configRevision: value.configRevision, configDigest: value.configDigest };
}
