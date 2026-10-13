# Relay 自动换钥、pin 切换与过期恢复

日期：2026-10-14（Asia/Shanghai）。基线：`868dac4`。本切片补齐 native Relay 的
自动 peer 换钥、持久 CSR 重试、Control 计划重建和有效期耗尽后的在线恢复。
它不代表全部 Phase 4 或生产发布门槛完成。

## 运行行为

Agent 在 peer 的有效执行授权接近到期前申请新的 P-256 密钥和专用 Relay 叶证书。
提前量为 `max(60, leaseSeconds + 2×maxClockSkewSeconds + 2×pollIntervalSeconds)`。
Control 机器凭据也在同一提前量内调用既有轮换接口，避免 peer 签发被即将到期的
机器凭据截短。机器证书实际到期、系统时间不可靠和历史执行租约仍按原策略关闭。

Peer 的有效期限为叶证书 NotAfter、当前机器凭据有效期和 Control 配置期限的
最小值。`TUNEX_RELAY_CREDENTIAL_SECONDS` 默认 86400 秒；配置只能缩短现有证书
授权，不能延长证书。启动检查期限至少为提前量的两倍，且有空间容纳有界 overlap。
验收采用真正签发的证书、120 秒执行授权和 30 秒 overlap；没有修改时钟、证书
字段或数据库到期字段。CA 签出的叶证书仍为一天，短期验收针对有效执行授权。

CSR、request ID 和私钥在请求前持久化。签发提交后响应丢失，Agent 重试同一请求；
Control 的持久请求记录返回原结果。新 bundle 使用 journal MAC key 保护并原子保存，
保存完成后才加载新身份。重试未成功时不接受可能依赖新身份的后续快照。bundle
记录已提交 request ID 和下一次允许轮换时间；保存后、删除请求前崩溃不会再次签发
或加载旧身份。仍有两个有效凭据重叠时不会不断申请第三个身份。

Control 编译新计划时只 pin `retire_after IS NULL` 的当前 peer 叶证书。退役凭据
保留为历史授权记录；其短 overlap 不再缩短新计划。协调器发现任一端当前 pin
变化，创建新的不可变 deployment 和持久 policy Operation，递增所有物理 fence，
保持用户 Forward revision 和 Agent session。新计划继续按 prepare → egress active
→ ingress active → ready 的尾到头门槛执行。旧 TCP 按既有有界 drain 结束，UDP
association 重置，不承诺无损或透明切换；旧已成功 Operation 保持终态。

有效 peer bundle 仍在 Agent 重启时复用。完整 MAC 保护的 bundle 真实过期后，
历史链、Node URI、用途、keypair、pin 和时间窗口校验仅证明旧记录有效，不能恢复
执行授权。Agent 必须先完成在线 Hello，再取得新 peer 和新的完整快照，保留原
journal、高水位、身份和 fence。损坏状态继续拒绝，不能通过签发覆盖。停机期间
已提交但未保存的响应也可能过期；只有校验其确实为同一 CSR/keypair 的可信历史
响应后，才丢弃该请求并申请新授权。每次恢复只允许一次这样的过期重放替换。

## 验收

命令：`npm run test:relay-rotation`。环境与 [Relay 容量](relay-capacity.md) 相同。
两个 Agent 运行在独立 Linux network namespace、独立非 root UID/GID 下，零
capabilities、NoNewPrivs、256 FD；Control HTTPS 认证经 opaque TCP proxy 端到端保留。

九项检查覆盖：

1. 实际进程权限、状态/私钥权限和非 root 内核时间同步。
2. 真实 MySQL/HTTPS/两端 Agent 的当前 active/ready。
3. 自动换钥、一次真实签发提交后的响应丢失、相同 CSR 重放，新的 generation/fence
   与不变的 Forward revision/session。
4. 已验证的 TCP 存量排空、UDP 重置以及旧 Operation 终态保护。
5. 36 秒新流量跨过旧 peer 实际 overlap 与时钟边界，generation 不因旧证书退休再变。
6. 使用原来真实 CA 签发的 peer 凭据探测存活的新 binding，必须被拒绝；新身份仍能
   完成精确 TCP/UDP payload。
7. 第二次自动换钥及另一段 36 秒新流量跨过初始 peer 的有效授权到期，两个 Agent
   未重启、计数器未清零。
8. 停止一个 Agent，等待其当前 peer 真实有效期加时钟边界耗尽，再以原 MAC journal
   建立更高 session、获得新 peer 和更高快照，并恢复两协议 payload。
9. 删除 Forward，安全释放全部物理预留并完成独占进程、目录和网络清理。

Go 单元回归另覆盖响应丢失时保留原身份、MAC bundle 崩溃边界、轮换 cooldown、
过期 bundle 离线拒绝和过期签发重放。TS 检查覆盖任一端 pin 变化和不可变计划；
它们不能替代上述实网验收。

成功证据仅在实际清理完成后写入 `.artifacts/relay-rotation/run-*/evidence.json`，
包含被测 commit、dirty 状态、二进制 SHA、进程权限、原始凭据期限、两次计划/
计数器、重试 request ID/CSR 摘要、独立客户端结果和拒绝探测；不写私钥或 token。
配置的 CI 收集同样证据，配置存在不代表远程 CI 已验证。

## 仍未覆盖的发布门槛

当前是单物理机上的 Windows Control/MySQL 与 WSL Linux Agent 混合拓扑，短期限
两次换钥是有界运行证据。生产一天叶证书周期的长期运行、整机故障、全 Linux 外部
MySQL/反代部署和发布安全审阅仍需演练。完整 direct/Relay 矩阵、在线 endpoint/入口
迁移、Link 复用和其他受支持传输、Web/Node 管理/审计产品面与 SBOM/许可证/部署
发布也未由本切片完成。QUIC、多跳和 TST 仍不广告为受支持。
