/**
 * @fileoverview 优化功能测试
 * 覆盖 MessageCache、MessageQueue、BatchHeartbeatManager、fnv1aHash、
 * getStats、useMessageQueue、useBatchHeartbeat 等优化项
 */

import { describe, expect, it } from "@dreamer/test";
import {
  BatchHeartbeatManager,
  MessageCache,
  MessageQueue,
  Server,
} from "../src/mod.ts";
import { fnv1aHash } from "../src/hash.ts";
import type { Socket } from "../src/socket.ts";
import {
  createWebSocketClient,
  delay,
  waitForEvent,
  waitForMessage,
  waitForPing,
} from "./test-utils.ts";

// ========== fnv1aHash 哈希函数 ==========
describe("fnv1aHash 快速哈希", () => {
  it("相同输入应产生相同哈希", () => {
    const str = 'plain:{"type":"event","event":"test","data":{}}';
    expect(fnv1aHash(str)).toBe(fnv1aHash(str));
  });

  it("不同输入应产生不同哈希", () => {
    const hash1 = fnv1aHash("hello");
    const hash2 = fnv1aHash("world");
    expect(hash1).not.toBe(hash2);
  });

  it("应返回十六进制字符串", () => {
    const hash = fnv1aHash("test");
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });
});

// ========== MessageCache 消息缓存 ==========
describe("MessageCache 消息序列化缓存", () => {
  it("相同消息应命中缓存返回相同序列化结果", async () => {
    const cache = new MessageCache(100, 60000);
    const message = { type: "event" as const, event: "test", data: { a: 1 } };

    const s1 = await cache.serialize(message);
    const s2 = await cache.serialize(message);
    expect(s1).toBe(s2);
  });

  it("getStats 应返回正确统计", async () => {
    const cache = new MessageCache(10, 60000);
    await cache.serialize({ type: "event", event: "e1", data: {} });
    await cache.serialize({ type: "event", event: "e2", data: {} });

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(10);
    expect(typeof stats.hitRate).toBe("number");
  });

  it("超过 maxSize 时应驱逐最久未使用项（LRU）", async () => {
    const cache = new MessageCache(2, 60000);
    await cache.serialize({ type: "event", event: "e1", data: {} });
    await cache.serialize({ type: "event", event: "e2", data: {} });
    await cache.serialize({ type: "event", event: "e3", data: {} });

    const stats = cache.getStats();
    expect(stats.size).toBeLessThanOrEqual(2);
  });

  it("clear 应清空缓存", async () => {
    const cache = new MessageCache(100, 60000);
    await cache.serialize({ type: "event", event: "e1", data: {} });
    cache.clear();
    const stats = cache.getStats();
    expect(stats.size).toBe(0);
  });
});

