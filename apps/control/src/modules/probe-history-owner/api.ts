import type { ProbeMeasurementDescription } from '../probe-owner/public.ts';
import type { ProbeRunLosses, ProbeRunRecord } from './contracts.ts';
import type { PROBE_RUN_LIMITS } from './policy.ts';

export const PROBE_HISTORY_API_INTERFACE_VERSION=3 as const;

export interface ProbeRunView extends ProbeRunRecord {
    kind:ProbeMeasurementDescription['taskKind'];businessProtocol:string;point:ProbeMeasurementDescription['point'];independentProbe:boolean;
    applicationPayloadBytes:number;health:string;executionAuthorized:boolean;historical:boolean;permitExpired:boolean;
    resultExpired:boolean|null;resultSource:string;bindingMatchCurrent:string;resultDigestVerification:string;contentDigest:string;
}
export interface ProbeRunEnvelope {
    probeRunsVersion:number;scopeId:string;capturedAt:number;source:string;coverage:string;historyComplete:boolean;
    readOnly:boolean;executionAuthorized:boolean;health:string;networkCheck:string;consistency:string;limits:typeof PROBE_RUN_LIMITS;
}
export interface ProbeRunDetail extends ProbeRunEnvelope {run:ProbeRunView;losses:ProbeRunLosses|null}
export interface ProbeRunHistory extends ProbeRunEnvelope {
    window:{from:number;to:number};filters:{forwardId:string|null;nodeId:string|null;probeId:string|null;state:string|null;resultStatus:string|null};
    limit:number;items:ProbeRunView[];hasMore:boolean;nextCursor:string|null;losses:ProbeRunLosses|null;
}
export interface ProbeRunsApi {
    admitReadRequest<T>(action:()=>Promise<T>):Promise<T>;
    history(actor:string,scope:string,input?:Record<string,string>):Promise<ProbeRunHistory>;
    get(actor:string,scope:string,id:string):Promise<ProbeRunDetail>;
}
