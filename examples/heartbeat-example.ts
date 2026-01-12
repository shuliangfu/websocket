/**
 * @fileoverview 心跳检测示例
 * 演示如何使用心跳机制检测连接状态和自动断开
 */

import { Server } from "../src/server.ts";

// 创建服务器，配置心跳参数
const io = new Server({
  port: 8080,
  path: "/ws",
  // 心跳配置
  pingTimeout: 60000, // 60 秒无响应则断开连接
  pingInterval: 30000, // 30 秒发送一次心跳
});

// 存储连接信息
const connectionStats = new Map<string, {
  connectTime: number;
  lastPingTime: number;
  pingCount: number;
}>();

io.on("connection", (socket) => {
  const connectTime = Date.now();
  console.log(`[心跳检测] 用户 ${socket.id} 已连接`);

  // 初始化连接统计
  connectionStats.set(socket.id, {
    connectTime: connectTime,
    lastPingTime: connectTime,
    pingCount: 0,
  });

  // 监听客户端发送的 ping
  socket.on("ping", (data: any) => {
    const stats = connectionStats.get(socket.id);
    if (stats) {
      stats.lastPingTime = Date.now();
      stats.pingCount++;
    }

    console.log(
      `[心跳检测] 收到来自 ${socket.id} 的 ping (第 ${stats?.pingCount || 0} 次)`,
    );

    // 发送 pong 响应
    socket.emit("pong", {
      timestamp: Date.now(),
      serverTime: Date.now(),
    });
  });

  // 监听客户端发送的 pong（响应服务器的 ping）
  socket.on("pong", (data: any) => {
    const stats = connectionStats.get(socket.id);
    if (stats) {
      stats.lastPingTime = Date.now();
    }

    console.log(`[心跳检测] 收到来自 ${socket.id} 的 pong`);
  });

  // 定期检查连接状态（可选，服务器已经有自动心跳机制）
  const healthCheckInterval = setInterval(() => {
    const stats = connectionStats.get(socket.id);
    if (!stats) {
      clearInterval(healthCheckInterval);
      return;
    }

    const timeSinceLastPing = Date.now() - stats.lastPingTime;
    const connectionDuration = Date.now() - stats.connectTime;

    console.log(
      `[心跳检测] 连接 ${socket.id} 状态:`,
      `连接时长 ${Math.floor(connectionDuration / 1000)}s,`,
      `上次心跳 ${Math.floor(timeSinceLastPing / 1000)}s 前,`,
      `总心跳次数 ${stats.pingCount}`,
    );

    // 如果超过 90 秒没有收到心跳，主动断开（服务器会自动处理，这里只是示例）
    if (timeSinceLastPing > 90000) {
      console.log(`[心跳检测] 连接 ${socket.id} 心跳超时，准备断开`);
      // socket.disconnect(); // 服务器会自动处理
    }
  }, 10000); // 每 10 秒检查一次

  // 监听断开连接
  socket.on("disconnect", (reason: string) => {
    const stats = connectionStats.get(socket.id);
    const duration = stats
      ? Math.floor((Date.now() - stats.connectTime) / 1000)
      : 0;

    console.log(
      `[心跳检测] 用户 ${socket.id} 断开连接:`,
      `原因: ${reason},`,
      `连接时长: ${duration}s,`,
      `总心跳次数: ${stats?.pingCount || 0}`,
    );

    // 清理统计信息
    connectionStats.delete(socket.id);
    clearInterval(healthCheckInterval);
  });

  // 监听错误
  socket.on("error", (error: any) => {
    console.error(`[心跳检测] 连接错误: ${socket.id}`, error);
    connectionStats.delete(socket.id);
    clearInterval(healthCheckInterval);
  });

  // 发送初始 ping（可选，服务器会自动发送）
  setTimeout(() => {
    socket.emit("ping", { timestamp: Date.now() });
  }, 5000); // 连接后 5 秒发送第一次 ping
});

// 定期输出所有连接的统计信息
setInterval(() => {
  console.log("\n[心跳检测] ===== 连接统计 =====");
  console.log(`总连接数: ${connectionStats.size}`);

  for (const [socketId, stats] of connectionStats.entries()) {
    const duration = Math.floor((Date.now() - stats.connectTime) / 1000);
    const timeSinceLastPing = Math.floor(
      (Date.now() - stats.lastPingTime) / 1000,
    );
    console.log(
      `  ${socketId}: 连接时长 ${duration}s, 上次心跳 ${timeSinceLastPing}s 前, 心跳次数 ${stats.pingCount}`,
    );
  }
  console.log("=============================\n");
}, 30000); // 每 30 秒输出一次

io.listen();
console.log("✅ 心跳检测示例服务器运行在 ws://localhost:8080/ws");
console.log("   心跳配置: pingInterval=30s, pingTimeout=60s");
