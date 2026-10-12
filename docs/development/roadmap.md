# TuneX VNext Implementation Roadmap

**状态：实施进行中，各阶段出口尚未完成。** 历史 V2 已隔离到 `legacy/v2/`；新工作区首先实现 Core、契约解析与离线 Planner，详情见 [实施进度](progress.md)。当前目标是 Core/Forward v1、Control API v1 与 **ADP/2**；[ADR-0002](../decisions/0002-runtime-contract-closure.md) 记录契约修订。下面各出口需要真实证据，文档存在不算完成。

## Phase 0 — 契约与开发入口

- 冻结 Core 不变量、Control API/Operation、ADP/2 direct Schema/fixture、运行默认值和节点注册恢复行为。
- 确定 packages/core、packages/contracts、apps/control、apps/web 和 Go Agent 的工作区、构建工具与版本；不创建空目录充数。
- 明确旧 agent/ 保留为只读参考的位置。新 Agent 在独立工作区或分支实现；不能一边要求原目录只读、一边原地改成新协议。
- 建立本地 MySQL、Linux 网络 namespace/容器测试入口、文档链接与契约校验。Redis 非必需，默认不引入队列基础设施。
- **出口**：Hello/续期/Report、Operation 终态、事务所有者、失效与资源切换没有互相冲突的解释；TS/Go 对共享 fixture 的合法/非法输入结果一致。

## Phase 1 — 最小 TCP 纵向闭环

- 纯 Core parser/CAS；最小 scope/owner/grant、Node 注册与凭据校验。
- 一个共享 MySQL 事务提交 Forward、端口预留、Runtime Operation 和幂等响应；实现持久 scanner/Worker claim。
- 静态 driver registry、能力校验、native.direct.v1 TCP 与 ADP/2 Hello/Snapshot/Report 同步实现，避免先搭完整控制平台再等待 Agent。
- 最小 CLI 或 Web：创建、查询 desired/applied/health、查看 Operation；不要把基本故障诊断推迟到 Phase 5。
- **出口**：从真实 API 请求到独立客户端/目标的 TCP 双向 payload，验证 Node 身份、持久 ACK、端口冲突和创建响应丢失重试。这只是内部开发里程碑，不是完整 v1 验收或发布。

## Phase 2 — 完整单节点生命周期与故障门槛

按小纵向切片推进：

1. 修改目标/端口、启停、删除、普通 drain、TCP 半关闭；Listener 和旧执行实例分开管理。
2. UDP reply mapping、多客户端隔离、idle expiry、TCP+UDP 双预留及实际单协议失败。
3. 续期不重启、同 generation 异正文拒绝、硬截止关闭存量连接、重启必须在线建新 session。
4. Worker 崩溃、Redis 不可用、报告/请求重放、连续修改/delete、旧 fence 回调、旧 boot 报告、持久状态损坏。
5. 节点凭据轮换、授权收回、目标 DNS/CIDR 校验、容量和 Node 总资源预算。

- **出口**：[验收矩阵](../testing/acceptance-v1.md) 指定的 direct 必测项全部通过；证据包含实际状态、payload、资源回收和版本。TS/Go Schema 通过、模拟 Agent 通过均不能代替实网。

## Phase 3 — Native relay 与其全部前置契约

先完成以下文档/契约，再写 Relay：

- 不可变 Transport Profile revision、授权解析、驱动 config Schema、能力协商，不能推迟到 Phase 4。
- 专门 ADR 确定数据面传输、双端身份认证/加密、TCP/UDP framing、Node 可达地址、内部监听资源、超时/重放限制；执行 [Relay 安全门槛](../operations/node-security-and-recovery-v1.md#5-relay-前置安全门槛)。
- 定义 ingress/egress Assignment Schema、无外部 listener 的角色如何标识内部物理资源/fence、Report 样例，扩展契约必须同步双方解析器，不能把任意 JSON 当支持。

实现尾到头 prepare → activate → active/ready 确认，再开放客户端入口。验证失败补偿、新旧路径实例、旧报告与重连；默认不承诺 UDP 会话透明迁移。

- **出口**：真实双 Agent TCP/UDP 流量、错误对端身份拒绝、下游只有 prepared 时入口保持关闭、下游失联可观测、切换/清理符合策略。公网生产不能使用未经认证/加密的实验通道。

## Phase 4 — Transport 演进

- 在 Phase 3 已有安全传输和 Profile 基础上扩展驱动、密钥轮换自动化、Link 复用；不在这里首次补最基本的节点间认证。
- 高级多跳、QUIC、自定义 TST 等分别由 ADR、版本化协议、安全审查与真实验收决定，不能因文档提过名称而视为支持。
- **出口**：native parity、能力拒绝、no-downgrade、密钥到期/轮换和负面身份测试通过。

## Phase 5 — 产品模块与发布

- 统一 Forward-first Web、完整 Node Management、可查询日志/审计；可选路由、计量、计费、通知、联邦按需求单独排期。
- 基础授权、硬限额和错误诊断是前期必需能力，不属于可移除的商业产品模块。
- **出口**：移除可选模块仍能独立转发；发布另需 Linux 实网、资源/性能测量、外部 MySQL/Redis/反代部署、旧备份恢复及凭据轮换演练、SBOM/许可证与运行手册。无上述证据不得生产就绪声明。

## 工作拆分与证据

每个工作项必须包含：目标行为、契约/字段变更、数据库约束、失败/恢复路径、验收 ID、可执行测试命令和结果链接。状态使用 planned/implementing/verified，只有绑定 commit SHA 与证据的项可标 verified。不要把文档勾选当实际进度。

每次切片采用“契约 → Core/Control/Agent → 集成 → 真实网络”完成，不先横向移植全部 V2 模块。发布或合并流程遵循仓库设置，旧 V2 CI 绿灯不证明 ADP/2 通过。

## 建议仓库布局

```text
apps/web/
apps/control/src/{api,modules,infrastructure}/
packages/core/src/
packages/contracts/src/{control,agent}/
agent/internal/{control,assignment,ownership,forward,transport}/
deploy/
docs/{architecture,spec,protocol,development,testing,decisions,operations}/
legal/
```

这是最终布局，不是当前代码状态。迁入新 agent/ 之前须完成旧实现归档/隔离决定；不得把旧构建脚本误用于新部署。
