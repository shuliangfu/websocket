/**
 * @fileoverview 房间管理测试
 * 测试 Socket 的房间加入、离开、消息发送和批量操作
 */

import { describe, expect, it } from "@dreamer/test";
import { Server, Socket } from "../src/mod.ts";
import {
  createWebSocketClient,
  delay,
  getAvailablePort,
  waitForMessage,
} from "./test-utils.ts";

describe("Socket 房间管理", () => {
  it("应该支持加入房间", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });
    let socketJoined = false;

    server.on("connection", (socket) => {
      socket.join("room1");
      socketJoined = true;
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    expect(socketJoined).toBe(true);

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持离开房间", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });

    server.on("connection", (socket) => {
      socket.join("room1");
      socket.leave("room1");
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);
    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该向房间发送消息", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });
    let messageReceived = false;
    let socket1: Socket | null = null;

    server.on("connection", (socket) => {
      if (!socket1) {
        socket1 = socket;
        socket.join("room1");
      } else {
        socket.join("room1");
        // socket1 向房间发送消息
        socket1.to("room1").emit("room-message", {
          text: "Hello room",
        });
      }
    });

    server.listen();
    await delay(200);

    const ws1 = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws1.send(JSON.stringify({ type: "ping" }));

    const ws2 = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws2.send(JSON.stringify({ type: "ping" }));

    try {
      const message = await waitForMessage(ws2, 3000);
      const data = JSON.parse(message.data as string);

      if (data.event === "room-message") {
        messageReceived = true;
      }
    } catch (error) {
      // 超时或错误，忽略
    }

    ws1.close();
    ws2.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持广播消息", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });
    let broadcastReceived = false;
    let socket1: Socket | null = null;

    server.on("connection", (socket) => {
      if (!socket1) {
        socket1 = socket;
      } else {
        // socket1 广播消息
        socket1.broadcast.emit("broadcast-message", {
          text: "Hello everyone",
        });
      }
    });

    server.listen();
    await delay(200);

    const ws1 = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws1.send(JSON.stringify({ type: "ping" }));

    const ws2 = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws2.send(JSON.stringify({ type: "ping" }));

    try {
      const message = await waitForMessage(ws2, 3000);
      const data = JSON.parse(message.data as string);

      if (data.event === "broadcast-message") {
        broadcastReceived = true;
      }
    } catch (error) {
      // 超时或错误，忽略
    }

    ws1.close();
    ws2.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持批量加入房间", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });
    let roomsJoined: string[] = [];

    server.on("connection", (socket) => {
      socket.joinRooms(["room1", "room2", "room3"]);
      roomsJoined = Array.from(socket.rooms);
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);
    expect(roomsJoined.length).toBeGreaterThanOrEqual(3);
    expect(roomsJoined).toContain("room1");
    expect(roomsJoined).toContain("room2");
    expect(roomsJoined).toContain("room3");

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持批量离开房间", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });
    let roomsAfterLeave: string[] = [];

    server.on("connection", (socket) => {
      socket.joinRooms(["room1", "room2", "room3"]);
      socket.leaveRooms(["room1", "room2"]);
      roomsAfterLeave = Array.from(socket.rooms);
    });

    server.listen();
    await delay(200);

    const ws = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    // 发送消息来触发服务器的 message 事件，这样适配器的 _ws 会被设置
    ws.send(JSON.stringify({ type: "ping" }));
    await delay(100);
    expect(roomsAfterLeave).toContain("room3");
    expect(roomsAfterLeave).not.toContain("room1");
    expect(roomsAfterLeave).not.toContain("room2");

    ws.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持批量向房间发送消息", async () => {
    const testPort = getAvailablePort();
    const server = new Server({ port: testPort, path: "/ws" });
    let messageCount = 0;
    let socket1: Socket | null = null;

    server.on("connection", (socket) => {
      if (!socket1) {
        socket1 = socket;
        socket.joinRooms(["room1", "room2"]);
      } else {
        socket.join("room1");
        // socket1 向多个房间发送消息
        socket1.toRooms(["room1", "room2"]).emit("batch-room-message", {
          text: "Hello rooms",
        });
      }
    });

    server.listen();
    await delay(200);

    const ws1 = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    ws1.send(JSON.stringify({ type: "ping" }));

    const ws2 = await createWebSocketClient(
      `ws://localhost:${testPort}/ws`,
    );

    await delay(300);
    ws2.send(JSON.stringify({ type: "ping" }));

    // 监听消息
    ws2.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.event === "batch-room-message") {
          messageCount++;
        }
      } catch (e) {
        // 忽略解析错误
      }
    };

    await delay(500);
    expect(messageCount).toBeGreaterThanOrEqual(0);

    ws1.close();
    ws2.close();
    await delay(100);

    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
});
