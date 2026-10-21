# 多用户转发产品：使用流程与源码缺口

日期：2026-10-21（Asia/Shanghai）。状态：已确认用途的需求基线与源码分析。
阅读源码 HEAD：`01b264509a0aa50a261b8cb2cf0b866c282f9818`，附现有文档工作区修改。
本轮没有实现功能、改变公共契约或运行测试、静态检查、构建、Actions 与网络实验；
没有提交、推送或发布。下列“已有”仅指读到对应源码，不等于当前修订通过验收。

后续授权：用户已于同日将整个基线定位为新的 N 产品开发阶段，并授权设置目标和
代理并行源码实施。当前任务状态以 [N 阶段台账](product-development-stage-n-2026-10-21.md)
为准；下文保留形成需求基线时的分析状态，不再作为禁止已获授权源码开发的依据。
后续产品决定：用户于同日明确确认按“每用户 × 每台管理员共享机器”聚合双向有效
载荷，管理员设置周期起止，可采用月度；私有机器免扣，耗尽停止该资源相关转发。
[FR-0032](../changes/FR-0032-shared-resource-payload-limits.md)和
[payload 规范](../spec/shared-resource-payload-limits-v1.md)记录实际源码方案、保守预扣、
故障恢复和旧授权截止。第 3 节 PR-09 是实施前缺口，现已整合源码但未执行接受。

## 1. 产品用途与已确认边界

TuneX 是一个多用户网络转发与中继平台。用户可以接入自己的服务器，也可以使用
管理员授权的服务器，自由组合 TCP／UDP 转发线路，并通过探测、监控和诊断了解
运行情况。首版重点是自助配置、资源隔离、授权、自由组线、限制和可解释的运行状态。

| 对象／规则 | 已确认要求 |
| --- | --- |
| 用户自己的机器 | 仅添加者有转发使用权；其他用户不可使用 |
| 管理员提供的机器 | 管理员决定向谁开放，以及可选的入口／中转／出口用途限制 |
| 未声明用途限制 | 必须先获得机器使用资格；此后未额外限制的用途按实际支持能力开放 |
| 管理员治理 | 可以因治理需要停用、移除机器；管理员身份不自动取得私有机器使用权，也不能据此转授他人 |
| 用户自助 | 已有权限和限制范围内添加机器、创建和修改规则，无需逐条审批 |
| 自由组线 | 不要求管理员预先创建每条线路；可混用自己的机器与获授权的管理员机器 |
| 线路复用 | 可保存“我的线路”供多条规则使用，也可在创建规则时直接组线 |
| 资源限制 | 平台运行上限与管理员资源额度分开；自己的 A → 管理员 B → 自己的 C，只按管理员规则计算 B 的额度 |
| 探测与监控 | 保留机器、规则、流量／连接、必要可达性测量和故障定位；展示来源与时效 |
| 首版之外 | 购买、支付、结算暂不必需；自动选路、自动故障切换尚未确定为需求 |

主要任务是 TCP／UDP 端口转发和中继；没有由此推导整机流量接管、终端 VPN、L7
代理或任意协议组装要求。继续采用自研原生执行主线；贡献者易于参与是工程质量
要求，不能替代最终用户的使用流程。参考仓库只供学习，不成为实现或部署依赖。

本轮六项说明：

1. 层级：阅读 L0–L3；修改产品分析、开发文档入口与后续验收需求说明。
2. 公共接口：Node／Identity、Forward Commands／Operation、Path／NativeTunnel、
   Transport、Runtime、ConsoleQueries、Telemetry／Probe／Diagnostics。
3. 地基：不改地基实现；沿用唯一 Runtime ledger、原 Agent authority／Journal。
4. 契约：不新增公共接口；涉及归属、用途与配额的接口／语义变化须在实施前记录 FR。
5. 验收：已进行源码阅读；本文件列出的运行和隔离病例全部 planned，未执行。
6. 并发：保留现有修改；不切换／清理工作区，不启动并行产品模块或共享组合根改动。

## 2. 完整使用流程

### 2.1 接入机器

