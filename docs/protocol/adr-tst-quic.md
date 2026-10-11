# ADR：可选 TST QUIC transport

状态：设计提案，待评审。对应 V2.2 P4；本文不代表 QUIC 已实现或可在生产启用。
日期：2026-10-11。当前运行时继续使用 `tst/1`，TST 功能仍默认关闭。

## 问题与依据

现有 UDP 消息通过同一条 TLS/TCP carrier 传输。TCP 的有序交付会让丢失字节
之后的帧等待重传；不同 UDP association 和 TCP stream 因而可能同时等待。
应用层的公平队列与有界背压不能消除这个载体层的等待。

QUIC 为独立 stream 提供有序交付及 stream/connection 两级流控；不同 stream
不要求共同按应用字节顺序交付，但仍共享连接的拥塞控制和资源。
[RFC 9000 §2、§4、§7](https://www.rfc-editor.org/rfc/rfc9000.html)。
QUIC DATAGRAM 不提供可靠重传或流控，不能自行分片；它受到双方协商的上限、
路径 MTU 和拥塞控制限制。传输 ACK 不表示应用消费成功。
[RFC 9221 §3、§5](https://www.rfc-editor.org/rfc/rfc9221.html)。

这些能力支持一个独立、显式启用的候选 transport；收益需要在真实丢包和 RTT
矩阵中测量。不能从 loopback TCP 吞吐数据推导 QUIC 的收益。

## 提议的协议边界

1. 为候选模式使用独立能力与版本标识；`tst-quic/1` 仅是本文拟议的内部 ALPN，
   尚未发布、注册或加入 capability/schema。Panel 与两端 Agent 必须全部支持、
   显式配置并确认就绪。现有 `tst/1` 字节格式不复用作 QUIC wire format。
2. 使用成熟的 QUIC transport 实现和 TLS 1.3，不自研加密或 QUIC 栈。Go 标准库
   `crypto/tls.QUICConn` 仅提供 TLS 集成，仍需要 QUIC transport。引入依赖前必须
   单独评审维护、许可、漏洞响应、离线构建及二进制体积；当前 Agent 的标准库
   依赖约束保持原样。
3. 保留现有 mTLS 信任与权限边界：精确验证证书身份、Workspace、Link、节点和
   角色；证书成功不代替 Forward 授权。绑定有效 generation/revision、端口租约
   和撤销状态，拒绝跨空间、过期、旧 generation 和已删除 association。
4. 一条可靠控制 stream 承载授权及状态变更，每条 TCP 业务连接使用独立双向
   QUIC stream。禁止将全部 TCP 业务重新封装进单条 QUIC stream。应用仍须
   处理 FIN、RESET、取消和背压，限制 stream 数与每 stream/Link/Workspace 字节。
5. UDP 使用协商成功的 DATAGRAM。可靠控制 ACK 之后才能发送该 association
   数据；控制与 DATAGRAM 没有共同交付顺序，未知或尚未激活的 ID 直接丢弃。
   初版不缓存提前到达的数据，不从报文读取任意目标地址。
6. DATAGRAM 头拟绑定 association ID、generation 和序号。序号允许乱序和丢失，
   使用有界去重窗口，不能照搬 `tst/1` 的严格连续序号。ID 不在同一 generation
   内复用；序号溢出、窗口策略和编码尺寸必须在 wire spec 中明确后才能实现。
7. 初版禁止 0-RTT、会话恢复和主动连接迁移；重连建立新的授权状态。TLS 的
   early data 存在重放边界，不能直接用于状态变更或业务数据。
   [RFC 9001 §4.6](https://www.rfc-editor.org/rfc/rfc9001.html)。
   迁移禁用只是初版策略，不能替代地址验证、抗放大和握手资源限制。
8. UDP 有效 payload 上限取双方 DATAGRAM 限制和当前路径可承载大小的最小值，
   再扣除应用头；不能宣称支持当前 carrier 的 65,507 字节上限。初版不做应用
   分片，过大消息明确拒绝并计数。MTU 变化时更新事实，不静默改走 TCP。
9. 配额必须同时约束消息数、字节数、在途发送和待消费队列；设置有界 TTL，
   避免过时 UDP 阻塞 TCP。发送库没有窗口不等于应用可以无限排队。
   公平调度与丢弃原因按 association 计数，保留 Link 与 Workspace 资源隔离。
10. carrier 重连不承诺已有 TCP 会话迁移。可恢复的 UDP association 需要重新
    授权，不能自动继续沿用旧 ID；权限失效关闭所属范围，单条业务失败不得
    无故关闭 sibling。计量区分应用交付、排队丢弃与 wire 重传，不重复收费。

## 威胁模型与必须验证的负例

资产包括业务明文、目标授权、租约/撤销状态、流量归属和节点资源。攻击者可能
是网络上的未认证发送者，也可能是已经认证但越权、失控或恶意的同租户节点。

| 威胁 | 设计约束 | 实现前后的必测负例 |
| --- | --- | --- |
| 身份混淆与跨 Workspace | 精确 mTLS 身份及 Forward 二次授权 | 错 CA/身份/角色、过期证书、跨空间、错误目标 |
| 旧状态重放 | 禁止 early data，绑定 generation 与撤销状态 | 旧租约、tombstone、重连旧 ID、重复/乱序/溢出序号 |
| UDP 放大与握手耗尽 | QUIC 地址验证、库的抗放大、全局/租户握手预算 | 伪造源地址、Initial 洪泛、握手失败与反复重连 |
| 队列与 stream 耗尽 | 双维配额、TTL、关闭后回收、独立 scope | 无限 stream、超大包、满队列、慢消费者与 sibling 继续服务 |
| MTU 与网络失败 | 明确限值、丢弃原因与有界恢复 | UDP 被封锁、MTU 收缩、丢包/乱序、控制与数据先后颠倒 |
| 撤销与权限竞态 | 控制 ACK 后激活，状态变更有 fence | 暂停/删除与收包并发、失效租约、热更新目标后旧授权 |
| 降级与计量混淆 | 显式 transport，独立应用/载体计量 | 未协商 DATAGRAM、未知 ALPN、不可用路径、wire ACK 未被业务读取 |

禁止在诊断、profile 或性能工件中输出私钥、凭据或业务 payload。生产试验必须
经独立安全审查；本提案和内部测试不能代替外部审查。

## 兼容与回滚策略

| 组合 | 预期行为 |
| --- | --- |
| 原有 Panel/Agent，已有 native 或 `tst/1` Link | 保持现有协议和配置 |
| 仅一端支持候选 QUIC | 拒绝创建该模式，报告不支持；不自动回退 |
| 双端支持但未启用，或未协商 DATAGRAM | 不激活候选 UDP 数据路径 |
| 双端已启用但 UDP 网络不可用 | 有界失败和明确诊断；其他 Link 不受影响 |
| 关闭候选开关或回滚至旧 Agent | 排空/终止候选会话，显式重新配置现有 transport |

未来 Panel 校验、租约的 UDP 协议维度、端口冲突、capability、状态上报、恢复
账本和 DTO 均需覆盖新模式。不得将未知 transport 当作 `tst/1` 接受，也不能
复用旧 Link 的 Ready 状态。在这些变更提交前不提供可启用的新枚举或功能旗标。

## 实施与验收顺序

先完成依赖与许可审查、wire spec、身份验证原型和负例；再打通双端控制 ACK、
TCP stream 与 UDP DATAGRAM；最后补 Panel、租约、诊断、计量与恢复路径。

实验使用固定源码 SHA、同一主机资源、同等业务负载，在消息尺寸/并发/RTT/丢包
矩阵下比较 `tst/1` 和候选模式。至少报告吞吐、业务 p95/p99、丢弃/错误率、CPU、
RSS、排队字节和恢复时间。网络整形必须真实执行，不能只填写元数据。通过
Linux race/fuzz、跨平台、故障长稳、兼容回滚和独立审查后才讨论启用范围。

当前交付仅为 ADR、威胁模型和兼容策略；QUIC 实现与实网验收仍待执行。
