# 性能基线与回归检查

所有拓扑使用临时 loopback Agent、随机 admin token 与回显目标，不需要生产
凭据。运行输出保存在被 Git 忽略的 `results/`；不要提交原始 profile 或配置。

```sh
python3 -B -m unittest discover -s scripts/perf -p 'test_*.py'
(cd agent && go build -o ../scripts/perf/.bin/tunex-agent .)
python3 -B scripts/perf/stream-baseline.py \
  --agent-binary scripts/perf/.bin/tunex-agent --scenarios direct relay
```

普通采样显式关闭 profiling。需要定位热点时，追加
`--capture-profiles --profile-seconds 3`；CPU/trace 时长支持 1–20 秒，profile
在单独的持续 payload 负载阶段采集，不纳入之前测量的 CPU/RSS 增量。
各次采样保留独立目录和收据；失败退出 4。使用 `go tool pprof` / `go tool trace`
读取文件。Linux `/proc` 不可用时 CPU/RSS 保留 `null`，不伪造 0。

`--compare <earlier-artifact.json>` 比较同一 workload 和环境。退出 3 表示
退化、缺失/非法指标或采样条件不匹配；退出 2 表示参数、运行或读取失败。
旧 Linux anchor 不是跨平台容量标准。`--rtt-ms` / `--packet-loss-percent` 只是
外部测量标签，本脚本不会进行网络整形。

原生 payload 测量先执行吞吐和并发往返，最后执行入口建连压力。TCP setup
仅等到入口握手完成，关闭客户端后下游拨号/接受/回收可能仍在进行；将数百
次 setup 放在 payload 前面会引入阶段干扰。该修订不改变 RTT 的计时范围、
样本数量或阈值。`workload.stream_phase_order` 明确记录顺序；字段缺失按
旧顺序解释，新旧顺序不允许直接比较，必须用同一新 harness 重测两端。

流量阶段的回显目标运行在独立 Python 子进程，避免目标端 accept/线程创建与
计时客户端竞争同一个解释器。子进程启动不计入流量测量；结束时关闭已连接客户端、
释放监听并等待进程退出。热更新仍使用独立目标的接受事件与完整 payload 验证。
`workload.stream_target_model=isolated_process` 明确记录流量目标形态；旧工件缺失该字段时
解释为 `shared_interpreter`，两种模型不允许混比，两边必须使用同一新版采样器重测。
该隔离调整不改变样本数或回归阈值，也不构成 Agent 性能提升的证据。

资源读数等待连接回收：所有 Agent 的 goroutine 数连续 1 秒不高于负载前
读数后，才使用该次真实快照；15 秒内未达到或读数缺失则失败，不以最小值
或 0 替代。等待收据单独记录在 `quiescence`，CPU 增量包含回收和该阶段的
admin 采样开销。`workload.resource_phase` 标记此口径，拒绝与旧时点混比。

热更新单独声明 `workload.hot_reload_samples`：quick 每轮 100 次，full 每轮
200 次；CI 三轮 quick 合并 300 个原始样本，再计算 apply/effective 的 p95/p99。
旧 quick 每轮只有 8 次（总计 24），旧 full 每轮 20 次；新旧数量不能直接混比。
计时仍从 apply 前开始，apply 返回与新目标实际 payload 返回分别记录，所有
原始值和相对门禁保留。新目标必须收到连接并返回完整 payload；
`hot_reload_verification` 标记该验证方式。目标关闭后等待接受线程和已连接
客户端的读线程退出，避免采集器自身的资源留至后续轮次。该修订不放宽阈值，
也不能仅凭新一轮通过就认定旧失败只有噪声。

每类 Go transport 仍各五个样本，但两端改为 A/B、B/A 交错的独立进程，
每进程 `-count=1`。完整 TST runtime 基准启用真实流量账本，每次记账会
同步保存私有状态并执行文件/目录 sync；其耗时包含存储，不能等同于纯帧
处理。保持这部分语义及门禁，使用 `go_sample_order` 拒绝混比旧批量口径。

## 同一 Runner 上比较两个源码版本

[Performance workflow](../../.github/workflows/performance.yml) 在相关 push/PR
自动测量 baseline 与 candidate；也可手动指定完整 baseline SHA。使用同一
Ubuntu Runner、Go、amd64 架构、GOMAXPROCS=4 和候选 harness 顺序测量：

- 真实 native direct/relay：吞吐、p95/p99、CPU、RSS、goroutine、错误计数。
- Go transport：plain TCP/UDP、TST stream/mTLS、TST runtime TCP/UDP；每项五轮，
  包含 ns/op、MB/s、B/op、allocs/op 的轮次分布；门禁比较其中位数。
- 工件记录源码 SHA、二进制 SHA256、实际编译架构/Go、环境和 workload。
  原始 benchmark、JSON/CSV 与比较收据即使失败也上传，保存 14 天。

先以 `-trimpath` 构建两端，再进行三轮交错 native 采样（A/B、B/A、A/B），
每轮每端至少采集 500 次建连。原始数值样本写入 JSON，合并后重新计算业务
median/p95/p99，不平均各轮分位数。错误数累计，资源读数取轮次中位数；任一
轮的失败、缺失或非有限值均不能通过。之后相邻测量两端 securelink 与
tstruntime，避免候选 native 采样紧随重度 Go transport 负载。

