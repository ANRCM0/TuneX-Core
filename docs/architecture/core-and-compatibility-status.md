# Core 与兼容接入层现状

日期：2026-10-17（Asia/Shanghai）。
初次盘点源码基线：`03513a941177afcb84a5a1e6eab025c830d63300`。
性质：**现状盘点与待决策清单，不是新协议或模块接口的 Accepted ADR**。
后续工作树已有 Agent、Control 查询/解析、授权/Forward 写用例、快照来源、被动观察、
主动探测基础、只读机器协商、远程登记生命周期、内部许可权威、单次领取回执与消费后撤销，
以及有界任务获取/状态协议、Agent 内部观察监视器和结果接收，见第 8–25 节及 ADR-0006 至 ADR-0016；
本文区分该增量与初次盘点，不宣布功能验收或正式冻结完成。

## 1. 结论与术语

原目标是“极简领域内核 + 统一兼容接入契约 + 可组合功能模块”。
当前状态是：

- **Core v1 的最小领域实现齐备**，可作为冻结候选保护，不继续吸收具体功能。
- **协议与状态兼容底座已有实现**，并非没有兼容层。
- **统一模块接入框架尚未完成**；Agent 原生驱动已有内部静态注册，
  Console 查询、Transport 锁版解析、Profile、成员/Node Grant、整节点管理、Forward
  和静态快照来源已有端口适配；观察类已有被动来源与主动 Probe 预检/内部执行器，
  只读机器协商、内部防重放门禁、远程登记生命周期、内部许可签发/消费/预算及不可执行远程领取也已编写，
  有界结果接收已编写，远程 Probe 执行闭环及其他 API 读写仍待收口。
- **Runtime 是必要宿主而不是领域 Core**。统一执行台账与 Journal 应保留，
  不能把它们拆成每个模块各自签发授权、占用端口的系统。

“兼容”分为两件事：一是跨版本/跨语言消息和持久状态的可理解、可拒绝；
二是模块接入宿主的稳定契约。已有前者不代表后者完成。
它不表示兼容旧 V2、任意第三方线协议或允许动态执行外部插件。
不要求建立一个包办所有业务的 `CompatibilityManager`，也不要求改成微服务。

## 2. Core 的实际边界

规范依据：[Core v1](../spec/core-v1.md)、
[Forward v1](../spec/forward-v1.md)、
[模块边界](module-boundaries.md)。

| 项目 | 现有实现 | 状态与边界 |
| --- | --- | --- |
| 实体 | `Node`、`Forward` | 已实现；Node 只有身份/归属/修订，不含心跳、密钥与安装 |
| 意图及值对象 | `ForwardSpec`、Listen/Target、Path、TransportRef | 已实现；固定单入口/单目标、TCP/UDP、可选有序路径与锁版引用 |
| 基础原语 | ID、端口、安全整数、IP/主机名规范化 | 已实现；不做 DNS 查询、bind 或目标访问授权 |
| 输入边界 | `parseForwardSpec`、`parseNode`、`parseForward` | 已实现；拒绝未知管理字段，输出脱离调用方对象并深冻结 |
| 纯验证与变更 | `validateForwardSpec`、`decideForwardChange` | 已实现；CAS 决策、无变化不递增、耗尽拒绝；真正原子写由数据库负责 |
| 依赖隔离 | Core 包无运行时依赖，源码只引用自身 | 当前保持；没有 HTTP、MySQL、文件系统、证书、socket 和驱动执行 |
| 专门测试 | `packages/core/test/forward.test.ts` 的 13 项测试 | 用例已存在；本轮只读盘点，不执行本地功能测试或重新宣称 exact-SHA CI 通过 |

源码入口：[公开导出](../../packages/core/src/index.ts)、
[模型](../../packages/core/src/types.ts)、
[解析与变更](../../packages/core/src/forward.ts)、
[原语](../../packages/core/src/primitives.ts)。

Core 不负责 Node 是否存在、Profile 是否授权、端口是否空闲、节点是否在线、
驱动选择、路径调度、Deployment/Operation、恢复、Probe 或统计。
Core 的 `path.via` 不代表智能路由；具体 3–8 节点执行上限在外层契约中校验。
`TransportRef` 不是直接把完整引擎配置和密钥塞进 Core。

**完成口径**：原定最小 API 与规则的实现范围齐备，不表示形式化正确性证明、
正式冻结签署或完整平台生产就绪。新增驱动不应被当作继续开发 Core 的理由。

## 3. 已有协议与状态兼容底座

### 3.1 各种“版本”不能混为一谈

| 维度 | 当前值/形式 | 含义 |
| --- | --- | --- |
| 领域规范 | Core/Forward v1 | 意图形状及基础规则，不是机器协议版本 |
| 包版本 | `@tunex/core` / `@tunex/contracts` 为 `0.1.0` | 包元数据，不能推断数据库或 Agent 可兼容 |
| 用户 API | `/api/v1/...` | HTTP 管理接口，不是 ADP/1 |
| 当前在线机器协议 | ADP/3、`/agent/v3/*` | Control/Agent Hello、Snapshot、Report |
| 执行扩展 | `executionExtension: 1` | 完整混合 Snapshot 的多跳扩展，不是另开一个执行权威 |
| 原生驱动 | `native.direct.v1`、`native.relay.v1`、`native.multihop.v1` | 具体执行语义；不是任意可加载的驱动名 |
| Relay/多跳线协议 | `relay.wire.1`、`multihop.wire.1` | 相邻数据面能力；与业务 TCP/UDP 分开 |
| Profile revision | `configRevision` | 特定不可变配置修订，不等于驱动或 ADP 版本 |
| 升级兼容 Profile | `adp3-runtime-v1`、`adp3-multihop-v1`、Control-only `adp3-probe-registry-v1` | 显式 Schema/Journal 兼容范围，不由版本字符串大小推断 |

### 3.2 现有机制及其限制

| 机制 | 已有代码/行为 | 不代表什么 |
| --- | --- | --- |
| TS 契约与校验 | `packages/contracts`；JSON Schema、语义校验、摘要、时间与大小限制 | 不是通用模块 SDK，也不是全部纯函数 |
| Go 契约 | 生成的部分 Go 类型/内嵌 Schema，加手写语义校验器 | 不是所有 TS 类型自动生成；跨语言一致性仍依赖 fixtures 与回归 |
| 生成与一致性检查 | `scripts/generate-go-contracts.mjs`、`contracts:check`、共享正反例 | 生成代码存在不等于当前版本运行矩阵已通过 |
| 在线能力协商 | Hello 声明 ADP、driver、wire、TCP/UDP；同 boot 能力不可变 | 能力不是 Membership/Grant、端口预留、有效租约或业务健康 |
| 旧版拒绝 | `/agent/v2/*` 拒绝；v3 严格解析；旧 Snapshot/Journal 拒绝 | 没有任意旧版本到新版的自动转换/迁移 |
| 执行扩展 | 多跳显式能力及选项；Direct/Relay/多跳共享 Snapshot 和 Journal | 不是独立 Transit Runner 获得了生产执行权 |
| 配置与执行绑定 | Profile/配置摘要、Session/Generation/Fence、peer 身份及租约 | 一个 digest 或收到 ACK 不等于可执行授权 |
| 升级评估 | `scripts/ops/upgrade.ts`、`upgrade-inspect.ts`，Agent `--inspect-journal` | 只读静态评估，不执行升级/恢复，也不证明备份和实际镜像身份 |

对应入口：
[ADP/3 TS](../../packages/contracts/src/adp3.ts)、
[ADP/3 Go](../../agent/internal/adp3/validate.go)、
[生成脚本](../../scripts/generate-go-contracts.mjs)、
[升级评估](../operations/upgrade-assessment.md)。

