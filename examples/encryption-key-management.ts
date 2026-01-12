/**
 * @fileoverview 密钥管理示例
 * 演示如何安全地管理和分发加密密钥
 */

import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";

/**
 * 示例 1: 密钥轮换
 * 演示如何在运行时更换加密密钥
 */
async function keyRotationExample() {
  console.log("=== 示例 1: 密钥轮换 ===\n");

  // 初始密钥
  let currentKey = EncryptionManager.generateKey("aes-256");
  console.log("[密钥管理] 初始密钥已生成");

  const server = new Server({
    port: 8130,
    path: "/ws",
    encryption: {
      key: currentKey,
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    socket.on("request-key-rotation", () => {
      console.log("[服务端] 收到密钥轮换请求");

      // 生成新密钥
      const newKey = EncryptionManager.generateKey("aes-256");
      console.log("[服务端] 新密钥已生成");

      // 使用旧密钥加密新密钥（在实际应用中，应该使用更安全的方式）
      // 这里只是演示，实际应该通过安全通道传输
      socket.emit("new-key", {
        // 注意：这里只是演示，实际应用中需要更安全的密钥分发机制
        message: "新密钥已生成，请重新连接",
        keyRotationRequired: true,
      });

      // 更新服务器密钥（注意：这需要重新创建 Server 实例）
      // 在实际应用中，应该实现动态密钥更新机制
      currentKey = newKey;
    });

    socket.on("message", (data: any) => {
      console.log("[服务端] 收到消息:", data);
      socket.emit("response", { received: true });
    });
  });

  server.listen();
  console.log("[服务端] 密钥轮换服务器已启动，端口: 8130\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const client = new Client({
    url: "ws://localhost:8130/ws",
    encryption: {
      key: currentKey,
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接（使用初始密钥）");
    client.emit("message", { text: "使用初始密钥加密的消息" });
  });

  client.on("response", (data: any) => {
    console.log("[客户端] 收到响应:", data);

    // 请求密钥轮换
    setTimeout(() => {
      client.emit("request-key-rotation");
    }, 500);
  });

  client.on("new-key", (data: any) => {
    console.log("[客户端] 收到密钥轮换通知:", data);
    console.log("[客户端] 注意：实际应用中需要重新连接并使用新密钥");
    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 2: 多密钥场景
 * 不同房间使用不同的加密密钥
 */
async function multiKeyExample() {
  console.log("\n=== 示例 2: 多密钥场景 ===\n");

  // 为不同房间生成不同的密钥
  const roomKeys = new Map<string, Uint8Array>();
  roomKeys.set("room1", EncryptionManager.generateKey("aes-256"));
  roomKeys.set("room2", EncryptionManager.generateKey("aes-256"));
  roomKeys.set("room3", EncryptionManager.generateKey("aes-256"));

  console.log("[密钥管理] 已为 3 个房间生成密钥");

  // 注意：Server 只能使用一个密钥
  // 这个示例展示的是概念，实际应用中需要更复杂的实现
  const defaultKey = roomKeys.get("room1")!;

  const server = new Server({
    port: 8131,
    path: "/ws",
    encryption: {
      key: defaultKey, // 使用 room1 的密钥作为默认
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    socket.on("join-room", (data: any) => {
      const room = data.room;
      const key = roomKeys.get(room);

      if (key) {
        console.log(`[服务端] 客户端加入房间: ${room}`);
        console.log(`[服务端] 房间 ${room} 使用独立密钥`);

        socket.emit("room-joined", {
          room,
          message: `已加入房间 ${room}`,
        });
      } else {
        socket.emit("error", {
          message: `房间 ${room} 不存在`,
        });
      }
    });

    socket.on("room-message", (data: any) => {
      console.log(`[服务端] 收到房间消息:`, data);
      socket.emit("room-response", {
        room: data.room,
        echo: data.message,
      });
    });
  });

  server.listen();
  console.log("[服务端] 多密钥服务器已启动，端口: 8131");
  console.log("[服务端] 注意：实际实现中需要支持动态密钥切换\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 客户端连接 room1
  const client1 = new Client({
    url: "ws://localhost:8131/ws",
    encryption: {
      key: roomKeys.get("room1")!,
    },
  });

  client1.on("open", () => {
    console.log("[客户端 room1] 已连接");
    client1.emit("join-room", { room: "room1" });
  });

  client1.on("room-joined", (data: any) => {
    console.log(`[客户端 room1] ${data.message}`);
    client1.emit("room-message", {
      room: "room1",
      message: "这是 room1 的消息",
    });
  });

  client1.on("room-response", (data: any) => {
    console.log(`[客户端 room1] 收到响应:`, data);
    client1.disconnect();
    await server.close();
  });
}

/**
 * 示例 3: 密钥存储和恢复
 * 演示如何保存和恢复加密密钥
 */
async function keyStorageExample() {
  console.log("\n=== 示例 3: 密钥存储和恢复 ===\n");

  // 生成密钥
  const key = EncryptionManager.generateKey("aes-256");

  // 将密钥转换为 Base64 字符串以便存储
  const keyBase64 = btoa(String.fromCharCode(...key));
  console.log("[密钥管理] 密钥已生成");
  console.log(`[密钥管理] Base64 编码: ${keyBase64.substring(0, 20)}...`);

  // 模拟保存到文件或数据库
  const savedKey = keyBase64;
  console.log("[密钥管理] 密钥已保存（Base64 格式）");

  // 从 Base64 恢复密钥
  const restoredKey = new Uint8Array(
    atob(savedKey).split("").map((c) => c.charCodeAt(0)),
  );
  console.log("[密钥管理] 密钥已恢复");

  // 验证密钥是否匹配
  const keysMatch = key.every((byte, i) => byte === restoredKey[i]);
  console.log(`[密钥管理] 密钥匹配: ${keysMatch}\n`);

  // 使用恢复的密钥创建服务器
  const server = new Server({
    port: 8132,
    path: "/ws",
    encryption: {
      key: restoredKey,
    },
  });

  server.on("connection", (socket) => {
    socket.on("test", (data: any) => {
      console.log("[服务端] 收到测试消息:", data);
      socket.emit("test-response", { success: true });
    });
  });

  server.listen();
  console.log("[服务端] 密钥存储服务器已启动，端口: 8132\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 客户端使用原始密钥
  const client = new Client({
    url: "ws://localhost:8132/ws",
    encryption: {
      key, // 使用原始密钥
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接（使用原始密钥）");
    client.emit("test", { message: "测试密钥存储和恢复" });
  });

  client.on("test-response", (data: any) => {
    console.log("[客户端] 收到响应:", data);
    console.log("[客户端] 密钥存储和恢复测试成功");
    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 4: 密钥派生参数
 * 演示如何使用不同的参数派生密钥
 */
async function keyDerivationExample() {
  console.log("\n=== 示例 4: 密钥派生参数 ===\n");

  const passwords = [
    "password1",
    "password2",
    "password3",
  ];

  console.log("[密钥管理] 从不同密码派生密钥:");

  for (const password of passwords) {
    const key = await EncryptionManager.deriveKeyFromPassword(
      password,
      "aes-256",
    );
    const keyHex = Array.from(key)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 16);
    console.log(`  密码: ${password} -> 密钥: ${keyHex}...`);
  }

  // 演示相同密码总是派生相同密钥
  console.log("\n[密钥管理] 验证相同密码派生相同密钥:");
  const key1 = await EncryptionManager.deriveKeyFromPassword(
    "test-password",
    "aes-256",
  );
  const key2 = await EncryptionManager.deriveKeyFromPassword(
    "test-password",
    "aes-256",
  );
  const same = key1.every((byte, i) => byte === key2[i]);
  console.log(`  结果: ${same}`);

  // 实际应用示例
  const serverKey = await EncryptionManager.deriveKeyFromPassword(
    "server-secret-password",
    "aes-256",
  );

  const server = new Server({
    port: 8133,
    path: "/ws",
    encryption: {
      key: serverKey,
    },
  });

  server.on("connection", (socket) => {
    socket.on("authenticate", async (data: any) => {
      const { password } = data;

      // 从用户密码派生密钥
      const userKey = await EncryptionManager.deriveKeyFromPassword(
        password,
        "aes-256",
      );

      // 验证密钥是否匹配（在实际应用中，应该使用更安全的方式）
      const keysMatch = serverKey.every((byte, i) => byte === userKey[i]);

      if (keysMatch) {
        socket.emit("auth-success", {
          message: "认证成功",
        });
      } else {
        socket.emit("auth-failed", {
          message: "认证失败",
        });
      }
    });
  });

  server.listen();
  console.log("\n[服务端] 密钥派生服务器已启动，端口: 8133\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const clientKey = await EncryptionManager.deriveKeyFromPassword(
    "server-secret-password", // 使用相同的密码
    "aes-256",
  );

  const client = new Client({
    url: "ws://localhost:8133/ws",
    encryption: {
      key: clientKey,
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接");
    client.emit("authenticate", {
      password: "server-secret-password",
    });
  });

  client.on("auth-success", (data: any) => {
    console.log("[客户端] 认证成功:", data);
    client.disconnect();
    await server.close();
  });

  client.on("auth-failed", (data: any) => {
    console.log("[客户端] 认证失败:", data);
    client.disconnect();
    await server.close();
  });
}

// 运行所有示例
if (import.meta.main) {
  await keyRotationExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await multiKeyExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await keyStorageExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await keyDerivationExample();
  console.log("\n=== 所有示例运行完成 ===");
}
