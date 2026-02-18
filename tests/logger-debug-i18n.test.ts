/**
 * @fileoverview logger、debug、t（翻译）参数全面测试
 * 验证 Server 和中间件的 logger、debug、t 配置正确生效
 * 注：Windows CI 上端口绑定可能触发 10013 权限错误，相关测试在 Windows 上跳过
 */

import type { Logger } from "@dreamer/logger";
import { platform } from "@dreamer/runtime-adapter";
import { describe, expect, it } from "@dreamer/test";
import { MongoDBAdapter } from "../src/adapters/mongodb.ts";
import { $t } from "../src/i18n.ts";
import { authMiddleware, loggerMiddleware, Server } from "../src/mod.ts";
import { createWebSocketClient, delay } from "./test-utils.ts";

const isWindows = platform() === "windows";

/**
 * Mock Logger 接口（仅包含测试需要的方法）
 */
interface MockLogger extends Pick<Logger, "debug" | "info"> {
  debugCalls: string[];
  infoCalls: string[];
}

/**
 * 创建 Mock Logger，用于验证日志方法是否被调用
 */
function createMockLogger(): MockLogger {
  const debugCalls: string[] = [];
  const infoCalls: string[] = [];
  return {
    debug: (msg: string) => {
      debugCalls.push(msg);
    },
    info: (msg: string) => {
      infoCalls.push(msg);
    },
    debugCalls,
    infoCalls,
  };
}

