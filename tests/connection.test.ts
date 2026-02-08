/**
 * @fileoverview 连接和消息测试
 * 测试 WebSocket 连接建立、握手信息和消息处理
 */

import { describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";
import { createWebSocketClient, delay } from "./test-utils.ts";

describe("WebSocket 连接和消息", () => {
  it("应该接受 WebSocket 连接", async () => {
    const server = new Server({ port: 0, path: "/ws" });
    let socketConnected = false;

    server.on("connection", (socket) => {
      socketConnected = true;
      expect(socket).toBeTruthy();
      expect(socket.id).toBeTruthy();
      expect(socket.connected).toBe(true);
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    expect(socketConnected).toBe(true);
    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该创建握手信息", async () => {
    const server = new Server({ port: 0, path: "/ws" });
    let handshakeReceived = false;

    server.on("connection", (socket) => {
      expect(socket.handshake).toBeTruthy();
      expect(socket.handshake.url).toBeTruthy();
      expect(socket.handshake.headers).toBeTruthy();
      expect(socket.handshake.query).toBeTruthy();
      handshakeReceived = true;
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws?token=abc123`,
    );

    await delay(300);
    expect(handshakeReceived).toBe(true);
    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该处理文本消息", async () => {
    const server = new Server({ port: 0, path: "/ws" });
    let messageReceived = false;
    let receivedData: any = null;

    server.on("connection", (socket) => {
      socket.on("test-event", (data: unknown) => {
        messageReceived = true;
        receivedData = data;
      });
    });

    server.listen();
    await delay(200);
    const testPort = server.getPort();

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);

    // 发送消息
    const testMessage = {
      type: "event",
      event: "test-event",
      data: { message: "Hello, World!" },
    };
    ws.send(JSON.stringify(testMessage));

    await delay(300);
    expect(messageReceived).toBe(true);
    expect(receivedData).toEqual({ message: "Hello, World!" });

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该发送消息到客户端", async () => {
    const server = new Server({ port: 0, path: "/ws" });

    // 设置消息监听器（在连接建立之前）
    let messageReceived = false;
    let receivedData: any = null;

    server.on("connection", (socket) => {
      // 在连接建立后立即发送消息
      // 使用 setTimeout 确保在下一个事件循环中发送，给连接一些时间完全建立
      setTimeout(() => {
        socket.emit("server-message", { text: "Hello from server" });
      }, 100);
    });

    server.listen();
    await delay(300);
    const testPort = server.getPort();

    // 在创建 WebSocket 之前设置消息监听器
    const wsPromise = new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      ws.onopen = () => resolve(ws);
      ws.onerror = (error) => reject(error);
      // 在连接建立之前就设置消息监听器
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === "event" && data.event === "server-message") {
            messageReceived = true;
            receivedData = data;
          }
        } catch (e) {
          // 忽略解析错误
        }
      };
    });

    const ws = await wsPromise;

    // 发送一个消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    // 这对于 Bun 环境很重要，因为 open 事件可能找不到适配器
    await delay(50);
    ws.send(JSON.stringify({ type: "ping" }));

    // 等待消息发送和接收
    await delay(500);

    expect(messageReceived).toBe(true);
    expect(receivedData.type).toBe("event");
    expect(receivedData.event).toBe("server-message");
    expect(receivedData.data).toEqual({ text: "Hello from server" });

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该处理心跳消息", async () => {
    const server = new Server({ port: 0, path: "/ws" });

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

    await delay(200);
    // 心跳响应应该被正确处理
    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
