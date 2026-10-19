# ForwardX 经验优化清单

日期：2026-10-19（Asia/Shanghai）。状态：**研究后的候选顺序，不是已实施或已验收功能**。

执行更新：[分阶段开发方案](forwardx-development-plan.md) 已建立为当前目标。
FXR-00 已推进 Control Probe、Path/Ingress/Transit、可观测性、查询/命令与被动 Node/Relay preview 的原 owner 源码，以及 Agent native/HTTP/result wire 切片；均未验证，阶段 A 和全量分类继续进行。
2026-10-19 用户已明确允许当前源码任务子代理协作；地基和上层模块门禁未打开；FXR-01 至
FXR-07 仍为 planned，验收 item 48–191 与此前 47 组计划均未执行。

2026-10-19 FR-0022源码已接入：完整读取并逐项映射22个旧Web文件，21个作为具名
native view/form/response适配器保留；rule-console.js实际产品命令编排已拆到L3
RuleCommands1，原DOM/input Set/JSON/编码/UUID/确认/abort/时钟归独立native view。
旧initRuleConsole保持原参数默认和七个返回方法，由原入口绑定public factories；
原单一selected Map/plan/generation/取消句柄、首次预检、未知重放、停止尾部、finally
await refresh顺序保留为源码意图，尚未验证。三个固定JS资产/type/routes接齐，旧
Rule/app/Relay VM源码提取需在集中验收适配canonical factories并保留覆盖。
188人工源码映射已写入browser-native-leaf-inventory-v1.md；185–191与此前验收全部
计划未执行。没有测试/类型/语法/静态/边界检查/格式化/生成/构建/CI/实验/Git写入/委派。
完整A5源码/type/private/default/消费者/资产/版本/移除条件/冻结候选/公开示例仍需
收口，尚未取得地基接受或上层并行开发资格；实时Echo v4接入仍是独立staged边界。

此前2026-10-19 FR-0021源码已补齐既有Echo历史读取链：probe.js原未定义回执投影、
原permit owner按族选择service context，以及同一事务中已有challenge/proof/字节/TLS
摘要捕获。probe-runs.js识别既有Echo摘要，绑定invocation/content digest并显示实际
TCP/UDP和字节数；HTTP/owner/browser/select接通既有echoed筛选。0037迁移与MySQL
history adapter源码已包含对应表示，本片未改SQL/迁移/时钟/事务/history owner。
公开machine API/receiveResult输入仍只声明v1/v2/v3；native v4存储解析不等于新增
实时v4接入、签发UI或能力接受。185–188全计划未执行，188的22个Web逐leaf完整分类
仍待完成。详见docs/architecture/browser-echo-receipt-history-v1.md与FR-0021；
无测试/检查/格式化/生成/构建/CI/实验/Git写入/委派，A5与后续地基接受门禁仍开放。

