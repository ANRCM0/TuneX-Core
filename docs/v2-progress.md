# TuneX V2 实现与验收台账

执行用户提供的 [完整方案](v2-development-plan.md)，第 23–27 节优先。实现基线为 `8ca81c0c3f779bb3485594f8b1dc91f3a1c246a4`。证据属于当前工作树；不能称为已合并、已发布或生产验收。

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
本机 direct loopback smoke 已生成 runtime profile 文件；这只是工具链验证，
不替代固定 Linux 主机上的性能对比或发布容量结论。

Python harness 契约 3 项、相关 shell 语法、原生依赖扫描和当前文档本地链接检查通过。安装器完整 gate 在 Windows Git Bash 下失败，涉及 POSIX 文件权限等宿主差异；保留严格检查，不标为通过。

## 实网发现与修复

真实测试启动当前 Panel、Worker、两个独立 Agent 与 MySQL/Redis，未注入 Ready，也未手改运行缓存。已修复 wildcard 契约、初版修订值、UDP sibling 隔离、双向 UDP 闲置、TLS 失败握手频率、上报枚举/可空字段、同 generation 租约乱序，以及原生首次部署路径。

TST 实网已验证 TCP/UDP/both、普通成员权限、并发幂等/冲突、跨空间拒绝、自动复用、DTO 脱敏、授权诊断、流量回执、修改/暂停/删除 A 保持 B、CAS、Agent 重启恢复、Panel 重启账本和最后业务监听移除。原生六组合与五分钟真实自动回收等待最终成功证据。

真实业务浏览器已在当前隔离 Panel、Worker、MySQL/Redis 和两个 Agent 上完成登录、Workspace 切换、Native/TST 创建、TCP/UDP payload、编辑 CAS、历史、诊断、暂停/恢复、流量和删除；抽屉在 360、390、768、1024、1280、1536 宽度无横向溢出，未产生前端 Link 写操作或运行时异常。

## 发布门槛

| 门槛 | 状态 | 所需条件 |
| --- | --- | --- |
| 当前候选 SHA 的 Linux CI/race | 待执行 | Linux Runner 与候选源码；本机无已安装 WSL、Docker 或可用 GCC |
| Linux Compose 全新安装、升级、恢复/回退与实网 | 待执行 | 隔离 Linux + Docker；执行安装与 integration gates |
| 外部独立协议/密码学/许可审查 | 待执行 | 独立审查者；内部评阅不能代替 |
| 长期故障、真实跨日、WAN 与生产发布后验证 | 待执行 | 授权环境、运行周期与固定候选版本 |

## 数据与来源

未重置生产库、删除现有用户业务记录、销毁历史凭据或修改生产部署。增量迁移隔离不兼容载体并保留记录。测试仅操作显式 loopback 数据库。历史源码逐文件校验后归档，见 [合规档案](compliance/README.md)。用户未跟踪的 `Forwardx/` 保留并排除 Git/容器构建。

`TUNEX_TST_ENABLED=false` 与 `FORWARD_NATIVE_BOTH_ENABLED=false` 保持发布默认值。未通过门槛不改写为通过，不据此开启生产能力。
