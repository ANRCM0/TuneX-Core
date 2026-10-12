# Agent Deployment Protocol v2 (ADP/2)

状态：**Accepted for implementation，尚未实现**。依据 [ADR-0002](../decisions/0002-runtime-contract-closure.md) 取代 ADP/1；当前 V2 程序不实现本协议。本文是新的协议权威来源。

## 1. 范围与信任边界

Agent 主动访问 Control 的 HTTPS/JSON 端点，默认双向 TLS；用户数据不经过 Control。验证服务端信任链和主机名，Node 凭据只能访问其绑定的 Node。代理终止 mTLS 时，代理到 Control 必须受认证且身份头只能由可信代理写入，外部同名头必须清除。不得退化为信任客户端 nodeId。

MySQL 保存用户期望、Operation、完整快照、会话代次和资源 fence；Redis 只提供可丢失通知。无远程 shell、任意 URL 配置拉取或动态执行插件。离线授权不代表可即时撤销。

术语：Forward 为用户意图；Deployment 为一次有效配置计划；Assignment 为 Node × Forward × protocol × role 的期望执行槽；Snapshot 为该 Node 的完整期望集合；Observation 为带会话和新鲜度的观测。监听器 slot 与已建立连接分别拥有生命周期。

## 2. 版本、标量与 Schema

- `protocolVersion` 固定为整数 `2`；ADP/1 或历史 V2 请求返回 `UNSUPPORTED_PROTOCOL_VERSION`，不尝试解释其配置。
- ID 是 1..128 字符的 ASCII `[A-Za-z0-9][A-Za-z0-9._:-]*`，不赋予排序含义；Node/Forward ID 永不复用。
- 所有 revision、generation、fence、sessionEpoch、reportSequence 是 `1..9007199254740991` 的整数。不得使用浮点取整或溢出回绕；耗尽时停止分配并报错。
- 时间是 UTC RFC3339 字符串（`Z`）；摘要是 `sha256:` 加 64 位小写十六进制。
- 对象禁止重复 JSON key、未知字段、NaN/Infinity 和超范围数；缺省与 null 不可互换。Schema 不能检查的语义由解析器补充。
- [direct 阶段 JSON Schema](schemas/adp-v2-direct.schema.json) 覆盖 HelloRequest/Response、Snapshot、ReportRequest/Ack；[样例](fixtures/adp-v2-direct.json) 用于跨语言契约校验。它只声明 `native.direct.v1` 支持，不能用它声称 Relay 已可用。
- 新驱动在发送前必须有版本化 config Schema、明确 capability 和跨语言样例。兼容扩展需要双方显式协商；未知字段默认拒绝，禁止“先发过去让旧 Agent 猜”。改变授权、fence 或快照含义需要新协议版本及 ADR。

## 3. Hello 与会话

`POST /agent/v2/hello`：发送 `protocolVersion,nodeId,bootId,agentBuild,capabilities,lastStoredSnapshotGeneration`，最后一项允许 0，表示首次安装。bootId 每次进程启动重新生成；同一进程的 Hello 重试使用相同 bootId。

成功返回 `protocolVersion,nodeId,bootId,sessionEpoch,serverTime,policy`。policy 是第 10 节的有效运行参数；不向 Agent 接受无界或弱于安全底线的值。Control 事务化维护单调 sessionEpoch 与 bootId 注册记录：

1. 首次出现的新 bootId 分配更高 sessionEpoch，并替代当前会话；请求通过 Node 凭据和 enrollment 状态检查。
2. 当前 bootId 重试返回相同 epoch，不重置 snapshot generation 或租约。
3. 曾登记但已被取代的 bootId 的 Hello/report 返回 `SESSION_SUPERSEDED`，不能重新夺回当前会话。
4. boot 注册和退休记录至少保存至该 Node 身份退役；Phase 2 不做不安全 GC。新进程必须先 Hello，不能先恢复 socket。
5. hello 身份不证明机器唯一性。Node 凭据被克隆时必须撤销并重新注册；本协议不承诺对持有同一私钥的恶意进程实现硬件排他。