2026-10-19 FR-0020源码已接入：ConsoleRequest1归属原connected/version/JSON结果/
未知结果幂等键Map；native HTTP保留原fetch/options/abort/JSON/UUID，解码后才判旧连接，
再检查取消和HTTP。失败保留键，成功才删除，原reset在原位置清除，不增加重试或队列。
app.js成为原index入口的实际组合；native main view保留原DOM/表单/24个Console初始化/
页面auth-version/清理/监听顺序。Relay六个form函数与view body移到import-free原生
adapter，原relay-model.js/relay.js保留精确public绑定，不作目录豁免或新增业务根。
五个固定JS资产/type/routes已接齐。现有console-flow VM source harness依赖旧app/relay
私有布局，集中验收需适配canonical factories/UI ports；未改未运行、不新增生产凭据hook。
181–184全计划未执行；无tests/type/syntax/static/boundarychecks/format/generator/
build/CI/browser/native/network/MySQL实验/Git写入/委派。其他具名Web及完整A5/消费者/
type/private/default/公共版本/资产/移除条件/冻结候选与后续接受仍开放。
此前A5源码根目录补齐发现实际生产apps/web与bootstrap入口缺口：原Control
bootstrap已接到公共command/native1，保持argv/env首错、构造在try外、migrate后原
Identity.bootstrap、输出与finally close。FR-0019在实现前记录后，ConsoleModel1与
BrowserNative1分开原UI helper政策与Date/URL格式；旧model.js保持十个导出，三个
固定JS资产路由/type与实际相对ESM import接齐，原CSP/MIME/固定reader保持。
Core四个生产文件已读且未改，开发/生成/fixture/验收工具与生产roots分别记录；
Docker COPY与ignore只做源码读取，没有构建。177–180全计划未执行；无tests/type/
syntax/static/boundarychecks/format/generator/build/CI/browser/native/network/MySQL
实验/Git写入/委派。其他具名Web源码以及完整Control/Agent/type/private/消费者/资产/
公共版本/移除条件/冻结候选仍需逐项收口；本轮不是全仓分类完成或地基接受。
此前FR-0018 源码已接入：agentplatform1 归属原生 Providers/Effects/LocalServices
及 stateless defaults，Control 原名字保留精确别名、构造器/nil/fixture fallback。
canonical named-struct 的声明包/反射身份变化已在FR实现前记录。Probe仍在Guard后调用
原四种构造层级，native选择收口到原Control构造兼容桥；counter核心接收显式scheduler，
两个生产调用点使用单独绑定的原生counter时钟，未改成Runner注入时钟，终态仍先采样。
原L0/L1、协议/schema/Authority/Journal/ledger/预算不变；174–176全计划未执行。
本轮无测试/类型/语法/静态/边界检查/格式化/生成器/构建/CI/实验/Git写入或子代理委派。
完整A5 source/type/private/default/真实消费者/资产/移除条件/例子与冻结候选及所有接受门禁
仍未完成；不得把三个具体source点迁移当成全仓闭合或地基接受。
此前源码集成：UpgradeAssessment1 接齐原计划规则/报告与 native
bounded file/catalog/Authority/CA/MySQL 只读检查，旧两个脚本仅经公开入口精确别名。
OperatorCommand1/native1 接齐原 ops CLI 和 release evidence 入口，保留原环境/参数/
错误白名单/输出退出/Recovery 与 Authority 调用顺序。packages/contracts 逐 leaf、
11条exports及schema/catalog资产完成本片人工分类，三个L1版本1/1/2不变；其余native
barrel未当作L1。Agent实际调用链已收窄到default/fallback、Probe默认构造与生产counter
原生时钟采样，原JSON/time/echo旧残余已由后续源码迁移取代。167–173全计划未执行；
只做源码读写，无tests/type/syntax/static/boundary checks/format/generator/build/CI/
native/network/MySQL实验或Git写入。全A5/消费者/私有类型/资产分发/移除条件/例子与
完整冻结候选及后续接受仍开放；地基与上层模块门禁未打开。
此前并行源码集成：FR-0017 observation/publication/event storage1、各原 owner
恢复操作、RecoveryQuarantine1 与完整 RecoveryWorkflow/native1 已接回旧 operator
入口。原同Tx顺序、Notification端点后采样、publication共享时刻、未知发送结果、
history与唯一ledger/Authority保留；备份/恢复原native body已迁出，提交后凭据再rebind。
Server public preflight/raw bootstrap/native protected-path源码也已接齐；Agent native
codec/generated/schema/alias/辅助CLI/responder精确分类完成本片人工记录。159–166
计划未执行；无tests/type/syntax/static/boundarychecks/format/generator/build/CI/
native/network/MySQL实验或Git写入。Ops CLI/upgrade、packages native格式/资产、
剩余Agent/private/default、完整消费者/移除条件/例子/冻结候选仍需继续；未打开接受门禁。

此前并行源码集成：FR-0016 raw Runtime status storage1/product queries1/native
JSON-time 已接入两个原生产组合，旧 MySqlRuntimeObservations 构造/自有status/递归保留。
Control startup1/client-command1 与 native effects 已接齐；Agent 原生 multihop 配置
保留同 owner 单一实现，Relay 使用原 egress，Forward/Relay 共享原进程预算，Snapshot
同包迁移。153–158 全计划未执行；源码子代理授权不打开验证或上层功能门禁。
完整源码盘点定位下一真实缺口：ops Recovery 同事务跨 owner quarantine 写入、server
bootstrap/secret-path、native contracts/辅助CLI/工具及全量消费者/移除条件/冻结候选。
无 tests/checks/format/generator/build/CI/实验/提交推送；地基未接受。