当前兼容矩阵的 Schema 上界分别是 `0012-transit-delivery.sql`、
`0013-multihop-execution.sql` 和 Control-only 的 `0014-probe-instances.sql`。
新增迁移需同步评估器与拒绝策略，不能只添加 SQL；Agent Profile/Journal 未因此新增版本。

`packages/contracts` 合理地依赖 Core、Ajv、canonicalize 和 Node 文件/加密能力；
它不是 Core，也不是可直接整体导入浏览器或所有宿主的零依赖 SDK。
其公开入口还包含 ADP/2 基础类型/校验器以及 Transit 实验契约。
ADP/3 实现复用部分旧校验函数、Direct 引擎复用旧内部结构，
不等于外部重新支持 ADP/2；外部仍先严格验证 v3。
后续应梳理“当前在线 / 历史内部复用 / 实验预览”导出入口，
但不能未经兼容检查删除仍被线上实现使用的内部代码。

## 4. 宿主与模块接入现状

### 4.1 已存在但尚未统一的接入点

| 位置 | 当前作用 | 完成度 |
| --- | --- | --- |
| `ControlApplication` | 装配授权查询、命令及既有 Runtime 宿主 | 已适配用例通过端口委托；装配仍绑定具体适配器，保留 Relay 预览与受限宿主方法 |
| `RuntimeLedger` / Controller | 接受 Operation、资源仲裁、发布快照、对账与退役 | 共同宿主已存在；不是缺一套新的执行框架 |
| 快照来源集合 | 构造器必选 collector → 静态 registry → Relay/多跳 reader；与 Direct 合并 | 已移除可变回调；声明/归属/冲突检查不替代授权及完整 ADP 校验，待对应 Actions |
| Profile 授权写用例 | `TransportGrantCommands<Tx>` → owner mutation / Runtime effects → 共同事务 | 已替换可变 `onGrantChange`；强制装配 effect，其他写用例未全部收口，待对应 Actions |
| 成员 / Node Grant 写用例 | `AccessCommands<Tx>` → Identity/Nodes owner ports → Runtime access effects | 原 Control 方法保留委托入口；与 Profile 共用受限宿主执行端口；待对应 Actions |
| 整节点策略 / 吊销写用例 | `NodeManagementCommands<Tx>` → Nodes owner port → Runtime Node effects | 保留管理权限、原执行主体、策略拒绝与凭据吊销差异；待对应 Actions |
| Forward 意图写用例 | `ForwardCommands<Tx>` → Forwarding owner / Runtime Operation / native preparation ports | 创建、更新、删除、重试的旧入口均委托；保留各自授权、资源和重放规则；待对应 Actions |
| `Transport` | 不可变 Profile、修订、授权和解析；Runtime 通过 `TransportProfileResolver<Tx>` 消费解析 | 配置仍固定为 `RelayProfileConfig`，不是通用 driver descriptor registry |
| Agent `execution` interface | `Close/Drain/Remaining/SetAuthorization` 的共同运行对象 | 局部执行抽象已存在，不应说“完全没有接口” |
| Agent 原生驱动注册 | `execution_drivers.go` 声明能力、角色、阶段、Schema 及开关；Runner 调用已选适配器 | 首批内部静态 factory 与阶段处理已编写；不是公共插件 SDK，待对应 Actions |
| MySQL UnitOfWork | 实现 `TransactionBoundary<Tx>`；授权查询及已适配写用例共用事务 | 现有实际 `Transaction` 仍为 mysql2 `PoolConnection`，不是全系统存储抽象 |
| Console 查询 | HTTP 解析 → `ConsoleQueries<Tx>` 授权 → `ConsoleReadPort<Tx>` → MySQL 只读投影 | 六类查询已适配；其他 API 读路径与写用例尚未全部端口化 |

源码：
[应用装配](../../apps/control/src/application/control.ts)、
[台账](../../apps/control/src/modules/runtime/ledger.ts)、
[Transport](../../apps/control/src/modules/transport.ts)、
[Agent Runner](../../agent/internal/control/runner.go)、
[驱动注册](../../agent/internal/control/execution_drivers.go)、
[事务适配器](../../apps/control/src/infrastructure/mysql.ts)、
[Console 查询服务](../../apps/control/src/application/console-queries.ts)、
[Console MySQL 投影](../../apps/control/src/infrastructure/mysql-console-read.ts)、
[Transport 解析及写端口](../../apps/control/src/modules/transport-ports.ts)、
[Profile 授权应用用例](../../apps/control/src/application/transport-grants.ts)、
[Runtime 授权变化适配](../../apps/control/src/modules/runtime/profile-grants.ts)、
[成员 / Node Grant 应用用例](../../apps/control/src/application/access-commands.ts)、
[Runtime access 适配](../../apps/control/src/modules/runtime/access-changes.ts)、
[整节点管理应用用例](../../apps/control/src/application/node-management.ts)、
[Runtime Node 适配](../../apps/control/src/modules/runtime/node-changes.ts)、
[Forward 应用命令](../../apps/control/src/application/forward-commands.ts)、
[Forward 原生准备适配](../../apps/control/src/modules/runtime/forward-commands.ts)、
[快照来源契约](../../apps/control/src/modules/runtime/snapshot-assignment-ports.ts)、
[快照来源集合](../../apps/control/src/modules/runtime/snapshot-assignments.ts)。

### 4.2 真正缺少的统一契约

- 模块/驱动描述：Agent 已有 ID、Schema、角色、阶段、业务协议、能力和开关；
  跨 Control/Agent 的平台、权限、资源要求与宿主接口版本尚未统一。
- 确定性的静态装配/注册：Agent 已拒绝重复 ID、不完整声明和未知版本；
  Control 模块依赖、跨模块能力冲突规则仍需具体化。
- 分类扩展端口：Control 产品模块、数据面 driver、只读观察/Probe 不共用万能接口。
- 生命周期边界：校验/规划/准备/激活/排空/清理与失败结果的责任划分；
  禁用模块不能丢弃已有 lease、Journal 和退役清理责任。
- 宿主授权与资源端口：模块只能提出需求/方案，经 owner-owned 接口进入现有事务；
  不能自己签发授权、保有另一份台账或任意跨模块写表。
- 统一兼容声明：宿主接口、配置 Schema、driver 与 wire 各自的版本/拒绝规则；
  不能把当前能力字符串当作完整兼容矩阵。
- 接入合约验收：同类模块在相同测试套件下验证授权、到期停止、替换、失败清理、
  旧版拒绝和可关闭性，而不是只为每个新模块增加独立特殊用例。
- 架构门禁：补充应用/API/适配器依赖规则、参考源码隔离和经批准的例外清单。

这里的“缺少”不要求每模块独立数据库、动态插件加载或完整依赖注入框架。
多个模块可以共享 MySQL 事务，但必须调用数据所有者的命令/查询接口。
闭合集合 Schema 拒绝未知 driver 是现有安全边界，不是需要取消的障碍：
新增 driver 仍需明确契约变更、解析器注册、能力协商与版本化回归。

## 5. 当前依赖与目标依赖的差别

```text
当前：
Console HTTP ---> authorized query port ---> MySQL read projections
Other API reads ----------> concrete modules / MySQL (remaining)
         |
ControlApplication --------> concrete modules / Runtime / remaining hooks
         |
Profile / Access / Node / Forward commands ---> owner + Runtime ports
         |                         |
         +------> pure Core         +----> MySQL
                                   |
                          ADP/3 + capabilities
                                   |
                        Runner + static driver registry
                                   |
                           native execution objects

目标收口方向（尚未实现，不是新增中心管理器）：
API / CLI ---> application command/query ports
                    |
       modules ---> classified extension contracts
                    |
          existing authoritative Runtime
                    |
         versioned machine contracts
                    |
       Agent host ---> registered bounded drivers

pure Core 被应用/契约引用，始终不反向依赖上述层。
```