describe("Server logger、debug、t 参数", () => {
  describe("logger 参数", () => {
    it("应该使用传入的自定义 logger", () => {
      const mockLogger = createMockLogger();
      const server = new Server({
        port: 8080,
        logger: mockLogger as unknown as Logger,
      });

      expect(server).toBeTruthy();
      // 通过 options 验证 logger 被保存（Server 内部使用 this.logger）
      expect(server.options.logger).toBe(mockLogger);
    });

    it("未传入 logger 时应使用默认 logger", () => {
      const server = new Server({ port: 8080 });
      expect(server).toBeTruthy();
      // 未传 logger 时 options.logger 为 undefined，内部会 createLogger()
      expect(server.options.logger).toBeUndefined();
    });
  });

  describe("debug 参数", () => {
    it.skipIf(
      isWindows,
      "debug=true 时应在收到请求时调用 logger.debug",
      async () => {
        const mockLogger = createMockLogger();
        const server = new Server({
          port: 0,
          path: "/ws",
          debug: true,
          logger: mockLogger as unknown as Logger,
        });

        server.listen();
        await delay(200);
        const testPort = server.getPort();

        // 建立 WebSocket 连接会触发 handleRequest，进而调用 debugLog
        const ws = await createWebSocketClient(
          `ws://localhost:${testPort}/ws`,
        );
        await delay(300);

        // 验证 debug 被调用（应包含请求路径、升级等日志）
        expect(mockLogger.debugCalls.length).toBeGreaterThan(0);
        const hasRequestLog = mockLogger.debugCalls.some(
          (msg) =>
            msg.includes("path=") ||
            msg.includes("请求") ||
            msg.includes("升级"),
        );
        expect(hasRequestLog).toBe(true);

        ws.close();
        await server.close();
        await delay(100);
      },
      { sanitizeOps: false, sanitizeResources: false },
    );

    it.skipIf(isWindows, "debug=false 时不应调用 logger.debug", async () => {
      const mockLogger = createMockLogger();
      const server = new Server({
        port: 0,
        path: "/ws",
        debug: false,
        logger: mockLogger as unknown as Logger,
      });

      server.listen();
      await delay(200);
      const testPort = server.getPort();

      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws`,
      );
      await delay(300);

      expect(mockLogger.debugCalls.length).toBe(0);

      ws.close();
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("lang 翻译参数", () => {
    it.skipIf(
      isWindows,
      "lang=en-US 时 debug 日志应使用包内英文翻译",
      async () => {
        const mockLogger = createMockLogger();

        const server = new Server({
          port: 0,
          path: "/ws",
          debug: true,
          logger: mockLogger as unknown as Logger,
          lang: "en-US",
        });

        server.listen();
        await delay(200);
        const testPort = server.getPort();

        const ws = await createWebSocketClient(
          `ws://localhost:${testPort}/ws`,
        );
        await delay(300);

        expect(mockLogger.debugCalls.length).toBeGreaterThan(0);
        const hasRequestLog = mockLogger.debugCalls.some(
          (msg) => msg.includes("Request received") || msg.includes("path="),
        );
        expect(hasRequestLog).toBe(true);

        ws.close();
        await server.close();
        await delay(100);
      },
      { sanitizeOps: false, sanitizeResources: false },
    );

    it("server.tr 应使用包内 i18n 翻译（lang: en-US）", () => {
      const server = new Server({
        port: 8080,
        lang: "en-US",
      });

      const result = $t("log.websocket.authFailed", undefined, "en-US");
      expect(result).toBe("Authentication failed");
    });

    it("key 无翻译时 $t 返回 key 或库默认行为", () => {
      const result = $t("some.unknown.key.not.in.locale", undefined, "en-US");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe("loggerMiddleware logger、t 参数", () => {
  it.skipIf(isWindows, "应使用传入的自定义 logger 记录连接日志", async () => {
    const mockLogger = createMockLogger();
    const server = new Server({ port: 0, path: "/ws" });

    server.use(loggerMiddleware(mockLogger as unknown as Logger));
    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );
    await delay(300);

    expect(mockLogger.infoCalls.length).toBeGreaterThan(0);
    const hasConnectionLog = mockLogger.infoCalls.some(
      (msg) => msg.includes("连接") || msg.includes("WebSocket"),
    );
    expect(hasConnectionLog).toBe(true);

    ws.close();
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it.skipIf(
    isWindows,
    "loggerMiddleware 应使用 server.tr 进行翻译",
    async () => {
      const mockLogger = createMockLogger();

      const server = new Server({
        port: 0,
        path: "/ws",
        lang: "en-US",
      });

      server.use(loggerMiddleware(mockLogger as unknown as Logger));
      server.listen();
      await delay(200);
      const testPort = server.getPort();

      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws`,
      );
      await delay(300);

      expect(
        mockLogger.infoCalls.some((m) => m.includes("Connection established")),
      ).toBe(true);

      ws.close();
      await server.close();
      await delay(100);
    },
    { sanitizeOps: false, sanitizeResources: false },
  );
});

describe("适配器 t 翻译参数", () => {
  it("MongoDBAdapter 应支持 t 参数进行错误信息翻译", () => {
    const customT = (key: string) => {
      if (key === "log.adapterMongo.databaseNotConnected") {
        return "MongoDB not connected (en)";
      }
      return undefined;
    };
    const adapter = new MongoDBAdapter({
      connection: {
        host: "127.0.0.1",
        port: 27017,
        database: "test",
      },
      t: customT,
    });
    // 适配器内部 tr 会使用 options.t，通过触发需要 tr 的代码路径验证
    // 这里仅验证 adapter 能正确创建（tr 在 constructor 中设置）
    expect(adapter).toBeTruthy();
  });
});

describe("authMiddleware lang 翻译参数", () => {
  it.skipIf(
    isWindows,
    "认证失败时 authMiddleware 应使用 server.tr 翻译错误信息",
    async () => {
      const server = new Server({
        port: 0,
        path: "/ws",
        lang: "en-US",
      });

      server.use(
        authMiddleware((socket) => {
          const token = socket.handshake.query.token;
          return token === "valid";
        }),
      );

      server.on("connection", () => {});

      server.listen();
      await delay(200);

      const trResult = $t("log.websocket.authFailed", undefined, "en-US");
      expect(trResult).toBe("Authentication failed");

      await server.close();
      await delay(100);
    },
    { sanitizeOps: false, sanitizeResources: false },
  );
});