此前 CLI 源码切片：L3 agentcommand1/L2 agentcli1 接齐原 flags/模式/路径/proof/
inspect/enroll/run/锁/信号及公共 Runner/enrollment/state，旧 main/run/enrollment 保留；
Control 离线 plan 直接消费 public compiler/facts。不改既有 L0/L1，150–152 未执行。
Control startup/client/server/ops/MySQL、native engine/wire/default/消费者/冻结候选与
后续验证/产品门禁仍开放；此源码接线不代表 CLI 或完整地基已接受。

FR-0002 经明确确认后已实现 Runtime host interface2 的显式时钟与时间 codec，旧
构造适配注入原生 effects；兼容默认绑定/消费者和显式类型别名已记录。用户持续
授权后续同类提案由代理选优并直接实施源码，仍记录 FR 和验收要求，不逐次确认。
119/120 未执行；全仓分类、冻结候选与后续验证/产品门禁继续分别记账。

FR-0003/FR-0004 后续源码已要求显式 BackgroundTaskEffects 和 Ledger/Relay/Node
时间 codec，各自 interface2；旧原生构造入口、原任务/事务/格式调用点保留。普通
error/lifecycle/type 旧入口改为 public 精确别名。121–123 为计划未执行，九个 L1
文件的 shared/runtime 类型与 Relay config 传递依赖仍属债务，A5 未关闭。

FR-0005/0006 后续源码已有唯一 Policy/执行事实 L1 声明和旧精确别名，原 defaults/
wire 留在 native owner；FR-0007 两个原对象策略视图使 Relay interface3 保留原
授权循环并移除直接 native config 类型解释。124–126 未执行，九个文件仍有 raw
runtime 类型及 Profile 传递依赖，Host ADP/完整 A5/冻结候选仍未完成。

FR-0008 已编写公共协调事实/擦除值族和显式 native 绑定源码，并将 Host 原协议/
能力判断和响应投影接入 codec。Host3/Ledger3/Relay4/evidence2/values1 是源码候选，
127–129 未执行；ProfileConfig/传递配置和其他 native/A5/完整候选仍开放。

FR-0009/0010 后续已编写 Profile 不透明槽/native 别名、Transport 原位置 formatter
和 Node 原 token/CSR/support/指纹前缀 codec。候选 values2/Relay5/config2/Transport2/
Node3；130–134 未执行。具体链源码迁移不等于全 L1/A5/完整候选或行为接受。

FR-0011 已编写 HTTP1 公共路由与原生传输分工：L3 聚合业务 API/路由，L2 具体
Hono/Node/URL/context/格式操作，旧工厂和 options 精确别名，server 公共绑定。
135–137 未执行；完整分类、原生默认/消费者/冻结候选与地基门禁继续开放。

FR-0012 已编写 Agent executionstate2 协议/slot codec 和原 state/Runner/drain/
channel 格式接入，原 Journal/锁/高水位/保存先于执行和 ACK 保留。138–140 未执行；
下层 JSON/type/metadata 和完整 Agent/CLI/default/消费者/冻结候选仍开放。

FR-0013 已编写 executionstate3 tagless facts 与 state 原 native JSON 记录分离，
Bootstrap/provider2，store/wrapper/Runner 接齐显式字段/引用转换；类型身份及直接
lower 序列化消费者须迁移。141–143 未执行；完整 Agent/Control/CLI/default/
消费者/冻结候选和地基接受仍开放。

FR-0014 已编写离线 Transit prepared1/native binding1，原 driver HostVersion1
及原控制/持久化/engine/关闭错误次序保留；未注册或接入 Run/poll。144–146 未执行，
原生依赖和完整全仓/CLI/default/消费者/冻结接受继续开放。

