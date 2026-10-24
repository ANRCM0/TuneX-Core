# Phase 2：独立授权记录、旧备份恢复与容量测量

状态：implementing；本地验收已通过，提交后须再用干净工作区验证。基线为
`61d97f4`，本切片没有完成 Phase 2 的全部出口，也不是发布声明。

## 行为与持久状态

Control 在每次 Snapshot 发布到 MySQL 前，将签发截止上界持久化到
`$TUNEX_CONTROL_STATE/authority/state.json`。该 MAC 记录绑定 MySQL server UUID、
数据库名称和 CA 证书 DER 摘要，保留递增 sequence、历史最大有效截止、租约及
时钟偏差上界。MAC 密钥位于 `authority-secrets/key`。数据库回滚可以造成记录
偏保守，不能造成已签发授权从独立记录消失。

初始化只允许显式全新部署，且数据库中不能已有 Node：首次启动设置
`TUNEX_AUTHORITY_INITIALIZE=1`；成功后撤掉此标志。记录与密钥缺失一部分、
MAC 错误、数据库或信任材料不匹配都拒绝启动。不能删掉文件重新初始化旧系统。
原子更新写文件并 fsync，Linux 还 fsync 目录。跨进程互斥锁不自动清除；进程
异常退出留下的锁需要先核实旧进程已停止，再由操作者处理。

迁移 `0005-recovery-quarantine.sql` 增加 Forward 暂停、Operation/幂等历史
失效标志和恢复审计表。隔离恢复保留 revision、generation、fence、退役历史和
Agent journal；旧 Node/证书全部撤销，观测失效，旧 Operation 不再由 scanner
推进，旧成功幂等请求返回 `RECOVERY_REPLAY_REQUIRES_REVIEW`。恢复的 Forward
仍可查询，但不再发布执行授权。

## 运维入口

使用受保护的环境配置，避免把口令和 token 放入日志或 shell 历史。命令：

```sh
npm run ops -- status
npm run ops -- maintenance
npm run ops -- backup /secure/backups/tunex
npm run ops -- restore /secure/backups/tunex/<backup-id>.json tunex_recovered_20261013
npm run ops -- resume <recovery-id>
```

共同配置为 `TUNEX_CONTROL_STATE`；backup/restore 还需要 `DATABASE_URL`，指向
当前绑定的源数据库。`TUNEX_MYSQLDUMP`、`TUNEX_MYSQL` 指向与服务器版本匹配的
客户端，默认查 PATH。备份采用真实 MySQL 单事务 dump，SQL 的 SHA256 与清单的
MAC 一起验证，SQL/清单和恢复凭据以独占文件创建并同步。数据库口令通过子进程
环境传递。命令仅输出清单路径、恢复 ID、目标数据库名称和凭据文件路径。

当前 SQL 备份含敏感业务与身份历史，文件权限为 0600、目录为 0700，**没有
内建加密**。生产必须通过受控加密存储/传输保存 SQL 与清单，Windows 必须由
部署者配置等效 ACL；Node 的 POSIX mode 不能保证 Windows ACL。备份输出目录
不得包含独立 authority 密钥。保护记录/密钥必须在数据库备份之外独立持久挂载，
使用能保证互斥和原子替换的本地文件系统；不能给多个实例各自创建独立副本。

## 停机恢复步骤

1. 执行 maintenance，确认 `/health` 返回 maintenance，业务 API、机器路由和
   Worker 不再推进。停止并隔离所有可能签发的 Control/Worker，核实实例、
   入口及进程，不只依赖一个服务的 health。CLI 的 stopped 标志是操作者声明，
   不远程证明其他主机进程已停止。
2. 保留独立 authority 记录和密钥。备份可能早于撤销/删除，必须核对业务审计，
   不把旧数据库作为最新授权事实。用新的 CA 准备服务器证书；旧 Node 信任
   不能延续。若独立记录不可信，停止并逐节点核实实际流量，不能使用恢复 CLI
   猜测截止，也不能清空 Agent high-water。
3. 设置 `TUNEX_ISSUERS_STOPPED=1`、`TUNEX_RECOVERY_CA_CERT`、
   `TUNEX_RECOVERY_CREDENTIALS` 和 `TUNEX_RECOVERY_CLOCK`。时钟程序必须是
   真实 `time-proof`，CLI 加 `--check` 获取同步状态。可用
   `TUNEX_RECOVERY_CLOCK_ARGS` 的 JSON 字符串数组传入 supervisor 参数；
   不接受缓存的过期或未来 checkedAt。
4. restore 只导入未存在的新数据库，不能覆盖源或已有数据库。独立历史最大
   validUntil、已记录 skew 和恢复时钟误差都耗尽前返回 `RECOVERY_NOT_READY`。
   导入后隔离旧状态、轮换账号 bearer token，并将新凭据写入受保护文件；
   最后重绑定独立记录。整个过程保持 maintenance，返回精确 recovery ID。
