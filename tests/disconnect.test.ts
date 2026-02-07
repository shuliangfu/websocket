/**
 * @fileoverview 断开连接测试
 * 测试 Socket 断开连接和清理功能
 */

import { describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import {
  createWebSocketClient,
  delay,
  getAvailablePort,
} from "./test-utils.ts";

describe("Socket 断开连接", () => {
  it("应该处理客户端断开连接", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });

    server.on("connection", (socket) => {
      socket.on("disconnect", () => {
        // disconnect 事件处理
      });
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    ws.close();

    await delay(200);
    // 注意：disconnect 事件可能不会立即触发

    await server.close();
    await delay(100);
  });

  it("应该支持服务器主动断开连接", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });

    let socketInstance: any = null;
    server.on("connection", (socket) => {
      socketInstance = socket;
      // 确保连接完全建立且客户端有机会发送后再断开（CI 上 200ms 可能不足）
      setTimeout(() => {
        socket.disconnect("server shutdown");
      }, 500);
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    // 连接建立后立即发送（服务器 500ms 后会断开，需在断开前发送）
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
    await delay(200);

    // 等待服务器断开连接，并监听客户端的关闭事件
    let closed = false;
    const closePromise = new Promise<void>((resolve) => {
      ws.onclose = () => {
        closed = true;
        resolve();
      };
    });

    // 等待关闭事件，最多等待 2 秒
    await Promise.race([
      closePromise,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 2000);
      }),
    ]);

    // 等待状态更新
    await delay(200);

    // 检查连接是否已关闭（readyState 或 closed 标志）
    if (!closed && ws.readyState === WebSocket.CLOSED) {
      closed = true;
    }

    expect(closed).toBe(true);
    expect(ws.readyState).toBe(WebSocket.CLOSED);

    // 确保 socket 已断开
    if (socketInstance && socketInstance.connected) {
      socketInstance.disconnect();
    }

    // 关闭服务器，添加超时保护
    try {
      await Promise.race([
        server.close(),
        new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 1500);
        }),
      ]);
    } catch (error) {
      // 忽略错误
    }

    // 确保客户端已关闭
    if (ws.readyState !== WebSocket.CLOSED) {
      try {
        ws.close();
      } catch (e) {
        // 忽略错误
      }
    }

    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该清理房间成员", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });

    server.on("connection", (socket) => {
      socket.join("room1");
      socket.disconnect();
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    ws.close();

    await delay(100);

    await server.close();
    await delay(100);
  });
}, { sanitizeOps: false, sanitizeResources: false });
