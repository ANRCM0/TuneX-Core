# TuneX 隧道与转发管理框架

## 2026-10-18 严格地基与并行开发约定

后续开发优先遵守 [四层边界](foundation-layers-v1.md)、
[地基变更申请](../templates/foundation-change-request.md) 与
[DoD/并行门禁](../testing/verification-status.md)。现有领域 Core 与新增最小
运行时决策同属 L0，L1 宿主经公开端口调用 L2 provider，L3 只组合公开能力。
本轮已实现第一批真实拆分与预览样例，尚未集中验证；原较窄框架收口不代表整个
严格地基已完成，不提前开始产品功能并行开发，也不扩张 Core 或另开执行权威。

## 2026-10-18 基础接入框架源码收口

[分类接入框架 v1](framework-integration-v1.md) 将本文既定三类接入落实到现有
Direct/Relay/多跳和管理/观察服务。[Core 公共表面](../spec/core-v1-surface.md)
按源码范围冻结，新增功能优先复用 owner 公共用例、窄端口及具名装配。
本次范围包括契约分入口、Agent 宿主注册契约和独立任务/请求关闭；当前仅源码
收口、未集中验证，本文其余产品目标不因此自动完成。

## 2026-10-18 D1 Controlled Direct Ingress TLS 增量

[ADR-0045](../decisions/0045-direct-ingress-tls-probes.md) /
[契约](../spec/direct-ingress-tls-probes-v1.md) 接通真实原 Direct TCP 规则上的受控
TLS握手；不是再造同主机TCP connect子集，也不是把Direct改成TLS终止器。manager
选择当前服务metadata CAS/config revision/digest，原Probe owner每阶段经窄resolver
重验其权限/窗口/策略与原Forward/实例。registry只提供公有trust，不mint许可或私钥。
Runner保持监听/票据所有权，原Gate/两秒/全局256/撤销watch/有限计划不变；独立v3
资格不续原slot，旧v1/v2不扩义、不降级回退。握手records是真实Forward payload并
计业务字节，不代表零业务流量、外部入口、应用健康或其他协议成功。
fullcontext仅有界offer/permit，结果与历史只compact selection/contextDigest和TLS
白名单proof；旧telemetry仍egress-only。下方0035“没有client”是先前首片历史，本片
已连接原owner但未验收。新flags默认关闭，所有源码/Schema0036/Console/运维未运行
测试、检查、校验脚本、网络、build、CI或Git状态改动；D1/C3与物理/生产安全门槛继续开放。

## 2026-10-18 D1 Observation Service 声明增量

[ADR-0044](../decisions/0044-observation-service-authority.md) /
[契约](../spec/observation-services-v1.md) 新增独立 manager 声明 owner，不创建第二
Probe/Forward/Runtime 执行 owner。当前 metadata CAS 与 immutable configRevision/
digest、专用 public leaf pin、归档/恢复隔离和有界 detail 审计组成可读元数据，GET/
发布/归档不访问网络/私钥，不证明服务 ownership、可达性或健康。历史配置不是当前
授权，后续 issuer/watch 必须重查当前 head/config/digest、权限/NodeGrant/策略/窗口。
独立 Linux TLS-only responder 由 operator 有限启动，来源 CIDR 非 Scope client auth；
registry 不能远程 kill/续期该进程。无 Agent 新 TLS 测量/nonce echo 或 health，现有
执行权、Probe 协议/预算、Journal/high-water不改。新 Docker/Compose 仅未 build/release
源码；本片无测试/检查/脚本/CI/网络/Git，D1/C3/物理/生产门禁仍未通过。

## 2026-10-18 D1 Typed Direct Ingress 增量