用户进入“我的机器”，添加名称与必要网络信息，取得有时限的接入凭据；在机器上
安装／启动 Agent，完成注册。机器应被记录为该用户的私有资源。界面依次显示
“等待接入、已注册、报告新鲜／过期、已停用”等事实，注册成功本身不表示业务可达。

管理员通过独立的资源管理入口接入供分配的机器。两种入口需要明确资源归属，
不能把“当前操作者有管理权限”作为公共资源／私有资源的判定依据。
Agent 凭据、轮换和撤销继续由现有 owner 负责；接入向导不创造新的机器身份体系。

### 2.2 获得和管理资源使用资格

管理员选择其提供的机器、目标用户和限制，提交授权。用户看到自己能使用的资源，
每台机器说明来源、支持用途和限制原因。机器能力、运行状态和用户授权分别展示。

管理员未授予 B 时，用户不能使用 B；授予 B 且未限制用途时，可使用 B 支持的用途；
若只开放中转，B 不能被该用户作为入口或出口。管理员不能经同一个授权入口把
用户甲的私有机器交给用户乙使用。治理操作与转发使用授权需要分别校验。

### 2.3 自由选择机器并保存线路

用户创建转发时选择入口、零个或多个中转、最终目标；经出口节点时同时选择出口。
例如甲有 A、C，获授权使用管理员 B：可以直接创建 A → C 或 A → B → C；
管理员不必提前声明这两条线路。目标服务地址与出口 Agent 是不同概念，目标不因
填写地址就变成一台受管机器，也不需要为每个目标服务安装 Agent。

组线时说明节点是否可选、用途／协议是否支持、缺少什么配置或权限。执行前仍由
原命令重新检查全部权限、网络策略、锁定版本和资源；页面预检不能授予执行权。
中继所需的 Transport Profile／Endpoint 是技术前提，可由流程解析或解释，
不应要求普通用户先理解所有摘要、fence 和版本字段才能开始组线。

用户可将组合保存为“我的线路”，再用不同监听端口／目标创建多条规则。保存配置
不预占业务端口，不授予新的机器权限；后续使用和变更仍重新授权。线路发布新版本
不应悄悄改变现有规则，应用到哪些规则、可能中断哪些连接应明确展示。
当前可复用配置与未来共享物理连接是两项能力，不能以保存线路证明后者已实现。

### 2.4 创建、修改和停止转发

用户选择 Direct 或组线路径、TCP／UDP、监听地址／端口和目标，先看到权限、能力、
端口及限制的预检，再提交。后台返回规则修订和 Operation，界面展示接受、部署、
Agent 运行报告和测量结果各自的进度。端口冲突和权限变化在原事务中处理，
不能由前端“可选”结果作最终保证。

修改先展示路径／目标／限制差异及中断影响，再显式应用。TCP 旧连接排空、UDP
关联重建、硬截止和替换支持以对应 driver 的真实能力为准；不承诺无损恢复或
失败后必然回滚。停止、删除或撤权后显示停止新接入、排空／到期、清理进度，
保留原审计、保护历史和未知结果，不能把隐藏列表项作为资源已释放的证据。

### 2.5 查看资源与用量

用户能区分平台上限、自己资源的运行用量和管理员提供资源的额度。共享 B 时只展示
该用户允许查看的数据；机器整体统计不能冒充个人用量。额度说明必须包含适用资源、
计量口径、周期、剩余量、数据时效和超限行为。具体单位／周期等尚待设计，见第 7 节。

混合路径的 A、C 不消耗管理员 B 的资源额度；多次经过或多节点消耗如何计算，
必须先规定口径。遥测有缺口时显示未知／不完整，不能补零或把缺测视为无限可用。

### 2.6 探测、监控与故障处理

从机器看心跳、基本负载、内存和网络使用；从规则看期望配置、Operation、部署、
当前运行实例、连接／会话、流量／速率和错误。跨 epoch、缺样、过期、历史实例和
不支持的指标需要明确标识。共享机器的整机信息与本人的规则信息分开控制可见范围。

