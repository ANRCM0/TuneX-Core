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

## 下一项优化的约束

接收临时 payload 如果复用，必须在帧校验后使用、复制至业务接收缓冲后才归还；
不能提前清零应用仍在读取的数据。截断、协议错误、stream reset、carrier failure
和 session close 都须回收，并继续验证原有流控和 sibling 隔离。UDP datagram
保留消息边界及独立队列，不随着 TCP 临时 buffer 优化一起改动。

该优化尚未实现。先补所有权、截断与错误路径测试，再重复同一 workload 的
无 profiling A/B，最后在 Linux race/长稳中验证，不能仅凭本表宣布完成。
