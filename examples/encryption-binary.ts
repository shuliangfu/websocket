/**
 * @fileoverview 二进制消息与加密示例
 * 演示二进制消息不会被加密，以及如何混合使用文本和二进制消息
 */

import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";

/**
 * 示例 1: 二进制消息不会被加密
 * 二进制消息直接传输，不经过加密处理
 */
async function binaryMessageExample() {
  console.log("=== 示例 1: 二进制消息不会被加密 ===\n");

  const key = EncryptionManager.generateKey("aes-256");

  const server = new Server({
    port: 8110,
    path: "/ws",
    encryption: {
      key,
      algorithm: "aes-256-gcm",
    },
  });

  let receivedBinary: Uint8Array | null = null;

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    // 接收二进制消息
    socket.on("binary", (data: any) => {
      console.log(`[服务端] 收到二进制消息`);
      console.log(`[服务端] 数据类型: ${data.constructor.name}`);
      console.log(`[服务端] 数据长度: ${data.byteLength || data.length} 字节`);
      receivedBinary = data instanceof Uint8Array ? data : new Uint8Array(data);

      // 验证数据内容
      const expected = new Uint8Array([1, 2, 3, 4, 5]);
      const matches = receivedBinary.length === expected.length &&
        receivedBinary.every((byte, i) => byte === expected[i]);
      console.log(`[服务端] 数据匹配: ${matches}`);

      // 发送二进制响应
      const response = new Uint8Array([10, 20, 30, 40, 50]);
      socket.sendBinary(response);
    });

    // 接收文本消息（会被加密）
    socket.on("text", (data: any) => {
      console.log(`[服务端] 收到文本消息（已解密）:`, data);
    });
  });

  server.listen();
  console.log("[服务端] 服务器已启动，端口: 8110");
  console.log("[服务端] 注意：二进制消息不会被加密\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const client = new Client({
    url: "ws://localhost:8110/ws",
    encryption: {
      key,
    },
  });

  let receivedResponse: Uint8Array | null = null;

  client.on("open", () => {
    console.log("[客户端] 已连接");

    // 发送二进制消息（不会被加密）
    const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
    console.log("[客户端] 发送二进制消息（不加密）");
    client.sendBinary(binaryData);

    // 发送文本消息（会被加密）
    setTimeout(() => {
      client.emit("text", {
        message: "这是文本消息（会被加密）",
        timestamp: Date.now(),
      });
    }, 200);
  });

  client.on("binary", async (data: any) => {
    console.log(`[客户端] 收到二进制消息`);
    console.log(`[客户端] 数据类型: ${data.constructor.name}`);
    receivedResponse = data instanceof Uint8Array ? data : new Uint8Array(data);

    const expected = new Uint8Array([10, 20, 30, 40, 50]);
    const matches = receivedResponse.length === expected.length &&
      receivedResponse.every((byte, i) => byte === expected[i]);
    console.log(`[客户端] 数据匹配: ${matches}`);

    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 2: 混合使用文本和二进制消息
 * 文本消息加密，二进制消息不加密
 */
async function mixedMessageExample() {
  console.log("\n=== 示例 2: 混合使用文本和二进制消息 ===\n");

  const key = EncryptionManager.generateKey("aes-256");

  const server = new Server({
    port: 8111,
    path: "/ws",
    encryption: {
      key,
    },
  });

  const receivedMessages: Array<{ type: string; data: any }> = [];

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    // 接收文本消息（加密）
    socket.on("text-message", (data: any) => {
      console.log(`[服务端] 收到文本消息（已解密）:`, data);
      receivedMessages.push({ type: "text", data });
    });

    // 接收二进制消息（不加密）
    socket.on("binary", (data: any) => {
      console.log(`[服务端] 收到二进制消息`);
      receivedMessages.push({ type: "binary", data });
    });

    // 发送混合响应
    setTimeout(() => {
      // 发送加密的文本消息
      socket.emit("text-response", {
        message: "这是加密的文本响应",
      });

      // 发送未加密的二进制消息
      const binaryResponse = new Uint8Array([100, 200, 255]);
      socket.sendBinary(binaryResponse);
    }, 300);
  });

  server.listen();
  console.log("[服务端] 服务器已启动，端口: 8111\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const client = new Client({
    url: "ws://localhost:8111/ws",
    encryption: {
      key,
    },
  });

  const clientReceived: Array<{ type: string; data: any }> = [];

  client.on("open", () => {
    console.log("[客户端] 已连接");

    // 发送文本消息（会被加密）
    client.emit("text-message", {
      text: "这是文本消息",
      encrypted: true,
    });

    // 发送二进制消息（不会加密）
    setTimeout(() => {
      const binaryData = new Uint8Array([50, 100, 150]);
      client.sendBinary(binaryData);
    }, 100);
  });

  client.on("text-response", (data: any) => {
    console.log("[客户端] 收到文本响应（已解密）:", data);
    clientReceived.push({ type: "text", data });
  });

  client.on("binary", async (data: any) => {
    console.log("[客户端] 收到二进制响应");
    clientReceived.push({ type: "binary", data });

    console.log(`\n[总结] 服务端收到 ${receivedMessages.length} 条消息`);
    console.log(`[总结] 客户端收到 ${clientReceived.length} 条消息`);

    client.disconnect();
    await server.close();
  });
}

