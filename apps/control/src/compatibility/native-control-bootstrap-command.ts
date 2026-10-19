import { MySqlUnitOfWork } from '../infrastructure/mysql.ts';

export const CONTROL_BOOTSTRAP_NATIVE_INTERFACE_VERSION=1 as const;
export type NativeControlBootstrapDatabase=MySqlUnitOfWork;

export const nativeControlBootstrapEffects={
    arguments:()=>process.argv.slice(2),
    env:(name:string)=>process.env[name],
    openDatabase:(url:string)=>new MySqlUnitOfWork(url),
    log:(message:string)=>console.log(message),
};