统一接入应减少重复宿主分支，而不是保证任何新功能都零改动：
新增执行语义可能仍需显式演进协议、Schema 和宿主能力，不能藏在不校验的 JSON 内。

## 6. 三个容易误判的地方

1. **离线 Transit 不等于第二个生产多跳系统。** 代码仍保留 staging、
   coordination、协商与预览投递；预览命令明确 `executionEnabled:false`，
   标准 Runner 不调用独立 TransitController 执行环。
   生产执行遵循 [ADR-0005](../decisions/0005-mixed-multihop-execution.md)，
   共用物理所有权与 Journal。后续分类实验入口，不自动接入或直接删除历史状态。
2. **有 13 项 Core 测试不等于整个平台验收完成。** 当前源码静态盘点、
   历史 verified 记录、当前 SHA 的 Actions 和物理部署证据必须分开。
   本轮未查询新 Actions 结果，也不从旧文档的待核验状态推断新版本失败。
3. **路径策略不应覆写用户意图。** 原规范规定 Routing 提供 `ResolvedPath`；
   自动变化若不改意图，只推进执行代次。用户手动替换固定路径仍是 Forward
   revision 变更。上一份四主线方案混淆这两种情况，本轮修正文档，不更改运行代码。

## 7. 后续边界与建议顺序

初次盘点提出以下顺序；后续首批实现见第 8 节，不创建空的 compatibility/module 包：

1. 核对并固定 Core 公开 API、不变量、测试与冻结口径；不增加新的业务实体。
2. 用 ADR 明确三类接入契约、状态所有权、版本维度和原生模块适配范围。
3. 首先适配已有 Direct/Relay/多跳，并抽取查询端口；
   维持共享事务、授权硬截止和统一 Runtime/Journal，不引入新驱动。
4. 增加架构规则及接入契约回归，功能测试仍只放 GitHub Actions；
   本地限于类型、语法、文档和依赖静态检查。
5. 以已有功能经过统一端口为接入框架的验收出口，再继续四条产品主线。

新框架的验收不能只看新增接口文件：同类能力应主要通过模块实现和显式装配接入，
原生规则仍可独立运行，禁用扩展不破坏既有清理，旧版/未知能力明确拒绝，
人工意图与执行解析不混淆，并有对应 SHA 的 Actions 证据。

## 8. 首批收口：Agent 内部原生驱动接入

决策见 [ADR-0006](../decisions/0006-classified-extension-contracts.md)。
工作树已将 Direct、Relay、多跳的声明、选择、启动、可选替换、
阶段处理及错误映射从 Runner 分离至静态注册和原生适配器。
Hello 能力与执行选择复用同一描述；严格 ADP 解析仍在注册选择之前。
Core、机器协议、数据库及 Journal 格式不变。

Runner 仍持有唯一的落盘、授权、Fence、对账、排空与恢复流程。
适配器输入不传 Runner/Journal/授权签发者，但仍是可信编译内代码，
不是隔离不可信插件的安全沙箱。后续查询/解析切片见第 9 节，
不能将本批记为整个统一兼容框架完成。

新增 `TestExecution*` 回归并接入 contracts 作业，保留既有 Go vet/race、
Direct/Relay 和 3/4/8 节点矩阵。本地仅静态检查；
本批对应提交的 Actions 尚未取得，不借用历史通过记录。

## 9. 第二批收口：Console 查询与 Transport 解析

Console 的 Node/Forward/Operation 列表、候选节点、概览及诊断查询已从 HTTP
文件拆为 `ConsoleQueries<Tx>` 与显式 `ConsoleReadPort<Tx>`。
HTTP 仅解析列表参数；服务校验非 HTTP 调用的分页、过滤及节点 ID，
再于同一事务内先检查 Scope，后调用投影。候选节点仍要求管理权限与显式 Grant。
MySQL 投影保留原有有界、脱敏、历史状态语义，不将状态查询变成独立探测。

Relay/多跳及离线 Transit 的 Profile 消费方改用
`TransportProfileResolver<Tx>`，不再依赖完整 `Transport` 类。
接口传入调用方事务、actor、scope、Profile ID 与锁定修订；
所有者继续检查授权、修订及摘要，不允许 fallback 或隐式读取最新修订。
`ResolvedProfile` 仍是原生 Relay 配置，不伪装成支持所有新隧道的通用配置。
离线 Transit 的类型适配不改变其不可执行性质。

应用查询服务和端口没有 MySQL/HTTP/完整 Control 依赖；
实际装配仍在 `ControlApplication`，MySQL 仍是当前存储实现。
本批当时未涉及写用例；Profile 授权变化随后按第 10 节接入，
其他 API 查询、写用例与 Runtime 协调端口仍未全部收口。
本批不改 Core、协议、数据库、Journal 或执行状态机。

新增应用端口回归与 Profile 拒绝路径回归，保留真实 SELECT-only MySQL/API 验收。
本地仅静态检查；对应提交的 Actions 仍待执行，不能从实现存在推断验收通过。

## 10. 第三批收口：Profile 授权写用例与 Runtime 撤权接入

Profile Grant 的 HTTP 路由已改走 `TransportGrantCommands<Tx>`，
移除 `Transport.onGrantChange` 这种装配后可变回调。
事务、Owner 授权、幂等记录、Transport 写入和 Runtime 效果均使用显式端口；
效果端口必须装配，不再允许应用服务缺少效果处理而静默接受变更。

应用用例在同一事务内依次完成 Owner 授权、幂等认领/重放、授权变更、
部署重评估和完整响应落库。Transport 的 `applyGrant` 仅是供可信应用装配调用的
事务内原语，保留 Owner 检查、锁定 CAS、授予对象的管理权限、修订上界及审计，
不另开事务、不写 Runtime 表；Forwarding 引用端口保留原来的共享锁。
它不是可绕过效果处理独立对外发布的完整用例。

`ProfileGrantReconciler<Tx>` 通过受限宿主端口调用既有 Node 锁、执行授权、
部署过渡、唯一 Operation 台账和全路径容量检查，不直接操作执行表。
撤权不启动部署或预留资源；恢复仍重检原执行主体权限，不能替 Owner/服务身份
绕过其他 Grant。禁用意图不进入部署过渡，跨 Scope 引用明确拒绝。

撤权接受仅停止后续续租/发布，旧租约硬截止和 drain/退役清理继续由现有宿主负责，
不会提前释放物理端口。恢复可推进 deployment generation，但不改 Forward 意图修订。
Core、Schema、线协议、数据库及 Journal 格式均未变。

新增 7 组端口回归及 3 项真实 MySQL 撤权/恢复/回滚回归，已接入 Actions。
本地仅类型、契约和架构/文档静态检查；没有对应提交的功能通过证据。
该批自身未收口其他写用例；成员/Node Grant 的后续适配见第 11 节，
不由此宣称整个统一框架完成。

## 11. 第四批收口：成员与 Node Grant 授权写用例

`AccessCommands<Tx>` 已接入既有 `ControlApplication.changeMember/changeNodeGrant`
入口；旧方法仅委托，API 与内部调用均进入相同应用用例，不留下另一套旧编排。
应用层依赖事务、Owner 授权、幂等、`MemberWriter<Tx>`、`NodeGrantWriter<Tx>`
和必选效果端口，不导入 MySQL、HTTP、完整 Identity/Nodes 或 Control。
所有者原有授权、Owner 保护、CAS、修订边界及审计 SQL 不变。

