# TuneX VNext · Docker / 1Panel 部署与测试

## 当前源码增量：0037 受控 Direct TCP/UDP Nonce Echo

2026-10-18 当前Control源码目标 `adp3-probe-echo-v1` / Schema0037，catalog37项，末项
`0037-probe-echo.sql`；原Agent runtime/multihop兼容Profile与Journal不改。以下0036
是前片历史。旧reader拒绝0037；flag关闭不能撤销DDL，部分迁移/具名CHECK不符须维护
与人工review，不能盲重放。详见[升级评估](../docs/operations/upgrade-assessment.md)。

Control新 `TUNEX_PROBE_ECHO=0`，开启须 `TUNEX_PROBE_SERVICES=1`、ingress/execution
与 `TUNEX_PROBE_CLOCK_SKEW_SECONDS=1`；Agent新 `--probe-echo=false` / Compose变量
`TUNEX_PROBE_AGENT_ECHO`，须services/ingress/execution/registration均true。仅发行配置，
不是资格/worker活性、真实时钟同步或网络成功证明；schedule仍单独默认关闭。

manager显式登记config2 `controlled-nonce-echo`、数字endpoint/协议与独立Ed25519公钥，
不把TLS config1扩义或重用Relay/Node/Authority私钥。原业务Direct目标必须精确匹配
声明endpoint及协议；每次经原owner生成新nonce并复核当前metadata CAS/config revision/
digest/窗口/权限，只向同Agent当前原listener做一次TCP或UDP往返，不直拨target兜底。
成功须完整256B请求/256B响应及本次challenge/签名验证；UDP send成功/静默/超时不算
成功或unreachable，不重试、不补发。不能向任意业务服务注入未知payload。

TCP/UDP实际通过原Forward，产生业务payload、下游FD/session和计数；UDP Probe socket
关闭不立即清除原Forward association，仍受原session上限/idle清理，不宣称两秒内释放
所有业务资源。原256许可预算/两秒/watch/单次消费与有限计划不变；历史仅compact
service/challenge/proof/有界计数，无原帧/秘密。恢复保留nonce/proof/预算/marker/高水位，
隔离当前服务/资格/许可/计划，不重放、退款或自动恢复；GET与registry发布不发网络包。

nonce本身不是客户身份；独立operator echo responder须专用签名seed、显式来源CIDR、
固定帧/速率/期限/重放tombstone与等长回复边界，registry不能远程启动/kill/续期。
新源码/Compose不是已build或已发布镜像，TLS-only responder仍是原独立程序，不能把
它当成echo服务。只证明这次受控roundtrip，不是外部/独立邻接/应用健康/Relay/多跳/C3。
全部未执行检查、测试、脚本/格式化/fixtures、网络/MySQL/浏览器、Compose/build/release、
CI或Git操作；集中及物理/生产验收仍开放。

## 前片源码增量：0036 受控 Direct 入口 TLS

此前Control目标 `adp3-probe-services-v1` / Schema0036，catalog36项，末项
`0036-probe-services.sql`；原Agent runtime/multihop compatibility Profile不变。
旧Control reader拒绝0036，flag关闭不是Schema回滚。迁移显式替换
`probe_runs_chk_18` 分类约束；实际MySQL8.4 catalog与部分DDL未验收，名称不符须
维护/人工review，不盲重放或自动删除其他约束。详见[升级评估](../docs/operations/upgrade-assessment.md)。

Control新增 `TUNEX_PROBE_SERVICES=0`，明确开启必须同时有
`TUNEX_PROBE_INGRESS=1`、`TUNEX_PROBE_EXECUTION=1` 与
`TUNEX_PROBE_CLOCK_SKEW_SECONDS=1`；操作员仍须验证真实时钟同步。Agent新增
`--probe-services=false`，Compose变量 `TUNEX_PROBE_AGENT_SERVICES`，依赖
`TUNEX_PROBE_AGENT_INGRESS=true`、`TUNEX_PROBE_AGENT_EXECUTION=true` 与
`TUNEX_PROBE_REGISTRATION=true`。有限schedule是另一默认关闭选项，不因TLS自动开启。
配置只允许原owner发行，不证明Agent资格、worker活性、证书私钥持有或网络成功。

先由manager登记专用受控服务的公有leaf pin，再手动读取精确serviceId/当前metadata
CAS/configRevision/configDigest；原Direct数字target必须精确等于该endpoint。
独立operator responder另行部署（不是Control自动创建/kill的进程），不复用Agent/
Relay私钥。Probe选择tcp-ingress-tls后只拨当前原ingresslistener，TLSrecords经原
TCP规则到服务，校TLS1.3/SNI/scopedURI/固定ALPN/专用精确叶pin/有效期，不直拨服务兜底。
零TLS应用字节仍会有握手records、下游拨号、业务payload和计数，不是外部入口、
HTTP/应用响应、Relay/多跳、nonceecho或健康聚合验收。

资格仍同原slot，唯一256预算/两秒/一次burn/watch/报告不变，不因升级续期或重臂。
服务fullcontext仅offer/permit<=16384，compactreqack/result仍4096，history不复制DER；
原1024/七天历史与32计划/16决策/一小时不变。旧v1/v2意义不变，无失败降级；旧两类
v3结果的service/tls为null。unknown不得捏造失败或换key重发，Console固定原命令与ref。
归档、推进metadata的发布和recovery使旧精确服务引用失效，不自动选latest；普通
同配置发布仍no-op，恢复同配置显式再声明仅推进metadata。恢复保留原预算/历史/
资格marker/高水位，隔离资格和活动计划，revision耗尽整事务失败需review。

仅源码与文档接线，未执行测试、检查、脚本/format/fixtures、网络/MySQL/浏览器/
容器/build/release、CI或Git状态改动/提交/推送。新Compose不是已发布镜像或生产配方；D1/C3前置和
物理/生产/集中验收仍开放。[契约](../docs/spec/direct-ingress-tls-probes-v1.md)。

> 本文是 **Dev 测试环境**操作手册，不是 Stable 生产就绪认证。VNext 使用 ADP/3，禁止复用 `legacy/v2` 数据库、证书或 Agent Journal。仓库根目录 [README](../README.md) 只保留快速部署命令。

升级、关闭多跳或计划恢复前，先执行 [只读升级与恢复评估](../docs/operations/upgrade-assessment.md)。
评估不会自动迁移或批准恢复；已迁移 Journal 不允许回退旧 Agent。

## Independent Observation Responder

2026-10-18 [ADR-0044](../docs/decisions/0044-observation-service-authority.md) /
[契约](../docs/spec/observation-services-v1.md) 增加独立 operator TLS-only 服务源码。
`deploy/Dockerfile.observation-responder` 与 `deploy/compose.observation.example.yaml`
目前**未 build、未扫描/签名/发布、未运行网络/容器或物理验收**，不存在可据本文认定
已发布的镜像标签或 Digest。它不是 Agent/Relay，也不是现有网络测试 fixture。
不要将此源码示例当作已接受的生产操作或 D1 TLS/echo/健康测量。

### 身份和声明不是一回事

