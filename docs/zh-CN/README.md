# @dreamer/websocket

> 一个兼容 Deno、Bun、Node.js 22+ 的 WebSocket 工具包，提供 WebSocket
> 服务器功能，支持实时双向通信

[English](../en-US/README.md) · 中文 (Chinese)

[![JSR](https://jsr.io/badges/@dreamer/websocket)](https://jsr.io/@dreamer/websocket)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)
[![Tests](https://img.shields.io/badge/tests-143%20passed%20(3%20runtimes)-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

WebSocket 工具包，用于构建实时通信应用、推送服务、在线协作等场景。

---

## ✨ 特性

- **跨运行时 WebSocket API**：
  - 兼容 Deno、Bun、Node.js 22+ 的原生 WebSocket 服务器支持
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
  - 可选批量心跳（`useBatchHeartbeat`），减少定时器数量
- **中间件系统**：
  - 使用通用中间件系统
  - WebSocket 专用中间件适配器
  - 支持认证、日志、限流等中间件
- **事件系统**：
  - 连接事件（connect、disconnect、error）
  - 消息事件（message、ping、pong）
  - 自定义事件支持
  - 事件回调（acknowledgments）
- **命名空间**：
  - 支持命名空间隔离不同业务场景
  - 每个命名空间独立的连接池和中间件
- **消息加密**：
  - 支持 AES-256-GCM、AES-128-GCM、AES-256-CBC、AES-128-CBC
  - 自动加密/解密
  - 密钥管理（随机生成、密码派生）
  - 混合加密场景支持
- **分布式适配器**：
  - 支持 Redis 适配器（Pub/Sub 模式）
  - 支持 MongoDB 适配器（Change Streams 或轮询模式）
  - 支持单节点副本集配置
  - 多服务器场景的消息广播和房间管理
  - 自动服务器注册和发现
- **日志与 i18n**：
  - 支持自定义 `logger`、`debug`、`t` 翻译函数
  - 与 @dreamer/server 一致的 debug 日志行为
- **性能优化**：
  - `MessageCache`：消息序列化缓存，FNV-1a 快速哈希
  - `MessageQueue`：广播入队（`useMessageQueue`），提供背压能力
  - `BatchHeartbeatManager`：批量心跳（`useBatchHeartbeat`），减少定时器
  - `getStats` 返回 messageQueue、messageCache 统计

---

## 🎨 设计原则

__所有 @dreamer/_ 包都遵循以下原则_*：

- **主包（@dreamer/xxx）**：用于服务端（兼容 Deno、Bun、Node.js 运行时）
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

### Node.js 22+

```bash
npx jsr add @dreamer/websocket
```

---

## 🌍 环境兼容性

| 环境       | 版本要求 | 状态                                                                                  |
| ---------- | -------- | ------------------------------------------------------------------------------------- |
| **Deno**   | 2.9+     | ✅ 完全支持                                                                           |
| **Bun**    | 1.3+     | ✅ 完全支持                                                                           |
| **Node.js**| 22+      | ✅ 完全支持                                                                           |
| **服务端** | -        | ✅ 支持（兼容 Deno/Bun/Node 运行时，WebSocket 服务器功能）                            |
| **客户端** | -        | ✅ 支持（浏览器环境，通过 `jsr:@dreamer/websocket/client` 使用 WebSocket 客户端功能） |
| **依赖**   | -        | 📦 @dreamer/runtime-adapter（用于跨运行时兼容）                                       |

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
import {
  authMiddleware,
  loggerMiddleware,
  Server,
} from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

// 认证中间件
io.use(
  authMiddleware(async (socket) => {
    const token = socket.handshake.query["token"];
    if (!token || !isValidToken(token)) {
      return false;
    }
    socket.data.user = await getUserByToken(token);
    return true;
  }),
);

// 日志中间件
io.use(loggerMiddleware());

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

### 命名空间

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

// 默认命名空间
io.on("connection", (socket) => {
  socket.on("message", (data) => {
    socket.emit("response", { message: "来自默认命名空间" });
  });
});

// 创建聊天命名空间
const chatNamespace = io.of("/chat");
chatNamespace.on("connection", (socket) => {
  socket.on("chat-message", (data) => {
    // 向聊天命名空间内所有用户广播
    chatNamespace.emit("chat-message", {
      userId: socket.id,
      message: data.message,
    });
  });
});

// 创建游戏命名空间
const gameNamespace = io.of("/game");
gameNamespace.on("connection", (socket) => {
  socket.on("game-action", (data) => {
    if (data.roomId) {
      socket.to(data.roomId).emit("game-action", {
        userId: socket.id,
        action: data.action,
      });
    }
  });
});
```

### 消息加密

```typescript
import { EncryptionManager, Server } from "jsr:@dreamer/websocket";

// 生成密钥
const key = EncryptionManager.generateKey("aes-256");

// 创建加密服务器
const io = new Server({
  port: 8080,
  path: "/ws",
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

### 心跳检测

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
  // 心跳配置
  pingTimeout: 60000, // 60 秒无响应则断开连接
  pingInterval: 30000, // 30 秒发送一次心跳
  // 可选：大量连接时使用批量心跳，减少定时器数量
  // useBatchHeartbeat: true,
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

### 客户端使用

```typescript
import { Client } from "jsr:@dreamer/websocket/client";

// 创建客户端
const client = new Client({
  url: "ws://localhost:8080/ws",
  autoReconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
});

// 连接成功
client.on("open", () => {
  console.log("已连接");
  client.emit("message", { text: "Hello" });
});

// 接收消息
client.on("response", (data) => {
  console.log("收到响应:", data);
});

// 断开连接
client.on("disconnect", (reason) => {
  console.log("断开连接:", reason);
});
```

### 分布式部署（适配器）

当需要部署多个 WebSocket
服务器实例时，需要使用分布式适配器来实现服务器间的消息同步。适配器负责：

- **消息广播**：将消息广播到所有服务器实例
- **房间管理**：同步房间成员信息
- **服务器发现**：自动注册和发现服务器实例

默认情况下，服务器使用内存适配器（单服务器模式）。对于多服务器部署，需要配置
Redis 或 MongoDB 适配器。

#### Redis 适配器

```typescript
import { RedisAdapter, Server } from "jsr:@dreamer/websocket";

// 创建使用 Redis 适配器的服务器
const io = new Server({
  port: 8080,
  path: "/ws",
  adapter: new RedisAdapter({
    connection: {
      host: "127.0.0.1",
      port: 6379,
    },
    keyPrefix: "ws",
    heartbeatInterval: 5, // 5 秒心跳
  }),
});

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    // 消息会自动广播到所有服务器实例
    io.broadcast("message", data);
  });
});

io.listen();
```

#### MongoDB 适配器

```typescript
import { MongoDBAdapter, Server } from "jsr:@dreamer/websocket";

// 创建使用 MongoDB 适配器的服务器
const io = new Server({
  port: 8080,
  path: "/ws",
  adapter: new MongoDBAdapter({
    connection: {
      host: "127.0.0.1",
      port: 27017,
      database: "websocket",
      // 副本集模式（推荐，使用 Change Streams）
      replicaSet: "rs0",
      directConnection: false,
    },
    keyPrefix: "ws",
    heartbeatInterval: 5, // 5 秒心跳
  }),
});

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    // 消息会自动广播到所有服务器实例
    io.broadcast("message", data);
  });
});

io.listen();
```

### 高并发优化（可选）

大量连接场景下，可启用 `useBatchHeartbeat` 和 `useMessageQueue`：

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
  // 批量心跳：减少定时器数量，适合 >1000 连接
  useBatchHeartbeat: true,
  // 广播入队：broadcast/emitToRoom 通过 MessageQueue 发送，提供背压
  useMessageQueue: true,
  messageQueue: {
    maxSize: 10000,
    batchSize: 100,
    processInterval: 10,
  },
  messageCache: {
    maxSize: 1000,
    ttl: 60000,
  },
});

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    io.broadcast("message", data); // 入队发送
  });
});

