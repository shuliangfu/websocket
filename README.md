# @dreamer/websocket

> 一个兼容 Deno 和 Bun 的 WebSocket 工具库，提供完整的 WebSocket 服务器和客户端功能，支持实时双向通信、消息加密、房间管理、命名空间等高级特性

[![JSR](https://jsr.io/badges/@dreamer/websocket)](https://jsr.io/@dreamer/websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📋 目录

- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [安装](#-安装)
- [环境兼容性](#-环境兼容性)
- [核心概念](#-核心概念)
- [API 文档](#-api-文档)
- [使用示例](#-使用示例)
- [客户端使用](#-客户端使用)
- [消息加密](#-消息加密)
- [最佳实践](#-最佳实践)
- [测试报告](#-测试报告)
- [贡献指南](#-贡献指南)

---

## ✨ 功能特性

### 核心功能

- **🚀 跨运行时支持**：原生支持 Deno 和 Bun，无需 Node.js
- **🔌 WebSocket 服务器**：基于标准 WebSocket 协议，兼容所有 WebSocket 客户端
- **💬 实时双向通信**：支持文本和二进制消息的实时传输
- **🔐 消息加密**：内置 AES 加密支持（GCM/CBC 模式），自动加密/解密
- **🏠 房间管理**：灵活的房间系统，支持加入/离开、房间内广播
- **📦 命名空间**：支持多个命名空间，隔离不同业务场景
- **⚡ 心跳检测**：自动心跳机制，检测和清理无效连接
- **🛡️ 中间件系统**：强大的中间件支持，内置认证、日志、限流等中间件
- **📡 事件系统**：完整的事件驱动架构，支持自定义事件和回调

### 高级特性

- **🔄 自动重连**：客户端支持断线自动重连，多种重连策略
- **📨 消息队列**：客户端离线消息缓存和发送队列
- **🔑 密钥管理**：支持随机密钥生成、密码派生密钥、密钥轮换
- **📊 连接统计**：服务器连接数、房间统计等监控信息
- **🎯 类型安全**：完整的 TypeScript 类型支持

---

## 🚀 快速开始

### 服务端示例

```typescript
import { Server } from "jsr:@dreamer/websocket";

// 创建 WebSocket 服务器
const io = new Server({
  port: 8080,
  path: "/ws",
});

// 监听连接事件
io.on("connection", (socket) => {
  console.log("新连接:", socket.id);

  // 监听消息
  socket.on("message", (data) => {
    console.log("收到消息:", data);
    
    // 发送响应
    socket.emit("response", { status: "ok" });
  });

  // 断开连接
  socket.on("disconnect", (reason) => {
    console.log("连接断开:", reason);
  });
});

// 启动服务器
io.listen();
console.log("服务器运行在 ws://localhost:8080/ws");
```

### 客户端示例

```typescript
import { Client } from "jsr:@dreamer/websocket/client";

// 创建客户端
const client = new Client({
  url: "ws://localhost:8080/ws",
  autoReconnect: true,
});

// 连接成功
client.on("open", () => {
  console.log("已连接");
  
  // 发送消息
  client.emit("message", { text: "Hello" });
});

// 接收消息
client.on("response", (data) => {
  console.log("收到响应:", data);
});
```

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

| 环境 | 版本要求 | 状态 | 说明 |
|------|---------|------|------|
| **Deno** | 2.5+ | ✅ 完全支持 | 服务端和客户端 |
| **Bun** | 1.0+ | ✅ 完全支持 | 服务端和客户端 |
| **浏览器** | 现代浏览器 | ✅ 支持 | 仅客户端（通过 `@dreamer/websocket/client`） |

### 依赖

- `@dreamer/runtime-adapter` - 跨运行时兼容层
- `@dreamer/crypto` - 加密功能支持
- `@dreamer/logger` - 日志功能（可选）

---

## 🎯 核心概念

### Server（服务器）

`Server` 是 WebSocket 服务器的核心类，负责：
- 管理所有 WebSocket 连接
- 处理连接建立和关闭
- 管理房间和命名空间
- 执行中间件链

### Socket（连接）

`Socket` 表示一个 WebSocket 连接，提供：
- 消息发送和接收
- 事件监听和触发
- 房间管理（加入/离开）
- 数据存储（`socket.data`）

### Client（客户端）

`Client` 是 WebSocket 客户端类，提供：
- 连接管理
- 自动重连
- 消息队列
- 心跳检测

### Room（房间）

房间用于将连接分组，支持：
- 向房间内所有连接广播消息
- 动态加入/离开房间
- 房间状态查询

### Namespace（命名空间）

命名空间用于隔离不同的业务场景：
- 每个命名空间有独立的连接池
- 支持独立的中间件和事件处理
- 路径隔离（如 `/chat`, `/game`）

---

## 📚 API 文档

### Server

#### 构造函数

```typescript
new Server(options?: ServerOptions)
```

**选项**：

```typescript
interface ServerOptions {
  host?: string;              // 主机地址（默认：0.0.0.0）
  port?: number;              // 端口号
  path?: string;              // WebSocket 路径（默认："/"）
  pingTimeout?: number;       // 心跳超时（默认：60000ms）
  pingInterval?: number;      // 心跳间隔（默认：30000ms）
  maxConnections?: number;    // 最大连接数
  encryption?: EncryptionConfig; // 加密配置
}
```

#### 主要方法

- `listen(host?: string, port?: number): void` - 启动服务器
- `close(): Promise<void>` - 关闭服务器
- `on(event: "connection", listener: ServerEventListener): void` - 监听连接事件
- `use(middleware: Middleware): void` - 添加中间件
- `of(name: string): Namespace` - 创建或获取命名空间
- `getStats(): ServerStats` - 获取服务器统计信息

### Socket

#### 主要方法

- `emit(event: string, data?: any, callback?: Function): void` - 发送事件
- `on(event: string, listener: SocketEventListener): void` - 监听事件
- `off(event: string, listener?: SocketEventListener): void` - 移除监听器
- `join(room: string): void` - 加入房间
- `leave(room: string): void` - 离开房间
- `to(room: string): Socket` - 向房间发送消息（链式调用）
- `broadcast.emit(event: string, data?: any): void` - 广播消息
- `disconnect(reason?: string): void` - 断开连接
- `sendBinary(data: ArrayBuffer | Blob): void` - 发送二进制消息

#### 属性

- `id: string` - Socket 唯一标识
- `handshake: Handshake` - 握手信息
- `data: SocketData` - 数据存储对象
- `connected: boolean` - 连接状态

### Client

#### 构造函数

```typescript
new Client(options: ClientOptions)
```

**选项**：

```typescript
interface ClientOptions {
  url: string;                        // WebSocket 服务器 URL
  autoReconnect?: boolean;            // 自动重连（默认：true）
  reconnectInterval?: number;         // 重连间隔（默认：1000ms）
  maxReconnectAttempts?: number;      // 最大重连次数（默认：5）
  reconnectStrategy?: "exponential" | "fixed" | "linear"; // 重连策略
  pingInterval?: number;              // 心跳间隔（默认：30000ms）
  pingTimeout?: number;               // 心跳超时（默认：60000ms）
  query?: Record<string, string>;     // 查询参数
  protocols?: string[];               // 协议列表
  encryption?: EncryptionConfig;       // 加密配置
}
```

#### 主要方法

- `connect(): void` - 连接服务器
- `disconnect(): void` - 断开连接
- `emit(event: string, data?: any, callback?: Function): void` - 发送事件
- `on(event: string, listener: ClientEventListener): void` - 监听事件
- `off(event: string, listener?: ClientEventListener): void` - 移除监听器
- `sendBinary(data: ArrayBuffer | Blob): void` - 发送二进制消息

#### 事件

- `open` - 连接建立
- `close` - 连接关闭
- `error` - 连接错误
- `reconnect` - 重连成功
- `reconnect_failed` - 重连失败
- `binary` - 收到二进制消息
- 自定义事件

---

## 💡 使用示例

### 1. 基础服务器

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({ port: 8080 });

io.on("connection", (socket) => {
  console.log("连接:", socket.id);
  
  socket.on("message", (data) => {
    socket.emit("response", { echo: data });
  });
});

io.listen();
```

### 2. 房间管理

```typescript
io.on("connection", (socket) => {
  // 加入房间
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", { userId: socket.id });
  });

  // 房间内消息
  socket.on("room-message", ({ roomId, message }) => {
    socket.to(roomId).emit("room-message", {
      userId: socket.id,
      message,
    });
  });

  // 离开房间
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user-left", { userId: socket.id });
  });
});
```

### 3. 使用中间件

```typescript
import { Server, authMiddleware, loggerMiddleware } from "jsr:@dreamer/websocket";

const io = new Server({ port: 8080 });

// 认证中间件
io.use(
  authMiddleware(async (socket) => {
    const token = socket.handshake.query["token"];
    return token === "valid-token";
  })
);

// 日志中间件
io.use(loggerMiddleware());

io.on("connection", (socket) => {
  // 已通过认证的连接
  console.log("用户连接:", socket.data);
});
```

### 4. 命名空间

```typescript
// 默认命名空间
io.on("connection", (socket) => {
  socket.on("message", (data) => {
    // 处理默认命名空间的消息
  });
});

// 聊天命名空间
const chatNamespace = io.of("/chat");
chatNamespace.on("connection", (socket) => {
  socket.on("chat-message", (data) => {
    chatNamespace.emit("chat-message", data);
  });
});

// 游戏命名空间
const gameNamespace = io.of("/game");
gameNamespace.on("connection", (socket) => {
  socket.on("game-action", (data) => {
    socket.to(data.roomId).emit("game-action", data);
  });
});
```

### 5. 消息加密

```typescript
import { Server, EncryptionManager } from "jsr:@dreamer/websocket";

// 生成密钥
const key = EncryptionManager.generateKey("aes-256");

// 创建加密服务器
const io = new Server({
  port: 8080,
  encryption: {
    key,
    algorithm: "aes-256-gcm",
  },
});

io.on("connection", (socket) => {
  // 消息自动加密/解密
  socket.on("message", (data) => {
    // data 已自动解密
    socket.emit("response", { received: data });
  });
});
```

### 6. 二进制消息

```typescript
io.on("connection", (socket) => {
  // 监听二进制消息
  socket.on("binary", (data: ArrayBuffer) => {
    console.log("收到二进制数据:", data.byteLength);
    
    // 发送二进制响应
    socket.sendBinary(data);
  });

  // 发送二进制消息
  const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
  socket.sendBinary(binaryData.buffer);
});
```

### 7. 事件回调

```typescript
io.on("connection", (socket) => {
  socket.on("request", (data, callback) => {
    // 处理请求
    const result = processRequest(data);
    
    // 发送回调响应
    if (callback) {
      callback({ status: "success", result });
    }
  });
});
```

---

## 🌐 客户端使用

### 基础客户端

```typescript
import { Client } from "jsr:@dreamer/websocket/client";

const client = new Client({
  url: "ws://localhost:8080/ws",
  autoReconnect: true,
});

client.on("open", () => {
  client.emit("message", { text: "Hello" });
});

client.on("response", (data) => {
  console.log("收到响应:", data);
});
```

### 自动重连

```typescript
const client = new Client({
  url: "ws://localhost:8080/ws",
  autoReconnect: true,
  reconnectInterval: 2000,        // 2 秒重连间隔
  maxReconnectAttempts: 10,       // 最多重连 10 次
  reconnectStrategy: "exponential", // 指数退避策略
});

client.on("reconnect", () => {
  console.log("重连成功");
});

client.on("reconnect_failed", () => {
  console.log("重连失败");
});
```

### 客户端加密

```typescript
import { Client, EncryptionManager } from "jsr:@dreamer/websocket/client";

const key = EncryptionManager.generateKey("aes-256");

const client = new Client({
  url: "ws://localhost:8080/ws",
  encryption: {
    key,
    algorithm: "aes-256-gcm",
  },
});

// 消息自动加密/解密
client.on("open", () => {
  client.emit("secret", { message: "加密消息" });
});
```

---

## 🔐 消息加密

### 支持的算法

- **AES-256-GCM**（推荐）：提供认证加密，安全性最高
- **AES-128-GCM**：更快的加密速度，适合性能敏感场景
- **AES-256-CBC**：兼容性更好，但不提供认证
- **AES-128-CBC**：最快的加密速度

### 密钥管理

```typescript
import { EncryptionManager } from "jsr:@dreamer/websocket";

// 生成随机密钥
const key1 = EncryptionManager.generateKey("aes-256");
const key2 = EncryptionManager.generateKey("aes-128");

// 从密码派生密钥
const key3 = EncryptionManager.deriveKeyFromPassword(
  "my-password",
  "aes-256"
);

// 使用字符串密钥
const key4 = "my-secret-key-32-bytes-long!!!!!";
```

### 加密配置

```typescript
// 服务端
const io = new Server({
  port: 8080,
  encryption: {
    key: EncryptionManager.generateKey("aes-256"),
    algorithm: "aes-256-gcm",
    enabled: true, // 默认 true
  },
});

// 客户端
const client = new Client({
  url: "ws://localhost:8080/ws",
  encryption: {
    key: key, // 必须与服务端相同
    algorithm: "aes-256-gcm",
  },
});
```

### 混合加密场景

支持服务端和客户端分别配置加密：
- 服务端加密，客户端未加密：客户端收到加密消息（Base64 字符串）
- 服务端未加密，客户端加密：服务端收到加密消息
- 双方都加密：端到端加密通信

---

## 🎨 最佳实践

### 1. 错误处理

```typescript
io.on("connection", (socket) => {
  socket.on("error", (error) => {
    console.error("Socket 错误:", error);
    // 记录错误，但不立即断开连接
  });

  socket.on("disconnect", (reason) => {
    if (reason === "ping timeout") {
      console.log("心跳超时");
    } else if (reason === "transport close") {
      console.log("传输层关闭");
    }
  });
});
```

### 2. 连接限制

```typescript
const io = new Server({
  port: 8080,
  maxConnections: 1000, // 限制最大连接数
});

// 使用限流中间件
import { rateLimitMiddleware } from "jsr:@dreamer/websocket";

io.use(
  rateLimitMiddleware({
    maxConnections: 10,        // 每个 IP 最多 10 个连接
    maxMessagesPerSecond: 5,   // 每秒最多 5 条消息
  })
);
```

### 3. 数据验证

```typescript
io.on("connection", (socket) => {
  socket.on("user-action", (data) => {
    // 验证数据格式
    if (!data || typeof data.action !== "string") {
      socket.emit("error", { message: "无效的数据格式" });
      return;
    }

    // 处理有效数据
    handleUserAction(socket, data);
  });
});
```

### 4. 资源清理

```typescript
io.on("connection", (socket) => {
  const timers: number[] = [];

  socket.on("subscribe", (topic) => {
    const timer = setInterval(() => {
      socket.emit("update", getTopicData(topic));
    }, 1000);
    timers.push(timer);
  });

  socket.on("disconnect", () => {
    // 清理所有定时器
    timers.forEach(clearInterval);
  });
});
```

### 5. 性能优化

```typescript
// 批量操作
socket.join("room1", "room2", "room3");

// 使用房间广播而不是遍历所有连接
socket.to("room1").emit("message", data);

// 避免在循环中发送消息
const messages = [/* ... */];
for (const msg of messages) {
  socket.emit("message", msg); // ❌ 不推荐
}

// 批量发送
socket.emit("messages", messages); // ✅ 推荐
```

---

## 📊 测试报告

完整的测试报告请查看 [TEST_REPORT.md](./TEST_REPORT.md)

### 测试统计

- **总测试数**: 111
- **通过**: 111 ✅
- **失败**: 0
- **通过率**: 100%
- **测试环境**: Deno 2.6.4, Bun 1.3.5

### 测试覆盖

- ✅ Server 功能（9 个测试）
- ✅ Socket 事件系统（4 个测试）
- ✅ 房间管理（7 个测试）
- ✅ 命名空间（8 个测试）
- ✅ 中间件系统（12 个测试）
- ✅ 消息加密（56 个测试）
- ✅ 心跳检测（2 个测试）
- ✅ 错误处理（2 个测试）
- ✅ 跨运行时兼容（2 个测试）

---

## 📖 更多示例

查看 [examples](./examples/) 目录获取更多详细示例：

- `basic-server.ts` - 基础服务器示例
- `rooms-example.ts` - 房间管理示例
- `namespace-example.ts` - 命名空间示例
- `middleware-example.ts` - 中间件示例
- `heartbeat-example.ts` - 心跳检测示例
- `binary-message-example.ts` - 二进制消息示例
- `chat-app-example.ts` - 完整聊天应用示例
- `encryption-basic.ts` - 基础加密示例
- `encryption-binary.ts` - 加密与二进制消息
- `encryption-chat-app.ts` - 加密聊天应用
- `client-basic-example.ts` - 客户端基础示例

---

## 🔧 API 设计说明

### 类似 socket.io 的 API

@dreamer/websocket 采用类似 socket.io 的 API 设计，提供友好的开发体验：

- **事件驱动**：使用 `emit()` 和 `on()` 进行事件通信
- **房间管理**：使用 `join()` 和 `leave()` 管理房间
- **消息广播**：使用 `to()`、`broadcast.emit()` 进行消息广播
- **消息确认**：支持 callback 形式的消息确认（acknowledgments）
- **中间件支持**：服务端支持中间件处理连接

### 与 socket.io 的主要区别

- **跨运行时支持**：原生支持 Deno 和 Bun 运行时，无需 Node.js
- **更轻量**：不依赖 socket.io 的复杂协议，基于标准 WebSocket
- **TypeScript 原生**：完整的 TypeScript 类型支持
- **消息加密**：内置消息加密功能
- **二进制消息**：原生支持二进制消息传输

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: 添加新功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循项目代码风格
- 添加必要的注释
- 编写测试用例
- 更新文档

---

## 📄 许可证

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

## 🔗 相关链接

- [JSR 包页面](https://jsr.io/@dreamer/websocket)
- [测试报告](./TEST_REPORT.md)
- [示例代码](./examples/)
- [客户端文档](./src/client/README.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

[⭐ Star this repo](https://github.com/dreamer-team/websocket) | [📖 Documentation](./README.md) | [🐛 Report Bug](https://github.com/dreamer-team/websocket/issues)

</div>
