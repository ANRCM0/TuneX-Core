import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { linux, spawnLinux } from './native-linux.ts';

type Link = {ifname:string;ifalias?:string};
type Route = {dst?:string};

// Every link and firewall rule belongs to this lab. No host forwarding, NAT,
// default route, firewall policy or pre-existing service is changed.
export class NetworkLab {
 readonly ip=process.env.TUNEX_IP??'/sbin/ip';
 readonly ss=process.env.TUNEX_SS??'/sbin/ss';
 readonly libraryPath=process.env.TUNEX_NETWORK_LIBRARY_PATH;
 readonly identity=`tunex-net-${randomBytes(6).toString('hex')}`;
 readonly bridge=`txb${randomBytes(4).toString('hex')}`;
 readonly namespaces=[`${this.identity}-i`,`${this.identity}-e`,`${this.identity}-r`];
 readonly links:string[]=[];
 readonly inodes=new Map<string,string>();
 subnet='';gateway='';ingress='';egress='';replacement='';
 private sudo=false;

 private admin(command:string,args:string[]=[]){const tool=this.libraryPath?'/usr/bin/env':command,argumentsIn=this.libraryPath?[`LD_LIBRARY_PATH=${this.libraryPath}`,command,...args]:args;return this.sudo?linux('/usr/bin/sudo',['-n',tool,...argumentsIn]):linux(tool,argumentsIn);}
 run(namespace:string,command:string,args:string[]=[]){assert.ok(this.inodes.has(namespace));return this.admin(this.ip,['netns','exec',namespace,command,...args]);}
 spawn(namespace:string,command:string,args:string[]=[]){assert.ok(this.inodes.has(namespace));const argsIn=['netns','exec',namespace,command,...args],tool=this.libraryPath?'/usr/bin/env':this.ip,argumentsIn=this.libraryPath?[`LD_LIBRARY_PATH=${this.libraryPath}`,this.ip,...argsIn]:argsIn;return this.sudo?spawnLinux('/usr/bin/sudo',['-n',tool,...argumentsIn]):spawnLinux(tool,argumentsIn);}
 async open(){
  this.sudo=(await linux('/usr/bin/id',['-u'])).stdout.trim()!=='0';
  await this.admin('stat',['-Lc','%i','/proc/self/ns/net']);
  await this.admin(this.ip,['netns','list']);
  const routes=JSON.parse((await this.admin(this.ip,['-json','route','show','table','all'])).stdout) as Route[];
  const addresses=JSON.parse((await this.admin(this.ip,['-json','address','show'])).stdout) as {addr_info:{local:string;prefixlen:number}[]}[];
  const occupied=[...routes.flatMap(route=>route.dst&&route.dst!=='default'?[route.dst]:[]),...addresses.flatMap(link=>link.addr_info.map(address=>`${address.local}/${address.prefixlen}`))];
  for(let attempt=0;attempt<32;attempt++){
   const octet=randomBytes(1)[0]!,candidate=`10.254.${octet}.0`;
   if(occupied.some(route=>overlaps(route,candidate,24)))continue;
   this.subnet=`${candidate}/24`;this.gateway=`10.254.${octet}.1`;this.ingress=`10.254.${octet}.2`;this.egress=`10.254.${octet}.3`;this.replacement=`10.254.${octet}.4`;break;
  }
  assert.ok(this.subnet,'Unused lab subnet required');
  try{
   await this.admin(this.ip,['link','add',this.bridge,'type','bridge']);this.links.push(this.bridge);
   await this.admin(this.ip,['link','set','dev',this.bridge,'alias',this.identity]);
   await this.admin(this.ip,['address','add',`${this.gateway}/24`,'dev',this.bridge]);
   await this.admin(this.ip,['link','set',this.bridge,'up']);
   for(const [index,namespace] of this.namespaces.entries()){
    await this.admin(this.ip,['netns','add',namespace]);
    this.inodes.set(namespace,(await this.admin('stat',['-Lc','%i',`/var/run/netns/${namespace}`])).stdout.trim());
    const hostLink=`tx${index}h${this.bridge.slice(3)}`,peerLink=`tx${index}p${this.bridge.slice(3)}`;
    await this.admin(this.ip,['link','add',hostLink,'type','veth','peer','name',peerLink]);this.links.push(hostLink);
    await this.admin(this.ip,['link','set','dev',hostLink,'alias',this.identity]);
    await this.admin(this.ip,['link','set',peerLink,'netns',namespace]);
    await this.admin(this.ip,['link','set',hostLink,'master',this.bridge]);
    await this.admin(this.ip,['link','set',hostLink,'up']);
    await this.run(namespace,this.ip,['address','add',`${[this.ingress,this.egress,this.replacement][index]}/24`,'dev',peerLink]);
    await this.run(namespace,this.ip,['link','set',peerLink,'up']);
    await this.run(namespace,this.ip,['link','set','lo','up']);
   }
  }catch(error){try{await this.close();}catch(cleanup){throw new AggregateError([error,cleanup],'Lab creation and cleanup failed');}throw error;}
  return this;
 }
 async partition(ports:number[],blocked:boolean,egress=this.egress){
  assert.ok([this.egress,this.replacement].includes(egress));
  assert.ok(ports.length>0&&ports.every(port=>Number.isInteger(port)&&port>0&&port<=65535));
  for(const port of ports)await this.run(this.namespaces[0]!,'/usr/sbin/iptables',['-w','5',blocked?'-I':'-D','OUTPUT','-d',`${egress}/32`,'-p','tcp','--dport',String(port),'-m','comment','--comment',this.identity,'-j','DROP']);
 }
 async counters(){return (await this.run(this.namespaces[0]!,'/usr/sbin/iptables',['-w','5','-nvxL','OUTPUT'])).stdout;}
 async close(){
  for(const [namespace,inode] of this.inodes){
   const actual=await this.admin('stat',['-Lc','%i',`/var/run/netns/${namespace}`]).catch(()=>undefined);
   if(actual?.stdout.trim()!==inode)throw new Error('Lab namespace identity changed; refusing cleanup');
   await this.admin(this.ip,['netns','delete',namespace]);this.inodes.delete(namespace);
  }
  for(const name of [...this.links].reverse()){
   const existing=JSON.parse((await this.admin(this.ip,['-json','link','show'])).stdout) as Link[];
   const link=existing.find(item=>item.ifname===name);if(!link)continue;
   assert.equal(link.ifalias,this.identity,'Refuse foreign link cleanup');
   await this.admin(this.ip,['link','delete',name]);
  }
  this.links.length=0;
 }
 async verifyClosed(){
  const namespaces=(await this.admin(this.ip,['netns','list'])).stdout.split('\n').map(line=>line.split(' ')[0]);
  assert.ok(this.namespaces.every(namespace=>!namespaces.includes(namespace)),'Owned namespaces must be gone');
  const links=JSON.parse((await this.admin(this.ip,['-json','link','show'])).stdout) as Link[];
  assert.ok(!links.some(link=>link.ifalias===this.identity||link.ifname===this.bridge),'Owned links must be gone');
 }
}

function overlaps(route:string,address:string,prefix:number):boolean{
 const [ip,bits]=route.split('/');if(!ip||!/^\d+\.\d+\.\d+\.\d+$/.test(ip))return false;
 const length=Math.min(bits===undefined?32:Number(bits),prefix);if(!Number.isInteger(length)||length<0||length>32)throw new Error('Invalid host route');
 const number=(value:string)=>value.split('.').reduce((total,part)=>total*256+Number(part),0)>>>0,mask=length===0?0:(0xffffffff<<(32-length))>>>0;
 return ((number(ip)&mask)>>>0)===((number(address)&mask)>>>0);
}
