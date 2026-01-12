/**
 * @fileoverview 混合加密场景示例
 * 演示一方加密一方不加密的场景
 */

import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";

/**
 * 示例 1: 服务端不加密，客户端加密
 * 适合客户端需要保护隐私，但服务端不需要加密的场景
 */
async function clientOnlyEncryptionExample() {
  console.log("=== 示例 1: 仅客户端加密 ===\n");

  const key = EncryptionManager.generateKey("aes-256");

  // 服务端不启用加密
  const server = new Server({
    port: 8100,
    path: "/ws",
    // 不配置 encryption，服务端不加密
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);
    console.log(`[服务端] 注意：服务端未启用加密`);

    // 服务端会收到加密的 Base64 字符串
    // 如果没有加密管理器，会触发 "encrypted" 事件
    socket.on("encrypted", (data: any) => {
      console.log(`[服务端] 收到加密消息（Base64）:`, data);
      console.log(`[服务端] 消息长度: ${data.length} 字符`);
      // 服务端无法解密，但可以记录或转发
    });

    // 服务端发送未加密消息
    socket.emit("server-message", {
      text: "这是服务端的未加密消息",
      timestamp: Date.now(),
    });
  });

  server.listen();
  console.log("[服务端] 服务器已启动（未加密），端口: 8100\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 客户端启用加密
  const client = new Client({
    url: "ws://localhost:8100/ws",
    encryption: {
      key,
      algorithm: "aes-256-gcm",
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接到服务器（客户端启用加密）");

    // 客户端发送的消息会被加密
    client.emit("encrypted", {
      sensitive: "这是客户端的加密消息",
      data: "只有客户端知道密钥",
    });
  });

  client.on("server-message", (data: any) => {
    console.log("[客户端] 收到服务端消息（未加密）:", data);
    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 2: 服务端加密，客户端不加密
 * 适合服务端需要保护数据，但客户端不需要加密的场景
 */
async function serverOnlyEncryptionExample() {
  console.log("\n=== 示例 2: 仅服务端加密 ===\n");

  const key = EncryptionManager.generateKey("aes-256");

  // 服务端启用加密
  const server = new Server({
    port: 8101,
    path: "/ws",
    encryption: {
      key,
      algorithm: "aes-256-gcm",
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);
    console.log(`[服务端] 服务端已启用加密`);

    // 服务端接收未加密消息
    socket.on("message", (data: any) => {
      console.log(`[服务端] 收到客户端消息（未加密）:`, data);

      // 服务端发送加密消息
      socket.emit("encrypted-response", {
        text: "这是服务端的加密消息",
        secret: "只有服务端知道密钥",
      });
    });
  });

  server.listen();
  console.log("[服务端] 服务器已启动（已加密），端口: 8101\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 客户端不启用加密
  const client = new Client({
    url: "ws://localhost:8101/ws",
    // 不配置 encryption，客户端不加密
  });

  client.on("open", () => {
    console.log("[客户端] 已连接到服务器（客户端未启用加密）");

    // 客户端发送未加密消息
    client.emit("message", {
      text: "这是客户端的未加密消息",
      public: true,
    });
  });

  // 客户端会收到加密的 Base64 字符串
  client.on("encrypted", (data: any) => {
    console.log(`[客户端] 收到服务端加密消息（Base64）:`, data);
    console.log(`[客户端] 无法解密，因为客户端未配置密钥`);
    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 3: 选择性加密
 * 某些消息加密，某些消息不加密
 */
async function selectiveEncryptionExample() {
  console.log("\n=== 示例 3: 选择性加密 ===\n");

  const key = EncryptionManager.generateKey("aes-256");

  const server = new Server({
    port: 8102,
    path: "/ws",
    encryption: {
      key,
      algorithm: "aes-256-gcm",
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    // 接收加密消息
    socket.on("sensitive", (data: any) => {
      console.log(`[服务端] 收到敏感消息（已解密）:`, data);
    });

    // 接收未加密消息（通过特殊事件）
    socket.on("public", (data: any) => {
      console.log(`[服务端] 收到公开消息:`, data);
    });

    // 发送加密消息
    socket.emit("secret", {
      type: "encrypted",
      data: "这是加密的敏感数据",
    });

    // 发送未加密消息（通过特殊方式）
    // 注意：由于 emit 会自动加密，这里需要特殊处理
    // 实际应用中，可以使用二进制消息或特殊标记
  });

  server.listen();
  console.log("[服务端] 服务器已启动，端口: 8102\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const client = new Client({
    url: "ws://localhost:8102/ws",
    encryption: {
      key,
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接");

    // 发送敏感消息（会被加密）
    client.emit("sensitive", {
      password: "secret123",
      creditCard: "1234-5678-9012-3456",
    });

    // 发送公开消息（也会被加密，因为客户端启用了加密）
    // 如果需要发送未加密消息，需要禁用客户端的加密
    client.emit("public", {
      username: "alice",
      message: "这是公开消息",
    });
  });

  client.on("secret", (data: any) => {
    console.log("[客户端] 收到服务端加密消息（已解密）:", data);
    client.disconnect();
    await server.close();
  });
}

// 运行所有示例
if (import.meta.main) {
  await clientOnlyEncryptionExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await serverOnlyEncryptionExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await selectiveEncryptionExample();
  console.log("\n=== 所有示例运行完成 ===");
}
