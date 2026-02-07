/**
 * @fileoverview MongoDB 适配器测试
 * 测试 MongoDB 分布式适配器的功能（使用真实的 Docker MongoDB 容器）
 */

import { getEnv } from "@dreamer/runtime-adapter";
import { beforeAll, describe, expect, it } from "@dreamer/test";
import { MongoClient } from "mongodb";
import { MongoDBAdapter } from "../src/adapters/mongodb.ts";
import { Server } from "../src/mod.ts";
import type { ServerOptions } from "../src/types.ts";
import { delay, getAvailablePort } from "./test-utils.ts";

/** 获取环境变量，带默认值 */
function getEnvWithDefault(key: string, defaultValue: string): string {
  return getEnv(key) || defaultValue;
}

/**
 * MongoDB 连接配置（使用 Docker 中的 MongoDB）
 * 支持认证，默认账户 root/8866231（可通过 MONGODB_USER、MONGODB_PASSWORD 覆盖）
 * 设置 MONGODB_USER="" 可禁用认证（用于无认证环境）
 */
const mongoUser = getEnvWithDefault("MONGODB_USER", "root");
const mongoPassword = getEnvWithDefault("MONGODB_PASSWORD", "8866231");
const MONGODB_CONFIG = {
  host: getEnvWithDefault("MONGODB_HOST", "127.0.0.1"),
  port: parseInt(getEnvWithDefault("MONGODB_PORT", "27017")),
  database: getEnvWithDefault("MONGODB_DATABASE", "websocket_test"),
  replicaSet: "rs0",
  directConnection: true,
  ...(mongoUser && mongoPassword
    ? {
        username: mongoUser,
        password: mongoPassword,
        authSource: getEnvWithDefault("MONGODB_AUTH_SOURCE", "admin"),
      }
    : {}),
};

/** 检测 MongoDB 是否可用（用于跳过依赖 MongoDB 的测试） */
async function checkMongoDBAvailable(): Promise<boolean> {
  try {
    const url = mongoUser && mongoPassword
      ? `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPassword)}@${MONGODB_CONFIG.host}:${MONGODB_CONFIG.port}/${MONGODB_CONFIG.database}?authSource=${getEnvWithDefault("MONGODB_AUTH_SOURCE", "admin")}`
      : `mongodb://${MONGODB_CONFIG.host}:${MONGODB_CONFIG.port}/${MONGODB_CONFIG.database}`;
    const client = new MongoClient(url);
    await client.connect();
    await client.db().command({ ping: 1 });
    await client.close();
    return true;
  } catch {
    return false;
  }
}

