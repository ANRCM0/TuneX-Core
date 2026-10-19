# ForwardX 参考后的开发执行方案

Current source handoff, 2026-10-19: A5 manual source classification and reviewable
candidate scope are closed in
[foundation-a5-source-closure-v1.md](../architecture/foundation-a5-source-closure-v1.md).
Full Control/Agent/assets/support ledgers join old top-level59/Runtime34/application99,
public versions and compatibility consumers/removal conditions. FR-0023-0025 resolve
the new lower representation/cancellation residuals as implemented-unverified.
Readiness206-220 and all prior current-source cases remain unexecuted. Earlier
bounded source-open statements below are historical; actual saved revision and B
verification need later authorization, and foundation/upper/physical/release gates
remain closed. This source handoff neither runs tools nor starts C-E product work.

日期：2026-10-19（Asia/Shanghai）。状态：**执行阶段 A：A1 原列出应用协调已迁入公共 owner、全量分类与接受待完成，A2 已有 Path 系列、IngressGroup/Deployment/Migration owner/存储及 Transit 协商/投递/离线协调/准备与独占预留/staging-abort 及 Audit/被动诊断/Station/Notification/Probe history-plan/telemetry-rollup/Observation/Console/Control-Transport-Tunnel query/Access-Node-Forward-Profile command/passive Node-Relay preview/native catalog-tunnel owner 源码切片，A3 Probe native 与 A4 Runner wire/catalog 已有源码切片；地基未接受，上层模块并行门禁关闭；B–E 尚未实施**。

本方案依据[源码对比报告](../reference/forwardx-comparison-2026-10-19.md)与
[优化清单](forwardx-optimization-backlog.md)，承接现有地基任务，不重新实现已编写的
诊断、telemetry、rollup、路径发布或入口批次。参考对象固定为 ForwardX
`8a3e70ccd62fbfee301f3b919120d51e9892de28`。2026-10-19 用户补充允许参考、改写或复用适用的成熟代码以加快开发；具体片段保留来源修订、适配差异和版权/许可记录。
`Forwardx/` 不作为编译、运行或部署依赖。复用落在 TuneX 对应 owner 内，保持原 Runtime/权限/事务与冻结契约约束；见 [复用映射](reference-code-reuse-map.md)。

前一批源码切片：Path/Ingress 原八个完整协调类、API/flat contracts、Path 引用校验与
原 limits 已接回公开 owner，Control/HTTP 保留原实例和调用；HTTP 全入口已读，
原证书/body/error/资源 IO 归入 L2。Agent qualification/poll/claim/v1 status 与
Runner report/drain/Snapshot/credential 格式已有真实源码迁移。readiness106–110
均为计划未执行；HTTP 其余格式/类型/default、Runtime/private adapter、Agent
execution status/result/echo/ACK 与全仓 A5 冻结候选仍未收口。没有阶段 B 验证授权。

当前新增切片已迁移上述 execution status/result/ACK 与 echo 编码分段，以及共享
原生时间解析，保留原父层 burn、Guard、采样、历史认证及最终权威复查。十五个
HTTP query 原文件也已归到 L2 codec / Console 公共入口并保留精确旧别名，保留
各族重复键、空值、revision 上限和首错差异。readiness111–114 均未执行。
其余 HTTP URL/header/inline projection、类型/default、native URL/protected key/
engine/wire/CLI、Runtime 私有链及 A5 全量分类/兼容消费者/移除条件/冻结候选仍开放。

## 1. 目标、授权与执行规则

最新 Runtime 切片已将原 Forward executor/registry/native adapters、Snapshot registry/
Relay source 与三个权限 reconciler 移入各自现有产品 owner，Control 保留原实例、
回调、事务和唯一 ledger/collector；原协作及 Node management/grant 类型为精确别名。
readiness115–118 全部未执行。Runtime 目录已逐文件记录当前实现/别名/构造包装，
但 L1 RuntimeHost 原生时钟 fallback/Date 格式、全仓其他 source/type/default、
完整兼容消费者/移除条件和冻结候选仍未完成，不把目录表当边界通过。

随后已按明确确认实施 FR-0002：Runtime host interface2 要求显式 now 与
parseTime/formatTime，旧 RuntimeController 组合原生 effects 保持参数不变；
L1 默认时钟/格式债务在源码上移至 L2，119/120 均未验收。用户进一步授权后续
同类地基提案记录 FR 后自主选优实施，不再逐项确认。其他全仓分类和冻结工作继续。