FR-0015 已编写 observation Provider2/native provider2/wire1：原 DTO/编码/ACK/
格式和 UDP 诊断 native binding 下沉，原采样/预算/保留/游标/worker/IO 关闭保持。
147–149 未执行，完整依赖/CLI/default/消费者/冻结候选与地基接受继续开放。

Runtime 产品策略源码现已归回 Forward/Identity/Node/Transport owner，包括原
executor/registry/adapters/reconcilers、Snapshot sources 与完整协作/Node 类型。
原 root/ledger/collector/事务保留。Runtime 目录分类已记录当前每个文件的真实
包装/别名/实现归属及债务；115–118 计划未执行。L1 时钟/格式和全仓分类/冻结
候选依然开放，B 验证仍须后续人类授权。

后续原 execution status/result/ACK、echo 编码分段与共享时间解析已完成本批源码迁移；
十五个 HTTP query 原入口已转为 native codec / Console 公共入口的精确别名。
readiness111–114 均为计划未执行。当前仍有 HTTP URL/header/inline projection/
类型/default、native URL/protected key/engine/wire/CLI、Runtime 私有链及 A5 全量
源码/type/兼容消费者/移除条件/冻结候选工作，不能从格式切片推断整个阶段通过。

最新源码为完整 Path/Ingress class/API/contracts、公开 Node/Profile/Endpoint 引用和
原 limits；HTTP 全入口已读，证书/body/error/console IO 已有 L2 实现；Agent
qualification/delivery/v1 status 和 Runner report/drain/Snapshot/credential
格式已归入原生 adapter。旧入口精确别名和原 Tx/default/采样/权威次序仍待验收。
其余 HTTP 查询/类型/default、Runtime/private adapter、Agent execution status/
result/echo/ACK、全仓 A5 候选仍开放。没有运行检查、测试、构建、CI、实验或 Git 写入。

依据：[源码对比报告](../reference/forwardx-comparison-2026-10-19.md)。
参考修订为 `8a3e70ccd62fbfee301f3b919120d51e9892de28`，TuneX 对照为 HEAD
`8f35889e13b09a19d215dc10bc6855a3ca98b366` 加当前未提交源码。本清单不冻结 dirty
源码，不替代 [readiness](foundation-readiness.md)、FR 或现有产品规范。

## 1. 当前阶段的执行边界

当前首先完成既有地基任务的 Control Probe、其他混合应用/存储、Agent Probe、
Runner/native/wire 和全仓分类。参考研究没有授权提前开发独立产品模块、打开并行
门禁、改变 frozen public contract 或扩大执行能力。

本轮已完成：干净参考仓库的 fast-forward 更新、源码对比、候选清单及文档导航。
下列 FXR 条目均为 planned。新功能先等地基门槛；原功能的源码收口可依原授权按序
继续，但不能借此暗中增加新语义。

对每个实际选中的切片，实施前仍写六项提案：层级、公共接口、地基影响、契约变化、
计划/已执行验收、其他模块影响。变更 frozen 接口或语义需要先提出具体 FR 并确认。
私有等价性整理不因文件位于地基就自动成为 breaking change。

## 2. 候选顺序

