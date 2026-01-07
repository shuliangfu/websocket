# @dreamer/websocket

一个用于 Deno 的 WebSocket 工具库，提供 WebSocket 服务器功能，支持实时双向通信。

## 功能

WebSocket 工具库，用于构建实时通信应用、推送服务、在线协作等场景。

## 特性

### WebSocket 服务器

- **基于 Deno WebSocket API**：原生 WebSocket 服务器支持
- **连接管理**：
  - 连接建立和关闭处理
  - 连接状态追踪
  - 连接池管理
  - 连接数限制和流量控制
- **消息处理**：
  - 文本消息（UTF-8）
  - 二进制消息（ArrayBuffer、Blob）
  - 消息序列化/反序列化（JSON、MessagePack 等）
  - 消息路由和分发
- **文件上传**：
  - 二进制文件传输
  - 大文件分片上传
  - 上传进度追踪
  - 断点续传支持
  - 多文件并发上传
- **房间管理**：
  - 房间创建和销毁
  - 用户加入/离开房间
  - 房间内消息广播
  - 房间状态查询
  - 房间权限控制
- **心跳检测**：
  - 自动心跳发送
  - 连接超时检测
  - 断线重连支持
- **中间件系统集成**（依赖 @dreamer/middleware）：
  - 使用通用中间件系统
  - WebSocket 专用中间件适配器
  - 内置常用中间件（认证、日志、限流等）
- **事件系统**：
  - 连接事件（connect、disconnect、error）
  - 消息事件（message、ping、pong）
  - 自定义事件支持


## 依赖

@dreamer/middleware（用于中间件系统，服务端 WebSocket 服务器）

## 使用场景

- **实时通信**：聊天应用、在线客服、实时通知
- **推送服务**：消息推送、状态更新、数据同步
- **在线协作**：协同编辑、实时白板、多人游戏
- **监控和日志**：实时日志流、系统监控、性能指标
- **IoT 应用**：设备控制、数据采集、远程监控

## 优先级

⭐⭐

## 安装

```bash
deno add jsr:@dreamer/websocket
```

## 环境兼容性

- **Deno 版本**：要求 Deno 2.5 或更高版本
- **服务端**：✅ 支持（Deno 运行时，WebSocket 服务器功能，基于 Deno.upgradeWebSocket）
- **客户端**：✅ 支持（浏览器环境，通过 `jsr:@dreamer/websocket/client` 使用 WebSocket 客户端功能）
- **依赖**：@dreamer/middleware（用于中间件系统，服务端 WebSocket 服务器）

## 使用示例

### WebSocket 服务器

#### 基础服务器（类似 socket.io）

```typescript
import { Server } from "jsr:@dreamer/websocket";

// 创建 WebSocket 服务器（类似 socket.io）
const io = new Server({
  port: 8080,
  path: "/socket.io",
});

// 连接建立事件（类似 socket.io 的 connection）
io.on("connection", (socket) => {
  console.log("新连接建立:", socket.id);

  // 监听自定义事件（类似 socket.io 的 emit/on）
  socket.on("chat-message", (data) => {
    console.log("收到聊天消息:", data);

    // 发送事件（类似 socket.io 的 emit）
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
await io.listen();
console.log("WebSocket 服务器运行在 ws://localhost:8080");
```

#### 使用中间件（类似 socket.io）

```typescript
import { Server } from "jsr:@dreamer/websocket";
// WebSocket 库内部使用 @dreamer/middleware

const io = new Server({
  port: 8080,
  path: "/socket.io",
});

// 中间件示例（类似 socket.io 的 middleware）
io.use(async (socket, next) => {
  // 认证中间件
  const token = socket.handshake.query.token;
  if (!token || !isValidToken(token)) {
    return next(new Error("未授权"));
  }
  socket.data.user = await getUserByToken(token);
  next();
});

io.use(async (socket, next) => {
  // 日志中间件
  console.log(`连接建立: ${socket.id} from ${socket.handshake.address}`);
  next();
});

// 连接处理
io.on("connection", (socket) => {
  console.log("用户连接:", socket.data.user.name);

  // 监听事件
  socket.on("chat-message", (data) => {
    // 处理消息
  });
});
```

#### 房间管理（类似 socket.io）

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/socket.io",
});