本轮进一步实施 FR-0003/FR-0004：BackgroundTasks 直接 L1 构造要求显式定时/单调
effects，旧 application 单参数入口为同一生命周期的原生包装，server 五个原任务
显式注入；Ledger/Relay/Node authority 各自 interface2 要求现有 compiler/codec
提供时间转换，Node 响应保留原事务和提交后格式化位置。旧原生构造参数/default
时钟捕获保留，直接调用方缺 effects 的拒绝为明确变化。readiness121–123 均未执行。
L1 九个文件仍直接引用 shared/runtime 类型，Relay profile 还有传递依赖；已逐项
记录为迁移债务，不把 sharedTypeContracts 现状声明当例外。完整 A5 及冻结仍开放。

随后 FR-0005/0006 已将原 Policy、Observation/Drain/Condition 的唯一声明迁至精确
L1 公共入口，旧 wire/public 路径保留别名，原默认对象不动；FR-0007 将 Relay 内
native config 强转改为两个原对象视图，Relay 升为 interface3，原授权/采样/事务
循环保留。124–126 计划未执行。九个 L1 文件的 RuntimeAssignment/Snapshot/
Messages/Tombstone/Profile 等原生类型、Host ADP 专属选择仍需实质分离，不扩大
为整个 contracts 包的豁免或 L0 领域扩张；HTTP/Agent/全仓候选与阶段 B 门禁仍开放。

FR-0008 继续把原 assignment/resource/tombstone/snapshot/Hello/report/ACK 共同字段
归到唯一 L1 声明，native 保留封闭 driver/envelope 类型，通过擦除值族显式绑定原
三个宿主、compiler/store、Forward source、Probe reader、HTTP 和旧类型入口。
Host 协议/能力拒绝及 Hello/ACK 投影接入 codec，原 identity/事务/采样/权威顺序保留。
候选版本 Host3/Ledger3/Relay4/evidence2/values1；127–129 均未执行，ADP/driver
版本未变。RelayProfileConfig 及其传递配置仍须真实端口迁移；其余 native/HTTP/
Agent、全量 source/type/default/consumer/移除条件/冻结候选和阶段 B 授权仍未完成。

FR-0009 已将上述 Profile 改为 L1 不透明值族槽，native schema/公共旧类型由显式
native 别名保留，Transport 原事务内时间格式接到配置 codec；FR-0010 将 Node 原
token/CSR/运行支持识别及指纹前缀接到原 codec，身份/网络/签发/replay/采样/Tx
决策仍在原宿主。候选 values2/Relay5/config2/Transport2/Node3；130–134 未执行。
这只记录已迁移的具体源码链，完整 HTTP/Agent/native/default/private/消费者/移除
条件/冻结候选与公开例子仍需继续，不据此宣布全 L1/A5 或地基接受。

先关闭既有 owner 的混合依赖，形成可冻结候选，再以同一源码通过集中验收和公开
示例，随后按状态、能力、指标、运维的顺序完成产品闭环。调度优化必须有负载证据，
人工切换先于自动策略。以可审查结果包推进，不设置未经估算的天数或完成百分比。

当前用户已授权按方案继续开发，并于 2026-10-19 明确允许子代理协作。现行“先源码、后集中验证”
约定继续有效。本授权允许必要源码读取和编辑及当前源码任务的子代理协作；不自动
授权测试、类型/语法/静态/边界检查、格式化、生成器、构建、验收 CI、网络/MySQL/
浏览器实验、提交或推送。阶段 B 开始前需要后续人类授权。开发继续到候选冻结时，
应交付具体候选和待执行验收包，而不是把本方案当成已经通过的证据。

每个切片编辑前说明六项：任务层级、消费的公共接口、地基影响、契约变化、计划与
已执行验收、其他模块影响。保持 L0 公开接口、单一 Runtime ledger、原 Agent
authority/Journal 及原事务所有权。若需要改变冻结公共契约或语义，先记录具体 FR，
列明消费者、迁移、兼容拒绝和待验收病例。2026-10-19 用户进一步持续授权：后续
同类地基提案由代理自主选择最优方式并直接实施源码，不逐项请求人类确认；决策和
授权依据写入 FR，不以占位兼容掩盖破坏性变化。验证、提交、发布等独立门禁不变。

FR-0011 已将原 HTTP 路由/聚合接口归为 L3 api/public.ts（HTTP1），原 Hono/Node/
URL 构造、类型、context 和格式操作归入独立 L2 公共入口。旧 app/ports 是精确
别名，server 消费 public；原 query/body/认证/事务/错误/lifecycle 顺序保留。
135–137 为计划未执行；仍须继续 Agent/server/CLI/native/default/private/消费者/
移除条件和完整冻结候选，不能以 HTTP 单片源码记录宣布全 A5 或地基接受。

## 2. 阶段 A：既有地基源码收口（FXR-00）

