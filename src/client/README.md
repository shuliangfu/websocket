# @dreamer/websocket/client

一个用于浏览器的 WebSocket 客户端库，提供 WebSocket 客户端功能，支持实时双向通信。

## 服务端支持

服务端 WebSocket 支持请查看 [服务端文档](../../README.md)。

## 功能

WebSocket 客户端库，用于浏览器环境中的实时通信应用。

## 特性

- **基于浏览器 WebSocket API**：标准 WebSocket 客户端
- **自动重连**：
  - 断线自动重连
  - 重连策略（指数退避、固定间隔等）
  - 最大重连次数限制
  - 重连状态回调
- **消息队列**：
  - 离线消息缓存
  - 消息发送队列
  - 消息确认机制
  - 消息重发机制
- **心跳检测**：
  - 自动心跳发送
  - 服务器心跳响应检测
  - 连接健康状态监控
- **事件处理**：
  - 连接状态事件
  - 消息接收事件
  - 错误处理事件
  - 自定义事件订阅
- **文件上传**：
  - 二进制文件传输
  - 大文件分片上传
  - 上传进度回调
  - 上传取消支持
  - 多文件并发上传

## 安装

```bash
deno add jsr:@dreamer/websocket/client
```

## 环境兼容性

- **Deno 版本**：要求 Deno 2.5 或更高版本
- **环境**：✅ 支持（浏览器环境）
- **依赖**：无外部依赖

## 使用示例

### 基础客户端

```typescript
import { Client } from "jsr:@dreamer/websocket/client";

// 创建 WebSocket 客户端
const client = new Client({
  url: "ws://localhost:8080",
  autoReconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
});

// 连接建立事件
client.on("open", () => {
  console.log("连接已建立");
});

// 消息接收事件
client.on("message", (data) => {
  console.log("收到消息:", data);
});

// 连接关闭事件
client.on("close", (code, reason) => {
  console.log("连接已关闭:", code, reason);
});

// 错误事件
client.on("error", (error) => {
  console.error("连接错误:", error);
});

// 发送消息
client.send("Hello, Server!");

// 关闭连接
client.close();
```

## 使用场景

- **实时通信**：聊天应用、在线客服、实时通知
- **推送服务**：消息推送、状态更新、数据同步
- **在线协作**：协同编辑、实时白板、多人游戏

## 状态

🚧 **开发中**

## 备注

- **基于浏览器 WebSocket API**：使用标准 WebSocket API
- **统一接口**：与服务端使用相似的 API 接口，降低学习成本
- **类型安全**：完整的 TypeScript 类型支持
- **无外部依赖**：纯 TypeScript 实现
