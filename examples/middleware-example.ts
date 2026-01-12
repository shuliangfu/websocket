/**
 * @fileoverview 中间件示例
 * 演示如何使用中间件实现认证、日志、限流等功能
 */

import { Server } from "../src/server.ts";
import {
  authMiddleware,
  corsMiddleware,
  loggerMiddleware,
  rateLimitMiddleware,
} from "../src/middleware.ts";

const io = new Server({
  port: 8080,
  path: "/ws",
});

/**
 * 自定义认证中间件
 * 从查询参数中获取 token 并验证
 */
io.use(
  authMiddleware(async (socket) => {
    const token = socket.handshake.query["token"];
    console.log(`[认证中间件] 验证 token: ${token}`);

    // 模拟 token 验证
    if (!token) {
      console.log(`[认证中间件] 未提供 token`);
      return false;
    }

    // 简单的 token 验证逻辑（实际应用中应该更复杂）
    if (token === "valid-token-123") {
      // 将用户信息存储到 socket.data
      socket.data.user = {
        id: "user-123",
        name: "测试用户",
        token: token,
      };
      console.log(`[认证中间件] 认证成功: ${socket.id}`);
      return true;
    }

    console.log(`[认证中间件] 认证失败: 无效的 token`);
    return false;
  }),
);

/**
 * CORS 中间件
 * 限制允许的来源
 */
io.use(
  corsMiddleware({
    origin: (origin) => {
      // 允许 localhost 和特定域名
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:8080",
        "https://example.com",
      ];
      return allowedOrigins.includes(origin);
    },
  }),
);

/**
 * 日志中间件
 * 记录所有连接
 */
io.use(loggerMiddleware());

/**
 * 限流中间件
 * 限制每个 IP 的连接数和消息频率
 */
io.use(
  rateLimitMiddleware({
    maxConnections: 10, // 每个 IP 最多 10 个连接
    maxMessagesPerSecond: 5, // 每秒最多 5 条消息
  }),
);

/**
 * 自定义业务中间件
 * 记录连接时间
 */
io.use((socket, next) => {
  socket.data.connectTime = Date.now();
  console.log(`[业务中间件] 记录连接时间: ${socket.data.connectTime}`);
  next();
});

// 连接处理
io.on("connection", (socket) => {
  const user = socket.data.user;
  const connectTime = socket.data.connectTime;

  console.log(
    `[服务器] 用户连接: ${user?.name || "未知用户"} (${socket.id})`,
  );
  console.log(`[服务器] 连接时间: ${new Date(connectTime).toISOString()}`);

  // 发送欢迎消息
  socket.emit("welcome", {
    message: `欢迎, ${user?.name || "用户"}!`,
    socketId: socket.id,
    connectTime: connectTime,
  });

  // 监听消息
  socket.on("message", (data: any) => {
    console.log(`[服务器] 收到来自 ${user?.name} 的消息:`, data);

    // 检查消息频率（这里可以添加更复杂的限流逻辑）
    const now = Date.now();
    if (!socket.data.lastMessageTime) {
      socket.data.lastMessageTime = now;
    } else {
      const timeDiff = now - socket.data.lastMessageTime;
      if (timeDiff < 200) {
        // 200ms 内只能发送一条消息
        socket.emit("error", {
          message: "消息发送过于频繁，请稍后再试",
        });
        return;
      }
      socket.data.lastMessageTime = now;
    }

    socket.emit("response", {
      status: "success",
      message: "消息已收到",
      timestamp: Date.now(),
    });
  });

  // 监听断开连接
  socket.on("disconnect", (reason: string) => {
    const duration = Date.now() - connectTime;
    console.log(
      `[服务器] 用户断开连接: ${user?.name} (${socket.id}), 原因: ${reason}, 连接时长: ${duration}ms`,
    );
  });

  // 监听错误
  socket.on("error", (error: any) => {
    console.error(`[服务器] 连接错误: ${socket.id}`, error);
  });
});

io.listen();
console.log("✅ 中间件示例服务器运行在 ws://localhost:8080/ws");
console.log("   测试连接: ws://localhost:8080/ws?token=valid-token-123");