2026-10-19继续A5旧入口源码收口：完整读取modules顶层59文件，形成
control-legacy-module-leaves-v1.md的6个构造/static绑定与53个精确转发映射，记录生产/
Recovery/phase/test消费者及原动态/捕获时钟、120/86400、资源default和零参数store。
五处type消费者已直接指向既有Forward/Node/Identity owner public声明，保留Accepted
旧名和原唯一类型声明；未改value import、构造/方法体、默认值或公共版本，无新增FR。
200–202全计划未执行；顶层逐文件映射不等于nested owner或完整类型/私有/消费者/fixture/
资产图通过，旧alias尚不可删除，最终冻结修订及地基/并行/物理/发布门禁仍未完成。

2026-10-19继续A5资产源码收口：contract-assets-source-map-v1.md逐项连接21个schema的
ID/本地引用/TS加载/Go嵌入与生成或手写归属，记录adp3execution的类型/输出与adp3
双schema消费区别、原Transit检查三种不同换行比较，以及catalog元数据和原三个编译
provider的真实绑定。Contracts README已纠正ADP2-only描述，按现有11条exports说明
三个L1公共事实与其余native入口；未改parser/schema/导出/生成器/版本。197–199全部
计划未执行；引用声明读取不证明local target编译、copy字节/类型等价或实际模块加载。
其他逐leaf/type/private/default/consumer/fixture/依赖/冻结修订及接受工作仍需完成。

2026-10-19新增A5候选审查索引foundation-candidate-index-v1.md：连接实际独立公共版本、
具名消费者、包/锁/SQL/schema/catalog/部署/示例资产和dirty增删范围，记录原平台文件
删除后的真实native替代与旧wrapper。索引不是完整依赖manifest或冻结修订；未将旧HEAD
当成当前源码。root tsconfig遗漏examples、test:web固定旧JS列表与旧VM/boundary覆盖
待集中阶段适配，当前不改不运行验收工具。192–196全计划未执行；完整逐leaf/type/
private/default/consumer/移除条件/递归资产收口与最终冻结候选仍开放，地基接受和上层
并行门禁保持关闭。公开preview示例、实时Echo v4、Responder镜像与独立物理/发布门禁
各自保留范围，不能互相作为通过证据。本片仅文档源码读写，无运行契约/版本变化。

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

Agent CLI 新增源码切片为 L3 agentcommand1/L2 agentcli1：原参数依赖、模式、运行锁与
Runner 接线归 owner，原 global flags/path/proof/inspect/enroll/entropy/signals 归 native。
旧 main/run/enrollment 与公开 Runner/enrollment/state 保留；不改 L0/L1 既有契约。
Control 离线 plan 直接消费公开 compiler/facts。150–152 计划未执行；Control startup/
client/server/ops/MySQL、native engines/wire/default/消费者和完整候选仍需继续，
不能以 CLI 单链迁移关闭 A4/A5 或打开验证/接受门禁。

FR-0015 已编写 Agent observation 格式/Host family：runtimeobservation2 generic/
tagless Host、native platformobservation2 和 observationwire1；原四家族 DTO/
编码/ACK/body/计数器格式归 L2，原采样/保留/游标/预算/worker/关闭仍归 owner。
UDP 具体类型诊断归原生 Instance adapter；旧 aliases/defaults 保留，generic/
反射/直接下层序列化消费者须迁移。147–149 计划未执行；不据此关闭完整 Agent/
Control/CLI/default/private/type/消费者/冻结候选和后续验证接受门禁。

FR-0014 已编写离线 Transit 的 prepared Activate/Close1 与 native adapter1，
旧 driver HostVersion1、构造真实类型/默认值及授权/Journal/保存先于 engine/
phase/close 顺序保留。原生 identity/JSON/engine/error/time 操作归入已公开 L2；
nil interface/部分失败关闭与 JSON 单独错误路径保留，未接入 Run/poll/driver。
144–146 计划未执行；原 Forward/Relay/native contracts 债务和完整 A5/冻结接受
仍需继续，离线原型不因分层成为生产执行能力。

FR-0013 已编写 Journal facts/native 表示分离：executionstate3 去除 RawMessage/
JSON tags/native 协议与 Transit 字段名；state 保留原 JSON 记录，显式转换接齐
store/wrapper/Bootstrap/Runner。Bootstrap/provider2，lower/native 类型身份不再
相同，直接赋值/序列化消费者须迁移。141–143 计划未执行；完整全仓/CLI/default/
消费者/冻结候选及后续验证接受仍未完成，不以单条类型链迁移替代完整 A5。

