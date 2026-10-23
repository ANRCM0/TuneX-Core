# 以转发为中心的参考学习记录

日期：2026-10-21（Asia/Shanghai）。范围：Forwardx 学习结论与参考 TuneX 源码分析。

本记录响应“开放、可维护、可开发，以转发为中心”的项目目标。重点是把成熟产品的
具体经验转化为开发者能够理解和扩展的契约、范例与维护流程。D1 负载、长稳与真实
部署环境验证继续承担运行质量门槛；开发者扩展体验也是后续主线。

方向收敛：以自研原生转发、可信源码贡献和完整产品为主线，先形成框架诊断再选择
真实扩展。下文的外部引擎属于参考事实，不是当前后端接入路线；导入与限速也尚未
确定为首个实现任务。

## 1. 范围与证据

| 项目 | 本地参考目录 | 阅读修订 |
| --- | --- | --- |
| Forwardx | `D:/my-project/references/Forwardx` | `1b9b80cc3cacde3603ad0e9b8c831baa4a7fc41b`，`main` |
| 参考 TuneX | `D:/my-project/references/TuneX` | `5a5a1f19d44ed82889d7bec981939059e18fe4a0`，`master` |

参考 TuneX 的 README 自述为依据分析材料重建的 RelayX 项目，与当前 TuneX-Core
是不同仓库。这里只分析所列修订的源码；不据此认定与原程序完全一致或支持其全部能力。
下文参考路径均相对对应参考仓库根目录，行号只适用于上述快照。

本轮工作说明：

1. 层级：阅读既有 L0–L3 调用链，新增开发学习文档。
2. 公共接口：核对当前 Forward、Runtime、执行宿主及模块公共集成说明。
3. 地基：不修改实现。
4. 契约：不新增或改变冻结接口与语义。
5. 验收：仅源码与文档阅读；未执行测试、静态检查、构建、网络或运行实验。
6. 并发影响：不启动模块开发，不修改参考仓库；保留原有工作区修改。

参考源码不成为当前项目的导入、构建、运行或部署依赖。本记录不代替 readiness、
准确修订的 Actions 结果、性能测量、独立物理主机证据或发行决定。

## 2. Forwardx：“引擎”及其管理闭环

### 2.1 四个不同维度

| 维度 | 含义 | 例子 |
| --- | --- | --- |
| 业务协议 | 接收与转发什么流量 | TCP、UDP、两者 |
| 执行引擎 | 最终由谁执行转发 | 内核 NAT、Realm、GOST、Nginx Stream |
| 传输方式 | 节点之间如何通信 | TLS、WSS、FXP、WireGuard 外层 |
| 拓扑 | 流量经过什么节点与资源 | 本机转发、入口／出口、转发链、多跳 |

例如同一个“TCP 10000 转到 10.0.0.8:443”的需求，可以编译为 NAT 规则、Realm
配置或 Nginx Stream 服务。不同后端的更新、排空、统计、错误与恢复能力需要分别声明。

`shared/forwardTypes.ts:1` 的普通转发类型有六种：

| 引擎 | 执行位置 | 管理重点 |
| --- | --- | --- |
| iptables | Linux 内核 | NAT／放行／计数规则、身份、共存与清理 |
| nftables | Linux 内核 | nft 规则、计数、共存与清理 |
| Realm | 外部用户态进程 | 配置、服务、监听、启动与更新 |
| socat | 外部用户态进程 | 命令与服务，TCP／UDP 的服务组织 |
| GOST | 用户态转发运行时 | 服务、传输链及部分共享运行时增量更新 |
| Nginx | Nginx Stream | 四层转发配置、监听与服务生命周期 |

仓库另带 `forwardx-fxp` 独立 Go 程序，Agent 生成配置并启动它；V2 路径结合
Agent 内置 userspace WireGuard。相关入口是 `agent/main.go:10152` 和
`docs/guide/tunnels.md:17`。没有运行比较，不能据此给引擎排性能名次。

### 2.2 沿一条 Realm 规则看完整调用链

