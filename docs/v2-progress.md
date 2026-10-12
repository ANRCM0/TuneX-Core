# TuneX V2 实现与验收台账

执行用户提供的 [完整方案](v2-development-plan.md)，第 23–27 节优先。历史实现基线为 `8ca81c0c3f779bb3485594f8b1dc91f3a1c246a4`；V2.2 与 V2.3 当前支持范围已自动验收收口，现进入 V2.4 O1。各轮历史证据保留其执行范围，当前状态以对应阶段小节和“发布门槛”为准，不代表正式发布或生产验收。

## 实现交付

| 工作包 | 当前交付 | 状态与证据 |
| --- | --- | --- |
| T0 / R0 | 独立规范、状态机、限制、错误码、字面向量、威胁模型、ADR、依赖与来源清单 | 文档/代码完成；内部评阅完成，外部独立审查待执行 |
| T1–T3 / R2 | TLS 1.3/mTLS、身份/ALPN、TCP 多路复用/半关闭/流控/背压、UDP association/闲置与限额 | 自动测试、fuzz 与真实双节点 payload 已验证；TST 默认关闭 |
| T4 / R3 | 单进程 Link、规则授权、共享更新、代次墓碑、租约/证书失效、缓存、QoS、流量回执与诊断 | Agent 自动测试与真实 Panel/Worker/Agent TST 流程通过 |
| U / R1 | 操作账本、幂等/围栏、权限、自动复用/端口分配、CAS、确认删除/回收 | MySQL/HTTP 专用测试与真实原生新建、编辑、回收验证通过 |
| U4 | 单页创建/详情/编辑/复制/启停/重试/删除/诊断/历史，中英文与独立状态 | 组件浏览器、六宽度、生产构建与真实业务浏览器验收通过；证据见 `web/test-artifacts/real-unified-forward-browser-evidence.json` |
| T5 / R4 | 删除外部进程、专有适配、旧入口与构建依赖；保留合法归档 | 活跃依赖审计通过；Docker/安装实际验收待 Linux 环境 |
| R5 | 回归、迁移、恢复/故障、安全/性能、锁定依赖构建与整体验证 | 本机部分持续收尾；剩余发布门槛见下表 |

## 已执行验证

完整 Agent 测试、vet、Windows 实际 socket、离线干净 Linux amd64/arm64 构建与零外部包检查见 [Agent 证据](testing/tst-agent-runtime-evidence.md)。交叉编译只证明构建。Windows race 已尝试，因无 GCC 未能执行。

Backend 完整单元已通过 3,182 项、19,159 次断言。真实 Node/MySQL/Redis HTTP/DB 集成已通过 124 项，0 skipped；V2 专用 MySQL 测试 8 项、74 次断言，target-set 6 项、traffic 3 项均通过。

Web 完整源测试及 Next 41 路由构建通过；隔离源码的 `npm ci`、typecheck 和生产构建通过。组件浏览器证据见 [统一工作台记录](../web/src/components/forwards/__tests__/UNIFIED_EVIDENCE.md)，真实后端浏览器证据见 `web/test-artifacts/real-unified-forward-browser-evidence.json`：4 个真实业务场景、6 个响应式宽度、6 个真实 payload、PATCH 200、0 个运行时异常。

Parser fuzz 在 15 秒执行 960,760 次，24 个新增 corpus，无失败；TCP、mTLS/TST 与含持久计量的 runtime 实测见 [性能基线](protocol/tst-performance.md) 和 Agent 证据。不发布生产吞吐量或优于旧协议的结论。

V2.2 P2 profiling surface 已实现：Agent 默认不挂载 pprof；显式 `--profile`
或 `TUNEX_AGENT_PROFILE=true` 后，`/debug/pprof/*` 仍受 admin bearer token
保护。`stream-baseline.py --capture-profiles` 可采集 CPU/trace、heap、allocs、
goroutine、block、mutex 和 thread-create 文件，并在 JSON 中记录脱敏路径与大小。
采集在持续真实 payload 负载下进行，文件不会覆盖旧收据，失败返回非零；
真实双 Agent relay 的 14 份 pprof、2 份 trace 均解析通过。TST/mTLS 的 CPU、
分配、锁和调度热点已形成报告，下一优化重点为接收临时分配。

