# TuneX 转发平台四主线适配方案

日期：2026-10-16（Asia/Shanghai）。
状态：**Proposed / 分批实施方案**。四条产品主线来自本轮需求；本文不等同于
已接受的新协议 ADR，不将计划中的 API、表或驱动标记为已实现。

实施前先完成 [Core 与兼容接入层现状](../architecture/core-and-compatibility-status.md)
所列边界确认与接入契约评审，优先用已有原生能力验证框架，不继续向中心类堆分支。
这不删除既有审计/支持包、证据与生产验收责任，也不表示本轮已经开始重构。

源码基线：TuneX `03513a941177afcb84a5a1e6eab025c830d63300`；
ForwardX `v2.3.284` / `11487874b133cdb7ad54a0f9071601092f5d9060`。
本轮通过 GitHub API 核对上游版本，并在该固定提交读取功能文档及状态处理源码。
代码存在、Actions 通过、物理主机验收和正式发布分别记账，不相互替代。

## 1. 目标、范围与参考方法

后续产品围绕四条主线：**基础转发、加密隧道、拓扑与切换、监控与探测**。
目标闭环是“配置规则 → 安全部署 → 真实观察 → 定位故障 → 受控切换 → 可审计恢复”。
暂不扩展计费、支付、工单、移动端、AI、任意可执行插件或通用 VPN 产品。

“迁移适配”指业务概念、用户流程、状态语义与验收场景的适配和独立实现，
不是上游源码移植，不兼容 FXP 私有线协议，也不自动导入 ForwardX 或旧 V2 数据库。
沿用 [经验吸收计划](forwardx-gap-closure.md) 的不复制源码/资产约束及
[历史来源记录](../../legal/NOTICE.md)，不从重写推导既有分发义务已经消失。

固定版本参考入口：

- [转发链](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/docs/guide/port-chains.md)：有序节点、链路复用、分段诊断。
- [隧道](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/docs/guide/tunnels.md)：承载与业务协议分离、组与分支、能力约束表单。
- [流量与延迟](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/docs/guide/traffic-latency.md)：指标口径、累计计数、缺测与历史窗口。
- [拓扑标识](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/server/probeTopology.ts)：拓扑变化后隔离旧探测。
- [探测计数上报](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/server/agentProbeCounterReportGate.ts)：去重、采样与累计次数分离。

这些是需求参考而不是直接执行的规范；TuneX 的授权、硬租约和状态所有权优先。
不直接采用上游所有健康聚合公式，也不把分段延迟之和视作真实业务端到端延迟。

## 2. 基线与功能映射

| 主线 | TuneX 已有 | 参考的产品逻辑 | 适配后的交付 |
| --- | --- | --- | --- |
| 基础转发 | 原生 TCP/UDP Direct；CAS、启停删重试、端口仲裁 | 按能力配置、规则状态与日常管理 | 统一能力描述、预检、错误定位、批量受控操作；以后单独评估 NAT/外部引擎 |
| 加密隧道 | TLS 1.3 Relay；默认关闭的固定 3–8 Node 多跳 | 隧道资源、承载与业务协议区分、共享配置 | 原生 Profile/Endpoint 产品化；版本锁定；随后评估独立 WireGuard 承载 |
| 拓扑与切换 | 固定路径编译、阶段协调、部分切换/故障验收 | 保存链、复用、入口/出口组、备用路径 | 路径模板与显式发布、手动切换、组管理，独立探测就绪后再做自动故障转移 |
| 监控与探测 | 部署/监听/租约/操作观察及节点诊断 | 分段测试、独立健康、历史与流量口径 | 有界 Probe、指标与历史、诊断视图、基础告警，不进入转发正确性热路径 |

已有多跳不是待从零开发的功能；已有 Relay 切换用例也不是通用路由策略已经交付。
现有轻量 Web 测试不等同真实浏览器验收。已有进程资源采样不是完整主机监控。
具体证据仍查 [实施进度](progress.md)、[多跳交付台账](multihop-delivery.md)
及 exact-SHA Actions，不继承旧文档中的“待运行”或历史成功作为新版本结论。