所有 Snapshot/Report 请求必须带当前 `X-TuneX-Session-Epoch` 十进制头；Node 由认证身份确定。Report 同时带 bootId 和 sessionEpoch，三者须一致。旧会话不能获取新授权。会话取代不会使网络分区中的旧进程立即停流；最迟在其原授权硬截止时停止。

## 4. 完整 Snapshot、摘要与续期

`GET /agent/v2/snapshot?sinceGeneration=N` 返回完整 Snapshot；N 是 0 或合法 generation，只是提示，不能把完整响应解释为增量。无须重发时可以 304，但 304 不续期。

Snapshot 必填：`protocolVersion,nodeId,sessionEpoch,snapshotGeneration,complete,issuedAt,validUntil,snapshotDigest,assignments,tombstones`。`complete` 只能为 true。正文超过限制、截断、错误 JSON 或校验失败，整份拒绝，不能据其缺失项删除已有转发。

摘要输入为去掉 snapshotDigest 字段后的整个对象，采用 [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785) 的 UTF-8 字节，SHA-256；数组顺序固定：Assignments 按 assignmentId 字典序，Tombstones 按 protocol、port、retirementGeneration、assignmentId 排序。配置摘要对完整 driver.config 使用同样规范化。摘要提供确定性比较，真实性仍来自认证通道和受保护的本地缓存，不能把无密钥哈希当签名。

同一 Node 的 snapshotGeneration 在 MySQL 事务内严格递增且永不复用。完整正文一经发布不可变；同 generation、不同摘要返回 `INTEGRITY_FAILURE`；低 generation 返回 `STALE_GENERATION`。相同 generation 和摘要可幂等对账，但不得重新从“现在”计算完整租约。

**续期采用新 Snapshot generation**：在剩余有效期低于 renewalLeadSeconds 时，Control 重新验证 Node、授权、目标策略、Driver 和当前期望，事务化发布更高 generation、新 issuedAt/validUntil 的完整快照。每 Node 并发续期以 CAS 合并，不能由陈旧 Worker 发布旧配置。续期不增加 forwardRevision/deploymentGeneration/bindingFence；Agent 不因 Snapshot generation 改变而重启相同配置的监听或已有连接。

新会话也须发布更高 generation 的完整 Snapshot。禁止修改旧快照 sessionEpoch 或有效期。Snapshot 只能从持久数据重建，数据源无效时不能无限续发旧授权。

## 5. 时间、离线与硬截止

Control 发出的租约不超过 policy.leaseSeconds，且不晚于节点凭据与相关运行秘密的到期时间。Agent 在有效 Node 凭据、当前 sessionEpoch 和时钟检查均通过后才接受授权。

允许时钟偏差为 policy.maxClockSkewSeconds。Agent 需有可验证的系统时间同步状态；Hello 的 serverTime 仅用于检测偏差，不能在偏差超限时自行放宽规则。接收快照时记本地墙钟 `W` 和单调时钟 `M`，保守剩余授权为 `validUntil - W - maxClockSkewSeconds`，拒绝非正值或未来 issuedAt 超界的快照。执行截止不晚于 `M + min(剩余授权, leaseSeconds)`，并持续检查凭据有效期。计时实现必须计入系统挂起时间，或在恢复后重新验证墙钟/授权再处理任何数据；不得因主机休眠延长租约。检测到超过允许偏差的墙钟与单调时钟分歧、时钟回滚、缓存损坏或 high-water 丢失时停止转发并报错。

普通禁用、删除、配置更新允许有界 drain；**租约、凭据、运行秘密的最早到期是硬截止**：停止新接入、关闭已有 TCP、删除 UDP 会话并释放本地执行资源。任何 drain deadline 不得晚于硬截止。释放本地资源不等于删除 Control 中的逻辑预留。

Agent 每次进程重启必须先恢复 high-water/fence，再在线完成 Hello 和新 Snapshot 才能重建转发；Phase 2 不支持离线重启恢复。运行中的进程可在 Control 失联后继续服务至硬截止。新租约不得追溯授权已超时的运行。

## 6. Assignment 与 Tombstone

