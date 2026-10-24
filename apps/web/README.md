# Web Console

Control 在同源 HTTPS `/console` 提供控制台。浏览器层通过公共请求与产品命令入口
访问原 owners，不拥有 Runtime、额度扣减或执行权威。

## 当前功能

- 私有节点、共享资源授权、成员管理和本人 Token 轮换。
- Direct／Relay／多跳线路、Forward、Operation、固定意图批次和不确定结果核对。
- 原 Journal 派生的额度用量、诊断／Telemetry、显式受控 Echo 和最近历史样本告警。
- 导航向导、显式有限刷新和页面／账号切换时的旧响应隔离。

Token 和一次性凭据只保存在当前页面内存，不写 localStorage、sessionStorage、URL
或 cookie。离开页面清除秘密并隔离旧响应。未知写结果使用原键／原请求核对，
不自动生成新请求重做；Node 注册不因此获得新的持久幂等语义。

额度剩余是样本时保守上界，不是执行授权；Operation 成功不代表独立业务探测成功。
最近路径条件评估接受的历史样本，不签发新 Probe，也不从单次样本计算实时丢包率。
有限读取最多六轮，按原页面／账号／可见性／错误／取消边界停止，不自动恢复写操作。

## 开发与验证

命令 owner 与 native view/effects 的边界见
[Web 模块边界](../../docs/architecture/rule-command-owner-native-v1.md)和
[请求 owner](../../docs/architecture/console-request-native-v1.md)。
固定资产入口在原 server 组合；新增脚本需同步资产映射、安全头和源码分类。
Web／HTTP 契约与 Actions 中实际 Chromium 场景的准确范围见
[验证状态](../../docs/testing/verification-status.md)。