| ID | 时机与优先级 | 具体结果 | 复用与 owner | 当前状态 |
| --- | --- | --- | --- | --- |
| FXR-00 | 当前 P0 | 按完整 owner 调用链关闭已知混合依赖，收敛兼容桥和未分类源码；冻结可验收基线 | 当前 L0–L3、原 Runtime/Agent owners | 既有任务继续；本研究没有完成它 |
| FXR-01 | 地基通过后，产品 P1 | 统一列表/详情/批次的“已接受、部署、监听、Probe、历史/缺测、清理”说明与节点下钻 | L3 Console/ForwardDiagnostics/Ingress APIs 与 Web | planned，复用已有诊断源码 |
| FXR-02 | 与 FXR-01 同一产品阶段按序推进 | 表单展示当前能力与不可选原因，不把 catalog 当节点证据 | L3 NativeDrivers/Node 查询，原 L1/L2 capability/codec | planned，优先不增加 wire |
| FXR-03 | 状态闭环后 P1 | 图表同时展示来源、可观察起点、epoch/gap/coverage、时间窗和 stale 状态 | L3 telemetry/rollup/Probe history 与现有读模型 | planned，不重建采集/聚合后台 |
| FXR-04 | 运维 P1 | 可导航的只读诊断、数据库故障说明、支持包与升级评估流程 | 原 ops/AuthorityStore/Journal owner；L3 展示 | planned，复用现有检查/恢复实现 |
| FXR-05 | 有集中验收与负载证据后 P2 | 按 key 合并与有界唤醒、慢消费者处理、页面可见性刷新 | 现有 L1 生命周期、L2 通道、L3 触发策略 | 评估候选，尚未决定新增事件通道 |
| FXR-06 | 固定路径/入口批次验收后 P2 | 拓扑、逐项发布/补偿、人工切换与可解释的历史关系 | 原 Path/Ingress/Forward/Runtime owner | planned，不等于自动故障转移 |
| FXR-07 | 发布/可靠性门槛后另立项 | 有界外部格式预览、命名目标的可选 driver 或声明式管理扩展 | 独立 L2 adapter / L3 模块与原执行宿主 | 长期候选；未选择 FXP 或任意第三方引擎 |

这些是结果包，不按函数数、端口数或文档条目数计完成率。每个包内部采用可审查的
纵向切片，不在一次变更中同时改 UI、协议、执行授权、数据库和自动策略。

## 3. 每个候选的实施与验收条件

### FXR-00：用闭环定义地基收口

先完成正在进行的 Probe qualification 源码收尾，再按已有任务顺序处理实例/资格
存储、Path/Ingress/Transit、Agent Probe/native、Runner 兼容和全仓清单。
逐 owner 写明公共入口、事务、存储、codec/platform、状态写方、旧入口和错误路径。
发现未分类依赖先归属，不将整个包加入豁免来消除报告。

验收仍是既有 47 组集中计划和原回归要求；本条不新增一套脚本。授权后适配边界
工具并覆盖 type imports、private subpaths 和未分类文件；同一冻结源码通过契约、
等价性与公开例子后，才记录地基接受和可并行开发的公共版本。

### FXR-01：先把已有事实讲清楚

输入采用现有 Console、ForwardDiagnostics、Operation 和 Ingress 结果。列表允许
简明摘要，详情显示证据来源、更新时间、缺失原因及逐节点结果，不另设健康权威。
若现有 DTO 不足，先列出具体字段缺口和来源，不为了界面编造后台事实。

计划验收：部分节点运行、同身份重复记录、缺失/过期报告、旧 Operation、新旧
generation 竞争、删除/cleanup pending、共享资源权限裁剪、请求结果迟到、页面
切换与断线；202 不显示 Applied，监听 ready 不显示应用 Healthy。浏览器与真实
API/SQL 证据在获授权的 Actions 取得。

### FXR-02：能力、发现与授权分别判断

先消费已有 catalog、Control flag、Node 当前 facts、平台/角色/协议能力和凭据
窗口。表单显示 supported / unsupported / unknown 的原因及来源，服务端继续独立
判断。工具安装/版本发现只在实际引入外部引擎时按需提出，不预先扩大 Agent 上报。

计划验收：unknown、旧 Agent、flag 关闭、平台/角色不匹配、部分入口不支持、Node
事实过期、权限变更和预检后状态变化；预检不能授权执行，预检失败不能触碰已有
运行实例。任何新增 public/wire 字段的兼容拒绝与迁移先单独审查。

### FXR-03：完成现有指标链路的用户闭环

复用 Node/Host/Forward/Probe 四族 raw/rollup/history 和既有质量字段。图表点数
与尝试次数分离；相同 series 才做差值，baseline、counter reset、gap 和缺测
保留含义。前台查看策略不得延长 Agent 执行授权或触发未授权采样。

