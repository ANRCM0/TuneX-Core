# TuneX 当前实施进度

更新：2026-10-20（Asia/Shanghai）。此文件替代逐切片的历史进度日记。

## 源码与集成状态

A5 已完成四层源码分类、公共版本、兼容消费者、默认绑定、移除条件及
Control／Agent／Web／资产／支持工具收口。完整记录见
[A5](../architecture/foundation-a5-source-closure-v1.md) 与
[候选索引](../architecture/foundation-candidate-index-v1.md)。
FR-0001–0025 及其源码包含在保存的候选中。

PR #111 的源码 head：`9f1d78d939a59c1514d9bcca1591afa2e89e6754`。
实际测试 PR 合并修订：`91e560f83e1c121a389aa90fbafa52d31ab5c28a`。
2026-10-19 已合并至 main：`373c291a6ea4f04e5929796a6119eb3b60027c34`。
清理后的修订与检查需独立记录，不沿用候选 CI。

现有源码包含 Direct TCP/UDP、TLS 1.3 Relay、默认关闭的 3–8 节点多跳、
原 owner 下的路径／入口／发布、授权／凭据／恢复、观测／指标／Probe 与 Web。
源码存在不表示全部产品闭环、物理场景或发行门槛已完成。

## 候选证据

| 范围 | 准确候选上的结果 |
| --- | --- |
| 本地静态检查 | TypeScript、Web 语法、边界、生成同步、Windows amd64 Go build/vet 与 Linux amd64 cross-build 通过 |
| Actions 契约 | 630 TypeScript 通过、78 条件跳过；Web 99/99；边界负例 11/11；950 个生产文件边界、文档链接、Go 全包／vet／race、公开示例与生成同步通过 |
| Actions 集成 | MySQL/mTLS、生命周期、安全／故障、权限、Transport、Relay 切换、备份恢复和容量通过 |
| Actions 浏览器／多跳 | Probe/Relay Chromium、3/4/8 节点及 namespace 故障／恢复／延迟／丢包通过 |
| Actions 容器 | Control/Agent 构建、非 root／拒绝、SBOM／扫描与 Compose 检查通过 |

运行号、准确源码与界限见[验证记录](foundation-verification-2026-10-19.md)。
条件跳过不代表数据库测试通过；真实数据库证据来自独立集成任务。

## 当前门禁与下一步

地基仍为 **not stable/accepted**；上层模块并行开发门禁关闭。
[readiness](foundation-readiness.md) 的 220 条要求已逐项形成
[断言映射](foundation-b-assertion-coverage.md)，98 条具有完整断言、122 条仍部分覆盖。
PR #112 补充 Runtime/Agent/Web/owner 事务与失败顺序回归，并修复通知取消注册时
容量不能释放的私有竞态；新增测试和修复等待最终修订的独立 Actions 结果。
继续关闭记录中的余缺，再记录可接受的公共接口范围。

独立物理多主机、长稳／负载、独立 Responder 构建／发布、正式发行与生产就绪
仍需各自证据。当前多 Agent／namespace 证据共享一台 Linux runner。

后续顺序见[开发方案](development-plan.md)与[下一阶段目标](next-milestones.md)。
旧 V2、参考 checkout、源码归档与过时盘点移出当前树；部署配置、现行迁移、
兼容解析器、Schema、生成资产和测试 fixture 继续由原 owner 维护。