| 阶段 | 实际职责 | 源码入口 |
| --- | --- | --- |
| 创建 | 权限、端口、配额与配置校验，保存后触发 Agent 刷新 | `server/routers/rules.crud.ts:939` |
| 编译 | 根据引擎生成监听、目标、服务定义及相应命令／配置 | `server/agentHeartbeatRoute.ts:5284` |
| 下发 | 带 revision/hash 的期望动作；SSE 加快通知，心跳保留同步路径 | `server/agentHeartbeatRoute.ts:6599` |
| 执行 | Agent 解析动作，协调依赖、同资源串行化及共享运行时互斥 | `agent/main.go:2323`、`agent/actions.go:1920` |
| 展示 | 区分启用、下发、运行确认与探测可用 | `docs/guide/rules.md:55` |

业务流量在受管主机的转发后端执行；面板组织配置及控制通信。规则引用的端口转发、
隧道、转发链和分组资源也各有产品语义。

### 2.3 值得吸收的经验

| 经验 | 具体实现或边界 | 对当前项目的启示 |
| --- | --- | --- |
| 能力发现分阶段 | `agent/tool_inventory.go:15` 只做轻量可执行文件发现 | 工具存在、版本兼容、策略允许和实际就绪分别建模 |
| 状态可解释 | 配置启用、下发、运行与健康探测有区别 | 每种状态带来源、时间和原因 |
| 快照合并 | `agent/main.go:2507` 串行应用，只保留最新待处理快照 | 评估快照合并价值；不能套用于需逐项记账的业务命令 |
| 配置有恢复过程 | `agent/managed_configs.go` 暂存、校验及回滚 | 把部分启动失败、旧配置保护和清理纳入适配器契约 |
| 缩小变更影响 | `agent/gost_additive_sync.go:450` 的部分新增监听走本地 API | 声明增量更新范围、共享进程影响与失败回退条件 |

GOST／FXP 的部分增量新增不能推广为所有修改、删除、升级和恢复均无中断。
心跳入口集中承接规划、数据库和平台命令，也是维护成本的参考；当前项目继续保留
owner 分工、公共接口和原有事务边界。

这些外部进程与共享运行时用于理解配置身份、应用确认、更新影响和恢复边界。
当前只将适用原则用于检查已有 Direct／Relay／Multihop，不纳入第三方后端接入阶段。

## 3. 参考 TuneX：节点组驱动的隧道配置编译

### 3.1 核心对象与职责

后端采用 Hono、Prisma、Socket.IO，任务可使用 Redis／BullMQ 或本地调度。
Web 使用 Next.js；Go Agent 按配置建立服务与传输链。

| 对象 | 表达内容 | 源码 |
| --- | --- | --- |
| NodeGroup | 入口／出口角色、节点、协议、监听端口范围及倍率 | `apps/backend/prisma/schema.prisma:169` |
| Tunnel | 监听、业务协议、加权目标、入口／出口组、限额与统计 | `apps/backend/prisma/schema.prisma:224` |
| TunnelChain | 隧道关联的中间节点组及方向 | `apps/backend/prisma/schema.prisma:261` |
| UserPlan／Plan | 用户配额、有效期、允许组及流量权益 | `apps/backend/prisma/schema.prisma:344` |

它把节点组作为业务配置生成和分发的重要单位；一个隧道再关联入口组、出口组及
中间链路。套餐、权限、授权有效性和流量限制直接参与“哪些隧道应生成配置”的判断。

### 3.2 从创建到配置下发

1. `apps/backend/src/routes/tunnel.ts:104` 的 POST 接收创建请求，经参数与套餐
   中间件进入 `TunnelService.createTunnel`。
2. `apps/backend/src/services/tunnel.ts:1876` 检查协议、组、端口与数量限制，
   使用用户隧道锁，并在数据库事务内创建 Tunnel 和 TunnelChain。该方法本身没有
   直接发布运行配置；后续由配置任务和节点注册路径完成下发。
3. `apps/backend/src/bullmq/jobs.ts:40` 声明周期任务，其中配置推送间隔为 5 秒、
   等待隧道重推为 30 秒。`local-scheduler.ts` 提供无 Redis 调度，按同一任务表
   触发，但不提供队列重试、延迟与作业持久化语义。
4. `TunnelService.pushNodeConfig:775` 读取活跃组、可用隧道、出口监听及 sysinfo，
   筛选近期有节点活动的组；`getAllAvailableTunnels:830` 纳入授权、用户状态、
   套餐有效期、组权限、数量和流量限制。
5. `getNodeConfig:1112` 按入口／出口角色分派。入口侧为业务隧道编译服务与链；
   出口侧组织传输监听。目标选择、权重、限速、连接限制、访问规则与观测配置一并生成。