计划验收：首次基线、epoch 重置、同序列重发、乱序、丢弃、overflow、实例重建、
路径/目标变化、恢复隔离、时间窗口边界、长窗口聚合、无样本、损坏来源与 SQL
rollback。验证统计口径与 uint64 精度，不把尝试失败率标为网络丢包，也不从缺测
生成零延迟/零失败。查询结果须按 Scope 裁剪且有大小/页数限制。

### FXR-04：把已有安全工具变成可完成的操作流程

从只读 status/diagnose、当前版本/兼容目标、数据库故障说明和支持包导出开始，
串到既有 assess-upgrade、维护、备份、恢复和 review。故障信息不给出密码、原始
SQL、信任路径或私钥；修复指导不能建议清空 Journal 或换新身份掩盖损坏。

计划验收：数据库不可达时状态说明可读且不循环依赖业务查询，读取失败不是空
列表/零指标；日志/支持包脱敏有界；缺备份、catalog 不符、旧 reader、部分迁移、
protected state 损坏和计数耗尽均保留原拒绝。真实故障与恢复验收不在本研究运行。
新增远程安装/在线升级能力另行立项，不能由此引入任意 shell 或远程 root 执行。

### FXR-05：先量化负载，再决定调度改动

先测既有观察池、周期任务和 UI 请求的瓶颈。若确需新机制，分别约束活跃数、
待处理 key/字节数、过期、取消、合并、优先级、关闭与故障恢复；通知只提示读取
当前持久状态。保留原周期对账和原事务；不把进程内锁误当跨实例授权/互斥。

计划验收：慢读方、队列饱和、重复唤醒、执行中发生新变化、事务失败、断开重连、
取消与关闭、日志失败、跨 key 公平性、key 清理及内存上界。丢失通知后仍须收敛，
旧通知不能续租；压力下不能占用 Runtime 执行事务池。副作用的重试必须按原 owner
契约决定，而不是统一套退避重放。新 L1 公共能力若影响 frozen 语义先走 FR。

### FXR-06：先显式、后自动

使用现有路径/入口 APIs 展示精确引用、分支、预览、逐项 Operation 与补偿条件。
一个计划的“接受”与每个节点的“应用”分开。仅在已有信息可完整关联时展示某段
观测，不把替代分支串起来，也不把分段耗时之和标成真实端到端耗时。

计划验收：部分发布失败、CAS 冲突、成员中途撤销、旧计划、监听冲突、补偿条件
不再成立、恢复后隔离、重复请求和凭据/租约截止。自动故障转移另需健康有效性、
迟滞、冷却、人工锁定、旧决策作废及重启恢复语义；不能用手动切换测试替代。
独立物理多主机、长时间网络波动和生产切换保持单独证据门槛。

### FXR-07：命名兼容目标，不承诺普适兼容

外部导入先给版本、闭对象、字节数、条数、协议/字段和缺失值规则，输出只读
预览；写入经原 L3 命令，不导入远端身份、凭据或执行代码。新 driver 必须声明
硬截止、partial start cleanup、stop/drain、平台/协议、指标和恢复，不能满足就
不暴露为受控执行能力。插件优先声明式管理能力，不绕过 Agent authority。

计划验收：未知版本/字段、超限、端口冲突、不支持的选项、配置可变别名、显式
false/省略区别、旧 runtime 和 feature gate；拒绝发生在改变工作实例之前。
没有批准兼容目标时不构建导入器，不增加 FXP V3 或其他外部协议。

## 4. 交付记账

每次实际实施记录：ID、owner、源码修订、dirty 状态、消费/变更的公共契约、
兼容入口、已编写内容、计划与已执行验收、证据链接、合并与发布状态。
源码存在、契约通过、合并、镜像、发行和生产就绪分别记账。

本轮没有实现 FXR-01 至 FXR-07，没有执行 FXR-00 的冻结/验收，也没有改变
`foundation-readiness.md` 的接受状态。当前参考副本与研究材料可用于后续持续工作。


