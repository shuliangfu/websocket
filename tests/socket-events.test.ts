/**
 * @fileoverview Socket 事件系统测试
 * 测试 Socket 的事件监听、移除和回调机制
 * 注：Windows CI 上端口绑定可能触发 10013 权限错误，故跳过
 */

import { platform } from "@dreamer/runtime-adapter";
import { describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import { createWebSocketClient, delay } from "./test-utils.ts";

const isWindows = platform() === "windows";

describe("Socket 事件系统", () => {
  it.skipIf(isWindows, "应该支持多个事件监听器", async () => {
    const server = new Server({ port: 0, path: "/ws" });
    let callCount = 0;

    server.on("connection", (socket) => {
      socket.on("test", () => {
        callCount++;
      });

      socket.on("test", () => {
        callCount++;
      });
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);

    ws.send(
      JSON.stringify({ type: "event", event: "test", data: {} }),
    );

    await delay(500);
    expect(callCount).toBe(2);

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it.skipIf(isWindows, "应该支持移除事件监听器", async () => {
    const server = new Server({ port: 0, path: "/ws" });
    let callCount = 0;

    server.on("connection", (socket) => {
      const handler = () => {
        callCount++;
      };

      socket.on("test", handler);
      socket.off("test", handler);
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);

    ws.send(
      JSON.stringify({ type: "event", event: "test", data: {} }),
    );

    await delay(300);
    expect(callCount).toBe(0);

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it.skipIf(isWindows, "应该支持移除所有事件监听器", async () => {
    const server = new Server({ port: 0, path: "/ws" });
    let callCount = 0;

    server.on("connection", (socket) => {
      socket.on("test", () => {
        callCount++;
      });

      socket.on("test", () => {
        callCount++;
      });

      socket.off("test");
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);

    ws.send(
      JSON.stringify({ type: "event", event: "test", data: {} }),
    );

    await delay(500);
    expect(callCount).toBe(0);

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it.skipIf(isWindows, "应该支持回调函数", async () => {
    const server = new Server({ port: 0, path: "/ws" });

    server.on("connection", (socket) => {
      socket.on(
        "test-with-callback",
        (data: unknown, callback: (response: unknown) => void) => {
          if (callback) {
            callback({ response: "ok" });
          }
        },
      );
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);

    // 发送带回调 ID 的消息
    const callbackId = "callback-123";
    ws.send(
      JSON.stringify({
        type: "event",
        event: "test-with-callback",
        data: {},
        callbackId,
      }),
    );

    // 等待回调响应（需要过滤掉心跳消息）
    let callbackReceived = false;
    let callbackData: any = null;

    const messageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        // 过滤掉心跳消息
        if (data.type === "ping" || data.type === "pong") {
          return;
        }
        // 如果是回调消息，保存并标记
        if (data.type === "callback" && data.callbackId === callbackId) {
          callbackReceived = true;
          callbackData = data;
        }
      } catch (e) {
        // 忽略解析错误
      }
    };

    ws.onmessage = messageHandler;

    // 等待回调消息，最多等待 3 秒
    const startTime = Date.now();
    while (!callbackReceived && Date.now() - startTime < 3000) {
      await delay(50);
    }

    expect(callbackReceived).toBe(true);
    expect(callbackData.type).toBe("callback");
    expect(callbackData.callbackId).toBe(callbackId);
    expect(callbackData.data).toEqual({ response: "ok" });

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
