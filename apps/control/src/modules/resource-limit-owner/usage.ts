import { isId } from '@tunex/core';
import { ControlError, invalid } from '../../framework/public.ts';
import type { NodeAuthorityStore, ResourceUsageStore, ResourceUsageReader, ResourceUsageConsumption,
    SharedResourceLimitRecord, TransactionBoundary } from '../../framework/public.ts';

interface BucketInput {bucketId:string;scopeId:string;actorId:string;revision:number;startsAt:string;endsAt:string;consumedBytes:string}
export interface ResourceUsageInput {
    version:1;nodeId:string;bootId:string;sessionEpoch:number;reportSequence:number;snapshotGeneration:number;buckets:BucketInput[];
}
export interface ResourceUsageApi {
    handle(node:string,fingerprint:string,epoch:number,input:unknown):Promise<{version:1;status:'accepted'|'duplicate'}>;
}
interface Options<Tx> {
    db:TransactionBoundary<Tx>;nodes:Pick<NodeAuthorityStore<Tx>,'credential'>;store:ResourceUsageStore<Tx>;
    now:()=>number;freshnessMs:number;
    codec:{digest(value:unknown):string;parseTime(value:string):number;formatTime(value:number):string};
}
const closed=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0;
const decimal=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(v)&&BigInt(v)<=9007199254740991n;
const rejected=():never=>{throw new ControlError('INTEGRITY_FAILURE',409,'Resource usage binding or counter history differs');};

