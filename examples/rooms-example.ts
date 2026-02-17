/**
 * @fileoverview 房间管理示例
 * 演示如何使用房间功能实现群组聊天、游戏房间等功能
 */

import { Server } from "../src/server.ts";

const io = new Server({
  port: 8080,
  path: "/ws",
});

io.on("connection", (socket) => {
  console.log(`[房间管理] 用户 ${socket.id} 已连接`);

  /**
   * 加入房间
   * 客户端发送: socket.emit("join-room", "room-123")
   */
  socket.on("join-room", (roomId: string) => {
    socket.join(roomId);
    console.log(`[房间管理] 用户 ${socket.id} 加入房间: ${roomId}`);

    // 通知房间内其他用户
    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
      roomId: roomId,
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
    console.log(`[房间管理] 用户 ${socket.id} 离开房间: ${roomId}`);

    // 通知房间内其他用户
    socket.to(roomId).emit("user-left", {
      userId: socket.id,
      roomId: roomId,
      timestamp: Date.now(),
    });

    // 向当前用户发送确认
    socket.emit("room-left", {
      roomId: roomId,
      message: `已离开房间 ${roomId}`,
    });
  });

  /**
   * 向房间发送消息
   * 客户端发送: socket.emit("room-message", { roomId: "room-123", message: "Hello" })
   */
  socket.on("room-message", (data: { roomId: string; message: string }) => {
    const { roomId, message } = data;
    console.log(
      `[房间管理] 用户 ${socket.id} 在房间 ${roomId} 发送消息: ${message}`,
    );

    // 向房间内所有用户（除了发送者）广播消息
    socket.to(roomId).emit("room-message", {
      userId: socket.id,
      roomId: roomId,
      message: message,
      timestamp: Date.now(),
    });
  });

  /**
   * 获取房间信息
   * 客户端发送: socket.emit("get-room-info", "room-123", (info) => { ... })
   */
  socket.on(
    "get-room-info",
    (roomId: string, callback?: (info: any) => void) => {
      // 注意：这里需要访问 roomManager，实际实现可能需要扩展 API
      console.log(`[房间管理] 用户 ${socket.id} 查询房间信息: ${roomId}`);

      if (callback) {
        callback({
          roomId: roomId,
          // 实际实现中需要从 roomManager 获取
          message: "房间信息查询功能需要扩展 API",
        });
      }
    },
  );

  /**
   * 向所有连接广播消息（除了发送者）
   * 客户端发送: socket.emit("broadcast-message", "Hello everyone")
   */
  socket.on("broadcast-message", (message: string) => {
    console.log(`[房间管理] 用户 ${socket.id} 广播消息: ${message}`);

    socket.broadcast.emit("broadcast-message", {
      userId: socket.id,
      message: message,
      timestamp: Date.now(),
    });
  });

  /**
   * 断开连接时自动离开所有房间
   */
  socket.on("disconnect", (reason: string) => {
    console.log(`[房间管理] 用户 ${socket.id} 断开连接: ${reason}`);
    // Socket 断开时会自动清理房间关系
  });
});

io.listen();
console.log("✅ 房间管理示例服务器运行在 ws://localhost:8080/ws");