成员输入在第一次异步授权前复制；请求摘要与实际写入使用同一份值，
仍只把 token hash 纳入摘要，不记录原始 bearer token。
当前 Owner 授权在幂等重放前执行；写入、Runtime 效果和完整响应仍在同一事务提交。

`AccessChangeReconciler<Tx>` 与 Profile 适配器共用
`ForwardAuthorizationExecution<Tx>`，新增宿主方法限于节点列表、既有授权截止
和 scoped cleanup/capacity 校验，不暴露连接或新的执行权威。
两种权限变化保留不同规则：

- 成员：加锁后重读当前 Forward 与 authorizer，跳过已删除/转交的意图；
  恢复 manager 时重检执行授权，禁用意图不启动部署，但仍校验已允许意图的清理容量。
- Node Grant：只处理该主体在入口/中间节点上的引用，保留恢复时的宿主过渡和
  失败整笔回滚行为，不把失败静默当作恢复成功。
- 两者撤权不因快照容量不足被拒绝，不续期旧租约，也不提前释放资源。
  截止时间包含路径当前及历史节点，保留原有 5000 ms 安全余量。
- 成员无变化不产生执行工作且 cutoff 为 null；
  Node Grant 无变化仍校验节点，并报告该节点已有授权截止时间。

新增 11 组端口回归与 4 项真实 MySQL 回归，覆盖撤权/恢复、重放、无变化、
旧资源保留、响应落库后失败及恢复容量失败的跨所有者回滚，已接入 Actions。
本地仅静态检查；对应提交的功能结果仍待取得。
整节点策略/吊销随后按第 12 节单独处理凭据失效及 deny-intent 语义；
Forward 写用例、`additionalAssignments` 和 Probe/telemetry 仍未全部收口。

## 12. 第五批收口：整节点策略更新与凭据吊销

`ControlApplication.changeNode` 现为 `NodeManagementCommands<Tx>` 的委托入口，
既有 API 与内部调用共用同一路径。服务显式依赖事务、Scope 管理授权、幂等、
`NodeManagementWriter<Tx>` 和必选 Runtime 效果端口，不导入完整 Nodes、MySQL
或 HTTP。这里保留管理者可操作的规则，不能错误收紧成仅 Owner 可操作。
当前授权仍在幂等重放前检查；策略、凭据状态、执行效果、审计及完整响应在同一事务提交。

Nodes 保有事实与策略类型、原有 CAS、修订边界、凭据失效和安全审计。
策略验证原样移动到叶模块，保留既有类型/函数导出供调用方兼容使用。
应用服务在第一次 await 前校验封闭命令形状并复制、冻结嵌套策略数组，
防止摘要与实际写入看到不同的调用方输入；非 HTTP 调用也受这些检查约束。

`NodeChangeReconciler<Tx>` 通过引用查询与受限宿主端口使用既有台账：

- 策略重编译使用 Forward 原 authorizer，不由请求管理者接管执行授权。
  已启用且允许的意图才过渡并检查全路径容量；禁用意图不启动部署。
- 策略拒绝或原主体缺失时，保留 `denyIntent` 的失败撤回及 cleanup pending；
  策略写入还保留变更节点的最终容量检查。
- 整节点吊销作废机器与 Relay 两类凭据，接受撤回工作，但不走策略拒绝标记，
  也不因移除快照容量不足拒绝吊销；不是普通 Node Grant 撤权的别名。
- 已签发租约不被续期，物理资源不提前释放；截止包含当前及历史路径节点。
  审计保存原始时间戳，响应保留 5000 ms 余量；不承诺旧 socket 已立即关闭。
- 同 key 重放不新增操作/审计，新 key 重复吊销仍按原规则返回 202。
  策略修订不改 Forward 意图 revision，成功重编译可推进 deployment generation。

新增 10 组端口回归及 6 项真实 MySQL 回归，覆盖管理者/执行主体隔离、
策略拒绝与恢复、重叠凭据吊销、路径容量失败、响应落库后失败与凭据审计回滚，
并接入 Actions。本地仅静态检查；尚无对应提交的功能通过证据。
本批不改 Core、ADP/Schema、数据库或 Journal 格式。
Forward 写用例随后按第 13 节收口，再处理快照宿主接入，不宣布整个兼容接入框架完成。

## 13. 第六批收口：Forward 意图写用例与原生准备

原 `create/update/remove/retry` 均委托 `ForwardCommands<Tx>`，API 和内部调用
不保留另一份旧编排。应用层只依赖事务、Scope 授权、幂等、Forward owner、
Operation 命令、必选原生准备端口和显式 ID factory，不引用 MySQL、HTTP
或完整 Runtime/Nodes 实现。Core 仍只提供纯意图解析与变更判断。
Forwarding 保有原有 CAS、历史记录、authorizer 和删除标记 SQL；
RuntimeLedger 保有唯一 Operation、物理资源与 Fence 台账。

`ForwardCommandExecutor<Tx>` 通过 Node 授权、资源、Relay 及共用执行宿主端口
承接原生准备，不自行建立连接或发布 Snapshot。保留以下不同语义：

- 四个方法先检查当前 Scope 可见性再重放，新写入才要求管理权限。
  创建重放额外确认 scoped Forward 记录存在；不套用授权管理命令的重放前管理权限规则。
- 创建先验证 Direct 的启用投影，再预留并用真实 slots 再验证；
  Relay 保留排序后的节点授权/锁定、owner 插入后规划，禁用创建也按原规则规划。
- 无变化更新仍授权/验证，但不分配代次、重绑执行主体或新增 Operation。
  已变化的禁用 Direct 仍过渡资源；禁用 Relay 更新不新建部署计划。
- 入口节点迁移只允许既有恢复例外：意图处于 recovery suspension 且旧节点已吊销；
  不借重构开放普通在线节点迁移。
- 删除保留 Direct/Relay 不同锁路径、CAS、修订耗尽与清理容量检查；
  不能继承整节点凭据吊销“不受容量阻挡”的规则。
- 重试先定位源 Operation，再锁当前意图/路径和源操作；恢复失效、修订过时或非失败
  操作均拒绝。重试重新授权、保留源操作及 previous spec，推进执行代次而不改意图修订。

输入仍在第一次 await 前由 Core 解析为独立不可变值；
owner 写入、资源/Fence、部署计划、Operation 及完整幂等响应继续同事务提交或回滚。
不续期旧租约、不提前释放旧资源，不改 Core、ADP/Schema、数据库或 Journal 格式。
Control 仍负责具体装配、Relay 预览及共用受限宿主方法，并非所有 API 已端口化。

新增 14 组端口回归及 6 项真实 MySQL 回归，覆盖 Direct 生命周期、多跳更新/重试、
无变化授权、重放、资源保留及创建/更新/删除/重试跨表回滚，已接入 Actions。
本地仅静态检查，尚无对应提交的功能通过证据。
快照宿主接入随后按第 14 节收口，再处理独立观察类契约；
统一兼容接入框架和生产验收均未完成。

## 14. 第七批收口：不可变快照来源与统一合并

已移除公开可变的 `RuntimeLedger.additionalAssignments` 字段，改为构造器必选
`SnapshotAssignmentCollector<Tx>`，缺少装配会明确拒绝。
生产装配使用不可变 `SnapshotAssignmentRegistry<Tx>` 和原生
`RelayAssignmentSource<Tx>`，后者只消费窄 `RelayAssignmentReader<Tx>`。
Direct 仍由宿主生成；Relay/多跳来源即使默认关闭多跳也始终注册，
不能因关闭能力丢掉历史状态的撤回与退役责任。

来源集合构造时只验证声明并捕获 reader，不执行读取。
Control 的延迟 reader 仅在完整 Ledger/Relay 装配返回后访问 readonly coordinator，
不再需要装配后的回调赋值。Nodes 内部锁/截止辅助实例与离线恢复隔离显式装配
空集合，它们不承担发布，不把缺少生产来源静默当作空结果。

