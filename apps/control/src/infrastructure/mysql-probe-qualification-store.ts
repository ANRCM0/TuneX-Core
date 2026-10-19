import { isId } from '@tunex/core';
import { ControlError } from '../framework/public.ts';
import type { ProbeQualificationStoredRecord, ProbeQualificationStorage, ProbeQualificationStorageValues } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row=Record<string,unknown>;
function corrupt():never {throw new ControlError('INTEGRITY_FAILURE',409,'Invalid Probe type qualification');}
function record<Value extends ProbeQualificationStoredRecord>(row:Row,values:ProbeQualificationStorageValues<Value>):Value {
    if(row.services_version!==null&&row.services_version!==1||row.echo_version!==null&&row.echo_version!==1||row.echo_version===1&&row.services_version!==1)corrupt();
    return values.read({...(row.services_version===1?{servicesVersion:1 as const}:{}),...(row.echo_version===1?{echoVersion:1 as const}:{}),nodeId:row.node_id as string,bootId:row.boot_id as string,sessionEpoch:row.session_epoch as number,
        fingerprint:row.fingerprint as string,instanceId:row.instance_id as string,instanceGeneration:row.instance_generation as number,
        state:row.state as string,qualifiedAt:row.qualified_at as number,expiresAt:row.expires_at as number});
}

/** Stores the original qualification proof, never another instance or execution budget. */
export class MySqlProbeQualificationStore<Value extends ProbeQualificationStoredRecord> implements ProbeQualificationStorage<Transaction,Value> {
    private readonly values:ProbeQualificationStorageValues<Value>;
    constructor(values:ProbeQualificationStorageValues<Value>) {this.values=values;}
    async get(tx:Transaction,node:string,lock=false):Promise<Value|null> {
        if(!isId(node))corrupt();
        if(lock)await write(tx,'INSERT INTO probe_type_qualifications(node_id) VALUES(?) ON DUPLICATE KEY UPDATE node_id=VALUES(node_id)',[node]);
        const [row]=await rows<Row>(tx,`SELECT node_id,boot_id,session_epoch,fingerprint,instance_id,instance_generation,state,qualified_at,expires_at,services_version,echo_version FROM probe_type_qualifications WHERE node_id=?${lock?' FOR UPDATE':' FOR SHARE'}`,[node]);
        if(row?.state==='empty'){
            if(row.node_id!==node||row.instance_generation!==0||[row.boot_id,row.session_epoch,row.fingerprint,row.instance_id,row.qualified_at,row.expires_at,row.services_version,row.echo_version].some(v=>v!==null))corrupt();return null;
        }
        return row?record(row,this.values):null;
    }
    async put(tx:Transaction,input:Value):Promise<void> {
        const value=this.values.read(input);
        await write(tx,`INSERT INTO probe_type_qualifications(node_id,boot_id,session_epoch,fingerprint,instance_id,instance_generation,state,qualified_at,expires_at,services_version,echo_version)
            VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE echo_version=IF(boot_id=VALUES(boot_id) AND session_epoch=VALUES(session_epoch) AND fingerprint=VALUES(fingerprint)
            AND instance_id=VALUES(instance_id) AND instance_generation=VALUES(instance_generation),COALESCE(VALUES(echo_version),echo_version),VALUES(echo_version)),
            services_version=IF(boot_id=VALUES(boot_id) AND session_epoch=VALUES(session_epoch) AND fingerprint=VALUES(fingerprint)
            AND instance_id=VALUES(instance_id) AND instance_generation=VALUES(instance_generation),COALESCE(VALUES(services_version),services_version),VALUES(services_version)),
            boot_id=VALUES(boot_id),session_epoch=VALUES(session_epoch),fingerprint=VALUES(fingerprint),instance_id=VALUES(instance_id),instance_generation=VALUES(instance_generation),state=VALUES(state),qualified_at=VALUES(qualified_at),expires_at=VALUES(expires_at)`,
            [value.nodeId,value.bootId,value.sessionEpoch,value.fingerprint,value.instanceId,value.instanceGeneration,value.state,value.qualifiedAt,value.expiresAt,value.servicesVersion??null,value.echoVersion??null]);
    }
    static async quarantineRecovery(tx:Transaction):Promise<void> {
        await write(tx,"UPDATE probe_type_qualifications SET state='quarantined' WHERE state='qualified'");
    }
}
