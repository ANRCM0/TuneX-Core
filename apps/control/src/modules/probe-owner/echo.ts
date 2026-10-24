import { parseProbeEcho, probeEchoServiceSelection, probeEchoResultDigest, nativeJsonEncode, nativeIsoTime,
    nativeValueDigest, nativeWallClockSource, nativeParseTime } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { TransactionBoundary } from '../../framework/public.ts';
import type { ProbeMachineReader } from './machine-contracts.ts';
import type { CurrentProbeInstances } from './instance-contracts.ts';
import type { ProbeTypeQualifications, ProbeTypeQualification } from './measurement-contracts.ts';
import type { ProbePermitOwner, ProbePermitView } from './owner-contracts.ts';
import type { ProbeEchoRegistryApi, ProbeEchoApi } from './echo-api.ts';
import { requireProbeMachine } from './machine-policy.ts';
import { parseProbeQualification, sameProbeQualificationInstance, requireProbeTypeQualification } from './qualification-policy.ts';
import { probeEchoMeasurement } from './measurements.ts';

function unavailable():never {throw new ControlError('PROBE_PERMIT_UNAVAILABLE',409,'Current controlled Echo authority required');}
const identity=(node:string,epoch:number,request:{nodeId:string;sessionEpoch:number})=>{
    if(request.nodeId!==node||request.sessionEpoch!==epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Echo Node/session differs');
};
const time=(at:number)=>nativeIsoTime(at);
const selection=(value:{serviceContext?:ProbePermitView['serviceContext']})=>value.serviceContext?probeEchoServiceSelection(value.serviceContext):null;

/** Qualifies the same original slot; no generation allocation or expiry renewal. */
export class ProbeEchoRegistry<Tx> implements ProbeEchoRegistryApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly machines:ProbeMachineReader<Tx>;
    private readonly instances:CurrentProbeInstances<Tx>;
    private readonly store:ProbeTypeQualifications<Tx>;
    private readonly clock:()=>number;
    constructor(db:TransactionBoundary<Tx>,machines:ProbeMachineReader<Tx>,
        instances:CurrentProbeInstances<Tx>,store:ProbeTypeQualifications<Tx>,
        clock:()=>number=nativeWallClockSource()) {
        this.db=db;this.machines=machines;this.instances=instances;this.store=store;this.clock=clock;
    }
    private now() {const value=this.clock();if(!Number.isSafeInteger(value)||value<0||value>253402300799999)
        throw new ControlError('CLOCK_UNCERTAIN',503,'Echo qualification clock requires review');return value;}
    async handle(node:string,fingerprint:string,epoch:number,input:unknown) {
        const request=parseProbeEcho('QualificationRequest',nativeJsonEncode(input));identity(node,epoch,request);
        const result=await this.db.transaction(async tx=>{
            const machine=await this.machines.read(tx,node,fingerprint),slot=await this.instances.readCurrent(tx,node);
            if(!slot||slot.nodeId!==node||slot.bootId!==request.bootId||slot.sessionEpoch!==epoch||slot.fingerprint!==fingerprint||
                slot.instanceId!==request.instanceId||slot.generation!==request.instanceGeneration)unavailable();
            const old=parseProbeQualification(await this.store.get(tx,node,request.action!=='inspect')),now=this.now();
            const evidence=requireProbeMachine(machine,node,request.bootId,epoch,now,false);
            if(slot.registeredAt>now||slot.expiresAt<=now)unavailable();
            if(old&&old.qualifiedAt>now)throw new ControlError('CLOCK_UNCERTAIN',503,'Echo qualification is in the future');
            const path=request.measurements.length===7;
            const pathCapable=!path||['probe.tcp-path-echo.v1','probe.udp-path-echo.v1'].every(cap=>evidence.capabilities.includes(cap));
            const capable=['adp.3','native.direct.v1','tcp','udp','probe.tcp-connect.v1','probe.tcp-ingress-connect.v1',
                'probe.tcp-ingress-tls.v1','probe.tcp-ingress-echo.v1','probe.udp-ingress-echo.v1'].every(item=>evidence.capabilities.includes(item))&&pathCapable;
            let value:ProbeTypeQualification|null=old;
            if(request.action==='register'){
                requireProbeMachine(machine,node,request.bootId,epoch,now);
                if(!capable)throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Explicit five-measurement Echo capabilities required');
                if(slot.state!=='registered')unavailable();
                if(old&&sameProbeQualificationInstance(old,slot)){
                    requireProbeTypeQualification(old,slot,now);value={...old,servicesVersion:1,echoVersion:1};
                }else{
                    if(old&&old.instanceGeneration>=slot.generation)unavailable();
                    value={nodeId:node,bootId:request.bootId,sessionEpoch:epoch,fingerprint,instanceId:slot.instanceId,
                        instanceGeneration:slot.generation,state:'qualified',servicesVersion:1,echoVersion:1,qualifiedAt:now,
                        expiresAt:Math.min(slot.expiresAt,evidence.nodeCredentialUntil,evidence.credentialUntil,evidence.retireAfter??Infinity)};
                }
                parseProbeQualification(value);await this.store.put(tx,value);
            }else if(request.action==='revoke'){
                if(old&&!sameProbeQualificationInstance(old,slot)&&old.instanceGeneration>=slot.generation)unavailable();
                value=old&&sameProbeQualificationInstance(old,slot)?{...old,state:'revoked',servicesVersion:1,echoVersion:1}:
                    {nodeId:node,bootId:request.bootId,sessionEpoch:epoch,fingerprint,instanceId:slot.instanceId,
                        instanceGeneration:slot.generation,state:'revoked',servicesVersion:1,echoVersion:1,qualifiedAt:now,expiresAt:slot.expiresAt};
                parseProbeQualification(value);await this.store.put(tx,value);
            }
            const qualified=!!value&&value.echoVersion===1&&value.servicesVersion===1&&sameProbeQualificationInstance(value,slot)&&
                value.state==='qualified'&&slot.state==='registered'&&capable&&value.qualifiedAt>=slot.registeredAt&&
                value.qualifiedAt<=now&&value.expiresAt>now&&value.expiresAt<=slot.expiresAt;
            return {qualified,qualifiedAt:qualified?time(value!.qualifiedAt):null,expiresAt:qualified?time(value!.expiresAt):null};
        });
        return parseProbeEcho('QualificationResponse',nativeJsonEncode({...request,kind:'probe-echo-instance-ack',...result,
            serverTime:time(this.now()),executionEnabled:false}));
    }
}