6. 配置 JSON 计算 SHA-256；与组缓存不同才更新 hash 并通过 `publishIoEmit`
   发出 Fernet 加密的 `config` 事件。Socket.IO 用组房间广播，Redis 可转递跨实例事件。
7. `apps/backend/src/socket-io/handlers/register.ts:194` 附近还有首次注册下发路径；
   前序注册检查节点组凭据、授权、套餐及组访问条件，再建立节点和房间关系。

配置的主要结构是 `services / chains / observers / limiters / climiters /
bypasses / admissions`。这里形成的是一张“监听、处理、逐跳连接、目标选择”的配置图。
业务命令、运营规则和执行编译集中于同一服务，新增能力通常需要协同修改这些位置。

### 3.3 Agent 的“执行引擎”是什么

`apps/agent/internal/gostcfg/gostcfg.go` 显式建模 GOST 风格配置的一个子集，
其中 Service 包含 listener、handler、forwarder，Chain 包含 hops 和 nodes，
Node 再含 dialer 与 connector。

`apps/agent/internal/panel/panel.go:326` 收到配置后解密并解析；该实现也保留直接
接收 JSON 对象的兼容路径。加载注册授权后调用 `service.Manager.Apply`。

`apps/agent/internal/service/manager.go:146` 以 service name 对账：关闭删除或
判定变化的监听，保留判定相同的服务，启动新增项。`start:230` 按 listener／handler
组合分派给仓库自己的 Go 协议与转发组件，部分能力使用外部 Go 库。

这条主路径由 Go Agent 内部执行配置，并非启动一个外部 GOST 二进制来执行全部
配置。`gostcfg` 的命名和格式不能作为完整兼容 GOST 的证明。

对于典型经中继的 TCP 连接，可按以下过程理解：

```text
业务客户端
  -> 入口 listener 接收连接
  -> handler 按 chain 选择各 hop
  -> dialer 建立连接，connector 完成各跳协议握手
  -> forwarder 选择最终目标
  -> 双向转发并统计
```

具体入口是 `apps/agent/internal/relay/dial.go` 和
`apps/agent/internal/gostcfg/balance.go`。不同协议组合具有各自执行分支，不能把此
示意当作所有 UDP、远程转发或隧道协议均使用相同实现。

选择器包含轮询、随机、hash、连接数及延迟等实现。当前 `balance.go` 对未知策略
回退轮询，`parallel` 也回退；backup 的处理也有自身范围。配置能解析不等于该配置
的每项执行语义都已实现。Manager 还明确返回 `Stub / ErrNotImplemented`；判断
能力要查看实际分派路径，不能只按配置协议名称或单独的 stub 列表推断。

### 3.4 状态、流量与运营闭环

| 通道 | Agent／后端职责 | 主要入口 |
| --- | --- | --- |
| `listen` | 回报成功监听；后端更新出口监听信息及隧道端口等状态 | `panel.go:363`、`socket-io/handlers/listen.ts` |
| `listen_error` | 当前 Agent 对端口占用显式回报；其他错误和 stub 在该路径记录日志 | `panel.go:379` |
| `sysinfo` | 周期回报主机状态，后端维护活跃度和缓存 | `socket-io/handlers/sysinfo.ts` |
| HTTP observer | Agent 采集连接与字节统计；后端累加隧道、套餐及缓存统计 | `panel.go:424`、`routes/tunnel.ts:546` |

observer 路径将 `inputBytes + outputBytes` 换算为 GiB，再乘入口、出口及链路组的
倍率之和，累计用户套餐用量和隧道统计。因此，“实际字节流量”与“按组倍率计入的
套餐消耗”是两个值，产品展示应解释口径。

这里也包含可学习的产品细节：多目标权重、节点组准入、套餐允许组、协议与监听
选择、用量倍率、监听冲突回报。把这些功能接入当前项目时，策略通过明确公共接口
参与命令／预检；平台与外部格式归对应适配器，保持原执行权威。

### 3.5 源码观察到的风险与待验证场景

以下区分可直接读到的代码行为和推断影响。没有执行回归，不能写成实测故障结论。

