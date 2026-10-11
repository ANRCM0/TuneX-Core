# V2 测试与发布验收

本轮从基线 `8ca81c0` 实现 V2，不使用旧版本绿色 CI 作为当前代码证据。执行结果记录于 [实现台账](v2-progress.md) 与本页链接的证据文件。候选 TST 默认关闭，尚不能标记正式发布。

后端最终结果见 [后端证据](testing/tst-backend-evidence.md)，Agent 结果见 [Agent 证据](testing/tst-agent-runtime-evidence.md)。

## 自动检查

```bash
cd backend
bun ci
bunx prisma generate
bun run typecheck
bun run test:unit
bun run test:integration
cd ../web
npm ci
npm run typecheck
bun test src
NEXT_PUBLIC_API_MOCK=1 NEXT_PUBLIC_PAYMENTS_ENABLED=false npm run build
cd ../agent
go vet ./...
go test ./... -count=1 -timeout=120s
go test -race ./internal/securelink ./internal/tstruntime
go test ./internal/securelink -run '^$' -fuzz FuzzReadFrame -fuzztime 15s
go build ./...
cd ..
node scripts/ci/native-dependency-check.mjs
bash scripts/ops/tests/installer-static.sh
python3 -B -m unittest discover -s scripts/integration/tests -p 'test_*.py'
```

数据库集成使用独立数据库与 Redis，配置见 CI。V2 事务/权限/幂等/回收专用测试使用 loopback `tunex_v2_test`，设置 `TUNEX_DB_TEST=1`，运行 `bun test tests/v2-forward-db.test.ts`。fixture 拒绝任意环境的 DATABASE_URL，不能对生产数据库运行。

## 真实网络

Linux Docker/Compose、Python 3 与 OpenSSL 环境执行：

```bash
bash scripts/integration/abcd-core-gate.sh
bash scripts/integration/a00-core-gate.sh
```

第一条构建当前 Panel/Worker/Agent，执行 TST 与原生 both；后者覆盖现有原生协议与精确端口回收。两条不可并行操作同一测试拓扑。输出位于 `scripts/integration/evidence/`，只保存脱敏结果，禁止上传环境文件、凭据、原始 placement 和日志。测试拓扑使用固定容器/网络/卷，清理前核对归属。

另有可在 Windows/Linux 运行的 `node scripts/integration/tst-local.mjs`，要求已迁移的 loopback `tunex_v2_e2e` 与专用 Redis。它启动实际 Panel、Worker 和两个 Agent，使用真实 TLS/TCP/UDP 连接，覆盖幂等、自动复用、权限、编辑 CAS、A/B 隔离、生命周期、重启、目标诊断与流量回执；测试全部原生直连/中继 TCP/UDP/both 与 TST TCP/UDP/both，并等待真实五分钟自动回收宽限期。不注入 Ready、缩短生产宽限期或修改缓存。临时凭据和私有状态放系统临时目录，证据仅保留脱敏判定。

`--keep` 在成功后保留隔离测试进程用于真实页面验收；退出后清理其规则/进程，保留测试库以供审查。该测试明确标识宿主平台，Windows loopback 成功不证明 Linux Docker 安装成功。

调试时 `--keep-on-failure` 可保留失败环境供只读检查，按 Ctrl+C 后执行清理；仅用于隔离 loopback 测试。`TUNEX_TEST_PANEL_PORT` 可指定固定测试端口，默认自动选择空闲端口。

当前 Windows 实网整体验收结果：全部 27 项通过，包含原生直连/中继 TCP、UDP、both，TST TCP/UDP，TST both 共享载体，授权诊断、流量回执、Agent/Panel 重启、CAS、共享规则隔离、最后引用删除和五分钟自动 Link 回收。结果文件为 `scripts/integration/evidence/tst-local-result.json`；它只保存布尔标签和宿主范围。

真实业务浏览器验收也已通过。脚本使用独立 Chrome profile、实际 Next standalone、当前 Panel 和上述两个 Agent，完成真实登录及授权 Workspace 选择；Native direct TCP 与 TST relay both 的创建、payload、编辑、历史、诊断、暂停/恢复、流量和删除均通过。证据为 `web/test-artifacts/real-unified-forward-browser-evidence.json`：4 个场景、6 个 payload、6 个响应式宽度，编辑 PATCH 返回 200，0 个运行时异常；证据不包含账号凭据。

## 性能与安全

