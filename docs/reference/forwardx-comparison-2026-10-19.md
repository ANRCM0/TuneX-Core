# ForwardX 参考源码研究与 TuneX 对比

研究日期：2026-10-19（Asia/Shanghai）。状态：**源码研究完成；优化候选未实施；两项目运行行为均未在本轮验证**。

本报告的结论是：ForwardX 最值得吸收的是完整的管理工作流、可解释的运行状态、
拓扑与指标身份管理，以及处理日常失败的细节。TuneX 应利用已有公开契约把这些
体验串起来，同时保留自己的 Runtime、授权租约、Journal 和事务所有权。
功能菜单数量、源码文件存在、测试文件存在都不能替代同一源码修订的运行证据。

## 1. 参考副本与证据范围

| 项目 | 本轮实际状态 |
| --- | --- |
| 来源 | `https://github.com/poouo/Forwardx.git` |
| 本地目录 | `Forwardx/`，独立 Git 仓库；已由 TuneX `.gitignore` 排除 |
| 更新方式 | 更新前参考副本干净；fetch 后仅 fast-forward，未重置、改写或提交参考源码 |
| 原参考修订 | `11487874b133cdb7ad54a0f9071601092f5d9060`，原计划记录的 v2.3.284 基线 |
| 本轮参考修订 | `8a3e70ccd62fbfee301f3b919120d51e9892de28`，本轮 fetch 得到的 `origin/main` |
| 参考修订时间 | 2026-10-17 16:36:17 +08:00；相对原参考修订新增 4 个提交 |
| 包版本与发行区别 | `package.json` 为 `2.3.285`；当前 main 已包含该版本提交之后的数据库健康检查界面修复，不能将 main 等同于某个发行附件 |
| TuneX 比较对象 | HEAD `8f35889e13b09a19d215dc10bc6855a3ca98b366` 加 2026-10-19 已有 dirty 工作树；该 HEAD 单独不能标识本报告阅读的全部增量 |
| 获取与执行 | 已获取参考源码；未安装依赖、运行项目、执行上游脚本、测试、检查、构建或 CI；未操作数据库、转发链路或生产配置 |

比较以实际源码和相关测试断言为主，用户指南用于确认产品语义。阅读测试只说明
存在对应设计意图，不说明测试当前通过。没有做性能测量、安全审计或两个系统的
实网对照实验，因此本报告不作吞吐、稳定性、安全强弱或生产可用性的排名。

参考包标注 `AGPL-3.0-only`。沿用既有
[参考边界](../development/forwardx-gap-closure.md) 与
[历史来源记录](../../legal/NOTICE.md)：借鉴产品思路、失败场景与契约设计，
该研究当时采用独立编写、未复制源码的范围。后续 2026-10-19 用户已明确允许适用成熟代码的参考、改写和复用；实际来源/修订/适配/版权许可按 [复用映射](../development/reference-code-reuse-map.md) 记录。本报告原研究本身没有引入上游源码。
`Forwardx/` 不进入 TuneX 的编译、导入、运行时或部署依赖。

后续引用本报告时应同时记录上述参考 SHA。参考目录将来更新后，文件链接可能
指向新内容；本报告不自动对新修订生效，也不把新的上游标签自动选为兼容目标。

## 2. 总体对比