FR-0012 已编写 executionstate2：原协议/物理 slot 表示由现有 codec 提供，原
state/Runner/Transit 共用 native key/envelope，drain tuple 与 URL/path 回原生
owner；原锁/高水位/持久化先于执行及 ACK/尾计数保留。138–140 计划未执行。
下层 Journal RawMessage/JSON tags/metadata 等已明确列入下一源码债务；完整
Agent/engine/default/CLI/private/消费者/冻结候选与后续接受仍未完成。

任务 owner 是现有地基任务；主代理负责整体集成，各子切片保持原业务与存储 owner。
消费现有 L1 端口和 L2 adapter，优先注入现有实现。逐条记录
“公共入口 → 规则/协调 → 端口 → adapter → 原 owner 状态”，包括错误路径、事务、
平台/codec、兼容入口和边界分类。替换单个私有 import 不等于整个 owner 已关闭。

| 顺序与结果包 | owner 与公共接口复用 | 产物与源码退出标准 | 本包不包含 |
| --- | --- | --- | --- |
| A1 Control Probe，源码切片已编写、未接受 | 原 Probe 实例、资格和许可 owner；现有 instance/permit APIs、Probe 存储端口及公开 L2 codec | 先收尾 qualification codec，再收口实例时钟、资格 owner/SQL、Forward Probe 格式与 owner 依赖；原入口精确转接，事务与拒绝顺序明确，readiness 记录新增验收病例与剩余依赖 | 新 Probe 产品能力、wire/schema/授权语义改变、宣布整个 Probe 已接受 |
| A2 Control 其他混合实现，当前其他 application/HTTP 及 A1 残余 source extraction | 原 Path/Ingress/Transit owner；其公共 API、Runtime/Forward 公开服务及已抽出存储契约 | 按 Path、Ingress、Transit 和剩余混合 owner 的调用链顺序，归属应用协调/私有 helper/存储，移出私有跨 owner 依赖；记录原事务与补偿条件 | 新自动选路、全局原子批次、跨 owner 直接写表 |
| A3 Agent Probe/native，native address/echo/format/default 源码片已编写未验收 | 原 Probe executor/Gate/counter 与 authority；既有 scheduler/entropy/dialer、实例与许可接口 | 地址、wire、echo、原生默认绑定各有明确归属；旧入口绑定同一实现，保留全局预算、当前实例与硬截止规则 | 第二套 Probe 状态或放宽授权/租约，物理主机验收声明 |
| A4 Runner 执行兼容/wire，wire/assignment/catalog 源码片已编写未验收 | 原 Runner、executionhost、engine、authority/Journal；已有公开执行与生命周期契约 | 继续分离私有执行 adapter、native engine/wire、CLI 组合；旧构造兼容与部分启动清理/stop/drain/恢复保持可追踪 | 新 driver、任意 shell、通过改身份或清空历史恢复 |
| A5 全仓分类与冻结候选（源码记录已闭合） | 原各 owner；foundation-layers、boundaries 和已声明 public entrypoints | 逐项源码/type/private/default/consumer/asset归属及候选版本/移除条件已接入foundation-a5-source-closure-v1.md；readiness1-220未执行，实际保存/冻结修订与B仍待后续授权 | 在源码阶段运行边界工具、整体包豁免、仅凭分类文档宣称合规 |

A1–A5 的退出仅表示各包“源码收口候选”。发现不在本包的混合依赖时记录并指向
后续 owner；发现未分类依赖先归属，不延伸为隐式例外。A5 整合后的源码仍未验收。
任何尚未关闭的已知依赖都必须显式列入冻结阻塞项，不能用文档排除代替处理。

## 3. 阶段 B：冻结候选与集中验收

进入条件是 A 的源码闭环及可审查候选齐备，且获得后续验证授权。owner 为地基
集成与各契约 owner；复用现有验收矩阵、公开扩展示例和 readiness，不建设平行测试体系。

产物依次为：

1. 准确标识完整冻结源码。当前 dirty HEAD 不能单独标识全部内容；后续获授权保存
   修订后记录实际 SHA，关联当时公共版本、兼容桥与未解决门槛。
2. 将 readiness 现有 **47 组计划**与 A 新切片的具体病例逐项映射；用计划、已执行、
   通过、失败、未验证分别记账。新增病例可以补充原组，不以组数增加冒充完成度。
3. 授权后适配边界工具，覆盖 source/type imports、private subpaths、未分类文件；
   验证旧入口和新 provider 的等价性、原事务/锁/错误次序及拒绝路径。
4. 真实功能、MySQL、网络、容器与浏览器证据在 GitHub Actions 取得；同一冻结
   修订运行契约与公开最小例子。修复若改变源码，重新关联受影响检查和最终证据，
   不把不同修订的历史绿灯拼成一次通过。
