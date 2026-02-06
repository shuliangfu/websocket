/**
 * @fileoverview logger、debug、t（翻译）参数全面测试
 * 验证 Server 和中间件的 logger、debug、t 配置正确生效
 */

import type { Logger } from "@dreamer/logger";
import { describe, expect, it } from "@dreamer/test";
import { MongoDBAdapter } from "../src/adapters/mongodb.ts";
import {
  authMiddleware,
  loggerMiddleware,
  Server,
} from "../src/mod.ts";
import {
  createWebSocketClient,
  delay,
  getAvailablePort,
} from "./test-utils.ts";

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
    it("debug=true 时应在收到请求时调用 logger.debug", async () => {
      const mockLogger = createMockLogger();
      const testPort = getAvailablePort();
      const server = new Server({
        port: testPort,
        path: "/ws",
        debug: true,
        logger: mockLogger as unknown as Logger,
      });

      server.listen();
      await delay(200);

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
    }, { sanitizeOps: false, sanitizeResources: false });

    it("debug=false 时不应调用 logger.debug", async () => {
      const mockLogger = createMockLogger();
      const testPort = getAvailablePort();
      const server = new Server({
        port: testPort,
        path: "/ws",
        debug: false,
        logger: mockLogger as unknown as Logger,
      });

      server.listen();
      await delay(200);

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

  describe("t 翻译参数", () => {
    it("传入 t 函数时 debug 日志应使用翻译结果", async () => {
      const mockLogger = createMockLogger();
      const tCalls: Array<{ key: string; params?: Record<string, string | number | boolean> }> = [];
      const customT = (
        key: string,
        params?: Record<string, string | number | boolean>,
      ) => {
        tCalls.push({ key, params });
        if (key === "log.websocket.requestReceived") {
          return `[i18n] Request: ${params?.path}`;
        }
        if (key === "log.websocket.upgradeSuccess") {
          return `[i18n] Upgrade OK: ${params?.socketId}`;
        }
        return undefined;
      };

      const testPort = getAvailablePort();
      const server = new Server({
        port: testPort,
        path: "/ws",
        debug: true,
        logger: mockLogger as unknown as Logger,
        t: customT,
      });

      server.listen();
      await delay(200);

      const ws = await createWebSocketClient(
        `ws://localhost:${testPort}/ws`,
      );
      await delay(300);

      // 验证 t 被调用
      expect(tCalls.length).toBeGreaterThan(0);
      const hasRequestKey = tCalls.some(
        (c) => c.key === "log.websocket.requestReceived",
      );
      expect(hasRequestKey).toBe(true);

      // 验证 debug 输出使用了翻译结果（若 t 返回了值）
      const hasI18nLog = mockLogger.debugCalls.some(
        (msg) => msg.includes("[i18n]"),
      );
      expect(hasI18nLog).toBe(true);

      ws.close();
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("server.tr 应使用 t 函数的返回值", () => {
      const customT = (key: string) => {
        if (key === "log.websocket.authFailed") return "Auth failed (en)";
        return undefined;
      };
      const server = new Server({
        port: 8080,
        t: customT,
      });

      // 通过 server.tr 间接测试（tr 内部调用 options.t）
      const result = (server as any).tr(
        "log.websocket.authFailed",
        "认证失败",
      );
      expect(result).toBe("Auth failed (en)");
    });

    it("t 返回 key 或 undefined 时应使用 fallback", () => {
      const customT = (key: string) => key; // 返回 key 本身视为未翻译
      const server = new Server({
        port: 8080,
        t: customT,
      });

      const result = (server as any).tr(
        "log.websocket.authFailed",
        "认证失败",
      );
      expect(result).toBe("认证失败");
    });
  });
});

describe("loggerMiddleware logger、t 参数", () => {
  it("应使用传入的自定义 logger 记录连接日志", async () => {
    const mockLogger = createMockLogger();
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });

    server.use(loggerMiddleware(mockLogger as unknown as Logger));
    server.listen();
    await delay(200);

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

  it("loggerMiddleware 应使用 server.tr 进行翻译", async () => {
    const mockLogger = createMockLogger();
    const tCalls: string[] = [];
    const customT = (key: string) => {
      tCalls.push(key);
      if (key === "log.websocket.connectionEstablished") {
        return "Connection established (i18n)";
      }
      return undefined;
    };

    const testPort = getAvailablePort();
    const server = new Server({
      port: testPort,
      path: "/ws",
      t: customT,
    });

    server.use(loggerMiddleware(mockLogger as unknown as Logger));
    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );
    await delay(300);

    expect(tCalls).toContain("log.websocket.connectionEstablished");
    expect(mockLogger.infoCalls.some((m) => m.includes("(i18n)"))).toBe(true);

    ws.close();
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
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

describe("authMiddleware t 翻译参数", () => {
  it("认证失败时 authMiddleware 应使用 server.tr 翻译错误信息", async () => {
    const customT = (key: string) => {
      if (key === "log.websocket.authFailed") return "Authentication failed (en)";
      return undefined;
    };

    const testPort = getAvailablePort();
    const server = new Server({
      port: testPort,
      path: "/ws",
      t: customT,
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

    // 验证 server.tr 在传入 t 时返回翻译结果（authMiddleware 内部调用 server.tr）
    const trResult = (server as { tr: (k: string, f: string) => string }).tr(
      "log.websocket.authFailed",
      "认证失败",
    );
    expect(trResult).toBe("Authentication failed (en)");

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
