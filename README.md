# @dreamer/websocket

> 一个兼容 Deno 和 Bun 的 WebSocket 工具库，提供 WebSocket 服务器功能，支持实时双向通信

[![JSR](https://jsr.io/badges/@dreamer/websocket)](https://jsr.io/@dreamer/websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 功能

WebSocket 工具库，用于构建实时通信应用、推送服务、在线协作等场景。

---

## ✨ 特性

- **跨运行时 WebSocket API**：
  - 兼容 Deno 和 Bun 的原生 WebSocket 服务器支持
  - 统一的 WebSocket API 抽象层
- **连接管理**：
  - 连接建立和关闭处理
  - 连接状态追踪
  - 连接池管理
  - 连接数限制和流量控制
- **消息处理**：
  - 文本消息（UTF-8）
  - 二进制消息（ArrayBuffer、Blob）
  - 消息序列化/反序列化（JSON）
  - 消息路由和分发
- **房间管理**：
  - 房间创建和销毁
  - 用户加入/离开房间
  - 房间内消息广播
  - 房间状态查询
- **心跳检测**：
  - 自动心跳发送
  - 连接超时检测
  - 断线重连支持
- **中间件系统**：
  - 使用通用中间件系统
  - WebSocket 专用中间件适配器
  - 支持认证、日志、限流等中间件
- **事件系统**：
  - 连接事件（connect、disconnect、error）
  - 消息事件（message、ping、pong）
  - 自定义事件支持
  - 事件回调（acknowledgments）

---

## 🎨 设计原则

**所有 @dreamer/* 库都遵循以下原则**：

- **主包（@dreamer/xxx）**：用于服务端（兼容 Deno 和 Bun 运行时）
- **客户端子包（@dreamer/xxx/client）**：用于客户端（浏览器环境）

这样可以：
- 明确区分服务端和客户端代码
- 避免在客户端代码中引入服务端依赖
- 提供更好的类型安全和代码提示
- 支持更好的 tree-shaking

---

## 🎯 使用场景

- **实时通信**：聊天应用、在线客服、实时通知
- **推送服务**：消息推送、状态更新、数据同步
- **在线协作**：协同编辑、实时白板、多人游戏
- **监控和日志**：实时日志流、系统监控、性能指标
- **IoT 应用**：设备控制、数据采集、远程监控

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/websocket
```

### Bun

```bash
bunx jsr add @dreamer/websocket
```

---

## 🌍 环境兼容性

| 环境 | 版本要求 | 状态 |
|------|---------|------|
| **Deno** | 2.5+ | ✅ 完全支持 |
| **Bun** | 1.0+ | ✅ 完全支持 |
| **服务端** | - | ✅ 支持（兼容 Deno 和 Bun 运行时，WebSocket 服务器功能） |
| **客户端** | - | ✅ 支持（浏览器环境，通过 `jsr:@dreamer/websocket/client` 使用 WebSocket 客户端功能） |
| **依赖** | - | 📦 @dreamer/runtime-adapter（用于跨运行时兼容） |

---

## 🚀 快速开始

### 基础服务器

```typescript
import { Server } from "jsr:@dreamer/websocket";

// 创建 WebSocket 服务器
const io = new Server({
  port: 8080,
  path: "/ws",
});

// 连接建立事件
io.on("connection", (socket) => {
  console.log("新连接建立:", socket.id);

  // 监听自定义事件
  socket.on("chat-message", (data) => {
    console.log("收到聊天消息:", data);

    // 发送事件
    socket.emit("chat-response", {
      status: "success",
      message: "消息已收到",
    });
  });

  // 断开连接事件
  socket.on("disconnect", (reason) => {
    console.log("连接断开:", socket.id, reason);
  });

  // 错误事件
  socket.on("error", (error) => {
    console.error("连接错误:", error);
  });
});

// 启动服务器
io.listen();
console.log("WebSocket 服务器运行在 ws://localhost:8080/ws");
```

### 使用中间件

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

// 认证中间件
io.use(async (socket, next) => {
  const token = socket.handshake.query.token;
  if (!token || !isValidToken(token)) {
    return next(new Error("未授权"));
  }
  socket.data.user = await getUserByToken(token);
  next();
});

// 日志中间件
io.use(async (socket, next) => {
  console.log(`连接建立: ${socket.id} from ${socket.handshake.address}`);
  next();
});

// 连接处理
io.on("connection", (socket) => {
  console.log("用户连接:", socket.data.user.name);

  socket.on("chat-message", (data) => {
    // 处理消息
  });
});
```

### 房间管理

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

io.on("connection", (socket) => {
  // 加入房间
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`用户 ${socket.id} 加入房间 ${roomId}`);

    // 通知房间内其他用户
    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
    });
  });

  // 离开房间
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    console.log(`用户 ${socket.id} 离开房间 ${roomId}`);

    // 通知房间内其他用户
    socket.to(roomId).emit("user-left", {
      userId: socket.id,
    });
  });

  // 房间内消息广播
  socket.on("room-message", (data) => {
    const { roomId, message } = data;
    // 向房间内所有用户（除了发送者）广播消息
    socket.to(roomId).emit("room-message", {
      userId: socket.id,
      message: message,
    });
  });

  // 向所有连接广播
  socket.on("broadcast-message", (message) => {
    socket.broadcast.emit("broadcast-message", {
      userId: socket.id,
      message: message,
    });
  });
});
```

### 心跳检测

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
  // 心跳配置
  pingTimeout: 60000,  // 60 秒无响应则断开连接
  pingInterval: 30000, // 30 秒发送一次心跳
});

// 心跳检测自动处理，无需手动管理
io.on("connection", (socket) => {
  console.log("连接建立:", socket.id);

  socket.on("disconnect", (reason) => {
    if (reason === "ping timeout") {
      console.log("心跳超时，连接断开:", socket.id);
    } else {
      console.log("连接断开:", socket.id, reason);
    }
  });
});
```

### 事件处理和回调

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

io.on("connection", (socket) => {
  // 监听事件并支持回调
  socket.on("chat", (data, callback) => {
    const { roomId, message } = data;

    // 向房间广播
    socket.to(roomId).emit("chat", {
      userId: socket.id,
      message: message,
    });

    // 消息确认（callback）
    if (callback) {
      callback({ status: "success" });
    }
  });

  socket.on("notification", (data) => {
    // 处理通知
    handleNotification(socket, data);
  });
});
```

---

## 🌐 客户端支持

WebSocket 客户端支持请查看 [client/README.md](./src/client/README.md)。

---

## API 设计说明

### 类似 socket.io 的 API 设计

@dreamer/websocket 采用类似 socket.io 的 API 设计，提供更友好的开发体验：

- **事件驱动**：使用 `emit()` 和 `on()` 进行事件通信
- **房间管理**：使用 `join()` 和 `leave()` 管理房间
- **消息广播**：使用 `to()`、`broadcast.emit()` 进行消息广播
- **消息确认**：支持 callback 形式的消息确认（acknowledgments）
- **中间件支持**：服务端支持中间件处理连接

### 与 socket.io 的主要区别

- **跨运行时支持**：原生支持 Deno 和 Bun 运行时，无需 Node.js
- **更轻量**：不依赖 socket.io 的复杂协议，基于标准 WebSocket
- **TypeScript 原生**：完整的 TypeScript 类型支持
- **中间件系统**：集成 @dreamer/runtime-adapter，更灵活的中间件处理

---

## 📝 备注

- 支持使用中间件系统，可以灵活处理 WebSocket 连接
- 服务端和客户端都支持（客户端通过 `jsr:@dreamer/websocket/client`），可以构建完整的实时通信应用
- API 设计类似 socket.io，降低学习成本，提升开发体验
- 支持房间管理、心跳检测、自动重连、消息确认等高级功能
- 与 @dreamer/http 配合使用，可以在同一个应用中同时提供 HTTP 和 WebSocket 服务

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