[ADR-0043](../decisions/0043-typed-direct-ingress-probes.md) /
[契约](../spec/direct-ingress-probes-v1.md) 将已有 Probe 扩为显式类型化的同 Agent
Direct TCP 入口自连接，不创建第二 Forward/Runtime/Probe 执行 owner。当前实际数字
监听 socket 必须匹配原 Resource/执行实例，继续经过 Node listener/port 与原目标
CIDR 策略；不提供任意网络测试。独立 probeVersion2 family 只资格化原 Gate 代次，
统一两类型 poll；旧 wire 不变，不向旧 Agent 误派入口。每步当前授权/资格/完整绑定、
原两秒/全局预算/一次 burn/watch 与有限计划同事务事实保留，恢复不重建权威。
Schema0034 给新来源显式类型，旧缺键 hash 不改；v1 Probe telemetry/rollup 保持
egress-only，新入口不混 series。默认关闭 Control/Agent opt-in 不是 liveness 或健康。
自连接可能触发业务处理/下游拨号；不是监听 owner 证明、外部/全路径/应用健康。
本地源码未验证，无检查/测试/脚本/夹具/CI/网络/Git；D1 其他观测/健康与 C3/物理/
发布门禁继续开放。后续仍按已确认框架推进，不重建已落地的原 owner 或缩小安全边界。

日期：2026-10-18（Asia/Shanghai）。
状态：**Accepted for incremental implementation / 已确认的增量开发方向**。
用户已要求按此方案推进；首批逻辑隧道入口见
[ADR-0026](../decisions/0026-logical-tunnel-management.md)，已实现、未验证。
本文其余目标仍不自动等同于已实现能力。

本文按用户确定的产品定位设计：管理节点上的隧道与 TCP/UDP 转发，吸收同类开源
项目的产品特点，并通过适配器接入合适的实现。已有源码不因本文而自动改变协议、
Schema 或状态所有权；涉及变化的部分按对应功能单独演进。
开发节奏沿用 [当前约定](../maintenance.md)：先开发，冻结后集中测试与修复。

## 1. 产品范围与部署结构

两个主业务是 **Forwarding（转发管理）** 和 **Tunnels（隧道管理）**。
Nodes、访问控制、Transport、运行观察和运维支撑这两项业务。
暂不将计费、工单、任意插件市场或通用 VPN 管理纳入基础框架。

部署继续采用模块化的 Control 和独立 Go Agent：

- Console/CLI 调用 Control 的应用用例。
- Control API/Worker 共用业务模块和 MySQL，可以按现有方式分进程运行。
- Runtime 是 Control 内部的执行管理模块；Go Agent 在节点执行真实网络操作。
- 扩展模块默认与 Control 同进程装配；共享事务只通过明确的模块接口传递。
- 外部引擎作为节点侧可选实现。是否使用库或子进程由具体适配器确定。

后续功能先按模块增加代码，只有实际部署、隔离或规模需求成立时才拆独立服务。

## 2. 五个容易混淆的对象

| 对象 | 含义 | 不应混入的含义 |
| --- | --- | --- |
| Node | 可执行网络任务的受管理节点，具有身份和能力事实 | 在线不等于业务可达 |
| Forward | 用户希望将某个监听端口的 TCP/UDP 转发到指定目标 | 规则不等于当前 socket 或已成功部署 |
| Tunnel | 用户管理的承载定义，描述参与节点、传输方式、锁定配置及可服务的业务能力 | 配置被多个规则引用不等于物理连接已经共享 |
| Path | 有序节点或已解析的转发路径 | 路径模板不等于真实网络连接 |
| Link / Connection | 节点上实际存在的承载连接、会话或连接池对象 | 不能用它替代 Forward 身份或每条规则的授权 |

一个 Forward 可以直接转发，也可以绑定某个精确 Tunnel 修订。一个 Tunnel 的定义
可以服务多个 Forward。首阶段允许每条规则使用独立执行实例；物理连接复用以后
由 Runtime/Agent 的专门机制完成，界面明确区分配置复用和物理复用。

Tunnel 定义至少有身份、Scope、修订、参与节点、精确配置引用和能力约束。
Forward 保存最终目标，Tunnel 提供到出口的承载能力。具体引擎的密钥、原始配置
和配置字段属于 Transport/适配器，不进入 Core 的 Forward 对象。

