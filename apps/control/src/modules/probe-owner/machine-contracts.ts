import type { MachineSessionEvidence, MachineSessionReader } from '../../framework/public.ts';

/** Credential/session evidence, never a Snapshot, permit issuer or connection owner. */
export interface ProbeMachineEvidence extends MachineSessionEvidence {}
export interface ProbeMachineReader<Tx> extends MachineSessionReader<Tx,ProbeMachineEvidence> {}
