# TuneX VNext · 产品能力补齐与 ForwardX 经验吸收计划

状态：**Planned / incremental delivery**。建立于 2026-10-14 的 VNext ADP/3 基线之上。本文只定义差距、优先级、验收门槛；没有真实代码和带 commit 的实网证据时，不把功能标记为已实现。

2026-10-16 排期说明：本文保留产品方向及原始切片，近期基线收口以
[下一阶段开发目标](next-milestones.md) 为准；后续功能主线以
[转发平台四主线适配方案](forwarding-platform-plan.md) 为准。
固定 3–8 Node 路径已按
[ADR-0005](../decisions/0005-mixed-multihop-execution.md) 实现且默认关闭，
运行证据按对应 SHA 的交付台账及 Actions 核对，物理主机与生产门槛单独验收；
下文 Link/Path 的历史先后顺序不再作为多跳前置要求。

参考产品：[ForwardX](https://github.com/poouo/Forwardx)；仅借鉴其公开产品设计思路、用户工作流和对转发资源的分类。**不得复制 AGPL-3.0-only 源码、资产、组件实现、文档段落或未经许可的衍生代码**。历史 V2 许可证审查继续以 [legal/NOTICE.md](../../legal/NOTICE.md) 为准。

## 0. 方向与不可退让的边界

**定位**：可靠、易用、可扩展的自有网络转发平台；不是把 ForwardX 所有功能平移进 TuneX。

保留以下 VNext 不变量：

- Forward 是唯一必选业务；卸掉 Web、监控、路由、计量、计费、插件，direct TCP/UDP 依然可独立创建/运行/恢复。
- Pure Core 不接数据库、Web、Agent 网络、插件或运行时驱动；扩展通过 Application/Runtime/Adapter 公开端口完成。
- MySQL 对 Forward Revision、Operation、Snapshot、Deployment Generation、Fence、资源预留和墓碑保持权威。可选 Redis 只是加速层。
- **Desired / Applied / Healthy 分离**。API 的 202、Agent 的 ACK、监听就绪与健康探测不可混为一个“成功”。
- ADP/3 的完整快照、受保护 RuntimeJournal、授权租约硬截止、证书和 peer pin、拒绝旧代次和无静默明文降级保持强制。
- 跨节点 Prepare → Egress Active/Ready → Ingress Active/Ready 仍由 Runtime 协调；新的运行时不得绕过这些阶段。
- 一律按一项功能一个纵向切片和真实验收推进；不得让未知第三方程序经任意 shell API 获得 Agent 执行能力。

## 1. 从 ForwardX 学什么、不学什么

| ForwardX 的产品优点 | TuneX 的落地方向 | 不照搬的部分 |
| --- | --- | --- |
| 节点 Token/安装向导、节点在线和日常维护入口 | 受控 Enrollment、节点状态/凭据轮换/撤销/升级诊断、安装前置检查 | 弱化 mTLS、把 SSH 密钥存入 Control、允许任意 Agent 远程 shell |
| 可视化转发资源、按能力显示的表单 | 一个 Forward-first 配置流程；驱动 Capabilities 约束下拉值、默认值和字段可见性 | 将“端口转发/隧道/链”直接变成 Core 必选对象 |
| 规则状态分离和链路自测 | Desired/Deployment/Listener/Probe 四层诊断；错误码、时间戳、证据来源与建议 | 将“Agent 在线”冒充“规则可用” |
| Agent 事件唤醒 + 心跳对账 | 保留周期快照对账；可选事件提示只负责加速唤醒 | 将 SSE/Redis/WS 作为唯一正确性来源 |
| 多种引擎选择与协议参数提示 | 静态、版本化 driver registry；逐个引入明确认证/端口/可观察契约的 driver | 直接引入所有 Linux 工具及不受控的命令模板 |
| 固定转发链、入口/出口组和切换 | 先 Link 复用，再固定 Path 和手动/规则化切换，最后自动选路 | 首版智能调度、任意多跳、无验收的透明 UDP 切换 |
| 健康、延迟历史、流量/限额 | 可选 Observability/Metering 模块读模型；无数据时显示 unknown/stale | 把统计或计费写进数据面 hot path |
| Compose/安装器/升级/备份/诊断 | 支持外部 MySQL、现有反代、systemd Agent、只读诊断、演练式升级回滚 | 默认塞进捆绑数据库、未经审查的一键 root 脚本 |
| 插件表单与商业化产品 | 在稳定发布后建设受限能力声明 + 审计的管理扩展 | 任意动态 Agent 可执行代码、提前增加支付/工单/移动端 |

## 2. 产品对象与边界

保持核心 `ForwardSpec`：协议、一个入口、一个最终目标、可选 Path 和版本化 Transport Profile。

产品层（不写回 Pure Core）：
- **Node**：身份、能力、地址事实、Owner/Grant、凭据、在线 session 和租约事实；无权以 Node Owner 推导 Forward 授权。
- **Forward**：用户可见规则；属于 scope/workspace；不可跳过 `expectedRevision` CAS。
- **Path**：固定路径/策略与可见的解析结果；direct、两节点 Relay 已有实现，
  3–8 节点多跳按 ADR-0004/0005 实现且默认关闭，尚待运行验收；动态策略单独排期。
- **Transport Profile**：不可变 revision；公开驱动能力与参数模式；运行时接收编译后的严格配置，不接自由 JSON。
- **Operation / Deployment**：Runtime 归属；每次部署变更有持久 Operation、generation、fence、终态和诊断。
- **Link（未来）**：物理共享连接池/引用关系由 Transport 模块拥有，不用它替代 Forward 身份或端口预留。
- **Observability（可选）**：汇总 Node/Runtime 只读证据；不能成为健康状况的权威写方。

## 3. 工作批次与必须通过的验收

### A · 基线可信性与操作诊断（P0）

交付：CI 连续通过；故障码可区分损坏状态、无授权、下游不可用、目标拒绝；原样保留拒绝和有界授权逻辑。为每个 Operation 提供可查询的：ID、类型、scope、目标 Revision、Deployment Generation、当前阶段、失败码、最后更新时间和关联 Node。若目前不具备，先补查询投影再做 Web。

验收：
1. `npm run check`、Go vet/race、既有 direct/Relay/安全验收运行成功。
2. 包括 Linux native network namespace 的完整 CI 作业通过，且存在实际证据文件；**代码修复或 CI 配置并不等于验收通过**。
3. 损坏/旧版本 RuntimeJournal 必须显式 `INTEGRITY_FAILURE`，在 Hello 前拒绝，不允许重新 enroll 掩盖。
4. 把日志中的 secret/token/证书私钥排除出错误与支持包；测试确认不会泄露。
5. 控制面重启、Agent 失联、旧操作迟到与硬截止拒绝在用户/API 上可分辨。

### B · Forward-first Web 与节点运维（P1）

交付最小可用 Web（不迁移历史 V2）：
- 概览：Node online/offline/unknown、可用监听、待完成/失败 Operation、租约临近到期。
- 节点：注册/一次性 enrollment 信息、连接健康、Agent 版本/能力、凭据轮换/撤销、地址事实和目标权限；危险操作二次确认。
- 转发：按节点、协议、状态筛选/服务端分页，支持创建、更新、启停、删除、修订冲突反馈、Operation 实时进度。
- 详情：Desired / Applied / Healthy / Probe 四块独立展示；无 Probe 不显示绿色“可用”。
- 诊断：按 Forward → Operation → Assignment/Node → Listener → 探测逐层定位。
- 以 Node/Driver capabilities 驱动表单字段、禁用原因、默认值；后端再次独立校验。

验收：真实 UI → HTTP API → MySQL → Agent → TCP/UDP payload → UI ready；CAS 冲突、超权限、离线、监听冲突、失败补偿、删除收敛都有前后端测试。禁止开发模式自动管理员登录暴露公网。

### C · 可插拔数据面与拓扑（P2）

先定义静态 `DriverDescriptor`（示意，最终必须经过 ADR/Schema）：
- `id`、`revision`、`platforms`、`protocols`、`roles`、`familySupport`。
- `transportSecurity`、`requiresRootOrCapabilities`、`configSchemaId`、`supportedOptions`。
- `supportsPrepare`、`supportsDrain`、`supportsUsage`、`healthProbeMode`、`versionCompatibility`。

**顺序**：
1. 现有 `native.direct.v1` 和 `native.relay.v1` 能力声明/表单消费，不改变热路径。
2. 在单节点同地址族场景评估可选 Linux 内核 NAT 驱动；独立的授权、独占预留、防火墙最小变更/回滚、root/capability 要求和失败清理必须过真实内核验收。
3. Link 复用/引用计数与连接生命周期，不让共享连接跨 scope 泄漏。
4. 固定 Path 多跳或入口/出口组通过新 ADR；准备/激活与故障补偿沿用相同部署协议，具体多节点原子性限制必须明确。
5. 自动故障转移最后做，切换规则、健康时间窗、迟滞、TTL、drain、回滚和审计都需实测。

明确不承诺：QUIC、任意 L7/透明代理、所有 GOST 模式、Mimic、无缝 UDP session 迁移；只有有独立验收的驱动才在 UI 展示“支持”。

### D · 运维和首次发布（P1，与 B 并行但不抢占可靠性）

- Linux `control api/worker`（可同进程）+ 外部 MySQL + 反向代理 + 独立 systemd Agent 的参考部署。
- 生命周期：安装前检查 → enrollment → health/probe → 升级预检 → 数据库/信任材料备份 → 恢复 → 回滚限制说明 → 卸载确认。
- 管理通信代理支持需明确与 **业务数据路径** 完全独立，禁止设置 SOCKS 后误称业务隧道已代理。
- 提供 Operator CLI 的只读 `status`/`diagnose`/`version`，变更命令显式确认；无任意 shell 能力。
- release 清单、SHA256、SBOM/第三方许可证清单，生产凭据长周期轮换和两物理主机故障测试。

### E · 高级产品模块（P3，发布后）

监控历史、规则流量/限额、通知、插件、计费、支付、工单及移动端单独立项；未达独立验收不进入必选 Core。

## 4. Web 视图的状态数据契约

| 维度 | 权威来源 | UI 显示示例 |
| --- | --- | --- |
| Desired | Forwarding revision + enabled | `已请求启用 · r4` |
| Deployment | Runtime Operation/deployment | `部署中 · generation 9` |
| Applied | Agent 新鲜 report + snapshot/boot/session | `已应用 · generation 9` / `已过期` |
| Listener | Agent 实际监听事实 | `TCP 监听中` / `绑定失败` |
| Healthy | 独立真实探测且带时间与拓扑版本 | `探测通过（刚刚）` / `未知` |
| Authorization | Node/Peer 凭据 + lease deadline | `授权续期中` / `硬截止已到` |

UI 不得将 Agent 心跳成功、收到 ACK 或缓存的旧探测当成 `Healthy`。网络故障应给出发生 Node、方向和阶段；所有显示的时间必须有时区。

## 5. 反模式与排除清单

- 不直接复制 ForwardX 的 AGPL 代码、前端资产或安装脚本；不把历史 V2 当代码模板。
- 不通过随意增加 `forwardType` 枚举让 Core 认识每个第三方运行时。
- 不在 API 成功时乐观显示“已生效”；不靠前端排序/筛选代替服务器 ACL。
- 不允许一个第三方运行时在 Control 无法撤销授权时无限继续转发；若驱动无法满足 hard lease/stop，必须拒绝暴露为受控驱动。
- 不把已发布应用的安装量、功能数、吞吐经验估计当成 TuneX 的性能证据。
- 不为了快速上线把所有功能塞进 Agent 主文件；以独立 package、明确 owned state 和契约测试控制复杂度。

## 6. 跟踪规则

每个切片必须有：Owner、变更文件、契约版本、迁移/兼容、失败/恢复路径、测试命令、实网拓扑、证据 SHA/dirty 状态、CI 链接和发布状态。状态仅使用 planned / implementing / locally-verified / ci-verified / released，不得混写。

初始基线：`7a55cfa`（2026-10-14）；上游 ForwardX 参考版本 `v2.3.284`。文档计划不代表任何未开发产品能力已上线。
