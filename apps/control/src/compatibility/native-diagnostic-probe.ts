import { parseProbeResult, parseProbeTypes, parseProbeServices } from './native-http-codecs.ts';
import { probeResultBody, probeTypesResultBody, probeServicesResultBody } from './native-observability-codecs.ts';
import type { ProbeResultRequest, ProbeTypesResultRequest, ProbeServicesResultRequest } from './native-observability-codecs.ts';
import { nativeJsonEncode } from './native-module-values.ts';

export type NativeDiagnosticProbeResult=ProbeResultRequest|ProbeTypesResultRequest|ProbeServicesResultRequest;

/** Original retained v3/v2/v1 framing, without admission or retained-state decisions. */
export function nativeDiagnosticProbeResult(value:object):NativeDiagnosticProbeResult {
    const input={...value,requestId:'0'.repeat(64)};
    const version=(input as {probeVersion?:unknown}).probeVersion;
    return version===3?parseProbeServices('ResultRequest',nativeJsonEncode(input)):
        version===2?parseProbeTypes('ResultRequest',nativeJsonEncode(input)):parseProbeResult('Request',nativeJsonEncode(input));
}

/** Separate projection preserves its original position outside the parse-error catch. */
export function nativeDiagnosticProbeResultBody(parsed:NativeDiagnosticProbeResult) {
    return parsed.probeVersion===3?probeServicesResultBody(parsed):
        parsed.probeVersion===2?probeTypesResultBody(parsed):probeResultBody(parsed);
}