每个 Assignment 必填：`assignmentId,forwardId,forwardRevision,deploymentGeneration,bindingFence,role,protocol,phase,listener,driver,drainTimeoutSeconds`（direct 基线）。phase 是 `prepared|active|draining`，protocol 是 `tcp|udp`。Driver 包含 `id,schemaVersion,configDigest,config`。

`native.direct.v1` 的 config 为 `{target:{host,port},egressPolicyRevision,allowedDestinationCidrs,allowMetadataTargets}`。目标地址、IDN/主机名规范化遵循 Core；DNS 在实际执行节点解析，每个候选 IP 都须落在不可为空的 CIDR allowlist 中，连接必须使用已校验的 IP，不能再调用可能重新解析主机名的接口。CIDR 地址族与解析结果严格匹配，IPv4-mapped IPv6 需先归一化；未指定目标地址始终拒绝。云元数据目标默认拒绝，即使被宽泛 CIDR 包含也不得访问；allowMetadataTargets 默认 false，只有有权限的节点策略显式允许时才编译为 true，仍须满足 CIDR 约束。支持平台的元数据地址清单由安全验收锁定，不由客户端任意覆盖。只改策略也产生新 deploymentGeneration，不能在相同 configDigest 下改变执行含义。UDP 的每次新 association 同样检查。

Node/protocol/port 是保守独占 binding key，不按监听 IP 共享。物理 slot fence 是授权所有权版本，在最终 bind/swap/release 时检查。assignmentId 表示稳定逻辑槽；deploymentGeneration 表示该槽配置实例。首次绑定、不同 Forward 接管或不同 deployment 实例接管 slot 时 fence 递增；仅 phase 推进和租约续期不递增。

同一 Snapshot 不允许逻辑槽重复、物理槽冲突，或出现既 active 又 retired 的相同 owner/fence。Tombstone 为 `{assignmentId,forwardId,protocol,port,bindingFence,retirementGeneration}`：retirementGeneration 是发布删除意图的 Snapshot generation，不大于当前 generation。retired fence 不得恢复；只有更高 fence 的新 owner 可以使用同端口。删除产生 Tombstone，缺失 Assignment 也代表移除；Tombstone 不得删除更高 fence 的 successor。

全快照通过结构和配置语义验证后，必须先持久化正文摘要、generation、fence/退休 high-water，再改变数据面。写盘失败保持原来仍有授权的数据面，报告 `PERSISTENCE_FAILURE`；到期仍须停止。实际 bind 等执行错误可逐 Assignment 报告，不能回退已接受 generation。相同 generation 的后续对账仍可恢复瞬时执行失败。

Phase 2 不清理 Node 身份下的退休 high-water。历史完整快照可按保留策略压缩，但当前权威快照必须容纳必要 Tombstones；达到大小上限时拒绝新增工作并提示容量问题，不分页、不截断、不把节点期望替换为空集合。安全 GC 需另有协议和测试。

## 7. 执行、更新与多节点顺序

准备仅验证配置、预留本地计划，不接受客户端流量。`active/ready` 才表示实际所需监听/内部传输可用；不代表最终目标端到端健康。入口 phase 不能因收到 prepared Assignment 而自行提升。

Relay 阶段严格按尾到头执行：prepare 下游 → activate 下游 → 收到匹配 deploymentGeneration、fence、当前 sessionEpoch 且未过 freshness 时限的 active/ready → activate 上游；最后开放客户端入口。Prepared 报告不足以触发入口激活。入口激活时还需进行驱动定义的对端认证/通路检查；检查失败不上报 ready。检查之后的网络故障仍可能发生，不能承诺分布式原子性；故障必须进入 degraded/error 和恢复流程。

单个 Assignment 是当前期望实例；Agent 另存以 `(assignmentId,deploymentGeneration,bindingFence)` 标识的 draining execution records，记录连接数、起止时间和 deadline。它们不能创建新连接、改变 successor listener 或释放 successor slot。Report 的 drains 字段报告这些记录，清理完成后 gone；Controller 对已知旧实例之外的报告拒绝推进状态。

禁用先发布 draining，完成后从快照移除并记录退休 fence，逻辑预留仍由原 Forward 保持；重新启用须使用更高 deploymentGeneration/fence，不能恢复已退休实例。删除与禁用使用相同停止流程，但只有删除在安全完成后释放预留。