- 注册拒绝缺失/重复来源 ID、空声明、未知 driver/schema/role、重复归属及来源冒充 Direct。
  当前支持集合仍限于既有原生 v1，不由此放开任意驱动或动态插件。
- 收集在同一传入事务内按来源 ID 顺序执行；上下文和各批结果在后续 await 前分离，
  不修改来源持有的部署计划。其他节点、越界归属、重复 assignment/logical binding
  或物理 protocol/port 冲突均失败关闭，不静默丢弃来源。
- 有 Direct 和无 Direct 的分支共用 collector；容量检查和发布也共用同一合并路径。
  `includeAccepted` 仍仅允许容量计算看到 accepted 待执行工作，不授予其发布权限。
- 来源声明不是授权。现有 coordinator 继续检查原执行主体、Scope/Node/Profile、
  策略、peer 凭据、会话、部署与阶段；完整 ADP/config/session/fence/大小校验仍在编译器。
- 来源只返回 Assignment，不取得 Snapshot 发布、租约、Journal 或另一份台账。
  它是可信进程内契约，不是隔离恶意模块的沙箱。

RuntimeController 的发布顺序及租约/退役方法未变，Core、ADP/Schema、数据库和
Journal 格式未变。发布后段失败时 MySQL 回滚，但已持久化的独立 Authority
high-water 必须保留，不能为追求“整笔回滚”降低安全水位。

新增 10 组来源端口回归和 5 项真实 MySQL 回归，覆盖混合快照、accepted 可见性、
来源失败/冲突回滚、默认关闭后的撤回与旧资源保留、租约写入后失败及独立水位保留，
已接入 Actions。本地仅静态检查，尚无对应提交的功能通过证据。
独立观察随后按第 15 节接入首个被动来源；主动 Probe、
其他 API 读写、公共 SDK 稳定性及生产验收仍未完成。

## 15. 第八批收口：有界被动观察与独立来源

新增 `NodeObservations`、`AuthorizedNodeReportReader`、
`MySqlNodeObservationReader` 和纯结果归约器，生产 `ControlApplication`
显式装配并接入 `POST /api/v1/scopes/:scope/nodes/:id/observations`。
唯一支持 `persisted-agent-report` v1；不接收目标、端口或任意命令，
不是 Control 发包器，也不是独立主动 Probe 已完成。

- 复用 Scope viewer 的被动诊断权限，每次重新授权，在同一专用事务内限定 Scope/Node
  读取；仅 SELECT 有界报告元数据，不读取完整 Report，不写新的执行或观察记录。
- 独立预算为单进程 8 个在途、每 Actor/Scope-Node 各 1 个、Actor 结束后冷却 1 秒，
  预算表最多 256 项，单结果最多 4096 字节；默认/最大期限 2 秒。
- 超时或取消后销毁所属数据库连接，待底层实际结束才归还并发预算；池获取迟到时
  直接销毁，不继续工作。正常读取也 rollback，清理失败不能把脏事务归还连接池。
- 输出严格区分 observed/stale/unknown，带 boot/session/report/snapshot 来源和过期边界；
  `independentProbe:false`、`health:unknown`，不能当作 Applied、连通或健康证明。
- 观察宿主不取得 Snapshot、租约、端口、Journal 或切换权；Core、ADP/Schema、
  数据库和 Journal 格式均未修改。

新增 14 组端口与 3 项真实 SELECT-only MySQL/API 回归，已接入 Actions；本地仅静态检查，
尚无对应提交的功能通过证据。详细契约见
[Node observation v1](../spec/node-observation-v1.md)。
主动 Probe 的位置与基础执行边界随后按第 16 节接入；
其他 API 读写盘点与已有原生适配的 Actions 验收仍需继续，统一接入框架未全部完成。

## 16. 第九批收口：主动 Probe 预检与受限 Agent 执行基础

按 [ADR-0007](../decisions/0007-bounded-agent-probe.md) 将观测点限定为 Agent
Direct egress。Control 新增 `ForwardProbePlans` 与 SELECT-only Snapshot 投影，
接入 `POST /api/v1/scopes/:scope/forwards/:id/probe-plan`。
必须为 Scope manager 且有显式 Node Grant，读取当前意图、节点策略/凭据与
已发布的唯一 active Direct TCP 绑定；只支持 IP 字面量，不接收任意目标。

- 输出明确 `executable:false`、`dispatch:not-implemented`，不是 Probe 许可，
  也不是已执行、Applied 或健康证明；只读预检不保证未来授权不会变化。
- Agent 内部 `probe` 包要求独立 Probe Permit 和宿主当前执行授权同时成立。
  宿主比较 Node/boot/session/Snapshot/Assignment/revision/deployment/Fence/
  config digest/egress revision，返回脱离宿主的目标副本并持续重查。
- 仅一次 numeric TCP connect，零应用数据，不建监听、不重试；100–2000 ms，
  叠加取消、许可和执行票据截止。发包中每 25 ms 检查撤权，结束后也重查并关闭连接。
- 跨执行器共享单进程 4 个在途、每节点 1 个、完成后冷却 1 秒、最多 128 个预算项；
  只有网络工作和监视器真正结束后才归还并发。
- 抽取既有 Agent 数值 IP egress 纯谓词供复用，不改变 Forward 原有策略语义。
  Probe 额外始终拒绝元数据地址、DNS/zone、IPv4 >=224，不继承元数据放行。
- 内部实际测量区分 connected/unreachable；取消/超时/撤权不返回成功测量。
  健康始终 unknown，不写执行台账/Journal，不自动切换。

新增 7 组 Control 端口、2 项真实 SELECT-only MySQL/API，以及 7 组 Probe、
3 组宿主、1 组 egress Go 回归，已接入 Actions。本地仅静态检查，尚无对应
提交功能通过证据。Core、ADP/Schema/capability、数据库和 Journal 格式未变。

尚未实现独立许可签发、远程版本/能力协商与派发、单次许可防重放、集群/Actor 配额、
结果采集/存储和 Console；因此生产尚不能从 Control 触发一次真实 Probe。
下一批先做独立机器协议和授权闭环，不向 Snapshot 偷加命令，不把计划改名冒充许可。
完整契约与证据边界见 [Forward probe v1](../spec/forward-probe-v1.md)。

## 17. 第十批收口：独立机器协商与内部单次许可门禁

按 [ADR-0008](../decisions/0008-probe-contract-negotiation.md) 新增独立 Probe v1
协商 Schema、生成的 Go 类型/内嵌 Schema、TS/Go 严格解析及 30 份共享向量。
生产装配接入 `POST /agent/v3/probe/hello`，复用真实 mTLS 机器鉴权和维护门禁，
在同一只读事务重查 Node/boot/session、实际证书、撤销/到期/重叠退役与 Direct TCP 能力。

- 响应必须回显 Node/boot/session/随机实例，且固定 `contract-only`、
  `executionEnabled:false`；不存协商状态，不签许可，不写执行台账或发包。
- Agent `probe.Gate` 生成 256-bit 随机实例标识，要求独立许可的实例/节点/会话绑定。
  网络调用前原子消费许可 ID；失败、忙碌、取消或后续目标拒绝都不恢复可重试。
- 每门禁最多保留 256 个已消费 ID，生命周期内不清理/淘汰；满时拒绝，
  不能在原实例身份下清缓存。新实例拒绝旧实例许可，关闭门禁会取消在途上下文。
  现有执行器的进程/节点预算不会被新门禁重置。
- Runner 新增有界 HTTPS 协商钩子，验证回显、当前宿主会话及授权时钟，
  失败关闭门禁；本批尚未接入 `Run`/`poll`，后续第 19 节仅接登记维护，没有远程许可接收器。

