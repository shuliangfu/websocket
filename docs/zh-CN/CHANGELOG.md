## [1.1.0] - 2026-07-23

### 新增

- **Node.js 22+ 兼容**：本包现可在 Deno、Bun、Node.js 22+ 上运行，通过
  @dreamer/runtime-adapter 提供统一 API。
  - **MongoDB 适配器懒加载**：`src/adapters/mongodb.ts` 在 `connectMongoDB()`
    内改用动态 `await import("mongodb")`，取代顶层 import，使 mongodb npm 包不再
    经 `adapters/mod.ts` → `src/mod.ts` 静态 re-export 链被 eager 加载。避免 Bun
    模块加载失败与 Node 无谓安装（同 queue / socket-io / session 模式）。Redis 适配器
    本就已懒加载。
  - **`serve()` 改为 await**：`Server#listen()` 现对 runtime-adapter 的 `serve()`
    调用加 `await`。Node 下 `serve()` 返回 `Promise<ServeHandle>`（端口绑定异步完成），
    不 await 会使 `this.httpServer` 为 Promise、`shutdown()` 失败（同 socket-io / upload）。
  - **Node.js 工具链**：新增 `package.json`（engines.node>=22、`test:node` 走 tsx）、
    `tsconfig.json`（module ESNext / moduleResolution Bundler）、`.npmrc`（@jsr registry）。
  - **9 作业 CI 矩阵**：Deno 2.9 / Bun 1.3 / Node 22 × Linux、macOS、Windows。

### 变更

- **依赖**：升级 `@dreamer/i18n` 至 `^1.1.2`、`@dreamer/test` 至 `^1.2.3`、
  `@dreamer/crypto` 至 `^1.1.0`、`@dreamer/runtime-adapter` 至 `^1.2.2`、
  `@dreamer/logger` 至 `^1.1.0`。
- **集成测试拆分**：`tests/adapters-mongodb.test.ts` 与 `tests/adapters-redis.test.ts`
  （需在线 MongoDB / Redis）移至 `test:integration` 任务；CI 仅运行 14 个单元测试文件。
- **Locale 锁定**：`tests/logger-debug-i18n.test.ts` 显式锁定
  `setWebSocketLocale("en-US")`，因其断言英文 `$tr` 文案，确保任何 CI/开发机 locale 下
  确定性通过。
- **Lint 范围**：仅 `deno lint src/`（既有测试 lint 债务不计）。

### 兼容性

- Deno 2.9+、Bun 1.3+、Node.js 22+

### 测试

- Deno 158 / Bun 143 / Node 143（0 失败）。Deno 原生 runner 对相同文件会计更多 step
  （嵌套 step 计数差异）。

---

## [1.0.7] - 2026-06-26

### 修复

- **Deno WebSocket 升级（`handleUpgrade`）**：在 `upgradeWebSocket()`
  前读取握手信息，同步返回原始 101 响应，并通过 microtask 延迟创建 Socket
  与中间件/connection 事件。修复配合 `@dreamer/runtime-adapter@1.0.19` 时的
  `Upgrade response was not returned
  from callback` 及 `connection`
  不触发问题。
- **测试**：`encryption.test.ts` 中定时器句柄改为
  `ReturnType<typeof setInterval>`（兼容 Deno `Timeout` 类型）。

### 新增

- **`Server.prepare()`**：挂载模式下在首条 WebSocket 升级前异步预初始化适配器
  （subscribe/init）。

### 变更

- **依赖**：升级 `@dreamer/runtime-adapter` 至 `^1.0.19`，`@dreamer/logger` 至
  `^1.0.3`，`@dreamer/test` 至 `^1.1.8`。

---

## [1.0.6] - 2026-02-20

### 新增

- **客户端自包含**：新增
  `src/client/encryption.ts`、`src/client/message.ts`、`src/client/client.ts`。客户端加密与消息解析/序列化现均在
  `src/client/` 下，仅使用
  `@dreamer/crypto/client`，客户端入口不依赖服务端或根模块，适合浏览器打包。

### 变更

- **客户端入口**（`src/client/mod.ts`）：改为 barrel，仅从
  `./types.ts`、`./encryption.ts`、`./message.ts`、`./client.ts`
  再导出；客户端逻辑已迁至 `client.ts`。
- **服务端加密**（`src/encryption.ts`）：从 `@dreamer/crypto/client` 引入
  `decrypt`/`encrypt`，与客户端一致并避免打包带入 i18n。

---

## [1.0.5] - 2026-02-20

### 变更

- i18n：模块加载时自动初始化（不再导出 `initWebSocketI18n`）。依赖：bump
  @dreamer/crypto、@dreamer/test、@dreamer/runtime-adapter、@dreamer/logger。

---

# 变更日志

本项目的所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.4] - 2026-02-19

### 变更

- **i18n**：翻译方法由 `$t` 重命名为 `$tr`，避免与全局 `$t`
  冲突。请将现有代码中本包消息改为使用 `$tr`。

### 修复

- **测试**：`logger-debug-i18n.test.ts` 改为使用 `$tr`。MessageQueue onError
  测试现同时接受英文与中文文案（locale 可能由环境为 en-US 或 zh-CN）。

---

## [1.0.3] - 2026-02-18

### 移除

- **`tr` 方法及所有引用**：服务端与中间件不再提供或使用 `tr`，i18n 仅通过
  `$t(key, params, lang)` 配合 `options.lang` 使用。
- **客户端 `t` / `lang` 选项**：客户端错误信息改为固定英文，不再提供翻译接口。
- **适配器选项 `t`**：适配器类型与实现直接使用包内 `$t`，适配器选项中的可选 `t`
  回调已移除。

### 变更

- **中间件**：auth、logger、rateLimit 中 `socket.getServer()?.tr?.(...)` 改为
  `$t(..., socket.getServer()?.options?.lang)`。
- **Socket**：在构造函数中通过 `setWebSocketLocale(server.options.lang)` 设置
  语言；Socket 内所有 `$t` 调用不再传 lang，使用当前 locale。
- **MessageQueue**：使用
  `$t("log.websocket.messageSendFailed", { error }, server?.options?.lang)`。
- **MongoDB 适配器**：副本集错误分支中移除未使用变量。

### 修复

- **测试**：MessageQueue onError 断言改为期望英文 "Message send
  failed"；logger/auth i18n 相关测试描述更新（不再引用 `server.tr`）。

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
