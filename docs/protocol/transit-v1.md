# TuneX Transit v1 · 非执行态契约准备

状态：**Contract draft, implemented in TS/Go parsers; NOT deployable**（2026-10-15）

依据 [ADR-0004](../decisions/0004-role-neutral-agent-multihop.md)，`NodeId` 是唯一注册身份，Transit 仅是某条 Forward 中间位置的执行角色。本文件的 `TransitIntent` 不属于现有 `ADP/3 Snapshot` 可执行的 Assignment：**禁止把它放入当前 Snapshot、手动修改 Agent Journal、或者借用 `native.relay.v1` 驱动执行**。

## 契约版本与字段

规范 Schema 为 [transit-v1.schema.json](schemas/transit-v1.schema.json)，与 [transit-v1.json](fixtures/transit-v1.json) 正反测试向量共享。通过 TS `parseTransitIntent` 和 Go `transitcontracts.Parse` 独立校验（Go 内嵌 Schema 必须与规范文件字节完全一致）。

- `contractVersion=1`、`driver=native.transit.v1`、`role=relay-transit`、`security=mutual-tls13`，与仍在运行的 `native.relay.v1` / `relay.wire.1` 明确隔离，协议不做隐式兼容或明文降级。
- 每个独立 Transit 实例必须显式携带 Scope、Forward、部署 Generation、Profile 及全路径 Digest 的占位引用。**当前解析器只检查 Digest 格式，尚未从完整授权路径计算并确认其真实性。**
- `nodeId + assignmentId + sessionEpoch + bindingFence` 定义本节点的逻辑/物理执行权；`upstream` 和 `downstream` 仅对应相邻的两个**不同** Node/Assignment/当前 Session/Fence，以及各自绑定的 peer 指纹；下游还有明确可达地址与端口。
- `hopIndex` 为零基位置，只有 `1..hopCount-2` 可以担任 Transit；当前总节点数界为 3..8，且本跳上/下游不得相同或等于当前 Node。
- `listener.protocol=tcp` 为当前逐跳 mTLS 承载的**内部物理监听**，即便 Forward 的 `protocol=udp` 也不能把它视作一个 UDP Socket。
- `issuedAt < authorizationUntil`、`egressPolicyRevision`、排序 CIDR、`allowMetadataTargets`、`maxConnections` 提供未来执行端强制授权截止与出站策略的来源。**当前离线解析不校验此时是否过期，不赋予任何网路权限。**

## 尚未实现的严肃执行门槛

1. 在 Runtime 有授权事实的事务中，为所有跳分配真实内部 TLS 端口和资源 Fence，验证所有 Scope grant、跨跳邻居证书 pin、Profile/Path Digest、执行 Lease 和能力版本；持久化全路径部署与操作序号，回滚可恢复。
2. 设计新的版本化 Agent Snapshot / Transit Assignment 和 hop open 握手（或明确版本升级方案）。TS/Go 双端解析器在无对应能力时明确返回 `UNSUPPORTED_CAPABILITY`，不允许老版本 Agent 静默解释成 Relay egress。
3. 在同一 Go Agent 内开发既监听上游、又 mTLS 连接下游的受限 Transit 引擎；遵守逐跳授权期限、UDP association、TCP 半关闭、资源上限、Fencing 和 drain。
4. 从 **A→B→C** 三节点真实 TCP/UDP/负面身份测试开始，再扩大至有界 N 跳。只有真实 Agent 数据面和 Control 的依赖顺序验收通过后，才能对用户开放创建或启用多跳 Forward。

## 可执行离线检查

```bash
npm run typecheck
npm test
npm run test:go
npm run contracts:check
```

共享 fixture 仅验证结构与无状态语义；**这不是新增可用的多跳传输**。