```bash
cd agent
go test ./internal/securelink -run '^$' -bench 'Benchmark(PlainTCP|TSTMutualTLS|TSTStream)$' -benchmem -benchtime 500ms -count 3
go test ./internal/tstruntime -run '^$' -bench BenchmarkTSTLoopbackTCP -benchmem
go test ./internal/tstruntime -run '^$' -bench 'Benchmark(PlainUDP|TSTLoopback(UDP|TCP))$' -benchmem -benchtime 500ms -count 3
```

性能基线记录平台、CPU、样本、消息尺寸、并发数与 median/p95/p99；plain TCP/UDP、原生 relay、TLS/TST 分别实测，不预设新协议快于旧实现。`scripts/perf/stream-baseline.py --compare` 对固定同机 anchor 执行相对回归门禁。Parser fuzz、认证负例、版本/授权/代次拒绝、背压/半关闭、过期证书/租约、资源上限及 sibling 更新属于必需回归。

V2.2 新增真实载体网络条件矩阵：

```bash
python3 -B scripts/perf/runtime-matrix.py --condition loss --out scripts/perf/results/runtime-loss
python3 -B scripts/perf/runtime-matrix.py --mode soak --kinds tst_mixed --duration 600 --out scripts/perf/results/runtime-soak-local
```

第一个命令实际在隔离 Linux netns 中施加 20ms RTT、
每方向 1% 随机丢包，验证完整 payload、持久字节、资源回收和真实 netem
计数；clean/delay/loss 三组共 108 个 case。第二个命令运行本机持续负载；
Linux 可追加 `--condition loss`。
命令与工件口径见 [脚本说明](../scripts/perf/README.md)，固定源码执行结果见
[V2.2 记录](v2.2-performance.md)。这些 CI/loopback workload 不替代真机部署
或跨日验收；上述项目按用户决定延后统一进行。

独立安全审查需审查帧状态机、互信身份、快照授权、密钥生命周期、资源耗尽与缓存/统计恢复。内部代码评阅和 fuzz 不替代外部独立审查。

V2.3 R1 的纯图/策略与真实 HTTP 路由测试位于 `backend/src/domain/routing/__tests__/`
和 `backend/src/routes/__tests__/routing.test.ts`；真实认证/Workspace/Prisma 集成由
`backend/tests/routing-topology.test.mjs` 在 `TUNEX_DB_TEST=1` 下执行，标准 CI 的
`test:integration` 自动收集。该测试拒绝非 loopback 或非显式测试数据库。
`TUNEX_ROUTING_ENABLED=false` 为默认值；接口和 R2–R5 范围见
[V2.3 路由开发](v2.3-routing.md)。

V2.3 R2 Native 目标探测专项在 `backend/src/services/__tests__/routing-probe.test.ts`，
真实 HTTP 权限测试沿用 routing 路由测试。`routing-topology.test.mjs` 另验证独立
默认关闭开关、目标快照、拒绝路径及真实 Redis Lua 预算/过期写者围栏。
core CI 的 `scripts/integration/routing-probe.py` 使用真实 Agent/目标 socket 验证
TCP 观测、目标失效、配置身份变化与实际经过的过期窗口；结果属于目标段，不是
链路 RTT/丢包/UDP 或端到端健康证明。真机部署继续延后统一验收。

## 证据与平台矩阵

已完成的数值与范围写入上方证据文件；未运行项保持待验证。Web 组件 fixture 的交互和生产 CSS 检查只证明被加载组件；完整登录/Workspace/API/Agent 浏览器流程已由真实业务浏览器证据单独记录。

| 门槛 | 当前范围 |
| --- | --- |
| Windows Agent 单元/真实 socket | 本地执行，完整结果见 Agent 证据 |
| Linux amd64/arm64 构建 | 交叉编译结果仅代表构建 |
| Linux 实际运行/race | 5a3e300 主 CI/race、真实容器 shared-Link、108 个隔离 netns case 和 300 秒丢包条件 soak 通过；原始执行证据见 V2.2 记录 |
| 正式 Linux Compose 安装/升级/恢复/回退 | 延后统一真机验收，隔离 CI 容器测试不替代正式安装验证 |
| Web 单元/Next build/真实业务浏览器 | 单测、typecheck、生产构建与当前隔离 Panel/Agent 浏览器验收通过；真实证据见 `web/test-artifacts/real-unified-forward-browser-evidence.json` |
| 外部独立安全审查 | 尚未完成，TST 保持关闭 |
| 长期运行/真实跨日/公开生产 | 尚未完成，无正式发布声明 |
