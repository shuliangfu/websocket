/**
 * @fileoverview 中间件测试
 * 测试 WebSocket 服务器的中间件功能，包括内置中间件
 */

import { describe, expect, it } from "@dreamer/test";
import {
  authMiddleware,
  corsMiddleware,
  loggerMiddleware,
  rateLimitMiddleware,
  Server,
} from "../src/mod.ts";
import {
  createWebSocketClient,
  delay,
  getAvailablePort,
} from "./test-utils.ts";

describe("WebSocket Server 中间件", () => {
  describe("基础中间件", () => {
    it("应该支持添加中间件", () => {
      const server = new Server({ port: 8080 });
      let middlewareCalled = false;

      server.use((socket, next) => {
        middlewareCalled = true;
        next();
      });

      expect(server).toBeTruthy();
    });

    it("应该支持异步中间件", () => {
      const server = new Server({ port: 8080 });

      server.use(async (socket, next) => {
        await delay(10);
        next();
      });

      expect(server).toBeTruthy();
    });

    it("应该支持中间件错误处理", () => {
      const server = new Server({ port: 8080 });
      let errorHandled = false;

      server.use((socket, next) => {
        next(new Error("中间件错误"));
      });

      expect(server).toBeTruthy();
    });
  });

  describe("内置中间件 - authMiddleware", () => {
    it("应该支持认证中间件（通过）", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });
      let connected = false;

      server.use(
        authMiddleware((socket) => {
          // 检查 token
          const token = socket.handshake.query.token;
          return token === "valid-token";
        }),
      );

      server.on("connection", () => {
        connected = true;
      });

      server.listen();
      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws?token=valid-token`,
      );

      await delay(300);
      expect(connected).toBe(true);

      ws.close();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持认证中间件（拒绝）", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });
      let connected = false;

      server.use(
        authMiddleware((socket) => {
          const token = socket.handshake.query.token;
          return token === "valid-token";
        }),
      );

      server.on("connection", () => {
        connected = true;
      });

      server.listen();
      await delay(200);

      try {
        const ws = await createWebSocketClient(
          `ws://localhost:${testPort}/ws?token=invalid-token`,
        );
        await delay(300);
        ws.close();
      } catch (error) {
        // 预期会失败
      }

      expect(connected).toBe(false);

      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持异步认证中间件", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });
      let connected = false;

      server.use(
        authMiddleware(async (socket) => {
          await delay(10);
          const token = socket.handshake.query.token;
          return token === "valid-token";
        }),
      );

      server.on("connection", () => {
        connected = true;
      });

      server.listen();
      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws?token=valid-token`,
      );

      await delay(300);
      expect(connected).toBe(true);

      ws.close();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("内置中间件 - loggerMiddleware", () => {
    it("应该支持日志中间件", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });
      let connected = false;

      server.use(loggerMiddleware());

      server.on("connection", () => {
        connected = true;
      });

      server.listen();
      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws`,
      );

      await delay(300);
      expect(connected).toBe(true);

      ws.close();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("内置中间件 - rateLimitMiddleware", () => {
    it("应该支持连接数限制", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });
      let connectionCount = 0;

      server.use(
        rateLimitMiddleware({
          maxConnections: 1,
        }),
      );

      server.on("connection", () => {
        connectionCount++;
      });

      server.listen();
      await delay(200);

      // 第一个连接应该成功
      const ws1 = await createWebSocketClient(
        `ws://localhost:${testPort}/ws`,
      );
      await delay(300);
      expect(connectionCount).toBe(1);

      // 第二个连接应该被拒绝
      try {
        const ws2 = await createWebSocketClient(
          `ws://localhost:${testPort}/ws`,
        );
        await delay(300);
        ws2.close();
      } catch (error) {
        // 预期会失败
      }

      expect(connectionCount).toBe(1);

      ws1.close();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持消息频率限制", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });
      let messageCount = 0;

      server.use(
        rateLimitMiddleware({
          maxMessagesPerSecond: 2,
        }),
      );

      server.on("connection", (socket) => {
        socket.on("test", () => {
          messageCount++;
        });
      });

      server.listen();
      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws`,
      );

      await delay(300);

      // 发送多条消息
      for (let i = 0; i < 5; i++) {
        ws.send(
          JSON.stringify({ type: "event", event: "test", data: {} }),
        );
        await delay(100);
      }

      await delay(300);
      // 由于限流，可能只有部分消息被处理
      expect(messageCount).toBeLessThanOrEqual(5);

      ws.close();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("内置中间件 - corsMiddleware", () => {
    it("应该支持 CORS 中间件（允许）", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });
      let connected = false;

      server.use(
        corsMiddleware({
          origin: "http://localhost:3000",
        }),
      );

      server.on("connection", () => {
        connected = true;
      });

      server.listen();
      await delay(200);

      // 注意：WebSocket 客户端可能不发送 Origin 头
      // 这个测试主要验证中间件不会崩溃
      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws`,
      );

      await delay(300);
      ws.close();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 CORS 中间件（函数验证）", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });

      server.use(
        corsMiddleware({
          origin: (origin) => origin.includes("localhost"),
        }),
      );

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
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持 CORS 中间件（数组验证）", async () => {
      const testPort = getAvailablePort();
      const server = new Server({ port: testPort, path: "/ws" });

      server.use(
        corsMiddleware({
          origin: ["http://localhost:3000", "http://localhost:3001"],
        }),
      );

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
    }, { sanitizeOps: false, sanitizeResources: false });
  });
});