V2.2 P3 已完成第一条数据路径优化：TST TCP data frame 使用 16 KiB
buffer，最多缓存 256 个闲置 buffer（4 MiB）。写完成、RESET、close 和
session failure 明确归还；超时/取消不能提前回收正在写出的 buffer，归还前
清零完整内容。同机 Windows/amd64 五轮 A/B 的每操作分配量从约 34.7 KiB
降至 18.3 KiB，31–32 次降至 30 次分配。所有权/容量/清零回归连续 20 轮通过，
amd64 完整 Agent 单测与 vet 通过。本机无 GCC，Linux CI/race/fuzz 已通过；
固定 Linux 主机容量、多连接性能和长稳验收仍待执行。详见
[V2.2 工作记录](v2.2-performance.md)。

V2.2 P3 已继续实现连接独占、惰性分配的 TCP 接收临时缓冲，终止后清零归还；
业务流、UDP 队列与控制帧的 payload 所有权有明确回归。对 `d534143` 的同机
五轮 A/B 中，TSTStream/mTLS 每操作分配中位数减少 90.3%/91.5%。新增
接收/发送所有权测试连续 20 轮、Agent 全量/vet、15 秒一致性 fuzz 均通过；
`9edcd86` 的 Linux CI/race 和真实 shared-Link 集成已通过。最终 `46b0a96`
Agent 源码与其相同，主 CI 和对 `d534143` 的显式性能门禁均成功。Linux
TSTStream/mTLS B/op 中位数减少 90.3%/92.0%，完整 TST TCP runtime 减少
52.0%，其 ns/op 中位数变化为 +0.85%。优化后的热点复测已解析，通知
分配成为下一项评估对象；多连接/真实 WAN/跨日长稳仍待执行。

V2.2 P4 可选 QUIC ADR、威胁模型与兼容策略已形成，协议实现和独立评审仍待
执行。P5 同一 Ubuntu Runner 的双源码、多轮交错采样及严格工件校验已通过：
`46b0a96` 每端 direct/relay 各 1,500 个建连、960 个 RTT 样本、0 错误，
六类 Go transport 各五轮；138 项比较、90 项严格门禁均通过。修订包含
payload 先于 setup 压力、资源回收后使用真实快照、Go 独立进程逐轮交错，
78 项 harness 自检在 Linux 全部通过。本机真实 relay smoke 成功。
指标、样本数和 35% 阈值保留，新增口径标记拒绝混比旧 anchor，完整 runtime
同步记账没有跳过。首两轮失败、自动重复作业取消和所有原始工件均保留，
见 [V2.2 记录](v2.2-performance.md)；固定主机容量、真实 RTT/丢包和跨日
长稳仍未完成。

Python harness 契约 3 项、相关 shell 语法、原生依赖扫描和当前文档本地链接检查通过。安装器完整 gate 在 Windows Git Bash 下失败，涉及 POSIX 文件权限等宿主差异；保留严格检查，不标为通过。

V2.2 P3 继续实现按需状态通知：在同锁检查状态与注册等待，广播后清除
当前 channel，无等待方时不分配，writer 唤醒保留。通知、两级流控、队列、
deadline/cancel、RESET/Close 的回归连续 100 轮通过，全量 Agent/vet 通过。
对 `690fc1d` 的 Windows 五轮交错 A/B 中，TSTStream/mTLS 分配量分别减少
51.8%/58.1%。`266eb44` 的完整 Linux CI/race、真实 shared-Link 和性能门禁
均已通过；TST 24 PASS、原生 both 37 PASS，均 0 FAIL。对 `690fc1d` 的
Linux 五轮交错采样中，TSTStream/mTLS 分配量分别减少 55.9%/60.0%，
完整 TCP runtime 分配量减少 5.9%、耗时中位数变化 +0.23%。138 项比较、
90 项严格门禁均通过，原有 35% 阈值保留，原始工件复算一致。当前源码的
五类热点已复测解析；发送完成通知与控制队列成为下一项评估对象。多连接、
真实 WAN/跨日长稳及后续版本仍待执行，见 [V2.2 工作记录](v2.2-performance.md)。

