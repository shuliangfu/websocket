/**
 * @fileoverview MongoDB 适配器示例
 * 演示如何使用 MongoDB 适配器实现多服务器分布式 WebSocket 部署
 * 
 * 使用场景：
 * - 多服务器实例部署
 * - 跨服务器的消息广播
 * - 跨服务器的房间管理
 * - 已有 MongoDB 基础设施的场景
 * 
 * 运行前准备：
 * 1. 确保 MongoDB 服务器正在运行（默认 localhost:27017）
 * 2. 推荐使用副本集模式（Change Streams），也可以使用单节点模式（轮询降级）
 * 3. 可以启动多个服务器实例测试分布式功能
 * 
 * 运行方式：
 * deno run --allow-net --allow-env examples/mongodb-adapter-example.ts
 * 
 * 或者启动多个实例（不同端口）：
 * PORT=8080 deno run --allow-net --allow-env examples/mongodb-adapter-example.ts
 * PORT=8081 deno run --allow-net --allow-env examples/mongodb-adapter-example.ts
 */

import { Server, MongoDBAdapter } from "../src/mod.ts";

// 从环境变量获取端口，默认 8080
const port = parseInt(Deno.env.get("PORT") || "8080");

// MongoDB 连接配置
// 方式 1: 副本集模式（推荐，使用 Change Streams，实时性好）
const mongoConfig = {
  host: "127.0.0.1",
  port: 27017,
  database: "websocket",
  // 如果 MongoDB 配置为单节点副本集，取消下面的注释
  // replicaSet: "rs0",
  // directConnection: false,
};

// 方式 2: 单节点模式（自动降级到轮询，500ms 延迟）
// const mongoConfig = {
//   host: "127.0.0.1",
//   port: 27017,
//   database: "websocket",
// };

// 方式 3: 使用连接 URL
// const mongoConfig = {
//   url: "mongodb://127.0.0.1:27017/websocket",
//   // 副本集模式
//   // url: "mongodb://127.0.0.1:27017/websocket?replicaSet=rs0",
// };

// 创建使用 MongoDB 适配器的 WebSocket 服务器
const io = new Server({
  port: port,
  path: "/ws",
  adapter: new MongoDBAdapter({
    connection: mongoConfig,
    keyPrefix: "ws", // MongoDB 集合前缀，用于区分不同的应用
    heartbeatInterval: 5, // 心跳间隔（秒），用于检测服务器是否在线
  }),
});

console.log(`[MongoDB 适配器示例] 服务器启动在端口 ${port}`);
console.log(`[MongoDB 适配器示例] WebSocket 地址: ws://localhost:${port}/ws`);
console.log(`[MongoDB 适配器示例] MongoDB 连接: ${mongoConfig.host}:${mongoConfig.port}/${mongoConfig.database}`);