io.listen();
```

**适配器选择建议**：

- **单服务器**：无需配置适配器，使用默认内存适配器
- **多服务器 + Redis**：推荐使用 Redis 适配器，性能好，延迟低
- **多服务器 + MongoDB**：如果已有 MongoDB 基础设施，可使用 MongoDB 适配器
  - 副本集模式：使用 Change Streams，实时性好（推荐）
  - 单节点模式：自动降级到轮询，500ms 延迟

---

## 📚 API 文档

### Server

WebSocket 服务器类，管理所有连接和事件。

**构造函数**：

```typescript
new Server(options?: ServerOptions)
```

**选项**：

- `host?: string`: 主机地址（默认：0.0.0.0）
- `port?: number`: 端口号
- `path?: string`: WebSocket 路径（默认："/"）
- `pingTimeout?: number`: 心跳超时（默认：60000ms）
- `pingInterval?: number`: 心跳间隔（默认：30000ms）
- `maxConnections?: number`: 最大连接数
- `logger?: Logger`: 自定义 logger（默认使用 @dreamer/logger）
- `debug?: boolean`: 是否输出调试日志（默认：false）
- `t?: (key, params?) => string`: 翻译函数，用于 i18n
- `encryption?: EncryptionConfig`: 加密配置
- `adapter?: WebSocketAdapter`: 分布式适配器（Redis、MongoDB 或 Memory）
- `messageCache?: { maxSize?, ttl? } | false`: 消息序列化缓存配置（默认启用）
- `messageQueue?: { maxSize?, batchSize?, processInterval? } | false`:
  消息队列配置（默认启用）
- `useBatchHeartbeat?: boolean`: 是否使用批量心跳（默认：false）
- `useMessageQueue?: boolean`: 广播是否通过消息队列发送（默认：false）

**方法**：

- `listen(host?: string, port?: number): void`: 启动服务器
- `close(): Promise<void>`: 关闭服务器
- `on(event: "connection", listener: ServerEventListener): void`: 监听连接事件
- `use(middleware: Middleware): void`: 添加中间件
- `of(name: string): Namespace`: 创建或获取命名空间
- `getStats(): ServerStats`: 获取服务器统计信息

### Socket

WebSocket 连接类，表示一个客户端连接。

**方法**：

- `emit(event: string, data?: any, callback?: Function): void`: 发送事件
- `on(event: string, listener: SocketEventListener): void`: 监听事件
- `off(event: string, listener?: SocketEventListener): void`: 移除监听器
- `join(room: string): void`: 加入房间
- `leave(room: string): void`: 离开房间
- `to(room: string): Socket`: 向房间发送消息（链式调用）
- `broadcast.emit(event: string, data?: any): void`: 广播消息
- `disconnect(reason?: string): void`: 断开连接
- `sendBinary(data: ArrayBuffer | Blob): void`: 发送二进制消息

**属性**：

- `id: string`: Socket 唯一标识
- `handshake: Handshake`: 握手信息
- `data: SocketData`: 数据存储对象
- `connected: boolean`: 连接状态

### Client

WebSocket 客户端类，用于浏览器环境。

**构造函数**：

```typescript
new Client(options: ClientOptions)
```

**选项**：

- `url: string`: WebSocket 服务器 URL
- `autoReconnect?: boolean`: 自动重连（默认：true）
- `reconnectInterval?: number`: 重连间隔（默认：1000ms）
- `maxReconnectAttempts?: number`: 最大重连次数（默认：5）
- `reconnectStrategy?: "exponential" | "fixed" | "linear"`: 重连策略
- `pingInterval?: number`: 心跳间隔（默认：30000ms）
- `pingTimeout?: number`: 心跳超时（默认：60000ms）
- `query?: Record<string, string>`: 查询参数
- `protocols?: string[]`: 协议列表
- `encryption?: EncryptionConfig`: 加密配置

**方法**：

- `connect(): void`: 连接服务器
- `disconnect(): void`: 断开连接
- `emit(event: string, data?: any, callback?: Function): void`: 发送事件
- `on(event: string, listener: ClientEventListener): void`: 监听事件
- `off(event: string, listener?: ClientEventListener): void`: 移除监听器
- `sendBinary(data: ArrayBuffer | Blob): void`: 发送二进制消息

### EncryptionManager

消息加密管理器，提供消息加密和解密功能。

**静态方法**：

- `generateKey(type: "aes-256" | "aes-128"): Uint8Array`: 生成随机密钥
- `deriveKeyFromPassword(password: string, type: "aes-256" | "aes-128"): Uint8Array`:
  从密码派生密钥

**方法**：

- `encryptMessage(plaintext: string): Promise<string>`: 加密消息
- `decryptMessage(ciphertext: string): Promise<string>`: 解密消息
- `isEncrypted(message: string): boolean`: 判断消息是否已加密

### 中间件

内置中间件函数：

- `authMiddleware(validator: (socket: Socket) => boolean | Promise<boolean>): Middleware`:
  认证中间件
- `loggerMiddleware(logger?: Logger): Middleware`: 日志中间件
- `rateLimitMiddleware(options: { maxConnections?: number; maxMessagesPerSecond?: number }): Middleware`:
  限流中间件
- `corsMiddleware(options: { origin?: string | string[] | ((origin: string) => boolean) }): Middleware`:
  CORS 中间件

### 分布式适配器

#### RedisAdapter

Redis 分布式适配器，使用 Redis Pub/Sub 实现多服务器通信。

**构造函数**：

```typescript
new RedisAdapter(options: RedisAdapterOptions)
```

**选项**：

- `connection?: RedisConnectionConfig`: Redis 连接配置
  - `host?: string`: 主机地址（默认："127.0.0.1"）
  - `port?: number`: 端口号（默认：6379）
  - `url?: string`: Redis 连接 URL
- `keyPrefix?: string`: 键前缀（默认："ws"）
- `heartbeatInterval?: number`: 心跳间隔（秒，默认：5）

**示例**：

```typescript
import { RedisAdapter } from "jsr:@dreamer/websocket";

