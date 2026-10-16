# Console 服务端查询与全量概览

更新：2026-10-16。范围是只读查询与现有控制台接线，不是独立健康探测、
执行授权续期、生产验收或浏览器端到端验收。

## 查询契约

路径前缀为 `/api/v1/scopes/:scope/`。所有接口使用既有 Bearer 身份，
拒绝 Cookie 身份，响应 `Cache-Control: no-store`，并先检查当前有效的
Scope Membership。非成员、已移除成员及跨 Scope 访问返回 404。

| GET 路径 | 可选筛选字段 | 权限及排序 |
| --- | --- | --- |
| `nodes` | `idPrefix`、`credential` | Scope 读权限；Node ID 升序 |
| `forwards` | `idPrefix`、`enabled`、`recoverySuspended`、`protocol` | Scope 读权限；Forward ID 升序；不含删除中的规则 |
| `operations` | `forwardId`、`kind`、`status` | Scope 读权限；创建时间、Operation ID 降序 |
| `nodes/candidates` | `idPrefix`、`nodeId`、`mode`、`protocol` | Scope 管理权限、显式 Node Grant；Node ID 升序 |
| `overview` | 不接受任何查询参数 | Scope 读权限；单条 SQL 统计整个 Scope |

四个列表都接受 `page=1..10000`、`limit=1..100`，默认 1、25，
返回 `{page,limit,total,items}`。`total` 是应用当前筛选后的总量；
超出末页返回空 `items`，仍保留筛选后的总量。前缀为 ASCII ID 的字面前缀，
包括下划线；不接受 `%` 等通配符。`nodeId`、`forwardId` 为精确匹配。
未知字段、重复字段、空值、非规范整数和不支持的枚举返回 422，
不静默忽略或退回无筛选查询。所有值使用绑定参数；LIMIT/OFFSET 仅插入
经过安全整数和上限验证的数值，沿用 MySQL 8.4 prepared statement 兼容路径。

枚举：

- `credential`：`valid`、`expired`、`unenrolled`、`revoked`。前三者均排除撤销节点；
  `unenrolled` 指 `credential_until IS NULL`，`expired` 指已有截止时间且已到期。
- `enabled`、`recoverySuspended`：`true` / `false`；前者取 Desired Spec，
  不表示 Applied 或 Health。
- `protocol`：`tcp`、`udp`、`both`。前两者表示包含该协议，`both` 要求同时包含。
- `kind`：`create/update/enable/disable/delete/retry/policy/revoke`。
- `status`：`accepted/running/succeeded/failed/superseded`。
- `mode`：`direct`（候选默认）、`relay`、`multihop`。

列表沿用 READ COMMITTED 和确定性排序，不提供跨请求历史快照或游标：
并发增删期间 `total` 与当前页可能变化，OFFSET 翻页也不保证历史集合不变。
Scope 权限通过既有事务内共享锁检查；读取不更改租约、授权、部署或审计记录。

## 候选与选择器

候选由独立 SQL 分页，不复用节点管理页，不遍历全部分页，也不提高单页上限：

- 当前成员必须有管理权限；Viewer 返回 403，Owner 也不能绕过显式 Node Grant。
- Node 必须属于当前 Scope、未撤销、凭据已签发且未到期，有允许的监听地址和端口，
  并支持 `adp.3`、`native.direct.v1` 及至少一种 TCP/UDP 业务协议。
- Relay 再要求 `native.relay.v1`、`relay.wire.1`；多跳再要求
  `adp.execution.1`、`native.multihop.v1`、`multihop.wire.1`。
- 返回 `source: persisted-control-state`、`independentProbe: false`、
  `fullPlanAuthorization: false`、`reserved: false`。候选不检查完整目标 CIDR、
  端口占用、当前 Session、Peer 凭据、Profile Grant 或 Endpoint，也不启用多跳开关。
  预览/提交继续走既有执行授权和资源仲裁，不能用候选结果绕过重新检查。

Direct 与 Relay 选择器各自查询 25 条候选；翻页/搜索最多额外保留 9 个已选
Node（最多 8 节点路径，加 Endpoint 编辑节点）。已选项通过同一候选 API
逐个精确重查，不信任旧页缓存；内存最多保留当前页和仍具资格的已选项，
不积累访问过的全部节点。撤权后已选项消失，Relay 预览/提交保持禁止，
重新验证路径后才能继续。节点表翻页不改写编辑器。

连接切换/断开清空列表、候选、概览和详情，丢弃旧连接响应；同一查询只接收
最新请求，避免慢响应覆盖新页面。筛选表单提交回到第 1 页。

## 概览语义

`overview` 的 `nodes` 为当前 Scope 全部 Node（含撤销/过期），`forwards`
为非删除中的规则数；`activeOperations` 为全部 `accepted + running` 操作，
`failedOperations` 为历史失败操作数，包括已删除规则仍保留的历史操作。
四个计数在单条 SQL 中观察，不接受列表筛选、不从当前页推算；
`observedAt` 为查询完成的 Control 时间，不是独立采集时间。

控制台将失败卡片标为“历史失败操作”，不是当前故障节点/Forward 数。
列表加载、翻页或筛选不修改概览；全量刷新和相关写命令接受后独立刷新概览。
这仍是人工刷新时的历史观察，不是持续监控、实时一致性或业务可达保证。

## 索引、验证与边界

本批不增加 Schema 迁移：沿用 Node/Forward/Operation 外键所需的 `scope_id`
索引、主键和 Node Grant 复合主键。真实 MySQL 验收检查索引存在，并使用
`EXPLAIN` 核对基础 Scope 查询有索引候选；不据此声称筛选/排序在大规模下
无需扫描或达到性能 SLO。后续容量证据若显示瓶颈，再单独评审复合/生成列索引
及升级评估器的 Schema 兼容边界，不静默扩展当前 0013 上限。

功能测试仅在 Actions：

- Contract 作业执行查询契约、绑定 SQL、授权顺序和 Web 模型/轻量 DOM 数据流回归。
- Phase1 显式执行 `apps/control/test/console-mysql-acceptance.test.ts`，
  使用真实迁移、MySQL 8.4、mysql2 prepared SQL、Hono 路由和实际 Bearer/Scope 验权；
  API 用户只有 SELECT 权限，写入仅来自隔离数据库的测试夹具。
- 场景包含 40 个 Scope 内节点、39 个非删除 Forward、45 个历史 Operation，
  分页外失败/执行中操作、字面前缀、Direct/Relay/多跳资格、Owner 无隐式 Grant、
  Viewer/移除/跨 Scope 拒绝，以及撤销 Grant、凭据到期、节点撤销和成员降级。
- 对整个数据库每张表的读取前后摘要作比较，含运行、租约和审计表；
  不声称覆盖并发撤权压力、真实浏览器、布局可访问性或物理网络验收。

只读审计查询、支持包导出及完整 HTTPS 浏览器端到端验收仍分开排期。