## 3. 架构与状态所有权

```text
Console / CLI
    |
Hono API / Application
    |-- Forwarding -------- Forward intent / revision
    |-- Transport --------- immutable Profile / driver descriptors
    |-- Topology (new) ---- PathTemplate / Group / bindings
    |-- Routing (new) ----- policy / candidate / switch proposal
    |-- Observability ---- Probe / metrics / history / alerts
    |
existing Runtime ---------- Operation / Snapshot / lease / reservations
    |
ADP/3 + explicitly negotiated extensions
    |
Go Agent ----------------- native engines / bounded drivers / Probe executor
```

### 3.1 不变量

- Pure Core 保持最小 Forward 模型，不引入数据库、探测、图表、第三方程序或策略调度。
- Forwarding 拥有意图，Runtime 独占执行台账和 Agent Assignment。
  Routing 只能提案，不直接发 Agent 命令或写端口、租约、Snapshot。
- MySQL 是权威；不新增必选 Redis、消息代理或时序数据库。事件推送只用于加速，
  丢失后仍能从持久状态对账，关闭监控和自动路由不破坏已有 Direct 运行。
- 沿用 Scope Membership、显式 Node/Profile Grant、目标策略、mTLS、
  Session/Generation/Fence、受保护 Journal 和授权硬截止。
- Desired、Deployment、Applied、Listener、Probe、Authorization 分开展示。
  没有新鲜 Probe 就显示 unknown/stale，不把 Agent 在线作为业务健康。
- 物理承载端口按真实协议占用：例如承载 UDP 业务的 TLS listener 仍占 TCP，
  不为逻辑业务协议虚构第二个物理监听。

### 3.2 版本策略

当前严格 parser 拒绝未知字段，不能向旧 ADP/3 消息偷偷追加 telemetry、Probe 或新驱动。
新增能力分别设计版本化 schema、capability、TypeScript/Go 类型、负面 fixture 和升级矩阵；
选择独立机器端点或显式协商扩展须通过 ADR。
旧 Agent 显示 unsupported，不接收不能理解的任务，不静默回退明文或旧驱动。
新增数据库迁移必须同步只读升级评估器的兼容上限，不能只增加 SQL 文件。

## 4. 主线 A：基础转发

### A1. 统一原生能力与管理流程

先为现有三个 native driver 建静态版本化描述，不先引入动态加载：
`id/revision/platforms/roles/businessProtocols/carrierProtocols/schemaId`、
`requiredCapabilities/privileges/limits/prepare/drain/probe/usageSupport`。
声明、Agent 实测能力、当前策略分别保存；“支持”不代表“已授权/端口空闲/当前可部署”。

Console 和预检消费同一公开能力视图，后端独立校验。提供：
规则创建/编辑/复制、明确冲突原因、操作阶段、按节点/协议/状态检索。
批量启停首先返回逐项 Operation 和失败结果，不声称跨规则原子事务。
模板/批量请求不绕过幂等、CAS、限额和每条规则的资源预留。

当前 Direct 禁止 Transport Profile；不能为选择引擎偷偷放宽 Core parser。
未来可选 Direct driver 的版本锁定和执行选择由独立 ADR 设计，
在 Application/Runtime 中表达并纳入配置摘要，不塞入自由格式 Core JSON。

### A2. 后续引擎的准入

优先级建议为原生稳定化 → 按需评估 Linux nftables → 再按实测缺口评估
GOST/Realm；iptables、socat、Nginx 不在首轮同时引入。
候选不是已承诺支持；外部组件需单独锁定版本、来源、许可证、校验值及 SBOM。

新引擎必须证明：有界资源、独占所有权、准备/激活/排空、统计来源、
失败清理、Agent 崩溃和失联后仍按授权截止停止。
特别是内核 NAT 规则不会随 Agent 退出自动消失；
未实现并实测独立到期保障前，不允许作为受控驱动上线。
额外 root/capability 需求隔离到专用适配器，不抬高全部 native Agent 的权限。
外部程序使用固定 executable/参数和受限配置，不接受 shell 模板或任意命令。