2026-10-19 A2 fourteenth source slice, authored and unverified: public
TransitStagingService now owns original offline stage/abort coordination over
required public transaction/Node/Forward/Transport/Endpoint/reservation providers.
MySqlTransitStagingStore keeps original staging SQL and read-only Runtime/history
observations; exact physical release remains with MySqlRuntimeResourceStore via
the extracted RuntimeReservationRelease mode. Preserve all-slots-check before any
release, owner/Fence/generation predicates and same-Tx stage CAS/rollback. The old
five-argument coordinator retains own async methods, verifier/type aliases and
lazy unused-collaborator behavior. No live registration/execution or history reset.
Readiness item 67 is unexecuted. Other mixed owners, A1 residuals, Agent/native,
Runner and whole-source classification remain open. No checks/tests/builds,
experiments/CI/commits/pushes/delegation ran; no foundation or upper gate opens.

2026-10-19 A2 fifteenth/sixteenth source slices, authored and unverified: the
original Audit and passive Forward diagnostic classes, APIs, read contracts and
policies now live in independent public owners. Audit read projection/policy stays
L3 over the same lower SQL; Station consumes its public error vocabulary. Diagnostic
Probe framing/body projection now uses separate original L2 functions, preserving
the parse catch boundary and all L3 identity/trust/time/state checks. Old entries
directly alias canonical leaves; server/HTTP use public owners. Per-instance
admission, original transactions, query/cursor/order, redaction/bytes and disabled
authority flags remain source intent. Readiness items 68/69 are unexecuted. Other
mixed owners, A1 residuals, Agent/native, Runner and full classification remain
open; no checks/tests/builds/experiments/CI/commits/pushes/delegation or gate opening.

2026-10-19 A2 seventeenth/eighteenth source slices, authored and unverified:
StationAlerts and Notification endpoint/delivery services, rules, APIs, policies
and storage values now live in independent public owners. Station owns the same
supplied-Tx event handoff; Notification consumes public Station contracts/rules.
Original Vault/Sender declarations move to L1; native implementations import lower
ports without product types. Existing lower SQL/native bodies and server instances
stay unchanged. Original event/enqueue/policy atomicity, command replay/CAS, vault
stage before SQL publish, claim/preflight/Fence/attempt guards, key zeroing and
physical-idle-before-lease-release are source intent. Old paths directly alias
canonical leaves. Readiness70-72 unexecuted. Probe history/plan, telemetry, A1
residuals, Agent/native, Runner and full classification remain open; no tests/
checks/builds/experiments/CI/commits/pushes/delegation or gate opening.

2026-10-19 A2 nineteenth/twentieth source slices, authored and unverified: original
Probe history recorder/read and finite plan services, rules/APIs/contracts/policies/
storage values now live in independent public owners. Probe-owned command API
acceptance declarations moved with exact legacy aliases; existing issuer/recorder
same-Tx roots, savepoint isolation, scheduling/expiry/replay/CAS and lower SQL stay
unchanged in source intent. L2 owns original retained echo invocation framing and
restores the missing original service-selection parser export. No new echo plan,
issuer, status filter, permit authority or feature flag. Readiness73/74 unexecuted.
Telemetry/rollup, A1 residuals, Agent/native, Runner and full classification remain
open; no checks/tests/builds/experiments/CI/commits/pushes/delegation or gate opening.

2026-10-19 A2 twenty-first through twenty-fifth source slices, authored and
unverified: five original telemetry services and their shared API/contracts/
policies, mapping/recorder/read shapes and rollup rules/provider now live under
public telemetry-owner. Each class retains independent state/budgets/flags and
original lower SQL/mappers/observation pool. L2 owns original four ACK projections
and exact wire-type aliases; mapped count guards remain L3. Same root instances,
raw-then-rollup same-Tx order, epoch/replay/clock, exact BigInt deltas and original
quality/coverage/fold/query/capacity semantics remain source intent. Old paths
are precise leaf aliases. Readiness75-77 unexecuted. A1, other application/HTTP,
Agent/native, Runner and full classification remain open; no checks/tests/builds/
experiments/CI/commits/pushes/delegation or gate opening.