用户可发起适用的受限探测，看到测量位置、协议、目标、时间及结果能说明的范围。
Agent 在本机探测入口不能证明外部访问者能到达该入口；连接成功不能证明应用正常；
分段耗时相加不能当作一次真实端到端测量。UDP 通用服务不能假设响应任意探测包。

故障页沿入口 → 中转 → 出口 → 目标呈现已有证据，区分权限／策略拒绝、端口占用、
无新鲜报告、连接或 TLS 错误和缺少测量。提供有依据的下一步，不自动换线。
恢复权限、修正配置或显式重试都经过原命令与当前授权；监控／通知不能代替执行权威。

## 3. 源码事实与缺口

以下编号是产品需求索引，不属于已接受的地基 1–220 断言，也不表示缺口均是原实现
的安全漏洞。原系统按 Scope 管理是现有语义；这里说明它与新确认产品用途的差异。

| 需求 | 当前源码依据 | 结论与缺口 |
| --- | --- | --- |
| PR-01 接入与私有归属 | [NodeService](../../apps/control/src/modules/node-owner/service.ts)、[Node store](../../apps/control/src/infrastructure/mysql-node-authority.ts)、[初始表](../../apps/control/migrations/0001-phase1.sql) | 已有 provision、限时 enrollment、创建者初始 grant、凭据轮换／撤销；nodes 没有显式私有归属／资源来源字段，初始 grant 不能代替不可转授的所有权 |
| PR-02 用户与治理权限 | [IdentityAccessHost](../../apps/control/src/framework/identity-access.ts)、[Node grant](../../apps/control/src/modules/node-owner/service.ts) | 现有 owner 是 Scope owner，manager 用 canManage 表示；Scope owner 可修改 Scope 内节点 grant，管理方法检查 Scope 管理权；尚未区分平台治理、私人所有权与普通自助使用权 |
| PR-03 入口／中转／出口授权 | [NodeGrantWriter](../../apps/control/src/modules/node-owner/grant-contracts.ts)、[Node facts](../../apps/control/src/framework/node-facts.ts)、[NodeAuthorityHost](../../apps/control/src/framework/node-authority.ts) | 已有按 actor 的节点布尔 grant、节点级网络策略／能力；未表达每个用户的用途限制。执行角色和 capability 不能代替用途授权 |
| PR-04 数据可见范围 | [ConsoleQueries](../../apps/control/src/modules/console-query-owner/service.ts)、[MySQL projection](../../apps/control/src/infrastructure/mysql-management-read.ts) | candidates 按 actor grant 筛选，但普通 nodes／forwards／operations 和 overview 主要按 Scope；不能当作个人资源列表。必须覆盖详情、计数、分页、筛选和关联信息 |
| PR-05 自由组线 | [Relay console](../../apps/web/browser-native/relay-console.js)、[ForwardCommands](../../apps/control/src/modules/forward-owner/commands.ts) | 已有直接提交带 path 的 Forward 和中转编辑，不要求每条先建模板；可复用。当前各节点受同一 scopeId 校验，跨私人 Scope 与管理员 Scope 的资源混用不能直接承诺已支持 |
| PR-06 保存“我的线路” | [PathTemplates](../../apps/control/src/modules/path-owner/templates.ts)、[NativeTunnels](../../apps/control/src/modules/native-tunnel-owner/service.ts)、[Path references](../../apps/control/src/modules/path-owner/references.ts) | 已有模板／精确修订／绑定、原 Profile 和 Endpoint 授权；NativeTunnel 就是 path-template 的业务视图，明确 physicalConnectionSharing:false。模板查询按 Scope，createdBy 是修订作者，尚不等于私人线路 owner；不另造同义隧道账本 |
| PR-07 转发生命周期 | [ForwardCommands](../../apps/control/src/modules/forward-owner/commands.ts)、[intent store](../../apps/control/src/infrastructure/mysql-intent-store.ts)、[Web 状态](../../apps/web/forward-status.js) | 已有原事务、幂等、CAS、资源准备与 Operation；authorization_actor 用于执行授权且可更新，不能直接充当不可变业务归属。需补规则归属与自助／治理操作边界 |
| PR-08 端口与平台容量 | [Node facts](../../apps/control/src/framework/node-facts.ts)、[Agent Policy](../../agent/internal/contracts/types_generated.go)、[Runtime 公共资源端口](../../apps/control/src/framework/runtime-resource-ports.ts) | 已有允许端口、原端口预留和 assignment／连接／会话等上界；这些不是每个用户可分配的管理员端口额度。平台上限与个人授权额度要分别建模 |
| PR-09 带宽与流量额度 | [ForwardTelemetry](../../apps/control/src/modules/telemetry-owner/forward.ts)、[遥测存储](../../apps/control/src/infrastructure/mysql-forward-telemetry.ts)、[Agent Policy](../../agent/internal/contracts/types_generated.go) | 在所读命令、策略和计量路径中未见“用户 × 管理员资源 × 周期”的额度及限速执行闭环。遥测保留／请求 quota 和连接数限制不能代替带宽／流量额度；不从页面字节曲线推断硬限制已实施 |
| PR-10 机器监控 | [Host wire types](../../agent/internal/observationwire/host_types.go)、[HostTelemetry](../../apps/control/src/modules/telemetry-owner/host.ts)、[Web host view](../../apps/web/host-telemetry-console.js) | 已有 CPU、内存、负载、文件系统和有界网卡字节、availability 与时序处理；Host history 按 Scope 授权，需要个人机器／共享机器字段过滤。Agent OS 视图不保证等同物理宿主机全貌 |
| PR-11 规则监控与诊断 | [ForwardTelemetry](../../apps/control/src/modules/telemetry-owner/forward.ts)、[Diagnostics](../../apps/control/src/modules/forward-diagnostic-owner/api.ts)、[聚合](../../apps/control/src/modules/telemetry-owner/rollups.ts) | 已有实例身份、counter epoch、gap、历史、coverage 和有界诊断。查询仍以 Scope 为主，需要个人规则授权及聚合隔离；已有 health:unknown 等边界应保留 |
| PR-12 必要可达性探测 | [ForwardProbePlans](../../apps/control/src/modules/probe-owner/forward-plans.ts)、[ForwardProbes](../../apps/control/src/modules/probe-owner/forward-commands.ts)、[Probe permits](../../apps/control/src/modules/probe-owner/permits.ts) | 已有 Direct TCP connect／本地入口 connect、受控 TLS 与 Echo 分层。计划／permit 类型不等于全部实时入口开放；所读 Forward plan 明确拒绝带 path／transport，尚不能证明 Relay／多跳业务链可达，UDP Echo 需要受控服务与独立接入门槛 |
| PR-13 普通用户前台 | [Web entry](../../apps/web/index.html)、[规则／隧道视图](../../apps/web/tunnel-console.js) | 已有丰富管理控制台；当前入口仍要求 Scope ID、Bearer Token，模板界面暴露精确修订／摘要等。缺少围绕“我的机器、可用资源、我的线路、我的转发”的一致流程和权限解释 |
| PR-14 撤权与变更影响 | [Node commands](../../apps/control/src/modules/node-owner/commands.ts)、[Identity owner](../../apps/control/src/modules/identity-owner/public.ts)、[Path binding](../../apps/control/src/modules/path-owner/binding-contracts.ts) | 已有撤权对账、Operation、精确路径预览和中断说明；新增私有／用途／额度语义必须接入这些原链路，覆盖存量运行与新建拒绝，不可只更新 UI 或新增旁路停止器 |

