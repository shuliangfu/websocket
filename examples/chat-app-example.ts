/**
 * @fileoverview 完整聊天应用示例
 * 演示如何构建一个功能完整的实时聊天应用
 */

import { Server } from "../src/server.ts";
import { authMiddleware } from "../src/middleware.ts";

// 创建服务器
const io = new Server({
  port: 8080,
  path: "/ws",
});

// 用户数据存储（实际应用中应该使用数据库）
const users = new Map<string, {
  id: string;
  name: string;
  avatar?: string;
  rooms: Set<string>;
}>();

// 房间数据存储
const rooms = new Map<string, {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  members: Set<string>;
}>();

// 认证中间件（简化版）
io.use(
  authMiddleware(async (socket) => {
    const userId = socket.handshake.query.get("userId");
    const userName = socket.handshake.query.get("userName");

    if (!userId || !userName) {
      console.log(`[聊天应用] 认证失败: 缺少用户信息`);
      return false;
    }

    // 存储用户信息到 socket.data
    socket.data.user = {
      id: userId,
      name: userName,
    };

    console.log(`[聊天应用] 用户认证成功: ${userName} (${userId})`);
    return true;
  }),
);

// 连接处理
io.on("connection", (socket) => {
  const user = socket.data.user;
  if (!user) {
    socket.disconnect();
    return;
  }

  // 初始化用户数据
  users.set(user.id, {
    id: user.id,
    name: user.name,
    rooms: new Set(),
  });

  console.log(`[聊天应用] 用户连接: ${user.name} (${user.id})`);

  // 发送连接成功消息
  socket.emit("connected", {
    userId: user.id,
    userName: user.name,
    message: "连接成功",
  });

  /**
   * 创建房间
   * 客户端发送: socket.emit("create-room", { name: "房间名", description: "描述" })
   */
  socket.on("create-room", (data: { name: string; description?: string }, callback?: (result: any) => void) => {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const room = {
      id: roomId,
      name: data.name,
      description: data.description,
      createdAt: Date.now(),
      members: new Set<string>(),
    };

    rooms.set(roomId, room);
    room.members.add(user.id);

    // 用户加入房间
    socket.join(roomId);
    const userData = users.get(user.id);
    if (userData) {
      userData.rooms.add(roomId);
    }

    console.log(`[聊天应用] 用户 ${user.name} 创建房间: ${data.name} (${roomId})`);

    // 通知房间内其他成员（这里只有创建者）
    socket.to(roomId).emit("room-created", {
      roomId: roomId,
      roomName: data.name,
      createdBy: user.id,
    });

    if (callback) {
      callback({
        success: true,
        roomId: roomId,
        roomName: data.name,
      });
    }
  });

  /**
   * 加入房间
   * 客户端发送: socket.emit("join-room", "room-123")
   */
  socket.on("join-room", (roomId: string, callback?: (result: any) => void) => {
    const room = rooms.get(roomId);
    if (!room) {
      if (callback) {
        callback({ success: false, message: "房间不存在" });
      }
      return;
    }

    socket.join(roomId);
    room.members.add(user.id);
    const userData = users.get(user.id);
    if (userData) {
      userData.rooms.add(roomId);
    }

    console.log(`[聊天应用] 用户 ${user.name} 加入房间: ${room.name} (${roomId})`);

    // 通知房间内其他成员
    socket.to(roomId).emit("user-joined-room", {
      roomId: roomId,
      userId: user.id,
      userName: user.name,
      timestamp: Date.now(),
    });

    // 向当前用户发送房间信息
    socket.emit("room-info", {
      roomId: roomId,
      roomName: room.name,
      description: room.description,
      members: Array.from(room.members).map((memberId) => {
        const member = users.get(memberId);
        return member ? { id: member.id, name: member.name } : null;
      }).filter(Boolean),
    });

    if (callback) {
      callback({ success: true, roomId: roomId, roomName: room.name });
    }
  });

  /**
   * 离开房间
   * 客户端发送: socket.emit("leave-room", "room-123")
   */
  socket.on("leave-room", (roomId: string, callback?: (result: any) => void) => {
    const room = rooms.get(roomId);
    if (!room) {
      if (callback) {
        callback({ success: false, message: "房间不存在" });
      }
      return;
    }

    socket.leave(roomId);
    room.members.delete(user.id);
    const userData = users.get(user.id);
    if (userData) {
      userData.rooms.delete(roomId);
    }

    console.log(`[聊天应用] 用户 ${user.name} 离开房间: ${room.name} (${roomId})`);

    // 通知房间内其他成员
    socket.to(roomId).emit("user-left-room", {
      roomId: roomId,
      userId: user.id,
      userName: user.name,
      timestamp: Date.now(),
    });

    // 如果房间为空，删除房间
    if (room.members.size === 0) {
      rooms.delete(roomId);
      console.log(`[聊天应用] 房间 ${room.name} (${roomId}) 已删除（无成员）`);
    }

    if (callback) {
      callback({ success: true, roomId: roomId });
    }
  });

  /**
   * 发送房间消息
   * 客户端发送: socket.emit("room-message", { roomId: "room-123", message: "Hello" })
   */
  socket.on("room-message", (data: { roomId: string; message: string }, callback?: (result: any) => void) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      if (callback) {
        callback({ success: false, message: "房间不存在" });
      }
      return;
    }

    if (!room.members.has(user.id)) {
      if (callback) {
        callback({ success: false, message: "您不在该房间中" });
      }
      return;
    }

    const messageData = {
      roomId: data.roomId,
      userId: user.id,
      userName: user.name,
      message: data.message,
      timestamp: Date.now(),
    };

    console.log(
      `[聊天应用] 用户 ${user.name} 在房间 ${room.name} 发送消息: ${data.message}`,
    );

    // 向房间内所有成员（包括发送者）广播消息
    io.to(data.roomId).emit("room-message", messageData);

    if (callback) {
      callback({ success: true, messageId: `msg-${Date.now()}` });
    }
  });

  /**
   * 获取房间列表
   * 客户端发送: socket.emit("get-rooms", (rooms) => { ... })
   */
  socket.on("get-rooms", (callback?: (rooms: any[]) => void) => {
    const roomList = Array.from(rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      memberCount: room.members.size,
      createdAt: room.createdAt,
    }));

    if (callback) {
      callback(roomList);
    }
  });

  /**
   * 获取用户所在的房间
   * 客户端发送: socket.emit("get-my-rooms", (rooms) => { ... })
   */
  socket.on("get-my-rooms", (callback?: (rooms: any[]) => void) => {
    const userData = users.get(user.id);
    if (!userData || !callback) {
      if (callback) {
        callback([]);
      }
      return;
    }

    const myRooms = Array.from(userData.rooms).map((roomId) => {
      const room = rooms.get(roomId);
      if (!room) return null;
      return {
        id: room.id,
        name: room.name,
        description: room.description,
        memberCount: room.members.size,
      };
    }).filter(Boolean);

    callback(myRooms);
  });

  /**
   * 断开连接处理
   */
  socket.on("disconnect", (reason) => {
    console.log(`[聊天应用] 用户 ${user.name} 断开连接: ${reason}`);

    // 从所有房间中移除用户
    const userData = users.get(user.id);
    if (userData) {
      for (const roomId of userData.rooms) {
        const room = rooms.get(roomId);
        if (room) {
          room.members.delete(user.id);
          socket.to(roomId).emit("user-left-room", {
            roomId: roomId,
            userId: user.id,
            userName: user.name,
            timestamp: Date.now(),
          });

          // 如果房间为空，删除房间
          if (room.members.size === 0) {
            rooms.delete(roomId);
            console.log(`[聊天应用] 房间 ${room.name} (${roomId}) 已删除（无成员）`);
          }
        }
      }
    }

    // 删除用户数据
    users.delete(user.id);
  });
});

await io.listen();
console.log("✅ 聊天应用示例服务器运行在 ws://localhost:8080/ws");
console.log("   测试连接: ws://localhost:8080/ws?userId=user-123&userName=测试用户");