V2.2 P3 已继续实现惰性分配、最多 1024 槽位的控制帧环形队列，排空后复用，
出队清除引用，session failure 释放存储；保留窗口合并、满队列背压、OPEN
顺序及每八个控制帧后的数据轮询。队列/写出所有权回归连续 100 轮通过，
完整 securelink 连续 10 轮、Agent 全量与 vet 通过。对 `472c0bc` 的 Windows
五轮交错 A/B 中，TSTStream/mTLS 分配量减少 16.3%/20.0%，完整 TCP runtime
减少 3.7%。槽位最多保留 64 KiB/Session（amd64，不含 payload/channel）；
`08a480d` Linux CI/race 与真实 shared-Link 已通过，首轮性能门禁因原生
direct 热更新 apply p99 增加 84.5% 失败，原始工件已复算保留。后续增加
生命周期采样、完善目标回收并修复接受标记发布竞态；`3ef771d` 对原始
`472c0bc` 的 Linux 三轮交错复验通过，138 项比较、90 项严格门禁均通过，
35% 阈值保留，原始样本独立复算一致。TSTStream/mTLS B/op 减少
15.0%/9.2%，热更新 apply p99 为 1.854 → 1.352 ms；每端 300 个样本。
本轮控制队列 P3/P5 自动验收收口，固定主机/WAN/长稳仍待执行，详见
[工作记录](v2.2-performance.md)。

## V2.2 自动验收收口

V2.2 P1/P5 增加六拓扑真实 payload 矩阵：三种消息尺寸、低/8 并发，Linux
独立 netns 中实际施加 clean、20ms RTT、20ms/1% 丢包，共 108 个 case；
保存与复算实际 qdisc/丢弃计数、原始 RTT、吞吐、完整计量及资源回收。
新增每秒资源收据与混合 TCP/UDP 持续负载，标准 CI 运行 300 秒。
本机全量 Agent/vet、101 项 Python 检查通过（Windows 跳过 2 项 Linux 检查）；
固定 `5a3e300` 的主 CI 与 Performance 均成功，108 个 Linux case 通过，
丢包组记录 172 次实际 netem drop、11 次 plain UDP 超时、0 个损坏；
native/TST 无错误。Linux 300 秒混合流完成 37,621 次往返、0 错误，
goroutine 2 → 2、FD 7 → 7。全部原始矩阵、soak 及双 SHA 门禁复算一致：
138 项比较、90 项严格门禁通过，35% 阈值不变。原始工件与执行链接见
[V2.2 记录](v2.2-performance.md)。同一固定源码重新编译的 Windows 600 秒
混合流完成 86,309 次往返、0 错误/损坏、602 个资源读数，goroutine 2 → 2，
构建身份和原始指标独立核验通过。
方案 P4 的 ADR/威胁模型/兼容策略已交付，完整 QUIC 实现待评审后开展。
按用户决定，真机部署、固定主机容量、真实 WAN 和跨日验证延后统一验收。

## V2.3 智能链路与高级路由

V2.3 已进入 R1：统一 Workspace 图投影 Native NodeBinding/TST LinkResource 与
当前 Forward 的授权出口，提供能力发现、拓扑查询和候选策略预览，默认关闭。
环路、断边、跳数、载体/角色、revision/digest 与目标授权均显式校验；健康/质量
未测量时保留 unknown/null。25 项专项和本机全量 3,210 项后端测试通过，真实
MySQL/Redis/HTTP 7 项集成通过，业务资源前后无写入。固定源码 `0d90619` 的
[Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38131964218) 全部通过：
后端全量 3,210 项、HTTP/DB 131 项（0 skipped），TST 真实链路 24 项、Native both
真实链路 37 项均无失败；Agent race/fuzz、Web、运维与凭据/依赖检查通过。
R2 已开始 Native TCP/both 目标连接观测：使用已授权配置与现有 Agent 诊断命令，
增加独立默认关闭开关、Workspace/节点预算、结果身份与过期校验。本机全量后端
3,226 项、真实认证/MySQL/Redis 10 项通过。固定源码 `ade5058` 的
[Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38134197328) 全部通过：
后端 3,226 项、HTTP/DB 134 项（0 skipped），实际 Agent 目标探测 gate 34 项
（含 8 项前置检查），TST 24 项、Native both 37 项均无失败。目标关闭、配置身份
失效、自然过期与预算已验证；不将 TCP 目标事实填成节点/载体健康、RTT、丢包
或 UDP 成功。R2 第二轮已补 TST 授权目标与独立 ICMP 边质量，R3 已补持久策略、
版本冲突和可解释只读提案。本机后端 3,237 项、真实数据库/HTTP 11 项与 Agent
全量/go vet 通过；`46cc070` 的基础 CI 通过，但实际 TST 用例因测试脚本未接受正常 202
而中止，已修正，不能记作完整通过。R4/R5 已接入事务围栏、可恢复执行记录、Native TCP
逐跳 mTLS/TTL 与隔离 Linux 故障切换 gate，本机新增 Agent socket 与真实数据库负例通过。
`0ff9371` 的 [Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38144067133) 已完整通过：
TST 24、Native both 37、授权探测 49、实际路由故障/回切 27 项，均无失败。修复旧节点删除围栏
抢占下一版本的问题后，主三跳 → 备用两节点 → 主三跳及每次真实业务载荷均已确认。
高级路由 UI 已加入转发详情，默认关闭能力发现、授权候选、阈值/权重、预览后保存、版本冲突、
实际 receipt 和空间请求隔离已实现；Web 1,419 项测试与六宽度浏览器组件验收通过。

