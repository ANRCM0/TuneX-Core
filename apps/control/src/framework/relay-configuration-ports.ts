import type { RuntimeRelayProfile, RuntimeRelayEndpointConfig } from './runtime-relay-ports.ts';
import type { RuntimeValueFamily } from '@tunex/contracts/execution-values';

export const RELAY_CONFIGURATION_INTERFACE_VERSION=2 as const;
export type TransportProfileConfig<F extends RuntimeValueFamily=RuntimeValueFamily>=RuntimeRelayProfile<F>['config'];

export interface TransportRevisionRecord {
    revision:number;config:unknown;config_digest:string;created_by:string;created_at:number;
}
export interface TransportProfileStore<Tx> {
    quarantine(tx:Tx):Promise<void>;
    ensureProfile(tx:Tx,profileId:string,scopeId:string):Promise<void>;
    publicationForUpdate(tx:Tx,profileId:string):Promise<{scope_id:string;current_revision:number}|undefined>;
    revision(tx:Tx,profileId:string,revision:number):Promise<TransportRevisionRecord|undefined>;
    publishRevision(tx:Tx,profileId:string,revision:number,encoded:string,configDigest:string,actor:string,at:number):Promise<void>;
    setCurrentRevision(tx:Tx,profileId:string,revision:number):Promise<void>;
    insertGrant(tx:Tx,profileId:string,actor:string):Promise<void>;
    deleteGrant(tx:Tx,profileId:string,actor:string):Promise<void>;
    authorizedProfile(tx:Tx,profileId:string,scopeId:string,actor:string):Promise<boolean>;
    grantRevisionForUpdate(tx:Tx,profileId:string,scopeId:string):Promise<{grant_revision:number}|undefined>;
    grantCount(tx:Tx,profileId:string,actor:string):Promise<number>;
    setGrantRevision(tx:Tx,profileId:string,revision:number):Promise<void>;
    grantEvent(tx:Tx,id:string,profileId:string,actor:string,subject:string,revision:number,at:number,encoded:string):Promise<void>;
    grantRevision(tx:Tx,profileId:string,scopeId:string):Promise<{grant_revision:number}|undefined>;
    grantActors(tx:Tx,profileId:string):Promise<{actor_id:string}[]>;
    currentRevision(tx:Tx,profileId:string,scopeId:string):Promise<{current_revision:number}|undefined>;
    list(tx:Tx,scopeId:string):Promise<{id:string;current_revision:number}[]>;
}
export interface RelayEndpointRecord { revision:number;config:unknown }
export interface RelayEndpointStore<Tx> {
    forUpdate(tx:Tx,nodeId:string):Promise<RelayEndpointRecord|undefined>;
    resolve(tx:Tx,nodeId:string):Promise<RelayEndpointRecord|undefined>;
    save(tx:Tx,nodeId:string,revision:number,encoded:string,actor:string,at:number):Promise<void>;
}

/** Native representations stay in a provider, not product command branches. */
export interface RelayConfigurationCodec<F extends RuntimeValueFamily=RuntimeValueFamily> {
    isId(value:unknown):boolean;
    isCounter(value:unknown,allowZero?:boolean):boolean;
    validRequestKey(value:string):boolean;
    readonly maxRevision:number;
    profile(value:unknown):TransportProfileConfig<F>;
    formatTime(at:number):string;
    endpoint(value:unknown):RuntimeRelayEndpointConfig;
    readStored<T>(value:unknown):T;
    encode(value:unknown):string;
    digest(value:unknown):string;
}