新增 2 组 TS 契约、5 组 Control 端口、9 组 Go 回归及 2 项真实 HTTPS/mTLS
SELECT-only MySQL/API 用例，已接入 Actions；本地仅静态检查，没有对应提交的功能通过证据。
Core、已有 ADP/3 Hello/Snapshot/Report 与能力枚举、迁移和 Journal 未修改；
新增的只有独立 Probe 协商契约，不是偷偷扩充原协议。

尚缺远程执行许可/派发/结果协议、持久当前实例归属、独立签发/撤销和 Actor/集群配额。
内部 ID 门禁不是完整的分布式防重放；未来宿主必须替换时关闭旧门禁，
Control 签发前重新授权并核对当前实例与完整绑定。统一扩展接入与生产验收仍未完成。
详细边界见 [Probe negotiation v1](../protocol/probe-negotiation-v1.md)。

## 18. 第十一批收口：内部持久实例归属与恢复隔离

按 [ADR-0009](../decisions/0009-probe-instance-ownership.md) 新增 `ProbeInstances`、
窄实例 owner 端口与 `MySqlProbeInstances`。本批生产组合根显式装配，但没有 HTTP 登记接口，
也不从只读握手或 Runner 主循环调用；远程接入随后见第 19 节。所有输出仍为 `executionEnabled:false`。

- MySQL 每 Node 一个当前槽位，首登与替换均行锁串行化，按当前 generation CAS；
  相同原请求重试不递增、不续期，旧请求无法覆盖后继实例。
- 绑定 Node/boot/session、实际证书指纹和随机实例；同事务重查凭据/退役/能力，
  等待锁后再次检查时间。登记新鲜度最多 30 秒，并受当前凭据/退役截止约束，
  不是两秒发包许可或业务健康证明。
- 撤销匹配当前实例/代数，状态不可由同实例重试复活；能力撤回及计数耗尽不阻止
  有效机器凭据关闭槽位。观察读取将旧身份、能力变化或到期单独标为 stale。
- 新增 `0014-probe-instances.sql`，只写自己的表；Core、已有 ADP/Probe 协商消息、
  Agent Journal 和执行授权水位未改。数据库恢复沿用现有事务隔离所有旧实例，
  保留恢复出的标识/代数，不把 SQL 计数器冒充独立防回滚高水位。
- 同步升级评估目录和 Control-only `adp3-probe-registry-v1` 兼容边界，
  已迁移 0014 时拒绝旧 Control Profile，待执行迁移仍要求维护审阅。

新增 9 组端口、1 组升级矩阵与 4 项独立真实 MySQL 回归，接入 Actions；
既有真实备份/恢复脚本另加实例入库与还原后隔离断言。本地只做静态检查，
没有对应提交的功能通过证据，也没有执行本地迁移。

本批结束时尚缺远程登记/轮换协议与宿主门禁替换，随后按第 19 节接入。
独立许可签发/消费/配额及派发/结果闭环仍未完成。SQL 记录撤销本身不推送取消 Agent，
不能因此宣布远程防重放、执行撤权或 Probe 产品已经完成。

## 19. 第十二批收口：独立远程登记与宿主门禁生命周期

按 [ADR-0010](../decisions/0010-probe-registration-lifecycle.md) 新增独立
`POST /agent/v3/probe/instance`，共享 TS/Go Schema、严格解析与 37 份向量。
`ProbeInstanceRegistry` 只适配 inspect/register/revoke；实际 TLS 证书、Node 与会话
由机器中间件提供，所有授权/CAS/写入仍由原实例 owner 在同一事务完成。
原 `/probe/hello` 保持只读，两种响应均固定 `executionEnabled:false`。

- Agent 默认关闭，只有 `--probe-registration` 在 Hello/授权时钟建立后启动独立维护器；
  不改 Forward reconcile 或驱动执行，不接收远程 Probe 许可。
- 替换前关闭旧门禁，查询当前代数后以新随机实例 CAS 登记；轮换串行、网络不持 Runner 锁。
  回显、4 KiB、时钟、当前证书/会话/guard 重查失败均不接纳，迟到响应不能复活停机宿主。
- 本地以请求开始时的单调时钟计算更保守的新鲜度，扣除时钟偏差；到期前轮换，
  取消、身份/凭据/授权失效或停机关闭门禁。新实例不重置进程与 Node 的执行预算。
- 正常关闭先本地拒绝，再尽力远程撤销；丢失响应或已脱离宿主的槽位可保留至到期/替换。
  远程 SQL 撤销不是即时推送通道；登记不授予执行或完整防重放保证。
- Core、既有 ADP/3 消息/能力、Journal、执行台账与恢复水位不变，无新迁移；
  沿用 0014 和既有 Control 兼容边界，恢复继续隔离旧记录和凭据。

新增 5 组 TS 契约/适配、9 组 Go 解析/生命周期和 2 项真实 mTLS/MySQL 回归，接入 Actions。
既有真实 Linux Agent 备份/恢复脚本改为显式启用登记、检查真实入库及恢复隔离，
并继续检查 Direct TCP/UDP。本地只做静态检查，没有对应提交的功能通过证据。

内部执行许可的授权/签发与持久消费、Actor/集群签发配额随后按第 20 节接入；远程派发与结果仍未完成。
当前仍不能从 Control 触发真实 Probe，不能把登记状态当作 Applied、连通或业务健康。
详细时序和失败边界见 [Probe instance v1](../protocol/probe-instance-v1.md)。

## 20. 第十三批收口：内部许可权威、持久单次消费与共享签发预算

按 [ADR-0011](../decisions/0011-probe-permit-authority.md) 新增 `ProbePermits`、窄授权/实例/存储端口，
由 `MySqlProbePermits` 独占 `probe_permits` 和 `probe_permit_budget`。生产组合根已装配，
没有新增 HTTP 签发/消费接口、Agent 许可接收器或自动发包循环，返回仍不可执行。

- 签发复用原 Forward 探测授权，但加入调用方事务，并装配锁定的 Forward、会话和 Snapshot 投影；
  Scope manager、显式 Node Grant、目标策略及当前机器凭据/能力都在同一事务内重查。
- 绑定完整拓扑和当前随机实例/代数，随机生成许可 ID，不接收调用方目标、绑定或许可 ID。
  截止最多两秒，并取计划、既有 Snapshot、实例、凭据与退役界限的交集，不续执行租约。
- 消费再次授权原始 Actor、当前意图/策略、实例和机器，逐字段比较完整执行绑定；
  成功提交前持有相关读锁并将 issued 原子关闭为 consumed，跨进程并发最多一方获胜。
- 同库共享预算锁：最多 4 个未到期签发保留；每 Actor 跨 Scope、每 Node 跨 Actor 各 1 个，
  保留至到期后一秒。消费、撤销和轮换不提前退款；最多 256 条保留记录，过期清理不复活旧 ID。
  这是签发预算，不是实际网络工作已结束的证明，Agent 原有执行预算仍独立保留。
- 新增迁移 0015 和 Control-only `adp3-probe-permits-v1`，旧 Profile 不得读取/回退跨越该边界；
  恢复在原事务隔离旧 issued 许可，保留已关闭状态、标识及 SQL 时间下界。SQL 状态不冒充独立防回滚权威。

新增 11 组许可端口、1 组事务复用、1 组升级矩阵和 6 项真实 MySQL 回归，接入 Actions；
既有真实 Agent 恢复脚本增加内部签发与还原隔离/预算保留断言。本地仅静态检查，未运行迁移或功能验收。
Core、已有 ADP/Probe 机器消息、Journal 与执行授权水位未修改。

