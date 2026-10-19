import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { RuntimeResources, RuntimeExclusiveReservations, RuntimeReservationRelease } from '../framework/public.ts';
import type { RuntimeResourceStore, RuntimeSlotKey, RuntimeSlotState, RuntimeExclusiveReservationStore, RuntimeReservationReleaseStore } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlRuntimeResourceStore implements RuntimeResourceStore<Transaction>,RuntimeExclusiveReservationStore<Transaction>,RuntimeReservationReleaseStore<Transaction> {
    async lockedNodes(tx:Transaction,nodeId:string):Promise<{node_id:string}[]> {
        return rows<{node_id:string}>(tx,'SELECT node_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]);
    }
    async exclusiveSlot(tx:Transaction,key:RuntimeSlotKey):Promise<{owner_id:string|null;fence:number}|undefined> {
        return (await rows<{owner_id:string|null;fence:number}>(tx,
            'SELECT owner_id,fence FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',
            [key.nodeId,key.protocol,key.port]))[0];
    }
    async ownedSlotCount(tx:Transaction,nodeId:string):Promise<{n:number}|undefined> {
        return (await rows<{n:number}>(tx,
            'SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',[nodeId]))[0];
    }
    async initializeNode(tx:Transaction,nodeId:string):Promise<void> {
        await write(tx,'INSERT INTO runtime_nodes(node_id) VALUES(?)',[nodeId]);
    }
    async lockNode(tx:Transaction,nodeId:string):Promise<{session_epoch:number}|undefined> {
        return (await rows<{session_epoch:number}>(tx,'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]))[0];
    }
    async maximumAuthorization(tx:Transaction,nodeId:string):Promise<number|null> {
        return (await rows<{until:number|null}>(tx,'SELECT MAX(valid_until) until FROM execution_leases WHERE node_id=?',[nodeId]))[0]!.until;
    }
    async ensureSlot(tx:Transaction,key:RuntimeSlotKey):Promise<void> {
        await write(tx,'INSERT INTO port_slots(node_id,protocol,port) VALUES(?,?,?) ON DUPLICATE KEY UPDATE port=port',[key.nodeId,key.protocol,key.port]);
    }
    async lockSlot(tx:Transaction,key:RuntimeSlotKey):Promise<RuntimeSlotState> {
        return (await rows<RuntimeSlotState>(tx,'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',[key.nodeId,key.protocol,key.port]))[0]!;
    }
    async lockOwnedSlots(tx:Transaction,nodeId:string,forwardId:string):Promise<RuntimeSlotState[]> {
        return rows(tx,'SELECT * FROM port_slots WHERE node_id=? AND owner_id=? FOR UPDATE',[nodeId,forwardId]);
    }
    async assignSlot(tx:Transaction,key:RuntimeSlotKey,forwardId:string,generation:number):Promise<void> {
        await write(tx,'UPDATE port_slots SET owner_id=?,fence=fence+1,deployment_generation=? WHERE node_id=? AND protocol=? AND port=?',[forwardId,generation,key.nodeId,key.protocol,key.port]);
    }
    async countOwnedSlots(tx:Transaction,nodeId:string):Promise<number> {
        return (await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',[nodeId]))[0]!.n;
    }
    async ownedSlots(tx:Transaction,forwardId:string):Promise<RuntimeSlotKey[]> {
        const slots=await rows<{node_id:string;protocol:'tcp'|'udp';port:number}>(tx,'SELECT node_id,protocol,port FROM port_slots WHERE owner_id=?',[forwardId]);
        return slots.map(slot=>({nodeId:slot.node_id,protocol:slot.protocol,port:slot.port}));
    }
    async releaseSlot(tx:Transaction,key:RuntimeSlotKey,forwardId:string):Promise<void> {
        await write(tx,'UPDATE port_slots SET owner_id=NULL WHERE node_id=? AND protocol=? AND port=? AND owner_id=?',[key.nodeId,key.protocol,key.port,forwardId]);
    }
    async releaseExactSlot(tx:Transaction,key:RuntimeSlotKey,forwardId:string,fence:number,generation:number):Promise<number> {
        return write(tx,
            'UPDATE port_slots SET owner_id=NULL WHERE node_id=? AND protocol=? AND port=? AND owner_id=? AND fence=? AND deployment_generation=?',
            [key.nodeId,key.protocol,key.port,forwardId,fence,generation]);
    }
    async releaseForwardSlots(tx:Transaction,forwardId:string):Promise<void> {
        await write(tx,'UPDATE port_slots SET owner_id=NULL WHERE owner_id=?',[forwardId]);
    }
}

/** Legacy callers may omit injection; this creates no connection or second ledger. */
export function createMySqlRuntimeResources(maxAssignmentsPerNode=DEFAULT_POLICY.maxAssignmentsPerNode):RuntimeResources<Transaction> {
    return new RuntimeResources(new MySqlRuntimeResourceStore(),maxAssignmentsPerNode);
}

/** Preserve the original per-Node late default-policy read, without a new ledger. */
export function createMySqlExclusiveReservations():RuntimeExclusiveReservations<Transaction> {
    return new RuntimeExclusiveReservations(new MySqlRuntimeResourceStore(),()=>DEFAULT_POLICY.maxAssignmentsPerNode);
}

/** Original exact release over the same resource SQL owner, without a new transaction. */
export function createMySqlReservationRelease():RuntimeReservationRelease<Transaction> {
    return new RuntimeReservationRelease(new MySqlRuntimeResourceStore());
}
