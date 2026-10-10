# TuneX V2 文档

实现基线：`8ca81c0c3f779bb3485594f8b1dc91f3a1c246a4`。本轮执行用户提供的 V2 方案，以第 23–27 节 TST/1 决议为最终约束。源码为开发候选；没有自动开启生产能力或发布镜像。

| 文档 | 内容 |
| --- | --- |
| [开发范围](DEVELOPMENT_PLAN.md) | 工作包、当前交付与剩余发布门槛。 |
| [原始 V2 方案](v2-development-plan.md) | 用户提供的完整开发方案；旧 FXP 段落为历史需求，最终决议优先。 |
| [运行边界](forwarding-runtime.md) | 统一 Forward、能力、身份、端口、更新与统计。 |
| [测试与验收](testing.md) | 执行命令、证据范围、平台矩阵和未通过门槛。 |
| [部署](production-deploy.md) | Compose、迁移、实验启用、备份和回退。 |
| [数据迁移](v2-migration.md) | 历史记录隔离、备份与恢复。 |
| [TST/1 规范](protocol/tst-v1.md) | TLS、帧、状态机、窗口、认证、版本与限制。 |
| [威胁模型](protocol/tst-threat-model.md) | 信任边界、攻击面、防护和残余风险。 |
| [架构决策](protocol/adr-tst-v1.md) | 自有协议、标准密码学与版本替换。 |
| [许可归档](compliance/README.md) | 历史源码、许可证、修改与来源记录。 |
| [依赖清单](compliance/native-dependencies.md) | 当前运行依赖、替换映射与残留扫描范围。 |
| [实现台账](v2-progress.md) | 工作包和执行验证状态。 |

`TUNEX_TST_ENABLED=false` 和 `FORWARD_NATIVE_BOTH_ENABLED=false` 是发布默认值。能力枚举、编译成功、组件 fixture 和交叉编译各自只证明其覆盖范围。独立安全审查、Linux 容器实网及实际发布后验证需有单独证据。
