# 变更日志

本项目的所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.2] - 2026-02-18

### 变更

- **许可证**：许可证为 Apache 2.0。
- **ServerOptions**：移除可选 `t?(key, params)`，改为
  `lang?: "en-US" | "zh-CN"`。服务端使用包内 i18n；构造时设置 `lang` 可固定
  语言，不设置则按环境变量 LANGUAGE/LC_ALL/LANG 检测。

### 新增

- **i18n（源码）**：服务端集成 `@dreamer/i18n`。入口调用 `initWebSocketI18n()`
  加载 en-US/zh-CN；`Server#tr()` 使用包内 `$t()`。
  文案文件：`src/locales/en-US.json`、`src/locales/zh-CN.json`，覆盖
  `log.websocket.*`、`log.adapterRedis.*`、`log.adapterMongo.*`、
  `log.websocketClient.*`（如 connectionEstablished、authFailed、authError
  等）。
- **文档**：按语言拆分为 `docs/en-US` 与 `docs/zh-CN`。完整 README、CHANGELOG、
  TEST_REPORT、客户端 README 中英双语文档；根目录 README 精简为入口与链接。
- **TEST_REPORT**：`docs/zh-CN/TEST_REPORT.md` 完整中文翻译。

### 更新

- **测试**：`logger-debug-i18n.test.ts` 改为使用 `lang: "en-US"` 替代 `t`，
  断言与包内翻译一致。

---

## [1.0.1] - 2026-02-08

### 修复

- **Windows CI 兼容性**：使用 `port: 0` + `server.getPort()` 替代
  `getAvailablePort()`，修复 Windows CI 上的端口冲突（PermissionDenied
  10013、AddrInUse 10048）

---

## [1.0.0] - 2026-02-06

### 新增

首个稳定版。WebSocket 工具包，包含服务端与客户端支持，兼容 Deno 和
Bun。实时双向通信、房间管理、命名空间、消息加密、分布式适配器。

（完整特性列表见 [en-US CHANGELOG](../en-US/CHANGELOG.md)）