同端口改目标：准备新配置 → 在 listener 管理锁内检查新 fence 并切换 accept 使用的实例 → 旧 TCP 流仍持有旧配置并排空。更新端口：先预留新端口并激活，再停止旧 accept，最后按安全条件释放旧预留。更新路径/驱动：只有驱动声明支持且通过测试才 make-before-break，否则明确停止后重建并记录中断。UDP 更新默认丢弃旧 association，后续数据报使用新配置，不承诺零丢包。

TCP+UDP 的预留在数据库中全有或全无，实际两个 bind 不具有跨 socket 原子性。Phase 2 采用可观测的部分失败策略：可工作的协议继续服务，另一协议报告错误；Forward 整体 `degraded`，Operation 不得成功。可重试错误有界重试，永久错误终止 Operation，但 Controller 仍管理所有已运行/待清理资源。禁止把已持久化的用户 protocols 静默缩减。

旧实例在更新失败时，只能在最新权威 Snapshot 仍明确授权它的阶段继续运行；Controller 必须显示 desired 与 applied 的差异。终止切换并保留旧配置需要更高 deploymentGeneration/fence 和新 Snapshot 的显式补偿计划，不能重发旧 generation。具体结果见 [Control API](../spec/control-api-v1.md)。

## 8. Report 与持久 ACK

`POST /agent/v2/report` 请求字段：`protocolVersion,nodeId,bootId,sessionEpoch,reportSequence,observedAt,acceptedSnapshotGeneration,observations,drains`。Observation 字段见 Schema，必须引用已向该 Node 发布的 Assignment 实例；条件为 pending/prepared/ready/degraded/error/draining/removed，errorCode 可空。仅 acceptedSnapshotGeneration 不能证明所有 Assignment 已应用。

reportSequence 在同一 boot 内递增，重试同一报告复用同一序号和完全相同正文。服务端将请求摘要、去重记录与观测更新同事务提交后，返回 `{protocolVersion,nodeId,bootId,sessionEpoch,reportSequence,status}`，status 为 accepted 或 duplicate。相同序号不同正文返回 `INTEGRITY_FAILURE`；旧会话返回 `SESSION_SUPERSEDED`；低序号不能覆盖新状态。丢 ACK 后重试不得重复推进 Operation 或计量。Agent 在收到持久 ACK 前保留待重试报告；退避队列有界，不能将状态报告当无损计费账本。

服务端以接收时间判断新鲜度，observedAt 只用于诊断。新会话成立时上一会话的实时观测立刻降为 unknown；本次新会话收到匹配报告后才能恢复 ready。授权中的旧流量可能仍持续至硬截止，这与 unknown 不冲突。

## 9. 错误与失败策略

稳定错误：`INVALID_CONFIG,UNSUPPORTED_CAPABILITY,UNSUPPORTED_PROTOCOL_VERSION,AUTHORIZATION_DENIED,PORT_IN_USE,STALE_GENERATION,FENCING_REJECTED,LEASE_EXPIRED,TRANSPORT_UNAVAILABLE,DEPENDENCY_NOT_READY,RESOURCE_CONFLICT,INTEGRITY_FAILURE,PERSISTENCE_FAILURE,SESSION_SUPERSEDED,CLOCK_UNCERTAIN,RESOURCE_LIMIT,INTERNAL_ERROR`。

错误响应为 `{code,message,retryable,retryAfterSeconds?,requestId}`，不含秘密。认证/授权失败使用 401/403；会话/版本/资源冲突使用 409；非法正文 400；超限 413/429；临时服务故障 503。遇 401/403 不得无限高速重试；会话取代后停止请求新授权，按本地授权硬截止收尾。未知错误永远不是成功。

网络超时指数退避并加 jitter，但不能延长租约。Schema/完整性/会话/冲突失败整份拒绝；bind/拨号等已验证配置的执行失败逐项报告。禁止因无效快照清空运行集合或因为一个永久错误跳过授权校验。

## 10. Phase 2 运行基线

