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

共享 CI 的默认相对阈值为 35%，固定主机可收紧；它不能消除调度噪声，失败后
应检查收据、复测和 profile，不能自动提高阈值或刷新 anchor。短采样不能替代
真实 RTT/丢包、多规则、长稳及发布容量验收。完整状态见
[V2.2 工作记录](../../docs/v2.2-performance.md)。
