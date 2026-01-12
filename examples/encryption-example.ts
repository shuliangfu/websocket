/**
 * @fileoverview 消息加密示例
 * 演示如何使用 WebSocket 的消息加密功能
 */

import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";

// 示例 1: 服务端启用加密
async function serverExample() {
  // 生成密钥（32 字节用于 AES-256）
  const key = EncryptionManager.generateKey("aes-256");

  // 创建服务器，启用加密
  const server = new Server({
    port: 8080,
    encryption: {
      key, // 使用生成的密钥
      algorithm: "aes-256-gcm", // 使用 GCM 模式（推荐，带认证）
      enabled: true,
    },
  });

  server.on("connection", (socket) => {
    console.log(`客户端连接: ${socket.id}`);

    // 接收消息（自动解密）
    socket.on("chat", (data: any) => {
      console.log("收到消息（已自动解密）:", data);
      // 发送响应（自动加密）
      socket.emit("response", { status: "ok", message: "消息已收到" });
    });
  });

  server.listen();
  console.log("WebSocket 服务器已启动，端口: 8080");
  console.log("加密已启用，密钥长度:", key.length, "字节");
}

// 示例 2: 客户端启用加密
async function clientExample() {
  // 使用与服务端相同的密钥
  const key = new Uint8Array(32);
  // 在实际应用中，密钥应该通过安全的方式共享
  // 例如：通过 HTTPS 握手时交换，或使用预共享密钥

  // 创建客户端，启用加密
  const client = new Client({
    url: "ws://localhost:8080",
    encryption: {
      key, // 使用与服务端相同的密钥
      algorithm: "aes-256-gcm",
      enabled: true,
    },
  });

  client.on("open", () => {
    console.log("已连接到服务器");

    // 发送消息（自动加密）
    client.emit("chat", {
      text: "这是一条加密消息",
      timestamp: Date.now(),
    });
  });

  client.on("response", (data) => {
    console.log("收到服务器响应（已自动解密）:", data);
  });

  client.on("error", (error) => {
    console.error("连接错误:", error);
  });
}

// 示例 3: 使用字符串密钥（从密码派生）
async function passwordBasedExample() {
  const password = "my-secret-password";

  // 从密码派生密钥
  const key = await EncryptionManager.deriveKeyFromPassword(
    password,
    "aes-256",
  );

  // 服务端
  const server = new Server({
    port: 8081,
    encryption: {
      key,
      algorithm: "aes-256-gcm",
    },
  });

  server.on("connection", (socket) => {
    socket.on("message", (data: any) => {
      console.log("收到加密消息:", data);
      socket.emit("reply", { received: true });
    });
  });

  server.listen();

  // 客户端（使用相同的密码）
  const clientKey = await EncryptionManager.deriveKeyFromPassword(
    password,
    "aes-256",
  );

  const client = new Client({
    url: "ws://localhost:8081",
    encryption: {
      key: clientKey,
      algorithm: "aes-256-gcm",
    },
  });

  client.on("open", () => {
    client.emit("message", { text: "使用密码派生的密钥加密" });
  });
}

// 示例 4: 条件加密（某些消息不加密）
async function conditionalEncryptionExample() {
  const key = EncryptionManager.generateKey("aes-256");

  const server = new Server({
    port: 8082,
    encryption: {
      key,
      algorithm: "aes-256-gcm",
      enabled: true, // 默认启用加密
    },
  });

  server.on("connection", (socket) => {
    // 所有通过 emit 发送的消息都会自动加密
    socket.on("sensitive-data", (data: any) => {
      // 接收到的消息已自动解密
      console.log("敏感数据（已解密）:", data);
    });

    // 如果需要发送未加密的消息，可以使用 sendBinary
    // 但注意：sendBinary 发送的是二进制数据，不是 JSON
  });

  server.listen();
}

// 运行示例
if (import.meta.main) {
  console.log("=== WebSocket 消息加密示例 ===\n");

  // 运行服务端示例
  await serverExample();

  // 等待 1 秒后运行客户端示例
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await clientExample();
}