- Registry 保存 manager 声明的数字 endpoint 与 public leaf pin，**不会**生成/下发私钥、
  部署/启动/kill/续期本服务、连接地址或证明 ownership/健康。当前无新测量许可/Agent
  TLS client，measurementAvailable=false；归档/恢复隔离也不远程停止 operator 进程。
- Operator 必须独立准备专用非 CA、serverAuth-only 叶证书及私钥；不复用 Agent、
  Control CA 或 Relay 双用途身份。证书只能有一个精确小写多标签 DNS SAN 和一个 URI
  `urn:tunex:observation-service:编码Scope:serviceId`，与 Registry 规范身份完全一致。
  使用现有受控 PKI 工具准备身份；本片没有执行证书/密钥生成、导入或网络验真。
- 服务 `--cert` 是仅一个叶子的公有 PEM，`--key` 是对应私钥；Registry 的 certificateDer
  是该同一叶子的 canonical base64 DER（不是 PEM、chain 或私钥）。证书 DER<=8192B，
  cert/key 各文件<=16KiB。公钥限定 RSA2048..8192、EC P-256/P-384/P-521 或 Ed25519。
  只按 exact leaf SHA-256 pin，不借 public CA/OS store 信任替代精确身份。
- Registry endpoint、实际 `--listen`、证书 DNS、`--server-name`、Scope/service ID 必须
  由 operator 明确核对。server-name 只用于证书与精确 TLS SNI，不会 DNS 解析为目标。
  后续实际 issuer/watch 仍须 current head/config/digest 与权限/NodeGrant/policy/window；
  可读历史 pin 不是可执行选择或不变的将来授权。

### Linux 文件与容器边界

独立目录布局示意（不在仓库或 Agent/Control State 中）：

```text
/srv/tunex/observation/identity/   # owner UID10001，0700
  server.pem                     # operator 公有专用叶证书
  server.key                     # owner UID10001，0400/0600，无其他访问位或执行位
/secure/tunex-observation.env     # operator 主机保存，禁止提交
```

私钥要求有效 UID 所有、regular nonsymlink final file、owner-only nonexecutable；
Windows ACL 无法由此实现证明，**失败关闭，不放宽权限规则**。证书和私钥文件均须受控，
本程序不写 RootFS、不读环境内身份、OS CA、Journal、Relay 或 Agent 凭据；不要给它
挂载上述权威状态。Compose readonly bind 的 `create_host_path:false` 不会帮建缺目录，
运行 UID10001 必须能读 operator 目录，且父路径和密钥权限应由 operator 先行审阅。

独立 Compose 采用 host network、只读 RootFS、cap_drop ALL/no-new-privileges、
UID/GID10001、有限 PID/memory/CPU/nofile，`restart:"no"`；不是默认现有 Control/Agent
服务的一部分。端口需为该 UID 可绑定的精确非特权端口，不用 wildcard 或 port0；
指定精确 loopback 只适合本机观测，不成为外部可达证据。host network 不提供网络隔离，
仍须 operator 防火墙和明确来源 CIDR。先审阅实际主机网络/权限，不自动纠正成开放地址。

### 显式参数和有限运行

必选参数：`--scope-id`、`--service-id`、`--server-name`、`--listen`、`--cert`、
`--key`、`--allow-cidrs`、`--valid-until`。service ID 是安全1..64字符；listen 为
canonical numeric unicast IP:port，拒 zones/mapped/wildcard/multicast/link-local/
metadata 地址，IPv6 使用正常带括号的 host:port。allow-cidrs 是1..32个无空白、去重、
canonical 网络 CIDR 的逗号串；只过滤 incoming remote IP，不是 Scope 成员认证。
TLS 无 mTLS/ClientAuth；任何落在允许来源内的客户端仍不是已授权 Probe issuer。

`--valid-until` 是精确 `YYYY-MM-DDTHH:mm:ss.sssZ`，必须在未来、<=now+7天且
<=叶证书 NotAfter，不自动续期或 hot reload。`--max-connections` 默认16/范围1..64，
`--handshakes-per-second` 默认16/范围1..64，token burst=min(rate,maxConnections)。
只做 TLS1.3/精确 SNI/ALPN `tunex-observation/1` 握手，然后关闭，不读写应用数据、
echo、代理/拨号、UDP 或代替真实业务 target。TLS session tickets 禁用；握手最多2秒、
整连接从 Accept 起3秒，两方向 TLS wire 各32768B。过载不排无界队列；到期、信号或
fatal accept 会关闭 listener/所有 tracked socket 并等 worker 退出，不由 Registry续跑。

示例 Compose 需要 operator 提供以下环境值，并在审阅后才运行；本文未执行任何示例：

```text
TUNEX_OBSERVATION_IMAGE=<未来审阅且固定 registry digest 的独立镜像，非已发布声明>
TUNEX_OBSERVATION_SCOPE=<精确 Scope>
TUNEX_OBSERVATION_SERVICE=<专用安全 service ID>
TUNEX_OBSERVATION_SERVER_NAME=<精确小写 DNS/SNI>
TUNEX_OBSERVATION_LISTEN=<精确主机数字 IP:非特权端口>
TUNEX_OBSERVATION_IDENTITY_DIR=/srv/tunex/observation/identity
TUNEX_OBSERVATION_ALLOW_CIDRS=<明确 canonical incoming source CIDRs>
TUNEX_OBSERVATION_VALID_UNTIL=<明确 UTC 毫秒绝对到期>
```

不能用占位镜像或不断移动的 tag 代替 release 身份；新 Dockerfile 不是已产出的镜像。
后续必须按最终源码 SHA 完成证书/权限/SNI/ALPN/CIDR/速率/字节/超时/关闭、真实 Linux
容器与物理主机证据，再做构建发布决策。本片没有 tests/static/types/syntax/scripts/
format/fixtures/CI/network/build/release/Git；D1/C3 与生产门禁继续未通过。

## 1. 部署模型与前置条件

- **Control 主机**：Linux、Docker/Compose v2、外部 MySQL **8.4**、Control HTTPS/PKI、受保护 Authority State；Control 镜像运行 UID/GID `10001:10001`。
- **Agent 主机**：Linux、内核时钟同步、已注册的 Node ID、原始 Control CA、独立的 State 与 Journal MAC Key，容器运行 UID/GID `10001:10001`。两个 Agent 测 Relay 时，优先分配独立主机。
- 验证使用固定的镜像 **registry Digest**（`ghcr.io/anrcm0/tunex-control@sha256:...`、`ghcr.io/anrcm0/tunex-agent@sha256:...`），避免测试期间移动的 `:dev` 标签改变环境。GHCR 私有镜像要先用具备读取权限的令牌登录。
- 每台主机检出本仓库同版本的 `deploy/` 配置。**Control 只用 `deploy/compose.control.example.yaml`，Agent 只用 `deploy/compose.agent.example.yaml`**；历史双服务 `compose.runtime.example.yaml` 仅供参考，不能把其中未用服务的环境变量缺失当成实际 Agent 故障。
- 不要在 Control 主机同时运行另一个指向相同数据库/Authority 的 Control，也不要在 Agent 主机同时让两个进程占用相同的 State/Journal、Node 身份或 TCP/UDP 监听端口。

### 目录与权限

Control 主机：

