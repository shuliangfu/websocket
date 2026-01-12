/**
 * @fileoverview 二进制消息示例
 * 演示如何处理二进制消息（图片、文件、音视频等）
 */

import { Server } from "../src/server.ts";

const io = new Server({
  port: 8080,
  path: "/ws",
});

io.on("connection", (socket) => {
  console.log(`[二进制消息] 用户 ${socket.id} 已连接`);

  /**
   * 监听二进制消息
   * 客户端发送: socket.sendBinary(new Uint8Array([1, 2, 3, 4, 5]))
   */
  socket.on("binary", (data: ArrayBuffer | Blob | Uint8Array) => {
    console.log(`[二进制消息] 收到来自 ${socket.id} 的二进制消息`);

    // 处理不同类型的二进制数据
    let buffer: ArrayBuffer;
    if (data instanceof ArrayBuffer) {
      buffer = data;
    } else if (data instanceof Blob) {
      // Blob 需要异步读取
      data.arrayBuffer().then((ab) => {
        handleBinaryData(socket, ab);
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
      console.error(`[二进制消息] 未知的二进制数据类型`);
      return;
    }

    handleBinaryData(socket, buffer);
  });

  /**
   * 处理二进制数据的辅助函数
   */
  function handleBinaryData(socket: any, buffer: ArrayBuffer) {
    const uint8Array = new Uint8Array(buffer);
    const size = buffer.byteLength;

    console.log(
      `[二进制消息] 二进制数据大小: ${size} 字节`,
      `前 10 个字节:`,
      Array.from(uint8Array.slice(0, 10)),
    );

    // 根据数据大小和内容判断类型
    if (size < 100) {
      // 小数据，可能是控制消息
      console.log(`[二进制消息] 可能是控制消息`);
    } else if (size < 1024 * 1024) {
      // 中等数据，可能是图片或小文件
      console.log(`[二进制消息] 可能是图片或小文件 (${(size / 1024).toFixed(2)} KB)`);
    } else {
      // 大数据，可能是视频或大文件
      console.log(
        `[二进制消息] 可能是视频或大文件 (${(size / 1024 / 1024).toFixed(2)} MB)`,
      );
    }

    // 回显二进制数据（可选）
    socket.sendBinary(buffer);
  }

  /**
   * 监听带元数据的二进制消息
   * 客户端可以先发送文本消息描述，然后发送二进制数据
   */
  socket.on("upload-file", (metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
  }) => {
    console.log(`[二进制消息] 准备接收文件:`, metadata);

    // 通知客户端可以开始发送二进制数据
    socket.emit("ready-for-binary", {
      message: "可以开始发送文件数据",
    });

    // 设置一个临时监听器接收二进制数据
    const binaryHandler = (data: ArrayBuffer | Blob | Uint8Array) => {
      console.log(
        `[二进制消息] 收到文件数据: ${metadata.fileName}, 大小: ${metadata.fileSize}`,
      );

      // 处理文件数据（这里只是示例，实际应用中应该保存到磁盘或数据库）
      let buffer: ArrayBuffer;
      if (data instanceof ArrayBuffer) {
        buffer = data;
      } else if (data instanceof Blob) {
        data.arrayBuffer().then((ab) => {
          processFileData(socket, metadata, ab);
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

      processFileData(socket, metadata, buffer);
    };

    socket.on("binary", binaryHandler);

    // 5 秒后移除临时监听器（防止内存泄漏）
    setTimeout(() => {
      socket.off("binary", binaryHandler);
      console.log(`[二进制消息] 文件上传超时或完成`);
    }, 5000);
  });

  /**
   * 处理文件数据的辅助函数
   */
  function processFileData(
    socket: any,
    metadata: { fileName: string; fileType: string; fileSize: number },
    buffer: ArrayBuffer,
  ) {
    const receivedSize = buffer.byteLength;
    console.log(
      `[二进制消息] 处理文件: ${metadata.fileName}`,
      `期望大小: ${metadata.fileSize}, 实际大小: ${receivedSize}`,
    );

    // 验证文件大小
    if (receivedSize !== metadata.fileSize) {
      socket.emit("upload-error", {
        message: `文件大小不匹配: 期望 ${metadata.fileSize}, 实际 ${receivedSize}`,
      });
      return;
    }

    // 模拟文件处理（实际应用中应该保存到磁盘或数据库）
    const uint8Array = new Uint8Array(buffer);
    const hash = calculateSimpleHash(uint8Array);

    socket.emit("upload-success", {
      fileName: metadata.fileName,
      fileSize: receivedSize,
      hash: hash,
      message: "文件上传成功",
    });
  }

  /**
   * 简单的哈希计算（仅用于示例）
   */
  function calculateSimpleHash(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 1000); i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash; // 转换为 32 位整数
    }
    return hash.toString(16);
  }

  /**
   * 发送二进制数据到客户端
   */
  socket.on("request-binary", () => {
    console.log(`[二进制消息] 客户端请求二进制数据`);

    // 创建一个示例二进制数据
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" 的字节
    socket.sendBinary(data.buffer);

    console.log(`[二进制消息] 已发送二进制数据到 ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log(`[二进制消息] 用户 ${socket.id} 断开连接`);
  });
});

io.listen();
console.log("✅ 二进制消息示例服务器运行在 ws://localhost:8080/ws");