| 维度 | ForwardX 的实际参考点 | TuneX 当前源码情况 | 对后续工作的意义 |
| --- | --- | --- | --- |
| 产品组织 | 转发资源、规则、隧道、链、入口组和出口组形成管理流程 | Forward-first；已有逻辑隧道、路径模板/组/发布和入口批次 | 借鉴统一入口和关系展示，不增加一个平行 Runtime 或必选 Core 对象 |
| 代码组织 | React 客户端、Express/tRPC 路由、服务/仓储、Go Agent 和 FXP runtime | L0 Core/kernel、L1 framework、L2 adapter、L3 owner 正在收口 | 保留明确分层；按 owner 的完整调用链评估收口，不能只数新端口与导出 |
| 状态反馈 | 期望/运行规则数、部分运行、逐节点同步错误和重试时间 | 已有 Operation、分层诊断、Node evidence、Listener/Probe 与支持包源码 | 优先复用既有读取契约，形成一致的用户状态；不要重建诊断后台 |
| 能力预检 | 工具发现、时效和缺失原因进入多入口预检 | 已有 NativeDrivers catalog、执行 descriptor、Node capability 和 feature gates | 补齐“为何不可选”的解释；声明、实际节点证据和授权必须分别判断 |
| 通信负载 | presence、稳定心跳计划、事件合并、SSE 背压 | 已有独立执行/观察通道、周期工作生命周期和 telemetry admission | 可研究减少重复工作；不能让通知或轻量 presence 变成执行权威 |
| 指标可信度 | 累计探测计数、epoch/拓扑身份、历史窗口、缺测解释 | 四族 telemetry、精确计数、provenance、分钟/小时 rollup、loss/coverage 已有源码 | 后续重点是语义一致、图表和验收，不是再建一个指标数据库 |
| 多节点资源 | 一个逻辑规则映射多节点子规则，部分失败可见 | 入口批次、持久发布结果、CAS、条件补偿已存在 | 借鉴汇总/下钻体验；保留每项独立结果与原事务边界，不宣称全局原子 |
| 切换与健康 | 故障/恢复窗口、健康过期重评估、异步过时结果防护 | 路径/入口管理源码与执行租约存在，自动选路尚不能据此宣布完成 | 先做固定拓扑、显式计划与人工切换闭环；自动策略另外立项 |
| 运维 | 安装/管理命令、故障页、日志、升级进度、备份说明 | 已有只读升级评估、显式恢复、维护门槛和保护历史 | 补齐操作导航和状态说明；保留原安全 owners，不导入上游 root 脚本 |
| 工程证据 | 细分场景测试、CI 中真实 Linux network namespace 用例 | 既有 Actions 矩阵与新增地基 47 组集中验收计划 | 吸收场景粒度与失败断言；当前冻结源码仍需自己的验收证据 |

以上 TuneX 条目均为“当前有对应源码/声明”，不是本轮确认可运行或已发布。
地基状态继续以 [readiness](../development/foundation-readiness.md) 为准。

## 3. 架构上的取舍

ForwardX 的 `server/index.ts` 显式组合 Web、Agent、数据库和后台服务，入口容易定位。
它还抽出了若干很聚焦的对象，例如事件流、心跳 admission、按 key 调度、运行状态
汇总和探测计数 gate。这些对象的职责、输入和失败测试，比一个庞大的通用框架更
适合作为行为设计参考。

但目录名不能证明依赖方向。例如 `server/repositories/forwardGroupRepository.ts`
同时依赖 Agent 刷新、DDNS、其他资源仓储、计量和健康重评估。它承担的事情超出
纯 SQL 访问。TuneX 不应把这种组织方式当作 L2 写另一个 owner 的表或调用业务
服务的许可，而应将决策留在 L3、公共协调机制留在 L1、外部适配留在 L2。

ForwardX 的 `dbRuntime.ts` 适配 SQLite、MySQL 和 PostgreSQL，但这是其产品选择，
不是 TuneX 应当立即增加三个数据库的理由。当前 TuneX 的 MySQL 事务、锁、唯一
Runtime ledger 和恢复约定需要先收口。可以学习“外部差异集中”的方法，不把可移植
数据库数量作为地基质量指标。

对 TuneX 现阶段最直接的优化是：按 Probe、Path/Ingress、Agent 执行等 owner 逐条
追踪“公共 API → 规则/协调 → 端口 → adapter → 原 owner 写入/读取”，确认这一条
闭环真的关闭了混合依赖，再记录下一片完成。替换一个 parser import 有实际价值，
但不等于整个 owner 的存储、调用和平台依赖都已关闭。

