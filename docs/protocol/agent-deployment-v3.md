# Agent Deployment Protocol v3：完整资源契约

状态：Accepted for implementation；Schema/TS/Go parser 与 MAC journal 已实现，
Control/Agent 在线切换尚未接入，当前运行版本仍 ADP/2 direct。依据
[ADR-0003](../decisions/0003-native-relay-tls13.md)，资源角色变化采用协议 3。

[完整 Schema](schemas/adp-v3-runtime.schema.json) 固定 HelloRequest/Response、
Snapshot、ReportRequest/Ack 的 protocolVersion=3；ErrorResponse 仍独立严格形状。
[26 项共享向量](fixtures/adp-v3-runtime.json) 同时覆盖 direct/Relay、混合 Snapshot、
身份/会话、unsafe integer、摘要、物理槽冲突、退休高水位与规范地址。
ADP/2 的 ID、计数器、完整快照/摘要、续期、硬截止、在线重启及报告语义沿用。
在线 endpoint、数据库发布与能力切换必须由后续集成完成，不能仅解析成功后宣称支持。

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
与 ADP/2 journal 没有自动清零或降级适配；在线迁移/重新注册流程仍需单独落地。

剩余：机器 endpoint/Hello 能力、current session、安全 peer cert 管理、全节点
Runtime 发布/租约/Operation、prepared→active、Agent 对完整快照的状态接管与
旧实例 drain、多进程双 Agent 网络及恢复验收。此阶段保留 ADP/2 在线入口，
用户 Relay 创建仍返回 unsupported。