关键推论：当前可以复用执行、资源和观测基础，但尚不能把 Scope 管理控制台直接
定义为已满足新用途的多用户自助产品。归属／治理／用途／可见性先确定，才能安全
复用现有组线和监控页面。给每人建立私人 Scope 也不自动解决管理员共享节点混用，
因为现有执行与模板引用验证要求同一 Scope。

## 4. 实现边界与兼容要求

建议首先在现有 Identity／Node／Forward／Path owner 明确产品归属、来源、使用、
治理和读取策略；通过公共契约串联，不复制权威。哪些属于 L3 私有实现、哪些影响
冻结 L1/L2 授权接口或语义，由后续具体 FR 判定；本文件没有批准接口形状或数据迁移。

实施必须说明完整 owner 调用链及具名兼容入口：Web／API → 对应 L3 命令 →
原事务中的 Identity／Node／Path／Transport 授权 → Forward 准备、Runtime 资源和
Operation → 原 Snapshot／Agent Runner／报告。只读投影从有权限的原 owner 获取
数据，不承担执行授权；限速／额度也不得创建第二套端口或执行账本。

存量兼容至少包括：

- 不能根据现有 node_grants、Scope owner 或“最后一次操作者”静默推定私人所有权；
  对来源不明资源制定显式迁移／确认规则，保留原记录与审计。
