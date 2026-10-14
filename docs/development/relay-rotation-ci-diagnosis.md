# Relay peer 轮换 CI 失败证据（2026-10-14）

已在 GitHub Actions CI 发现某次 `test:relay-rotation` 在
`first-retirement-window` 阶段约 7,641 次有效响应后出现 **6 次意外错误**，
本次验收失败。此前同一次 CI 的隔离网络测试（13 检查）与
Relay capacity 测试（8 检查）均通过。该证据**不代表 Relay 轮换已通过**。

- 原测试 `--expect-cutoff` 仅用于授权截止预期切片；本例
  `first-retirement-window` 不允许发生任何意外失败，不得将其转换为
  “已通过”或直接增大容错比例。
- 测试辅助进程现在在负载意外失败时输出 `completed:false`，
  `errors`、`verifiedReplies` 和最多两个协议组内各客户端的
  `protocol`、`verified`、`failure`、`errorKind`。
  错误类别仅包含 `timeout`、`eof`、`closed`、`io-error`、
  `payload-mismatch`、`short-write`、`udp-size-mismatch`。
  不记录实际客户数据内容、Enrollment Token、证书私钥或 Journal key。
- `.artifacts/relay-rotation/run-*/failure.json` 中每个 Fixture
  仅保存最近最多三次消息的**白名单投影**。其他既有部署/凭据元数据
  沿用现有独立安全目录，不应公开原始失败文件。
- CI 使用 `actions/upload-artifact` 保存隔离/轮换失败 JSON，
  供审核人员在私有权限环境排查。日志和辅助 fixture 不应作为业务运行探针
  部署到生产。

后续需要逐项判定：错误发生的确切协议（TCP/UDP）、是否集中在 peer
`retire_after` 临界时刻、Operation/Report 的真实 fresh 状态、
运行期连接与旧 generation 的 drain/cutoff 是否一致；
修复必须保持现有 mTLS/peer pin/高水位约束，不能延长已撤销执行权限。
