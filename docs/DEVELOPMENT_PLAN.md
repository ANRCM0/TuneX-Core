# TuneX V2 开发范围与交付

本轮按 [完整开发方案](v2-development-plan.md) 执行，第 23–27 节优先于历史兼容描述。最终执行路径为 `/forwards → Forward Controller → Go Agent → Native Runtime / TST`；Link 是 TuneX 内部共享资源。

| 工作包 | 实现范围 | 验收入口 |
| --- | --- | --- |
| T0 / R0 | 独立帧规范、TLS 身份、威胁模型、向量、依赖审计与来源档案 | protocol/、native-dependency-check.mjs |
| T1–T3 / R2 | TLS 1.3 双向认证、TCP 多路复用、半关闭、流控、UDP association 与上限 | Agent securelink 与 tstruntime 测试 |
| T4 / R3 | 单进程 Link、共享规则、代次围栏、租约、缓存恢复、端口守卫、QoS 与用量回执 | Agent runtime 与 backend Link 测试 |
| U / R1 | 一次幂等提交、权限、node:use、自动 Link、独立状态、统一操作和诊断 | backend V2 数据库测试与真实 Panel 实网 |
| U4 | 单页工作台、详情/编辑/复制/诊断/历史、中英文、作用域与权限 | Web 单元与浏览器证据 |
| T5 / R4 | 删除外部数据面、专有适配器、旧业务入口与构建链；保留必要历史材料 | Docker/CI/安装器与依赖审计 |
| R5 | 空库迁移、恢复、故障、性能、安全、跨平台和发布后验证 | testing.md |

普通业务创建使用 `POST /api/forward-operations`，状态通过同一操作查询。统一 Forward 生命周期使用 `/api/forwards/:id` 与 `/actions`；`/links` 保留管理员资源维护，不能作为普通用户创建的前置步骤。一个 Forward 只由其原生或 Link 所有者执行。

历史载体不伪装成 TST，也不静默销毁其记录或凭据。新迁移明确将其隔离，处理流程见迁移文档。多目标/来源配置保留必要历史存储，但首版 TST 明确拒绝；未来功能须独立开发和验收。

剩余发布门槛：独立安全审查、正式 Linux Compose 全新安装/升级/回退、Linux race、长期故障/真实跨日与生产运行验证。未运行的项目不标记通过；当前开关保持默认关闭。实际执行结果只在 testing.md 与证据文件记录，不沿用旧版本的 CI 数量。