/** Version-4 codec adapter; all budgets and transitions stay with ProbePermits. */
export class ProbeEcho<Tx> implements ProbeEchoApi {
    private readonly permits:Pick<ProbePermitOwner<Tx>,'offer'|'consume'|'check'|'receiveResult'>;
    private readonly clock:()=>number;
    constructor(permits:Pick<ProbePermitOwner<Tx>,'offer'|'consume'|'check'|'receiveResult'>,
        clock:()=>number=nativeWallClockSource()) {this.permits=permits;this.clock=clock;}
    private now(observed:number) {const now=this.clock();if(!Number.isSafeInteger(now)||!Number.isSafeInteger(observed)||observed<0||
        now<observed||now-observed>250)unavailable();return now;}
    private matches(value:ProbePermitView,request:{service:unknown;challenge:unknown}) {
        if(nativeValueDigest(selection(value))!==nativeValueDigest(request.service)||
            nativeValueDigest(value.echoChallenge??null)!==nativeValueDigest(request.challenge))unavailable();
    }
    async poll(node:string,fingerprint:string,epoch:number,input:unknown) {
        const request=parseProbeEcho('PollRequest',nativeJsonEncode(input));identity(node,epoch,request);
        const result=await this.permits.offer(node,fingerprint,epoch,{bootId:request.bootId,instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},'echo');
        const now=this.now(result.observedAt),candidate=result.offer;
        const offer=candidate&&request.measurements.some(measurement=>measurement===candidate.measurement||measurement==='tcp-connect-v1'&&candidate.measurement===undefined)?candidate:null;
        if(offer&&(offer.instanceId!==request.instanceId||offer.instanceGeneration!==request.instanceGeneration||offer.expiresAt<=now))unavailable();
        return parseProbeEcho('PollResponse',nativeJsonEncode({...request,kind:'probe-echo-poll-ack',observedAt:time(result.observedAt),
            serverTime:time(now),executionEnabled:false,offer:offer?{...probeEchoMeasurement(offer.measurement??'tcp-connect-v1'),
                permitId:offer.permitId,binding:offer.binding,timeoutMs:offer.timeoutMs,issuedAt:time(offer.issuedAt),expiresAt:time(offer.expiresAt),
                serviceContext:offer.serviceContext??null,challenge:offer.echoChallenge??null}:null}));
    }
    async claim(node:string,fingerprint:string,epoch:number,input:unknown) {
        const request=parseProbeEcho('ClaimRequest',nativeJsonEncode(input));identity(node,epoch,request);
        const value=await this.permits.consume(node,fingerprint,epoch,{permitId:request.permitId,bootId:request.bootId,
            instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},request.measurement,'echo',request.service,request.challenge);
        const now=this.now(value.closedAt??-1);this.matches(value,request);
        if(value.id!==request.permitId||value.state!=='consumed'||value.closedAt===null||now>=value.expiresAt)unavailable();
        return parseProbeEcho('ClaimResponse',nativeJsonEncode({...request,kind:'probe-echo-claim-ack',binding:value.binding,
            timeoutMs:value.timeoutMs,issuedAt:time(value.issuedAt),expiresAt:time(value.expiresAt),consumedAt:time(value.closedAt),
            serverTime:time(now),state:'consumed',executionEnabled:false}));
    }
    async status(node:string,fingerprint:string,epoch:number,input:unknown) {
        const request=parseProbeEcho('StatusRequest',nativeJsonEncode(input));identity(node,epoch,request);
        const value=await this.permits.check(node,fingerprint,epoch,{permitId:request.permitId,bootId:request.bootId,
            instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},request.measurement,'echo',request.service,request.challenge);
        const now=this.now(value.checkedAt);this.matches(value,request);
        if(value.id!==request.permitId||value.state!=='consumed'||value.closedAt===null||now>=value.expiresAt)unavailable();
        return parseProbeEcho('StatusResponse',nativeJsonEncode({...request,kind:'probe-echo-status-ack',binding:value.binding,
            timeoutMs:value.timeoutMs,issuedAt:time(value.issuedAt),expiresAt:time(value.expiresAt),consumedAt:time(value.closedAt),
            checkedAt:time(value.checkedAt),serverTime:time(now),state:'consumed',executionEnabled:false}));
    }
    async result(node:string,fingerprint:string,epoch:number,input:unknown) {
        const request=parseProbeEcho('ResultRequest',nativeJsonEncode(input));identity(node,epoch,request);
        const value=await this.permits.receiveResult(node,fingerprint,epoch,request),now=this.now(value.checkedAt);
        if(!Number.isSafeInteger(value.acceptedAt)||value.acceptedAt<0||value.acceptedAt>value.checkedAt||
            now>=nativeParseTime(request.validUntil)||value.resultDigest!==probeEchoResultDigest(request))unavailable();
        return parseProbeEcho('ResultResponse',nativeJsonEncode({protocolVersion:3,probeVersion:4,kind:'probe-echo-result-ack',
            nodeId:request.nodeId,bootId:request.bootId,sessionEpoch:request.sessionEpoch,instanceId:request.instanceId,
            instanceGeneration:request.instanceGeneration,requestId:request.requestId,
            ...probeEchoMeasurement(request.measurement),permitId:request.permitId,service:request.service,challenge:request.challenge,
            resultDigest:value.resultDigest,acceptedAt:time(value.acceptedAt),checkedAt:time(value.checkedAt),
            serverTime:time(now),duplicate:value.duplicate,executionEnabled:false}));
    }
}
