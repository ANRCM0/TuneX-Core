import type { Policy } from '@tunex/contracts/policy';
import { RuntimeHost } from '../../framework/public.ts';
import { runtimeCodec, nativeWallClockNow, nativeRuntimeStatusCodec } from '../../compatibility/public.ts';
import type { NativeRuntimeFamily } from '../../compatibility/public.ts';
import { MySqlRuntimeStateStore } from '../../infrastructure/mysql-runtime-host.ts';
import { MySqlRuntimeStatusStore } from '../../infrastructure/mysql-runtime-status-store.ts';
import { RuntimeStatusQueries } from '../runtime-status-owner/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../../infrastructure/mysql.ts';
import type { AuthorityStore } from '../../infrastructure/authority.ts';
import type { Nodes } from '../nodes.ts';
import type { ForwardRuntimeReader } from '../forward-owner/public.ts';
import type { RuntimeLedger } from './ledger.ts';
import type { RuntimePayloadPolicy, RuntimeRelay } from '../../framework/public.ts';
import { SharedResourceLimitPublicationPolicy } from '../resource-limit-owner/public.ts';
import { MySqlSharedResourceLimitStore } from '../../infrastructure/mysql-resource-limits.ts';
import { MySqlNodeAuthorityStore } from '../../infrastructure/mysql-node-authority.ts';
import { MySqlRuntimeResourceStore } from '../../infrastructure/mysql-runtime-resources.ts';
import { nativeIsoTime } from '../../compatibility/public.ts';
export type { AppliedObservation } from '../../framework/public.ts';

/** Legacy construction entrypoint. New integrations receive the public RuntimeHost ports. */
export class RuntimeController extends RuntimeHost<Transaction,NativeRuntimeFamily> {
    constructor(db:MySqlUnitOfWork,nodes:Nodes,forwarding:ForwardRuntimeReader<Transaction>,ledger:RuntimeLedger,policy?:Policy,
        authority?:AuthorityStore,relay?:RuntimeRelay<Transaction,NativeRuntimeFamily>,payloadPolicy?:RuntimePayloadPolicy<Transaction>) {
        super({db,nodes,forwards:forwarding,store:new MySqlRuntimeStateStore(db),codec:runtimeCodec,now:nativeWallClockNow,policy,authority,relay,
            observations:new RuntimeStatusQueries(new MySqlRuntimeStatusStore(),nativeRuntimeStatusCodec,policy??runtimeCodec.defaultPolicy),
            payloadPolicy:payloadPolicy??new SharedResourceLimitPublicationPolicy({nodes:new MySqlNodeAuthorityStore(),
                owners:new MySqlRuntimeResourceStore(),store:new MySqlSharedResourceLimitStore(),codec:{formatTime:nativeIsoTime}}),
            ledger:{
                assignments:(tx,facts)=>ledger.assignments(tx,forwarding,facts),
                retireChanged:(tx,nodeId,previous,next,generation)=>ledger.retireChanged(tx,nodeId,previous,next,generation),
                tombstones:(tx,nodeId,generation)=>ledger.tombstones(tx,nodeId,generation),
                verifyPublishable:(tx,assignments)=>ledger.verifyPublishable(tx,assignments),
                recordLeases:(tx,snapshot)=>ledger.recordLeases(tx,snapshot),
                complete:(tx,nodeId,report,snapshot)=>ledger.complete(tx,nodeId,forwarding,report,snapshot),
                claim:tx=>ledger.claim(tx),
                get:(tx,scope,id)=>ledger.get(tx,scope,id),
                observeDrains:(tx,nodeId,epoch,report)=>ledger.observeDrains(tx,nodeId,epoch,report),
            }});
    }
}