/** Observes the existing Journal. It cannot admit, refund or reset payload work. */
export class ResourceUsage<Tx> implements ResourceUsageApi,ResourceUsageReader<Tx> {
    private readonly options:Options<Tx>;
    constructor(options:Options<Tx>) {
        this.options=options;
        if(!positive(options.freshnessMs))invalid('Bounded usage freshness required');
    }
    private time(value:unknown):number {
        if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))invalid('Canonical usage period required');
        const at=this.options.codec.parseTime(value);
        if(!Number.isSafeInteger(at)||at<0||this.options.codec.formatTime(at)!==value)invalid('Canonical usage period required');
        return at;
    }
    private input(value:unknown):ResourceUsageInput {
        if(!closed(value,['version','nodeId','bootId','sessionEpoch','reportSequence','snapshotGeneration','buckets'])||value.version!==1||
            !isId(value.nodeId)||!isId(value.bootId)||!positive(value.sessionEpoch)||!positive(value.reportSequence)||
            !positive(value.snapshotGeneration)||!Array.isArray(value.buckets)||value.buckets.length>1024)invalid('Closed bounded resource usage required');
        let previous='';
        for(const bucket of value.buckets){
            if(!closed(bucket,['bucketId','scopeId','actorId','revision','startsAt','endsAt','consumedBytes'])||
                !isId(bucket.bucketId)||!isId(bucket.scopeId)||!isId(bucket.actorId)||!positive(bucket.revision)||
                !decimal(bucket.consumedBytes)||bucket.bucketId<=previous)invalid('Sorted closed resource usage buckets required');
            if(this.time(bucket.startsAt)>=this.time(bucket.endsAt))invalid('Increasing usage period required');
            previous=bucket.bucketId;
        }
        return value as unknown as ResourceUsageInput;
    }
    async handle(node:string,fingerprint:string,epoch:number,raw:unknown) {
        const input=this.input(raw),o=this.options;
        if(node!==input.nodeId||epoch!==input.sessionEpoch)throw new ControlError('AUTHORIZATION_DENIED',403,'Resource usage identity differs');
        return o.db.transaction(async tx=>{
            const report=await o.store.lockReport(tx,node),at=o.now();
            const credential=await o.nodes.credential(tx,node,fingerprint);
            if(!credential||credential.valid_until<=at||credential.retire_after!==null&&credential.retire_after<=at)
                throw new ControlError('AUTHORIZATION_DENIED',403,'Current Node credential required');
            if(!report||report.sessionEpoch!==epoch||report.bootId!==input.bootId||report.reportSequence!==input.reportSequence||
                report.snapshotGeneration!==input.snapshotGeneration)throw new ControlError('STALE_GENERATION',409,'Current accepted Runtime report required');
            const digest=o.codec.digest(input),head=await o.store.lockHead(tx,node);
            if(head){
                if(head.sessionEpoch>epoch||head.sessionEpoch===epoch&&head.reportSequence>input.reportSequence)rejected();
                if(head.sessionEpoch===epoch&&head.reportSequence===input.reportSequence){
                    if(head.digest!==digest)rejected();
                    return {version:1 as const,status:'duplicate' as const};
                }
            }
            for(const bucket of input.buckets){
                const policy=await o.store.policy(tx,bucket.bucketId);
                const startsAt=this.time(bucket.startsAt),endsAt=this.time(bucket.endsAt);
                if(!policy||policy.nodeId!==node||policy.scopeId!==bucket.scopeId||policy.actorId!==bucket.actorId||
                    policy.startsAt!==startsAt||policy.endsAt!==endsAt||policy.revision<bucket.revision)rejected();
                const prior=await o.store.sample(tx,bucket.bucketId);
                if(prior&&(prior.nodeId!==node||prior.scopeId!==bucket.scopeId||prior.actorId!==bucket.actorId||
                    prior.startsAt!==startsAt||prior.endsAt!==endsAt||prior.revision>bucket.revision||
                    !decimal(prior.consumedBytes)||BigInt(prior.consumedBytes)>BigInt(bucket.consumedBytes)))rejected();
                await o.store.save(tx,{...bucket,nodeId:node,startsAt,endsAt,sessionEpoch:epoch,
                    reportSequence:input.reportSequence,snapshotGeneration:input.snapshotGeneration,receivedAt:report.receivedAt});
            }
            await o.store.receipt(tx,node,{sessionEpoch:epoch,reportSequence:input.reportSequence,digest});
            return {version:1 as const,status:'accepted' as const};
        });
    }
    async consumption(tx:Tx,record:SharedResourceLimitRecord):Promise<ResourceUsageConsumption> {
        const o=this.options,now=o.now(),sample=await o.store.sample(tx,record.bucketId);
        const periodStatus:ResourceUsageConsumption['periodStatus']=now<record.startsAt?'future':now>=record.endsAt?'ended':'active';
        const base={source:'agent-protected-journal' as const,accounting:'conservative-precharge' as const,
            remainingMeaning:'upper-bound-at-sample' as const,periodStatus};
        if(!sample)return {...base,status:'unknown',usedBytes:null,remainingBytes:null,receivedAt:null,policyRevision:null,sessionEpoch:null,reportSequence:null};
        if(sample.nodeId!==record.nodeId||sample.scopeId!==record.scopeId||sample.actorId!==record.actorId||
            sample.startsAt!==record.startsAt||sample.endsAt!==record.endsAt||sample.revision>record.revision||!decimal(sample.consumedBytes))rejected();
        const session=await o.store.session(tx,record.nodeId);
        const status=sample.revision!==record.revision?'policy-outdated':
            session!==sample.sessionEpoch?'stale':
            !Number.isSafeInteger(sample.receivedAt)||sample.receivedAt>now||now-sample.receivedAt>o.freshnessMs?'stale':'fresh';
        const remaining=record.byteLimit===null?null:BigInt(record.byteLimit)>BigInt(sample.consumedBytes)?
            (BigInt(record.byteLimit)-BigInt(sample.consumedBytes)).toString():'0';
        return {...base,status,usedBytes:sample.consumedBytes,remainingBytes:status==='fresh'?remaining:null,
            receivedAt:o.codec.formatTime(sample.receivedAt),policyRevision:sample.revision,sessionEpoch:sample.sessionEpoch,reportSequence:sample.reportSequence};
    }
}