## 4. 可以吸收的具体做法

### 4.1 用完整性计数解释运行状态

证据：[运行汇总](../../Forwardx/server/forwardGroupRuntimeStatus.ts)、
[入口节点投影](../../Forwardx/server/portEntryRuntime.ts)、
[诊断 DTO](../../Forwardx/shared/portEntryDiagnostics.ts)、
[节点详情组件](../../Forwardx/client/src/components/PortEntryRuntimeSummary.tsx)。

上游不是看到一条 running 子规则就把整个资源染绿，而是对期望身份去重后计算
已运行数量，区分空闲、等待、部分运行、停用和离线。节点详情还区分配置同步失败
与 Agent 执行失败，显示失败时间、连续失败次数和最早可重试时间；界面明确限制
“运行”不等于端到端业务健康。

TuneX 已有 [诊断公开契约](../../apps/control/src/application/forward-diagnostic-api.ts)、
[原诊断 owner](../../apps/control/src/application/forward-diagnostics.ts) 和
[诊断页面](../../apps/web/forward-diagnostics.js)。应以这些字段为基础统一列表、详情
和批次视图，并为旧证据、缺失报告、部分成功、历史 Operation 和 pending cleanup
提供稳定说明。`202`、Operation 成功、监听 ready 和独立 Probe 结果继续分开。
不要只为复制上游的两个计数字段，绕开 TuneX 已有 session/generation/fence 身份。

### 4.2 预检要回答“为什么不能选”

证据：[工具发现缓存](../../Forwardx/server/agentToolInventory.ts)、
[资源预检](../../Forwardx/server/portForwardToolPreflight.ts)、
[Agent 发现实现](../../Forwardx/agent/tool_inventory.go)。

上游发现结果有明确时间，过期或未上报时返回 unknown；缺失工具可以提前解释，
而不是一概等到部署失败。多入口选择还需要逐节点判断，不能只检查其中一台。

TuneX 已有 [NativeDrivers](../../apps/control/src/application/native-drivers.ts) 和
[执行宿主描述](../../agent/internal/executionhost/driver.go)。后续先用已有 catalog、
Node facts、当前 capability、平台、协议、角色与 flag 组合给出不可选原因。
声明支持不等于该节点当前可执行，更不等于已经获得 Scope、目标、端口和租约授权。
若以后增加工具发现上报，必须具备身份、时效、大小和版本限制；它只提供发现信息。
新增 wire/frozen public contract 应走对应变更流程，不由研究任务直接扩展。

### 4.3 事件用于唤醒，队列与背压必须分别定义

证据：[Agent 事件流](../../Forwardx/server/agentEvents.ts)、
[心跳 gate](../../Forwardx/server/agentHeartbeatGate.ts)、
[按 key 调度](../../Forwardx/server/keyedTaskDispatcher.ts)、
[不重叠定时任务](../../Forwardx/server/scheduledTask.ts)。

事件流实现了刷新合并、慢连接排空、帧数/字节上限和 drain 超时，心跳工作有同节点
互斥与全局活跃上限。它们针对的是重复规划、慢消费者和峰值负载，而不是业务授权。
`KeyedTaskDispatcher` 串行同 key 且限制活跃任务，但其等待队列没有独立容量上限；
“并发受限”不能写成“总内存有界”或“可直接支持多副本”。

TuneX 已有 [BackgroundTasks](../../apps/control/src/framework/background-tasks.ts)
的不重叠执行、退避与 drain，以及
[独立 telemetry 数据库](../../apps/control/src/infrastructure/mysql-telemetry.ts) 的
两活跃槽、非排队 admission 和 deadline。应先验证已有设计，再根据负载证据决定
是否增加事件唤醒。未来若采用，需要分别定义待处理 key 数、字节数、活跃数、过期、
取消、合并、关闭和溢出行为；保留周期对账，事件丢失不能阻止撤销或放宽执行期限。

### 4.4 在线、健康与执行期限各自保留语义