```text
/srv/tunex/control/state/       # 持久 Authority / 信任绑定
/srv/tunex/control/pki/         # ca.pem / ca.key / server.pem / server.key
/secure/tunex-control.env       # 只在主机保管，严禁提交 Git
```

Agent 主机：

```text
/srv/tunex/agent/state/         # Node 身份、凭据、journal.json、high-water
/srv/tunex/agent/secrets/       # control-ca.pem / journal.key
/secure/tunex-agent.env         # 只在主机保管
```

创建现有目录并赋予容器 UID `10001` 必需权限；私钥和 Journal Key 应受限为仅相应服务账户可读。**Agent `secrets/` 不得位于 `state/` 内部**，且后续常驻容器只读挂载 secrets。不要把 Node Enrollment Token 存入 Compose、Docker 镜像、Git 或命令历史。

CA 应为测试环境专用 ECDSA CA；Control 服务器证书由该 CA 信任，必须覆盖 Agent 访问的真实域名/IP SAN。**CA 与 Authority State 绑定**，已初始化实例不得更换 CA 后尝试清空/重新初始化原状态以消除错误。

## 2. 镜像与环境文件

在 [自动发布 Workflow](../.github/workflows/images.yml) 的**成功**运行 Summary 中复制两张完整 `@sha256:` Digest。每台主机只填自己角色的变量，例子中值均为占位符：

Control 的 `/secure/tunex-control.env`：

```dotenv
TUNEX_CONTROL_IMAGE=ghcr.io/anrcm0/tunex-control@sha256:REPLACE_WITH_64_HEX_DIGEST
TUNEX_DATABASE_URL=mysql://dedicated-user:REPLACE_PASSWORD@db-private.example:3306/tunex_vnext_test
TUNEX_CONTROL_STATE_DIR=/srv/tunex/control/state
TUNEX_CONTROL_PKI_DIR=/srv/tunex/control/pki
```

Agent 的 `/secure/tunex-agent.env`：

```dotenv
TUNEX_AGENT_IMAGE=ghcr.io/anrcm0/tunex-agent@sha256:REPLACE_WITH_64_HEX_DIGEST
TUNEX_CONTROL_URL=https://control-dev.example:41001
TUNEX_NODE_ID=REPLACE_WITH_ENROLLED_NODE_ID
TUNEX_AGENT_STATE_DIR=/srv/tunex/agent/state
TUNEX_AGENT_SECRETS_DIR=/srv/tunex/agent/secrets
```

`docker compose --env-file` 用于**Compose 变量插值**。Shell 中临时导出的变量不会自动传入容器，除非在 Compose 的 `environment:` 明确声明，或在 `docker compose run -e NAME` 中显式透传。仓库的角色独立模板已经声明常驻服务所需变量。不要对任何生产日志打印数据库 URL、Owner Token 或私钥。

实验性 Direct TCP Probe 默认关闭。单独试验需 Control 的 `TUNEX_PROBE_EXECUTION=1` 与
`TUNEX_PROBE_CLOCK_SKEW_SECONDS=1`，以及 Agent 的 `TUNEX_PROBE_REGISTRATION=true` 与
`TUNEX_PROBE_AGENT_EXECUTION=true`。仅登记不执行；仅启用 Control 签发不保证节点执行。
这会明确选择更严格的一秒集群 ADP 时钟策略，须独立核验所有 Agent 的 OS 时间并重新协商，
不是自动修时钟或实时撤权承诺。保持开关关闭不影响既有 native 服务。
签发、历史回执、撤销及不确定结果边界见 [Probe 管理契约](../docs/spec/forward-probe-management-v1.md)。
当前组合验收仅已接入 Actions，尚无本工作树对应 SHA 的通过声明，不据此建议生产启用。

Node 进程遥测同样默认关闭。仅在已审阅的新版 Control/Agent 镜像上试用，分别加入对应角色的环境文件：

```dotenv
# /secure/tunex-control.env
TUNEX_TELEMETRY=1
# /secure/tunex-agent.env
TUNEX_TELEMETRY_AGENT=true
```

角色独立模板及内部 runtime 模板将其映射为 Control 的 `TUNEX_TELEMETRY` 和 Agent 的
`--telemetry=true`；关闭时分别使用 `0` / `false`。使用既有 Compose 启动流程重建对应服务，
不重新 enrollment、不初始化 Authority、不删除状态目录。直接运行 Agent 时显式传 `--telemetry=true`。
旧 Agent 镜像若不识别该新参数，应继续使用与该镜像配套的旧模板，不能仅将新参数设为 false 规避。
上报复用既有端到端 mTLS，不新增公开端口或凭据，不改变 Probe 时钟开关和原机器协议。
两侧均启用才构成采样接收链；本地 `--diagnostics` 文件不是远程历史，缺测不是零值或健康证明。
本批仅支持进程/运行时运维采样及有界原始历史，不提供主机统计、规则 payload、聚合或结算。
关闭采样不回退已应用的 0020 Schema；升级与恢复仍须遵守
[只读升级评估](../docs/operations/upgrade-assessment.md) 的兼容与维护边界。
该部署接线未运行测试、静态检查、Compose 验证或 Actions，集中验收前不建议生产启用。

Forward 入口累计遥测是另一独立、默认关闭的开关；它不要求同时启用进程遥测：

```dotenv
# /secure/tunex-control.env
TUNEX_FORWARD_TELEMETRY=1
# /secure/tunex-agent.env
TUNEX_FORWARD_TELEMETRY_AGENT=true
```

模板将其分别透传为 Control 环境和 Agent `--forward-telemetry=true`，默认 `0` / `false`。
需要匹配这批新参数的新版镜像；旧 Agent 即便面对 `--forward-telemetry=false` 也可能拒绝启动，
应使用其配套旧模板。不要重新 enrollment、初始化 Authority 或删除持久状态。
复用原 mTLS 和既有端口；0021 Schema 即使功能关闭也不能降旧 Control。
[Forward 遥测契约](../docs/spec/forward-telemetry-v1.md) 仅提供有界、可能缺失的运维历史；
并非整条规则汇总、健康证明或结算用量。尾部和 ACK 丢失不保证重传。
此接线及其功能仍未测试、未静态检查、未执行 Compose 验证或 Actions。

### Agent 可见主机指标

Agent 可见主机指标另有独立、默认关闭开关（不依赖 process/Forward 开关）：

```dotenv
# /secure/tunex-control.env
TUNEX_HOST_TELEMETRY=1
# /secure/tunex-agent.env
TUNEX_HOST_TELEMETRY_AGENT=true
```

模板分别透传 Control 环境与 Agent `--host-telemetry=true`，默认 `0` / `false`。
只使用支持新参数的匹配镜像，旧 Agent 不因参数值为 false 自动兼容；保留对应旧模板。
不重新 enrollment、不删除状态、不重建 Authority。Linux 来源是容器/Agent 可见 OS、
根文件系统和网络命名空间，不采集 cgroup 限额，也不承诺整台物理主机可见性。
其他平台明确 unsupported。共享既有观察池，不新增端口或执行权限；0022 应用后即使关闭
功能也不能降旧 Control。详见 [Host 遥测契约](../docs/spec/host-telemetry-v1.md)。
此接线未测试、未检查或执行 Compose/CI，不建议据源码存在直接启用生产。

