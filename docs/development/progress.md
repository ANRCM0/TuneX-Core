# VNext 实施进度

日期：2026-10-12。当前变更在未提交工作树中；本地已测试项目仍标
`implementing`，提交绑定与相应证据齐备后才按路线要求提升为 `verified`。
本文是实施记录，不能取代规范或验收矩阵。

| 工作项 | 状态 | 本次行为/证据 | 验收关联 |
| --- | --- | --- | --- |
| 旧 V2 隔离 | implementing | 源码/部署文件/工作流保留在 legacy/v2，VNext 构建不引用 | Phase 0 |
| 新工作区与版本锁定 | implementing | npm workspaces、Node/TS/Go 固定版本、npm/Go 锁文件 | Phase 0 |
| Core v1 | implementing | 无 IO 解析、不可变规范化、Node/Forward、受控 CAS/no-op/耗尽；13 项本地测试通过 | FWD-04/05、FWD-07 的纯决策部分 |
| TS/Go ADP/2 direct 解析 | implementing | 7 个合法和9个非法权威样例、35个补充正反例结论一致；RFC 8785 向量验证 | ADP-16 的解析/摘要部分 |
| Direct Runtime Planner | implementing | 授权事实、预留、驱动摘要、全快照排序/资源冲突/容量/租约检查；16项本地测试通过 | Phase 1 编译前置能力 |
| Linux CI / 开发 MySQL 入口 | implementing | 新 CI、开发 Compose 已提供；本地没有 Linux/Docker/MySQL，未声称已运行 | Phase 0 / 后续 I,N |
| Control API、MySQL 事务与 Worker | planned | 下一纵向切片：scope/owner/grant、注册、幂等、CAS、预留、Operation、持久 scanner | API-01/02/05、OPS-01、SEC-05 |
| 在线 Go Agent / TCP 闭环 | planned | 认证 Hello/Snapshot/Report、持久 high-water、真实 TCP 数据面；当前只有离线验证器 | FWD-01/06/08、ADP-05/11 |
| Phase 2 TCP/UDP 生命周期、安全与恢复 | planned | 未实现、未实网验收 | direct 全量门槛 |

本地命令：`npm.cmd run check`、`node scripts/run-go.mjs vet ./...`。
TypeScript：84项通过；Go：权威 fixture、共享 conformance、JCS、正文边界和精确时间比较测试通过。
离线示例编译后由 Go 校验器接受；这不是认证、ACK、持久事务或 TCP payload 证据。

发现并修复的边界包括 Unicode Kelvin case-fold、最大合法 ID、重复逻辑 Assignment、
闰秒 NaN、精确小数舍入、重复 drain、退休 fence、完整正文限制与分数秒比较。

尚无远程 CI、MySQL、Linux race 或实网运行证据。当前不能标 Phase 1 完成，
不能标完整 ADP-16 或任何生产发布门槛通过。
