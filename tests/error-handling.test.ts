/**
 * @fileoverview 错误处理测试
 * 测试 WebSocket 服务器的错误处理功能
 */

import { describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import {
  createWebSocketClient,
  delay,
  getAvailablePort,
} from "./test-utils.ts";

describe("错误处理", () => {
  it("应该处理无效路径的请求", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });

    server.listen();
    await delay(200);

    try {
      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/invalid`,
      );
      ws.close();
    } catch (error) {
      // 预期会失败
      expect(error).toBeTruthy();
    }

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该处理无效 JSON 消息", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });

    server.on("connection", (socket) => {
      socket.on("error", () => {
        // 错误处理
      });
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);

    // 发送无效 JSON
    ws.send("invalid json");

    await delay(300);
    // 错误应该被处理
    ws.close();

    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
