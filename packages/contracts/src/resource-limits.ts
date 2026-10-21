export const SHARED_RESOURCE_LIMITS_CAPABILITY='shared-resource-limits.v1' as const;

export interface ResourceLimitBucket {
    bucketId:string;scopeId:string;actorId:string;nodeId:string;revision:number;
    startsAt:string;endsAt:string;bytesPerSecond:number|null;burstBytes:number;
    byteLimit:number|null;assignmentIds:string[];
}
export interface ResourceLimits {version:1;buckets:ResourceLimitBucket[]}
import { compareTimes } from './time.ts';
import type { RuntimeSnapshotValue } from './execution-values.ts';


/** Closed field validation belongs to ADP schemas; these are cross-record invariants. */
export function validateResourceLimits(snapshot:RuntimeSnapshotValue):void {
    if(snapshot.resourceLimits===undefined)return;
    const assignments=new Set(snapshot.assignments.map(assignment=>assignment.assignmentId));
    const used=new Set<string>(),subjects=new Set<string>();
    let previous='';
    for(const bucket of snapshot.resourceLimits.buckets){
        const subject=`${bucket.scopeId}/${bucket.actorId}/${bucket.nodeId}`;
        for(const value of [bucket.startsAt,bucket.endsAt]){
            const at=Date.parse(value);
            if(!Number.isSafeInteger(at)||new Date(at).toISOString()!==value)
                throw new Error('INVALID_CONFIG: Resource period requires canonical millisecond UTC time');
        }
        if(bucket.bucketId<=previous||subjects.has(subject)||bucket.nodeId!==snapshot.nodeId||
            compareTimes(bucket.startsAt,bucket.endsAt)>=0||compareTimes(bucket.startsAt,snapshot.issuedAt)>0||
            compareTimes(snapshot.issuedAt,bucket.endsAt)>=0)
            throw new Error('INVALID_CONFIG: Resource limit bucket binding, order or period differs');
        previous=bucket.bucketId;subjects.add(subject);
        let priorAssignment='';
        for(const assignmentId of bucket.assignmentIds){
            if(assignmentId<=priorAssignment||!assignments.has(assignmentId)||used.has(assignmentId))
                throw new Error('INVALID_CONFIG: Resource limit assignment reference differs');
            priorAssignment=assignmentId;used.add(assignmentId);
        }
    }
}