这些是可验收的开发默认值，不是性能承诺。配置改变应被校验、审计并在 Hello 返回。降低授权期限必须停止续发旧策略，已发租约仍按原硬截止计算回收安全窗口。

| 参数 | 默认值 | 约束与用途 |
| --- | --- | --- |
| pollIntervalSeconds | 10 | >0 且小于 renewalLeadSeconds；轮询带 jitter |
| leaseSeconds | 300 | 不超过凭据/秘密期限；管理员不可设为无限 |
| renewalLeadSeconds | 120 | 大于两次轮询和允许偏差，小于 leaseSeconds |
| maxClockSkewSeconds | 5 | 超限 fail closed，不能动态放宽 |
| observationFreshnessSeconds | 30 | 超时状态 unknown，不等于立即删除配置 |
| drainTimeoutSeconds | 30 | 可配置 0..300 秒；普通 drain 上限；始终被授权硬截止截短 |
| connectTimeoutSeconds | 10 | 拨号必须取消并释放资源 |
| udpIdleTimeoutSeconds | 60 | 按最后成功活动时间过期 |
| maxTcpConnectionsPerAssignment | 1024 | 超限拒绝新连接并计数，不影响既有连接 |
| maxUdpSessionsPerAssignment | 4096 | 超限丢弃新 association 并计数 |
| maxSnapshotBytes | 4194304 | 完整正文上限；先检查原始长度 |
| maxReportBytes | 1048576 | 拒绝超限并保留上一份有效观测 |
| maxAssignmentsPerNode | 1000 | 发布前检查全快照大小和本机总资源预算 |

Node 总 fd、内存、goroutine、连接和 UDP 数据报大小预算必须在网络验收前定义并实测；以上逐 Assignment 限额不能代替 Node 总预算。Phase 2 控制 HTTP 单次请求默认超时 10 秒；重试默认从 1 秒指数退避至最多 30 秒并加 jitter。Report 待 ACK 队列默认最多 100 条或 4 MiB（先到为准），满时暂停产生新报告、保留待重试正文并在下一可用序号报告当前聚合状态，不能修改已发送序号的正文。此队列不是无损指标账本。Operation 总重试期限见 [Operation 契约](../spec/control-api-v1.md)；任何退避都不延长授权。

## 11. 验证与后续范围

见 [验收矩阵](../testing/acceptance-v1.md)。双语言共享 fixture 必须覆盖合法消息、超范围整数、重复字段、摘要不一致、旧 session、时钟跳变、续期不重启、部分 bind 和硬截止断流。

Relay 在 Phase 3 前必须提交自己的 config/wire Schema、身份握手、封装与目标/回包限制、内部端口预留及测试；此处角色与顺序定义不等于 Relay 协议实现完成。恢复旧备份和节点重装遵循 [节点安全与恢复](../operations/node-security-and-recovery-v1.md)。

## 12. Fixture 使用与语义校验边界

fixture 顶层的 valid/invalid 是测试容器，不是线上消息。分别取各项 payload，按 Schema 的 `$defs` 中对应名称校验，启用 date-time/ipv4/ipv6 格式检查。semanticCases 定义结构校验以外的负面行为；固定时间样例不是可用于当前节点的授权。

Schema 只覆盖结构。实现还必须校验：CIDR/目标主机语法与安全策略；端口/Assignment 唯一；摘要；时间先后和租约上界；policy 的交叉约束；capabilities 是否包含所需协议和驱动；Observation 的 phase/condition 一致性与实例归属；drain deadline 不越过授权硬截止。未接受过快照时 acceptedSnapshotGeneration 可为 0，但 observations/drains 必须为空。

phase/condition 最小约束：ready 只对应 active；prepared 对应 prepared；removed 对应 absent；draining 对应 draining；pending/degraded/error 保留实际已到达的 phase，不虚报 ready。Report 中可以包含已知旧实例的 removed/drain-complete，但不能据其推进新版本应用成功。

实现仓库应以锁定版本的 RFC 8785 库执行规范化，并保存 RFC 的数字/字符串测试向量；不能把语言默认 JSON 序列化直接当跨语言摘要算法。ADP/2 当前仅允许安全整数，但错误文本和未来可选元数据仍需正确处理 Unicode。