5. 明确可接受的公共版本与适用范围，记录尚未满足的独立物理多主机、长时间波动、
   发行和生产门槛。主机不可用则保持未验证，同机 namespace/hosted CI 不替代。

退出标准是文档化接口、对应修订的契约验收通过、公开例子可用，以及所声明模块
开发范围内的阻塞项关闭。可对满足条件的有限范围记录门禁，但不得将范围内通过
扩大成生产执行或全部物理场景通过。源码编写、接受、合并、镜像发布、发行与生产
就绪分别记录；B 不包含产品新功能、自动提交/推送/发布或未按 FR 记录和迁移的公共契约变更。

## 4. 阶段 C：状态、能力、指标与运维的纵向切片

进入条件是 B 的相应公共接口与模块门禁通过。每包先读当前契约与消费者，再交付
从原 owner 读模型到界面/操作说明的可审查切片；DTO 有缺口先列来源与字段，不
编造事实。需要冻结契约变更时走 FR。以下均为 planned。

| 顺序 | owner 与公共接口复用 | 结果包及退出标准 | 本包不包含 |
| --- | --- | --- | --- |
| C1 / FXR-01 状态解释 | L3 Console/Web、ForwardDiagnostics、Operation、Ingress 公共 API | 先列表摘要与节点下钻，再详情/批次一致说明；显示来源、更新时间、partial/stale/unknown、历史 Operation 和 cleanup pending。验证重复身份、旧结果覆盖、权限裁剪、断线与迟到响应；202/Accepted、Applied、Listener ready 和独立 Probe 结论分别展示 | 新状态权威、把运行数量当端到端健康、未获证据的乐观成功 |
| C2 / FXR-02 能力预检 | L3 NativeDrivers/Node 与原 capability/codec owners | 逐节点、平台/协议/角色/flag/facts 时效展示 supported/unsupported/unknown 和原因；服务端保持独立拒绝。覆盖旧 Agent、部分不支持、权限和预检后变化，失败不动现有实例 | 预检授权执行、默认新增 wire、无实际引擎需要的工具发现 |
| C3 / FXR-03 指标可解释性 | 原 telemetry/Probe history/rollup 读模型与 Web | 按 Node/Host/Forward/Probe 四族逐片展示来源、观察起点、窗口、epoch/gap/coverage/loss/stale；验证精确 uint64、基线、重发乱序、重置、拓扑/实例变化、缺测、rollback、Scope 与有界查询 | 新指标数据库、图表点数当统计分母、缺测生成零、混淆尝试失败率与网络丢包 |
| C4 / FXR-04 运维闭环 | 原 ops、AuthorityStore、Journal、安全恢复 owners；L3 导航 | 从只读 status/diagnose/数据库故障说明到脱敏支持包，再连接既有 assess-upgrade、维护、备份/恢复/review。验证数据库不可达、缺备份/旧 reader/部分迁移/受保护状态损坏保持原拒绝 | 新 root 安装脚本、远程在线升级、清历史或换身份绕过保护、暴露凭据与原始 SQL |

默认 C1 → C2 → C3 → C4。若共享只读 DTO 必须先补才能显示真实事实，可先做该
依赖的最小切片并记录缘由；不能因此同时展开协议、执行授权、数据库和自动策略。
每包退出还需要对应修订的合同/功能证据和公开集成说明，不能只交 UI 文件。

## 5. 阶段 D：负载优化与固定拓扑/人工切换

| 顺序 | owner 与公共接口复用 | 产物与退出标准 | 本包不包含 |
| --- | --- | --- | --- |
| D1 / FXR-05 有证据的调度优化 | 现有 L1 BackgroundTasks/生命周期、L2 telemetry admission/通道、L3 触发策略 | 先取得授权的观察池、周期任务、页面请求负载基线；若现有能力足够，交付不新增机制的结论。确有瓶颈才设计按 key 合并/有界唤醒与慢消费者处理，分别约束活跃数、等待 key/字节数、过期/取消/合并/公平性/关闭；验证饱和、丢通知、重连、事务失败、清理和内存上界 | 没有负载证据的新事件平台；通知续租、绕过周期对账、进程内锁替代跨实例权威、统一重放副作用 |
| D2 / FXR-06 固定拓扑与显式切换 | 原 Path/Ingress/Forward/Runtime owner 的 preview/publish/Operation/补偿公共 API | 固定拓扑与入口批次先获验收，再展示精确引用/分支、逐项结果与人工切换。覆盖 CAS、部分失败、成员撤销、旧计划、监听冲突、条件补偿失效、恢复隔离、重复请求与租约截止；独立记录物理多主机场景 | 自动故障转移、全局原子承诺、替代分支串联、分段耗时和标为真实端到端 |

