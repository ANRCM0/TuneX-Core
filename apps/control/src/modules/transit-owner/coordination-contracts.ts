export type TransitCoordinationPhase =
  'preparing' | 'activating' | 'compensating' | 'sealed' | 'quarantined';
export type TransitCommandAction = 'prepare' | 'activate' | 'withdraw';
export interface OfflineTransitCommand {
  readonly kind: 'offline-transit-command-v1';
  readonly action: TransitCommandAction;
  readonly forwardId: string;
  readonly generation: number;
  readonly planDigest: string;
  readonly nodeId: string;
  readonly revision: number;
  readonly assignments: readonly {
    readonly assignmentId: string;
    readonly protocol: 'tcp' | 'udp';
    readonly sessionEpoch: number;
    readonly bindingFence: number;
    readonly physicalProtocol: 'tcp' | 'udp';
    readonly port: number;
  }[];
  readonly commandDigest: string;
}
export interface TransitObservationProof {
  readonly commandDigest: string;
  readonly nodeId: string;
  readonly action: TransitCommandAction;
  readonly reportSequence: number;
  readonly receivedAt: number;
  readonly assignments: readonly {
    readonly assignmentId: string;
    readonly sessionEpoch: number;
    readonly bindingFence: number;
    readonly deploymentGeneration: number;
    readonly condition: 'prepared' | 'ready' | 'removed';
  }[];
}
/** The caller must authenticate the source/report and check current Control authority.
 * There is no default verifier and no production call site in this batch.
 */
export type TransitProofVerifier = (proof: TransitObservationProof) => Promise<boolean>;

export interface TransitCoordinationBody {
  forwardId: string;
  generation: number;
  planDigest: string;
  phase: TransitCoordinationPhase;
  position: number;
  revision: number;
  receiptHighwater: Record<string, number>;
}
export interface TransitPreviewPlanner { peek(actor:string,scopeId:string,forwardId:string,generation:number):Promise<OfflineTransitCommand|null> }