## 5. 主线 B：加密隧道

### B1. 先把原生 TLS 隧道做成可管理产品

完善 Profile revision、Endpoint、证书状态、相邻节点与路径预览、
失败阶段和引用规则查询。显示“业务 TCP/UDP”与“隧道承载”两套能力。
Profile 为不可变修订；发布新修订不自动替换所有规则，提供影响预览、
逐条授权校验和显式批次发布。

本阶段“复用”指配置与路径模板复用，不宣称多个 Forward 已共享物理隧道。
物理 Link/连接池另立 ADR，明确引用计数、每 Forward 授权截止、
相同 Scope/身份/安全上下文约束、最后引用退出与崩溃回收。
删除一个 Forward 不能断开其他 Forward，也不能因共享连接让已撤权业务继续转发。

### B2. 增量承载路线

第一候选是独立 userspace WireGuard 承载，目的是补充 UDP 外层选择，
不是兼容 FXP，也不是开放任意系统路由或完整 VPN。
先做双节点受限试验；通过密钥/peer 生命周期、AllowedIPs、MTU、
NAT/keepalive、资源占用、重连和硬截止验收后，再决定是否进入正式驱动。
复用库须独立评审；不自行重新实现密码协议。

GOST 仅按已证明满足租约与认证契约的安全模式逐项接入，不暴露所有模式开关。
QUIC、逐跳混合承载、UDP 混淆、透明代理延后；现有多跳仍使用一致 native 契约。
这些候选不阻塞已有 TLS 功能发布，但也不能绕过新驱动自己的发布门禁。

## 6. 主线 C：拓扑与切换

### C1. 保存路径、预览与手动切换

新增应用层 `PathTemplate` 及不可变 revision：有序 Node、Endpoint/Profile 引用、
能力要求、摘要；规则绑定明确的模板 revision，同时保存展开后的实际 ForwardSpec。
模板修改不隐式改变正在运行的规则；提供引用列表、影响分析和逐条发布。
模板复用不是物理端口共享；每条规则依旧独立获得运行资源。

预览不预留资源、不授予执行权；提交时重新检查全部节点/目标/授权、
版本和端口。手动切换先沿用现有 Forward replace + expectedRevision：
新路径作为新 revision 进入同一个 Runtime，不建立另一套部署通道。

切换保留可用旧实例直至有界排空或授权截止，不能延长已撤销授权。
相同入口物理监听无法并行预备时允许明确的中断窗口，预览/结果中如实报告；
不将 tail-to-head 协调宣传为跨主机原子切换或零停机。
TCP 老连接按 drain 边界处理，UDP 允许重建关联并记录丢包，不承诺会话无损迁移。
失败补偿须复核旧路径仍获授权；回切也创建新 revision/generation/fence，
不能直接重放历史 Snapshot。

### C2. 组与备用路径

先交付出口候选组和固定优先级备用路径，每次解析成单一具体路径。
入口组首版是受控批量部署到多个入口，每入口仍是独立 Forward/Operation；
不自动提供公网 VIP、DNS 切流或全局入口高可用。
组修改与路径一样采用修订、预览和显式应用，限制成员数和展开规则数。

跨多条规则的组切换是有审计的 saga：逐项成功/失败、可取消和有条件补偿，
不是一个全局原子 Operation。不要生成无限组合路径或让候选组导致端口爆炸。

### C3. 最后交付自动故障转移

前置条件：C1/C2 及独立 Probe/持久历史已完成验收。
首版只做“明确故障 → 授权内的固定备用路径”，不做延迟竞价、动态最短路或负载均衡。
策略保存优先路径，与当前实际展开路径分离；支持关闭、人工固定、维护期和预演。