D1 先评估，D2 默认随后推进。D2 的依赖是固定路径/入口契约验收，不要求为它
强行建设 D1 新机制；D1 没有明确收益时可以记录结论后直接进入 D2。所有新增 L1
公共能力按冻结契约治理，公共语义变更先 FR。

## 6. 阶段 E：另立项的自动策略与外部能力

owner 为拟议产品模块及原安全/执行 owners；复用已接受的 Path/Ingress/Runtime、
executionhost 和 L2 adapter 扩展点。进入前提交独立范围与 FR（如适用），明确人类
确认的目标、收益和验收环境。本方案仅保留路线，未选择兼容协议、driver 或导入器。

- 自动策略：先定义观测身份与有效性、失败/恢复窗口、迟滞、冷却、人工锁定、旧
  决策作废、并发控制和重启恢复，再讨论实现；人工切换通过不能代替自动策略验收。
- FXR-07：先明确命名兼容目标及版本。外部格式只读有界预览先行，实际写入走原
  L3 命令；新 driver 声明平台/协议、硬截止、partial-start cleanup、stop/drain、
  指标和恢复。未知版本/字段、超限、端口冲突、可变别名、false/省略等拒绝发生在
  改变工作实例前。不能满足受控执行要求则不暴露该能力。

产物是另行批准的设计/验收包与适配实现，退出需其自己的功能、可靠性、发布及
物理环境证据。不包含自动承诺 FXP V3、任意第三方引擎、任意 shell 或普适兼容。

## 7. 并行开发与集成方式

当前处于同一地基任务，可以由子代理分别做不重叠的 owner/文件切片。分工前声明
读写范围和消费契约；代理只在获分配文件中编辑，共享修改由主代理串行集成。
shared exports、composition roots、共享 readiness/boundaries/index 文档默认由主代理
串行集成。主代理也可显式指定某一文件的唯一子代理写方，并在其回报前不编辑该
范围；子代理回报集成需求，避免争写。读到其他已声明子任务的修改是预期协作；
出现无法归属的并发修改则停止相关编辑并询问。主代理保留原 dirty 工作，不为
制造分支而提交、切换、丢弃或复制地基。

依赖同一公共契约的子任务先固定本轮候选形状；若它发生变化，主代理通知受影响
代理并先处理依赖，不让多个实现各自猜测。并行加速源码收口，不把尚关闭的上层
模块门禁提前打开。B 通过以后，每个独立新模块才使用独立分支/worktree、模块
目录、public entrypoint、合同测试和集成说明；共享组合文件留到集成阶段处理。

## 8. 每包交付与当前启动点

每包记录 ID、owner、文件/入口范围、公共契约候选、兼容桥、源码修订与 dirty
状态、已编写内容、剩余依赖、计划/已执行验收、证据链接、接受/合并/发行状态。
当前不能冻结完整源码时明确标为 dirty 候选，不能只引用基础 HEAD 代表所有编辑。

当前交付点是 **A5 源码分类闭合、可审查候选记录齐备**，详见
foundation-a5-source-closure-v1.md。原 A1 Probe 和后续 owner/native 切片记录保留为
历史；不再从早期未闭合列表重复迁移。下一阶段是取得后续授权后保存完整准确修订并
进行 B 集中验收及原工具适配。当前 B 未执行，C–E 未实施，地基未接受，独立上层
模块门禁仍关闭；源码子代理协作不打开这些门禁。


2026-10-19 A1 第二片：三个证据 reader 已消费下层公共契约，Forward Probe 原生效果改用公共 L2。readiness item 49 未执行；permit 持久化与其余混合 owner 仍开放。这是源码进展，不是 A1 或地基验收完成。

2026-10-19 A1 第三片：permit/withdrawal/result 原 SQL 下移到一个 L2 store，
L1 定义持久化端口，原产品解码/验证规则由 L3 同步注入；原装配与恢复明确使用
下层实现，旧零参类/方法/子类覆盖/静态恢复路径保留。item 50 未执行。其余
Probe/private/wire、A2–A5 与全仓分类仍开放；阶段 B–E 和地基接受状态不变。

2026-10-19 A1 fourth source slice: original Probe shared rules and storage values
now live behind its owner public entry; observation references/config/trust and
metadata values have their own public owner and explicit declaration read port.
Original application coordination and SQL/state owners remain, and old helper/value
exports directly alias the same implementation. Full entry/rules/port/adapter/state
chains and compatibility entries are recorded in probe-owner-collaboration-v1.md.
Item 51 is unexecuted. Direct wire types, remaining native/default dependencies and
A2-A5 stay open; A1 and foundation acceptance and stages B-E are unchanged.

