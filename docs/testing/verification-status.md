# 修订与验收状态

维护日期：2026-10-24（Asia/Shanghai）。项目进入稳定维护，实机由用户自行部署。
本文件保留当前必需的证据身份与限制；阶段计划和逐轮调试过程由 Git 历史保存。

## 当前源码与流程

| 项目 | 身份与结论 |
| --- | --- |
| P 集成 | PR #118 已合并，源码 `dc03606fb61a6044a8a0a62c0fc1cd8a3c6e4ca8` |
| 合并 tree | `eb87545328ed79ae560963ff9f2acaa953843c7d`，与 PR head `8bfebae` 一致 |
| 合并前验证源码 | `69dcaa710ee0298adde0656674b99c5cb6e1f2b8`，tree `62cd28b39e8e7e37cce2745c4781827186cac403` |
| 实际 PR 测试 checkout | `62b0b98022dd804c8e1b6fafbc3cec0111b4d405`，与验证源码 tree 一致 |
| 合并前 baseline／packaging | `40069707791` 十作业 success；`40069707745` success |
| 合并后 baseline | `40100306844`，完整十作业 success，准确源码为上述合并修订 |
| 合并后 packaging | `40100306837`，success |
| 合并后开发镜像 | `40100306858`，记录时仍在运行，registry digest 待取得 |

后续文档提交及本次整理不改变可执行源码。本文不声明文档 head 取得了新的功能 CI。
开发镜像只在其准确源码的主线 CI 通过后发布；实际部署固定成功发布的 digest。

## 已验证范围

合并前 P 主契约 2307 项，其中 2157 通过、150 项数据库条件跳过；150 项逐名匹配
同修订完整 native MySQL 通过记录，缺失、原生跳过和失败为 0。Web 231 项、部署
预检／安装计划 30 项通过。Linux Go vet/race、Windows、不支持平台拒绝、生成一致性、
边界、MySQL、mTLS／Chromium、Relay 隔离及 3／4／8 节点主场景和同机 namespace
故障作业均通过。原 Snapshot 失败／冲突回滚、双读者与原排他写者病例通过。

原 Relay owner 的 Forward／Node assignments 和显式 progress 入口保留旧调用与覆盖；
新入口的投影／写入一致性、读取次数、调用间刷新、到期、错误、覆盖和原生绑定通过。
少读输入本身不是延迟改善证明。构造入口的公共类型扩宽见 FR-0044。

实际成员创建、自身 Token 轮换／旧 Token 拒绝、六轮有限读取及页面取消通过。
原 Journal 用量样本经接受报告到 SQL／API／Chromium：已用 1024，剩余 1047552，
总额度 1048576 字节；保留 conservative-precharge 和样本时上界语义。

实际 47ms 签名 UDP 样本经原历史读取与当前签发者／绑定重授权，进入 Station schema3
和原 Notification SQL。写后失败回滚事件／状态及七张通知表、不可变事件去重、
陈旧 unknown 保留 firing、不签发新 Probe、策略停用后零发送取消均通过。
陈旧病例使用受控时钟推进，不是实际五分钟或长稳实验；成员撤权取消由独立原 SQL
病例证明。真实外部通知目的端投递尚未认证。

## 已知限制与剩余门槛

- Direct／两节点 Relay 的签名 TCP/UDP 在该样本中首条成功；三节点 TCP 首条成功，
  UDP 第四条独立命令成功，前三条到达响应端但未形成接受结果；过期同键重放未再执行。
- 三节点仍观察到 236ms status／222ms result 调用，不能宣称首发成功率或生产延迟保证。
- 已有打包扫描的可修复 CRITICAL 为 0；Control／Agent 仍有 11／17 条 HIGH 观察项。
  扫描通过不是零漏洞证明，后续发布需检查其实际制品报告。
- 独立主机新装／保留状态升级恢复、多机故障、正式阶梯负载、24／72 小时长稳仍需
  实际执行证据。同机 namespace、受控时钟和短时容量样本不能替代。
- 物理 collector 中镜像字段是输入声明，机器哈希不能独立证明物理宿主隔离。
  另留实际运行镜像与 Control 构建来源证据。

执行方式见[部署验收](deployment-acceptance.md)与[实机测试](../operations/physical-testing.md)。
维护阶段、Actions 通过、镜像发布、稳定发行和生产就绪是独立状态。

## 冻结基线与历史追溯

| 基线 | 准确修订及范围 |
| --- | --- |
| B 公共地基 | source `e208a3abf17129b0c2898ba2022c69f60f45445a`，测试 checkout `c3ce8a67b901f61234b4116190409854818cb6c7`，tree `3078437e718bc308444f15e056e1a1397ed87796`；baseline `39341589653`、packaging `39341589509` success；220 项义务完成映射，406 个证据来源不是 406 个已执行测试套件 |
| B 合并 | PR #112 合并为 `5a764f74f172cc60b40fc75ba61ffdfe94ced78e`；接受只绑定上述冻结公共契约和配置内环境 |
| N 产品基线 | PR head `8738a97c5df556b3929f8f49b969f1780ebf5edd`，实际 checkout `c8e42bc4a819fd4308bc3bf320fb267cbc383117`；PR baseline `39962890329`、packaging `39962890327` success |
| N 合并与主线验证 | PR #114 合并为 `9a5f7193554fb9f58b750358fc82fe0386ea6467`；tree `c2a83008a82e08d69121a3d13a4374b0fd647fb2`；主线 baseline `39968900422`、packaging `39968900303` success；当次自动镜像 `39968900519` cancelled，不算发布 |

旧 220 项逐条断言表、原生病例名称、全部失败轮次和产物 ID 保留在清理前修订
`d1ff164ac04d4bbf369e4ab3830d3c82102ceec6` 的 `docs/development/` 中，可用 `git show`
追溯。删除重复过程文件不改变冻结契约、兼容义务或独立实机／发行门槛。
