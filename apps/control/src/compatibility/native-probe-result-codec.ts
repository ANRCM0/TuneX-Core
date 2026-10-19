// Keep the restored entrypoint on the one native result implementation.
export { nativeProbeResultRequest, nativeStoredProbeResultCheck, nativeProbeResultAck,
    nativeProbeTypesResultAck, nativeProbeServicesResultAck } from './native-probe-result.ts';
export type { NativeStoredProbeResult, NativeProbeResultEnvelope, NativeProbeResultReceipt,
    NativeProbeMeasurementProjection } from './native-probe-result.ts';