2026-10-19 A1 fifth slice: the human explicitly authorized restoring the interrupted
codec and continuing. The restored path is a direct export of the existing single
native implementation. Original result dispatch, stored checks and three ACK
projections use public L2 functions; business authority and freshness/transaction
ordering remain with the original owners. Readiness item 52 is planned only. A1
and stages A2-A5 remain incomplete; B-E and the upper-module gate are not opened.
Current task limits still prohibit verification, delegation, commits and pushes.
2026-10-19 A1 sixth source slice: Probe machine negotiation, instance, claim,
delivery, typed and service ACK formatting now uses a single public L2 codec.
Adapters retain input parsing, mTLS/current-owner checks, freshness, deadlines,
commit order and response-time sampling; item 53 is unexecuted. No protocol,
issuer, execution feature or echo ACK is added. Remaining wire/native/default,
A2-A5 and full classification remain open.


2026-10-19 A2 first slice, source authored and unverified: original PathTemplate
parser, requirements, limits and head/revision checks have one public Path owner.
PathBindings, PathGroups and IngressGroups consume its public rules rather than
private template application helpers. Old exports remain direct aliases; template
coordinators reuse public pagination/digest/ISO/default-clock helpers at original
call points. Item 54 is unexecuted. SQL storage and other Path/Ingress/Transit owners
still need source work. Entering A2 neither accepts A1 nor exempts its remaining
dependencies from the full foundation freeze. No verification, CI or Git writes.

2026-10-19 A2 second source slice: original template persistence now has L1
parameterized records/ports and one L2 MySqlPathTemplateStore. Control binds the
lower store explicitly; MySqlPathTemplates retains its zero-argument public methods
as precise compatibility entries without copied SQL. Raw JSON and Boolean mapping,
Scope/head locks, prefix paging and publish/archive/audit order remain source-intent
equivalent, not verified. Readiness item 55 is unexecuted. Other Path/Ingress/Transit
owners, A1 residuals and A3-A5 remain open; no B-E or upper-module gate is opened.

2026-10-19 A2 third source slice: original PathBinding selection/expansion rules
now have a public Path owner, lower L1 records/ports and one L2 provenance store.
Control explicitly supplies that store to the existing Path/Group collaborators;
old parser exports and zero-argument methods remain precise compatibility entries.
The original Forward transaction/lock, sequence conversion and 64-entry invariant,
immutable history/current pointer and non-authorizing previews are preserved in
source intent. Complete command/read chains and remaining SQL debt are recorded;
readiness item 56 is unexecuted. A1 residuals, remaining A2 owners and A3-A5 stay
open. This is not a frozen/tested revision, B-E implementation or gate acceptance.

2026-10-19 A2 fourth source slice: shared PathGroup rules, lower parameterized
metadata contracts and original provenance contracts now have explicit owners.
One L2 file owns both original SQL implementations; Control binds them and old
zero-argument classes preserve public async methods plus lazy this.count overrides.
Original Scope/head/Forward lock order, quota/CAS differences, group-history LIMIT
64 and exact original Path provenance remain source-intended unchanged. Item 57
is unexecuted. Publication/Ingress/Transit, A1 residuals, Agent/native/Runner and
full-source classification remain open; no A2/foundation or phase B-E acceptance.

2026-10-19 A2 fifth source slice: original publication parsers/limits/rejection Set
now have one public Path owner, and lower parameterized Plan/Outcome ports serve
one SQL/savepoint store. Control binds original business refusal values explicitly;
the zero-argument legacy store retains lazy count/event methods. Classification
precedes rollback and failure projection follows release, with original unknown/
retryable/savepoint failures escaping. Item 58 is unexecuted. Conditional compensation,
outer transaction and non-atomic per-Forward acceptance remain original; Ingress/
Transit, A1 residuals, Agent/Runner and full classification stay open. No gate opens.

2026-10-19 A2 sixth source slice: a dedicated Ingress public owner now holds the
original shared group/selection/input/plan rules, with direct legacy aliases.
Parameterized lower group storage preserves one original SQL implementation,
explicit Control assembly and lazy count overrides for the old zero-argument class.
Distinct ingress Nodes, actor-dependent member checks, resolver ordering, original
Scope/head quota/CAS/audit and helper timing remain source-intended unchanged.
Readiness item 59 is unexecuted; deployment/migration/Transit, A1 residuals, Agent/
Runner and full-source classification stay open. No acceptance gate is opened.