io.on("connection", (socket) => {
  // 加入房间（类似 socket.io 的 join）
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`用户 ${socket.id} 加入房间 ${roomId}`);

    // 通知房间内其他用户（类似 socket.io 的 to().emit()）
    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
    });
  });

  // 离开房间（类似 socket.io 的 leave）
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    console.log(`用户 ${socket.id} 离开房间 ${roomId}`);

    // 通知房间内其他用户
    socket.to(roomId).emit("user-left", {
      userId: socket.id,
    });
  });

  // 房间内消息广播（类似 socket.io 的 to().emit()）
  socket.on("room-message", (data) => {
    const { roomId, message } = data;
    // 向房间内所有用户（除了发送者）广播消息
    socket.to(roomId).emit("room-message", {
      userId: socket.id,
      message: message,
    });
  });

  // 向所有房间广播（类似 socket.io 的 broadcast.emit()）
  socket.on("broadcast-message", (message) => {
    socket.broadcast.emit("broadcast-message", {
      userId: socket.id,
      message: message,
    });
  });
});
```

#### 心跳检测（自动处理）

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/socket.io",
  // 心跳配置（类似 socket.io 的 pingTimeout 和 pingInterval）
  pingTimeout: 60000,  // 60 秒无响应则断开连接
  pingInterval: 30000, // 30 秒发送一次心跳
});

// 心跳检测自动处理，无需手动管理
io.on("connection", (socket) => {
  // 连接建立
  console.log("连接建立:", socket.id);

  // 断开连接（包括心跳超时）
  socket.on("disconnect", (reason) => {
    if (reason === "ping timeout") {
      console.log("心跳超时，连接断开:", socket.id);
    } else {
      console.log("连接断开:", socket.id, reason);
    }
  });
});
```

#### 事件处理（类似 socket.io）

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/socket.io",
});

io.on("connection", (socket) => {
  // 监听多个事件（类似 socket.io 的事件系统）
  socket.on("chat", (data, callback) => {
    // 处理聊天消息
    const { roomId, message } = data;

    // 向房间广播（类似 socket.io 的 to().emit()）
    socket.to(roomId).emit("chat", {
      userId: socket.id,
      message: message,
    });

    // 消息确认（类似 socket.io 的 callback）
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

#### 文件上传（支持二进制和分片上传）

```typescript
import { Server } from "jsr:@dreamer/websocket";
import { writeFile } from "jsr:@std/fs";

const io = new Server({
  port: 8080,
  path: "/socket.io",
});

io.on("connection", (socket) => {
  // 存储上传中的文件信息
  const uploads = new Map<string, {
    filename: string;
    totalSize: number;
    receivedSize: number;
    chunks: Uint8Array[];
  }>();

  // 开始文件上传（接收文件元数据）
  socket.on("file-upload-start", (data, callback) => {
    const { fileId, filename, totalSize, chunkSize } = data;

    uploads.set(fileId, {
      filename,
      totalSize,
      receivedSize: 0,
      chunks: [],
    });

    // 通知客户端可以开始发送文件块
    if (callback) {
      callback({ status: "ready", fileId });
    }
  });

  // 接收文件块（二进制数据）
  socket.on("file-upload-chunk", async (data: ArrayBuffer, callback) => {
    // 从二进制数据中解析文件块信息
    const view = new DataView(data);
    const fileId = new TextDecoder().decode(
      new Uint8Array(data.slice(0, 36)) // UUID 长度
    );
    const chunkIndex = view.getUint32(36, true);
    const chunkData = new Uint8Array(data.slice(40));

    const upload = uploads.get(fileId);
    if (!upload) {
      if (callback) {
        callback({ status: "error", message: "文件上传未初始化" });
      }
      return;
    }

    // 存储文件块
    upload.chunks[chunkIndex] = chunkData;
    upload.receivedSize += chunkData.length;

    // 发送上传进度
    const progress = (upload.receivedSize / upload.totalSize) * 100;
    socket.emit("file-upload-progress", {
      fileId,
      progress: Math.round(progress),
      receivedSize: upload.receivedSize,
      totalSize: upload.totalSize,
    });

    // 如果所有块都接收完成
    if (upload.receivedSize >= upload.totalSize) {
      // 合并所有块
      const fileData = new Uint8Array(upload.totalSize);
      let offset = 0;
      for (const chunk of upload.chunks) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }

      // 保存文件
      const filePath = `./uploads/${upload.filename}`;
      await writeFile(filePath, fileData);

      // 清理上传信息
      uploads.delete(fileId);

      // 通知客户端上传完成
      if (callback) {
        callback({
          status: "success",
          fileId,
          filePath,
          size: upload.totalSize,
        });
      }
    } else {
      // 继续接收下一个块
      if (callback) {
        callback({ status: "continue", fileId, chunkIndex });
      }
    }
  });

  // 取消文件上传
  socket.on("file-upload-cancel", (data) => {
    const { fileId } = data;
    uploads.delete(fileId);
    socket.emit("file-upload-cancelled", { fileId });
  });
});
```

### 完整示例：聊天应用（类似 socket.io）

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/socket.io",
});

// 用户认证中间件（类似 socket.io 的 middleware）
io.use(async (socket, next) => {
  const token = socket.handshake.query.token;
  if (!token) {
    return next(new Error("需要认证"));
  }
  socket.data.user = await authenticateUser(token);
  next();
});

io.on("connection", (socket) => {
  console.log(`用户 ${socket.data.user.name} 连接`);

  // 加入聊天室（类似 socket.io 的 join）
  socket.on("join-chat", (roomId, callback) => {
    socket.join(roomId);
    // 通知房间内其他用户（类似 socket.io 的 to().emit()）
    socket.to(roomId).emit("user-joined", {
      user: socket.data.user.name,
    });

    // 消息确认
    if (callback) {
      callback({ status: "success" });
    }
  });

  // 发送消息（类似 socket.io 的 emit）
  socket.on("chat-message", (data, callback) => {
    const { roomId, message } = data;
    // 广播到房间（类似 socket.io 的 to().emit()）
    socket.to(roomId).emit("chat-message", {
      user: socket.data.user.name,
      message: message,
      timestamp: Date.now(),
    });

    // 消息确认
    if (callback) {
      callback({ status: "success" });
    }
  });

  // 离开聊天室（类似 socket.io 的 leave）
  socket.on("leave-chat", (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user-left", {
      user: socket.data.user.name,
    });
  });

  // 断开连接
  socket.on("disconnect", (reason) => {
    console.log(`用户 ${socket.data.user.name} 断开连接:`, reason);
  });
});

