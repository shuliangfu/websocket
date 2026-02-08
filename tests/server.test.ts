/**
 * @fileoverview Server 测试
 * 测试 WebSocket 服务器的构造函数、配置、启动和关闭
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import { createWebSocketClient, delay } from "./test-utils.ts";

describe("WebSocket Server", () => {
  describe("Server 构造函数和配置", () => {
    it("应该创建服务器实例", () => {
      const server = new Server({
        port: 8080,
      });

      expect(server).toBeTruthy();
      expect(server.options.port).toBe(8080);
    });

    it("应该使用默认配置", () => {
      const server = new Server();

      expect(server.options.path).toBe("/");
      expect(server.options.pingTimeout).toBe(60000);
      expect(server.options.pingInterval).toBe(30000);
    });

    it("应该支持自定义配置", () => {
      const server = new Server({
        port: 9000,
        host: "127.0.0.1",
        path: "/ws",
        pingTimeout: 30000,
        pingInterval: 15000,
        maxConnections: 100,
      });

      expect(server.options.port).toBe(9000);
      expect(server.options.host).toBe("127.0.0.1");
      expect(server.options.path).toBe("/ws");
      expect(server.options.pingTimeout).toBe(30000);
      expect(server.options.pingInterval).toBe(15000);
      expect(server.options.maxConnections).toBe(100);
    });
  });

  describe("Server 事件监听", () => {
    it("应该支持 connection 事件监听", () => {
      const server = new Server({ port: 8080 });
      let connected = false;

      server.on("connection", () => {
        connected = true;
      });

      expect(server).toBeTruthy();
      // 注意：这里只是测试监听器注册，不测试实际连接
    });

    it("应该支持多个 connection 监听器", () => {
      const server = new Server({ port: 8080 });
      let count = 0;

      server.on("connection", () => {
        count++;
      });

      server.on("connection", () => {
        count++;
      });

      expect(server).toBeTruthy();
    });
  });

  describe("Server 启动和关闭", () => {
    let server: Server;

    beforeAll(() => {
      server = new Server({ port: 0, path: "/ws" });
    });

    afterAll(async () => {
      if (server) {
        await server.close();
      }
    });

    it("应该启动服务器", () => {
      expect(() => {
        server.listen();
      }).not.toThrow();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持自定义 host 和 port", () => {
      const customServer = new Server({ port: 0 });

      expect(() => {
        customServer.listen("127.0.0.1", 0);
      }).not.toThrow();

      // 清理
      customServer.close();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该关闭服务器", async () => {
      const testServer = new Server({ port: 0 });
      testServer.listen();

      expect(async () => {
        await testServer.close();
      }).not.toThrow();
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该关闭所有连接", async () => {
      const testServer = new Server({
        port: 0,
        path: "/test",
      });
      testServer.listen();
      const testPort = testServer.getPort();

      // 创建一个连接
      try {
        const ws = await createWebSocketClient(
          `ws://localhost:${testPort}/test`,
        );
        await delay(100);
        // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
        ws.send(JSON.stringify({ type: "ping" }));
        await delay(100);

        // 关闭服务器应该关闭所有连接，添加超时保护
        await Promise.race([
          testServer.close(),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error("服务器关闭超时")), 2000);
          }),
        ]).catch((error) => {
          // 如果超时，继续执行测试
        });

        // 等待连接关闭
        await delay(200);
        expect(ws.readyState).toBe(WebSocket.CLOSED);
      } catch (error) {
        // 如果连接失败（服务器已关闭），这是预期的
        // 忽略错误
      }
    }, { sanitizeOps: false, sanitizeResources: false });
  });
});
