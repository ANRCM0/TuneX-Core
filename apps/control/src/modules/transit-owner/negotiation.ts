import { isCounter } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { TransactionBoundary, MachineSessionLockReader } from '../../framework/public.ts';
import { TRANSIT_NEGOTIATION_CAPABILITIES, readStoredValue, nativeWallClockNow, nativeTransitNegotiationAck } from '../../compatibility/public.ts';
import type { TransitNegotiationRequest, TransitNegotiationResponse } from '../../compatibility/public.ts';
import type { TransitNegotiationApi } from './contracts.ts';

/** Contract negotiation only; the current ADP/3 session remains the authority. */
export class TransitNegotiationService<Tx> implements TransitNegotiationApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly machine:MachineSessionLockReader<Tx>;
    constructor(db:TransactionBoundary<Tx>,machine:MachineSessionLockReader<Tx>) {this.db=db;this.machine=machine;}

    async hello(nodeId:string,fingerprint:string,epoch:number,request:TransitNegotiationRequest):Promise<TransitNegotiationResponse> {
        if(request.nodeId!==nodeId||request.sessionEpoch!==epoch||!isCounter(epoch))
            throw new ControlError('SESSION_SUPERSEDED',409,'Transit handshake Node/session differs');
        if(!/^[0-9a-f]{64}$/.test(fingerprint))
            throw new ControlError('AUTHORIZATION_DENIED',403,'Machine certificate fingerprint required');
        return this.db.transaction(async tx=>{
            const machine=await this.machine.read(tx,nodeId,fingerprint);
            if(!machine||machine.session_epoch!==epoch||machine.boot_id!==request.bootId)
                throw new ControlError('SESSION_SUPERSEDED',409,'Current ADP/3 Hello boot required');
            const now=nativeWallClockNow();
            if(machine.node_revoked||machine.credential_revoked!==0||
                !machine.valid_until||machine.valid_until<=now||
                (machine.retire_after!==null&&machine.retire_after<=now)||
                !machine.credential_until||machine.credential_until<=now)
                throw new ControlError('AUTHORIZATION_DENIED',403,'Current mTLS machine credential required');
            const facts=readStoredValue<{capabilities?:unknown}>(machine.facts);
            const declared=facts?.capabilities;
            if(!Array.isArray(declared)||TRANSIT_NEGOTIATION_CAPABILITIES.some(cap=>!declared.includes(cap)))
                throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Transit contract not advertised in current ADP/3 Hello');
            if(request.lastStoredTransitGeneration!==0)
                throw new ControlError('FENCING_REJECTED',409,'Persisted Transit Agent history requires explicit reconciliation');
            return nativeTransitNegotiationAck(nodeId,request.bootId,epoch,now);
        });
    }
}
