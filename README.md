# @dreamer/websocket

> WebSocket utility library compatible with Deno and Bun. WebSocket server with real-time bidirectional communication.

English | [中文 (Chinese)](./README-zh.md)

[![JSR](https://jsr.io/badges/@dreamer/websocket)](https://jsr.io/@dreamer/websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-156%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 Features

WebSocket utility library for real-time communication apps, push services, online collaboration, and more.

---

## ✨ Characteristics

- **Cross-runtime WebSocket API**:
  - Native WebSocket server support for Deno and Bun
  - Unified WebSocket API abstraction
- **Connection management**:
  - Connection establishment and teardown
  - Connection state tracking
  - Connection pool management
  - Connection limits and flow control
- **Message handling**:
  - Text messages (UTF-8)
  - Binary messages (ArrayBuffer, Blob)
  - Message serialization/deserialization (JSON)
  - Message routing and dispatch
- **Room management**:
  - Room create/destroy
  - Join/leave rooms
  - Room broadcast
  - Room state queries
- **Heartbeat**:
  - Auto heartbeat send
  - Connection timeout detection
  - Reconnect support
  - Optional batch heartbeat (`useBatchHeartbeat`) to reduce timers
- **Middleware system**:
  - Generic middleware system
  - WebSocket-specific middleware adapters
  - Auth, logging, rate limit middleware
- **Event system**:
  - Connection events (connect, disconnect, error)
  - Message events (message, ping, pong)
  - Custom events
  - Event callbacks (acknowledgments)
- **Namespaces**:
  - Namespace isolation for different use cases
  - Per-namespace connection pool and middleware
- **Message encryption**:
  - AES-256-GCM, AES-128-GCM, AES-256-CBC, AES-128-CBC
  - Auto encrypt/decrypt
  - Key management (random generation, password derivation)
  - Mixed encryption scenarios
- **Distributed adapters**:
  - Redis adapter (Pub/Sub)
  - MongoDB adapter (Change Streams or polling)
  - Single-node replica set support
  - Multi-server broadcast and room management
  - Auto server registration and discovery
- **Logging and i18n**:
  - Custom `logger`, `debug`, `t` translation function
  - Same debug log behavior as @dreamer/server
- **Performance**:
  - `MessageCache`: message serialization cache, FNV-1a hash
  - `MessageQueue`: broadcast via queue (`useMessageQueue`), backpressure
  - `BatchHeartbeatManager`: batch heartbeat (`useBatchHeartbeat`), fewer timers
  - `getStats` returns messageQueue, messageCache stats

---

## 🎨 Design Principles

**All @dreamer/* libraries follow these principles**:

- **Main package (@dreamer/xxx)**: Server-side (Deno and Bun)
- **Client subpackage (@dreamer/xxx/client)**: Client-side (browser)

Benefits:
- Clear separation of server and client code
- Avoid server dependencies in client code
- Better type safety and IntelliSense
- Better tree-shaking

---

## 🎯 Use Cases

- **Real-time communication**: Chat, live support, notifications
- **Push services**: Message push, status updates, data sync
- **Online collaboration**: Collaborative editing, whiteboard, multiplayer games
- **Monitoring and logging**: Live log streams, system monitoring, metrics
- **IoT**: Device control, data collection, remote monitoring

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

## 🌍 Compatibility

| Environment | Version | Status |
|-------------|---------|--------|
| **Deno** | 2.5+ | ✅ Fully supported |
| **Bun** | 1.0+ | ✅ Fully supported |
| **Server** | - | ✅ Supported (Deno/Bun, WebSocket server) |
| **Client** | - | ✅ Supported (browser via `jsr:@dreamer/websocket/client`) |
| **Dependencies** | - | 📦 @dreamer/runtime-adapter (cross-runtime) |

---

## 🚀 Quick Start

### Basic Server

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("chat-message", (data) => {
    console.log("Chat message:", data);

    socket.emit("chat-response", {
      status: "success",
      message: "Message received",
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("Disconnected:", socket.id, reason);
  });

  socket.on("error", (error) => {
    console.error("Connection error:", error);
  });
});

io.listen();
console.log("WebSocket server running at ws://localhost:8080/ws");
```

### Middleware

```typescript
import { Server, authMiddleware, loggerMiddleware } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

io.use(
  authMiddleware(async (socket) => {
    const token = socket.handshake.query["token"];
    if (!token || !isValidToken(token)) {
      return false;
    }
    socket.data.user = await getUserByToken(token);
    return true;
  })
);

io.use(loggerMiddleware());

io.on("connection", (socket) => {
  console.log("User connected:", socket.data.user.name);

  socket.on("chat-message", (data) => {
    // Handle message
  });
});
```

### Room Management

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
    });
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);

    socket.to(roomId).emit("user-left", {
      userId: socket.id,
    });
  });

  socket.on("room-message", (data) => {
    const { roomId, message } = data;
    socket.to(roomId).emit("room-message", {
      userId: socket.id,
      message: message,
    });
  });

  socket.on("broadcast-message", (message) => {
    socket.broadcast.emit("broadcast-message", {
      userId: socket.id,
      message: message,
    });
  });
});
```

### Namespaces

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
});

// Default namespace
io.on("connection", (socket) => {
  socket.on("message", (data) => {
    socket.emit("response", { message: "From default namespace" });
  });
});

// Chat namespace
const chatNamespace = io.of("/chat");
chatNamespace.on("connection", (socket) => {
  socket.on("chat-message", (data) => {
    chatNamespace.emit("chat-message", {
      userId: socket.id,
      message: data.message,
    });
  });
});

// Game namespace
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

### Message Encryption

```typescript
import { Server, EncryptionManager } from "jsr:@dreamer/websocket";

const key = EncryptionManager.generateKey("aes-256");

const io = new Server({
  port: 8080,
  path: "/ws",
  encryption: {
    key,
    algorithm: "aes-256-gcm",
  },
});

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    socket.emit("response", { received: data });
  });
});
```

### Heartbeat

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
  pingTimeout: 60000,  // Disconnect after 60s no response
  pingInterval: 30000, // Send heartbeat every 30s
  // useBatchHeartbeat: true, // For many connections
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("disconnect", (reason) => {
    if (reason === "ping timeout") {
      console.log("Heartbeat timeout:", socket.id);
    } else {
      console.log("Disconnected:", socket.id, reason);
    }
  });
});
```

### Client

```typescript
import { Client } from "jsr:@dreamer/websocket/client";

const client = new Client({
  url: "ws://localhost:8080/ws",
  autoReconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
});

client.on("open", () => {
  console.log("Connected");
  client.emit("message", { text: "Hello" });
});

client.on("response", (data) => {
  console.log("Response:", data);
});

client.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});
```

### Distributed Deployment (Adapters)

For multiple WebSocket server instances, use a distributed adapter for message sync. Adapters handle:
- **Broadcast**: Broadcast to all server instances
- **Room management**: Sync room members
- **Server discovery**: Auto register and discover servers

By default, the server uses the in-memory adapter (single-server). For multi-server, configure Redis or MongoDB adapter.

#### Redis Adapter

```typescript
import { Server, RedisAdapter } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
  adapter: new RedisAdapter({
    connection: {
      host: "127.0.0.1",
      port: 6379,
    },
    keyPrefix: "ws",
    heartbeatInterval: 5,
  }),
});

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    io.broadcast("message", data);
  });
});

io.listen();
```

#### MongoDB Adapter

```typescript
import { Server, MongoDBAdapter } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
  adapter: new MongoDBAdapter({
    connection: {
      host: "127.0.0.1",
      port: 27017,
      database: "websocket",
      replicaSet: "rs0",
      directConnection: false,
    },
    keyPrefix: "ws",
    heartbeatInterval: 5,
  }),
});

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    io.broadcast("message", data);
  });
});

io.listen();
```

### High-Concurrency Optimization (Optional)

For many connections, enable `useBatchHeartbeat` and `useMessageQueue`:

```typescript
import { Server } from "jsr:@dreamer/websocket";

const io = new Server({
  port: 8080,
  path: "/ws",
  useBatchHeartbeat: true,
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
    io.broadcast("message", data);
  });
});

io.listen();
```

**Adapter selection**:
- **Single server**: Default memory adapter
- **Multi-server + Redis**: Redis adapter recommended, good performance
- **Multi-server + MongoDB**: Use if MongoDB already in stack
  - Replica set: Change Streams (recommended)
  - Single node: Polling fallback, 500ms delay

---

## 📚 API Documentation

### Server

WebSocket server class, manages all connections and events.

**Constructor**:
```typescript
new Server(options?: ServerOptions)
```

**Options**:
- `host?: string`: Host (default: 0.0.0.0)
- `port?: number`: Port
- `path?: string`: WebSocket path (default: "/")
- `pingTimeout?: number`: Heartbeat timeout (default: 60000ms)
- `pingInterval?: number`: Heartbeat interval (default: 30000ms)
- `maxConnections?: number`: Max connections
- `logger?: Logger`: Custom logger (default: @dreamer/logger)
- `debug?: boolean`: Debug logs (default: false)
- `t?: (key, params?) => string`: Translation function for i18n
- `encryption?: EncryptionConfig`: Encryption config
- `adapter?: WebSocketAdapter`: Distributed adapter (Redis, MongoDB, Memory)
- `messageCache?: { maxSize?, ttl? } | false`: Message cache config (default: enabled)
- `messageQueue?: { maxSize?, batchSize?, processInterval? } | false`: Message queue config (default: enabled)
- `useBatchHeartbeat?: boolean`: Use batch heartbeat (default: false)
- `useMessageQueue?: boolean`: Broadcast via message queue (default: false)

**Methods**:
- `listen(host?: string, port?: number): void`: Start server
- `close(): Promise<void>`: Close server
- `on(event: "connection", listener: ServerEventListener): void`: Connection listener
- `use(middleware: Middleware): void`: Add middleware
- `of(name: string): Namespace`: Create or get namespace
- `getStats(): ServerStats`: Get server stats

### Socket

WebSocket connection class, represents a client connection.

**Methods**:
- `emit(event: string, data?: any, callback?: Function): void`: Emit event
- `on(event: string, listener: SocketEventListener): void`: Listen event
- `off(event: string, listener?: SocketEventListener): void`: Remove listener
- `join(room: string): void`: Join room
- `leave(room: string): void`: Leave room
- `to(room: string): Socket`: Emit to room (chainable)
- `broadcast.emit(event: string, data?: any): void`: Broadcast
- `disconnect(reason?: string): void`: Disconnect
- `sendBinary(data: ArrayBuffer | Blob): void`: Send binary

**Properties**:
- `id: string`: Socket ID
- `handshake: Handshake`: Handshake info
- `data: SocketData`: Data storage
- `connected: boolean`: Connection status

### Client

WebSocket client class for browser.

**Constructor**:
```typescript
new Client(options: ClientOptions)
```

**Options**:
- `url: string`: WebSocket server URL
- `autoReconnect?: boolean`: Auto reconnect (default: true)
- `reconnectInterval?: number`: Reconnect interval (default: 1000ms)
- `maxReconnectAttempts?: number`: Max reconnect attempts (default: 5)
- `reconnectStrategy?: "exponential" | "fixed" | "linear"`: Reconnect strategy
- `pingInterval?: number`: Heartbeat interval (default: 30000ms)
- `pingTimeout?: number`: Heartbeat timeout (default: 60000ms)
- `query?: Record<string, string>`: Query params
- `protocols?: string[]`: Protocols
- `encryption?: EncryptionConfig`: Encryption config

**Methods**:
- `connect(): void`: Connect
- `disconnect(): void`: Disconnect
- `emit(event: string, data?: any, callback?: Function): void`: Emit event
- `on(event: string, listener: ClientEventListener): void`: Listen event
- `off(event: string, listener?: ClientEventListener): void`: Remove listener
- `sendBinary(data: ArrayBuffer | Blob): void`: Send binary

### EncryptionManager

Message encryption manager.

**Static methods**:
- `generateKey(type: "aes-256" | "aes-128"): Uint8Array`: Generate random key
- `deriveKeyFromPassword(password: string, type: "aes-256" | "aes-128"): Uint8Array`: Derive key from password

**Methods**:
- `encryptMessage(plaintext: string): Promise<string>`: Encrypt message
- `decryptMessage(ciphertext: string): Promise<string>`: Decrypt message
- `isEncrypted(message: string): boolean`: Check if message is encrypted

### Middleware

Built-in middleware:

- `authMiddleware(validator: (socket: Socket) => boolean | Promise<boolean>): Middleware`: Auth middleware
- `loggerMiddleware(logger?: Logger): Middleware`: Logger middleware
- `rateLimitMiddleware(options: { maxConnections?: number; maxMessagesPerSecond?: number }): Middleware`: Rate limit middleware
- `corsMiddleware(options: { origin?: string | string[] | ((origin: string) => boolean) }): Middleware`: CORS middleware

### Distributed Adapters

#### RedisAdapter

Redis distributed adapter, Pub/Sub for multi-server communication.

**Constructor**:
```typescript
new RedisAdapter(options: RedisAdapterOptions)
```

**Options**:
- `connection?: RedisConnectionConfig`: Redis connection
  - `host?: string`: Host (default: "127.0.0.1")
  - `port?: number`: Port (default: 6379)
  - `url?: string`: Redis URL
- `keyPrefix?: string`: Key prefix (default: "ws")
- `heartbeatInterval?: number`: Heartbeat interval in seconds (default: 5)

#### MongoDBAdapter

MongoDB distributed adapter, Change Streams or polling for multi-server communication.

**Constructor**:
```typescript
new MongoDBAdapter(options: MongoDBAdapterOptions)
```

**Options**:
- `connection: MongoDBConnectionConfig`: MongoDB connection
  - `url?: string`: MongoDB URL
  - `host?: string`: Host
  - `port?: number`: Port (default: 27017)
  - `database: string`: Database name
  - `username?: string`: Username
  - `password?: string`: Password
  - `replicaSet?: string`: Replica set name
  - `directConnection?: boolean`: Direct connection (default: false)
- `keyPrefix?: string`: Key prefix (default: "ws")
- `heartbeatInterval?: number`: Heartbeat interval in seconds (default: 5)

**Notes**:
- **Change Streams**: Requires MongoDB replica set (recommended)
- **Polling fallback**: Single-node uses 500ms polling
- **Single-node replica set**: Supports single-node configured as replica set

---

## ⚡ Performance

- **Batch ops**: Batch join/leave rooms
- **Room broadcast**: Room-based broadcast instead of iterating all connections
- **Heartbeat**: Auto detect and clean invalid connections
- **Connection pool**: Efficient pool management for many concurrent connections
- **Async**: All operations async, non-blocking
- **MessageCache**: Message serialization cache, FNV-1a hash, LRU eviction
- **MessageQueue**: `useMessageQueue=true` for broadcast/emitToRoom via queue, backpressure
- **BatchHeartbeatManager**: `useBatchHeartbeat=true` for centralized heartbeat, fewer timers
- **Batch send**: Auto batch when many connections
- **Encryption cache**: Cache encryption results
- **Distributed**: Redis and MongoDB for horizontal scaling

See [OPTIMIZATION.md](./OPTIMIZATION.md) and [OPTIMIZATION_ANALYSIS.md](./OPTIMIZATION_ANALYSIS.md) for details.

---

## 🌐 Client Support

See [client/README.md](./src/client/README.md) for WebSocket client usage.

---

## 📋 Changelog

| Version | Date | Changes |
|---------|------|---------|
| [1.0.1](CHANGELOG.md#101---2026-02-08) | 2026-02-08 | Fixed: Windows CI compatibility (port 0 + getPort) |
| [1.0.0](CHANGELOG.md#100---2026-02-06) | 2026-02-06 | First stable release |

See [CHANGELOG.md](./CHANGELOG.md) for full history.

---

## 📊 Tests

- **Tests**: 156 test cases, all passed
- **Report**: [TEST_REPORT.md](./TEST_REPORT.md)
- **Run**: `deno test -A tests` or `bun test tests`

---

## 📝 Notes

- **Server/client separation**: `/client` subpath for client code
- **Unified API**: Same API for server and client
- **Socket.IO-like API**: Familiar API design
- **Message encryption**: Built-in encryption, multiple algorithms
- **Cross-runtime**: Native Deno and Bun support, no Node.js
- **Type-safe**: Full TypeScript support
- **With @dreamer/http**: Use HTTP and WebSocket in the same app

---

## 🤝 Contributing

Issues and Pull Requests welcome!

---

## 📄 License

MIT License - see [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
