# 安装接入与既有服务操作向导

日期：2026-10-24。P1 源码交付；病例已撰写，检查和运行验收未执行。

本向导复用原角色预检、Control bootstrap、Agent enrollment、Compose 与升级评估。
`deploy/setup.mjs` 只读取本机静态配置并输出计划，不创建文件、连接数据库或网络，
不执行 Docker/系统命令，不生成或替换任何身份和密钥。输出命令是人工审阅示例。

完整 P 候选的 Control schema profile 为 adp3-path-sample-alert-v1（0046），Agent
沿用原 runtime／multihop／shared-resource Journal profile。新增默认关闭开关和
最近路径样本语义见受控 Echo 与阶段 P 文档。原升级 plan 示例只是 placeholder；
必须以实际源版本、目标镜像 digest、原数据库／authority／Journal 检查结果填写。
独立主机／恢复／负载／长稳步骤见 product-p-deployment-acceptance.md，尚未执行。

## 选择角色与阶段

| 选择 | 使用场景 | 后续动作 |
| --- | --- | --- |
| control / initial | 明确的新数据库与空 Control 状态目录 | 原 bootstrap -> 显式首次 authority 启动 -> 日常服务 |
| agent / initial | 新节点、空状态与仅含可信 CA 的 secrets 目录 | 原注册凭据 -> 原 enroll -> 日常服务 |
| control / existing | 更新或恢复已有 Control | 保留状态、备份和升级评估；不重新 bootstrap/initialize |
| agent / existing | 更新或恢复已有 Agent | 保留原身份、Journal 与独立密钥；不重新 enroll |

准备与所选镜像配套的源码工具、Node.js，以及受保护的角色环境文件；使用原
`compose.control.example.yaml` 或 `compose.agent.example.yaml`。环境文件包含秘密，
只交给服务和当前运维账户。镜像选择实际发布的 registry digest，不能填 Docker
本地 image ID，也不能把某个 tag 存在当作该环境已经部署成功。

在将来获授权的实际部署主机上运行，替换环境文件路径：

```bash
node --env-file=/secure/control.env deploy/setup.mjs --role control --phase initial
node --env-file=/secure/agent.env deploy/setup.mjs --role agent --phase initial --json
node --env-file=/secure/agent.env deploy/setup.mjs --role agent --phase existing --json
```

退出码 0 只表示本机静态条件通过，2 表示所需检查尚未完成，1 表示拒绝。
所有计划保持 `manualOnly:true`、`executed:false`、`runtimeReady:false` 和
`executionAuthorized:false`。没有实际连接或传输结果时，不补写为健康。

## 第一次启动 Control

1. 准备 MySQL、可信 CA、实际 Control 域名/IP SAN 的服务证书、受保护状态和 PKI
   目录。UID/GID 10001 需要读取证书及私钥、遍历目录并写入自己的状态。
2. 在 protected env 中配置原模板要求的变量，并设置实际 `TUNEX_CONTROL_URL`，
   用于预检 SAN。它必须是无凭据、路径、query 的 HTTPS origin。
3. 根据计划解决每项静态拒绝。空本机目录不能证明数据库新鲜；原 bootstrap 仍
   须在真实数据库中检查并创建 workspace/owner，不确定结果先核对原状态。
4. 将 Owner Token 输入交互环境，执行计划中的原 bootstrap，随后 unset。计划
   不生成、不显示 Token，也不将其放进进程参数或 steady env 文件。
5. 使用一次性 `compose run ... -e TUNEX_AUTHORITY_INITIALIZE=1 control` 进入原
   首次启动；完成后停止该前台实例，再以普通 `compose up -d control` 启动。
   该初始步骤需要明确的全新部署条件，不能用于升级/丢状态后的“修复”。
6. 默认模板只发布宿主 loopback 41001。需要远端 Agent 时，管理员明确配置
   受保护的宿主 bind/防火墙或 L4 TCP pass-through，保留端到端 TLS。不要通过
   关闭 CA 验证或任意 L7 TLS termination 绕过原机器认证。
7. 打开实际 HTTPS `/console`，信任正确 CA，使用原 Token 登录并选择工作空间。
   独立验证数据库读写、认证和 Agent 会话，容器 socket healthcheck 只代表存活。

## 接入 Agent

1. 用户在“我的机器”创建私有 Node；管理员在“资源管理”创建共享 Node。记录
   Node ID、一次性凭据及截止。共享机器完成接入后仍须授予明确成员/用途权限。
2. 在实际 Agent 主机准备空状态目录、独立 secrets 目录与可信 Control CA。
   initial secrets 只能含 `control-ca.pem`；不要预先覆盖原注册流程的 Journal key。
3. 运行 Agent initial 计划，处理 UID 10001 访问、目录、CA、Control URL、Node ID
   问题。计划中的公有 URL/Node 占位值需要人工替换，与环境文件保持一致。
4. 在交互环境中输入 Enrollment Token，执行计划列出的完整 enroll 命令，随后
   unset。一次性运行保留与日常服务相同的 mount；不能只覆盖 Compose command
   为 `--enroll` 而丢失 Control、Node、CA、state 与 journal-key 参数。
5. 使用相同 mounts 启动日常 Agent。初次注册响应不确定时，先核对节点与原状态；
   不删除文件，不自动创建第二个节点，不用反复注册掩盖原结果。
6. 到控制台确认原会话、凭据和新鲜报告，再创建第一条授权范围内的 Direct。
   组线需要原 Relay 端点/Profile/授权；多跳还需要双方显式开启对应能力。
7. 从真实客户端位置发送到受控目标的 TCP/UDP 流量，并记录结果。Agent 本地
   listener ready、Direct connect 或历史 Probe 成功都不能替代这个位置的验证。

## 处理拒绝

计划把预检 code 映射到固定建议，不复制原错误文本、目录值或秘密：

| 类别 | 处理方式 |
| --- | --- |
| initial 状态/secrets 非空 | 确认它是否为已有身份，改用 existing/recovery；不清空目录 |
| 私钥/权限/挂载 | 恢复原配套文件，复核 UID 10001、POSIX mode、ACL、labels 与实际 mount |
| SAN/CA/用途/有效期 | 核对实际 HTTPS origin 与原信任链，按原轮换流程处理 |
| URL/Node/环境变量 | 核对对应角色模板和原注册结果，不能扩大为其他节点或工作空间 |
| authority/Journal/MAC/key | 由原服务认证；保留原密钥与高水位，进入升级/恢复评估 |
| 时钟/远端 TLS/网络未检查 | 在对应实际环境独立验证，不把静态通过升级为运行通过 |

## 既有服务与验收

existing 计划不包含 initialize、bootstrap 或 enroll。先按原维护过程备份数据库、
Control authority/PKI、Agent Journal/身份和独立保护密钥，用目标版本工具评估准确
升级/恢复计划，再安排切换。秘密目录及受保护历史不能用空目录代替。

本切片病例为 `deploy/test/setup-plan.test.mjs`：角色/阶段分离、初次/保留状态、
预检拒绝传播、命令固定、秘密不回显、未知 code、矛盾报告、静态与运行状态分离。
计划进入原 deploy Actions glob；当前只撰写，未执行。独立主机从空环境到真实转发、
升级和恢复的证据归属 P 的 PP-13/14/16，不由本说明或计划输出来代替。