证据：[快速活性追踪](../../Forwardx/server/agentFastLiveness.ts) 与
[健康窗口/过期重评估](../../Forwardx/server/forwardGroupHealthRecheck.ts)。

上游活性追踪包含启动宽限、transition epoch 和异步消费者的 current 检查，避免
较旧的离线处理覆盖后来活动；健康数据也会因过期变成 stale。可学习的是在多个
异步结果竞争时显式判断“本次结果是否还属于当前状态”。

不能把这些展示宽限直接移入 TuneX Guard 或续长租约。Node 最近活动、凭据有效、
当前 session、执行租约和 Probe 结果是不同事实。新鲜 presence 可以更新展示，
不能替代受保护授权证据；任何异步告警/投影也不能越过原 owner 改 Runtime 状态。

### 4.5 用累计计数统计，用采样点画图

证据：[探测计数 gate](../../Forwardx/server/agentProbeCounterReportGate.ts)、
[计数仓储](../../Forwardx/server/repositories/probeCounterRepository.ts)、
[拓扑身份](../../Forwardx/server/probeTopology.ts)。

上游将健康变化采样与累计探测计数分开；身份包括资源、节点、目标、拓扑、方法和
epoch。计数写入去重，窗口统计使用可观察基线，不把首次看见之前的生命周期总数
全算进窗口。[接收路由](../../Forwardx/server/agentReportRoutes.ts) 的实际调用顺序是
先生成 counter plan，await 写入计数快照，再 commit 内存 gate；因此数据库调用
抛错时不会执行后面的 gate commit。这个顺序值得借鉴，但不证明多批次 SQL 全局
原子或崩溃恢复已经通过；相应失败路径仍需独立验收。

TuneX 的 [telemetry API](../../apps/control/src/application/telemetry-api.ts)、
[限额与窗口](../../apps/control/src/modules/telemetry-policy.ts) 已表达 baseline、
continuous、gap、counter-reset、historical、unknown、loss 和来源。应继续使用现有
精确计数与同事务 raw/rollup 更新，不改成以图表点数作为分母，也不因上游采用
JavaScript number 而改变 TuneX 的 uint64 表示。

可优化的是图例、可观察起点、断档、epoch 重置、覆盖范围和拒绝/丢弃数量的可读性。
TCP 连接失败率、网络丢包、业务错误率、主机网卡流量与业务 payload 必须分别命名。

### 4.6 拓扑变化后隔离旧探测

证据：[拓扑 key](../../Forwardx/server/probeTopology.ts)、
[多跳观测聚合](../../Forwardx/server/forwardGroupAutoLatencyState.ts)、
[历史查询窗口](../../Forwardx/server/latencyHistoryWindow.ts)、
[指标说明](../../Forwardx/docs/guide/traffic-latency.md)。

上游对拓扑排序后生成身份，聚合要求同 generation/hopCount 和时效；新的路径不应
混入旧目标或旧分支结果。其指南也区分并行备选分支与串行必经节点，并说明分段
耗时不等于真实客户端的完整握手耗时。这些都是很有价值的产品解释。

TuneX 已有绑定 revision/digest、Snapshot、session、generation、fence 和实例信息。
应复用它们做图表/诊断关联，而不是再添加一个可以替代授权的 topology hash。
Scope 变更、恢复隔离、凭据轮换、实例重建、目标/路径改变后，旧数据应继续作为
带来源的历史显示；不能自动刷新为当前成功。GET 图表或拓扑不能暗中发起网络探测。

### 4.7 组、批次和切换要暴露部分结果

证据：[多入口说明](../../Forwardx/docs/guide/port-entry-groups.en.md)、
[入口运行投影](../../Forwardx/server/portEntryRuntime.ts)、
[故障切换场景](../../Forwardx/server/forwardGroupFailover.test.ts)。

