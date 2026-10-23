import { ControlError } from '../../framework/public.ts';
import { nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbePathObservationReader } from '../probe-history-owner/public.ts';
import type { StationAlertFacts, StationAlertConfig, StationAlertFact } from './contracts.ts';

/** A read of already accepted samples; evaluating a policy never issues Probe work. */
export class StationPathFacts<Tx> implements StationAlertFacts<Tx> {
    constructor(private readonly original:StationAlertFacts<Tx>,private readonly samples:ProbePathObservationReader<Tx>,
        private readonly now:()=>number=nativeWallClockSource()) {}
    async read(tx:Tx,scope:string,config:StationAlertConfig,actor?:string):Promise<StationAlertFact|null> {
        const base=await this.original.read(tx,scope,config,actor);
        if(config.schemaVersion!==3||!base||base.kind!=='forward')return base;
        if(!actor)throw new ControlError('AUTHORIZATION_DENIED',403,'Path sample alert managing actor required');
        const sample=await this.samples.readIn(tx,actor,scope,config.target.id,config.measurement,this.now(),config.maxSampleAgeSeconds);
        return {...base,pathSample:sample?{kind:'path-probe',...sample}:null};
    }
}