const adapter = new RedisAdapter({
  connection: {
    host: "127.0.0.1",
    port: 6379,
  },
  keyPrefix: "ws",
  heartbeatInterval: 5,
});
```

#### MongoDBAdapter

MongoDB 分布式适配器，使用 Change Streams 或轮询实现多服务器通信。

**构造函数**：

```typescript
new MongoDBAdapter(options: MongoDBAdapterOptions)
```

**选项**：

- `connection: MongoDBConnectionConfig`: MongoDB 连接配置
  - `url?: string`: MongoDB 连接 URL
  - `host?: string`: 主机地址
  - `port?: number`: 端口号（默认：27017）
  - `database: string`: 数据库名称
  - `username?: string`: 用户名
  - `password?: string`: 密码
  - `replicaSet?: string`: 副本集名称（用于单节点副本集）
  - `directConnection?: boolean`: 是否直接连接（默认：false，当使用副本集时）
- `keyPrefix?: string`: 键前缀（默认："ws"）
- `heartbeatInterval?: number`: 心跳间隔（秒，默认：5）

**示例**：

```typescript
import { MongoDBAdapter } from "jsr:@dreamer/websocket";

// 副本集模式（推荐，使用 Change Streams）
const adapter = new MongoDBAdapter({
  connection: {
    host: "127.0.0.1",
    port: 27017,
    database: "websocket",
    replicaSet: "rs0",
    directConnection: false,
  },
  keyPrefix: "ws",
  heartbeatInterval: 5,
});

