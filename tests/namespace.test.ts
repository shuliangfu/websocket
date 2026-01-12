/**
 * @fileoverview 命名空间测试
 * 测试 WebSocket 服务器的命名空间功能
 */

import { describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import {
  createWebSocketClient,
  delay,
  getAvailablePort,
} from "./test-utils.ts";

describe("WebSocket 命名空间", () => {
  it("应该支持创建命名空间", () => {
    const server = new Server({ port: 8080 });
    const namespace = server.of("/admin");

    expect(namespace).toBeTruthy();
    expect(namespace.name).toBe("/admin");
  });

  it("应该支持命名空间名称验证", () => {
    const server = new Server({ port: 8080 });

    expect(() => {
      server.of("invalid"); // 应该以 "/" 开头
    }).toThrow();
  });

  it("应该支持命名空间连接", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort });
    let connected = false;

    const adminNamespace = server.of("/admin");
    adminNamespace.on("connection", (socket) => {
      connected = true;
      expect(socket).toBeTruthy();
    });

    server.listen();
    await delay(200);

    // 连接到命名空间
    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/admin`,
    );

    await delay(300);
    expect(connected).toBe(true);

    ws.close();
    await delay(100);
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持命名空间中间件", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort });
    let middlewareCalled = false;
    let connected = false;

    const adminNamespace = server.of("/admin");
    adminNamespace.use((socket, next) => {
      middlewareCalled = true;
      next();
    });

    adminNamespace.on("connection", () => {
      connected = true;
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/admin`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);
    expect(middlewareCalled).toBe(true);
    expect(connected).toBe(true);

    ws.close();
    await delay(100);
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持多个命名空间", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort });
    let adminConnected = false;
    let userConnected = false;

    const adminNamespace = server.of("/admin");
    adminNamespace.on("connection", () => {
      adminConnected = true;
    });

    const userNamespace = server.of("/user");
    userNamespace.on("connection", () => {
      userConnected = true;
    });

    server.listen();
    await delay(200);

    // 连接到 admin 命名空间
    const ws1 = await createWebSocketClient(
      `ws://localhost:${testPort}/admin`,
    );
    await delay(300);
    expect(adminConnected).toBe(true);
    ws1.close();

    // 连接到 user 命名空间
    const ws2 = await createWebSocketClient(
      `ws://localhost:${testPort}/user`,
    );
    await delay(300);
    expect(userConnected).toBe(true);
    ws2.close();

    await delay(100);
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持获取所有命名空间", () => {
    const server = new Server({ port: 8080 });

    const adminNamespace = server.of("/admin");
    const userNamespace = server.of("/user");
    const chatNamespace = server.of("/chat");

    // 验证命名空间已创建
    expect(adminNamespace).toBeTruthy();
    expect(userNamespace).toBeTruthy();
    expect(chatNamespace).toBeTruthy();
    expect(adminNamespace.name).toBe("/admin");
    expect(userNamespace.name).toBe("/user");
    expect(chatNamespace.name).toBe("/chat");
  });

  it("应该支持重复获取同一命名空间", () => {
    const server = new Server({ port: 8080 });

    const namespace1 = server.of("/admin");
    const namespace2 = server.of("/admin");

    // 应该返回同一个实例
    expect(namespace1).toBe(namespace2);
  });

  it("应该支持命名空间隔离", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort });
    let adminMessageReceived = false;
    let userMessageReceived = false;

    const adminNamespace = server.of("/admin");
    adminNamespace.on("connection", (socket) => {
      socket.on("admin-event", () => {
        adminMessageReceived = true;
      });
    });

    const userNamespace = server.of("/user");
    userNamespace.on("connection", (socket) => {
      socket.on("user-event", () => {
        userMessageReceived = true;
      });
    });

    server.listen();
    await delay(200);

    // 连接到 admin 命名空间并发送消息
    const ws1 = await createWebSocketClient(
      `ws://localhost:${testPort}/admin`,
    );
    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws1.send(JSON.stringify({ type: "ping" }));
    await delay(100);
    ws1.send(
      JSON.stringify({ type: "event", event: "admin-event", data: {} }),
    );
    await delay(500);
    expect(adminMessageReceived).toBe(true);
    expect(userMessageReceived).toBe(false);
    ws1.close();

    // 连接到 user 命名空间并发送消息
    const ws2 = await createWebSocketClient(
      `ws://localhost:${testPort}/user`,
    );
    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws2.send(JSON.stringify({ type: "ping" }));
    await delay(100);
    ws2.send(
      JSON.stringify({ type: "event", event: "user-event", data: {} }),
    );
    await delay(500);
    expect(userMessageReceived).toBe(true);
    ws2.close();

    await delay(100);
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