后续源码 `07e247d` 修复受保护补偿身份、共用出口的准备失败恢复及 MySQL 原子发布账本，
并补真实端口冲突回滚验收。本机后端 3,242 项 / 19,564 断言、真实 HTTP/DB 12 项通过；
Linux 增强验收实际 29 PASS / 2 FAIL，端口冲突回滚暴露重复活动中转租约；`a3a2248` 修复后
[Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38146396561) 全部通过：后端 3,243、
HTTP/DB 136（0 skipped），实际路由 30、探测 49、Native both 37、TST 24 项，均无失败。
固定旧基线 `46cc070` 对 `07e247d` 的
[性能验收](https://github.com/PaiMonCai/TuneX/actions/runs/38145288357) 通过 138 检查、90 强制指标、
0 回归；原 35% 阈值不变，clean/delay/loss 与 300 秒混合长稳成功。
后续 `0abdd4d` 补 Worker 冷启动的完整恢复依赖、持久跳地址、原子资源/完成键与不可变回滚快照复用。
本机后端 3,247 项 / 19,626 断言和生产恢复依赖下真实 HTTP/DB 12 项通过；
[最终 Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38149532543) 全部通过：后端 3,247 项、
HTTP/DB 136（0 skipped），实际路由 30、授权探测 49、Native both 37、TST 24 项均无失败。
[同 SHA 固定旧基线性能](https://github.com/PaiMonCai/TuneX/actions/runs/38149544024) 的矩阵与
300 秒混合长稳已通过，双 SHA 比较两次均未通过。首次唯一回归为 TST UDP 回环延迟中位数
+52.86%；同 SHA/原阈值的第二次 compare 中，该指标通过，但直接建连中位数 +79.07%。
当前 Agent tree 与此前通过的 `07e247d` 完全一致，不能据此将本次失败改写为通过。
`046b916` 将流量回显目标隔离至独立 Python 进程，避免目标与客户端计时竞争同一解释器；
107 项 Python 检查通过（Windows 跳过两项 Linux 专属检查），常规 CI 通过。
[固定旧基线复验](https://github.com/PaiMonCai/TuneX/actions/runs/38152935135) 全部通过：
138 检查、90 强制指标、0 回归；两端使用同一新版采样器，样本数、同步持久记账与 35%
门禁不变，所有旧失败保留。108 个整形 case 通过，300 秒混合流完成 37,409 次往返、0 错误/损坏，
原始收据 hash、计量、分位数、整形与资源回收已复核。
`dee1cf9` 移除发布执行器的全局跳地址缓存，只从本次持久账本取该节点最新确认地址，避免
完成发布持续占用缓存。后端 3,248 项 / 19,640 断言、真实 HTTP/DB 12 项、typecheck 与构建通过；
[最终源码 CI](https://github.com/PaiMonCai/TuneX/actions/runs/38153895615) 全部通过：后端 3,248 项、
HTTP/DB 136 项（0 skipped），真实路由 30、探测 49、Native both 37、TST 24 项均 0 FAIL，
Agent/race/fuzz、迁移/升级、运维与密钥检查通过。三次实际选路均 confirmed，端口冲突后的
受保护基线补偿与 payload、正常删除均已核对。本轮当前支持范围的 V2.3 自动验收收口。
该版本的 Agent 和性能脚本内容与上述性能验收完全一致，固定 tree hash 见 V2.3 记录。
执行范围为同空间 Native TCP RELAY、固定入口/出口、两或三个节点；UDP/TST 自动迁移、
并行路径逐连接分流和 Native 新持久计费发送器未实现。完整状态与固定证据见
[V2.3 记录](v2.3-routing.md)，真机/WAN 部署仍延后统一验收。

## V2.4 可观测性与运维自动化

O1 第一增量新增独立默认关闭的统一指标快照，按 Workspace 关联 Forward/Link/Node，
投影归档用量、TST 入口 checkpoint、节点进程遥测和已有授权目标 TCP 建连观测。
每项保留来源、数值口径和接收/观测新鲜度；缺失为 null，历史归属不跟随资源删除或
当前节点/Link 重写，不累加各 hop 或不同计量来源。接口只读，受既有认证、成员身份及
Forward/Node 双读取权限保护；凭据轮换、超限、跨空间引用和错误均保守处理。
本轮未变更数据库 schema、Agent、执行或计费写入链路。详细接口、验证与限制见
[V2.4 记录](v2.4-observability.md)。O1 全采集、O2 可视化、O3 分段诊断、O4 告警与
O5 授权修复仍未完成；真机/WAN 验收继续按用户决定延后。

固定源码 `baa3475` 的 [Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38204757317)
全部成功：后端 3266 项 / 19747 断言、HTTP/DB 143 项（0 skipped），新增指标专项 18 项、
真实认证/MySQL/Redis 7 项通过；实际 TST 24、Native both 37、探测 49、路由故障/回切 30 项
均 0 FAIL，三次路径 receipt 均 confirmed/exact revision，受保护补偿 payload 与正常删除通过。
Agent/race/fuzz、Web、迁移/升级、运维与密钥/依赖检查通过；本地全量后端和构建同样通过。
初版 `b37707f` 的 CI 随后续源码推送取消，不替换为成功。本轮 O1 第一增量自动验收收口，
不表示完整 O1 或整个 V2.4 完成，未宣称新指标接口容量已验收。

## 实网发现与修复

真实测试启动当前 Panel、Worker、两个独立 Agent 与 MySQL/Redis，未注入 Ready，也未手改运行缓存。已修复 wildcard 契约、初版修订值、UDP sibling 隔离、双向 UDP 闲置、TLS 失败握手频率、上报枚举/可空字段、同 generation 租约乱序，以及原生首次部署路径。

TST 实网已验证 TCP/UDP/both、普通成员权限、并发幂等/冲突、跨空间拒绝、自动复用、DTO 脱敏、授权诊断、流量回执、修改/暂停/删除 A 保持 B、CAS、Agent 重启恢复、Panel 重启账本和最后业务监听移除。原生六组合与五分钟真实自动回收等待最终成功证据。

真实业务浏览器已在当前隔离 Panel、Worker、MySQL/Redis 和两个 Agent 上完成登录、Workspace 切换、Native/TST 创建、TCP/UDP payload、编辑 CAS、历史、诊断、暂停/恢复、流量和删除；抽屉在 360、390、768、1024、1280、1536 宽度无横向溢出，未产生前端 Link 写操作或运行时异常。

## 发布门槛

| 门槛 | 状态 | 所需条件 |
| --- | --- | --- |
| 当前候选 SHA 的 Linux CI/race | `baa3475` 完整主 CI/race 成功，后端 3266、HTTP/DB 143（0 skipped），真实路由 30、探测 49、TST 24、Native both 37 项均 0 FAIL；相同 Agent/采样器内容在 `046b916` 的固定旧基线性能、108 case 与 300 秒 soak 成功；新指标 API 容量未测 | 逐项保留执行 SHA 和内容 hash；文档提交不替换执行 SHA；历史失败保留 |
| Linux Compose 全新安装、升级、恢复/回退与实网 | 待执行 | 隔离 Linux + Docker；执行安装与 integration gates |
| 外部独立协议/密码学/许可审查 | 待执行 | 独立审查者；内部评阅不能代替 |
| 长期故障、真实跨日、WAN 与生产发布后验证 | 待执行 | 授权环境、运行周期与固定候选版本 |

## 数据与来源

未重置生产库、删除现有用户业务记录、销毁历史凭据或修改生产部署。增量迁移隔离不兼容载体并保留记录。测试仅操作显式 loopback 数据库。历史源码逐文件校验后归档，见 [合规档案](compliance/README.md)。用户未跟踪的 `Forwardx/` 保留并排除 Git/容器构建。

`TUNEX_TST_ENABLED=false` 与 `FORWARD_NATIVE_BOTH_ENABLED=false` 保持发布默认值。未通过门槛不改写为通过，不据此开启生产能力。