## 3. Core 只保留最小领域语言

Core 是无 IO 的纯代码包。现有 `packages/core` 可以直接作为起点。

| Core 内容 | 具体职责 |
| --- | --- |
| 基础标识和值 | NodeId、ForwardId、ScopeId、Revision、协议、端口、地址 |
| 最小实体 | 当前 Node 的 id/scopeId/revision；Forward 的身份、修订及期望配置 |
| 配置值对象 | ListenEndpoint、TargetEndpoint、固定 PathSpec、精确 TransportRef |
| 封闭解析与规范化 | 拒绝未知字段、规范地址/协议顺序、生成独立不可变值 |
| 纯规则及变更判断 | 路径无重复节点、字段组合合法、预期修订匹配、无变化不递增、耗尽拒绝 |
| 纯结果类型 | 校验问题和变更结果，不包含 HTTP 状态或数据库异常 |

Core 的判断只依赖传入的值。例如，Core 判断端口是否在合法范围；端口是否已经
被占用由 Runtime 判断。Core 判断路径结构；节点是否存在、是否有权限由所属
业务模块判断。Core 给出修订变更决定；数据库事务负责真正的原子写入。

Core 不处理用户、角色、Grant、节点注册/心跳、Tunnel 生命周期、Profile 内容、
自动选路、探测、统计、告警、Operation、资源预留、租约、Journal、驱动加载或外部进程。
HTTP、MySQL、文件系统、时钟读取和网络调用同样留在外层。

Tunnel 的完整领域模型先放在 Tunnels 模块内部。以后确实需要跨模块共享时，
可以通过明确契约加入最小 `TunnelRef` 等值对象；本文不直接修改 Forward v1。
业务模块自己的纯函数和领域模型仍属于该模块，不能因为“纯函数”就全部搬入 Core。

修改 Core 的理由应是现有基础语义无法表达共同需求。新增一种引擎、一个表单或
一种配置格式，通常只需要业务模块/适配器变化。Core 保持少量具体函数和类型。

## 4. 业务模块与数据归属

以下是逻辑边界，不要求立即把现有文件全部移动为同名目录。

| 模块 | 拥有的业务与数据 | 对外能力 |
| --- | --- | --- |
| Identity / Access | 用户、Scope、成员、角色、用户凭据 | 身份验证、Scope 权限判断、成员管理 |
| Nodes | 节点注册、身份、节点策略、Node Grant、凭据生命周期、能力/在线事实 | 管理节点、读取已授权能力、管理节点使用权限 |
| Forwarding | Forward 意图/历史修订、启停删除意图、执行主体及绑定用例 | 创建、编辑、复制、启停、删除、查询、显式重试入口 |
| Tunnels | Tunnel 定义/修订、精确 Profile/路径引用、绑定来源、引用影响；后续组/备用路径策略 | 创建/修订定义、引用预览、显式发布、归档、切换提案 |
| Transport | 驱动能力声明、配置 Schema、不可变 Profile、Profile Grant、Endpoint 配置 | 校验并解析授权配置、能力匹配、生成受限编译输入 |
| Observability | 有界观察、Probe 计划/结果、指标/历史、健康判断、告警与通知状态 | 查询诊断、显式探测、历史聚合、告警投递 |
| Audit / Operations | 审计查询、脱敏支持包、备份清单、升级/恢复操作流程 | 有界导出、只读评估、调用既有恢复入口 |

访问权限由对应数据所有者维护：Scope 成员归 Identity，Node Grant 归 Nodes，
Profile Grant 归 Transport。未来 Tunnel 的独立权限只有在 Tunnel 模块定义相应
资源时增加；持有一个配置引用不能自动获得它所引用节点或 Profile 的权限。

Forwarding 的职责是维护用户意图并接受用例。实际 Operation、Deployment、
Snapshot、端口和租约属于 Runtime。Tunnels 可以产生展开配置和切换提案，
不能自行建立另一套 Forward/Operation 或直接发 Agent 命令。

