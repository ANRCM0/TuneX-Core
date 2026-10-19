import { deepFreeze } from '@tunex/core';
import { parseProbeTypes, parseProbeServices, nativeJsonEncode, nativeProbeTypesQualificationAck, nativeProbeServicesQualificationAck, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbeTypesQualificationRequest, ProbeTypesQualificationResponse } from '../../compatibility/public.ts';
import type { ProbeServicesQualificationRequest, ProbeServicesQualificationResponse } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import { requireProbeMachine } from './machine-policy.ts';
import { parseProbeQualification as qualification, sameProbeQualificationInstance as same,
    probeQualificationUnavailable as unavailable, requireProbeTypeQualification } from './qualification-policy.ts';
export { requireProbeTypeQualification } from './qualification-policy.ts';
import type { TransactionBoundary } from '../../framework/public.ts';
import type { CurrentProbeInstances } from './instance-contracts.ts';
import type { ProbeMachineReader } from './machine-contracts.ts';
import type { ProbeTypeQualifications } from './measurement-contracts.ts';
import type { ProbeTypeRegistryApi, ProbeServiceRegistryApi } from './machine-api.ts';

/** Adds v3 recognition to the same original slot and proof; never renews a live generation. */
export class ProbeServiceRegistry<Tx> implements ProbeServiceRegistryApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly machines:ProbeMachineReader<Tx>;
    private readonly instances:CurrentProbeInstances<Tx>;
    private readonly store:ProbeTypeQualifications<Tx>;
    private readonly clock:()=>number;
    constructor(db:TransactionBoundary<Tx>,machines:ProbeMachineReader<Tx>,
        instances:CurrentProbeInstances<Tx>,store:ProbeTypeQualifications<Tx>,clock:()=>number=nativeWallClockSource()) {
        this.db=db;this.machines=machines;this.instances=instances;this.store=store;this.clock=clock;
    }
    private now():number {const now=this.clock();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)
        throw new ControlError('CLOCK_UNCERTAIN',503,'Probe qualification clock requires review');return now;}
    async handle(node:string,fingerprint:string,epoch:number,input:ProbeServicesQualificationRequest):Promise<ProbeServicesQualificationResponse> {
        const request=parseProbeServices('QualificationRequest',nativeJsonEncode(input));
        if(request.nodeId!==node||request.sessionEpoch!==epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Service Probe machine identity differs');
        const result=await this.db.transaction(async tx=>{
            const machine=await this.machines.read(tx,node,fingerprint),slot=await this.instances.readCurrent(tx,node);
            if(!slot||slot.nodeId!==node||slot.bootId!==request.bootId||slot.sessionEpoch!==epoch||slot.fingerprint!==fingerprint||
                slot.instanceId!==request.instanceId||slot.generation!==request.instanceGeneration)unavailable();
            const old=qualification(await this.store.get(tx,node,request.action!=='inspect')),now=this.now();
            const evidence=requireProbeMachine(machine,node,request.bootId,epoch,now,false);
            if(slot.registeredAt>now||slot.expiresAt<=now)unavailable();
            if(old&&old.qualifiedAt>now)throw new ControlError('CLOCK_UNCERTAIN',503,'Probe qualification is in the future');
            const capable=['adp.3','native.direct.v1','tcp','probe.tcp-connect.v1','probe.tcp-ingress-connect.v1','probe.tcp-ingress-tls.v1']
                .every(capability=>evidence.capabilities.includes(capability));
            let value=old;
            if(request.action==='register') {
                requireProbeMachine(machine,node,request.bootId,epoch,now);
                if(!capable)throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Explicit current three-measurement Probe capabilities required');
                if(slot.state!=='registered')unavailable();
                if(old&&same(old,slot)) {
                    requireProbeTypeQualification(old,slot,now);
                    if(old.servicesVersion!==1){value={...old,servicesVersion:1};await this.store.put(tx,value);}
                } else {
                    if(old&&old.instanceGeneration>=slot.generation)unavailable();
                    value={servicesVersion:1,nodeId:node,bootId:request.bootId,sessionEpoch:epoch,fingerprint,instanceId:slot.instanceId,instanceGeneration:slot.generation,
                        state:'qualified',qualifiedAt:now,expiresAt:Math.min(slot.expiresAt,evidence.nodeCredentialUntil,evidence.credentialUntil,evidence.retireAfter??Infinity)};
                    qualification(value);await this.store.put(tx,value);
                }
            } else if(request.action==='revoke') {
                if(old&&!same(old,slot)&&old.instanceGeneration>=slot.generation)unavailable();
                value=old&&same(old,slot)?{...old,servicesVersion:1,state:'revoked'}:{servicesVersion:1,nodeId:node,bootId:request.bootId,sessionEpoch:epoch,fingerprint,
                    instanceId:slot.instanceId,instanceGeneration:slot.generation,state:'revoked',qualifiedAt:now,expiresAt:slot.expiresAt};
                qualification(value);await this.store.put(tx,value);
            }
            const qualified=value!==null&&value.servicesVersion===1&&same(value,slot)&&value.state==='qualified'&&slot.state==='registered'&&capable&&
                value.qualifiedAt>=slot.registeredAt&&value.qualifiedAt<=now&&value.expiresAt>now&&value.expiresAt<=slot.expiresAt;
            return deepFreeze({qualified,qualifiedAt:qualified?value!.qualifiedAt:null,expiresAt:qualified?value!.expiresAt:null});
        });
        return nativeProbeServicesQualificationAck(request,result,()=>this.now());
    }
}
/** A protocol proof bound to the original Gate slot. It cannot allocate, rotate or renew that slot. */
export class ProbeTypeRegistry<Tx> implements ProbeTypeRegistryApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly machines:ProbeMachineReader<Tx>;
    private readonly instances:CurrentProbeInstances<Tx>;
    private readonly store:ProbeTypeQualifications<Tx>;
    private readonly clock:()=>number;
    constructor(db:TransactionBoundary<Tx>,machines:ProbeMachineReader<Tx>,
        instances:CurrentProbeInstances<Tx>,store:ProbeTypeQualifications<Tx>,clock:()=>number=nativeWallClockSource()) {
        this.db=db;this.machines=machines;this.instances=instances;this.store=store;this.clock=clock;
    }
    private now():number {const now=this.clock();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)
        throw new ControlError('CLOCK_UNCERTAIN',503,'Probe qualification clock requires review');return now;}
    async handle(node:string,fingerprint:string,epoch:number,input:ProbeTypesQualificationRequest):Promise<ProbeTypesQualificationResponse> {
        const request=parseProbeTypes('QualificationRequest',nativeJsonEncode(input));
        if(request.nodeId!==node||request.sessionEpoch!==epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Typed Probe machine identity differs');
        const result=await this.db.transaction(async tx=>{
            const machine=await this.machines.read(tx,node,fingerprint),slot=await this.instances.readCurrent(tx,node);
            if(!slot||slot.nodeId!==node||slot.bootId!==request.bootId||slot.sessionEpoch!==epoch||slot.fingerprint!==fingerprint||
                slot.instanceId!==request.instanceId||slot.generation!==request.instanceGeneration)unavailable();
            const old=qualification(await this.store.get(tx,node,request.action!=='inspect')),now=this.now();
            const evidence=requireProbeMachine(machine,node,request.bootId,epoch,now,false);
            if(slot.registeredAt>now||slot.expiresAt<=now)unavailable();
            if(old&&old.qualifiedAt>now)throw new ControlError('CLOCK_UNCERTAIN',503,'Probe qualification is in the future');
            let value=old;
            if(request.action==='register') {
                requireProbeMachine(machine,node,request.bootId,epoch,now);
                if(!evidence.capabilities.includes('probe.tcp-ingress-connect.v1'))throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Explicit ingress Probe capability required');
                if(slot.state!=='registered')unavailable();
                if(old&&same(old,slot))requireProbeTypeQualification(old,slot,now);
                else {
                    if(old&&old.instanceGeneration>=slot.generation)unavailable();
                    value={nodeId:node,bootId:request.bootId,sessionEpoch:epoch,fingerprint,instanceId:slot.instanceId,instanceGeneration:slot.generation,
                        state:'qualified',qualifiedAt:now,expiresAt:Math.min(slot.expiresAt,evidence.nodeCredentialUntil,evidence.credentialUntil,evidence.retireAfter??Infinity)};
                    qualification(value);await this.store.put(tx,value);
                }
            } else if(request.action==='revoke') {
                // Keep a tombstone even when qualification has not yet been published.
                if(old&&!same(old,slot)&&old.instanceGeneration>=slot.generation)unavailable();
                value=old&&same(old,slot)?{...old,state:'revoked'}:{nodeId:node,bootId:request.bootId,sessionEpoch:epoch,fingerprint,
                    instanceId:slot.instanceId,instanceGeneration:slot.generation,state:'revoked',qualifiedAt:now,expiresAt:slot.expiresAt};
                qualification(value);await this.store.put(tx,value);
            }
            const qualified=value!==null&&same(value,slot)&&value.state==='qualified'&&slot.state==='registered'&&value.qualifiedAt<=now&&value.expiresAt>now&&
                value.expiresAt<=slot.expiresAt&&evidence.capabilities.includes('probe.tcp-ingress-connect.v1');
            return deepFreeze({qualified,qualifiedAt:qualified?value!.qualifiedAt:null,expiresAt:qualified?value!.expiresAt:null});
        });
        const now=this.now();
        return nativeProbeTypesQualificationAck(request,result,now);
    }
}
