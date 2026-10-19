import { randomUUID } from 'node:crypto';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { Policy } from '@tunex/contracts/policy';
import { RuntimeLedgerHost } from '../../framework/public.ts';
import type { RuntimeLedgerAuthorization, RuntimeResourceAccess } from '../../framework/public.ts';
import type { NativeRuntimeFamily, NativeSnapshotAssignmentCollector as SnapshotAssignmentCollector } from '../../compatibility/public.ts';
import { MySqlRuntimeLedgerStore } from '../../infrastructure/mysql-runtime-ledger.ts';
import { createMySqlRuntimeResources } from '../../infrastructure/mysql-runtime-resources.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
import { nativeLedgerCompiler } from '../../compatibility/public.ts';
import type { ForwardOperationCommands, ForwardResourceHost } from '../forward-owner/public.ts';
import type { RelayExecutionLedger } from './relay-ledger-ports.ts';
export type { RuntimeOperation as Operation } from '../../framework/public.ts';

/** Legacy constructor binds the original providers; all coordination lives in L1. */
export class RuntimeLedger extends RuntimeLedgerHost<Transaction,NativeRuntimeFamily> implements ForwardOperationCommands<Transaction>, ForwardResourceHost<Transaction>, RelayExecutionLedger<Transaction> {
    constructor(policy:Policy|undefined,authorization:RuntimeLedgerAuthorization<Transaction>|undefined,
        assignmentSources:SnapshotAssignmentCollector<Transaction>,resources?:RuntimeResourceAccess<Transaction>) {
        const selectedPolicy={...(policy??DEFAULT_POLICY)};
        super({policy:selectedPolicy,authorization,assignments:assignmentSources,
            resources:resources??createMySqlRuntimeResources(selectedPolicy.maxAssignmentsPerNode),
            store:new MySqlRuntimeLedgerStore(),now:Date.now,newID:randomUUID,
            compiler:nativeLedgerCompiler,
        });
    }
}
