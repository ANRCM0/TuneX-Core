# TST 后端验证证据

本记录对应 2026-10-11 共享工作区的当前源码。所有数据库验收均使用本机隔离
MySQL/Redis 实例；没有连接生产数据库，也没有把测试数据写入生产工作区。

## 源码和构建

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| TypeScript | `cd backend; node node_modules/typescript/bin/tsc --noEmit` | 通过 |
| 后端源码单元测试 | `TUNEX_POSIX_TOOLS=%TEMP%\\tunex-posix-tools; bun test src --timeout 10000` | **3182 pass, 0 fail**, 19159 assertions, 168 files, 41.97s |
| HTTP/数据库集成 | `node --experimental-transform-types --test --test-concurrency=1 tests/*.test.mjs` | **124 pass, 0 fail, 0 skipped**, 107.98s |
| V2 durable forward DB gate | `bun test tests/v2-forward-db.test.ts --timeout 10000` | **8 pass, 0 fail**, 74 assertions, 3.81s |
| 历史目标/来源持久化 | `node --experimental-transform-types --test --test-concurrency=1 tests/link-target-sets.test.mjs` | **6 pass, 0 fail** |
| 流量持久化 | `node --experimental-transform-types --test --test-concurrency=1 tests/link-traffic.test.mjs` | **3 pass, 0 fail** |
| 独立目录 typecheck/build | `node node_modules/typescript/bin/tsc --noEmit`; `bun build src/index.ts --target=bun --external external --outdir=dist` | 通过；619 modules，3,592,988 字节 |
| 依赖/密钥门 | `node scripts/ci/native-dependency-check.mjs`; `node scripts/ci/secret-scan.mjs` | 均通过；密钥扫描仅报告 5 个既有 demo 字符串告警 |

源码单元测试在 Windows 下通过 `D:\devTool\Git\usr\bin` 和隔离的
`%TEMP%\\tunex-posix-tools` 提供测试所需的 POSIX 工具。集成测试显式设置
`DATABASE_URL=mysql://root@127.0.0.1:33079/tunex_v2_test`、Redis `127.0.0.1:36379`
以及测试专用 `AUTH_SECRET`。

另建两个专用数据库并执行完整迁移后运行历史专项：
`tunex_link_target_sets_test` 和 `tunex_link_traffic_test`。测试脚本只有在
`TUNEX_DB_TEST=1` 且 URL 精确指向这些 loopback 数据库时才会执行；不会回退到
环境中的其他数据库。

## 已覆盖的 V2 行为

- 同一幂等键的并发创建只产生一个 Forward，丢失响应后重放保持同一业务身份。
- 普通成员使用已授权的 ingress/egress 节点关系，可创建多个自动规则并共享一个
  Link；节点使用权限、Forward 创建权限、工作区范围和 Agent 能力/新鲜度分别校验。
- ACK 排队期间快照续租先到时，较晚的旧 ACK 不能回退持久化部署租约；相同代次的
  已应用较长租约也不会被较短重复命令覆盖。
- 原生 direct/relay 的保存后应用重新进入现有 scheduler/orchestrator，初始保存的
  `pending_apply` 行可以完成到 revision 1；重放保持 revision 和身份，删除仍受确认的
  runtime 停止保护。
- 失败应用保留加密 Forward 和端口租约，恢复后保持身份；删除失败不会释放仍在使用的
  Link，最后一个引用确认移除后才回收租约并退休 Link。
- 历史 target/source 配置完整保留在不可变 revision 和 deployment snapshot 中；当前
  TST 编译器对不支持的历史策略显式返回 `tst_policy_unsupported`，不会静默丢字段或
  只选第一个目标。

## 原生路径授权语义

`backend/tests/tst-real-fixture.ts` 先创建隔离工作区的 ingress/egress 节点，再由管理员
在数据库中预置一条 `NodeBinding`。验收中的普通 member 只获得既有的 node-use 和
forward-create 能力，复用这条管理员准备好的关系；测试没有给普通成员增加创建绑定或
管理节点的权限，也没有在业务代码中绕过授权。

## 可复查命令

```powershell
$env:PATH = 'D:\devTool\Git\usr\bin;' + $env:PATH
$env:TUNEX_POSIX_TOOLS = Join-Path $env:TEMP 'tunex-posix-tools'
$env:DATABASE_URL = 'mysql://root@127.0.0.1:33079/tunex_v2_test'
$env:REDIS_URL = 'redis://127.0.0.1:36379'
$env:AUTH_SECRET = 'v2-isolated-backend-test-at-least-32-characters'
$env:ALLOW_REGISTER_FALLBACK = 'true'
$env:TUNEX_DB_TEST = '1'
$env:TUNEX_LINK_TARGET_SETS_TEST_DATABASE_URL = 'mysql://root@127.0.0.1:33079/tunex_link_target_sets_test'
$env:TUNEX_LINK_TRAFFIC_TEST_DATABASE_URL = 'mysql://root@127.0.0.1:33079/tunex_link_traffic_test'
cd backend
& '.\node_modules\bun\bin\bun.exe' test src --timeout 10000
node --experimental-transform-types --test --test-concurrency=1 tests/*.test.mjs
& '.\node_modules\bun\bin\bun.exe' test tests/v2-forward-db.test.ts --timeout 10000
```

`v2-forward-db.test.ts` 使用 Bun 的 `bun:` mock 模块，不能用 Node 直接加载；上面的
Bun 命令是该专项的可复查入口。

完整运行日志保留在主机临时目录的 `tunex-v2-backend-final-unit-2.log` 和
`tunex-v2-backend-final-integration.log`；V2 专项另见 `tunex-v2-backend-final-v2-db.log`。

## 独立目录锁定依赖构建

将当前后端源码、schema、package 和 lock 复制到仓库外的新目录
`%TEMP%\tunex-v2-backend-clean-4965bb4da0d0437686c3307d42e5f474`，最初不含 node_modules。
包、锁文件和 schema 与工作区逐项 SHA-256 相同；最终刷新当前 src 的改动后重新 typecheck
和 bundle 通过。Bun 可执行程序使用工作区已安装的同一版本，依赖解析使用独立目录的
node_modules。

常规 `bun install --frozen-lockfile` 在下载依赖和 Prisma 引擎后停留于 postinstall。
只停止该临时目录的安装进程后，以 `bun install --frozen-lockfile --ignore-scripts`
完成锁定检查（105 installs / 130 packages）。随后明确指定独立目录下载的 Prisma
query/schema engine，执行 `bun node_modules/prisma/build/index.js generate`；Prisma
6.13 客户端生成成功。引擎 SHA-256 与工作区的同版本引擎相同。这验证锁文件、生成客户端
和最终构建，保留 postinstall 在此 Windows 环境未完成的限制。

## 限制

这些检查证明隔离本机环境中的源码、数据库事务和模拟/环回 Agent 传输满足测试契约，
不等同于生产部署、WAN 条件下的容量结论或外部安全审计。临时构建目录使用锁定依赖
和已生成的 Prisma 引擎完成 typecheck/bundle；Windows 上的常规 Prisma postinstall
未在限定时间内完成，因此没有把它表述为正常安装流程证据。