| 源码事实 | 推断影响 | 后续获授权后需要覆盖 |
| --- | --- | --- |
| `manager.go:224` 的 `sameDefinition` 只比较 listener／handler 类型和端口；Apply 对命中项直接复用 | 同名同类型同端口但目标、地址、chain、认证、限速等变化，可能继续沿用旧运行实例与启动时配置 | 保持名称和端口不变，分别修改目标、链、绑定地址、凭据与限制，核对真实连接行为 |
| `ObserveEvents:196` 在采样时可清零；`panel.go:424` POST 失败只记录日志，没有该批次持久待发或恢复计数逻辑 | 上报失败可能丢失该批增量；不能从“每周期上报”推定可靠计费 | 断网、HTTP 失败、取消、重启及多 observer 部分成功时的数据去向 |
| observer 事件没有批次身份／序号；后端直接累加，套餐与隧道更新是分开的 await | 重复事件可能重复累计，部分数据库失败可能产生不一致 | 重放、响应丢失、部分提交及幂等身份／事务方案 |
| `pushNodeConfig:775` 在 publish 前缓存新 hash，hash 是组级去重状态 | 去重不能证明每个 Agent 接收或应用成功；丢事件且内容不变的恢复需要另看注册或失效路径 | 推送丢失、同组部分节点离线、重连及应用失败后的重发与确认 |
| stub 与部分启动错误在 Agent 只记录日志，该路径没有逐项完整配置结果 | 面板可能缺少精确的“不支持／失败”解释 | 不支持能力拒绝、各类启动失败、部分应用结果和当前 revision 的关联 |

这些观察用于限制可借鉴范围，不构成对参考项目整体运行能力或安全性的完整审计。

## 4. 转化为 TuneX-Core 的扩展方式

| 学习对象 | 当前归属与约束 |
| --- | --- |
| 隧道／规则产品意图 | L3 模块经 Forward 公共命令接入；L0 Forward 不变量保持稳定 |
| 节点组与路径选择 | 对接 Node／Path／Routing 公共契约，保留引用、版本、候选与决策来源 |
| 原生执行与格式边界 | L2 负责原生协议／平台／格式适配；新增执行语义同步覆盖 Control 编译、版本化协议与 Agent driver |
| 套餐、额度、权限 | L3 独立策略／业务 owner，通过公共授权与配额端口参与原事务 |
| 期望状态协调 | L1 Runtime 保持唯一资源账本；命令身份、版本、资源与补偿沿原 owner |
| 启停、更新与恢复 | 使用执行宿主生命周期；Agent Runner 保留 authority、Journal、租约、fence 和恢复 |
| 状态与流量 | 沿原观测 owner 提供有身份、时间、有效期和口径的事实；可靠记账单独定义 |

当前执行宿主可参照 `agent/internal/executionhost/driver.go` 的 Descriptor、
Start、Replace、Phase、Probe 和 Instance 的 Drain／Close／Remaining／
SetAuthorization。它们是可信代码的编译期扩展；不能推定动态插件加载、第三方隔离
或任意外部配置已经获得在线协议支持。

具体开发配方以 [公共集成说明](../architecture/framework-integration-v1.md) 为准，
现有 `examples/foundation-extension` 仍是只读预览范例。

## 5. 当前诊断与下一步交付

先沿“配置 → 命令 → 编译 → 下发 → 执行 → 回报 → 恢复”核对当前框架，标明公共
入口、真实 owner、provider、默认绑定、兼容桥与消费者，区分源码、文档和验证缺口。
已有只读预览示例保持其接受范围，完整原生扩展示例另行形成。

随后对照 Direct／Relay／Multihop 的配置身份、更新、旧连接、授权、排空、错误、
计数和恢复，只对实际重复或错误依赖做收敛。由诊断选择真实扩展，再形成贡献教程，
交代层级、契约、事务、权限、兼容、集成步骤和准确修订验收。涉及冻结接口或语义
变化先记录 FR；不预先把限速或导入定为实施任务。

本轮修订开发路线与文档入口，没有实施产品／引擎功能或改变冻结契约与验收范围。

## 6. 后续交叉方案

全链路地图、已有基础、G1–G6 缺口及 R1–R4 开发顺序，见
[转发框架诊断与后续开发路线](forwarding-open-development-plan-2026-10-21.md)。
Forwardx 的持久待发／报告身份／事务去重，以及参考 TuneX 当前界面导出缺少目标等
观察保留为学习证据，不作为运行验收或已确定的功能清单。