随后按第 21 节接入单次领取回执及宿主校验，下一步仍须有界派发、持续撤权及结果校验。
内部许可行或消费回执都不是可发送给 Agent 的执行授权凭证，仍不能从 Control 触发真实 Probe。

## 21. 第十四批收口：远程单次领取与不可执行宿主回执

按 [ADR-0012](../decisions/0012-probe-claim-contract.md) 新增独立
`POST /agent/v3/probe/claim`，仅消费已知许可 ID；没有发现/列表/轮询或远程签发。
实际 Node/证书指纹来自 mTLS，中间件会话头须与请求一致；`ProbeClaims` 只调用原
许可 owner 的 consume，不另开事务或越权写表。消费仍重查原始 Actor、完整绑定、
实例、凭据和截止，成功提交后才生成回执。

- 新增闭合的独立 Schema、TS/Go 严格解析与 55 份共享向量；请求不接受调用方目标、
  绑定、Actor、指纹、超时或时间，响应不泄露 Actor/Scope/证书指纹/目标。
- 回执强制 consumed、`executionEnabled:false`，完整回显实例/代数/许可身份；
  校验完整绑定及 issue/consume/server/expiry 顺序，最长两秒，过期或丢失回应不退款或复活许可。
- Agent 校验钩子要求已有登记实例及当前 Direct TCP 绑定；请求前烧录 ID，每实例最多 256，
  不淘汰或自动重试失败请求。网络不持 Runner 锁，限制 HTTPS、重定向、4 KiB、两秒及实例取消。
- 回应后逐字段核对本地完整绑定及当前身份/凭据/Guard/ticket/快照/实例，
  用请求前单调起点计算剩余期限，扣除时钟不确定性，再取实例和执行截止交集。
- 返回独立内部值回执，不创建 `probe.Permit`/`probe.Grant` 或调用 Gate/Executor；
  静态守卫禁止生产循环接线，避免用一次消费证明后续持续独立授权。
- Core、已有 ADP/3/Probe hello/instance、Journal、执行水位及驱动未改；没有新迁移，
  沿用 0015 兼容与恢复隔离。`--probe-registration` 仍只是默认关闭的实例维护器。

新增 2 组 TS 契约、4 组 Control adapter、1 组 Go 解析/5 组宿主和 4 项真实 mTLS/MySQL 回归，
覆盖并发单赢家、受限写表、越权/畸形输入、原始 Actor/拓扑/机器撤回、回滚、绑定变化、
丢失响应/取消/重定向与不淘汰缓存。全部接入 Actions；本地仅静态检查，无运行通过声明。

下一步完成有界任务投递、持续独立许可撤权和结果契约后，才可接入真实 connect-only 执行。
当前仍不能从 Control 发起真实 Probe，也不产生连通/业务健康结论。

## 22. 第十五批收口：有界任务选择、消费后授权观察与持久撤销

按 [ADR-0013](../decisions/0013-probe-delivery-authority.md) 扩展原 `ProbePermits` owner，
不引入独立队列或新的执行权威。内部 offer 验证当前机器/实例，即使无候选也不能跳过认证；
仅选当前身份下最多一个未到期 issued 许可，并重查原始 Actor 与完整绑定。
重复 offer 不创建、消费、续期或保留任务，也不泄露其他身份的许可，候选歧义拒绝。

- 内部 check 只检查当前 consumed 且未撤销的许可；复用消费时的授权帮助方法，
  重查原始 Actor/Forward/Node Grant、完整绑定、实例、凭据、能力和原截止，锁保持至事务完成。
  成功只返回不可执行的 checkedAt 观察，不写状态或预算时钟，不成为持续授权租约。
- 修正消费后撤销无效的边界：当前 Scope manager 可以写入独立撤销标记，
  保留 state=consumed、原 closedAt、ID 及签发保留；来源 Grant 恢复也不能清除此标记。
  重复撤销返回第一次时间，不新增写入或退款，插入/维护/时钟失败则整笔回滚。
- 新迁移 0016 由同一 SQL owner 管理撤销表，FK 跟随旧许可清理；全局预算锁串行化消费、
  检查和撤销。撤销集合同样有界，损坏、重复、孤立、不可能或未来记录拒绝。
- Control-only `adp3-probe-withdrawals-v1` 上界为 0016，旧 Profile 与 Agent 使用该 Profile 均拒绝；
  旧 consumed 回填撤销，恢复继续隔离 issued 并撤销 consumed，保留旧消费/撤销事实及预算下界。
- Core、现有 ADP/Probe 机器消息、Runner/Gate、Journal 与 Authority 高水位不变。
  无新机器端点或 Agent 自动调用，不把瞬时检查冒充断网后的持续许可保证。

新增 9 组端口、5 项真实 MySQL 与 1 组升级矩阵回归，覆盖最小/空/歧义选择、逐字段绑定、
显式撤销与重启、权限恢复不复活、回滚、损坏状态、生产迁移回填/FK 清理、恢复保留及检查提交锁。
沿用现有真实 mTLS 和备份脚本；实际备份场景仍覆盖 issued 隔离，consumed 撤销恢复另由真实 MySQL
事务用例覆盖，不冒充新增完整备份通过。本地只做静态检查，功能/迁移验收待 Actions。

下一步接严格有界 poll/status 机器协议、带明确失鲜/取消上界的 Agent 监视器，再接结果与一次性执行。
当前还不能从 Control 触发真实 Probe，不宣布持续执行撤权或远程闭环已经完成。

## 23. 第十六批收口：不可执行的有界机器获取与状态协议

按 [ADR-0014](../decisions/0014-probe-delivery-contract.md) 接入独立
`POST /agent/v3/probe/poll` 与 `/agent/v3/probe/status`，只经闭合机器 adapter
委托原许可 owner 的 offer/check，不新建事务、队列、授权来源或写路径。
实际身份来自 mTLS，Node/会话头必须匹配请求；空任务同样检查当前凭据与登记实例。

- 新 Schema、TS/Go 严格解析、生成类型与 184 份共享向量，要求完整绑定、安全计数器、
  canonical UTC 毫秒、闭合对象与请求关联；拒绝目标/Actor/指纹等调用方授权字段。
- poll 只返回 null 或一个当前 issued ID/绑定/原时限，不保留、消费、签发或续期；
  status 只返回已消费且未撤销许可的当前观察，保留原消费/截止，不清除撤销或退款。
- 提交后才构造最小化回复，observedAt/checkedAt 到 serverTime 最多 250 ms，
  过期、时钟倒退或晚提交拒绝；全部 `executionEnabled:false`。
- requestId 仅关联并精确回显，服务端不存储去重；未来客户端须每次生成随机新值并限制端到端耗时。
  服务端 250 ms 上界不包括网络、排队和 Agent 取消，也不是可续租执行授权。
- Agent 仅新增独立协议解析包，未接入 HTTP 请求、生产轮询或监视器；原领取钩子仍不能生产调用，
  不构造 Grant/Permit 或真实发包。Core、既有 ADP/Probe、Journal、迁移与兼容档位不变，沿用 0016。

新增 2 组 TS 契约、6 组 adapter、2 组 Go 与 5 项真实 mTLS/MySQL 回归，接入 Actions。
只读接口测试账号使用 SELECT 加 LOCK TABLES，显式验证 DML 拒绝和查询前后全表摘要；
另覆盖完整获取/领取/检查/撤销、权限恢复不复活、空任务身份拒绝、来源失效与提交前维护失败。
本地只做静态检查，无功能、迁移或对应提交 Actions 通过声明。

下一步接有界 Agent 请求与失败关闭的监视器，明确端到端失鲜、并发、不复活和取消边界，
再接结果与一次性执行。仍不能从 Control 触发真实 Probe，不把协议完成当持续撤权闭环。