Probe 保留既有独立、受限的许可所有者及单次消费机制；它不取得 Forward
的部署授权或租约权。告警和健康计算消费观察事实，不能直接覆写 Applied 状态。
自动切换作为后续 Tunnels/Routing 的显式策略模块消费这些事实，并重新走授权接受流程。

审计事件由原业务变更事务记录；Audit 查询和导出不得改写业务表。
备份/恢复继续调用既有 Authority/Journal/数据库恢复流程。

## 5. 隧道管理的首阶段与后续阶段

当前仓库已有 Profile、Endpoint、路径模板、绑定和隧道只读查询；尚不能据此
宣称已有独立 Tunnel 执行资源或物理连接共享。

建议先将它们组合为明确的隧道管理业务，而不是另建全部底层机制：

1. Tunnels 管理不可变的逻辑隧道定义，引用精确 Profile、Endpoint 和有序路径。
2. Forwarding 接受规则对精确 Tunnel 修订的绑定；对现有 native 能力，将其展开为
   原 ForwardSpec，与 Forward CAS、来源记录和原 Operation 在同一事务中接受。
3. Tunnel 修订发布后，已有规则保留原锁版。用户先看引用影响，再明确选择更新规则。
4. 首阶段复用原逐规则执行资源。隧道页面分别显示配置版本、引用规则和各执行状态。
5. 有明确的常驻隧道/物理复用需求后，再定义 Runtime 内的 TunnelDeployment、
   消费者关系和实际 Link 生命周期，并同步机器协议/Agent 支持。

首阶段操作名采用“新建定义、发布修订、更新选定引用、归档”。归档禁止新绑定，
已展开规则按原生命周期继续管理。界面不能把归档显示为已停止全部流量。

“停用隧道并影响现有规则”应作为独立的显式命令：列明影响范围、权限、逐规则
停止或切换结果、未知结果及排空进度。此流程实现前不提供模糊的总开关。

物理复用引入后，Runtime 负责端口、部署租约和消费者资源记录；Agent 负责实际
连接/会话。每条 Forward 的授权和统计独立，删除一个引用不能关闭其他合法消费者，
最后一个引用退出或承载失权后必须由同一执行所有者回收。
Transport 只提供池化配置/策略及逻辑引用；实际资源所有权仍在 Runtime/Agent。

现有 Forward v1 对 native 路径和 Profile 有明确限制。异构多段隧道、单节点外部
引擎等无法无损表达的能力，先作为版本化扩展设计；不能通过自由 JSON 或伪造
native 配置绕过这些限制。自动选路若不修改用户意图，应推进已解析部署代次，
不能后台改写用户 Forward revision。

## 6. Runtime 与 Agent 的边界

| Control Runtime | Go Agent 宿主 | 引擎/驱动 |
| --- | --- | --- |
| 持久 Operation、部署计划、Assignment、Snapshot | 校验机器协议、身份、会话与配置代次 | 执行已接受且已授权的配置 |
| 端口仲裁、预留、历史持有者和退役 | 受保护 Journal、Fence、高水位、防重放 | 监听、连接、转发、协议编解码 |
| 部署授权期限、准备/激活/排空协调 | 执行授权持续检查、截止停止、宿主资源限制 | 按能力完成准备、替换、排空、停止 |
| 对账、补偿、重试和删除收敛 | 驱动分派、进程管理及状态上报 | 返回有来源的执行状态、错误和计数 |

业务权限判断与执行授权分开：用户能够操作规则，由 Identity/Nodes/Transport 等
模块确认；节点在这一刻能否继续执行，由 Runtime 发出的受限授权及 Agent 宿主约束。

驱动可以提出资源需求，但只有 Runtime 接受后才能执行。驱动不自行签发租约，
不写宿主 Journal，也不拥有第二份权威端口表。对外部子进程/系统规则，适配器还
需要明确崩溃、失联、授权到期和残留资源处理方式。