状态机：`observing → suspect → switch-pending → switching → cooldown`；
故障连续次数、最小样本、新鲜度、恢复窗口、冷却期、切换预算均显式配置。
试验默认值可从 30 秒探测、连续 3 次有效失败、120 秒冷却开始，
这些只是待验收参数，不是可用性 SLO。缺测/stale 本身不算目标故障；
节点失联作为单独证据判断，不把失联推导为所有下游目标都坏了。

每次切换由受限自动化身份执行，必须有明确授权；原用户撤权不能被服务身份绕过。
提案带策略 revision、观测水位和 expected Forward revision；
最终接受时重新查 Membership、Node/Profile Grant、目标策略和资源，
不改变用户意图的自动切换保留 Forward revision，由 Routing 提供 `ResolvedPath`，
经 Runtime 的版本化接受端口创建持久 Operation 并推进 deploymentGeneration；
该接入端口尚未实现，须先按原规范评审 ADR，不能直接套用现有 Forward replace。
用户手动修改固定路径仍走 Forwarding CAS，生成新的 Forward revision。
人工编辑使旧提案失效；同一 Forward 同时仅允许一个有效切换提案。
首版不自动抢回首选路径，恢复后通知并由操作者确认，降低反复抖动。

## 7. 主线 D：监控与探测

### D1. Probe 先于自动路由

新增应用层 `ProbePlan/ProbeRun/ProbeResult`，区分三类观察：

| 种类 | 能证明什么 | 不证明什么 |
| --- | --- | --- |
| 节点/相邻端点检查 | 指定观测点到指定地址端口的连接或握手 | 完整业务路径、外部客户端可达 |
| 规则 TCP connect / TLS 握手 | 指定入口的连接及选定握手成功 | UDP、任意应用响应正确 |
| 受控 TCP/UDP nonce echo | 指定观测点经实际规则到受控 responder 的对应 payload | 未测试应用协议、所有公网来源都可用 |

UDP 没有明确 responder/协议插件时显示 unknown/unsupported；
只调用 send 不记为成功。不向任意业务服务注入未知探测 payload。
首版由明确的 Agent 观测点发起；独立外部观测点后续另行部署，
不能把同主机自测当作公网入口验收。

结果绑定 Scope、观测点、Probe/Run ID、拓扑摘要、业务协议、
Forward revision、deployment/assignment/generation/fence、session/boot 和时间。
拓扑、目标、凭据绑定或执行实例变化后，旧结果不进入新实例当前健康聚合。
手动测试新建 runId 并等待本次结果，不拿历史成功冒充此次通过；
只读查询绝不发起网络测试。

Probe 是独立、限时、限次数的探测授权，不续期 Forward、不启动业务 Runner。
计划发布和执行前复核目标 CIDR、DNS 解析结果、metadata 拒绝策略、
端口与有效授权；处理 DNS 重绑定、扫描滥用、并发/字节/超时限制。
撤权停止排程并约束在途任务。Probe 无权放宽既有目标策略。

健康建议用 `unknown/healthy/degraded/unhealthy/stale/unsupported`，
同时显示 probeType、source、样本数和最后成功/失败时间。
组健康按 AND 必经段、OR 可选分支表达；只剩备用分支成功可为 degraded，
不能把所有替代分支都当作串行必经节点。

### D2. 指标、计数与历史

先收集 Agent 进程资源、主机基础资源和原生 Forward 吞吐/连接计数，
明确来源；主机网卡字节与规则 payload 不是同一口径。
规则首版统一在入口统计客户端收发 payload；TCP/UDP 分开，
不将多跳每个节点相加，不将加密/IP 头开销冒充业务用量。

上报使用累计计数及 `epoch/sequence`，服务端去重、识别重置和乱序；
新 epoch 建基线，缺失尾部计数保留误差，首版只是运维指标，不用于结算。
探测尝试数和成功数独立累计；失败率由有效计数计算，
不能用图表点数、仅异常样本或延迟点推算。TCP 失败率不命名为网络丢包率。