### Probe 累计指标

Probe 累计指标独立默认关闭，不会启用原 Probe 注册/执行或签发许可：

```dotenv
# /secure/tunex-control.env
TUNEX_PROBE_TELEMETRY=1
# /secure/tunex-agent.env
TUNEX_PROBE_TELEMETRY_AGENT=true
```

模板分别传入 Control 环境与 Agent `--probe-telemetry=true`，默认 `0` / `false`。
必须使用匹配新 flag 的二进制/模板；不能用 false 值让旧 Agent 识别未知参数。
保持原 Probe 执行开关、授权、安全策略与状态目录，不重 enrollment 或清 Authority/Journal。
[累计契约](../docs/spec/probe-telemetry-v1.md) 使用真实 dial 尝试和明确 unknown，
不是 consumed permit/结果行计数，不承诺所有尾部送达，不是网络丢包率或健康。
0023 应用后旧 Control 上界仍拒绝；部署接线未测试/检查/Compose/CI。

### 长窗口聚合与逻辑容量

Control 环境文件增加 `TUNEX_TELEMETRY_ROLLUPS=1` 可显式启用新接收观察的分钟/小时
聚合，默认 `0`；仅 Control/runtime 模板透传，没有新增 Agent 参数或协议。
原四族 intake 开关仍各自生效，不补扫启用前原始历史，关闭不清现有聚合。
原始点/head与双层聚合在同一观察事务提交，Scope配额不足拒绝该观察事务，不抢其他Node。
七天分钟/三十天小时只是逻辑查询期；exact-series变化、配额淘汰可使覆盖提前缺失。
[聚合契约](../docs/spec/telemetry-rollups-v1.md) 给出Node/Scope行数与逻辑JSON上限；
未测物理磁盘、SQL/索引/日志/备份开销，原始历史没有新增Scope硬容量保证。
0024 应用后旧Control拒绝即使开关关闭；不重enrollment、不删Journal/Authority/历史。
本地接线未测试/检查/Compose/CI，不据此建议生产启用。

### C2-A 路径组与 Schema 0025

