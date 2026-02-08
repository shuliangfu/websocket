/**
 * @fileoverview 数据存储测试
 * 测试 Socket 的数据存储功能
 */

import { describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import { createWebSocketClient, delay } from "./test-utils.ts";

describe("Socket 数据存储", () => {
  it("应该支持数据存储", async () => {
    const server = new Server({ port: 0, path: "/ws" });

    server.on("connection", (socket) => {
      socket.data.userId = "user123";
      socket.data.username = "testuser";

      expect(socket.data.userId).toBe("user123");
      expect(socket.data.username).toBe("testuser");
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    ws.close();

    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
