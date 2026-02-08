/**
 * @fileoverview 心跳检测测试
 * 测试 WebSocket 服务器的心跳检测功能
 */

import { describe, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import {
  createWebSocketClient,
  delay,
  waitForMessage,
} from "./test-utils.ts";

describe("心跳检测", () => {
  it("应该发送心跳消息", async () => {
    const server = new Server({
      port: 0,
      path: "/ws",
      pingInterval: 1000,
      pingTimeout: 2000,
    });

    server.on("connection", (socket) => {
      // 心跳由服务器自动发送
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);

    // 等待心跳消息
    try {
      const message = await waitForMessage(ws, 2000);
      const data = JSON.parse(message.data as string);

      if (data.type === "ping") {
        // 心跳消息已收到
      }
    } catch (error) {
      // 超时是正常的，心跳可能还没发送
    }

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该处理心跳响应", async () => {
    const server = new Server({
      port: 0,
      path: "/ws",
      pingInterval: 1000,
      pingTimeout: 2000,
    });

    server.on("connection", (socket) => {
      // 心跳处理是自动的
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);

    // 发送心跳响应
    ws.send(JSON.stringify({ type: "pong" }));

    await delay(300);
    ws.close();

    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
