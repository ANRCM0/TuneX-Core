# Native payload counters v1 · 本地生产端基础

日期：2026-10-18（Asia/Shanghai）。状态：**D2-B1 已在本地实现、未验证**。
本文记录原生执行实例的计数生产与有界本地观察，不是远程协议，也不代表 D2、
规则流量产品、容量验收或生产发布完成。开发期间没有运行测试、静态检查或 CI。

## 1. 归属与范围

- `agent/internal/payloadstats` 提供每实例计数；Direct TCP/UDP 和原生 Relay
  使用 `PayloadCounters() (payloadstats.Snapshot, bool)` 暴露只读快照。
- 只统计入口业务 payload。Relay 出口、中继及不支持采集的实例返回不可用，
  不把各跳相加，不统计 TLS、帧头、IP 头或主机网卡总字节，不用于结算。
- 原生引擎持有独立、低开销原子计数；采集身份的熵源失败只使指标不可用，
  不阻止转发，不生成可误认为有效的零值或伪造 epoch。
- Runtime/Agent 仍唯一拥有执行、授权、排空和关闭；不修改 Core、Journal、Fence、
  持久高水位、恢复流程或 ADP 执行消息。观察失败不得改变执行结果。

## 2. 实例计数与精度

`Snapshot` 包含 32 位小写十六进制 `Epoch`，以下累计 `uint64` 字段，以及
粘性的 `Overflowed`：

| 字段 | 口径 |
| --- | --- |
| `PayloadSentBytes` | 入口向目标方向实际成功写出的业务 payload 字节 |
| `PayloadReceivedBytes` | 目标返回入口客户端方向实际成功写出的业务 payload 字节 |
| `TCPAccepted` / `TCPConnected` / `TCPClosed` | 本实例已准入客户端连接、已连接下游及连接清理累计次数 |
| `UDPAssociationsCreated` / `UDPAssociationsClosed` | 本实例 association 创建与清理累计次数 |
| `UDPDatagramsSent` / `UDPDatagramsReceived` | 两个方向完整成功转发的 datagram 次数 |

计数饱和于 `uint64` 上限，不回绕；溢出后 `Overflowed` 保持 true。
导出累计值使用十进制字符串，不经 JavaScript `Number` 或浮点数转换。
并发采样的每个字段分别原子读取，不承诺多个字段属于同一个原子事务；
不能用采样瞬间的 accepted/connected/closed 差异推导健康或严格守恒。

Direct 的正数写入量即使同次 Write 返回错误也计入已写字节。Relay TCP
按完整成功写出的业务帧计数，失败或部分完成帧的尾部不补算，因此不承诺与
Direct 的错误边界完全同口径；不把帧头计为 payload。
UDP 仅在完整成功发送时计数；成功转发的零长度 datagram 增加次数但不增加字节。
这些统计不是端到端应用已消费、可靠交付或账务证据。

## 3. 完整身份与快照

每项观察绑定 Node、Boot、Session、Assignment、Forward revision、deployment
generation、binding fence、role、业务 protocol、driver ID/schema version/config
digest 和物理 resource；计数 `Epoch` 进一步区分原生实例。不能只按规则 ID、
端口或当前快照 generation 合并不同执行实例，也不将历史身份续成当前授权。

采样复制 active/draining 引用时仅短暂持有 Runner 锁，实际 live 计数读取在锁外。
Runner 原有 Close 已完成后、实例移除前，冻结内置实现的原子快照；不为指标新增
流式等待、引擎锁、远程请求或执行重试。冻结记录不保留引擎、socket、ticket
或授权回调。现有 `telemetry-v1` 保持封闭的进程/执行存量契约，不追加 payload 字段。

## 4. 终态尾部与有界本地文件

- diagnostics 或独立 Forward 遥测显式启用时，仅内存保留最近最多 128 项冻结终态，
  最多十分钟；重复关闭不延长原始保留时间。
  到期和容量淘汰分别累计记数；重启即丢失，不写入 Journal 或恢复账本。
- 终态保留发生于 Runner 移除/ACK 清理路径。UDP 替换、排空本身可能已完成
  Close，但记录仍在 current/draining 映射中，不能据此宣称它仍在接收业务流量。
- 仅在显式 `--diagnostics` 启用时，每十秒写原 diagnostics `status.json` 同目录
  的受保护 companion `forward-counters.json`；停止后尝试写一次最终本地快照。
  文件保护沿用本地 diagnostics 的私有目录与原子写入边界，不通过 Console 暴露。
- 本地文件最多返回 256 项，以确定性轮转覆盖超额实例，提供 `returned`、
  `available`、`omitted`、`truncated` 及来源说明；current/draining/terminal
  是观察分类而非健康、执行授权或跨实例一致快照。
- 截断、过期、淘汰、未启用、不支持或采样失败均不是零流量。终态计数仍可能在
  下次观察前丢失；Close 后冻结也不保证文件成功写出或任何远端收到，不能补造尾部。

## 5. 未交付范围与后续

B1 当批**没有**新增 payload 远程 Schema、导出、接收 API、MySQL 历史或 Console
payload 消费。随后 D2-B2 已继续本地实现并接线
[独立 Forward 遥测](forward-telemetry-v1.md)，但同样未验证，不能据此宣布远程链路
可用或 D2 完成。进程指标图表不冒充规则吞吐，本地 diagnostics 也不替代远程链路。
以下远程责任由 D2-B2 的独立契约承接，仍待集中验收：

1. 以完整身份绑定、入口归属和当前服务端 Assignment/Forward 映射决定可见性；
   重新核对机器会话、恢复隔离和管理读取权限，不信任 Agent 任意规则归属声明。
2. 为累计样本定义独立 epoch/sequence、去重、重复内容冲突、乱序、重置、缺口、
   溢出与尾部覆盖；使用有界接收预算、保留和历史查询，不侵占执行续期资源。
3. 接入有来源/时区/覆盖说明的 Console 历史，禁止跨实例缺口推算或把缺测画为零。

主机基础资源、Probe 尝试/成功累计、分钟/小时聚合及容量预算仍未完成。
源码冻结后集中补齐计数、替换/排空/撤权、UDP 空包、并发、溢出、不可用身份、
尾部去重/淘汰和文件权限等验证；保持最终 SHA、物理主机与发布门禁分别记账。
