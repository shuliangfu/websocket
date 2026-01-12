/**
 * @fileoverview 命名空间示例
 * 演示如何使用命名空间隔离不同的业务场景
 */

import { Server } from "../src/server.ts";

const io = new Server({
  port: 8080,
  path: "/ws",
});

// 默认命名空间 "/"
io.on("connection", (socket) => {
  console.log(`[默认命名空间] 用户 ${socket.id} 已连接`);

  socket.on("message", (data: any) => {
    console.log(`[默认命名空间] 收到消息:`, data);
    socket.emit("response", { message: "来自默认命名空间的响应" });
  });

  socket.on("disconnect", () => {
    console.log(`[默认命名空间] 用户 ${socket.id} 断开连接`);
  });
});

// 创建聊天命名空间 "/chat"
const chatNamespace = io.of("/chat");
chatNamespace.on("connection", (socket) => {
  console.log(`[聊天命名空间] 用户 ${socket.id} 已连接`);

  socket.on("message", (data: any) => {
    console.log(`[聊天命名空间] 收到消息:`, data);
  });

  socket.on("chat-message", (data: any) => {
    console.log(`[聊天命名空间] 收到聊天消息:`, data);

    // 向聊天命名空间内所有用户广播消息（使用 socket.broadcast）
    socket.broadcast.emit("chat-message", {
      userId: socket.id,
      message: data.message,
      timestamp: Date.now(),
    });
  });

  socket.on("join-room", (roomId: string) => {
    socket.join(roomId);
    console.log(`[聊天命名空间] 用户 ${socket.id} 加入房间: ${roomId}`);
    socket.to(roomId).emit("user-joined", { userId: socket.id });
  });

  socket.on("disconnect", () => {
    console.log(`[聊天命名空间] 用户 ${socket.id} 断开连接`);
  });
});

// 创建游戏命名空间 "/game"
const gameNamespace = io.of("/game");
gameNamespace.on("connection", (socket) => {
  console.log(`[游戏命名空间] 用户 ${socket.id} 已连接`);

  socket.on("game-action", (data: any) => {
    console.log(`[游戏命名空间] 收到游戏动作:`, data);

    // 向游戏房间广播动作
    if (data.roomId) {
      socket.to(data.roomId).emit("game-action", {
        userId: socket.id,
        action: data.action,
        timestamp: Date.now(),
      });
    }
  });

  socket.on("join-game", (gameId: string) => {
    socket.join(gameId);
    console.log(`[游戏命名空间] 用户 ${socket.id} 加入游戏: ${gameId}`);
    socket.to(gameId).emit("player-joined", { playerId: socket.id });
  });

  socket.on("disconnect", () => {
    console.log(`[游戏命名空间] 用户 ${socket.id} 断开连接`);
  });
});

// 创建通知命名空间 "/notification"
const notificationNamespace = io.of("/notification");
notificationNamespace.on("connection", (socket) => {
  console.log(`[通知命名空间] 用户 ${socket.id} 已连接`);

  // 用户订阅通知
  socket.on("subscribe", (userId: string) => {
    socket.join(`user-${userId}`);
    console.log(`[通知命名空间] 用户 ${socket.id} 订阅通知: user-${userId}`);
  });

  // 用户取消订阅
  socket.on("unsubscribe", (userId: string) => {
    socket.leave(`user-${userId}`);
    console.log(`[通知命名空间] 用户 ${socket.id} 取消订阅: user-${userId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[通知命名空间] 用户 ${socket.id} 断开连接`);
  });
});

// 模拟发送通知（实际应用中可能由其他服务触发）
// 注意：实际应用中应该通过 socket 发送，这里只是示例
// 可以通过存储 socket 引用来实现
const notificationSockets = new Map<string, any>();
notificationNamespace.on("connection", (socket) => {
  socket.on("subscribe", (userId: string) => {
    notificationSockets.set(`user-${userId}`, socket);
  });
});

setInterval(() => {
  // 向所有已订阅的用户发送通知（实际应用中应该遍历所有订阅的 socket）
  // 这里只是示例，实际应该通过 socket 发送
  console.log("[通知命名空间] 模拟发送系统通知");
}, 10000); // 每 10 秒发送一次

io.listen();
console.log("✅ 命名空间示例服务器运行在 ws://localhost:8080/ws");
console.log("   默认命名空间: ws://localhost:8080/ws");
console.log("   聊天命名空间: ws://localhost:8080/ws/chat");
console.log("   游戏命名空间: ws://localhost:8080/ws/game");
console.log("   通知命名空间: ws://localhost:8080/ws/notification");