5. 用新数据库、新 CA/服务器材料和原独立 state 目录启动 Control，撤掉初始化
   标志。用安全管理通道阅读凭据文件，审阅恢复意图、成员授权、删除事实和
   端口状态。确认后 `resume <recovery-id>` 仅开放已审阅的控制面；旧 Node
   仍撤销、旧 Forward 仍暂停。尚未核实的对象继续暂停。
6. 退役旧主机身份，核实旧 Agent/监听已停止。安装新的 CA 信任并注册新的 Node
   ID，保留旧 Agent journal 作为审计材料。通过显式 PUT/new revision 将已审阅
   Forward 重绑新 Node；普通运行中的 Node 移动仍拒绝。为重建使用新请求键，
   不自动重放旧 Operation 或旧幂等键。
7. 在开放外部客户端流量前实际验证 TLS、旧证书/token 拒绝、目标策略、端口
   冲突、TCP/UDP 和资源回收，记录新 Operation、恢复范围与数据损失说明。

失败时维护状态不会自动解除。DDL/SQL import 不具备事务回滚，可能留下未完成的
新数据库或凭据文件；检查并保留故障证据，由操作者修复或选新目标重试。新数据库
不能绕过审核另配一个全新 authority 目录启动。恢复过程中不得启动第二个恢复或
resume 命令；操作状态、凭据与独立记录要按一个受控维护窗口处理。

## 验证与容量样本

`npm run test:recovery` 用真实低 generation 备份、后续更高 Agent high-water 和
新 CA 演练恢复。9 项检查覆盖实际 TCP/UDP、maintenance、过早恢复拒绝、篡改 SQL
拒绝、源库覆盖拒绝、旧 Control binding/Node 证书/token 拒绝、幂等历史隔离、
审核门槛和新身份 revision 重建。测试保留日志摘要和环境，不保留密钥/token。

`--diagnostics` 将 Agent 汇总测量写入自身受保护 state 目录，不改变 ADP，也不能
作为执行授权。记录 TCP/UDP、drain、goroutine、heap/runtime memory；Linux 另记
`/proc/self/fd`、CPU 时间和 max RSS。`network-fixture --mode load` 为每个客户端/
序列发送唯一 payload 并逐包核对，记录吞吐、时延和错误。

`npm run test:capacity` 的 6 项检查包含 32 TCP + 16 UDP、64 TCP + 32 UDP 两轮
1024-byte/3-second 负载、实际资源回收、续期保持部署身份，以及四个真实 Agent
同主机同时重连并验证 payload。2026-10-13 的本地样本约为 54–61 MB/s 双向
核对流量，p95 4–13 ms；峰值约 10–11 MB heap、33–34 MB runtime memory、170 FD、
201 goroutine、23 MB max RSS；四 Agent 重连约 1.4–1.6 秒。它们是有界开发样本，
不是最大容量，也不能证明 4096 个会话的性能或全机群生产重连能力。

本地拓扑：Node 24.14.1、MySQL 8.4.9 的 Windows Control，Go 1.26.3 Linux/amd64
Agent/client/target，WSL2 kernel 6.6.87.2，测试 UID 为 root，实际进程限制写入证据。
原生 Linux 入口也已配置，CI 在同版 MySQL service 镜像内执行客户端；尚未运行的
远程 CI 不计为通过。证据在忽略的 `.artifacts/{recovery,capacity}/run-*/evidence.json`，
包含 commit、dirty 标志、Agent SHA、kernel、实际代次/资源/流量与拓扑。

```sh
node scripts/run-go.mjs build -o ../.artifacts/tunex-agent ./cmd/tunex-agent
node scripts/run-go.mjs build -o ../.artifacts/network-fixture ./cmd/network-fixture
node scripts/run-go.mjs build -o ../.artifacts/time-proof ./cmd/time-proof
# 设置专用 TUNEX_TEST_DATABASE_URL；MySQL 用户需要建/删临时库及 dump 权限。
npm run test:recovery
npm run test:capacity
```

Windows 使用 `.artifacts/*-linux` 交叉编译二进制，并设置 inspected
`TUNEX_WSL_HOST`、`TUNEX_OPENSSL` 和必要的 MySQL 客户端路径；脚本只停止自身
唯一 `/tmp/tunex-linux-*` 命令对应的进程，不修改既有 WSL 服务。

剩余门槛包含 direct 验收逐项证据、Node 总预算边界、长期状态增长与告警、
生产非 root 环境、完整 Linux 栈与故障隔离、最新备份恢复及二进制回滚演练。
Relay/Transport 契约与实现、产品 Web、部署/SBOM/许可证及发布验收仍在路线图中。