## 24. 第十七批收口：Agent 有界请求与失败关闭观察监视器

按 [ADR-0015](../decisions/0015-probe-agent-authority-watch.md) 编写内部 `pollProbe` 和
`monitorConsumedProbe` 钩子，生产 Runner/登记维护器仍不调用；不自动领取、签发、构造执行许可或发包。
只读现有 Runner 实例、凭据/Guard/ticket 和当前 Direct TCP 完整绑定，HTTP 不持 Runner 锁。

- 请求限制 HTTPS、禁止跳转、随机 256-bit 关联、严格回显、4 KiB 和 200 ms；
  单调新鲜截止从请求前起点计算，扣除服务端观察年龄与全部往返/解析/等待耗时。
- 当前实例保留成功消费回执，监视只接受原对象并复制完整绑定、原 issue/expiry/consume、超时与截止；
  已尝试启动的回执永久留标，不因失败、取消、忙碌或权限恢复重新启动，最多沿用 256 条领取上限。
- 第一次 status 成功前不可用；之后串行请求、成功后间隔 50 ms、最多 40 次，原执行截止只能缩短。
  每次重查原回执所有字段及本地权限；过期、失联、拒绝、时间倒退、实例变化或取消永久关闭。
- 新的进程共享请求预算为 4 并发、每 Node 1、跟踪最多 128 Node，发现尝试冷却一秒；
  与原签发/socket 预算独立，不替代它们。监视全程持槽，取消后等 HTTP 和监督协程结束才释放。
- 监督器每 25 ms 观察本地权限并按最早失鲜/执行截止计时；Check 同步拒绝过期/关闭状态。
  200/250/25 ms 不构成 OS 实时承诺，取消不合作的传输仍占槽，不启动无限替代请求或宣称物理发包已停。
- 未改 Core、生产 Runner、Guard/Journal/执行器、现有机器 Schema、迁移或 Control 权威；
  扩展的仅是实例内临时回执记录。静态守卫禁止生产调用、Grant/Permit 构造、领取或目标执行。

新增 11 组 Go `TestProbeDelivery*`，覆盖空/单任务、冷却与预算、完整回执/绑定、首次与连续失败、
本地撤权/取消、失鲜/不续期/不复活、伪造回执、失败不重试与取消传输持槽到真实退出。
HTTPS fixture 是宿主测试，不冒充新增真实 Agent/MySQL 或物理主机验收；既有 mTLS/MySQL 与 Go race 继续保留。
本地仅静态检查，新增测试仅编写/接线，尚无对应提交 Actions 通过记录。

下一步收口结果协议与接收、单次宿主执行接线，然后再显式设计可选生产循环与组合验收。
当前仍不能从 Control 触发真实 Probe，不宣布远程执行或持续撤权闭环完成。

## 25. 第十八批收口：有界结果协议与原许可 owner 接收

按 [ADR-0016](../decisions/0016-probe-result-receipts.md) 增加独立 mTLS 结果消息、
TS/Go 严格解析与 JCS 内容摘要。HTTP adapter 只委托 `ProbePermits.receiveResult`，
沿用现有预算锁和事务，重查原始 Actor/当前机器、实例、完整绑定、原回执及原截止。
只有 consumed 且未撤销的原许可可提交。测量时间不允许未来，接收不得超过有效期。

- 每个保留许可一份结果，相同内容返回最初 acceptedAt，不同内容拒绝覆盖；随机关联 ID 不计入内容摘要。
- 不改变消费、撤销、签发预算或截止，不写业务执行状态。来源固定 agent-reported、应用健康 unknown。
- 迁移 0017 使用原许可 FK 级联清理，结果数不超过原保留 256 条；不是持久历史/健康表或自动 TTL 服务。
- 恢复保留结果事实、继续撤销 consumed 资格；新 Control-only Profile 读至 0017，旧读者和 Agent 使用该 Profile 拒绝。
- 未改 Core、已有机器 Schema、生产 Runner、Guard/Journal、发包执行器，也没有 Agent 自动上报或远程执行接线。

127 份共享向量、2 组 TS/2 组 Go 契约、5 组 adapter、9 组 owner、5 项真实 mTLS/MySQL 与
1 组升级回归已编写并接入 Actions。mTLS 用例只构造上报，不是实际 Agent/目标网络探测证据。
本地仅静态检查，功能/迁移/对应提交 Actions 仍待执行。下一步接单次宿主执行准入与结果序列化，
再接默认关闭生产循环及组合验收；仍不能从 Control 发起真实 Probe，不更新业务健康或触发切换。

## 26. 第十九批收口：宿主单次执行与保守结果序列化

[ADR-0017](../decisions/0017-probe-host-execution.md) 将原消费回执、失败关闭监视器与既有实例 Gate
接成单次准入；只有这个 adapter 可构造内部 Grant，不重建目标或门禁。结果句柄保持活监视器，
每次导出前重新检查授权与只能缩短的截止，并使用领取时服务端时间/本地单调锚点保守映射，
向下取有效期、向上取耗时，不将不可信时间或不支持结果钳制成成功。
9 组 Go 回归覆盖实际回环 EOF、并发防重放、失权/取消、排空与序列化边界，接入 Actions/race。
该原始批次仅内部适配；它没有生产调用的历史描述由下一批显式接线替代。

## 27. 第二十批收口：默认关闭的管理入口与 Agent 串行操作链

[ADR-0018](../decisions/0018-probe-production-workflow.md) 和 [管理契约](../spec/forward-probe-management-v1.md)
增加幂等签发、短期历史回执查询及撤销，Agent 按 poll→claim→watch/Gate→单次连接→上报串行处理。
管理幂等与原许可同事务；当前实例由 owner 锁定选择，不接受用户给定目标、实例或授权绑定。
重放只返回原接受记录，不重建或续期。查询/撤销在关闭签发、原 Grant 已移除时仍可由当前管理者使用，
结果仍是历史 agent-reported，不是当前健康、许可或长周期历史。

- Control 与 Agent 独立 default-off；Agent 还必须分别允许登记与执行。显式一秒集群 ADP 时钟策略
  才允许签发，须重新协商并通过独立 OS 同步检查，不自动修时钟、不放宽原两秒许可。
- 保留签发/领取/门禁/监视器全部预算、一秒发现冷却、原截止与失败关闭；领取和上报在 I/O 前留标，
  不确定结果不重试或重复发包；任务可因发现延迟、时钟不确定或原期限到期而没有结果。
- 上报复用 200 ms/4 KiB/HTTPS 禁跳转通道，校验同一原结果摘要/身份/关联/时间并在之后重查权限；
  退出等上报与监视器真实终止后才释放槽，再关闭/撤销登记，不起无限替代协程。
- 不改 Core、既有机器 Schema、迁移目录、Authority/Journal、健康、Forward 状态或发布开关；
  Control Profile 仍至 0017。禁用功能不允许降级、清除安全历史或伪造物理撤权保证。

新增 5 组管理/owner、2 组 HTTP、6 组 Go 回归；独立 `probe-workflow` Actions 编写真实构建 Agent、
Control/mTLS、MySQL 与零应用字节目标的组合验收，显式记录有限独立新任务、过期/缺测与每 ID 最多一连接。
默认关闭、幂等/已消费重放、投递前撤销、原始 Node Grant 撤回、正常退出与实例撤销均有接线。
只上传脱敏 evidence.json，不上传测试 PKI 或受保护状态。当前只有本地静态检查，功能与匹配 SHA 的
Actions 尚未执行/通过；同宿主机组合不是物理多主机、长期容量或生产就绪证据。
下一步核对组合验收与 Console 操作、剩余原生能力/遥测及既有审计/交付缺口，不将全项目标成完成。
