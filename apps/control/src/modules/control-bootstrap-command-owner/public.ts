export const CONTROL_BOOTSTRAP_COMMAND_INTERFACE_VERSION=1 as const;

export interface ControlBootstrapDatabase {migrate():Promise<void>;close():Promise<void>}
export interface ControlBootstrapCommandEffects<Database extends ControlBootstrapDatabase> {
    arguments():string[];
    env(name:string):string|undefined;
    openDatabase(url:string):Database;
    bootstrap(db:Database,scope:string,actor:string,token:string):Promise<void>;
    log(message:string):void;
}

export async function runControlBootstrap<Database extends ControlBootstrapDatabase>(effects:ControlBootstrapCommandEffects<Database>):Promise<void> {
    const [scope,actor]=effects.arguments();const url=effects.env('DATABASE_URL'),token=effects.env('TUNEX_OWNER_TOKEN');
    if(!scope||!actor||!url||!token)throw new Error('DATABASE_URL, TUNEX_OWNER_TOKEN and scope/actor arguments required');
    const db=effects.openDatabase(url);
    try{await db.migrate();await effects.bootstrap(db,scope,actor,token);effects.log(`Created owner ${actor} in scope ${scope}`);}finally{await db.close();}
}