初始存储使用独立 MySQL 读模型：建议原始点 24 小时、
分钟聚合 7 天、小时聚合 30 天；均为待容量验收的默认值。
聚合保留 count/sum/min/max/成功失败数及覆盖区间；
没有直方图或足够原始值时不展示伪造的 p95。
UTC 存储、界面明确时区；清理分批、查询限制时间窗与点数。
限制标签基数、每 Scope/Node 的计划数、队列与磁盘额度；
监控拥塞时允许有标记地丢弃/降采样，不能阻塞授权续期和转发控制。

### D3. 诊断与基础告警

详情按“意图 → 部署 → 节点 → 物理监听 → 邻接段 → 最终目标 → Probe”下钻，
提供对应 Operation、失败码、时间与脱敏支持包。
先做站内事件及受控 webhook；投递独立队列，支持去重、恢复通知、静默期、
限速/重试上限。Webhook 目标同样防 SSRF 和私网滥用，凭据不进入日志/支持包。
邮件、Telegram 等具体渠道后置，不把通知发送失败当转发部署失败。

## 8. 代码落点与数据演进

以下新增名均为建议，待 ADR/API 评审后定名，不代表现有实现：

| 落点 | 责任 |
| --- | --- |
| `packages/core/src` | 保持现有纯领域与严格 parser；必要变更独立版本化 |
| `packages/contracts`、`docs/protocol` | driver descriptor、Probe/telemetry schema、双语言 fixtures 与拒绝旧版规则 |
| `apps/control/src/modules/transport.ts` | 不可变 Profile、能力解析、新驱动要求 |
| `apps/control/src/modules/topology/`（新） | 路径模板、组、绑定、影响预览与显式批次 |
| `apps/control/src/modules/routing/`（新） | 策略、候选、提案、冷却、人工固定与自动化身份 |
| `apps/control/src/modules/observability/`（新） | 探测调度、历史与指标读模型、告警规则 |
| `apps/control/src/modules/runtime/` | 复用现有部署台账/编译器/协调器，保持唯一执行入口 |
| `agent/internal/forward`、`relay`、`control` | 原生引擎能力、计数接线；保持租约与共享 Journal |
| `agent/internal/probe/`、`telemetry/`（新） | 有界执行/采样/去重，不引入任意 shell |
| `apps/web` | 沿用现有前端；按主线增加表单、拓扑与历史，不以换框架作为前置条件 |
| `scripts/phase2`、`.github/workflows` | 真实流量、网络隔离、浏览器、驱动与证据门禁 |

候选表按所有者分组：拓扑模板/修订/绑定；路由策略/提案/切换审计；
Probe 计划/执行/结果；指标原始点/聚合；告警事件/投递。
它们不取代现有 Forward/Operation/Assignment/Reservation 表。
策略/绑定变更使用 CAS 与幂等；敏感变更纳入审计与备份清单。
删除规则停止新 Probe，但在保留期内仍可查询已脱敏的历史事件。

## 9. 交付顺序与退出条件

| 批次 | 交付范围 | 依赖与退出条件 |
| --- | --- | --- |
| P0 | 收口既有基线：审计/支持包、证据身份、真实浏览器与部署恢复缺口 | 复用当前队列；先标清 exact-SHA 证据和未通过门槛，不重做已完成切片 |
| P1 | A1 + B1：原生能力、规则与隧道管理 | native Direct/Relay/默认关闭多跳同一能力视图；权限/配置/错误和 UI→真实流量验收 |
| P2 | C1：路径模板、引用预览、手动切换 | 模板锁版、不隐式联动；CAS、端口冲突、旧连接 drain、失败补偿与撤权测试 |
| P3 | D1 + D2：独立 Probe、基础指标、历史 | 乱序/重放/缺测/UDP unknown/SSRF/上限验收；观测不扰动已有业务 |
| P4 | C2 + D3：组/备用路径、诊断和基础告警 | 分支聚合、批次部分失败、候选授权、告警去重/恢复与规模约束 |
| P5 | C3：固定优先级自动故障转移 | 故障窗口/冷却/并发人工修改/Control 重启/服务身份撤权；不触发重复切换 |
| P6 | B2/A2：新承载与驱动，逐个独立试验 | 先 WireGuard 候选，后按需求评估 NAT/GOST；独立 ADR 与租约/崩溃/资源/供应链门禁 |