// ========== MessageQueue 消息队列 ==========
describe("MessageQueue 消息队列", () => {
  /** 创建用于测试的 mock Socket */
  function createMockSocket(
    overrides?: Partial<{
      id: string;
      connected: boolean;
      emitCalls: Array<{ event: string; data?: unknown }>;
    }>,
  ): Socket {
    const emitCalls: Array<{ event: string; data?: unknown }> =
      overrides?.emitCalls ?? [];
    return {
      id: overrides?.id ?? "mock-socket-1",
      connected: overrides?.connected ?? true,
      emit: async (event: string, data?: unknown) => {
        emitCalls.push({ event, data });
      },
      getServer: () => ({
        tr: (_k: string, fallback: string) => fallback,
      }),
    } as unknown as Socket;
  }

  it("enqueue 应成功入队且 getStats 返回有效值", () => {
    const mockSocket = createMockSocket();
    const queue = new MessageQueue(100, 10, 5);
    const ok = queue.enqueue(mockSocket, "test-event", { a: 1 });
    expect(ok).toBe(true);
    const stats = queue.getStats();
    expect(stats.maxSize).toBe(100);
    expect(stats.batchSize).toBe(10);
    // 队列可能已被异步 process 消费，故仅验证 enqueue 成功
  });

  it("getStats 应返回正确统计", () => {
    const mockSocket = createMockSocket();
    const queue = new MessageQueue(100, 10, 5);
    queue.enqueue(mockSocket, "e1");
    const stats = queue.getStats();
    expect(stats.maxSize).toBe(100);
    expect(stats.batchSize).toBe(10);
    expect(typeof stats.processing).toBe("boolean");
  });

  it("clear 应清空队列", () => {
    const mockSocket = createMockSocket();
    const queue = new MessageQueue(100, 10, 5);
    queue.enqueue(mockSocket, "e1");
    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
  });

  it("onError 应在发送失败时被调用", async () => {
    const emitCalls: Array<{ event: string; data?: unknown }> = [];
    const mockSocket = createMockSocket({
      connected: true,
      emitCalls,
    }) as unknown as Socket & {
      emit: (e: string, d?: unknown) => Promise<void>;
    };
    mockSocket.emit = async () => {
      throw new Error("mock send error");
    };

    let errorCalled = false;
    const queue = new MessageQueue(10, 5, 1, (msg, err) => {
      errorCalled = true;
      // message-queue 使用 $t("log.websocket.messageSendFailed")，未传 lang 时为英文
      expect(msg).toContain("Message send failed");
      expect(err).toBeInstanceOf(Error);
    });
    queue.enqueue(mockSocket, "fail-event");
    await delay(50);
    expect(errorCalled).toBe(true);
  });
});

// ========== BatchHeartbeatManager 批量心跳 ==========
describe("BatchHeartbeatManager 批量心跳管理器", () => {
  /** 创建 mock Socket 供 BatchHeartbeatManager 使用 */
  function createMockSocketForHeartbeat(
    overrides?: Partial<{
      id: string;
      connected: boolean;
    }>,
  ): Socket {
    return {
      id: overrides?.id ?? "mock-hb-1",
      connected: overrides?.connected ?? true,
      sendMessage: async () => {},
      disconnect: () => {},
      getServer: () => ({ tr: (_k: string, f: string) => f }),
    } as unknown as Socket;
  }

  it("add 应增加管理的 Socket 数量", () => {
    const manager = new BatchHeartbeatManager(30000, 60000);
    const s1 = createMockSocketForHeartbeat({ id: "s1" });
    const s2 = createMockSocketForHeartbeat({ id: "s2" });
    manager.add(s1);
    manager.add(s2);
    expect(manager.getSocketCount()).toBe(2);
    manager.clear(); // 清理定时器，避免 leak
  }, { sanitizeOps: false, sanitizeResources: false });

  it("remove 应减少管理的 Socket 数量", () => {
    const manager = new BatchHeartbeatManager(30000, 60000);
    const s1 = createMockSocketForHeartbeat({ id: "s1" });
    manager.add(s1);
    expect(manager.getSocketCount()).toBe(1);
    manager.remove(s1);
    expect(manager.getSocketCount()).toBe(0);
  });

  it("handlePong 应更新最后心跳时间（不抛错）", () => {
    const manager = new BatchHeartbeatManager(30000, 60000);
    const s1 = createMockSocketForHeartbeat({ id: "s1" });
    manager.add(s1);
    manager.handlePong(s1);
    expect(manager.getSocketCount()).toBe(1);
    manager.clear(); // 清理定时器，避免 leak
  }, { sanitizeOps: false, sanitizeResources: false });

  it("clear 应清空所有 Socket", () => {
    const manager = new BatchHeartbeatManager(30000, 60000);
    const s1 = createMockSocketForHeartbeat({ id: "s1" });
    manager.add(s1);
    manager.clear();
    expect(manager.getSocketCount()).toBe(0);
  });
});