2026-10-19 A2 twenty-sixth source slice, authored and unverified: original inert
ObservationServices command/query, API, product contracts and storage values now
live in the existing public declaration owner. Exact old leaf aliases, mutable
limits, same root instances/SQL, archived identity/quota, CAS/replay/clock and
immutable-revision/head/audit/receipt order remain source intent. Legacy wrapper
head/count hooks/static recovery unchanged. Readiness78 unexecuted; no tests,
checks, builds, experiments, CI, commits, pushes, delegation or gate opening.
A1 Probe coordination and other application/HTTP, Agent/native, Runner and full
source/type/default/bridge classification remain open.

2026-10-19 A1 instance/negotiation/qualification source continuation, authored and
unverified: original five classes and exact machine/instance/evidence/measurement
contracts now live under public Probe owner. Original per-path default clock and
ACK timing, same-Tx generation/replay/expiry/credential/tombstone/recognition rules,
lower SQL and precise leaf aliases remain. Readiness79/80 unexecuted; remaining
A1 permit/command/plan/result/service coordination and A2/A3/A4/A5 remain open.
Human explicitly authorized source-task subagents on 2026-10-19. Source-only
agreement still excludes checks/tests/builds/experiments/CI/commits/pushes; no
acceptance or parallel feature gate opens.

2026-10-19 integrated source continuation, authored and unverified: A1 original
instance/hello/qualification, preflight/command/Observation resolver and product
contracts now live in the public Probe owner; inert Observation command/query
chain is public. A2 Console query/rules/projections/API now has its own public
owner with same original Control/HTTP/store bindings. A3 original native address,
echo socket/format and default provider bodies moved to explicit probe/native L2;
parent retains global admission/Gate/counter/authority. A4 original Runner wire,
Direct/Relay assignment and native catalog/capability bodies moved into existing
nativeexecution L2, with same original Runner lifecycle/state and legacy errors.
Readiness78-85 is entirely planned/unexecuted. Original source/default/ordering
compatibility is not proven by these moves. Human authorized source-task agents;
no checks/tests/builds/experiments/CI/commits/pushes or gate opening. A1 permit/
claim/delivery/result/type/service, A2 other queries/commands/full HTTP, A3/A4 public
native references/authority/Journal/CLI and A5 whole classification remain open.

2026-10-19 next integrated source batch, authored and unverified: original Control
Probe permit authority and five v1/v2/v3 machine adapters now have canonical public
owner bodies and exact old leaves. Original Control/Transport/Tunnel read services
and projections now use public owners; Identity Access/Node command/API/effects
join their existing public owners. Native catalog/logical tunnel implementations
and original Path/Forward command APIs have canonical owner leaves; same roots,
providers, stores, effects, flags, defaults and transaction/receipt identities stay.
Agent legacy header/declaration checks and echo endpoint mechanics move to native
L2 at original points, preserving distinct duplicate/clone/strict-last/error order.
Readiness86-97 entirely planned/unexecuted; no checks/tests/format/generation/builds/
CI/experiments/commits/pushes. Source agents were explicitly authorized; feature
parallelism/acceptance stays closed. Remaining Forward/Profile/Path/Ingress/HTTP
and Agent body-I/O/JSON/wire/time/source-type-default inventory are explicit source
blockers; whole A1-A5 and B-E not complete. No physical/release evidence inferred.

2026-10-19 current source batch, authored and unverified: original Profile grant
and complete Forward command bodies now canonical/public with exact old aliases,
original command ports/Tx/replay/provenance/retry/compensation/default fallbacks.
Original passive Node observation has public product owner/raw L1 reader contracts
and exact native lifecycle effects; lower MySQL body unchanged. Original root Relay
preview delegates to required public owner over same RelayCoordinator. Agent original
HTTP/JSON/bounded-body and v2/v3/v4 result-wire mechanics moved into native L2;
claim/current-instance/clock/trust/report-once/authority and version differences stay.
Readiness98-105 entirely planned/unexecuted. No tests/checks/format/generation/builds/
CI/experiments/commits/pushes. Remaining Path/Ingress bodies/contracts, Runtime/private
native defaults, full HTTP chain, Agent status/qualification/delivery/time/credential
formats and whole A5 freeze inventory remain actual source work. B unexecuted and
requires later human verification authorization; C/D not started, E separate approval.