新增驱动不要求都支持相同阶段。能力声明必须明确 prepare、drain、原位替换和
统计是否支持及其限制；上层只提供确实可实现的操作。

## 7. 兼容层按接入方向拆分

“兼容层”是一组受限适配器，围绕系统的输入、执行和观察接口分布。

| 类型 | 输入与输出 | 落点 |
| --- | --- | --- |
| 配置/API 适配 | 外部配置或请求 -> 有损项说明/转换预览 -> 本系统业务命令 | Control 外侧 integrations 或 API adapter |
| 执行适配 | 已授权的受限配置 -> 某个锁版引擎/库/子进程 -> 执行事实 | Agent driver adapter；Control 对应配置编译器 |
| 观察适配 | 外部统计、错误或状态 -> 带单位、来源、时间及缺测语义的事实 | 观察来源 adapter |

外部配置导入先预览，再调用原应用命令接受。请求不能经适配器直接写 MySQL
业务表。转换缺失参数、不同超时语义或不支持的 UDP 行为必须显式报出。

每个外部接入只声明实际需要的内容：

- 适配器标识/版本、支持的外部版本及配置 Schema。
- 业务协议与承载协议、节点角色、平台和资源/权限要求。
- 能力差异、错误映射、配置转换限制。
- 启动/更新/停止/排空、崩溃残留和授权到期语义。
- 统计单位、计数重置、时间来源、支持的观察方式。

公共契约中的版本和能力变更必须显式处理。进程内普通接口先用静态类型和明确装配，
不为每个辅助函数建立独立版本体系。能力目录是声明，当前节点事实和执行授权仍需分别判断。

产品工作流、交互和功能组织的借鉴落在业务/UI 模块；库或引擎的实际复用落在适配器。
源代码/资产复用继续遵守仓库已有来源与许可证约定。

## 8. 模块调用与事务规则

允许的代码依赖：Core 只依赖自身；应用用例依赖 Core 和模块公开接口；
适配器实现业务/Runtime 所定义的端口；装配入口连接具体实现。
`packages/contracts` 负责跨进程 Schema、版本、序列化和解析，保持与 Core 分开。

一次修改规则的流程：

```text
Console / CLI / 外部 API 适配器
  -> Forward 应用命令
  -> 同一事务内验证 Scope、节点和配置权限、幂等及 CAS
  -> Tunnels/Transport 返回精确展开配置与来源
  -> Core 校验并决定新意图
  -> 原 Forwarding 写意图、Runtime 接受资源和 Operation、记录来源及回执
  -> 提交事务并返回已接受
  -> Worker/Runtime 发布 Snapshot
  -> Agent 落盘、检查授权、调用驱动并报告
  -> Runtime 对账；Console 分别显示期望、部署与观察状态
```

实际锁顺序和重放顺序沿用既有用例，不按示意流程擅自改动。外部网络调用不放进
业务接受事务；执行失败通过 Operation 和对账处理，不能把超时当成事务一定未提交。
未知写入的显式重放保留原幂等键和请求。

每张权威表只有一个所属模块。跨模块写入调用所属模块的接口；允许把同一事务
传给多个 owner。跨模块查询优先使用公开查询，管理列表可使用已授权、有界的
只读投影。事件用于通知/观察加速，资源与授权的必要原子更新保留在原事务内。

## 9. 代码落点与开发方式

沿用当前目录进行增量组织：

```text
packages/core/                    最小纯领域语言
packages/contracts/               跨进程消息与版本契约
apps/control/src/api/             HTTP 输入、身份入口、响应映射
apps/control/src/application/     创建规则、发布隧道等完整用例
apps/control/src/modules/         Identity、Nodes、Forwarding、Transport 等 owner
apps/control/src/modules/runtime/ 唯一部署与资源管理
apps/control/src/infrastructure/  MySQL、文件、凭据等具体适配
apps/control/src/integrations/    按实际需要新增的外部输入适配器
agent/internal/control/          Agent 宿主与已有驱动注册
agent/internal/authorization/    执行期限检查
agent/internal/state/            受保护执行状态
agent/internal/forward/          原生 Direct 引擎
agent/internal/relay/            原生 Relay/相关承载实现
agent/internal/<adapter>/        有实际需求时新增的外部引擎适配
apps/web/                        转发、隧道、节点、运行观察界面
```

