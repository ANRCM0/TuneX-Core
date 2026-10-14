# TuneX VNext · Relay UI + 节点诊断纵向切片

状态：**独立开发分支，未通过完整产品/网络验收；不得用于生产就绪声明。**
依赖 [Forward-first Web Alpha](forward-first-web.md) 和 VNext ADP/3。与 PR #84 是堆叠开发关系；先合并其基线再合并本批更合适。

## 用户工作流

HTTPS Control 的同源 `/console` 增加 **Relay 链路** 页面，不新增跨域、第三方 JS、外部图表依赖或旧 V2 源码：

1. **发布不可变 Transport Profile**。由 owner 输入 Profile ID 与受约束参数。UI 生成固定 `native.relay.v1`、`mutual-tls13`、wireVersion=1，配置通过原有严格 Schema/CAS/API 发布。已存在 Profile 必须显式确认，新 revision 不改变历史 Forward。首次发布的 owner 自动得到 Profile use grant。
2. **配置出口 Endpoint**。选择已注册 Relay Agent 的 Node，输入可达地址、绑定地址和最多 256 个内部 TCP 端口；先读取当前 revision，再 `PUT` 带 CAS。创建双协议 Relay 需两个不同的物理内部 TLS/TCP 端口，避免将 UDP 用户协议当作 UDP 内部资源；由服务端最终预留/检查。
3. **创建 Relay**。从已注册节点中选择不同 ingress/egress，入口监听必须在 ingress Node Policy 中，协议同时被 ingress、egress 和 Profile 支持；锁定 Profile 版本。
4. **验证部署计划**。调用 `POST /relay-plan`，由 Control 检查当前 Node/peer、使用授权、目标 CIDR、Endpoint 和物理资源。预览输出 `reserved=false`、端点版本、资源清单，并且**不预留资源、不发执行授权、不建立业务链路**。
5. **提交**。预览成功且表单内容未变才能在 UI 点击创建；最终调用已有 `POST /forwards`，生成 Durable Operation。API 会重新进行权限/资源检查，预览与执行之间状态变化导致拒绝是正确行为；回到执行记录和 Forward 详情查看。

补充：Console 列表每页 25 条，Relay 下拉选择仅来自本页 Node 列表。节点量大时先用现有 CLI/API；下一期改为服务端过滤与搜索，不能将有限分页选择解释为“节点不存在”。当前仍不支持多于一个出口、无条件 Relay 自动迁移或更换活动 Endpoint。

## 新的诊断接口

`GET /api/v1/scopes/:scope/nodes/:id/diagnostics`

- 先执行既有 Bearer 身份与 scope ACL，再在同一只读查询中以 **nodeId + scopeId** 限定 Node；缺失/越权一致返回 404。
- 输出源类型 `persisted-control-state`、当前读取时间、撤销状态、凭据截止、Agent sessionEpoch、snapshotGeneration、最后 Report 时间/顺序、Report 的实际年龄、Snapshot 数据库租约截止、近期 errorCode/assignmentId（最多 50 条）。
- 不泄露原始最后 Report、Enrollment Token、凭据/密钥、TLS 证书、未知 JSON 字段和用户 traffic payload。Control 只展示允许列表中的故障字段。
- 明确 `independentProbe=false`。授权有效、最近有报告或某 Operation succeeded 均不等于真正的 TCP/UDP 端到端探测通过。当前未增加任意“测试目标地址”接口，避免引入可滥用的 SSRF/端口扫描能力。
- UI 在节点行增加“诊断”按钮，通过既有同源 Bearer 请求调用诊断端点，并只使用 `textContent` 渲染响应。

### 节点安装与故障排查手册（受控手工流程）

先在管理界面“注册节点”，记录一次性 Node ID / Enrollment Token，并在信任的 Linux 主机操作。Control 的 CA 必须预先通过可信通道安装；`--journal-key` 路径必须在 `--state` 目录外。**不允许把 enrollment token 写入日志、脚本仓库、命令行参数或 systemd unit 内容。**

```sh
# 示例路径。需要预先提供独立构建、已校验校验和的 tunex-agent、
# 正确的 CA 文件以及实际 Control HTTPS 地址；不提供未经审查的 root 安装器。
install -d -m 0700 /var/lib/tunex/agent /etc/tunex/secrets
chmod 0600 /etc/tunex/control-ca.pem

# 在当前交互式终端中输入，不直接把 Token 粘贴到命令行：
read -r -s -p 'Enrollment Token: ' TUNEX_ENROLLMENT_TOKEN; echo
export TUNEX_ENROLLMENT_TOKEN
tunex-agent --control 'https://CONTROL_HOST:41001' --node 'NODE_ID' \
  --ca /etc/tunex/control-ca.pem --state /var/lib/tunex/agent \
  --journal-key /etc/tunex/secrets/journal.key --enroll
unset TUNEX_ENROLLMENT_TOKEN

# 校验 Enrollment 成功后，使用已验证的服务管理策略启动：
tunex-agent --control 'https://CONTROL_HOST:41001' --node 'NODE_ID' \
  --ca /etc/tunex/control-ca.pem --state /var/lib/tunex/agent \
  --journal-key /etc/tunex/secrets/journal.key --relay
```

强烈建议在支持 Linux 网络命名空间的受控实验环境先完成 Agent 部署。正式发行的 systemd service、专用非特权账户、凭据文件属主、日志/回滚/升级与外部 MySQL 备份尚属独立待完成项目。任何 Node 证书重装或备份恢复都必须沿既定安全恢复流程，**不能删除 Journal 来清除旧 Fence**。

诊断流程按层次定位：Scope 授权 → Node 凭据是否有效 → Agent 是否有当前 session/report → Snapshot 租约是否到期 → Relay egress 是否 active/ready → Ingress 应用 → Operation 错误码 → 真实业务 TCP/UDP 验证。最后一层当前由独立实网验收/外部工具验证，不由本页面自动完成。

## 测试门槛

```sh
npm run typecheck
npm run test:web
npm test
npm run check
npm run test:relay
npm run test:relay-isolation
```

增加 Relay 纯数据模型约束测试、只读诊断 Scope ACL 与投影安全测试、静态安全响应头回归。代码路径不变更 Go Agent/ADP Schema，主要风险是浏览器与 Control 的配置对齐以及前序 Relay 长时网络 CI。完整两台物理主机、实际浏览器安装部署与目标链路独立探测仍未验收。

遵守 [Relay Control](relay-control.md) 中的严格准备/激活顺序和 [Agent Security](../operations/node-security-and-recovery-v1.md) 中的授权/凭据边界。
