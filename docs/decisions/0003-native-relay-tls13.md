# ADR-0003：Native Relay v1、不可变 Profile 与 ADP/3 资源角色

- 状态：Accepted for implementation；数据面尚未实现或开放。
- 日期：2026-10-13。
- 前置：ADR-0002 和节点安全规范第 5 节。

## 决策

Phase 3 的第一种跨节点驱动为 `native.relay.v1`，只支持一个 ingress 和一个
最终 egress（`path.via` 长度 1）。多跳、QUIC、TST、Link 复用单独排期；
单节点 direct 不依赖 Transport 模块。Profile 存储的是明确的 TLS 安全要求和
有界资源配置；创建新 revision，不能修改已发布正文。

数据面使用 Go 锁定版本标准库 TLS 1.3 的双向认证，禁用 session ticket/resumption，
不启用 0-RTT，不允许明文回退。Profile 的 security 固定为 mutual-tls13。
现有 Control 的 Node clientAuth 证书不自动当作 Relay serverAuth 证书：
Relay 将签发独立用途、同时含 clientAuth/serverAuth EKU 与
`urn:tunex:node:<nodeId>` URI SAN 的节点凭据。双方校验 CA 链、用途、有效期、
精确 Node URI 和 Assignment 中最多两个允许的叶证书 SHA256 指纹。正常 TLS
证书验证不得因自定义身份校验而关闭；客户端使用 Node 身份 SAN 验证，地址
仅用于拨号，不能将不相关 hostname 证书作为 Node 身份。若使用自定义
VerifyConnection，必须显式执行完整链与用途验证；不得只比较 CN/指纹。
密钥轮换重新编译更高 deploymentGeneration/fence，下游先切换再开放入口。

一个 TCP stream 或 UDP association 使用一个 TLS TCP connection，先认证再发送
长度限定的 JSON Open/Accept/Reject；没有 pool/multiplex。Open 必须精确绑定
scopeId、forwardId、forwardRevision、deploymentGeneration、两个 Assignment IDs、
两端 Node、双方 sessionEpoch/fence、Profile ID/revision/digest。TLS 对端身份与
Open 的端点必须一致，且 egress 本地存在 active 授权。每连接只接受一次 Open，
不能使用 body 中的 target；目标来自 egress 的已授权配置。TLS 完整握手保护
网络重放；旧 session/deployment/fence 的 Open 拒绝。数据帧无需自定义密码学。

Open 的 `action=probe` 只检查认证/当前实例，不拨最终目标、不分配用户会话；
只在 egress active 时成功。Controller 使用新鲜 active/ready 报告推进，ingress
在绑定客户端入口前进行实际 probe，两个门槛均必需。持续连接失败/失联报告
为 degraded/error，不伪称 target 健康。最终目标每次解析/拨号都按 egress
CIDR、metadata、地址类型策略复查。

TCP 帧包含 DATA/FIN/CLOSE；FIN 是单方向半关闭，反方向继续。UDP DATA 每帧为
一个完整 datagram，客户端地址与关联独立，空 datagram 合法，超限拒绝，保持
anti-amplification/idle/queue/Node budget。UDP 经可靠 TLS TCP 会受到 head-of-line
blocking；路径/实例切换会重置 association，不承诺透明迁移或零丢包。
帧头 type:u8 + length:u32（网络字节序），DATA 类型 TCP=1、UDP=4，FIN=2、
CLOSE=3。FIN/CLOSE length 必须 0，类型与当前协议匹配；最大 frame 65536 bytes。
初始控制消息用 u32 长度加 UTF-8 JSON，最大 4096 bytes；JSON 重复键、未知字段、
unsafe counter 拒绝。绝不把原始 JSON 配置用于动态代码或任意 URL 拉取。

内部 Node endpoint 由 owner 管理，显式声明允许的绑定地址、可达地址和端口。
每个 egress protocol 分配独立 TLS TCP 端口，内部/外部 socket 共享独占键
`nodeId/tcp/port`；UDP 的 egress 内部资源也是 tcp，不能按 UDP 字段算 fence。
每个 ingress 仍预留实际 public TCP/UDP 槽；同规则两协议的所有资源同事务接受。
跨节点执行实例拥有独立历史租约/drain，旧会话全部授权耗尽前不能复用资源。

此物理资源/角色变化使用 **ADP/3**，不将 Relay 塞进 direct ADP/2 的形状。
全部 Assignment 都显式带 resource（address/port/physical protocol）、role、
驱动 config，Tombstone 也按 resource/protocol/fence。Hello capability 声明协议
与 wire version；Control 只对双方共同支持的版本发布。ADP/2 在切换前继续只
执行 direct，Relay 不广告已支持；ADP/3 完成后明确拒绝旧版本，无兼容适配层。
具体 ADP/3 Schema/fixtures/TS/Go/state cutover 属于下一切片，未实现前不能发送。

## Profile 与授权

Owner 以 expectedRevision CAS 发布 config；no-op 保持 revision，不覆盖旧正文。
列表、历史版本与精确 digest 可查询。Forward 锁定 Profile revision，新 revision
不自动改变旧 Forward。执行人需活跃 manager、每个 Node 的显式 use grant、
Profile use grant；授权收回必须事务创建撤销任务并停止续期，不能只删除 grant。
Phase 3 前置 Profile 仅允许 owner 发布与 scope 成员读；显式 use grants 在
Relay acceptance 接入前实现，不能把读取权限当执行授权。

## 安全/验收与边界

错误 Node/CA/证书用途/过期/指纹、错误 Profile/digest、session/fence/generation
重放、prepared probe、非法长度/帧/字段、强制 TLS 降级均有负面验收。
真实双 Agent TCP/UDP 数据、半关闭、资源回收、下游断联、切换及有界截止是
驱动开放条件。Schema/解析器通过仅证明契约，不能声称 Relay 已可执行。

依据：Go `crypto/tls` 的固定版本文档与 RFC 8446；不自定义密码套件或加密算法。
发布仍需安全审阅、真实生产限制环境和许可证/SBOM 门槛。

- https://pkg.go.dev/crypto/tls@go1.26.3
- https://www.rfc-editor.org/rfc/rfc8446.html
