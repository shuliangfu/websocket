/**
 * @fileoverview 基础加密示例
 * 演示 WebSocket 消息加密的基本用法
 */

import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";

/**
 * 示例 1: 最简单的加密配置
 * 使用自动生成的密钥和默认算法
 */
async function basicEncryptionExample() {
  console.log("=== 示例 1: 基础加密配置 ===\n");

  // 生成 32 字节密钥（用于 AES-256）
  const key = EncryptionManager.generateKey("aes-256");

  // 创建服务端，启用加密
  const server = new Server({
    port: 8080,
    path: "/ws",
    encryption: {
      key, // 使用生成的密钥
      // 不指定 algorithm，会根据密钥长度自动选择（32字节 -> aes-256-gcm）
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    // 接收消息（自动解密）
    socket.on("message", (data: any) => {
      console.log(`[服务端] 收到消息（已自动解密）:`, data);

      // 发送响应（自动加密）
      socket.emit("response", {
        status: "success",
        received: data,
        timestamp: Date.now(),
      });
    });
  });

  server.listen();
  console.log("[服务端] WebSocket 服务器已启动，端口: 8080");
  console.log("[服务端] 加密算法: AES-256-GCM（自动选择）\n");

  // 等待服务端启动
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 创建客户端，使用相同的密钥
  const client = new Client({
    url: "ws://localhost:8080/ws",
    encryption: {
      key, // 必须与服务端使用相同的密钥
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接到服务器");

    // 发送消息（自动加密）
    client.emit("message", {
      text: "这是一条加密消息",
      user: "Alice",
      timestamp: Date.now(),
    });
  });

  client.on("response", async (data: any) => {
    console.log("[客户端] 收到服务器响应（已自动解密）:", data);
    client.disconnect();
    await server.close();
  });

  client.on("error", (error: any) => {
    console.error("[客户端] 连接错误:", error);
  });
}

/**
 * 示例 2: 使用字符串密钥
 * 适合从配置文件或环境变量读取密钥
 */
async function stringKeyExample() {
  console.log("\n=== 示例 2: 使用字符串密钥 ===\n");

  // 使用字符串密钥（必须是 16 或 32 字节长度）
  const stringKey = "my-secret-key-32-bytes-long!!!!!"; // 32 字节

  const server = new Server({
    port: 8081,
    path: "/ws",
    encryption: {
      key: stringKey, // 直接使用字符串
      algorithm: "aes-256-gcm",
    },
  });

  server.on("connection", (socket) => {
    socket.on("data", (data: any) => {
      console.log("[服务端] 收到数据:", data);
      socket.emit("ack", { received: true });
    });
  });

  server.listen();
  console.log("[服务端] 服务器已启动，端口: 8081");
  console.log("[服务端] 使用字符串密钥加密\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const client = new Client({
    url: "ws://localhost:8081/ws",
    encryption: {
      key: stringKey, // 使用相同的字符串密钥
    },
  });

  client.on("open", () => {
    client.emit("data", { value: "使用字符串密钥加密的消息" });
  });

  client.on("ack", async () => {
    console.log("[客户端] 收到确认");
    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 3: 指定加密算法
 * 演示如何选择不同的加密算法
 */
async function algorithmSelectionExample() {
  console.log("\n=== 示例 3: 选择加密算法 ===\n");

  const algorithms = [
    { name: "AES-256-GCM", keyLength: 32, algorithm: "aes-256-gcm" as const },
    { name: "AES-128-GCM", keyLength: 16, algorithm: "aes-128-gcm" as const },
    { name: "AES-256-CBC", keyLength: 32, algorithm: "aes-256-cbc" as const },
    { name: "AES-128-CBC", keyLength: 16, algorithm: "aes-128-cbc" as const },
  ];

  for (const algo of algorithms) {
    console.log(`\n测试算法: ${algo.name}`);

    const key = EncryptionManager.generateKey(
      algo.keyLength === 16 ? "aes-128" : "aes-256",
    );

    const server = new Server({
      port: 8082,
      path: "/ws",
      encryption: {
        key,
        algorithm: algo.algorithm,
      },
    });

    server.on("connection", (socket) => {
      socket.on("test", (data: any) => {
        console.log(`[${algo.name}] 收到消息:`, data);
        socket.emit("result", { algorithm: algo.name, success: true });
      });
    });

    server.listen();

    await new Promise((resolve) => setTimeout(resolve, 300));

    const client = new Client({
      url: "ws://localhost:8082/ws",
      encryption: {
        key,
        algorithm: algo.algorithm,
      },
    });

    client.on("open", () => {
      client.emit("test", { algorithm: algo.name, data: "test message" });
    });

    client.on("result", async (data: any) => {
      console.log(`[${algo.name}] 测试成功:`, data);
      client.disconnect();
      await server.close();
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// 运行所有示例
if (import.meta.main) {
  await basicEncryptionExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await stringKeyExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await algorithmSelectionExample();
  console.log("\n=== 所有示例运行完成 ===");
}
