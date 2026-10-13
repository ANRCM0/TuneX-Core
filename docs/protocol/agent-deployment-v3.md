# Agent Deployment Protocol v3：完整资源契约

状态：direct 与两节点加密 Relay 在线实现已完成，本地实网与网络隔离切片通过；
完整阶段与发布验收仍在推进。Control/Agent 使用 ADP/3、完整物理资源快照和受保护 RuntimeJournal。依据
[ADR-0003](../decisions/0003-native-relay-tls13.md)，资源角色变化采用协议 3。

[完整 Schema](schemas/adp-v3-runtime.schema.json) 固定 HelloRequest/Response、
Snapshot、ReportRequest/Ack 的 protocolVersion=3；ErrorResponse 仍独立严格形状。
[26 项共享向量](fixtures/adp-v3-runtime.json) 同时覆盖 direct/Relay、混合 Snapshot、
身份/会话、unsafe integer、摘要、物理槽冲突、退休高水位与规范地址。
ADP/2 的 ID、计数器、完整快照/摘要、续期、硬截止、在线重启及报告语义沿用。
机器入口为 `/agent/v3/hello`、`snapshot`、`report`、`credentials/rotate` 和
`relay-credential`；Hello 必须声明 `adp.3`。同 boot 重试不能改变能力声明。
`/agent/v2/*` 返回 `UNSUPPORTED_PROTOCOL_VERSION`，不转换旧正文。

Assignment 的 `listener` 改为显式 `resource:{address,port,protocol}`。用户
`protocol` 与物理 `resource.protocol` 是不同事实：direct/relay-ingress 采用用户
协议，relay-egress TCP/UDP 都使用内部 TCP TLS socket。role 固定 direct/
relay-ingress/relay-egress，驱动 config 严格 oneOf。所有 direct/Relay 资源在同一
Node Snapshot 中共同检查保守 `physicalProtocol/port` 独占；不允许两个
独立快照渠道各自占用或误删一半配置。

Relay config 精确绑定双端 Node/Assignment/session/fence、Forward revision/
deployment、Profile ID/revision/digest、最多两个 peer leaf fingerprints，
role-specific endpoint 和 Node destination policy。校验器检查本 Assignment
与 Snapshot node/session 是否一致；阶段 prepare/active 不改变 binding。
Profile、config 与 Snapshot 都使用现有 RFC8785 摘要规则。目标 DNS/IP 权限在
实际拨号前仍由执行引擎检查，Schema 不替代实际授权。

Tombstone 保留 role、用户 protocol 与 physicalProtocol。排序按 physicalProtocol、
port、retirementGeneration、assignmentId；同物理槽/fence 不能重复，新
assignment 的 fence 必须超过退休 fence。counter 不能回绕，缺失/截断/超限
完整集合整份拒绝，不分页或静默删旧 high-water。

Go `state.RuntimeJournal` 包含 protocolVersion=3、精确 Node ID 和完整 Snapshot/
generation/digest/fences/retired。MAC 使用受保护独立 key；写入依赖现有
原子 fsync。初始化独占创建，不能覆盖已有或损坏状态。加载检查外/内记录、
原始 JSON、Snapshot 摘要/身份与物理 fence；从磁盘恢复只提供持久高水位，
不会执行缓存授权。接受新快照先加锁、重读并比较旧 generation/digest/maps，
旧调用方不能覆盖新持久事实；保存失败返回原状态，不允许随后 bind。
与 ADP/2 journal 没有自动清零或降级适配。标准 Agent 首次注册创建 ADP/3
RuntimeJournal，旧 journal 拒绝启动。Control 发现旧 ADP/2 Snapshot 历史时
拒绝启动，不能把字段改写为 3。部署切换须停掉旧签发端、耗尽旧授权、保留
旧 journal/计数器作审计，使用新的数据库、信任材料与 Node 身份审阅后重建。
旧备份恢复演练当前针对同协议 ADP/3 的旧备份，不能算 ADP/2 原地升级证据。

Control 将 ADP/3 正文原样持久化并发送；Runtime 发布/退役/租约/Operation 都读取
physical resource。Agent 在变更 socket 前持久接受快照，续期保持监听实例；
报告/ACK、drain、重启和截止沿用既有严格语义。direct 执行器的内部配置转换
不是 wire 兼容层，它只接收已经通过 ADP/3 解析的 direct Assignment。

显式 `--relay` Agent 已加载受保护 peer key，并在完整快照下执行 prepare/active。
Control 已接入双端持久计划与按当前 ready 报告推进的协调，实际 Forward API 到
两个独立 Agent 的加密 TCP/UDP 已有本地证据，见 [Relay Control](../development/relay-control.md)。
剩余包括自动 peer 更新、完整路径/同槽切换故障矩阵、网络隔离与发布安全门槛。
