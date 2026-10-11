# TST/mTLS 热点采样（2026-10-11）

源码：`d7a532f8d8d467af4d308943c4e6fbec2bd62e7b`。Windows/amd64，
i5-12500H，Go 1.26.3，GOMAXPROCS=4；16 KiB 消息，真实 loopback mTLS
carrier。使用 CPU、heap、block、mutex 和 trace 同时采样，诊断开销不从
结果中扣除。这是热点定位，不是容量或未采样吞吐对比。

```sh
go test ./internal/securelink -run '^$' -bench '^BenchmarkTSTMutualTLS$' \
  -benchtime=2s -count=3 -benchmem \
  -o ../scripts/perf/.bin/securelink-profile.test.exe \
  -cpuprofile ../scripts/perf/results/tst-hotspots/cpu.pprof \
  -memprofile ../scripts/perf/results/tst-hotspots/heap.pprof \
  -blockprofile ../scripts/perf/results/tst-hotspots/block.pprof \
  -mutexprofile ../scripts/perf/results/tst-hotspots/mutex.pprof \
  -trace ../scripts/perf/results/tst-hotspots/runtime.trace
```

该命令在 Agent 目录运行，事先创建输出目录，并设置上述 GOARCH/GOMAXPROCS。
文件、hash、版本与命令在本机被忽略目录的 `manifest.json` 中保留。采样共约
14.35 秒；三轮观测为 238.27/196.82/218.14 MB/s，18,030/18,097/18,057 B/op，
26/27/27 allocs/op，不能与无 profiling 的样本直接比较。

## 观测与解释

| 采样 | 观测 | 可以支持的下一步 |
| --- | --- | --- |
| CPU | `runtime.cgocall` flat 54.40%；AES-GCM 加密/解密分别 2.55%/1.81%；`memmove` 2.52% | Windows 网络系统调用开销较大；不能据此跳过 TLS 或推断 Linux 相同 |
| alloc_space | 累计采样分配约 3,383 MB；`ReadFrame` flat 90.91%，`signalLocked` 5.70% | 优先评估接收帧临时存储复用，之后才评估唤醒分配 |
| block | 累计等待约 64.79 秒；channel receive 66.52%、select 32.97%、mutex lock 0.51% | 等待与背压/benchmark 请求应答有关，不能直接认定死锁或失败 |
| mutex | 累计 contention delay 约 1.12 秒 | 本次未显示业务 mutex 是主要分配源；仍需多 stream 场景 |
| trace scheduler | 约 9.86 秒累计调度延迟；`signalLocked` flat 57.14% | 定位唤醒路径；这是触发被唤醒 goroutine 的归属，不是该函数 CPU 耗时 |

累计分配不是 RSS，也不证明泄漏；等待/调度时间来自多 goroutine 的累计值，
可以大于墙钟时间。短采样只说明这个 workload 的热点，不能替代 Linux、多
规则、慢消费者和真实 RTT/丢包矩阵。

四份 pprof 已解析。完整 trace 由离线构建的 amd64 `cmd/trace` 转换为 scheduler
pprof 并解析；安装的 386 trace 工具因地址空间耗尽未能读取这份大文件。
工具构建和结果都留在 workspace 的忽略目录，未修改全局 Go 安装。

## 接收优化与所有权约束

本轮已按采样结果实现连接独占的 TCP DATA 临时缓冲：首次需要时取得 16 KiB，
帧校验后复制至业务接收缓冲，再复用至下一帧。读循环退出后清零完整缓冲并
归还有界缓存；不能提前清零应用仍在读取的数据，也不能在 carrier I/O 结束
前归还。截断、协议错误、carrier failure 和 session close 都走读循环的
最终回收；RESET 后已复制的字节仍可读，迟到帧仍仅返回 Link credit。
UDP datagram 和控制帧保留独立 payload，公开 `ReadFrame` 的所有权不变。

所有权、截断与错误路径测试连续 20 轮通过；同机无 profiling 五轮 A/B 的
TSTStream/mTLS 每操作分配中位数分别减少 90.3%/91.5%，详见
[工作记录](../v2.2-performance.md)。当前优化的
[Linux race/集成 CI](https://github.com/PaiMonCai/TuneX/actions/runs/38112786502)
已通过；首轮同 runner 门禁因原生 relay RTT p95 超线而拒绝。新 harness
的双端重测后续已在 `46b0a96` 通过，详见
[最终 Linux 证据](../v2.2-performance.md)。
长稳仍待验证，不能以先前源码的采样代替。

## 接收优化后复测：9edcd86

固定源码 `9edcd863e458d5375b25a078ee2d8508dab94082`；同一 Windows/amd64
主机、Go 1.26.3、GOMAXPROCS=4、16 KiB mTLS 负载，CGO_ENABLED=0。
沿用本文的五类采样参数，文件路径改为
`scripts/perf/results/receive-hotspots/`；命令、环境、源码 SHA、stdout、
原始采样与文件 hash 保存在该目录的 `manifest.json`。四份 pprof 及完整
trace 转换后的 scheduler pprof 均解析成功。

带诊断开销的三轮为 316.95/321.88/345.46 MB/s、1,510/1,442/1,409 B/op、
23/22/22 allocs/op。CPU profile 时长约 8.70 秒，累计 CPU 样本 22.41 秒；
与前一轮执行次数和持续时间不同，不能直接用累计 MB 或耗时推断改善比例。
分配改善依据仍是工作记录中的无 profiling 同机 A/B。

| 采样 | 当前观测 | 后续意义 |
| --- | --- | --- |
| alloc_space | 累计采样约 254.36 MB；`signalLocked` flat 63.50%，`send` 10.22%，`queueControlLocked` 8.45%；`readFrame` 不再位于主要分配源 | 接收临时分配热点已消除；下一项评估通知与控制队列分配 |
| CPU | Windows `runtime.cgocall` flat 57.52%；AES-GCM 加密/解密 3.08%/2.68% | 仍不能据此推断 Linux 开销或跳过 TLS |
| block | 累计等待 37.94 秒，channel receive 65.30%、select 34.42% | 请求应答与背压等待，不能直接称为死锁 |
| mutex | 累计 contention delay 151.23 ms | 仅支持该 workload，未代替多规则高并发 |
| trace scheduler | 累计调度延迟 4.88 秒，`signalLocked` flat 64.77% | 进一步定位唤醒路径，不等于该函数自身 CPU 开销 |

`signalLocked` 通过关闭并替换通知 channel 广播状态变化，调用方会在锁内读取
该 channel，再在锁外等待。后续减少通知分配时，必须覆盖注册与唤醒之间的
竞态、多个等待方、deadline/cancel、队列与流控 credit、RESET/Close 以及
公平写队列，不能仅删除或合并 channel 更新。后续已实现按需注册通知：
检查状态与注册同锁，signal 关闭当前一轮后清除引用，无订阅时仍唤醒 writer。
32 个等待方、deadline/cancel、credit/队列、RESET/Close 的新增回归连续
100 轮通过，全量 Agent/vet 通过；当前 SHA 的性能与热点复测须以
[后续收据](../v2.2-performance.md) 为准，本节旧 profile 不代表新源码。