一个逻辑规则映射多入口时，用户需要知道哪台应用、哪台失败、哪台尚未处理。
上游把这些差异暴露出来，而不是把所有入口折成一个布尔值。这里还需区分
“多个入口同时存在，由客户端选择”与“主备切换”，不能把二者当成同一种组。

TuneX 已有 [持久发布](../../apps/control/src/application/path-publications.ts)、
[入口批次](../../apps/control/src/application/ingress-deployments.ts) 与
[迁移](../../apps/control/src/application/ingress-migrations.ts)。后续应串联现有预览、
精确 revision、逐项接受、Operation、条件补偿和恢复隔离，不能新建一个绕过
Forward owner 的 group executor，也不能承诺跨节点全局原子或无缝 UDP 迁移。

自动策略需另外定义观测有效性、故障/恢复窗口、迟滞、冷却、人工锁定、旧决策
作废和重启恢复。上游健康重评估的退避是其业务选择，不意味着 TuneX 可自动重试
任意带外部副作用的命令。自动选路排在固定拓扑和显式切换验收之后。

### 4.8 低干扰交互与故障恢复路径

证据：[pending 展示时序](../../Forwardx/client/src/lib/pendingFeedback.ts)、
[页面刷新策略](../../Forwardx/client/src/lib/operationsRefresh.ts)、
[数据库故障页](../../Forwardx/client/src/components/DatabaseHealthGate.tsx)、
[数据库健康路由](../../Forwardx/server/databaseHealthRoutes.ts)。

上游延迟的是 loading 的视觉展示，不是请求或防重复点击；页面刷新可配置，并在
隐藏页面或离开对应页面时停止。数据库故障与 Web 进程仍在线也分别说明。当前
main 的最后一个修复正是取消每次启动的全屏检查遮挡，改在后台检查。

TuneX 可以独立实现同样的交互原则，继续使用现有 Web 技术：请求发出即禁用重复
操作，接受后显示 Operation，不乐观宣布 Applied；保留上次读取的数据时同时显示
时间和 stale 状态。取消刷新不能取消已经接受的服务器操作，旧响应也不能覆盖新
请求的 revision。健康路由、数据库可用性和 API 鉴权的契约需要单独设计，故障页
不能成为暴露数据库连接信息或信任材料的入口。不以迁移 React 作为这些改进的前提。

### 4.9 运维闭环应可定位、可恢复

证据：[升级备份说明](../../Forwardx/docs/guide/upgrade-backup.md)、
[管理入口](../../Forwardx/docs/guide/agent-proxy-manager.md)、
[发行版本说明](../../Forwardx/docs/guide/releases.md)。

上游将状态、日志、升级、修复、备份与卸载放入用户能找到的流程，且说明换回旧
镜像不等于回退数据库。界面还区分升级任务的服务端生命周期与浏览器倒计时。
这种“下一步怎么处理”的完整程度值得借鉴。

TuneX 已有 [升级评估](../operations/upgrade-assessment.md)、
[只读检查实现](../../scripts/ops/upgrade-inspect.ts) 和维护/恢复工具。应优化其导航、
只读结果和错误解释，而不是重新实现恢复机制。保留 authority、Journal、信任材料、
nonce/replay、高水位与历史；repair 不能自动 enroll 或清空状态。支持包继续限额、
脱敏、标注来源，安装器或在线升级不因参考项目有入口就获得本任务授权。

### 4.10 适配器要有能力边界和拒绝路径

证据：[V3 transport 适配](../../Forwardx/server/forwardXTransport.ts)、
[Agent V3 校验](../../Forwardx/agent/fxp_v3_transport.go)、
[V3 协议边界说明](../../Forwardx/forwardx-fxp/internal/v3/PROTOCOL.md)、
[外部数据导入](../../Forwardx/client/src/lib/nyanpassImport.ts)。

值得学习的细节包括：先校验再触碰已运行实例；省略值与显式 false 分开；复制
可变配置而非保留调用者指针；未知版本拒绝；外部导入逐字段检查、不支持的配置
给出原因，实验性迁移遇端口冲突不静默换端口。