顺序表示依赖与默认优先级，不承诺工期。P6 的离线设计可提前，
但不让未验收驱动进入 P5 自动路由候选。每批拆为小的纵向 PR：
契约/领域决策 → Control/Agent → Console → Actions 证据；不能只做 UI 就标记完成。
当前 [近期队列](next-milestones.md) 负责 P0 收口；
后续按上述主线增加切片，冻结验收以实际纳入该版本的功能为界。
不因增加长期主线而无限推迟已有 native 版本，也不为赶发布跳过相应门禁。

## 10. 统一 Actions 验收与发布边界

功能、数据库、网络、容器和浏览器测试全部在 GitHub Actions；
本地仅做文档链接、语法、类型等静态检查。
保留现有 contracts、MySQL、Go vet/race、Direct/Relay、
3/4/8 节点及网络隔离矩阵，新增切片必须防止这些基线回退。

新增门槛包括：

1. 契约：未知字段、旧 Agent、伪造 capability、错误 digest、超大输入拒绝。
2. 授权：跨 Scope、Owner 无隐式 Node Grant、Profile 撤权、目标重绑定、
   自动化身份撤销与后台任务再检查。
3. 数据面：真实 TCP payload、受控 UDP echo，路径/目标更换时标识不可串线；
   失联、重启、到期、资源冲突与历史 lease 不误续期。
4. 探测与统计：旧拓扑/会话结果、重复/乱序/重置、缺测不变 0、
   分支聚合、长窗口清理、取消与限速；不用固定 sleep 代替可判定状态。
5. 切换：不重复执行、人工 CAS 获胜、冷却/抑制、失败补偿重新授权、
   TCP 排空边界与 UDP 损失记录。
6. UI：真实 HTTPS 浏览器，经实际 API/MySQL/Agent 完成操作；
   已有模型/轻 DOM 测试继续保留但不冒充端到端。
7. 交付：exact commit、dirty 状态、Agent/Control 身份、镜像 Digest、
   拓扑/观测点、命令、数据包结果、清理结果与失败项进入证据包。

物理多主机、真实公网/NAT、长期稳定性和容量门槛独立列项；
无对应环境时保留 missing，不以托管 CI 同宿主机通过替代。
多跳和新驱动继续显式 opt-in；自动故障转移单独默认关闭，
已有部署授权即使在该开关关闭后也须正常收敛和清理。
每次源码变更只更新受影响状态，正式发布依据冻结 SHA 的完整矩阵，
不拼接不同版本报告，也不将计划、代码合并或 Dev 镜像发布写成生产就绪。

## 11. 开发前的决策清单

- 能力描述与执行驱动选择的 ADR：保持 Direct Core 契约，不混淆能力和授权。
- 路径模板、锁版绑定、组与自动化身份的 ADR：状态所有者、CAS 和删除/撤权语义。
- Probe/telemetry 协议 ADR：独立端点或协商扩展、授权期限、配额、旧版拒绝和脱敏。
- 指标字节/时间/epoch/缺测口径：先固定计量语义再开发图表，不用于计费。
- 切换状态机 ADR：非原子边界、排空/中断、补偿前提、人工优先和默认关闭。
- 新驱动逐项 ADR：物理资源、密钥、异常退出时的硬截止保障和禁用后的状态兼容。

