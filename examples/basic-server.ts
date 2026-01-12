/**
 * @fileoverview 基础 WebSocket 服务器示例
 * 演示如何创建和运行一个简单的 WebSocket 服务器
 */

import { Server } from "../src/server.ts";

// 创建 WebSocket 服务器实例
const io = new Server({
  port: 8080,
  path: "/ws",
});

// 监听连接事件
io.on("connection", (socket) => {
  console.log(`[服务器] 新连接建立: ${socket.id}`);

  // 监听自定义事件
  socket.on("chat-message", (data) => {
    console.log(`[服务器] 收到来自 ${socket.id} 的消息:`, data);

    // 发送响应消息
    socket.emit("chat-response", {
      status: "success",
      message: "消息已收到",
      timestamp: Date.now(),
    });
  });

  // 监听 ping 事件
  socket.on("ping", (data) => {
    console.log(`[服务器] 收到 ping:`, data);
    socket.emit("pong", { timestamp: Date.now() });
  });

  // 监听断开连接事件
  socket.on("disconnect", (reason) => {
    console.log(`[服务器] 连接断开: ${socket.id}, 原因: ${reason}`);
  });

  // 监听错误事件
  socket.on("error", (error) => {
    console.error(`[服务器] 连接错误: ${socket.id}`, error);
  });

  // 发送欢迎消息
  socket.emit("welcome", {
    message: "欢迎连接到 WebSocket 服务器",
    socketId: socket.id,
  });
});

// 启动服务器
await io.listen();
console.log("✅ WebSocket 服务器运行在 ws://localhost:8080/ws");

// 优雅关闭
globalThis.addEventListener("beforeunload", () => {
  console.log("正在关闭服务器...");
  io.close();
});