// ========== Server getStats 统计信息 ==========
describe("Server getStats 统计信息", () => {
  it("应包含 messageQueue 和 messageCache 统计", () => {
    const server = new Server({
      port: 0,
      path: "/ws",
      messageCache: { maxSize: 100, ttl: 60000 },
      messageQueue: { maxSize: 200, batchSize: 20, processInterval: 5 },
    });
    const stats = server.getStats();
    expect(stats.messageQueue).toBeDefined();
    expect(stats.messageQueue?.maxSize).toBe(200);
    expect(stats.messageQueue?.batchSize).toBe(20);
    expect(stats.messageCache).toBeDefined();
    expect(stats.messageCache?.maxSize).toBe(100);
  });

  it("禁用 messageCache 时不应包含 messageCache 统计", () => {
    const server = new Server({
      port: 0,
      path: "/ws",
      messageCache: false,
    });
    const stats = server.getStats();
    expect(stats.messageCache).toBeUndefined();
  });

  it("禁用 messageQueue 时不应包含 messageQueue 统计", () => {
    const server = new Server({
      port: 0,
      path: "/ws",
      messageQueue: false,
    });
    const stats = server.getStats();
    expect(stats.messageQueue).toBeUndefined();
  });
});

// ========== useMessageQueue 广播入队 ==========
describe("useMessageQueue 广播通过消息队列", () => {
  it("useMessageQueue=true 时 broadcast 应通过队列发送", async () => {
    const server = new Server({
      port: 0,
      path: "/ws",
      useMessageQueue: true,
      messageQueue: { maxSize: 1000, batchSize: 50, processInterval: 5 },
    });

    server.on("connection", () => {});

    await server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);
    await delay(300);
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);

    // 先设置监听再广播，过滤 ping 等系统消息
    const msgPromise = waitForEvent(ws, "broadcast-event", 3000);
    await server.broadcast("broadcast-event", { msg: "hello" });
    await delay(200);

    let received = false;
    try {
      await msgPromise;
      received = true;
    } catch {
      // 超时
    }

    ws.close();
    await delay(100);
    await server.close();
    await delay(100);

    expect(received).toBe(true);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("useMessageQueue=true 时 emitToRoom 应通过队列发送", async () => {
    const server = new Server({
      port: 0,
      path: "/ws",
      useMessageQueue: true,
      messageQueue: { maxSize: 1000, batchSize: 50, processInterval: 5 },
    });

    server.on("connection", (socket) => {
      socket.join("room-a");
    });

    await server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);
    await delay(300);
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(200);

    // 先设置监听再发送，过滤 ping 等系统消息
    const msgPromise = waitForEvent(ws, "room-event", 3000);
    await server.emitToRoom("room-a", "room-event", { msg: "hi" });
    await delay(200);

    let received = false;
    try {
      await msgPromise;
      received = true;
    } catch {
      // 超时
    }

    ws.close();
    await delay(100);
    await server.close();
    await delay(100);

    expect(received).toBe(true);
  }, { sanitizeOps: false, sanitizeResources: false });
});

// ========== useBatchHeartbeat 批量心跳 ==========
describe("useBatchHeartbeat 批量心跳", () => {
  it("useBatchHeartbeat=true 时应能正常收发心跳", async () => {
    // 使用 port 0 由系统分配端口，避免 Windows CI 下随机端口权限错误 (10013)
    const server = new Server({
      port: 0,
      path: "/ws",
      pingInterval: 500,
      pingTimeout: 2000,
      useBatchHeartbeat: true,
    });

    server.on("connection", () => {});

    await server.listen();
    await delay(200);

    const testPort = server.getPort();
    const ws = await createWebSocketClient(`ws://localhost:${testPort}/ws`);
    // 使用 addEventListener 的 waitForPing，超时放宽以兼容 Bun 定时器
    let gotPing = false;
    try {
      await waitForPing(ws, 5000);
      gotPing = true;
    } catch {
      // 超时未收到 ping
    }

    ws.send(JSON.stringify({ type: "pong" }));
    await delay(200);

    ws.close();
    await delay(100);
    await server.close();
    await delay(100);

    expect(gotPing).toBe(true);
  }, { sanitizeOps: false, sanitizeResources: false });
});
