# Direct UDP 手工实机验收（Web → Control → MySQL → Agent → UDP echo）

此页是**操作指南，不是已完成的测试报告**。辅助脚本为本地回环地址上的 UDP echo/probe，不修改数据库、TLS/Agent Journal、Scope 或节点凭据。自动单元测试仅验证脚本行为，只有实际经由 Agent 转发的实机探测才能算 Direct UDP 闭环。

## 前提

- 使用当前 VNext 的同一版本 Control/Agent；保证 Control、Agent 都是有效的独立进程，且已验证同机 Direct TCP。
- 已存在 `test-scope`、一个具有 `adp.3`、`native.direct.v1`、`udp` 能力的已注册节点，以及监听 `127.0.0.1:25565/tcp` 的原 Direct TCP 规则。
- Node Policy 的 `allowedListenerAddresses` 包含 `127.0.0.1`、`allowedPorts` 包含 `25565`、`allowedDestinationCidrs` 包含 `127.0.0.0/8`。
- 端口独占键为 Node + physical protocol + port，所以 **TCP/25565 和 UDP/25565 可以同时被两个 Direct Forward 使用**。不需要更改 Node 授权、新增凭据、重装 Agent 或清空 Journal。若 UDP 端口原本已被别的 UDP 进程/Forward 占用，必须使用新授权端口，不能绕过资源仲裁。

## 1. 启动独立的 UDP 目标

在测试主机仓库目录运行：

```sh
node scripts/manual/udp-smoke.mjs echo --port 18081
```

将返回 `{"status":"ready","mode":"udp-echo","address":"127.0.0.1","port":18081}`。echo 不会主动连接其他网络设备，只响应来自本机回环地址的 UDP 数据报。保持运行；别启动第二个占用同端口的 UDP 服务。

## 2. 在 Web Console 中创建 Direct UDP Forward

打开 `https://127.0.0.1:41001/console`，连接已注册的 `test-scope`。在“转发管理”点击“新建转发”，设置：

| 输入 | 值 |
| --- | --- |
| 入口节点 | 已存在并报告 UDP 能力的测试 Node |
| 协议 | UDP |
| 监听地址 | 127.0.0.1 |
| 监听端口 | 25565 |
| 目标主机 | 127.0.0.1 |
| 目标端口 | 18081 |
| 启用 | 是 |

**注意**：这是第二条 **UDP-only Forward**，不要将原来的 TCP 规则改成 UDP，否则无法同时验证共存。使用相同数值端口时依靠 TCP/UDP physical protocol 隔离；如果 Control 返回 `PORT_RESERVED`，先查已有 UDP 持有者，不能强行释放其他 Forward 的资源。

提交后保存 UDP 的 `forwardId`、`operationId`，等待 Operation `succeeded`、Forward desired `enabled=true` 且当前应用状态显示 UDP assignment `ready`；这仍不是实际 UDP 应用可达的证据。

## 3. 发送真正的 UDP 数据

另开终端：

```sh
node scripts/manual/udp-smoke.mjs probe --port 25565 --count 5 --timeout-ms 3000
```

脚本启动 **两个独立 UDP 客户端 socket**，每个依次发送一个 **零字节合法 UDP 包**和四个带随机校验内容的数据报。期望 JSON：

```json
{"status":"passed","mode":"direct-udp-probe","destination":"127.0.0.1:25565","clients":2,"datagrams":10,"emptyDatagrams":2,"verifiedExactBytes":true,"independentSocketPorts":[40001,40002]}
```

`independentSocketPorts` 上述只是**字段示意**，真实值由 OS 动态分配，不要求固定。若任意单包超时、内容不一致或发送端口不对，探测命令立即以非零状态退出；失败时不要将 Operation 成功解释为业务成功。默认只允许 `127.0.0.1` 回环目标，禁止将脚本作为任意地址扫描器使用。

## 4. 验证共存和清理

在 UDP 探测通过后，重新验证此前的 TCP 服务：

```sh
curl --fail --show-error http://127.0.0.1:25565/
```

两种协议都通过，才算该 Node 的 TCP/UDP 同端口 Direct 并存验证。需要时再分开测试：停用 UDP Forward 不能影响 TCP 流量；删除 UDP Forward 后观察 Operation/退役及资源释放是否完成，不能通过删除 Journal、杀死未知进程或直接修改数据库中的端口占用行来清理。

可先单独运行基础工具自检：

```sh
npm run test:udp-smoke
```

这只测试双客户端→本地 echo 的 Socket/字节回传，**不经过 Control/Agent**，不计入上面的实机验收。用于 CI 发现辅助脚本跨平台问题。

## 失败证据清单

记录本机 UTC 时间、Git SHA、Agent/Control 版本、UDP Forward ID、Operation ID 与状态、Node 诊断中的报告时间/快照有效期、探测的 JSON 或错误消息，以及同时仍成功的 TCP 响应。**不要上传 Owner Token、Enrollment Token、CA 私钥、Node 私钥或原始 Journal。**

可以在此基础上再测 UDP association 闲置到期、新客户端源端口隔离、停用后防新增关联、Control/Agent 重启恢复等；这些是后续扩展验收，不由一次 `probe` 自动覆盖。

## 当前 CI / 发行范围

`npm run check` 会执行上述工具的独立双客户端测试。现有 Phase 2 `npm run test:phase2` 另有真实 HTTPS/MySQL/Agent UDP 生命周期自动化；这些都不代替针对本次现有实例的用户手工验收。当前 Release/GHCR Docker 镜像仍无稳定发布证据。Relay 的隔离与轮换 CI 必须单独通过，不能把 Direct UDP 结果推广成 Relay 已通过。