- `authorization_actor` 保持执行授权语义；新增产品归属不能使旧租约、撤权或恢复失效。
- 同一 Scope 与跨资源来源组合的方案需要明确选择；若改变 scopeId 不变量，先列出
  查询、授权、锁、表约束、协议和存量消费者影响，不能仅放宽一个比较条件。
- 新授权必须覆盖新建、更新、复制、启用、重试、模板应用、批量发布、探测、续租与
  恢复；旧别名／入口不能绕过，历史幂等回执也不能重新授予执行。
- 撤销资源／用途或额度耗尽时，旧实例按明确规则收敛；离线机器和未知结果服从原
  租约／硬截止，不能承诺立即清除所有存量连接或删除 Journal 来迁移。

## 5. 建议开发切片及退出条件

这些是有依赖顺序的实施提案。当前授权只完成分析文档；不据此启动功能、验证或
并行开发。涉及公共契约的切片先提交 FR，功能验收在授权后由 Actions 绑定准确修订。

| 顺序 | 交付范围 | 退出条件 |
| --- | --- | --- |
| P1 资源归属与授权 | Identity／Node 的私人资源、管理员资源、治理与用途边界；确定 Scope 组合方式；关联规则／线路归属和读取策略 | 明确契约与存量迁移；私有资源不可转授；管理员治理不取得使用权；原执行／撤权链无旁路 |
| P2 自助转发流程 | 我的机器／可用资源、接入向导；自由组线和保存线路；复用原 Forward／Path／NativeTunnel／Profile／Endpoint | 新用户可完成自己的 A 与管理员 B 的转发；无需预声明线路；所有命令和查询执行 P1 策略；变更显式授权 |
| P3 资源限制 | 区分平台容量、每用户管理员端口／带宽／流量额度，计量归属与超限处理接入原 owner | 口径、周期、并发与故障恢复明确；A／C 不占 B 额度；重试不重复扣减；离线和缺测不形成无限使用 |
| P4 监控与故障流程 | 复用现有机器／规则遥测、聚合、诊断；按 P1 隔离；列出 Relay／多跳缺少的测量并按价值补齐 | 能区分配置、部署、运行、测量；展示来源与过期；甲看不到乙的数据；不支持的探测明确拒绝 |
| P5 准确修订验收与部署质量 | 冻结源码后集中验证契约、MySQL、网络、浏览器、恢复和实际使用流程 | 每项需求有准确源码／测试修订与结果；物理多主机、负载／长稳、镜像／发行各保留独立结论 |

P2 的基本状态说明与 P4 的隔离规则从第一条自助链就要具备，不能到后期才补权限。
P4 表示进一步整合和补齐诊断，不表示在 P1–P3 删除已确认的监控／探测需求。
跨规则共享原生物理连接、通用扩展范例与内部去重按真实瓶颈排期；它们不是完成
用户首次组线的前置条件，也不取代已确认的资源限制与监控。

## 6. 计划验收病例

全部未执行。后续授权时分配到原 owner 的契约测试、Actions MySQL／网络／浏览器
流程，并关联实际测试源码；本地不以脚本或实验替代运行证据。地基 readiness 仅
链接本节作为后继需求，不扩大历史 220 项的接受范围。

