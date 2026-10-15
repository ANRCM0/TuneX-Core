import { parsePorts, directCapable } from './model.js';

export function relayCapable(node) {
  return directCapable(node) && ['native.relay.v1', 'relay.wire.1'].every(c => node.policy.capabilities.includes(c));
}
export function multihopCapable(node) {
  return relayCapable(node)&&['adp.execution.1','native.multihop.v1','multihop.wire.1'].every(c=>node.policy.capabilities.includes(c));
}
export function multihopSpec(form, path, profile, enabled) {
  if(!enabled)throw new Error('Control 尚未开启多跳执行');
  if(!Array.isArray(path)||path.length<3||path.length>8||new Set(path.map(n=>n?.id)).size!==path.length||path.some(n=>!multihopCapable(n)))throw new Error('多跳路径要求 3–8 个不同且支持多跳执行的有效节点');
  const spec=relaySpec(form,path[0],path.at(-1),profile);
  if(path.some(n=>spec.protocols.some(p=>!n.policy.capabilities.includes(p))))throw new Error('路径中的每个节点都必须支持业务协议');
  return {...spec,path:{via:path.slice(1).map(n=>n.id)}};
}
export function relayProfile(input) {
  const protocol=String(input.protocol??'');
  if (!['tcp','udp','both'].includes(protocol)) throw new Error('Relay Profile 协议不受支持');
  const number=(name,min,max)=>{
    const raw=String(input[name]??'');
    if (!/^[1-9][0-9]*$/.test(raw)) throw new Error(name+' 必须是整数');
    const n=Number(raw);if(n<min||n>max) throw new Error(name+' 超出允许范围');
    return n;
  };
  const maxFrameBytes=number('maxFrameBytes',64,65536);
  const maxUdpDatagramBytes=number('maxUdpDatagramBytes',1,16384);
  if(maxUdpDatagramBytes>maxFrameBytes)throw new Error('UDP 上限不能大于帧大小');
  return {
    driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',
    protocols:protocol==='both'?['tcp','udp']:[protocol],
    handshakeTimeoutSeconds:number('handshakeTimeoutSeconds',1,10),
    idleTimeoutSeconds:number('idleTimeoutSeconds',1,300),
    maxFrameBytes,maxUdpDatagramBytes,
    maxConnectionsPerNode:number('maxConnectionsPerNode',1,4096)
  };
}
export function relayEndpoint(form) {
  const host=String(form.advertisedHost??'').trim(),address=String(form.listenAddress??'').trim();
  if(!host||host.length>253||!address||address.length>45)throw new Error('请填写实际可达的 Endpoint 地址');
  const ports=parsePorts(form.ports);
  if(ports.length>256) throw new Error('Relay 内部 TCP 端口不能多于 256 个');
  return {listenAddress:address,advertisedHost:host,allowedTcpPorts:ports};
}
export function relaySpec(form, ingress, egress, profile) {
  if(!relayCapable(ingress)||!relayCapable(egress)||ingress.id===egress.id)throw new Error('Relay 要求两台不同且支持 Relay 的有效节点');
  if(!profile||!Number.isSafeInteger(profile.revision)||profile.revision<1)throw new Error('请选择有效的不可变 Transport Profile revision');
  const protocols=form.protocol==='both'?['tcp','udp']:[form.protocol];
  if(protocols.some(x=>!['tcp','udp'].includes(x)||!ingress.policy.capabilities.includes(x)||!egress.policy.capabilities.includes(x)||!profile.config.protocols.includes(x)))throw new Error('协议必须被两台节点和 Profile 同时支持');
  const address=String(form.listenAddress??''),port=Number(form.listenPort),targetPort=Number(form.targetPort);
  const host=String(form.targetHost??'').trim();
  if(!ingress.policy.allowedListenerAddresses.includes(address)||!ingress.policy.allowedPorts.includes(port))throw new Error('入口监听地址或端口未经授权');
  if(!Number.isInteger(targetPort)||targetPort<1||targetPort>65535||!host||host.length>253)throw new Error('目标地址或端口无效');
  return {
    enabled:Boolean(form.enabled),protocols,
    ingress:{nodeId:ingress.id,listen:{address,port}},
    target:{host,port:targetPort},
    path:{via:[egress.id]},
    transport:{profileId:profile.profileId,configRevision:profile.revision}
  };
}