// 单节点模式（自动降级到轮询，500ms 间隔）
const adapter = new MongoDBAdapter({
  connection: {
    host: "127.0.0.1",
    port: 27017,
    database: "websocket",
  },
  keyPrefix: "ws",
  heartbeatInterval: 5,
});
```

**说明**：

- **Change Streams**：需要 MongoDB 副本集，提供实时消息订阅（推荐）
- **轮询降级**：单节点模式下自动使用 500ms 轮询间隔
- **单节点副本集**：支持将单节点配置为副本集，启用 Change Streams

---

## ⚡ 性能优化

- **批量操作**：支持批量加入/离开房间，减少操作次数
- **房间广播**：使用房间广播而不是遍历所有连接，提高性能
- **心跳检测**：自动检测和清理无效连接，避免资源浪费
- **连接池管理**：高效的连接池管理，支持大量并发连接
- **异步操作**：所有操作都是异步的，不阻塞主线程
- **MessageCache**：消息序列化缓存，FNV-1a 快速哈希，LRU 驱逐
- **MessageQueue**：`useMessageQueue=true` 时 broadcast/emitToRoom
  入队发送，提供背压
- **BatchHeartbeatManager**：`useBatchHeartbeat=true`
  时集中管理心跳，减少定时器数量
- **批量发送**：大量连接时自动分批发送消息，避免阻塞
- **加密缓存**：缓存加密结果，避免重复加密
- **分布式优化**：支持 Redis 和 MongoDB 分布式部署，实现水平扩展

详细优化方案请参考 [OPTIMIZATION.md](../../OPTIMIZATION.md) 和
[OPTIMIZATION_ANALYSIS.md](../../OPTIMIZATION_ANALYSIS.md)

---

## 🌐 客户端支持

WebSocket 客户端支持请查看 [client/README.md](./client/README.md)。

---

## 📋 变更日志

详见 [CHANGELOG.md](./CHANGELOG.md)。

**最新 (v1.1.0 - 2026-07-23)**：**新增** – Node.js 22+ 兼容（MongoDB 适配器
懒加载、`serve()` 改为 await）；集成测试拆分。**变更** – 依赖升级、locale 锁定、
lint 范围限 `src/`。详见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📊 测试

- **测试数量**：Deno 158 / Bun 143 / Node 143，全部通过（0 失败）
- **测试报告**：详见 [TEST_REPORT.md](./TEST_REPORT.md)
- **运行测试**：`deno test -A tests`、`bun test tests` 或 `npm run test:node`

---

## 📝 备注

- **服务端和客户端分离**：通过 `/client` 子路径明确区分服务端和客户端代码
- **统一接口**：服务端和客户端使用相同的 API 接口，降低学习成本
- **类似 socket.io 的 API**：采用类似 socket.io 的 API
  设计，提供更友好的开发体验
- **消息加密**：内置消息加密功能，支持多种加密算法
- **跨运行时支持**：原生支持 Deno、Bun、Node.js 22+ 运行时
- **类型安全**：完整的 TypeScript 类型支持
- **与 @dreamer/http 配合使用**：可以在同一个应用中同时提供 HTTP 和 WebSocket
  服务

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

Apache License 2.0 - 详见 [LICENSE](../../LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