| 病例 | 必须验证的结果 |
| --- | --- |
| PA-01 私有机器 | 甲接入 A 后，乙和管理员不能仅凭身份使用或转授 A；管理员可按治理契约停用；撤权／续租不旁路 |
| PA-02 用途默认值 | 未获 B 资格时拒绝；获资格且无用途限制时按支持能力可选；仅允许中转时作为入口／出口均拒绝；能力声明不能扩大授权 |
| PA-03 混合与自由组线 | 自有 A／C 与授权 B 可创建 A → C、A → B → C，无需管理员预建线路；任何一跳撤权／用途变更后新操作和存量执行按约定收敛 |
| PA-04 查询隔离 | 列表、详情、按 ID 读取、计数、分页、筛选、引用、Operation、诊断、历史、聚合与通知不泄露乙的私有资源或规则；直接请求与 UI 结果一致 |
| PA-05 保存／临时线路 | 相同有权限组合两种入口都能创建；保存不预留端口、不继承健康或额外授权；引用新版本须显式应用，原版本继续有据可查 |
| PA-06 端口并发 | 并发创建／修改在原 Runtime 中产生确定的预留结果；个人配额同时检查且失败整体回滚；平台上限与额度错误可区分 |
| PA-07 带宽／流量 | 只对管理员提供资源按约定归属计量；多跳／双向口径一致；重复、乱序、重启、缺测、断网和超限行为符合明确契约；自有资源不误扣 |
| PA-08 命令与清理 | 创建／更新／复制／启停／删除／重试／批量应用的幂等、CAS、授权、部分失败和清理保持原 owner；未知结果不会被显示为成功 |
| PA-09 观测可信度 | 保存、Operation 成功、运行报告和可达性分别显示；旧 epoch／generation／过期证据不冒充当前；缺测不补零；整机数据不冒充个人额度 |
| PA-10 探测范围 | Direct TCP、受控 TLS／Echo 按实际 flag／capability／permit 工作；Relay／多跳或非受控 UDP 未支持时明确拒绝；探测不能扩展资源权限或连接任意地址 |
| PA-11 真实使用流程 | 普通用户从接入到混合组线、修改、查看流量、发起适用探测、处理失败和停止，不需手工输入 Scope、摘要或 fence；治理入口保留必要详情 |
| PA-12 迁移与恢复 | 存量归属不被猜测或转移；旧兼容入口、历史回执、租约、authority／Journal、fence、账本及恢复行为保持规定边界；无法迁移明确拒绝并给出操作路径 |

## 7. 尚未确定的产品参数

这些问题不阻塞本次源码缺口分析，实施对应切片前再集中确认，不当作已获授权的默认值：

- 账号通过邀请、管理员开通还是自助注册进入，以及用户停用／离开后的资源处理。
- 管理员资源按个人还是分组授权，是否需要期限；资源上限的具体数值。
- 带宽／流量口径已在后续回复中确认，具体执行／兼容方案见 FR-0032；初始分析时
  的待选项不再构成产品阻塞。参数数值由管理员逐用户／机器显式配置，余额在线
  导出尚未提供，不能用原遥测补算；未来精确送达计费需要另立契约。
- 共享机器可向使用者展示哪些整机指标，以及管理员因治理可读取哪些私有业务信息；
  治理权不等于任意读取或转授权，需形成明确字段／操作矩阵。
- 首批部署平台、支持规模和监控保留期；Relay／多跳首次需要哪些真实测量位置。

技术侧的 Scope 映射、持久字段、事务接线与接口版本由开发者提出有源码依据的方案，
不要求用户替开发者选择实现细节。自动策略、支付结算和外部执行后端不由这些参数
隐含开启。

相关资料：[框架诊断与路线](forwarding-open-development-plan-2026-10-21.md)、
[参考学习](forwarding-reference-study-2026-10-21.md)、[开发方案](development-plan.md)、
[readiness](foundation-readiness.md)、[历史准确修订接受](foundation-verification-2026-10-19.md)。
