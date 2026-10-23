import { ControlError } from '../../framework/public.ts';
import { nativeParseTime, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ResourceLimitAlertReader } from '../resource-limit-owner/public.ts';
import type { StationAlertFacts, StationAlertConfig, StationAlertFact } from './contracts.ts';

/** Combines public observations in the Station caller's transaction; writes nothing. */
export class StationResourceFacts<Tx> implements StationAlertFacts<Tx> {
    constructor(private readonly original:StationAlertFacts<Tx>,private readonly limits:ResourceLimitAlertReader<Tx>,
        private readonly now:()=>number=nativeWallClockSource()) {}
    async read(tx:Tx,scope:string,config:StationAlertConfig,actor?:string):Promise<StationAlertFact|null> {
        const base=await this.original.read(tx,scope,config,actor);
        if(config.schemaVersion!==2||!base||base.kind!=='node')return base;
        if(!actor)throw new ControlError('AUTHORIZATION_DENIED',403,'Resource alert managing actor required');
        const value=await this.limits.forAlertIn(tx,actor,scope,config.target.id,config.subjectActorId,this.now());
        if(!value)return {...base,resource:null};
        const {policy,consumption}=value;
        return {...base,resource:{kind:'resource-limit',targetId:policy.nodeId,actorId:policy.actorId,bucketId:policy.bucketId,
            policyRevision:policy.revision,startsAt:policy.startsAt,endsAt:policy.endsAt,
            byteLimit:policy.byteLimit===null?null:String(policy.byteLimit),usedBytes:consumption?.usedBytes??null,
            receivedAt:consumption?.receivedAt?nativeParseTime(consumption.receivedAt):null,usageStatus:consumption?.status??'unknown'}};
    }
}