await io.listen();
```

## 客户端支持

WebSocket 客户端支持请查看 [client/README.md](./src/client/README.md)。

## 中间件系统

@dreamer/websocket 使用 @dreamer/middleware 作为中间件系统，支持：

- **认证中间件**：验证用户身份
- **日志中间件**：记录连接和消息日志
- **限流中间件**：限制连接数和消息频率
- **数据验证中间件**：验证消息格式和内容
- **自定义中间件**：根据业务需求创建中间件

## 性能优化

- **连接池管理**：高效管理大量 WebSocket 连接
- **消息批处理**：批量处理消息，减少网络开销
- **内存管理**：及时清理断开的连接和消息队列
- **负载均衡**：支持多服务器部署和负载均衡

## API 设计说明

### 类似 socket.io 的 API 设计

@dreamer/websocket 采用类似 socket.io 的 API 设计，提供更友好的开发体验：

- **事件驱动**：使用 `emit()` 和 `on()` 进行事件通信
- **房间管理**：使用 `join()` 和 `leave()` 管理房间
- **消息广播**：使用 `to()`、`broadcast.emit()` 进行消息广播
- **消息确认**：支持 callback 形式的消息确认（acknowledgments）
- **中间件支持**：服务端支持中间件处理连接
- **命名空间**：支持命名空间（namespaces）隔离不同业务

### 与 socket.io 的主要区别

- **基于 Deno**：原生支持 Deno 运行时，无需 Node.js
- **更轻量**：不依赖 socket.io 的复杂协议，基于标准 WebSocket
- **TypeScript 原生**：完整的 TypeScript 类型支持
- **中间件系统**：集成 @dreamer/middleware，更灵活的中间件处理

## 状态

🚧 **开发中**

## 备注

- 支持使用 @dreamer/middleware 中间件系统，可以灵活处理 WebSocket 连接
- 服务端和客户端都支持（客户端通过 `jsr:@dreamer/websocket/client`），可以构建完整的实时通信应用
- API 设计类似 socket.io，降低学习成本，提升开发体验
- 支持房间管理、心跳检测、自动重连、消息确认等高级功能
- 与 @dreamer/http 配合使用，可以在同一个应用中同时提供 HTTP 和 WebSocket 服务
