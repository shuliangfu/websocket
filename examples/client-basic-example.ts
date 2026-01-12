/**
 * @fileoverview 客户端基础示例
 * 演示如何使用 WebSocket 客户端连接服务器并发送/接收消息
 */

import { Client } from "../src/client/mod.ts";

// 创建客户端实例
const client = new Client({
  url: "ws://localhost:8080/ws",
});

// 监听连接事件
client.on("connect", () => {
  console.log("[客户端] 已连接到服务器");

  // 发送文本消息
  client.emit("chat-message", {
    message: "Hello from client!",
    timestamp: Date.now(),
  });

  // 发送带回调的消息
  client.emit("chat-message", { message: "带回调的消息" }, (response) => {
    console.log("[客户端] 收到服务器回调:", response);
  });
});

// 监听服务器消息
client.on("chat-response", (data) => {
  console.log("[客户端] 收到服务器响应:", data);
});

// 监听欢迎消息
client.on("welcome", (data) => {
  console.log("[客户端] 收到欢迎消息:", data);
});

// 监听 ping/pong
client.on("ping", (data) => {
  console.log("[客户端] 收到 ping:", data);
  client.emit("pong", { timestamp: Date.now() });
});

client.on("pong", (data) => {
  console.log("[客户端] 收到 pong:", data);
});

// 监听二进制消息
client.on("binary", (data: ArrayBuffer | Blob | Uint8Array) => {
  console.log("[客户端] 收到二进制消息");

  let buffer: ArrayBuffer;
  if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (data instanceof Blob) {
    data.arrayBuffer().then((ab) => {
      console.log("[客户端] 二进制数据大小:", ab.byteLength, "字节");
    });
    return;
  } else if (data instanceof Uint8Array) {
    const buf = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    );
    // 处理 SharedArrayBuffer 的情况
    if (buf instanceof SharedArrayBuffer) {
      const newBuffer = new ArrayBuffer(buf.byteLength);
      new Uint8Array(newBuffer).set(new Uint8Array(buf));
      buffer = newBuffer;
    } else {
      buffer = buf;
    }
  } else {
    return;
  }

  console.log("[客户端] 二进制数据大小:", buffer.byteLength, "字节");
  const uint8Array = new Uint8Array(buffer);
  console.log("[客户端] 前 10 个字节:", Array.from(uint8Array.slice(0, 10)));
});

// 监听断开连接
client.on("disconnect", (reason) => {
  console.log("[客户端] 断开连接:", reason);
});

// 监听错误
client.on("error", (error) => {
  console.error("[客户端] 错误:", error);
});

// 连接到服务器
console.log("[客户端] 正在连接到 ws://localhost:8080/ws...");
client.connect();

// 5 秒后发送二进制消息
setTimeout(() => {
  console.log("[客户端] 发送二进制消息");
  const binaryData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  client.sendBinary(binaryData.buffer);
}, 5000);

// 10 秒后断开连接
setTimeout(() => {
  console.log("[客户端] 主动断开连接");
  client.disconnect();
}, 10000);
