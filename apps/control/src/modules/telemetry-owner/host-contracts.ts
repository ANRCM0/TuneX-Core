import type { HostTelemetrySample } from '../../compatibility/public.ts';
import type { TelemetryStorage } from '../../framework/public.ts';

export interface HostTelemetryStore<Tx> extends TelemetryStorage<Tx,HostTelemetrySample> {}