本方案初次排队建议是只读审计与脱敏支持包，再进入 P1 的原生能力描述与
表单/诊断统一。用户后续确认先做架构收口，当前优先按
[ADR-0006](../decisions/0006-classified-extension-contracts.md)
适配已有 native：Agent 内部静态注册与生命周期分派、Console 授权查询与
MySQL 只读投影、Transport 锁版解析端口，以及 Profile、成员、Node Grant
授权写用例与 Runtime 撤权/恢复效果端口、整节点策略/凭据吊销接入，
以及 Forward 创建/更新/删除/重试命令与原生准备端口、静态快照来源接入已编写；
观察类首个被动来源也已接入有界宿主与 API，带独立授权、期限、取消及来源/时效，
明确不是主动健康探测，见 [Node observation v1](../spec/node-observation-v1.md)；
主动 Probe 基础随后按 [ADR-0007](../decisions/0007-bounded-agent-probe.md) 编写：
Control 只读预检与 Agent 独立许可下的受限 TCP 执行器已有实现，见 [Probe v1](../spec/forward-probe-v1.md)。
随后按 [ADR-0008](../decisions/0008-probe-contract-negotiation.md) 编写独立只读 mTLS 协商
与内部单次许可门禁，不扩充现有 ADP 消息；随后按
[ADR-0009](../decisions/0009-probe-instance-ownership.md) 编写内部持久实例归属、
CAS/不续期重试/撤销和恢复隔离，并同步迁移与 Control 兼容矩阵。
随后按 [ADR-0010](../decisions/0010-probe-registration-lifecycle.md) 编写独立远程登记协议与
默认关闭的 Agent 门禁生命周期，支持轮换前关闭、当前代数 CAS、保守单调截止及停机清理；
既有只读握手不改，全部响应仍不可执行，功能验收待 Actions。
随后按 [ADR-0011](../decisions/0011-probe-permit-authority.md) 编写内部许可权威、持久单次消费及
同库 Actor/Node/集群签发预算；锁定当前授权/绑定/实例，新增迁移 0015、兼容与恢复隔离。
随后按 [ADR-0012](../decisions/0012-probe-claim-contract.md) 接入已知 ID 的独立 mTLS 单次领取协议，
共享 TS/Go 严格解析、55 份向量和 Agent 完整绑定/时限校验钩子；回执仍不可执行，
没有生产 Agent 调用、远程签发/任务投递、持续执行撤权或派发/结果闭环。
随后按 [ADR-0013](../decisions/0013-probe-delivery-authority.md) 增加内部有界任务选择、消费后当前授权检查
及独立持久撤销，保留单次消费事实与预算；迁移 0016、兼容边界、旧 consumed 回填及恢复规则已编写。
随后按 [ADR-0014](../decisions/0014-probe-delivery-contract.md) 编写独立 mTLS poll/status、TS/Go 严格解析与
184 份共享向量；只调用原 offer/check，保持空/单任务、当前授权、原截止和不可执行回执。
没有 Agent 自动请求或持续执行监视器，服务端观察年龄上界不等于持续租约；下一步接失败关闭的宿主监视器与结果协议。
随后按 [ADR-0015](../decisions/0015-probe-agent-authority-watch.md) 编写内部有界 poll 与消费后观察监视器，
固定原回执/完整绑定与不续期截止，200 ms 请求、250 ms 失鲜、串行有限次检查及取消后持槽到退出；
生产主循环仍不调用，不构造执行许可，合作式检查与取消不冒充物理撤权保证。下一步接结果与单次执行。
随后按 [ADR-0016](../decisions/0016-probe-result-receipts.md) 编写独立 mTLS 结果协议和原许可 owner 接收，
单份有界记录、JCS 内容去重、完整原始授权/绑定/时限重查，结果只标记 agent-reported，不更新健康。
迁移 0017 与 Control-only 兼容/恢复边界已同步；尚无 Agent 上报调用、单次执行准入或生产流程。
随后按 [ADR-0017](../decisions/0017-probe-host-execution.md) 编写内部单次宿主准入与结果序列化，
原回执监视器与原实例 Gate 共同约束执行，保留失败消耗、取消后持槽和严格零应用数据；
上报句柄保持当前授权检查，采用服务端时间/本地单调锚点保守映射结果，不改既有 Schema、Core 或 Journal。
新增 9 组 Go 回归接入 Actions/race；仍无生产调用、结果回传 HTTP 或远程签发/调度，下一批单独连接默认关闭的流程。
随后按 [ADR-0018](../decisions/0018-probe-production-workflow.md) 编写默认关闭的管理签发/查询/撤销与 Agent 串行获取、
领取、持续检查、单次零应用数据连接及保守结果回传；幂等接受与许可同事务，实例从当前锁定事实选择。
保留原权威、全部预算、两秒许可和不确定结果不重试；需要明确的一秒集群时钟策略和 Agent 双重 opt-in。
管理回执只作短期 agent-reported 历史，不更新健康；新独立组合 Actions 使用真实 Agent/Control/MySQL/mTLS 与 TCP 目标，
目前仅编写/接线，未取得对应提交通过。后续已补一次性 Probe Console、同键重放、已知 ID 查询/有界等待/撤销，
以及同一真实 HTTPS Chromium/Agent/Control/MySQL 夹具的桌面/390px 接线；历史结果不更新健康。
随后按 [ADR-0019](../decisions/0019-native-catalog-and-profile-impact.md) 编写共享 native 声明目录、
Agent 注册表一致性回归、Scope 授权能力视图，以及 SELECT-only Profile 引用/锁版配置影响与原编辑器接线。
影响预览不做 Node/端口授权或发布，仍需原计划检查与 CAS。原生目录与无引用 Profile 发布/预览也已接真实浏览器夹具，
引用规则编辑仍需独立浏览器证据。以上均待对应提交 Actions；持久历史、其他 API 读写与遥测仍待后续切片，
不扩展 Core 或新增驱动。
随后按 [ADR-0020](../decisions/0020-explicit-native-rule-commands.md) 编写原编辑器配置复制、最新失败 Operation 显式重试和
当前页最多十条串行启停；固定原配置/revision/幂等键，逐条结果，不确定提交停止并需手动同键重放。
新增队列/复制/HTTP 回归及真实 Direct Chromium→Control→Agent→TCP、并发 CAS 部分失败、已提交响应丢失与注入失败重试接线。
没有 durable Batch、跨规则事务或自动回滚；本机仅静态检查，Relay/多跳复制浏览器和其余隧道管理继续待补。
随后按 [ADR-0021](../decisions/0021-native-tunnel-read-model.md) 编写原生 TLS 隧道同事务授权/SELECT-only 只读元数据，
有界 Peer 窗口、Endpoint、规则相邻引用分页、Console 原部署入口与精确 Profile 修订查看。
元数据不签发凭据、不验证网络/证书，不证明健康或历史资源可回收；没有新 Core/迁移/机器协议/Journal。
真实 Relay 浏览器接线补引用 Profile 影响→原编辑器→重新预检/CAS，以及停用复制/另选端口/显式启删/实际 TCP+UDP。
所有新增回归仍只编写/接线，本机仅静态检查；对应提交 Actions、显式多规则 Profile 批次发布、
多跳复制浏览器和长期轮换未完成，不能据此关闭 B1/P1 或宣称已实现物理隧道复用。
随后按 [ADR-0022](../decisions/0022-explicit-profile-batches.md) 编写最多十条当前影响页的显式 Profile 发布：
固定目标 revision/digest 与每条完整配置/CAS/独立键，只有锁版变化；确认后逐条原预检与原 PUT，保留部分失败。
未写入的预检不确定需显式重查；可能已提交的更新不确定仅同键重放，不用新预检/新键替换，拒绝重放也不清除原结果不确定性。
新增队列/选择回归及真实双 Relay 引用 CAS 竞态、已提交响应丢失和原键重放/TCP+UDP 接线；均未执行，仍无本批 exact-SHA Actions。
这补上 B1 的显式批次实现入口，不是 B1/P1 验收通过，也不关闭多跳浏览器、长期轮换或后续路径模板/切换和遥测范围。
此调整不取消审计与产品验收缺口；首批实现等待对应提交的 Actions，
不自动发布或启用新能力。