2026-10-19 A2 seventh source slice: original ingress deployment persistence now
uses parameterized Plan/Outcome ports and one lower SQL/savepoint store. Control
binds original public refusal values; legacy zero-argument count/event dispatch,
filtered direct COUNT, LIMIT 16 and revision<20 remain source-intended unchanged.
Origin/lineage/migration rules moved together behind the Ingress public entry to
avoid duplicating their private helpers. Item 60 is unexecuted. Original creation,
conditional deletion and historical-origin semantics remain; migration SQL and
coordination, Transit, A1 residuals, Agent/Runner and full classification stay open.
No foundation/upper-module or phase B-E acceptance is claimed.

2026-10-19 A2 eighth source slice, authored and unverified: IngressMigration uses
lower parameterized Plan/Outcome/Failure contracts and one original SQL/savepoint
store. Control binds the original public refusal provider and existing origin,
group and Forward owners. Legacy zero-argument methods preserve lazy count/event
hooks; same-group coherence still precedes quota dispatch, filtered COUNT stays
direct, and original LIMIT 16/revision<20/CAS/recovery semantics remain. Apply and
compensation retain distinct add/update/remove behavior; remove is irreversible.
Readiness item 61 is planned only. Transit, A1 residuals, Agent/native, Runner and
whole-source classification remain open. No checks/tests/builds/experiments/CI,
commits/pushes or delegation ran; A2/foundation and upper-module gates stay closed.


2026-10-19 A2 ninth source slice, authored and unverified: contract-only Transit
negotiation now uses a public product owner, a required raw machine-session lock
reader and one original SQL implementation. Raw numeric/null evidence and deferred
facts decoding retain original refusal order, FOR UPDATE and one dynamic clock
sample. The pure ACK formatter retains the same capability tuple, mutable response
and executionEnabled:false. Old one-argument construction/hello and API aliases
remain precise entries; Control assembles explicit providers. Item 62 is planned
only. Delivery/staging/coordination/reservations/preparation, A1 residuals, Agent/
native, Runner and full classification remain open. No verification, CI, Git writes
or delegation ran; no foundation, upper-module or phase B-E acceptance is claimed.

2026-10-19 A2 tenth source slice, authored and unverified after explicit human
continuation: original preview delivery now uses public TransitPreviewDelivery,
required raw lower storage and the existing peek-only offline planner. One SQL
store owns outbox/receipt queries and writes; the old one-argument class retains
its own methods and lazy db/planner dispatch. Enqueue keeps its two original
transactions, poll its LIMIT 16 and per-row clock, and report its current-machine
before duplicate/high-water/freshness/CAS ordering. ACK never calls confirm or
grants execution. Shared retained-stage validation, preparation/coordination types
and offline step use public owner contracts. The restored coordination-step path
directly exports the existing coordination-values implementation, without copying
or deleting it. Item 63 is unexecuted. Staging/coordination SQL, preparation and
reservations, A1 residuals, Agent/native, Runner and full classification remain
open. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran; no gate opens.

2026-10-19 A2 eleventh source slice, authored and unverified: the location inventory
corrected the assistant's wrong src/runtime lookup; all seven Transit entries were
already under modules/runtime and needed no recovery. Original offline coordination
now has a public TransitCoordinationService, required raw lower storage and one
original SQL store. The old single-argument journal keeps its own public async
methods and lazy db dispatch; Control binds explicit providers. Actor/stage checks,
sorted sessions/physical ownership, proof-before-transition, exact revision/digest
CAS, two distinct begin timestamps and withdrawal-only recovery remain source-
intended unchanged. No default verifier, confirmation route, live execution or
reservation release is added. Item 64 is unexecuted. Staging/preparation/reservations,
A1 residuals, Agent/native, Runner and full classification stay open; no gate opens.
No checks/tests/builds/experiments/CI/commits/pushes or delegation ran.


2026-10-19 A2 twelfth/thirteenth source slices, authored and unverified: original
preparation/resource-set rules now live in the public Transit owner, consuming
public Profile/Endpoint contracts, L1 Node facts and pure L2 format providers. Old
compile/type/validation entries directly alias the same implementations. Exclusive
reservation now delegates to the same Runtime resource owner through required raw
transactional storage and a late capacity provider. The existing MySQL resource
store reuses ensureSlot/assignSlot and retains exact original Node/minimal-slot/raw
count projections. It rejects even same-Forward owners; reserveRelay is unchanged.
The old reservation function binds the original dynamic DEFAULT_POLICY and creates
no pool, transaction or second ledger. Items 65/66 are planned only. Staging/abort
SQL and protected release, A1 residuals, Agent/native, Runner and full classification
remain open. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran; no
foundation, upper-module or phase B-E gate opens.

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
