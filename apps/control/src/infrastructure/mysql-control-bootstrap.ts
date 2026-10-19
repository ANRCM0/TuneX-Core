import type { MySqlUnitOfWork } from './mysql.ts';

export interface ControlBootstrapObsoleteRow { n:number }
export interface ControlBootstrapIdentityRow { name:string;nodes:number }

/** Raw startup reads on the original pool; startup decisions stay with the caller. */
export class MySqlControlBootstrapStore {
  private readonly db:Pick<MySqlUnitOfWork,'pool'>;
  constructor(db:Pick<MySqlUnitOfWork,'pool'>) { this.db=db; }
  async obsoleteSnapshots():Promise<ControlBootstrapObsoleteRow[]> {
    const [obsolete]=await this.db.pool.query<any[]>("SELECT COUNT(*) n FROM snapshots WHERE JSON_EXTRACT(body,'$.protocolVersion') IS NULL OR JSON_EXTRACT(body,'$.protocolVersion')<>3");
    return obsolete;
  }
  async authorityIdentity():Promise<ControlBootstrapIdentityRow[]> {
    const [records]=await this.db.pool.query<any[]>("SELECT CONCAT(@@server_uuid,':',DATABASE()) name,(SELECT COUNT(*) FROM nodes) nodes");
    return records;
  }
}
