import type { NativeRuntimeRelayLedger as RuntimeRelayLedger } from '../../compatibility/public.ts';

/** Relay joins the ledger owner's transaction rather than mutating its tables. */
export interface RelayExecutionLedger<Tx> extends RuntimeRelayLedger<Tx> {}
