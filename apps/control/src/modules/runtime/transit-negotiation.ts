import { isCounter } from '@tunex/core';
import { TRANSIT_NEGOTIATION_CAPABILITIES } from '@tunex/contracts';
import type { TransitNegotiationRequest, TransitNegotiationResponse } from '@tunex/contracts';
import { ControlError } from '../../application/errors.ts';
import type { MySqlUnitOfWork } from '../../infrastructure/mysql.ts';
import { json, rows } from '../../infrastructure/mysql.ts';

interface MachineSession {
  session_epoch:number; boot_id:string|null;
  node_revoked:number; credential_revoked:number|null;
  credential_until:number|null; valid_until:number|null;
  retire_after:number|null; facts:unknown;
}

/** An actual mTLS-authenticated Control endpoint, deliberately READ ONLY.
 * Acknowledgement of parsing capability is NOT a Transit deployment lease.
 */
export class TransitNegotiator {
  private readonly db:MySqlUnitOfWork;
  constructor(db:MySqlUnitOfWork){this.db=db;}

  async hello(nodeId:string,fingerprint:string,epoch:number,
    request:TransitNegotiationRequest):Promise<TransitNegotiationResponse> {
    if(request.nodeId!==nodeId||request.sessionEpoch!==epoch||!isCounter(epoch))
      throw new ControlError('SESSION_SUPERSEDED',409,'Transit handshake Node/session differs');
    if(!/^[0-9a-f]{64}$/.test(fingerprint))
      throw new ControlError('AUTHORIZATION_DENIED',403,'Machine certificate fingerprint required');
    return this.db.transaction(async tx=>{
      const machine=(await rows<MachineSession>(tx,
        `SELECT r.session_epoch,r.boot_id,n.revoked node_revoked,n.credential_until,n.facts,
          c.revoked credential_revoked,c.valid_until,c.retire_after
         FROM runtime_nodes r
         JOIN nodes n ON n.id=r.node_id
         LEFT JOIN node_credentials c ON c.node_id=r.node_id AND c.fingerprint=?
         WHERE r.node_id=? FOR UPDATE`,
        [fingerprint,nodeId]))[0];
      if(!machine||machine.session_epoch!==epoch||machine.boot_id!==request.bootId)
        throw new ControlError('SESSION_SUPERSEDED',409,'Current ADP/3 Hello boot required');
      const now=Date.now();
      if(machine.node_revoked||machine.credential_revoked!==0||
         !machine.valid_until||machine.valid_until<=now||
         (machine.retire_after!==null&&machine.retire_after<=now)||
         !machine.credential_until||machine.credential_until<=now)
        throw new ControlError('AUTHORIZATION_DENIED',403,'Current mTLS machine credential required');
      const facts=json<{capabilities?:unknown}>(machine.facts);
      if(!facts||!Array.isArray(facts.capabilities)||
        TRANSIT_NEGOTIATION_CAPABILITIES.some(cap=>!facts.capabilities!.includes(cap)))
        throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Transit contract not advertised in current ADP/3 Hello');
      // Control does not yet have a joined live Transit Runner/Journal protocol.
      // Never accept evidence that would require silently discarding local Fences.
      if(request.lastStoredTransitGeneration!==0)
        throw new ControlError('FENCING_REJECTED',409,'Persisted Transit Agent history requires explicit reconciliation');
      return {
        protocolVersion:3,extensionVersion:1,nodeId,bootId:request.bootId,
        sessionEpoch:epoch,requiredCapabilities:TRANSIT_NEGOTIATION_CAPABILITIES,
        serverTime:new Date(now).toISOString(),
        state:'contract-only',executionEnabled:false,
      };
    });
  }
}