Go benchmark 的 `ns/op` 是一整轮的平均操作成本，五轮平均值的 p99 不代表
业务单包 p99。因此 Go 指标按中位数门禁，轮次尾部分布变化保留在收据的
`run_distribution_variations`；native 业务 p95/p99 继续执行相同相对门禁。
所有字段仍须通过有限值、单位和样本完整性校验。

各轮原生阶段另存 `round-N/native-phase.json`，最终 `stream-baseline-*.json`
包含完整指标和各轮环境。CI 工件名称包含源码 SHA 和运行次数。可用
`--native-rounds` / `--setup-samples` 控制重采样；比较条件仍须一致。

可在固定主机运行相同流程；`BASE_SHA` / `HEAD_SHA` 必须是完整 40 位 commit SHA：

```sh
python3 -B scripts/perf/ci-baseline.py \
  --base "$BASE_SHA" --head "$HEAD_SHA" --max-regression 0.20
```

Git 导出和编译只使用本地提交及标准库，不下载依赖，不修改现有工作区源码。
导出保留在被忽略的 `.bin/`；输出位于 `results/ci/anchor`、`candidate` 和
`comparison.json`。缺失 benchmark、非法单位、样本不完整、构建/运行失败均
不能通过。没有 profile 文件上传步骤。

采集失败的 `comparison.json` 保留 `error_type` 和 `error_stack`（harness
文件名、函数名、行号），便于定位；不输出异常正文、命令参数、局部变量
或 Agent 日志，避免把临时凭据写入公开工件。

共享 CI 的默认相对阈值为 35%，固定主机可收紧；它不能消除调度噪声，失败后
应检查收据、复测和 profile，不能自动提高阈值或刷新 anchor。短采样不能替代
真实 RTT/丢包、多规则、长稳及发布容量验收。完整状态见
[V2.2 工作记录](../../docs/v2.2-performance.md)。

## 实际 RTT/丢包矩阵与持续负载

`runtime-matrix.py` 编译 opt-in 的 Go 测试二进制，调用生产 forwarder/TST
runtime，使用随机端口与临时私有状态。默认关闭 profiling，TST 同步持久记账
保留；plain 不经过 Agent，native relay 使用 `RELAY → EGRESS → target`。
六类拓扑为 plain TCP/UDP、native relay TCP、TST TCP/UDP、同 Link 的 TCP/UDP
混合流。每类覆盖 64、1400、16384 字节、1/8 个并发客户端；混合流的低并发
为 2，保证 TCP 与 UDP 同时存在。CI 的 clean/delay/loss 三组共 108 个 case。

```sh
python3 -B scripts/perf/runtime-matrix.py --out scripts/perf/results/runtime-clean
# Linux：20ms RTT，无丢包；实际整形，不能在 Windows 以标签替代
python3 -B scripts/perf/runtime-matrix.py --condition delay \
  --out scripts/perf/results/runtime-delay
# Linux：20ms RTT，每方向独立随机 1% 丢包
python3 -B scripts/perf/runtime-matrix.py --condition loss \
  --out scripts/perf/results/runtime-loss
# Windows/Linux：持续 10 分钟，8 客户端共享一条 TLS/TCP carrier
python3 -B scripts/perf/runtime-matrix.py --mode soak --kinds tst_mixed --duration 600 \
  --out scripts/perf/results/runtime-soak
```

Linux 要求 `iproute2`、`unshare`、root 或无交互 sudo。每个 case 在新 netns
中运行；先检查命名空间与 PID 1 不同，再仅启用该命名空间的 lo。未匹配流量
进入 prio 1:1，选定 carrier 的双向端口进入 1:3/netem；每方向 delay=RTT/2。
native 只整形 relay/egress 间 TCP，TST TCP/UDP 都整形 TLS/TCP carrier，
plain 整形客户端/目标间协议。每组收据保存宿主 qdisc 前后快照，必须一致。
netns 随进程结束销毁，测试也显式删除自己的 qdisc。

每个 JSON 保存请求参数、实际 tc 命令/初始与最终 qdisc/分类器/包与丢弃计数、
payload 完成与错误数、原始 RTT 样本、吞吐、每秒 Go heap/goroutine 与 Linux
RSS/FD/CPU ticks、持续一秒满足阈值后的真实回收快照。测量端逐包加入客户端
与序号，完整比较 echo；允许丢包时仅 plain UDP 超时作为丢包样本，损坏仍失败。
TST 每条规则持久账本必须覆盖该规则所有完成的双向 payload 字节。
审计端从原始样本复算 median/p95/p99 与吞吐，检查每协议数量、整形计数及
延迟下限；loss 组必须至少观察到一次真实 netem drop。计数缺失、字段非法、
资源未回收或进程失败均不能通过，失败工件仍上传。

长运行保留每协议最多 10,000 个均匀 reservoir 样本及完整计数，避免只保存开头
样本。每秒额外更新 `.progress.json`，中断仍有最近一份脱敏收据；最终 JSON
保留所有资源采样。Windows 的 RSS/FD/CPU ticks 为 null，极短 RTT 原始零值
保留，不从这种时钟分辨率推断亚毫秒 p95/p99。
`matrix.json` 保存源码 SHA、工作树状态、Go 文件 hash 和二进制 hash；
`--binary` 复用时明确只验证外部二进制 hash，不证明它来自当前工作树。

Performance workflow 新增上述三组矩阵与 300 秒、20ms/1% 条件的混合流持续
负载，原有双 SHA 性能回归门禁与 35% 阈值继续执行。标准 CI 与本机短时持续
负载不证明固定主机容量、跨日长稳、真实 WAN 或正式部署通过；这些项目按
用户决定延后统一验收。