0025 切片对应 `adp3-path-groups-v1`；当前 Control 镜像源码目标已推进至下述 0026。Compose 示例
不新增分组运行开关。Agent ADP/Journal 与 runtime/multihop Profile 不变。
旧 Control 即使没有使用分组也不能读取已应用的 0025；部署前按既有维护、备份、
只读评估和 DDL 审阅流程处理。五张新增表及部分 DDL 拒绝规则见
[升级评估](../docs/operations/upgrade-assessment.md#schema-0025-c2-a-路径组)。

首片只支持 `egress-candidates` / `backup-paths` 的 1 至 8 条锁版完整路径。
人工选一个候选，仍走原 Forward CAS/幂等/Relay 预检与 Runtime；归档不停止流量，
发布修订不自动跟随，恢复不自动选择或重新应用。分组不是共享物理连接、健康切换、
入口多规则编排或可持久恢复的批次 saga。详见[路径组契约](../docs/spec/path-groups-v1.md)。
本地仅源码/文档接线，未检查、测试、Compose 或 CI；C2 与后续 C3 均未据此完成。

### C2-B 持久人工路径发布与 Schema 0026

0026 切片对应 `adp3-path-publications-v1`；当前源码目标已推进至下述 0027。不增加 Agent
参数、协议、Journal、运行开关或后台发布 worker。旧 Control 即使批次未使用也
不能读取已应用的 0026，迁移仍需原维护/备份/DDL 审阅。新增三表、部分 DDL 拒绝
和恢复挂起规则见[升级评估](../docs/operations/upgrade-assessment.md)。

每 Scope 最多 64 个持久批次（含终态），每批 1 至 10 个精确源 Forward/CAS/来源。
预览摘要确认后重算创建计划，创建不改 Forward；原 creator 仍须当前管理权限，
逐次人工执行一个 apply 或条件 compensation。每项各一次，取消仅阻止以后 apply，
不取消已接受 Operation，仍允许符合条件的补偿；跨规则不原子。
已发送但未知结果只允许原 key/body 同命令重放，不自动刷新 CAS、继续尾项或重做计划。
恢复保留计划/receipt/审计并一次性 invalidated，绝不自动恢复执行或补偿。
详见[持久发布契约](../docs/spec/path-publications-v1.md)。

本切片仅源码/文档接线，未测试、检查、部署、网络或 CI；入口组与 C3 仍延后，
不能据此宣称 C2 完成或生产就绪。

### C2-C 入口组与 Schema 0027

0027 切片对应 `adp3-ingress-groups-v1`，当前源码目标已推进至第 12 节 0032；本切片无新增 Agent
参数、协议、Journal、运行开关或后台执行器。六表部分 DDL 和旧 Control 拒绝规则
见[升级评估](../docs/operations/upgrade-assessment.md)；完整 SQL 备份保留定义、
批次及原 Forward/PathBinding/Operation 历史，恢复一次性 invalidated，绝不重放。

入口组 1 至 8 个完整锁版成员各有不同入口，确认预览后保存无身份/资源预留的计划；
逐项人工创建独立 Forward/Operation，原 owner 在接受时生成身份。取消仅阻止后续
create，条件补偿是原 owner 的 guarded 删除意图，不是同步回滚或已完成资源清理。
计划/接受回执只保存历史创建归属，不维护“当前入口组绑定”；后续编辑不会改写它。
无笛卡尔积、VIP、DNS 切流、全局 HA 或跨入口原子 Operation。详见
[入口组契约](../docs/spec/ingress-groups-v1.md)。已有部署到新组修订的影响与逐成员
add/update/remove 是该 C2-C 首片的后续范围，现见下述 C2-C2；创建重复规则不是更新原部署。
C3 与集中验收仍延后；本地未检查、
测试、部署、网络或 CI，不据此宣称 C2 完成或生产就绪。

### C2-C2 显式入口修订迁移与 Schema 0028

该切片 Control Profile 为 `adp3-ingress-migrations-v1` / Schema 0028，Agent 与运行开关
不变。旧 Control 即使未使用迁移批次也拒绝；部分 DDL/完整备份/恢复规则见
[升级评估](../docs/operations/upgrade-assessment.md)。新增三表保留完整定义差异、精确
历史来源和逐项决定，原恢复事务一次性 invalidated、留历史且不自动对账/回放。

入口修订迁移显式选择来源与 add/update/remove，总动作最多 8 条；预览摘要确认后
保存不可变计划、每次人工推进一个动作。update 不改 ingress/协议/监听/target/enabled；
改变入口需显式 remove+add；同入口改协议/业务意图也可显式成对重建，但禁止未配对的
重复 add。两项独立可能部分成功。add 补偿为条件删除，update 为
重新授权的完整 source 恢复，remove **不可补偿**。无当前入口成员指针、自动 diff 应用、
VIP/DNS/global HA 或跨规则原子 Operation。详见
[迁移契约](../docs/spec/ingress-migrations-v1.md)。源码未检查/测试/部署/CI，C2 未验收完成。

### 分角色只读预检

在对应 Linux 主机使用仓库指定的 Node 版本，检查该角色环境文件。Control
还需提供 Agent 实际访问的 HTTPS origin，以核对服务器证书 SAN；也可将
`TUNEX_CONTROL_URL` 写入 Control 的环境文件，仅供预检使用。

```bash
# 已有 Control；实际地址必须对应证书 SAN
node --env-file=/secure/tunex-control.env deploy/preflight.mjs \
  --role control --control-url https://control-dev.example:41001 --json

# 已注册 Agent；只需要 Agent 的变量和本机文件
node --env-file=/secure/tunex-agent.env deploy/preflight.mjs --role agent --json
```

首次部署或注册前增加 `--phase initial`：要求现有 State 目录为空，Agent Secrets
仅含可信 `control-ca.pem`。它不会创建目录、修改权限、初始化 Authority 或执行
Enrollment；数据库是否全新仍由正式初始化流程确认。已有实例默认使用
`--phase existing`，Control 必须存在 Authority 状态和 Key，Agent 必须存在
证书、私钥、Journal 和 Key。不能改用 initial 掩盖缺失的旧状态。

预检检查角色所需的镜像 Digest、目录边界、UID/GID `10001:10001` 的 POSIX
权限、证书有效期/签发关系/用途、私钥匹配，以及 Control 的精确 DNS/IP SAN。
当前按模板的直接 CA 签发模型检查，不做中间 CA 链构建，DNS SAN 不接受通配符；
需要其他 PKI 模型时先明确部署支持范围。受保护文件要求服务 UID 所有、
仅所有者可读，目录和证书不得允许 group/world 写入。

输出 `scope: local-static` 和 `runtimeReady: false`。退出码 `0` 仅表示所实现的
本地静态检查通过，`1` 表示拒绝，`2` 表示必要检查未完成（如在 Windows 上
无法证明 Linux 权限）。报告明确保留未检查项：实际挂载/ACL/UID 映射、
OS 时钟同步、网络/mTLS/MySQL 连通性、状态 MAC 和高水位完整性。
Agent 主机本地预检不会拨号读取远端服务器证书。真实服务启动仍必须执行全部
身份、Journal 和授权校验；静态结果不能作为运行验收或生产批准。

测试在 GitHub Actions 的 `deployment-tools` 和容器工作流运行，覆盖正反例和
CLI 调用；本地开发只做语法等静态检查。原 `validate(env, inspect)` 导出保留为
布局检查兼容接口，不能将其旧结果视为完整的分角色预检。

## 3. Control 首次初始化与正常启动

**仅对真正全新的独立数据库、原始 CA 和空 Authority State 做一次初始化**。如果已经通过初始化和重启，请跳到“正常启动”。

```bash
# 在仓库根目录，确认使用的数据库、证书及 state 目录确实为新的测试环境
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml config --quiet
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml pull control

# 一次性运行服务，明确覆盖固定的 0；此运行不会通过 Compose 暴露服务端口
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml run --rm --no-deps \
  -e TUNEX_AUTHORITY_INITIALIZE=1 control
# 看到 "Control listening" 且确认无错误后，Ctrl+C 正常结束一次性实例
```

然后创建 Owner/Scope。Owner Token 应在可信终端交互输入，并且保留在安全密码管理器中，**不能丢失或明文提交**：

```bash
read -rsp 'New owner token: ' TUNEX_OWNER_TOKEN; echo
export TUNEX_OWNER_TOKEN
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml run --rm --no-deps \
  -e TUNEX_OWNER_TOKEN control node apps/control/src/bootstrap.ts scope-dev owner-dev
unset TUNEX_OWNER_TOKEN
```

正常启动（常驻模板固定 `TUNEX_AUTHORITY_INITIALIZE=0`）：

```bash
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml up -d control
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml ps
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml logs --tail=80 control
```

在同主机通过受信任 CA 验证 HTTPS。以下使用域名 SAN，并强制该域名在此命令解析为回环：

```bash
curl --fail --show-error --cacert /srv/tunex/control/pki/ca.pem \
  --resolve control-dev.example:41001:127.0.0.1 \
  https://control-dev.example:41001/health
```

应得到 `protocolVersion: 3` 和健康状态；**单纯 `/health` 成功不代表 MySQL/Agent/业务转发就绪**。浏览器在有相同信任链的 HTTPS 地址打开 `/console`，用 `scope-dev` 与 Owner Token 进入界面。

### 跨主机 HTTPS 与 1Panel

现有 Control 模板默认只发布 `127.0.0.1:41001`，远端 Agent **无法直接连接**。需要为测试网络选择一条明确、受限的入口：绑定可信内网接口并使用防火墙限制来源，或用 **TCP 四层透传（TLS passthrough）** 暴露到对应私有地址。证书 SAN 必须与 `TUNEX_CONTROL_URL` 一致。

**不要用默认 1Panel OpenResty/Nginx 七层 HTTPS 终止反代代理 Agent 的 `/agent/v3/*`**：Control 需要实际 TLS 客户端证书进行 Node 身份认证，而不是信任可伪造的请求头。可单独规划 Console 的访问入口，但不要让普通 HTTP 反代破坏机器侧的端到端 mTLS。

## 4. Node Enrollment、Agent 启动

在 `/console` 创建允许实际测试 TCP/UDP 地址、端口及目标 CIDR 的 Node，记录 Node ID 与**短时有效**的一次性 Enrollment Token。先通过可信方式放置 `control-ca.pem`，保证 Agent state/secrets 权限。

Enrollment 是**显式的一次性操作**。使用 `docker run` 在 Agent 主机交互执行，可避免 Compose 常驻 secret 的只读挂载及临时环境变量传递问题：

```bash
# 从发布 Summary 复制的完整 Digest；不要填示例占位符
export TUNEX_AGENT_IMAGE='ghcr.io/anrcm0/tunex-agent@sha256:REPLACE_WITH_64_HEX_DIGEST'
export TUNEX_CONTROL_URL='https://control-dev.example:41001'
export TUNEX_NODE_ID='REPLACE_WITH_ENROLLED_NODE_ID'
read -rsp 'Enrollment Token: ' TUNEX_ENROLLMENT_TOKEN; echo
export TUNEX_ENROLLMENT_TOKEN

docker run --rm --network host --user 10001:10001 \
  -e TUNEX_ENROLLMENT_TOKEN \
  -v /srv/tunex/agent/state:/var/lib/tunex-agent \
  -v /srv/tunex/agent/secrets:/run/tunex-agent-secrets \
  "$TUNEX_AGENT_IMAGE" \
  --enroll --control="$TUNEX_CONTROL_URL" --node="$TUNEX_NODE_ID" \
  --ca=/run/tunex-agent-secrets/control-ca.pem \
  --state=/var/lib/tunex-agent \
  --journal-key=/run/tunex-agent-secrets/journal.key

unset TUNEX_ENROLLMENT_TOKEN
```

确认 Enrollment 成功、`journal.key` 与 `journal.json` 均已受保护持久化后，启动常驻 Agent：

```bash
docker compose --env-file /secure/tunex-agent.env \
  -f deploy/compose.agent.example.yaml config --quiet
docker compose --env-file /secure/tunex-agent.env \
  -f deploy/compose.agent.example.yaml up -d agent
docker compose --env-file /secure/tunex-agent.env \
  -f deploy/compose.agent.example.yaml logs --tail=100 agent
```

该 Agent 模板明确包含 `--relay`。只跑 Direct 时可在本机副本中删掉 `--relay`，不要修改已持久化的节点授权或 Journal。**实测采用 `network_mode: host` 验证原生端口和 Relay**；Bridge 模式中的 TLS/执行期限错误应检查内部端点 `advertisedHost`、监听/映射、DNS、双向 TCP 连通性及防火墙，不能简单断言 Bridge 永远不支持 Relay。

## 5. 转发与 Relay 冒烟测试

**Direct TCP**：在 Agent 可达的目标主机准备独立 HTTP Echo（测试主机可用 `python3 -m http.server 18080 --bind 127.0.0.1`）。在 `/console` 建立 TCP Forward（示例：`127.0.0.1:25565` → `127.0.0.1:18080`）；前提是 Node Policy 允许该监听、目标 CIDR/端口。验证：

```bash
curl --fail http://127.0.0.1:25565/
```

**Direct UDP**：在仓库目录执行 `node scripts/manual/udp-smoke.mjs echo --port 18081`，在 Console 另建 UDP-only Forward（`127.0.0.1:25565/udp` → `127.0.0.1:18081/udp`），然后执行：

```bash
node scripts/manual/udp-smoke.mjs probe --port 25565 --count 5 --timeout-ms 3000
```

必须看到两个独立 socket 共 10 个报文精确返回，并重新验证同数值端口的 TCP 仍可用。完整细节见 [UDP 实机检查](../docs/development/direct-udp-live-smoke.md)。

**Relay**：在第二台 Agent 主机重复注册和部署，且两端使用 `--relay`。于 Console 完成出口 Node Endpoint（公网/私网实际可达地址及独立内部 TLS/TCP 端口）、不可变 Transport Profile、Node/Profile 使用授权，再先预览 Plan，后创建 Relay Forward。只有两端当前 `active/ready` 且真实 TCP/UDP payload 通过才计为业务成功。正确拒绝测试包括伪造 CA、错误 Node ID、旧 peer pin 和无权限目的地址。参见 [Relay Console](../docs/development/relay-console.md) 与 [Relay Control](../docs/development/relay-control.md)。

以上用例可先在同主机独立容器中跑内部冒烟；**两台容器不等于两台物理主机**。跨主机网络隔离、丢包及故障切换需要单独验收。

## 6. 凭据轮换、故障恢复、备份与回滚

- `--rotate` 表示**主动触发机器凭据轮换**，不等于已经验证无人操作的长期自动 peer 轮换。先记录 Node 当前 session、Forward Health 和真实 Relay TCP/UDP 客户端收发，再触发轮换并复测；不能靠清空 Journal 来回到旧 session。
- 在隔离环境下分别验证 Agent 重启、Control 中断、Relay egress 不可达、旧凭据拒绝以及真实租约截止。故障后的恢复要检查新 Snapshot/Report、Operation 和实际用户 payload，而不是只看容器 `healthy`。
- MySQL 备份还原**不能单独代表安全回滚**。保护并核对 Authority 状态、CA、Agent Journal/high-water、数据库版本和凭据；禁止 `docker compose down -v`、重复 Authority 初始化、清空 Journal 或重用旧 V2 数据。需要进行真实恢复时遵循 [节点安全与恢复](../docs/operations/node-security-and-recovery-v1.md) 与 [恢复和容量](../docs/development/recovery-and-capacity.md)，在停用发行者、检查历史租约后按正式恢复工具的流程操作。
- 记录每次验收使用的 **完整 Digest、Git SHA、数据库 Schema 版本、容器用户/权限、脱敏日志、Forward/Operation ID、TCP/UDP 实际结果**。不公开 Owner/Enrollment Token、CA 私钥、Node 私钥、Journal Key 和原始数据库备份。

## 7. 仍不属于“生产就绪”的范围

Docker CI、SBOM、修复版 Critical 漏洞阻断和 GHCR 自动 Dev/版本镜像发布已经接入；这些不能代替安全复核。剩余发布门槛包括：不同**物理** Linux 主机的 Relay、实际宿主机防火墙与 L4 TLS 入口、无人值守自动轮换与长时间稳定性测试、High 漏洞分级、备份恢复/升级兼容性、多版本回滚及 1Panel 用户体验校验。

**开发排期与可交付出口：** [下一阶段开发目标](../docs/development/next-milestones.md)。

## 8. Default-off multi-hop development

The new execution path is described in
[multi-hop implementation and deferred acceptance](../docs/development/multihop-execution.md).
Base Control and Agent templates remain opt-in. Production Control additionally
requires an exact-source, reviewed evidence bundle. The optional
[Control override](compose.multihop-control.override.example.yaml) mounts that
bundle read-only; it is not a shortcut around runtime, physical-host or P0 gates.
Keep the upgraded Agent journal and its high-water when withdrawing the feature.

## 9. D3-B Station Alerts / Schema 0029

该切片 Control Profile 为 `adp3-station-alerts-v1` / Schema 0029；当时目录 29 项，
末项 `0029-station-alerts.sql`。旧库升级需要维护、备份与 DDL 审阅；关闭功能不能
撤销已应用的 Schema，旧 Control Profile 不兼容 0029。Agent Profile、ADP 与
Journal 不变，不需要清理安全历史或重新初始化 Authority。

`TUNEX_STATION_ALERTS=1` 显式启用独立被动观察，默认 `0`。站内策略、派生观察状态、
事件和管理审计属于 Control 自身表；不复用 Runtime worker，不由 GET 触发观察或通知。
Operation 失败是部署状态，Node report stale 是数据新鲜度，不是目标端到端故障证明。
本片没有外发渠道、webhook 队列或凭据；静默不是停止 Runtime 或变更执行授权。

每 Scope 最多 64 策略 ID（含 disabled）、1024 事件和 256 管理审计；事件在追加时
分批清理超过 30 天的记录，容量淘汰可能更早，loss counters 标识丢失。它们是逻辑额度，
不是物理磁盘或 SQL 成本验收。正式 restore 在原 quarantine 事务中把全部策略置为
recovery suspended、清空派生观察状态并隔离旧事件；保留配置、静默、管理审计和历史，
不补发、不自动恢复观察、不伪造恢复事件。操作员需在安全恢复 review/resume 后显式
重新发布策略；不能清 Authority/Agent Journal/high-water 绕过恢复流程。

本片仅编写源码与文档，没有测试、静态/语法/类型/格式检查、脚本、CI、容器或网络验收；
未提交/推送，不构成 D3 完成或生产就绪声明。

## 10. D3-B2 Notification Endpoints / Schema 0030

该切片 Control Profile 为 `adp3-notification-endpoints-v1` / Schema 0030；当时目录 30 项，
末项 `0030-notification-endpoints.sql`。Agent Profile、ADP 与 Journal 不变。新三表
只持久化端点非秘密配置、opaque 凭据引用和管理审计，不构成发送队列或外部执行权限。
本片无 delivery flag、outbox、投递 timer 或实际发送；受限 sender 源码未接 worker。
GET/发布/禁用不会测试 URL 或触发网络；不能据此宣称受控 webhook 已交付完成。

可选 `TUNEX_NOTIFICATION_SECRETS` 指向独立绝对目录；默认示例没有启用环境变量或
挂载。需要时同时取消 Compose 的注释环境项与独立 bind，先由操作员安全预置：目录
本身及 `records/` 为 UID 10001、mode 0700，`key` 是 UID 10001、mode 0600 的独立
随机 raw32-byte 文件；不是十六进制文本，更不是 Authority key。Linux-only，不自动
初始化/rekey，也不承诺 Windows ACL。所有父目录不得含符号链接或允许非信任写入。
vault 与 Control state、PKI、SQL 备份/恢复凭据输出必须双向不重叠；不要把它放进
普通备份树或支持包目录，也不要在日志中打印完整 URL、路径或 signing key。

完整目标 URL（含路径）及 HMAC key 加密存于独立文件；SQL backup 只含通知的 opaque
引用与非秘密配置，不导出文件 vault 或 key。运行 backup/restore CLI 时需提供相同
`TUNEX_NOTIFICATION_SECRETS` 环境，工具才可在创建输出前后拒绝 symlink/重叠路径；
直接调用库函数则传 `notificationSecretsDirectory`。未声明的 vault 无法自动发现。
普通 SQL 恢复不等于恢复通知凭据，独立文件的保管需另行受保护运维流程。

SQL/file stage 不是跨存储原子提交，回滚可能留下 orphan；4096 全局/32 endpoint entry
额度包含 temp 与 hardlink，最多清理 16 个超过 24 小时且非 current/new ref 的同
endpoint 单链接文件；损坏或 crash 双链接遗留可能导致容量拒绝。独占 `writer.lock`
在崩溃后不自动解除，须停写并审阅后人工维护，不应盲删锁或重建 key。0030 初片仅保护
head ref；下述 0031 已有活动发送 lease pins，配合 revision fence；队列不存旧 ref。

正式 restore 的原 quarantine 事务保留配置/ref/revision/计数/审计并将全部端点置为
recovery suspended；新 Authority binding 不能解密旧绑定，review/resume 后仍需显式
重新发布、增加 credentialRevision；不会自动解密、回放或发送。不要清 Authority、
Agent Journal/high-water 或删除密钥绕过恢复。

本片源码未运行任何检查、测试、脚本、容器、网络或 CI 验收；未提交/推送，不构成 D3、
投递可用性、文件系统竞态防御或生产安全门禁已通过的声明。

## 11. D3-B2 Durable Webhook Outbox / Schema 0031

该切片 Control Profile 为 `adp3-notification-deliveries-v1` / Schema 0031，当时目录 31 项、
末项 `0031-notification-deliveries.sql`。新四表分别维护 Scope loss counters、delivery
队列、attempt 明细与 endpoint rate head；Agent Profile、ADP、Journal 与 Runtime
不变。旧 Control 即使没有启用投递也不能回退读取新 Schema。

`TUNEX_WEBHOOK_DELIVERY` 默认 0，显式设 1 才启用独立自动投递；此时必须配置并预置
第 10 节的独立 `TUNEX_NOTIFICATION_SECRETS`，否则启动失败，不能使用 Authority key
代替。默认 Compose 未启用 vault env/bind，不会因示例增加 flag 就自动具备凭据。
端点 metadata GET/禁用在未配置 vault 时仍可用；GET 不启动观察、发送或 URL 测试。
独立非重入循环每秒最多处理一项，不复用 Runtime worker；`worker:false` 关闭自动
循环，不替代调用者对内部显式 service 的控制。

只路由新 station event，无历史补发。每 Scope 最多 1024 delivery（含 terminal）与
256 attempt 明细；七天仅清 terminal，容量只淘汰 terminal，pending/claimed/retry-wait
满额则拒收该 recipient 并持久记录 loss，不回滚源事件。attempt 明细淘汰不重置 head
attemptCount；不同 loss 的 event/recipient/row 单位不能混算。稳定 event+endpoint
去重仅覆盖保留记录；不承诺永久去重或完整投递日志。

事件一小时过期，最多六次 claim；claim 30 秒，重试从 30 秒退避至最多五分钟，
endpoint 持久 minimum interval 至少十秒，每 Scope active claim 最多二。claim 先
提交再发网络，expired claim 属于 unknown，而不是证明没发送；finish 按 fence/期限
拒绝旧结果。HTTP 2xx 不是业务成功或 Exactly Once，不保证严格顺序，接收端必须按
稳定 delivery ID 处理不确定重复。

发送前重读当前授权/策略/端点 revision，旧 endpoint/credential revision 的任务取消，
不使用新凭据改投旧任务。队列不持久化旧 credential ref；活动 lease pins 到 DNS/socket
真实退出才释放，GC 同时保护 current/new ref 与 pins。五秒发送预算不能取消底层全部
DNS，关闭可能继续等待 DNS drain；需要同步 host clock 和受控运维停机，不应盲删锁。
队列状态与 DNS/HTTPS 执行分离，网络不持有 SQL 事务，通知失败不改变 Forward 部署状态。

恢复原 quarantine 事务 sticky 标记全部 delivery；pending 状态 cancelled、revision+1、
清 claim/nextAttemptAt，被中断 claim/pending attempt 记 unknown/RECOVERY_SUSPENDED。
已有 terminal 接受证据不改写，限速 head 保留；revision 耗尽则恢复失败需人工审阅。
端点重新发布不会复活旧取消记录；不 replay/backfill，不清安全高水位。

本批没有实际 DNS/HTTPS 调用或测试、静态/类型/语法/格式检查、脚本、CI、容器验收与
提交/推送；flag/源码接线不是活性、安全、全 D3 完成或生产就绪证据。

## 12. D1 Durable Probe Runs / Schema 0032

该切片 Control 源码目标 `adp3-probe-runs-v1` / Schema 0032，目录32项、末项
`0032-probe-runs.sql`。新两表仅保存原许可 owner 的同事务历史摘要和 loss counters，
没有新的 Probe 执行 flag、自动排程、网络测试或健康权威；Agent Profile、ADP、
Journal 与原授权链不变。关闭既有 Probe 执行不撤销已应用 Schema，旧 Control reader
仍拒绝0032；升级继续维护、备份与 DDL/部分表 footprint 审阅。

原许可仍两秒、全局256预算及原 prune/result cascade；独立 archive 没有到 permit、
Forward 或 Node 的 cascade FK。每 Scope 最多1024 run，issuedAt 七天仅新追加时
惰性清理最多16条，满额淘汰最老任意状态一条。分别暴露 rowsExpired/rowsEvicted/
updatesWithoutHead，后续更新缺 head 不重建；不声称完整历史或准时 TTL。原规则删除
后仍可在所属 Scope 保留窗口内 manager 查询；查询不依赖当前 Forward 存在、不发起
Probe、不退款原预算、不用旧成功冒充当前结果。

只捕获新 issue/consume/revoke/withdraw/result，保留安全实例 binding、actor、生命周期
和结果标量，不存 fingerprint、requestId、原 body、目标地址或配置，不 catch-up。
缺结果为未收到，connected/unreachable 是原 Direct TCP 观测口径，不代表入口、TLS、
UDP 或业务端到端健康。持久计划、其他 Probe 类别及自动路由仍属独立后续范围。

正式恢复在原 quarantine 事务中仅 sticky 标记历史、revision+1，不改历史原 state/
closedAt/withdrawnAt/result/updatedAt，不创建新 attempt 或执行资格。revision 达上限
则恢复失败需人工审阅；原许可隔离/withdrawal/budget clock 与 Authority/Journal 的
安全高水位仍由原 owner 保有，不允许删除归零绕过恢复，不自动补发。

该切片仅本地源码与文档，没有检查、测试、脚本、网络/MySQL/容器或 CI 验收及提交/
推送；不代表完整 D1、持久性/容量/恢复或生产安全门禁已通过。

## 13. Bounded Probe Plans / Schema 0033

该切片 Control 源码目标 `adp3-probe-plans-v1` / Schema 0033，目录33项、末项
`0033-probe-plans.sql`。Agent 仍只有原 runtime/multihop Profile，ADP、Journal 与
授权高水位不变。关闭开关不能撤销已应用 Schema；旧 Control reader 拒绝0033。
升级仍需维护、备份及 DDL/部分 footprint 审阅，不自动修复或盲目重放迁移。

计划仅存既有 Direct TCP Probe 配置、安全 origin binding 与有限决策，不是新的执行
许可。manual/scheduled、既有 Forward ID/expected revision/timeout、最多16次和不超过
一小时有效期均在创建时固定；scheduled 间隔30至3600秒。每次 issuance 仍走原
ForwardProbes/ProbePermits owner，重新检查当前授权、发布 binding 与实例；许可仍
不超过原两秒和计划期限，原全局预算、cooldown、prune 不退款或扩展。manager GET
只读，不发起连接，不把旧成功变为当前健康，health 仍 unknown。

`TUNEX_PROBE_SCHEDULE` 默认0。显式启用必须同时设置 `TUNEX_PROBE_EXECUTION=1` 与
`TUNEX_PROBE_CLOCK_SKEW_SECONDS=1`，且操作员实际验证主机时钟同步；flag 不是时钟
或活性证明。调度只处理有界到期候选，每次最多一次原 owner issuance，不补跑错过的
周期。领域拒绝也消费一个有限决策槽；SQL、integrity 与 clock 错误整事务退出，不记
虚假拒绝。未知 commit 后只据同事务持久 plan decision/permit/idempotency 审阅，不
生成 child key 或重发新许可。既有发行开关关闭不撤销已产生的原许可。

每 Scope 最多32条计划，含 terminal。仅新建时先终结已到期 active，然后最多清16条
createdAt 已过七天的 terminal，满额仅淘汰最老 terminal 一条；没有 terminal 则拒新，
不驱逐有效 active。loss 分别为 rowsExpired/rowsEvicted/decisionsEvicted，不声称完整
历史或准点 TTL。三张自有表不引用 permit、Forward、Node 或 Scope 原业务表，不因
原短许可或业务对象删除而 cascade 清除；decision 仅随自有 plan 淘汰清理。

正式 recovery 在原 quarantine 事务中 sticky 标记全部计划并对首次标记 revision+1；
active 改 suspended/RECOVERY_SUSPENDED，nextRunAt 清零。既有 terminal/cancel/decision/
accepted probe IDs 保留，不伪造 attempt、不清 loss、不退款原预算、不自动恢复排程。
revision 耗尽使整个恢复事务失败，需人工审阅，不能跳过或归零安全历史。

本片仅本地源码及文档编辑；没有检查、测试、类型/语法/静态/格式验证、脚本、网络、
MySQL、容器、CI 或提交/推送。不能作为调度活性、并发、恢复、完整 D1 或生产验收。

## 14. Typed Local Ingress Probe / Schema 0034

当前 Control 源码目标 `adp3-typed-probes-v1` / Schema 0034，目录34项、末项
`0034-typed-probes.sql`。Agent compatibility Profile 仍只有原 runtime/multihop，
Probe v2 是单独明确协商的机器契约，不扩大旧 v1 strict parser 或 ADP/Journal。
旧 Control reader 拒绝0034；关闭 ingress flag 不能撤销 Schema，继续维护、备份及
DDL/部分 footprint 审阅，不改旧迁移文件或以启动迁移自动修复部分 Schema。

原 `tcp-connect` / `agent-direct-egress` 保持旧含义。新测量为独立
`tcp-ingress-connect-v1`，kind `tcp-ingress-connect`，point
`agent-local-direct-ingress`，capability `probe.tcp-ingress-connect.v1`。
它只从明确 Agent 观测点连接本机当前 Direct TCP 的具体 IP-literal listener，
不接受任意 host/port，不把 wildcard 自动改 loopback，不做 DNS、TLS、nonce echo、
UDP、Relay、多跳或外部公网入口测试。TCP connect 不证明业务响应或当前健康。
连接现有监听可能触发原业务引擎按既有授权拨下游目标；零 Probe 应用 payload 不等于
整个原转发引擎没有网络副作用，不声称新健康或外部可达性。

Control `TUNEX_PROBE_INGRESS` 默认0；启用要求原 `TUNEX_PROBE_EXECUTION=1` 与明确
`TUNEX_PROBE_CLOCK_SKEW_SECONDS=1`。Agent `--probe-ingress` 默认false，Compose 使用
`TUNEX_PROBE_AGENT_INGRESS`，仍须同时开启原 registration/execution。flag 不证明
时钟同步或执行活性。新 qualification 只证明同一个当前原 instance/Gate 支持明确
类型，不分配第二个 slot、不刷新原30秒实例、不新建预算；撤销或 quarantine 的同一
身份不能重臂。每次仍重新检查原实例/credential/session/binding/目标和监听政策。

新旧许可共用原全局256、并发/cooldown、单次消费与两秒截止；旧 v1 poll 不分发新
类型，新 v2 可明确描述两种类型。旧结果与 v2 typed result 均按实际 wire version
严格解析和比对 permit 分类，不把旧许可在 v2 上报误标成 ingress。history 在原
`probe_runs` 捕获 optional ingress classification，旧记录对象/摘要不新增键，旧
SQL 行明确 default egress；新行和 Console 使用实际 kind/point，不重贴旧标签。
原1024/七天有限保留/loss不变。旧 Probe telemetry v1 明确仍只计 egress，新 ingress
排除在旧累计中，不能把旧指标当成新类型的执行或健康统计。

恢复在原 quarantine 事务将 qualified proof 改 quarantined，保留时间、原实例代次
和身份；empty/revoked/quarantined 不重新激活。原 permit owner 仍管理实际隔离与
withdrawal/budget，Run history 只 sticky 标记；不退款、不自动重发、不抹安全高水位。

本片仅源码与文档编写，未运行测试、检查、语法/类型/静态/格式验证、脚本、生成器、
网络、MySQL、CI、容器、Git 或浏览器。D1 其余类型、健康聚合与 C3 前置验收仍开放，
不能据此开启自动切换或声称生产可用。