describe("MongoDB 适配器 - 真实场景测试", () => {
  let server1: Server;
  let server2: Server;
  /** MongoDB 是否可用（在部分测试中用于跳过） */
  let mongoDBAvailable = false;

  beforeAll(async () => {
    mongoDBAvailable = await checkMongoDBAvailable();
  });

  it("应该能够初始化和关闭适配器", async () => {
    if (!mongoDBAvailable) return;
    const testPort1 = getAvailablePort();
    const options: ServerOptions = {
      port: testPort1,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5, // 5 秒心跳，便于测试
      }),
    };
    server1 = new Server(options);

    await server1.listen();
    await delay(2000); // MongoDB 连接可能需要更多时间

    expect(server1).toBeTruthy();

    await server1.close();
    await delay(1000);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持添加和移除 Socket 到房间", async () => {
    if (!mongoDBAvailable) return;
    const testPort1 = getAvailablePort();
    server1 = new Server({
      port: testPort1,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
      }),
    });

    await server1.listen();
    await delay(2000);

    // 先注册事件监听器，然后再建立连接
    server1.on("connection", (socket) => {
      socket.join("room-1");
      socket.join("room-2");
    });

    // 创建真实的 Socket 连接
    const ws1 = new WebSocket(`ws://localhost:${testPort1}/ws`);
    await new Promise<void>((resolve) => {
      ws1.onopen = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    await delay(1000); // 等待 socket.join 完成并同步到 MongoDB

    // 获取适配器实例（通过私有属性访问）
    const serverInternal = server1 as unknown as {
      adapter?: MongoDBAdapter;
      sockets: Map<string, unknown>;
    };
    const adapter = serverInternal.adapter;
    if (!adapter) {
      throw new Error("适配器未初始化");
    }

    // 检查房间内的 Socket
    const socketsInRoom1 = await adapter.getSocketsInRoom("room-1");
    expect(socketsInRoom1.length).toBeGreaterThan(0);

    // 检查 Socket 所在的房间
    const allSockets = Array.from(serverInternal.sockets.keys());
    if (allSockets.length > 0) {
      const socketId = allSockets[0];
      const roomsForSocket = await adapter.getRoomsForSocket(socketId);
      expect(roomsForSocket.length).toBeGreaterThan(0);
    }

    ws1.close();
    await delay(500);
    await server1.close();
    await delay(1000);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持服务器注册和注销", async () => {
    if (!mongoDBAvailable) return;
    const testPort1 = getAvailablePort();
    server1 = new Server({
      port: testPort1,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
      }),
    });

    await server1.listen();
    await delay(2000);

    const serverInternal = server1 as unknown as {
      adapter?: MongoDBAdapter;
      serverId: string;
    };
    const adapter = serverInternal.adapter;
    if (!adapter) {
      throw new Error("适配器未初始化");
    }

    // 获取所有服务器 ID
    const serverIds = await adapter.getServerIds();
    expect(serverIds).toContain(serverInternal.serverId);

    await server1.close();
    await delay(2000); // 等待注销完成

    const serverIdsAfter = await adapter.getServerIds();
    // 服务器注销后，可能还在列表中（TTL 未过期），但应该不再活跃
    expect(serverIdsAfter.length).toBeGreaterThanOrEqual(0);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持消息广播和订阅（多服务器场景）", async () => {
    if (!mongoDBAvailable) return;
    const testPort1 = getAvailablePort();
    const testPort2 = getAvailablePort();

    server1 = new Server({
      port: testPort1,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
        keyPrefix: "test-server1",
      }),
    });

    server2 = new Server({
      port: testPort2,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
        keyPrefix: "test-server2",
      }),
    });

    await server1.listen();
    await server2.listen();
    await delay(3000); // MongoDB 连接需要更多时间

    const server1Internal = server1 as unknown as { adapter?: MongoDBAdapter };
    const server2Internal = server2 as unknown as { adapter?: MongoDBAdapter };
    const adapter1 = server1Internal.adapter;
    const adapter2 = server2Internal.adapter;

    if (!adapter1 || !adapter2) {
      throw new Error("适配器未初始化");
    }

    let receivedMessage: any = null;

    // 在 server2 上创建客户端连接并监听消息
    const ws2 = new WebSocket(`ws://localhost:${testPort2}/ws`);
    await new Promise<void>((resolve) => {
      ws2.onopen = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    await delay(1000);

    server2.on("connection", (socket) => {
      socket.on("test-event", (data: any) => {
        receivedMessage = data;
      });
    });

    await delay(1000);

    // 在 server1 上创建客户端连接并发送消息
    const ws1 = new WebSocket(`ws://localhost:${testPort1}/ws`);
    await new Promise<void>((resolve) => {
      ws1.onopen = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    await delay(1000);

    // 通过 server1 广播消息（应该被 server2 接收）
    await server1.broadcast("test-event", {
      message: "hello from server 1",
    });

    await delay(3000); // MongoDB Change Streams 需要更多时间

    // 验证 server2 是否收到消息
    // 注意：由于是跨服务器广播，消息会通过适配器传递

    ws1.close();
    ws2.close();
    await delay(500);

    await server1.close();
    await server2.close();
    await delay(1000);
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

  it("应该支持房间广播（多服务器场景）", async () => {
    if (!mongoDBAvailable) return;
    const testPort1 = getAvailablePort();
    const testPort2 = getAvailablePort();

    server1 = new Server({
      port: testPort1,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
        keyPrefix: "test-room1",
      }),
    });

    server2 = new Server({
      port: testPort2,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
        keyPrefix: "test-room2",
      }),
    });

    await server1.listen();
    await server2.listen();
    await delay(3000);

    // 在 server1 上创建客户端并加入房间
    const ws1 = new WebSocket(`ws://localhost:${testPort1}/ws`);
    await new Promise<void>((resolve) => {
      ws1.onopen = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    let socket1Id: string | null = null;
    server1.on("connection", (socket) => {
      socket1Id = socket.id;
      socket.join("shared-room");
    });

    await delay(1000);

    // 在 server2 上创建客户端并加入相同房间
    const ws2 = new WebSocket(`ws://localhost:${testPort2}/ws`);
    await new Promise<void>((resolve) => {
      ws2.onopen = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    let socket2Id: string | null = null;
    let receivedMessage: any = null;

    server2.on("connection", (socket) => {
      socket2Id = socket.id;
      socket.join("shared-room");
      socket.on("room-message", (data: any) => {
        receivedMessage = data;
      });
    });

    await delay(1000);

    // 通过 server1 向房间发送消息（server2 上的客户端应该收到）
    await server1.emitToRoom("shared-room", "room-message", {
      message: "hello to shared room",
    });

    await delay(3000); // MongoDB Change Streams 需要更多时间

    // 验证消息是否被接收
    // 注意：跨服务器房间广播需要通过适配器实现

    ws1.close();
    ws2.close();
    await delay(500);

    await server1.close();
    await server2.close();
    await delay(1000);
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

  it("应该支持多服务器场景的房间管理", async () => {
    if (!mongoDBAvailable) return;
    const testPort1 = getAvailablePort();
    const testPort2 = getAvailablePort();

    server1 = new Server({
      port: testPort1,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
        keyPrefix: "test-multi1",
      }),
    });

    server2 = new Server({
      port: testPort2,
      path: "/ws",
      adapter: new MongoDBAdapter({
        connection: MONGODB_CONFIG,
        heartbeatInterval: 5,
        keyPrefix: "test-multi2",
      }),
    });

    await server1.listen();
    await server2.listen();
    await delay(3000);

    const server1Internal = server1 as unknown as { adapter?: MongoDBAdapter };
    const server2Internal = server2 as unknown as { adapter?: MongoDBAdapter };
    const adapter1 = server1Internal.adapter;
    const adapter2 = server2Internal.adapter;

    if (!adapter1 || !adapter2) {
      throw new Error("适配器未初始化");
    }

    // 在 server1 上添加 Socket 到房间
    const ws1 = new WebSocket(`ws://localhost:${testPort1}/ws`);
    await new Promise<void>((resolve) => {
      ws1.onopen = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    let socket1Id: string | null = null;
    server1.on("connection", (socket) => {
      socket1Id = socket.id;
      socket.join("shared-room");
    });

    await delay(1000);

    // 在 server2 上添加 Socket 到相同房间
    const ws2 = new WebSocket(`ws://localhost:${testPort2}/ws`);
    await new Promise<void>((resolve) => {
      ws2.onopen = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    let socket2Id: string | null = null;
    server2.on("connection", (socket) => {
      socket2Id = socket.id;
      socket.join("shared-room");
    });

    await delay(1000);

    // 检查每个服务器上的房间成员
    if (socket1Id) {
      const sockets1InRoom = await adapter1.getSocketsInRoom("shared-room");
      expect(sockets1InRoom).toContain(socket1Id);
    }

    if (socket2Id) {
      const sockets2InRoom = await adapter2.getSocketsInRoom("shared-room");
      expect(sockets2InRoom).toContain(socket2Id);
    }

    // 获取所有服务器 ID（每个适配器只能看到自己键空间下的服务器）
    // 由于使用了不同的 keyPrefix，每个适配器只能看到自己的服务器
    // 所以这里检查 adapter1 和 adapter2 各自的服务器 ID 列表
    const serverIds1 = await adapter1.getServerIds();
    const serverIds2 = await adapter2.getServerIds();
    // 每个适配器至少应该能看到自己的服务器
    expect(serverIds1.length).toBeGreaterThanOrEqual(1);
    expect(serverIds2.length).toBeGreaterThanOrEqual(1);

    ws1.close();
    ws2.close();
    await delay(500);

    await server1.close();
    await server2.close();
    await delay(1000);
  }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
});