`integrations/` 和新增模块目录是目标落点，不表示当前已经存在。现有扁平模块可以
在变复杂时逐个聚合为目录；不以全仓迁移为功能开发前提。

一个新功能只增加它确实需要的模型、应用命令/查询、存储和 UI。
一个新引擎通常增加能力声明、配置解析/编译和 Agent 适配；只有产生新的执行语义
时才演进机器协议/Runtime。复用先从现有具体接口开始，第二个实际使用者出现后
再提炼共同部分，不预建通用模块基类、动态插件平台或任意参数执行接口。

新增能力的边界判断：

| 需求 | 首选位置 |
| --- | --- |
| 修改端口、IP、固定路径的基础合法性 | Core，经基础语义评审 |
| 增加隧道分组、备用路径、发布流程 | Tunnels/相应应用用例 |
| 增加转发模板、复制和批量编辑 | Forwarding/Console，复用原接受命令 |
| 接入新的开源转发实现 | Transport 编译器 + Agent 执行适配器 |
| 导入某项目配置 | 输入适配器 + 原业务命令 |
| 流量图、连接计数、历史和告警 | Observability + 受限采样来源 |
| 变更多节点激活、租约或物理资源复用 | Runtime/Agent，独立执行契约演进 |
| 数据库索引或存储实现调整 | 所属模块的 infrastructure 适配 |

## 10. 从当前代码推进

1. 保留当前 Core 和统一 Runtime/Agent 宿主，把本方案用于后续功能归属判断。
2. 在已有 Profile、Endpoint、模板和绑定上形成隧道业务用例与统一界面，明确哪些
   是配置状态、哪些是规则部署状态；新增 Tunnel 实体及授权采用独立增量设计。
3. 继续指标、有界历史、隧道/转发管理功能；开发阶段记录待验证项。
4. 选择一个收益明确的外部能力实现具体适配器，再据真实重复点调整公共接口。
5. 有需求时演进物理承载复用或自动切换，分别保留明确的资源和策略责任。

首批已按 [逻辑隧道管理 v1](../spec/logical-tunnel-management-v1.md) 收口现有定义、
发布/归档、精确拓扑、规则绑定和引用影响入口；复用原路径模板的持久标识及原
Forward 接受，不新增独立 Tunnel 实体或物理连接共享。后续必要契约变化继续写入
增量 ADR；本文是已确认方向，不是全部代码改造完成或功能验收通过的记录。

2026-10-18 [C2-A 路径组](../spec/path-groups-v1.md) 继续在 Tunnels 所有权内实现
出口候选组/固定备用完整路径的不可变修订与来源；操作者明确选择单一候选，仍通过
原 ForwardCommands 接受，与原路径绑定及 Runtime Operation 同事务，不创建新执行器。
组拓扑表达 AND 必经顺序与 OR 完整分支，当前不评估健康。入口多 Forward、持久
跨规则 saga/取消/条件补偿及自动切换仍未实现；本批源码未检查或测试，不代表 C2 完成。

随后 [C2-B 持久组发布](../spec/path-publications-v1.md) 在本地编写了显式逐项接受、
取消剩余项和条件补偿。协调器只保存不可变计划/逐项决定/审计，不直接操作 Forward
或 Runtime 表；原 Forward supplied-Tx 命令与其批次回执同事务提交。保存点只隔离已识别
域拒绝，未知提交仍需原键重放。入口多 Forward 创建、C3 和集中验收仍开放，没有后台执行器。

