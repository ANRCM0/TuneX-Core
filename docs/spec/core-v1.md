# Core Specification v1

状态：**Accepted for implementation**。Core v1 是**最小领域语言**，不是数据库设计、HTTP DTO、网络执行器，也不是万能应用框架。

## 1. 实体及值对象

**两个具有身份与生命周期的实体**：

1. `Node`：一个经过独立注册与授权管理的网络执行资源。Core 可定义 `id`、`scopeId`、`revision`；Agent 能力、健康、心跳、安装及密钥生命周期在 Node Module，不写进 Node Core 对象。
2. `Forward`：有身份、归属、配置 revision 的网络转发**意图**。它不代表活跃 Socket、TCP 连接或传输 Link。

**三个可组合的基础值对象**：

1. `Endpoint`：区分 `ListenEndpoint`（监听地址与端口）和 `TargetEndpoint`（目标主机与端口）。
2. `PathSpec`：可选固定中间节点序列；空/缺省表示没有指定中间节点。
3. `TransportRef`：可选、不可歧义的传输配置引用。配置的解析、密钥和驱动不在 Core。

**公共原语**：`NodeId`、`ForwardId`、`ScopeId`、`Revision`、`NetworkProtocol`、`CapabilityId`。逻辑类型独立，持久化序列化可使用字符串；必须校验规范化 ID、非空、合法版本。

## 2. 参考 TypeScript 形状

```ts
type NetworkProtocol = "tcp" | "udp";
type NodeId = string;
type ForwardId = string;
type ScopeId = string;
type Revision = number;

interface Node {
  readonly id: NodeId;
  readonly scopeId: ScopeId;
  readonly revision: Revision;
}

interface Forward {
  readonly id: ForwardId;
  readonly scopeId: ScopeId;
  readonly revision: Revision;
  readonly spec: ForwardSpec;
}

interface ForwardSpec {
  readonly enabled: boolean;
  readonly protocols: readonly NetworkProtocol[];
  readonly ingress: {
    readonly nodeId: NodeId;
    readonly listen: ListenEndpoint;
  };
  readonly target: TargetEndpoint;
  readonly path?: PathSpec;
  readonly transport?: TransportRef;
}

interface ListenEndpoint { readonly address: string; readonly port: number; }
interface TargetEndpoint { readonly host: string; readonly port: number; }
interface PathSpec { readonly via: readonly NodeId[]; }
interface TransportRef {
  readonly profileId: string;
  readonly configRevision: number;
}
```

`configRevision` 锁定 Transport Profile 的版本：更改 Profile 的设置必须产生新版本或明确的新部署代次，避免 Forward 意图引用的安全要求在不知情时改变。示例形状须通过运行时解析器检查，TS 类型不是信任边界。

## 3. Core 不变量（仅依赖自身输入）

- Forward 必须有非空 ID/Scope、合法正整数 Revision；成功变更 Revision 单调递增，ID 不复用由持久层负责。
- `protocols` 在规范化后只能是 `tcp`、`udp` 的非空无重复集合，序列化顺序固定（tcp、udp）。
- 监听、目标端口是 1..65535 整数；默认**不**支持端口范围、多端口复合规则。
- Listen 地址必须符合监听语义（IP 字面量，支持 0.0.0.0/::；地址族与绑定规则由 Runtime 最终确认）。Target 可为 IP 字面量或合规主机名；未指定地址 0.0.0.0/:: 不得作为目标；不强制阻止私网/回环地址，访问策略在 Application/Agent。
- 入口 `nodeId` 不得出现在 `path.via`；`via` 不得有重复 ID。Core 仅检查固定路径的结构，节点是否存在/可达由外层判断。
- `path.via` 非空时，v1 要求显式、版本锁定的 `transport`；没有中间节点时 `transport` 缺省表示 `direct/native`。有 profile 但无中间节点的特殊能力由后续 ADR 另行定义，v1 禁止。
- `enabled` 是**期望**，不等于已应用与健康。
- 每次合法配置修改使用 CAS 语义：输入预期旧 Revision，得到新 Revision 的不可变对象。真正的原子性由数据库条件写保证。

## 4. Core 必须提供的最小 API

```ts
parseForwardSpec(input: unknown): Result<ForwardSpec>;
validateForwardSpec(spec: ForwardSpec): ValidationResult;
decideForwardChange(
  current: Forward,
  expectedRevision: Revision,
  change: ForwardChange
): Result<Forward>;
```

`ForwardChange` 是显式的受控变更请求，不接受客户端直接覆盖服务端管理的 `id/scopeId/revision`。删除与墓碑是 Application/Runtime 的生命周期，Core 可定义变更语义但不负责清理。

## 5. Core 严禁出现

Prisma、数据库连接、HTTP Client、Hono 路由、Redis、BullMQ、TCP/UDP socket、文件系统、加密密钥与证书、外部命令、运行时重试、Deployment Controller、路径搜索算法、账单/通知/监控具体实现、依赖外部状态的全局单例。

## 6. 规则划分

- Core：形状、规范化、基本配置不变量、纯状态变更。
- Application：权限、作用域、配额、节点能力、端口预留、Profile 是否存在与已授权、并发 CAS。
- Runtime：Assignment 编译、部署阶段、恢复、重试、资源执行所有权。
- Agent：证书/会话校验、配置世代与防重放、实际 bind、驱动能力、监听与数据面安全。

## 7. 反膨胀门槛

新功能若只改变“怎样转发”，应进入 Module/Driver；只有改变“转发是什么”的最小语义、且无法通过组合表达，才允许修改 Core。不得用多层类继承建构不同 Forward 子类。Core 的所有规则必须在无 MySQL/Redis/Agent 的单元测试中可验证。

