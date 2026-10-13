import { execFile,spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { isIP } from 'node:net';

const execute=promisify(execFile);
export const viaWSL=process.platform==='win32';
if(!viaWSL&&process.platform!=='linux')throw new Error('Native Linux or a Windows WSL host is required');
const prefix=viaWSL?['--distribution',process.env.TUNEX_WSL_DISTRO??'TXBoard-Baseline','--exec']:[];
const configuredHost=viaWSL?process.env.TUNEX_WSL_HOST:(process.env.TUNEX_ACCEPTANCE_HOST??'127.0.0.1');
if(!configuredHost||isIP(configuredHost)!==4||viaWSL&&!/^172\.(?:[0-9]{1,3}\.){2}[0-9]{1,3}$/.test(configuredHost))throw new Error('Use the inspected private WSL interface or a native Linux acceptance IPv4 address');
export const host:string=configuredHost;
export function linuxPath(value:string):string{
 const absolute=resolve(value);if(!viaWSL)return absolute;
 if(!/^[A-Za-z]:\\/.test(absolute))throw new Error('Windows mounted workspace required');
 return `/mnt/${absolute[0]!.toLowerCase()}${absolute.slice(2).replaceAll('\\','/')}`;
}
export function linux(command:string,args:string[]=[],environment?:NodeJS.ProcessEnv){
 return execute(viaWSL?'wsl.exe':command,viaWSL?[...prefix,command,...args]:args,{...(environment?{env:environment}:{})});
}
export function spawnLinux(command:string,args:string[]=[]){return spawn(viaWSL?'wsl.exe':command,viaWSL?[...prefix,command,...args]:args,{stdio:['ignore','pipe','pipe']});}
export function linuxBinary(name:string):string{return linuxPath(`.artifacts/${name}${viaWSL?'-linux':''}`);}
export function mysqlClient(name:string):string{return process.env[name==='mysql'?'TUNEX_MYSQL':'TUNEX_MYSQLDUMP']??(viaWSL?resolve(`.cache/mysql/mysql-8.4.9-winx64/bin/${name}.exe`):name);}
export const recoveryClock={timeChecker:viaWSL?'wsl.exe':linuxBinary('time-proof'),timeCheckerArgs:viaWSL?[...prefix,linuxBinary('time-proof')]:[]};
export const topology=viaWSL?'Windows locked Control/MySQL with WSL native Linux Agent/client/target':'Native Linux Control/MySQL/Agent/client/target on one host';