2026-10-18 [C2-C 入口定义/创建](../spec/ingress-groups-v1.md) 第一片在本地编写、未验证：
入口组每成员是一条完整锁版路径、独立 Forward/Operation，而非复用出口候选的 OR
选择语义。预览与持久计划不分配规则 ID/预留资源；明确逐项接受时由原 owner 创建，
原精确 PathBinding、创建批次历史来源及幂等回执同事务，删除补偿仍由原 owner 清理。
历史创建来源不等于“当前入口组绑定”；普通编辑仍由原路径来源的 preserve/detach
规则处理。组修订不自动修改既有 Forward，已有入口部署的成员 diff/显式迁移仍待开发。
没有 VIP/DNS、全局入口 HA、物理连接共享、新 Runtime 或 Agent/Journal 语义。

随后 [C2-C 显式迁移](../spec/ingress-migrations-v1.md) 在应用侧保存精确源/目标定义、
历史直接回执、单独复核的当前 Forward 完整基线和有界增改删计划。来源解析不递归，
不建立“当前组成员”权威；普通编辑不被旧 origin 覆盖或静默 rebase。动作仍经原
supplied-Tx owner 接受，与路径来源、Runtime Operation、尝试和外层幂等回执原子提交。
更新不改变入口/业务意图，删除只请求原清理且不可补偿；其余补偿仍受当前状态和旧路径
授权约束。新增三张协调表和恢复隔离不改变 Core/Agent/Journal，源码仍未验证。

2026-10-18 [D3-A 被动诊断](../spec/forward-diagnostics-v1.md) 从原 owner 表读取单条
Forward 的七层链路与 Operation/清理/历史租约事实，保持当前报告精确来源匹配，
没有主动网络工作或执行权。查询占用既有独立 observation pool，不调用 Runtime
命令、加资源锁或改写状态；同次白名单支持包别名化且不含原网络/配置/凭据材料。
这是源码中新增的被动产品读面，不是新健康权威、完整审计/备份或已验收能力；
站内事件、受控投递及后续自动策略仍按各自增量契约推进。

2026-10-18 [管理审计查询](../spec/audit-events-v1.md) 新增 manager-only 的原 owner
记录投影：授权和读取同事务，固定窗口/精确交集/跨来源 keyset，不新增审计写入或执行
权威。Node 历史取本源不可变配置，恢复操作者及逐项关联不凭空推断，Operation 最新
状态与独立事件日志分开。使用既有 observation pool，不占用 Runtime 池；不返回原始
配置、自由异常或凭据，也不提供导出/通知。当前只读源码未验证，不表示覆盖全部历史、
已证实查询成本或产品/运维目标完成。

2026-10-18 [站内事件与基础告警](../spec/station-alerts-v1.md) 由独立产品 owner 维护
固定政策、派生条件和站内事件。原 Forward/Operation/Node/Report 仍由窄 SELECT 端口
提供事实，不引入新执行/租约/Probe 权威。当前管理身份和有界观察在同事务中评价，
去重/严格恢复/静默保留状态，未知不当作恢复；默认关闭的独立 observer 不复用 Runtime
worker。Schema0029 四表、原恢复隔离和手动 Console 是本地未验证源码；受控外发及其
独立队列、SSRF/凭据/限速/重试仍待下一片，不能把站内事件视为已完成通知或生产验收。

2026-10-18 [受保护通知端点](../spec/notification-endpoints-v1.md) 是独立通知产品 owner，
不是 Runtime 执行插件。元数据、订阅与有界审计使用原授权/幂等/CAS 和观察池；凭据由
单 writer 的独立 Linux vault 持有，不复用 Authority key、不在 SQL/支持包回显秘密。
GET 不读取凭据或发网络，安全停用不依赖 vault；恢复只挂起，显式重新发布才采纳新恢复
身份。HTTPS sender 有独立 DNS/IP/TLS/容量边界但尚未接线，当前无 outbox/外发/发送
定时器；下一片再接站内事件交接及限速/重试/死信。源码存在不等于网络安全、恢复或
功能已验收，不改变 Core、Agent/ADP、Journal/high-water 与原 Forward/Operation 权威。

