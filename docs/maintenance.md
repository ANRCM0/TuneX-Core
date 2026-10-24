# 稳定阶段维护

当前工作方式为稳定维护与用户自行部署。此处“稳定”描述开发阶段，不代表已经取得
独立实机、正式负载、24／72 小时长稳或生产容量证明。

## 当前能力与入口

系统提供多用户 TCP/UDP 转发、私有节点与共享资源授权、TLS 中继和多跳、账号／成员
管理、Journal 派生用量、受控路径 Echo、额度／周期／最近路径样本告警和批量操作。
多跳及主动探测按原能力协商和显式开关启用；额度读取不是执行授权。

- [安装与接入](operations/installation.md)：Control／Agent、全新安装与保留状态升级。
- [实机测试](operations/physical-testing.md)：固定源码／镜像、配置 inventory 和保存结果。
- [升级与恢复](operations/upgrade-recovery.md)及[维护命令](operations/recovery-and-capacity.md)。
- [部署、故障、负载与长稳验收](testing/deployment-acceptance.md)。
- [修订与验证状态](testing/verification-status.md)：准确源码、CI 范围、已知限制和剩余门槛。
- [开发接入](development/getting-started.md)与[公共模块集成](architecture/framework-integration-v1.md)。

## 维护规则

修复围绕可复现的问题进行，先识别原 owner、公共契约、兼容入口和事务边界。
保留单一 Runtime ledger、Agent authority／Journal、幂等响应与受保护历史。
不得用重建身份、清库、清 Journal、放宽截止或跳过授权来修复兼容问题。

冻结公共接口或语义变更先记录 FR，说明迁移与兼容；私有修复保持原公共行为。
现行分层、源文件归属、兼容桥、ADR／FR、协议及 Schema 继续有效。
本地检查与 Actions、合并、开发镜像、稳定发行及实际部署验收分别记录。
用户自行部署，访问配置和秘密由操作者在部署环境保管。

## 文档维护

安装／运维步骤归 operations，测试与接受依据归 testing，开发接入归 development；
architecture、spec、protocol、decisions、changes 分别维护当前边界、契约和设计依据。
修改入口时同步更新链接。Schema、fixture、迁移、生成产物和其消费者属于工程输入，
不作为开发过程垃圾删除。

阶段任务计划、并行分工、逐轮失败日志和大型过程断言表已从当前工作树移除。
需要追溯时使用 Git；清理前完整记录位于修订
`d1ff164ac04d4bbf369e4ab3830d3c82102ceec6`，例如：

```sh
git show d1ff164ac04d4bbf369e4ab3830d3c82102ceec6:docs/development/product-verification-p-2026-10-24.md
git show d1ff164ac04d4bbf369e4ab3830d3c82102ceec6:docs/development/foundation-b-assertion-coverage.md
```

历史结果只验证其准确修订；归档于 Git 不改变其证据范围，也不为后续代码补发通过。
