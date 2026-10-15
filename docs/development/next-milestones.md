# TuneX VNext · 下一阶段开发目标

更新：2026-10-15。本计划承接已落地的 ADP/3 Direct TCP/UDP、双 Agent 原生 Relay、自动换钥、Control/Agent Docker、GHCR Dev/版本发布及用户反馈的 Dev 容器测试。**不把一次用户报告或同宿主机双容器实验当成跨物理主机、长期稳定性或生产发布认证。** 现有契约以 [实施路线](roadmap.md) 和 [验收规范](../testing/acceptance-v1.md) 为准。

## 优先级与执行顺序

| 批次 | 优先级 | 工作目标 | 最低交付及验收出口 |
| --- | --- | --- | --- |
| A | P0 | **部署与发行收口** | Control/Agent 分主机 1Panel 测试、首次初始化/Enrollment 一次性流程可重复；验证 GHCR Dev/版本 Digest、自动发布触发、升级/停止不重复初始化，补目录权限和证书预检 |
| B | P0 | **真正的双物理主机 Relay** | 两台独立 Linux 主机、一个独立客户端与目标；TCP/UDP 精确回传、TLS 1.3 负面身份测试、实际网络断开/恢复、禁止未 ready ingress、资源/端口回收及脱敏证据齐全 |
| C | P0 | **持续运行与恢复门槛** | 无人值守 peer 自动换钥及过期恢复、长时间负载和实际 FD/内存/报文丢失记录、证书/CA 绑定及防错、MySQL + Authority + Agent Journal 组合备份恢复、旧镜像/新 Schema 兼容性决策 |
| D | P1 | **运维监控和管理端完成度** | Node/Forward/Operation 可诊断、错误码/Report/流量指标、日志/审计分页与过滤、Node 创建表单使用可选项及预设、危险操作确认、权限和恢复状态展示 |
| E | P1 | **正式候选与安全签署** | 修复或登记 HIGH 漏洞、许可证/SBOM 审阅、镜像 Digest/来源可追溯、RC 标签及签名/发布手册、Stage 全部出口通过才考虑首个正式 `vX.Y.Z` |
| F | P2 | **传输演进与可选业务模块** | Link 复用与管理、能力拒绝/no-downgrade、QUIC/多跳按独立 ADR 与网络测试推进；再考虑计量、计费、套餐、通知等可选模块 |

P0 可以拆分为并行的测试环境建设与代码加固，但**B 和 C 的结果必须先于 E 的“生产发布通过”**。不得先打正式版标签来替代未完成的验收。Phase 4 的高级传输不是当前发布第一优先级。

## 建议的下一轮四个 PR

### PR 1 · 1Panel 安装与操作防错

目标：把“照着 README 执行”改成“有安全预检且可重复安装”。

- 基于 `deploy/compose.control.example.yaml` 与 `deploy/compose.agent.example.yaml`，加 CI 的独立 `docker compose config --quiet` 验证；保留旧合并示例仅供兼容对照。
- 对单主机角色提供可运行的只读 preflight：检查完整 Digest、目录权限/UID、TLS SAN/CA、Control 访问地址、Agent `secrets` 与 `state` 分离；不打印令牌和私钥。
- 将“首次 Authority 初始化、Owner bootstrap、Node Enrollment、后续重启”做成明确分离的 Operator 命令和拒绝重复执行的负面测试。核实 1Panel 四层 TLS 透传的可行性。
- **验收**：全新空测试数据库一次性初始化成功；同镜像正常重启不重复初始化；错误 CA 或缺失 Journal 严格拒绝；完整 Compose、Linux/镜像 CI 全绿。不得以改写数据或关掉校验让测试变绿。

### PR 2 · 跨物理主机网络验收

目标：补齐当前 Relay 真实部署证据的最重要缺口。

- 两台独立 Linux Agent 使用实际可达的 `advertisedHost` 与内部 TLS/TCP 端口，第三个外部客户端发起流量。
- 分别对 Relay TCP 和 UDP 验证精确字节、相同端口复用、旧连接 drain、双端身份拒绝、断链/防火墙丢包后 Operation/Report/Health 收敛。
- 保留 Host 网络为已验证基线；Bridge 的 `EXECUTION_DEADLINE` 作为诊断工单，分层定位 NAT、端点、TLS 握手/网络故障，而不是默认放宽执行期限或身份规则。
- **验收**：所有数据包和真实角色/网络隔离的诊断证据都能关联 Git SHA、镜像 Digest、内核、配置、测试拓扑；失败不造成残留监听、授权和私有密钥泄漏。

### PR 3 · 发布稳定性与故障恢复

目标：让 Dev 镜像具备长期运行与可恢复性，再考虑 RC。

- 在真实两主机拓扑运行长时间 TCP/UDP、自动 peer 换钥、证书到期边界和 Control 断联；记录持续请求正确率、资源高水位和恢复结果。
- 使用原 CA、Authority State、Agent Journal 与数据库**配套版本**验证备份恢复及升级回滚；如果新版数据库 Schema 不兼容旧镜像，禁止直接只回滚镜像。
- 对现存 HIGH 漏洞分类：可修复、无修复补偿、风险接受（需记录原因和到期日）；修复版 CRITICAL 继续阻断发布。
- **验收**：凭据过期不导致隐式续权；重启和恢复不清空高水位；有可执行且留存脱敏证据的回滚方案；CI/实测双通过。

### PR 4 · Web Console 产品化第一轮

目标：围绕已有 Forward-first 入口做管理体验，不增加未经验证的新传输。

- 页面逐项改进 Node 创建与编辑、Direct/Relay 配置：从自由输入改为有限选项、预设、按能力显示字段；保留后端严格校验。
- 缩减空状态和超大卡片的视觉冗余；统一列表、搜索/分页、状态展示与编辑/危险操作交互。
- 展示当前 Snapshot/Report/Operation 与诊断区别，提供可筛选的安全审计和故障提示，但不把 Agent Report 当成独立端到端监测。
- **验收**：浏览器真实 HTTPS 场景下 401/403、Node/Forward 生命周期、CAS 冲突、回滚失败提示、浏览器响应式可用性及无凭据泄露的测试通过。

## 后续选择点与明确非目标

- 完成 PR 1–3 且测试证据可靠后，再决定是否为 `vX.Y.Z-rc.N` 增加**单独的预发布通道**。当前工作流只会自动发布 `main` Dev 和 `vX.Y.Z` 标签，**不会**凭 `-rc.N` 标签自动发行，也不会部署到 1Panel。
- 传输扩展顺序建议：先以独立 Link 复用/带宽与连接预算为切片，再做可观测的路由/策略，最后视需求投入 QUIC/高级多跳，所有协议扩展保持 no-downgrade、版本协商、资源上限。
- 计量、套餐/支付、优惠券、返佣、工单等属于可选商业层，待核心稳定/审计与控制权限可靠后独立规划。**不能把商业模块耦合为启动 Direct/Relay 的必要条件**。
- 本轮没有要求重新开发已经通过的 Direct/Relay 业务闭环；优先补跨主机真实证据、安装自动化与运营可用性。

## 交付约束

每批包含：独立 PR、精确 Git SHA、契约/Schema 变更说明、验收入口、负面场景、脱敏证据、回滚影响、完整 CI。PR 不应靠降低 TLS/时钟/执行期限、跳过运行测试、重置 Journal/Authority，或扩大开放网络权限来达成“通过”。

当前文档仅排计划，**上述任何未执行项均不能标记 verified**。