2026-10-18 [有界通知投递](../spec/notification-deliveries-v1.md) 随后将新站内事件同事务
交给独立 outbox，冻结固定非秘密摘要和政策/端点/凭据修订；不回扫历史或由读取生成
待发。默认关闭的独立 worker 持久接受 claim/fence/rate 后，在事务外获取当前凭据、
解析 DNS 和发送 HTTPS；DNS 后再次通过原 owner 短事务复核当前管理权、订阅、静默和
恢复身份。凭据引用 pin 到真实依赖 drain，迟到结果不能越 fence，超时不伪造完成。
队列/明细/尝试/寿命/速率/退避均有界且披露损失，恢复取消旧待发但保留终态与速率，
不自动重放旧事件。Manager 只读历史与 Console 不提供发送/测试/重驱动作；HTTP 接受
不是端到端成功，无 exactly-once/顺序保证，也不保证发送前复核后的绝对即时撤回。
Schema0031 仅属通知元数据，不改 Core、Runtime/Agent、Authority key 或 Journal/high-water；
通知失败不改原部署结果。以上均为本地未验证源码，不代表 D3/全项目或生产门禁通过。

2026-10-18 [ProbeRun 历史](../spec/probe-runs-v1.md) 是 Observability 的独立有界读模型，
由原 ProbePermits 的实际接受/生命周期/结果 mutation 经窄白名单端口同事务捕获，
不是新的 Probe 许可/执行/计划 owner。原两秒许可、全局预算、实例/绑定复核、短期
结果和 Agent 行为不变；历史不存机器 fingerprint、requestId、原 wire、目标地址或配置。
历史表与原 permit/Forward/Node 没有删除级联，有限保留/淘汰及 missing-update 计数
披露不完整性；丢历史不撤销或退还实际授权，读取不回扫或重建旧任务。
Manager 查询使用原历史来源、固定窗口/精确筛选和 observation pool，不请求 Runtime
或当前机器状态。consumed 不证明执行过、无结果不当失败，历史 connected 不赋予当前
健康或自动切换资格。原恢复只 sticky 标记并推进历史修订，保留实际生命周期/结果事实。
Schema0032/Control-only Profile、只读 API 和 Console 均为本地未验证实现，未新增
机器协议/外部 Probe/自动调度；集中验收、其他 D1 能力和物理/发布门禁仍开放。

2026-10-18 [有限 ProbePlan](../spec/probe-plans-v1.md) 是应用层的独立配置/决策 owner，
不是新的 Probe 执行权威。预览与创建只存精确修订和原始绑定；每个手动或显式委托的
scheduled 决策仍在同事务调用原 Probe owner、原权限/实例/预算和 Run 捕获。有限计划
只能缩短原两秒许可，不扩期、不续 Forward、不启动业务 Runner，不在 Control 做网络。
默认关闭的小 worker 不补漏过 tick；配置 flags 不证明 liveness。有限 Scope/决策/
寿命/间隔、终态保留与 loss 是产品预算，不把接受/消费/completed 当 dial 或健康。
取消不追溯撤回已接受许可，恢复只 sticky/suspend、不恢复或重放旧计划。Manager
API/Console 采用原 CAS/幂等和独立 observation pool，未知提交保留原键不确定性。
Schema0033 仅是 Control 配置/历史表，不改 Agent/ADP、Journal/high-water 或 Forward/
Operation 权威。以上是本地未验证源码，其他 D1 观测与健康聚合、C3/物理/发布门禁
仍未完成，不以固定计划调度替代已声明的独立探测范围或自动故障切换前置。

## 参考基线

- [Core v1](../spec/core-v1.md)
- [模块边界](module-boundaries.md)
- [ADR-0006 分类接入](../decisions/0006-classified-extension-contracts.md)
- [A5 source closure](foundation-a5-source-closure-v1.md)
- [原生隧道管理](../spec/native-tunnel-management-v1.md)
- [路径绑定](../spec/native-path-bindings-v1.md)
- [四主线方案](../maintenance.md)
