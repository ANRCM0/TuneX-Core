# P 实机测试交接

日期：2026-10-24（Asia/Shanghai）。状态：已合并，实机输入待提供，未开始实机执行。

## 固定源码与制品

- PR #118 已于 2026-10-24 21:56:37 合并，主线源码为
  `dc03606fb61a6044a8a0a62c0fc1cd8a3c6e4ca8`。
- 合并 tree 为 `eb87545328ed79ae560963ff9f2acaa953843c7d`，与 PR head
  `8bfebae` 相同。功能验证源 `69dcaa7` 之后仅有文档收口。
- 合并后 baseline `40100306844`、packaging `40100306837`、开发镜像
  `40100306858` 已启动。本文编写时尚未取得最终结论，不能继承为主线通过。
- 开发镜像流程只有在该准确 SHA 的两项 CI 全部成功后才会推送
  `dev-dc03606fb61a6044a8a0a62c0fc1cd8a3c6e4ca8`。这是预期标签，尚不是
  已发布证明。部署必须从成功发布作业取得 Control/Agent 各自的 registry digest。
- 文档收口若先推进 main，发布流程会保留该源码的不可变开发标签并跳过滚动
  `:dev` 别名更新；实机仍使用上述准确源码的 digest，不依赖别名是否移动。
- 后续文档提交与上述源码、CI、镜像分别记账。实机 collector 从上述干净修订执行，
  不以滚动的 main、dev、latest 或旧 v0.1.0 镜像代替本候选。

主线最终 CI、扫描及镜像 digest 待作业完成后记录；不得预填成功。
此前准确源码的范围与失败历史见 [P 验证记录](product-verification-p-2026-10-24.md)。

## 执行前输入

| 输入 | 当前状态及要求 |
| --- | --- |
| 主机与 runner | 待提供标识／SSH 别名或 self-hosted runner 标签；多跳至少三台经人工确认独立的 Linux 主机；声明共享宿主、存储及网络限制 |
| 测试范围 | 确定 Control、数据库、Ingress／Transit／Egress、受控响应端的位置；已有部署与全新安装分开 |
| 访问与状态 | 隔离数据库、可信 CA／SAN、已知 SSH host keys、原 authority／Journal／独立密钥；秘密只放受保护环境，不进文档或公共产物 |
| 制品与身份 | 实际运行镜像 digest／Control 构建来源、Agent／fixture SHA256、Node／Scope／Forward ID、各机 clock proof 与机器身份 |
| 负载与故障 | 资源上限、可施加的断线／延迟／丢包／重启范围、负载阶梯、阈值和停止条件 |
| 时间 | 基线可用时段；24 小时与 72 小时分别批准和实际计时，不能由短测替代 |

之前“暂无环境”的答复不替代本次输入。本轮合并授权也不自动证明已取得这些条件。

## 顺序与现有入口

1. 核对上述源码对应的主线 CI 最终结论和镜像发布结果，固定不可变 digest。
2. 依照 [安装接入手册](deployment-setup-v1.md)选择 Control/Agent 与
   initial/existing，执行原 setup/preflight。已有状态不重新 bootstrap/enroll。
3. 验证登录、成员权限、Agent 会话、原 Journal 用量，再依次跑 Direct TCP/UDP、
   两节点 Relay、至少三节点多跳；签名 Echo 与业务 payload 分别保留结果。
4. 在上述准确源码的干净测试 checkout 中，将
   `deploy/physical-inventory.example.json` 复制到源码目录外的受保护路径，填写
   `sourceRevision` 为上述完整主线 SHA，填入所有真实 digest／路径／身份。
   只有实际审阅后才设 `physicalInventoryReviewed=true`，不在原示例中填秘密。
5. 使用原 collector（下面仅为入口示例，当前未执行）：

```sh
npm run test:multihop-physical -- /secure/tunex/physical-inventory.json
```

原 collector 使用配置指定的环境变量取 Token；由受保护的执行环境注入。
它核对 Agent／fixture 哈希、机器身份、Journal／诊断和真实 TCP/UDP；images 是
输入声明，不是运行态镜像证明，机器哈希也不替代物理独立性审阅。
保留 collector 输出目录及原始证据，另留实际运行镜像与 Control 来源检查。

6. 按 [部署、恢复与负载手册](product-p-deployment-acceptance.md)逐项完成 PP-13–16：
   新装／保留状态升级恢复、独立多机故障、阶梯负载、单独 24／72 小时长稳。
   每项保留开始／结束、负载、阈值、原始产物和 passed/failed/incomplete/unavailable。
   失败不清历史、不扩大生产截止；缺观测不记为零或健康。

当前已知限制：三节点 UDP 在此前样本中需要第四个独立命令，status/result 仍有
236/222ms 调用；原扫描仍有 Control 11／Agent 17 条 HIGH 观察项。实机首轮重点
保留这些路径的命令次数与 SQL／端到端耗时，不据源码减少读取次数宣称问题已解决。

此交接不创建稳定版本标签，不把开发镜像发布等同于实机验收或生产就绪。
