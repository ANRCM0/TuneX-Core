# TuneX VNext

基于 Control（Node.js / MySQL）和独立 Go Agent 的 TCP/UDP Direct + TLS 1.3 Relay 转发系统。当前为 **Dev 测试版本**，不兼容旧 V2 数据库与 Agent。

## 快速部署（Docker / 1Panel）

准备 Linux + Docker Compose v2、**外部 MySQL 8.4**、可信的 Control CA/HTTPS 证书和持久化目录。先从 [GitHub Actions 镜像发布](.github/workflows/images.yml) 的成功运行中取得两张镜像的完整 `@sha256:` Digest，将 `TUNEX_*` 变量保存在主机本地、权限受限的环境文件里。

**Control 主机（已完成首次 Authority 初始化）：**

```bash
docker compose --env-file /secure/tunex-control.env -f deploy/compose.control.example.yaml config --quiet
docker compose --env-file /secure/tunex-control.env -f deploy/compose.control.example.yaml up -d control
```

**Agent 主机（已完成一次性 Enrollment）：**

```bash
docker compose --env-file /secure/tunex-agent.env -f deploy/compose.agent.example.yaml config --quiet
docker compose --env-file /secure/tunex-agent.env -f deploy/compose.agent.example.yaml up -d agent
```

两个 Compose 模板**分别部署在对应主机**；Agent 使用 `host` 网络模式。首次部署不能跳过 Authority 初始化、Owner 创建、Node Enrollment 和证书信任配置，也不能用空目录覆盖旧状态。

**→ [完整部署与测试文档（首次初始化、节点注册、1Panel、Relay、备份恢复）](deploy/README.md)**

[后续开发目标](docs/development/next-milestones.md) · [设计与协议文档](docs/README.md)