/**
 * 示例 3: 文件传输场景
 * 使用二进制消息传输文件，元数据使用加密文本消息
 */
async function fileTransferExample() {
  console.log("\n=== 示例 3: 文件传输场景 ===\n");

  const key = EncryptionManager.generateKey("aes-256");

  const server = new Server({
    port: 8112,
    path: "/ws",
    encryption: {
      key,
    },
  });

  server.on("connection", (socket) => {
    console.log(`[服务端] 客户端连接: ${socket.id}`);

    let fileMetadata: any = null;
    let fileData: Uint8Array | null = null;

    // 接收文件元数据（加密）
    socket.on("file-metadata", (data: any) => {
      console.log(`[服务端] 收到文件元数据（已解密）:`, data);
      fileMetadata = data;
    });

    // 接收文件数据（二进制，不加密）
    socket.on("binary", (data: any) => {
      console.log(`[服务端] 收到文件数据（二进制，不加密）`);
      fileData = data instanceof Uint8Array ? data : new Uint8Array(data);
      console.log(`[服务端] 文件大小: ${fileData.length} 字节`);

      // 验证文件
      if (fileMetadata && fileData) {
        const matches = fileData.length === fileMetadata.size;
        console.log(`[服务端] 文件大小匹配: ${matches}`);
        console.log(`[服务端] 文件名: ${fileMetadata.name}`);
        console.log(`[服务端] 文件类型: ${fileMetadata.type}`);

        // 发送确认（加密）
        socket.emit("file-uploaded", {
          success: true,
          fileName: fileMetadata.name,
          size: fileData.length,
        });
      }
    });
  });

  server.listen();
  console.log("[服务端] 文件传输服务器已启动，端口: 8112\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  const client = new Client({
    url: "ws://localhost:8112/ws",
    encryption: {
      key,
    },
  });

  client.on("open", () => {
    console.log("[客户端] 已连接");

    // 模拟文件数据
    const fileContent = new TextEncoder().encode(
      "Hello, World! This is a test file.",
    );
    const fileName = "test.txt";
    const fileType = "text/plain";

    // 1. 先发送文件元数据（加密）
    console.log("[客户端] 发送文件元数据（加密）");
    client.emit("file-metadata", {
      name: fileName,
      type: fileType,
      size: fileContent.length,
      timestamp: Date.now(),
    });

    // 2. 然后发送文件数据（二进制，不加密）
    setTimeout(() => {
      console.log("[客户端] 发送文件数据（二进制，不加密）");
      client.sendBinary(fileContent);
    }, 200);
  });

  client.on("file-uploaded", async (data: any) => {
    console.log("[客户端] 文件上传成功:", data);
    client.disconnect();
    await server.close();
  });
}

// 运行所有示例
if (import.meta.main) {
  await binaryMessageExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await mixedMessageExample();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await fileTransferExample();
  console.log("\n=== 所有示例运行完成 ===");
}
