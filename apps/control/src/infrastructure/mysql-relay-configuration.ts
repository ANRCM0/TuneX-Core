import type { TransportProfileStore, TransportRevisionRecord, RelayEndpointStore, RelayEndpointRecord } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** Original owner SQL, always on the supplied transaction; no pool or retry. */
export class MySqlTransportProfileStore implements TransportProfileStore<Transaction> {
    async quarantine(tx:Transaction):Promise<void>{await write(tx,'DELETE FROM transport_profile_grants');}
    async ensureProfile(tx:Transaction,profileId:string,scopeId:string):Promise<void>{
        await write(tx,'INSERT INTO transport_profiles(id,scope_id) VALUES(?,?) ON DUPLICATE KEY UPDATE id=id',[profileId,scopeId]);
    }
    async publicationForUpdate(tx:Transaction,profileId:string):Promise<{scope_id:string;current_revision:number}|undefined>{
        return (await rows<{scope_id:string;current_revision:number}>(tx,'SELECT scope_id,current_revision FROM transport_profiles WHERE id=? FOR UPDATE',[profileId]))[0];
    }
    async revision(tx:Transaction,profileId:string,revision:number):Promise<TransportRevisionRecord|undefined>{
        return (await rows<TransportRevisionRecord>(tx,'SELECT * FROM transport_profile_revisions WHERE profile_id=? AND revision=?',[profileId,revision]))[0];
    }
    async publishRevision(tx:Transaction,profileId:string,revision:number,encoded:string,configDigest:string,actor:string,at:number):Promise<void>{
        await write(tx,'INSERT INTO transport_profile_revisions(profile_id,revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?)',[profileId,revision,encoded,configDigest,actor,at]);
    }
    async setCurrentRevision(tx:Transaction,profileId:string,revision:number):Promise<void>{await write(tx,'UPDATE transport_profiles SET current_revision=? WHERE id=?',[revision,profileId]);}
    async insertGrant(tx:Transaction,profileId:string,actor:string):Promise<void>{await write(tx,'INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)',[profileId,actor]);}
    async deleteGrant(tx:Transaction,profileId:string,actor:string):Promise<void>{await write(tx,'DELETE FROM transport_profile_grants WHERE profile_id=? AND actor_id=?',[profileId,actor]);}
    async authorizedProfile(tx:Transaction,profileId:string,scopeId:string,actor:string):Promise<boolean>{
        return Boolean((await rows(tx,'SELECT p.id FROM transport_profiles p JOIN transport_profile_grants g ON g.profile_id=p.id WHERE p.id=? AND p.scope_id=? AND g.actor_id=? FOR SHARE',[profileId,scopeId,actor]))[0]);
    }
    async grantRevisionForUpdate(tx:Transaction,profileId:string,scopeId:string):Promise<{grant_revision:number}|undefined>{
        return (await rows<{grant_revision:number}>(tx,'SELECT grant_revision FROM transport_profiles WHERE id=? AND scope_id=? FOR UPDATE',[profileId,scopeId]))[0];
    }
    async grantCount(tx:Transaction,profileId:string,actor:string):Promise<number>{
        return (await rows(tx,'SELECT actor_id FROM transport_profile_grants WHERE profile_id=? AND actor_id=?',[profileId,actor])).length;
    }
    async setGrantRevision(tx:Transaction,profileId:string,revision:number):Promise<void>{await write(tx,'UPDATE transport_profiles SET grant_revision=? WHERE id=?',[revision,profileId]);}
    async grantEvent(tx:Transaction,id:string,profileId:string,actor:string,subject:string,revision:number,at:number,encoded:string):Promise<void>{
        await write(tx,'INSERT INTO transport_events(id,profile_id,actor_id,subject_id,revision,created_at,details) VALUES(?,?,?,?,?,?,?)',[id,profileId,actor,subject,revision,at,encoded]);
    }
    async grantRevision(tx:Transaction,profileId:string,scopeId:string):Promise<{grant_revision:number}|undefined>{
        return (await rows<{grant_revision:number}>(tx,'SELECT grant_revision FROM transport_profiles WHERE id=? AND scope_id=?',[profileId,scopeId]))[0];
    }
    async grantActors(tx:Transaction,profileId:string):Promise<{actor_id:string}[]>{return rows(tx,'SELECT actor_id FROM transport_profile_grants WHERE profile_id=? ORDER BY actor_id',[profileId]);}
    async currentRevision(tx:Transaction,profileId:string,scopeId:string):Promise<{current_revision:number}|undefined>{
        return (await rows<{current_revision:number}>(tx,'SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?',[profileId,scopeId]))[0];
    }
    async list(tx:Transaction,scopeId:string):Promise<{id:string;current_revision:number}[]>{return rows(tx,'SELECT id,current_revision FROM transport_profiles WHERE scope_id=? ORDER BY id',[scopeId]);}
}

export class MySqlRelayEndpointStore implements RelayEndpointStore<Transaction> {
    async forUpdate(tx:Transaction,nodeId:string):Promise<RelayEndpointRecord|undefined>{
        return (await rows<RelayEndpointRecord>(tx,'SELECT revision,config FROM node_relay_endpoints WHERE node_id=? FOR UPDATE',[nodeId]))[0];
    }
    async resolve(tx:Transaction,nodeId:string):Promise<RelayEndpointRecord|undefined>{
        return (await rows<RelayEndpointRecord>(tx,'SELECT revision,config FROM node_relay_endpoints WHERE node_id=? FOR SHARE',[nodeId]))[0];
    }
    async save(tx:Transaction,nodeId:string,revision:number,encoded:string,actor:string,at:number):Promise<void>{
        await write(tx,'INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),config=VALUES(config),created_by=VALUES(created_by),updated_at=VALUES(updated_at)',[nodeId,revision,encoded,actor,at]);
    }
}
