import { SharedResourceLimits, SharedResourceLimitPublicationPolicy } from '../../apps/control/src/modules/resource-limit-owner/public.ts';
import type { SharedResourceLimitApi, SharedResourceLimitOptions, SharedResourceLimitPublicationOptions } from '../../apps/control/src/modules/resource-limit-owner/public.ts';
import type { RuntimePayloadPolicy, OfflinePayloadPolicy } from '../../apps/control/src/framework/public.ts';

/** Composition supplies the existing owners; this example creates no store or authority. */
export function sharedPayloadOwners<Tx>(options:SharedResourceLimitOptions<Tx>):{
    commands:SharedResourceLimitApi;publication:RuntimePayloadPolicy<Tx>;offline:OfflinePayloadPolicy<Tx>;
} {
    const commands=new SharedResourceLimits(options);
    const policyOptions:SharedResourceLimitPublicationOptions<Tx>={nodes:options.nodes,
        owners:options.owners,store:options.store,codec:{formatTime:at=>options.codec.formatTime(at)}};
    return {commands,publication:commands,offline:new SharedResourceLimitPublicationPolicy(policyOptions)};
}

export async function configureExplicitPeriod(api:SharedResourceLimitApi,request:{
    governanceActor:string;scopeId:string;nodeId:string;subjectActor:string;
    requestId:string;expectedRevision:number;startsAt:string;endsAt:string;
}) {
    return api.set(request.governanceActor,request.scopeId,request.nodeId,request.subjectActor,request.requestId,{
        expectedRevision:request.expectedRevision,startsAt:request.startsAt,endsAt:request.endsAt,
        bytesPerSecond:1048576,burstBytes:65536,byteLimit:10737418240,
    });
}