同时必须看到完成边界：V3 Agent 源码仍写有面板 capability 集成待完成的说明，
当前 changelog 也标明尚未开放面板。协议说明还区分其实现和所参考协议，并不
承诺所有线协议互通。因此 TuneX 不能把这些源码存在解释为可立即接入的成熟驱动。

TuneX 将来适配任何外部引擎时，都应声明目标/版本、平台、配置、权限、生命周期、
硬截止、部分启动清理、drain、指标与恢复语义，通过公开执行宿主接入。
不复制密码实现，不接入任意 shell，不以 FXP/商业功能数量驱动 Core 扩张。
外部文件导入可先做独立 L2 有界预览，真正写入仍走当前 L3 命令与授权；当前任务
没有新增 ForwardX/历史 V2 数据导入或协议兼容能力。

## 5. 测试与验收经验

本轮阅读的场景包括：

| 上游测试源码 | 值得带入 TuneX 的场景；均非本轮通过证据 |
| --- | --- |
| [运行汇总](../../Forwardx/server/forwardGroupRuntimeStatus.test.ts) | 同成员重复子规则不能补足另一个成员；部分运行、空资源与外部入口分别展示 |
| [入口诊断](../../Forwardx/server/portEntryDiagnostics.test.ts) | 旧失败不能盖过新成功、共享可见性不能泄露其他用户错误、预检拒绝不能破坏已有运行 |
| [事件流](../../Forwardx/server/agentEvents.test.ts) | backpressure、drain、完整帧、溢出/关闭和不重复释放 |
| [拓扑身份](../../Forwardx/server/probeTopology.test.ts) | 仅顺序变化保持身份，目标/端口/路径变化隔离历史；不按运行时间生成新拓扑 |
| [健康重评估](../../Forwardx/server/forwardGroupHealthRecheck.test.ts) | fake clock、过期重评估、执行中收到新事件、仅失败项重试和退避上限 |
| [故障切换](../../Forwardx/server/forwardGroupFailover.test.ts) | 故障/恢复窗口、异步外部操作和部分失败的组合场景 |
| [CI 声明](../../Forwardx/.github/workflows/ci.yml) | 将 UI/服务/Agent/runtime 分组；真实 Linux namespace 用例与普通单元测试区分 |

上游测试使用的 SQLite、进程 fixture、SSE fake 或同机 namespace，只证明其各自
场景。TuneX 仍需自己的 MySQL 锁/事务、mTLS、Guard/Journal、Direct/Relay/多跳
以及旧构造/新 provider 等价性证据。不能把上游 Actions 或同机 namespace 用例
替代 TuneX 独立物理主机门槛。

当前地基的 47 组计划不因这次研究变成已执行。本报告新增的是未来优化的候选
验收场景；具体实施后再加入对应任务的 readiness/接受记录，不扩写测试工具冒充
已完成源码任务，不将不同源码修订的历史通过结果拼成一次通过。

## 6. 后续取舍与执行入口

优先顺序是：**当前地基闭环 → 同一冻结源码验收 → 状态与能力解释 → 指标展示与
运维闭环 → 有证据的负载优化 → 拓扑/显式切换 → 单独评估自动策略和新驱动**。

具体候选、owner、复用端口、变更限制与验收条件见
[ForwardX 经验优化清单](../development/forwardx-optimization-backlog.md)。
它衔接 [既有经验吸收计划](../development/forwardx-gap-closure.md) 和
[四主线适配方案](../development/forwarding-platform-plan.md)，不重新把已编写的
诊断、telemetry、rollup、路径发布、入口批次和通知功能标为尚未实现。

本轮落地只有参考副本更新、源码研究与排期依据。未新增产品行为、wire、schema、
driver、authority、Runtime ledger、根信任、执行开关或后台任务；地基和并行门禁
保持未通过，原有 dirty 工作树和待续的 qualification codec 改动保留。
