# 变更日志

本项目的所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.1] - 2026-02-08

### 修复

- **Windows CI 兼容性**：使用 `port: 0` + `server.getPort()` 替代 `getAvailablePort()`，修复 Windows CI 上的端口冲突（PermissionDenied 10013、AddrInUse 10048）

---

## [1.0.0] - 2026-02-06

### 新增

首个稳定版。WebSocket 工具库，包含服务端与客户端支持，兼容 Deno 和 Bun。实时双向通信、房间管理、命名空间、消息加密、分布式适配器。

（完整特性列表见 CHANGELOG.md）
