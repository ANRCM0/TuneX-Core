# ADR-0004 — 唯一 Agent 身份、逐 Forward 动态角色与有界多跳路径

- 状态：**Accepted for incremental implementation**（架构原则已确定，多跳执行尚未开放）
- 日期：2026-10-15
- 适用：TuneX VNext Core/Runtime/ADP/Go Agent
- 先决： [ADR-0003](0003-native-relay-tls13.md)、[ADP/3](../protocol/agent-deployment-v3.md)

## 决策

1. **Node 只有一种身份**。一个注册的 `NodeId` 在同一 Scope 内保持稳定；Control 机器凭据、Relay peer 凭据可以有独立的密钥和用途，但都必须绑定该唯一 Node 身份。绝不把 `IngressNode`、`TransitNode`、`EgressNode` 变成独立的注册实体/身份。
2. **执行角色是每条 Forward 内的 Assignment 属性**，而非 Node 固有属性。单节点 Direct 同时接收并直连目标；多节点 `[ingress, ...path.via]` 的第一个为 Ingress、最后一个为 Egress、中间为 Transit。某个 Node 可以同时担任不同 Forward 的入口、中继和出口，只要权限、能力和共享资源预算允许。
3. **路径是有序且不重复的节点序列**。本阶段纯规划上限为 **8 个 Node（含入口）**。拒绝重复/回环路径、缺失锁定 Profile 的非空 `via` 和超过上限的路径。拓扑计划只生成相邻关系与反向激活顺序，不发行证书、占用端口、编译可执行 Assignment 或产生执行权限。
4. **逐跳身份和授权**。每个上/下游 Agent 连接必须验证实际 mTLS peer Node ID、允许的相邻节点和部署绑定，并同时限制当前机器/peer 凭据、Forward 代次、sessionEpoch、物理 Fence、配置/Profile Digest、执行租约与目标 CIDR。只有真实下游 ready，才可从 **Egress → Transit → Ingress** 逐段开放，任何跳失败都不得将 Ingress 标记为可用。
5. **资源与恢复**。Ingress 的用户 TCP/UDP 监听、Transit 的上游内部 TLS 监听/下游连接、Egress 的内部 TLS 监听分别纳入同一 Node 物理端口/连接/FD/CPU 预算和历史 Fence 账本。UDP 关联、TCP 半关闭、drain、旧实例清理与过期授权必须贯穿整条路径。一个 Node 参与多个 Forward 不能绕过限额；旧 ACK/Report 不能激活或释放新路径。
6. **同一进程，无须多种 Agent 二进制**。Go Agent 使用一个 Node 身份、同一 Runner/Journal 和角色化执行器。透传者不是“无策略透明代理”：在每一跳必须实施独立受限的连接权限、大小/并发上限和到期策略。

## 本次第一切片（已编写代码，仍需 CI）

`apps/control/src/modules/runtime/path-topology.ts` 提供无 IO 的 `compilePathTopology`：验证 Forward、映射角色、生成有序 Hop/Node 和出口优先激活序列，同时不修改调用者原始数据。相同 Agent 可被多个 Forward 派生出不同的角色。

现行 `native.relay.v1` / `relay.wire.1` ADP/3 Assignment 仍只识别 `relay-ingress` 和 `relay-egress`，不支持 `transit`。已在两个真实 Relay 编译器中共享 `requireTwoNodeRelayTopology` 硬边界：**新规划器接受可描述的多跳拓扑，但现行 Runtime 必须拒绝执行超过两节点的 Relay**。不得为让 API 变绿把 Transit 冒充已有角色，或静默退化为只使用首末节点。

## 下一纵向切片（未实现、不得宣称上线）

1. **版本化协议与跨语言契约**：定义 Transit Assignment、端到端 Forward 身份与每跳绑定、物理上游 TLS 监听和下游邻居凭据/端点/资源，生成 TS/Go 严格 Schema 与正反 fixture；建立显式能力协商与严格版本拒绝，不悄悄拓展 `relay.wire.1` 的语义。
2. **Agent Transit 执行器**：相同 Go 二进制配置一份安全上游 TLS Listener 与下游 mTLS Client（两个明确授权的端点），支持 TCP 半关闭和每客户端 UDP association，按双端最短有效期强制关闭。
3. **三 Node E2E**：首先真实执行 `A → B → C`，验证中继身份拒绝、容量、下游未 ready 入口不开放、Control/Agent 重启、UDP 回程、drain/Fence/租约期限。
4. **N 跳与组合**：再推广到 8 节点以内，验证最坏情况端到端延迟、每跳资源 reservation/Report/deployment 回滚、同一 Node 参与多条路径，跨物理服务器实测及可观测诊断。
5. **动态路由**：只有静态路径验收后，再规划池化、择优选路或失败切换。路径自动变更必须通过新 Deployment generation 和历史连接安全 drain。

## 非目标及安全边界

- 本 ADR 不改变 Core `Node` / `Forward` 公共实体形状、不替换已发布的双 Node Wire、也不引入新的微服务或跨节点共享长期密钥。
- 不允许同一 Forward 路径内重复 Node；跨不同 Forward 复用 Node 是正常用例。
- “N 跳”和“任意组合”始终受能力、Scope grants、节点网络可达性、对等方证书、资源限额、路径长度和版本协商约束。
- 逐跳 TLS 只保护 Agent 间连接；不承诺 Client → Target 全程端到端加密。不可静默降级为明文链路。
- **拓扑规划测试通过 ≠ 多跳功能可用或有生产发布资格**。每个新增执行角色必须具备负面身份测试、真实 TCP/UDP payload、恢复和真实网络隔离验收。
