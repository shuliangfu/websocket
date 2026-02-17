/**
 * @fileoverview 完整聊天应用示例
 * 演示一个使用加密的完整聊天应用场景
 */

import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";

/**
 * 完整的加密聊天应用
 * 包含用户认证、消息加密、房间管理等功能
 */
async function encryptedChatApp() {
  console.log("=== 加密聊天应用示例 ===\n");

  // 生成共享密钥（在实际应用中，应该通过安全的方式分发）
  const sharedKey = EncryptionManager.generateKey("aes-256");

  // 创建聊天服务器
  const server = new Server({
    port: 8120,
    path: "/chat",
    encryption: {
      key: sharedKey,
      algorithm: "aes-256-gcm",
    },
  });

  // 用户会话管理
  const userSessions = new Map<
    string,
    { username: string; socketId: string }
  >();
  const chatRooms = new Map<string, Set<string>>(); // 房间名 -> Socket ID 集合

  server.on("connection", (socket) => {
    console.log(`[服务器] 新客户端连接: ${socket.id}`);

    // 用户登录
    socket.on("login", (data: any) => {
      const { username, password } = data;

      // 简单的认证（实际应用中应该使用数据库）
      if (username && password) {
        userSessions.set(socket.id, { username, socketId: socket.id });
        console.log(`[服务器] 用户 ${username} 登录成功`);

        socket.emit("login-success", {
          username,
          socketId: socket.id,
          message: "登录成功",
        });

        // 通知其他用户
        socket.broadcast.emit("user-joined", {
          username,
          timestamp: Date.now(),
        });
      } else {
        socket.emit("login-failed", {
          message: "用户名或密码不能为空",
        });
      }
    });

    // 加入房间
    socket.on("join-room", (data: any) => {
      const session = userSessions.get(socket.id);
      if (!session) {
        socket.emit("error", { message: "请先登录" });
        return;
      }

      const roomName = data.room || "general";
      socket.join(roomName);

      if (!chatRooms.has(roomName)) {
        chatRooms.set(roomName, new Set());
      }
      chatRooms.get(roomName)!.add(socket.id);

      console.log(`[服务器] ${session.username} 加入房间: ${roomName}`);

      socket.emit("room-joined", {
        room: roomName,
        message: `已加入房间 ${roomName}`,
      });

      // 通知房间内其他用户
      socket.to(roomName).emit("user-joined-room", {
        username: session.username,
        room: roomName,
      });
    });

    // 发送聊天消息
    socket.on("chat-message", (data: any) => {
      const session = userSessions.get(socket.id);
      if (!session) {
        socket.emit("error", { message: "请先登录" });
        return;
      }

      const { room, message } = data;
      const chatMessage = {
        username: session.username,
        message,
        room: room || "general",
        timestamp: Date.now(),
      };

      console.log(
        `[服务器] ${session.username} 在房间 ${
          room || "general"
        } 发送消息: ${message}`,
      );

      // 广播到房间（所有消息都是加密的）
      socket.to(room || "general").emit("chat-message", chatMessage);

      // 也发送给自己（确认消息已发送）
      socket.emit("message-sent", {
        id: Date.now(),
        ...chatMessage,
      });
    });

    // 离开房间
    socket.on("leave-room", (data: any) => {
      const session = userSessions.get(socket.id);
      const roomName = data.room || "general";

      socket.leave(roomName);
      chatRooms.get(roomName)?.delete(socket.id);

      if (session) {
        console.log(`[服务器] ${session.username} 离开房间: ${roomName}`);
        socket.to(roomName).emit("user-left-room", {
          username: session.username,
          room: roomName,
        });
      }
    });

    // 断开连接
    socket.on("disconnect", () => {
      const session = userSessions.get(socket.id);
      if (session) {
        console.log(`[服务器] 用户 ${session.username} 断开连接`);
        userSessions.delete(socket.id);

        // 从所有房间中移除
        for (const [room, members] of chatRooms.entries()) {
          members.delete(socket.id);
          socket.to(room).emit("user-left", {
            username: session.username,
          });
        }
      }
    });
  });

  server.listen();
  console.log("[服务器] 聊天服务器已启动，端口: 8120");
  console.log("[服务器] 所有消息都使用 AES-256-GCM 加密\n");

  // 等待服务器启动
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 创建多个客户端模拟聊天
  const clients: Client[] = [];

  // 客户端 1: Alice
  const alice = new Client({
    url: "ws://localhost:8120/chat",
    encryption: {
      key: sharedKey,
    },
  });

  alice.on("open", () => {
    console.log("[Alice] 已连接到服务器");
    alice.emit("login", {
      username: "Alice",
      password: "alice123",
    });
  });

  alice.on("login-success", (data: any) => {
    console.log("[Alice] 登录成功:", data.username);
    alice.emit("join-room", { room: "general" });
  });

  alice.on("room-joined", (data: any) => {
    console.log(`[Alice] 已加入房间: ${data.room}`);
    setTimeout(() => {
      alice.emit("chat-message", {
        room: "general",
        message: "大家好！我是 Alice",
      });
    }, 500);
  });

  alice.on("chat-message", (data: any) => {
    console.log(
      `[Alice] 收到消息 [${data.room}]: ${data.username}: ${data.message}`,
    );
  });

  alice.on("user-joined-room", (data: any) => {
    console.log(`[Alice] ${data.username} 加入了房间 ${data.room}`);
  });

  clients.push(alice);

  // 等待一下，然后创建第二个客户端
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 客户端 2: Bob
  const bob = new Client({
    url: "ws://localhost:8120/chat",
    encryption: {
      key: sharedKey,
    },
  });

  bob.on("open", () => {
    console.log("[Bob] 已连接到服务器");
    bob.emit("login", {
      username: "Bob",
      password: "bob123",
    });
  });

  bob.on("login-success", (data: any) => {
    console.log("[Bob] 登录成功:", data.username);
    bob.emit("join-room", { room: "general" });
  });

  bob.on("room-joined", (data: any) => {
    console.log(`[Bob] 已加入房间: ${data.room}`);
    setTimeout(() => {
      bob.emit("chat-message", {
        room: "general",
        message: "Hello Alice! 我是 Bob",
      });
    }, 500);
  });

  bob.on("chat-message", (data: any) => {
    console.log(
      `[Bob] 收到消息 [${data.room}]: ${data.username}: ${data.message}`,
    );
  });

  clients.push(bob);

  // 运行一段时间后关闭
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\n[关闭] 断开所有客户端连接");
  for (const client of clients) {
    client.disconnect();
  }

  await server.close();
  console.log("[关闭] 服务器已关闭");
}

/**
 * 带回调的加密消息示例
 * 演示如何使用回调机制确认消息接收
 */
async function callbackExample() {
  console.log("\n=== 回调机制示例 ===\n");

  const key = EncryptionManager.generateKey("aes-256");

  const server = new Server({
    port: 8121,
    path: "/ws",
    encryption: {
      key,
    },
  });

  server.on("connection", (socket) => {
    socket.on("request", (data: any, callback: (response: any) => void) => {
      console.log(`[服务端] 收到请求:`, data);

      // 使用回调发送响应（响应也会被加密）
      if (callback) {
        callback({
          status: "success",
          echo: data.query,
          processed: true,
        });
      }
    });
  });

  server.listen();
  console.log("[服务端] 回调服务器已启动，端口: 8121\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const client = new Client({
    url: "ws://localhost:8121/ws",
    encryption: {
      key,
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接");

    // 发送带回调的请求
    client.emit("request", { query: "test query" }, async (response: any) => {
      console.log("[客户端] 收到回调响应（已解密）:", response);
      client.disconnect();
      await server.close();
    });
  });
}

// 运行所有示例
if (import.meta.main) {
  await encryptedChatApp();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await callbackExample();
  console.log("\n=== 所有示例运行完成 ===");
}