// 监听连接事件
io.on("connection", (socket) => {
  console.log(`[服务器 ${port}] 新连接建立: ${socket.id}`);

  // 发送欢迎消息
  socket.emit("welcome", {
    message: "欢迎连接到分布式 WebSocket 服务器（MongoDB）",
    socketId: socket.id,
    serverPort: port,
    timestamp: Date.now(),
  });

  /**
   * 加入房间
   * 客户端发送: socket.emit("join-room", "room-123")
   * 房间信息会自动同步到所有服务器实例
   */
  socket.on("join-room", (roomId: string) => {
    socket.join(roomId);
    console.log(`[服务器 ${port}] 用户 ${socket.id} 加入房间: ${roomId}`);

    // 通知房间内其他用户（包括其他服务器上的用户）
    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
      roomId: roomId,
      serverPort: port,
      timestamp: Date.now(),
    });

    // 向当前用户发送确认
    socket.emit("room-joined", {
      roomId: roomId,
      message: `已成功加入房间 ${roomId}`,
    });
  });

  /**
   * 离开房间
   * 客户端发送: socket.emit("leave-room", "room-123")
   */
  socket.on("leave-room", (roomId: string) => {
    socket.leave(roomId);
    console.log(`[服务器 ${port}] 用户 ${socket.id} 离开房间: ${roomId}`);

    // 通知房间内其他用户
    socket.to(roomId).emit("user-left", {
      userId: socket.id,
      roomId: roomId,
      serverPort: port,
      timestamp: Date.now(),
    });
  });

  /**
   * 房间内消息
   * 客户端发送: socket.emit("room-message", { roomId: "room-123", message: "Hello" })
   * 消息会广播到所有服务器实例上的房间成员
   */
  socket.on("room-message", (data: { roomId: string; message: string }) => {
    const { roomId, message } = data;
    console.log(
      `[服务器 ${port}] 用户 ${socket.id} 在房间 ${roomId} 发送消息:`,
      message,
    );

    // 向房间内所有用户（包括其他服务器上的用户）广播消息
    socket.to(roomId).emit("room-message", {
      userId: socket.id,
      roomId: roomId,
      message: message,
      serverPort: port,
      timestamp: Date.now(),
    });
  });

  /**
   * 全局广播消息
   * 客户端发送: socket.emit("broadcast-message", "Hello everyone")
   * 消息会广播到所有服务器实例上的所有连接
   */
  socket.on("broadcast-message", (message: string) => {
    console.log(
      `[服务器 ${port}] 用户 ${socket.id} 发送全局广播:`,
      message,
    );

    // 广播到所有服务器实例上的所有连接
    io.broadcast("broadcast-message", {
      userId: socket.id,
      message: message,
      serverPort: port,
      timestamp: Date.now(),
    });
  });

  /**
   * 批量房间消息
   * 客户端发送: socket.emit("batch-room-message", { rooms: ["room-1", "room-2"], message: "Hello" })
   */
  socket.on("batch-room-message", (data: { rooms: string[]; message: string }) => {
    const { rooms, message } = data;
    console.log(
      `[服务器 ${port}] 用户 ${socket.id} 向多个房间发送消息:`,
      rooms,
      message,
    );

    // 使用批量发送方法
    io.batchEmitToRooms(rooms, "room-message", {
      userId: socket.id,
      message: message,
      serverPort: port,
      timestamp: Date.now(),
    });
  });

  /**
   * 获取服务器统计信息
   * 客户端发送: socket.emit("get-stats")
   */
  socket.on("get-stats", () => {
    const stats = io.getStats();
    socket.emit("stats", {
      ...stats,
      serverPort: port,
      timestamp: Date.now(),
    });
  });

  // 监听断开连接事件
  socket.on("disconnect", (reason: string) => {
    console.log(
      `[服务器 ${port}] 连接断开: ${socket.id}, 原因: ${reason}`,
    );
  });

  // 监听错误事件
  socket.on("error", (error: any) => {
    console.error(`[服务器 ${port}] 连接错误: ${socket.id}`, error);
  });
});

// 启动服务器
io.listen().then(() => {
  console.log(`[MongoDB 适配器示例] 服务器已启动`);
  console.log(`[MongoDB 适配器示例] 可以启动多个实例测试分布式功能`);
  console.log(`[MongoDB 适配器示例] 使用不同端口: PORT=8081 deno run --allow-net --allow-env examples/mongodb-adapter-example.ts`);
  console.log(`[MongoDB 适配器示例] 注意：`);
  console.log(`[MongoDB 适配器示例] - 副本集模式：使用 Change Streams，实时性好（推荐）`);
  console.log(`[MongoDB 适配器示例] - 单节点模式：自动降级到轮询，500ms 延迟`);
}).catch((error) => {
  console.error(`[MongoDB 适配器示例] 服务器启动失败:`, error);
  Deno.exit(1);
});

// 优雅关闭
Deno.addSignalListener("SIGINT", async () => {
  console.log(`[MongoDB 适配器示例] 正在关闭服务器...`);
  await io.close();
  console.log(`[MongoDB 适配器示例] 服务器已关闭`);
  Deno.exit(0);
});
