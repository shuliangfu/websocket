/**
 * @fileoverview 基于密码的加密示例
 * 演示如何从密码派生密钥，适合用户密码场景
 */

import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";

/**
 * 示例 1: 从用户密码派生密钥
 * 适合需要基于用户密码进行加密的场景
 */
async function passwordBasedKeyExample() {
  console.log("=== 示例 1: 从密码派生密钥 ===\n");

  // 用户密码（在实际应用中，这应该来自用户输入）
  const userPassword = "my-secret-password-123";

  // 从密码派生 32 字节密钥（用于 AES-256）
  const serverKey = await EncryptionManager.deriveKeyFromPassword(
    userPassword,
    "aes-256",
  );

  const server = new Server({
    port: 8090,
    path: "/ws",
    encryption: {
      key: serverKey,
      algorithm: "aes-256-gcm",
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    socket.on("login", async (data: any) => {
      console.log(`[服务端] 收到登录请求:`, data.username);

      // 客户端也需要使用相同的密码派生密钥
      // 在实际应用中，密码应该通过安全的方式传输（如 HTTPS）
      const clientKey = await EncryptionManager.deriveKeyFromPassword(
        userPassword,
        "aes-256",
      );

      // 验证密钥是否匹配
      const keysMatch = serverKey.every((byte, i) => byte === clientKey[i]);
      console.log(`[服务端] 密钥匹配: ${keysMatch}`);

      socket.emit("login-success", {
        message: "登录成功",
        sessionId: `session-${Date.now()}`,
      });
    });
  });

  server.listen();
  console.log("[服务端] 服务器已启动，端口: 8090");
  console.log("[服务端] 使用密码派生密钥\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 客户端使用相同的密码派生密钥
  const clientKey = await EncryptionManager.deriveKeyFromPassword(
    userPassword,
    "aes-256",
  );

  const client = new Client({
    url: "ws://localhost:8090/ws",
    encryption: {
      key: clientKey,
      algorithm: "aes-256-gcm",
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接到服务器");
    client.emit("login", {
      username: "alice",
      password: "hashed-password", // 实际应用中应该是哈希后的密码
    });
  });

  client.on("login-success", async (data: any) => {
    console.log("[客户端] 登录成功:", data);
    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 2: 不同密码派生不同密钥
 * 演示相同密码总是派生相同密钥，不同密码派生不同密钥
 */
async function passwordConsistencyExample() {
  console.log("\n=== 示例 2: 密码派生的一致性 ===\n");

  const password1 = "password123";
  const password2 = "password123"; // 相同密码
  const password3 = "password456"; // 不同密码

  // 从相同密码派生密钥
  const key1a = await EncryptionManager.deriveKeyFromPassword(
    password1,
    "aes-256",
  );
  const key1b = await EncryptionManager.deriveKeyFromPassword(
    password2,
    "aes-256",
  );

  // 从不同密码派生密钥
  const key2 = await EncryptionManager.deriveKeyFromPassword(
    password3,
    "aes-256",
  );

  // 验证相同密码派生相同密钥
  const samePasswordSameKey = key1a.every((byte, i) => byte === key1b[i]);
  console.log(`相同密码派生相同密钥: ${samePasswordSameKey}`);

  // 验证不同密码派生不同密钥
  const differentPasswordDifferentKey = key1a.some(
    (byte, i) => byte !== key2[i],
  );
  console.log(`不同密码派生不同密钥: ${differentPasswordDifferentKey}\n`);

  // 实际应用示例
  const server = new Server({
    port: 8091,
    path: "/ws",
    encryption: {
      key: key1a, // 使用 password1 派生的密钥
    },
  });

  server.on("connection", (socket) => {
    socket.on("message", (data: any) => {
      console.log("[服务端] 收到消息:", data);
      socket.emit("reply", { echo: data.text });
    });
  });

  server.listen();

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 客户端使用相同的密码（password2，与 password1 相同）
  const clientKey = await EncryptionManager.deriveKeyFromPassword(
    password2,
    "aes-256",
  );

  const client = new Client({
    url: "ws://localhost:8091/ws",
    encryption: {
      key: clientKey, // 应该与服务端密钥匹配
    },
  });

  client.on("open", () => {
    client.emit("message", { text: "使用相同密码派生的密钥" });
  });

  client.on("reply", async (data: any) => {
    console.log("[客户端] 收到回复:", data);
    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 3: 多用户场景
 * 每个用户使用自己的密码派生密钥
 */
async function multiUserExample() {
  console.log("\n=== 示例 3: 多用户场景 ===\n");

  // 模拟用户数据库
  const users = [
    { id: "user1", password: "password1" },
    { id: "user2", password: "password2" },
    { id: "user3", password: "password3" },
  ];

  // 为每个用户派生密钥
  const userKeys = new Map<string, Uint8Array>();
  for (const user of users) {
    const key = await EncryptionManager.deriveKeyFromPassword(
      user.password,
      "aes-256",
    );
    userKeys.set(user.id, key);
    console.log(`[用户 ${user.id}] 密钥已生成`);
  }

  // 服务端需要知道所有用户的密钥（在实际应用中，应该存储在数据库中）
  const server = new Server({
    port: 8092,
    path: "/ws",
    // 注意：服务端只能使用一个密钥，所以这个示例展示的是
    // 客户端使用不同密钥连接的情况
    encryption: {
      key: userKeys.get("user1")!, // 使用 user1 的密钥作为默认
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 新客户端连接: ${socket.id}`);

    socket.on("identify", (data: any) => {
      const userId = data.userId;
      const userKey = userKeys.get(userId);

      if (userKey) {
        console.log(`[服务端] 用户 ${userId} 已识别`);
        socket.emit("identified", { userId, status: "ok" });
      } else {
        socket.emit("error", { message: "用户不存在" });
      }
    });
  });

  server.listen();
  console.log("[服务端] 多用户服务器已启动\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 模拟 user1 连接
  const user1Key = userKeys.get("user1")!;
  const client1 = new Client({
    url: "ws://localhost:8092/ws",
    encryption: {
      key: user1Key,
    },
  });

  client1.on("open", () => {
    console.log("[客户端 user1] 已连接");
    client1.emit("identify", { userId: "user1" });
  });

  client1.on("identified", async (data: any) => {
    console.log("[客户端 user1] 已识别:", data);
    client1.disconnect();
    await server.close();
  });
}

// 运行所有示例
if (import.meta.main) {
  await passwordBasedKeyExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await passwordConsistencyExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await multiUserExample();
  console.log("\n=== 所有示例运行完成 ===");
}
